# Slice 2 - OCR and Extraction Pipeline Requirements

**Status:** Requirements Freeze  
**Date:** May 17, 2026  
**Sprint:** Days 3–4 (build), Days 5 (validation integration)

---

## 1. User Story

**As an** AP Operator  
**I want to** upload a PDF invoice and have the system automatically extract key vendor and financial data  
**So that** I don't manually re-type invoice details and can move to validation/approval quickly.

---

## 2. Functional Requirements

### 2.1 Extraction Fields (8 mandatory fields)

| Field            | Type              | Required in Output | Example           | Notes                                               |
| ---------------- | ----------------- | ------------------ | ----------------- | --------------------------------------------------- |
| `vendor_name`    | string            | Yes                | "Acme Corp"       | OCR → LLM entity extraction                         |
| `invoice_number` | string            | Yes                | "INV-2024-001234" | Unique identifier per vendor                        |
| `invoice_date`   | ISO date          | Yes                | "2024-05-15"      | Parsed from text                                    |
| `subtotal`       | decimal(14,2)     | Yes                | "1000.00"         | Pre-tax amount                                      |
| `tax`            | decimal(14,2)     | No                 | "100.00"          | Can be null if included in total                    |
| `total`          | decimal(14,2)     | Yes                | "1100.00"         | Grand total                                         |
| `po_number`      | string            | No                 | "PO-0054321"      | Can be null; triggers missing_po flag in validation |
| `currency`       | string (ISO-4217) | Yes                | "USD"             | Defaults to USD if not found                        |

### 2.2 Extraction Process

**Trigger:** Automatic, initiated when job status moves to `processing` (from Slice 1).

**Sequence:**

1. Retrieve uploaded PDF from file storage.
2. Run OCR (extract raw text from PDF).
3. Pass raw OCR text + PDF metadata to LLM extractor.
4. LLM returns structured JSON with extracted fields + per-field confidence.
5. Validate extraction payload schema.
6. Persist extracted data to `invoices` table + raw extraction JSON.
7. Update job status to `extracted`.
8. Trigger Slice 3 (validation) immediately after.

**OCR Provider:** TBD in decision log. Placeholder: Google Document AI or AWS Textract. **Single provider for MVP** (no switching logic).

**LLM Extractor:** GPT-4 or Claude (extract via prompt; no fine-tuning for MVP).

### 2.3 Confidence Scoring

Each extracted field has a confidence label (not a probability %; those claims must be validated on real data post-MVP).

**Confidence levels:**

| Level    | Criteria                                                          | Example                                                |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `high`   | Field explicitly present in OCR text; unambiguous match           | "Total: $1,100.00" → clarity + numeric validation      |
| `medium` | Field inferrable from context; minor ambiguity or OCR degradation | "Tot 1100" (typo/OCR error) → corrected by LLM pattern |
| `low`    | Field guessed or default applied; missing/unclear in source       | Currency not visible → default USD                     |

**Storage:** Persisted as text label in columns: `vendor_name_confidence`, `invoice_number_confidence`, etc.

### 2.4 Partial Extraction Handling

**If extraction partially fails (e.g., 6 of 8 fields extracted):**

- All extracted fields are persisted with their confidence.
- Missing fields stored as `null`.
- Job status moves to `extracted` (not `failed`).
- Validation engine (Slice 3) will flag missing required fields.
- Reviewer can manually enter missing data in the detail screen.

**If extraction completely fails (OCR error, LLM API down, timeout):**

- Job status moves to `failed`.
- `error_message` set with human-readable reason (e.g., "OCR service unavailable").
- Invoice record NOT created; job + error logged for retry.
- Retry policy: exponential backoff (1s, 2s, 4s, 8s), max 3 attempts, then manual review flag.

---

## 3. Integration Points with Slice 1

### 3.1 Job Status Transitions

```
Slice 1: queued → processing (operator sees this in jobs list)
Slice 2: processing → extracted (job record updated)
         OR processing → failed (with error_message)
Slice 3: extracted → validated (after validation rules engine runs)
```

**Implementation:** Job status managed in `/api/jobs/route.ts`. Extraction worker subscribes to jobs in `processing` state.

### 3.2 Data Flow

```
Upload API (Slice 1)
  ↓
job.status = "queued"
  ↓
Extraction worker polls jobs table for status = "queued" (async job runner)
  ↓
job.status = "processing"
  ↓
OCR → LLM → Extract 8 fields
  ↓
INSERT into invoices (job_id, vendor_name, ..., raw_extraction_json)
  ↓
job.status = "extracted"
  ↓
Validation engine triggered (Slice 3)
```

### 3.3 Job Runner Architecture

**Option A (Recommended for MVP):** Synchronous extraction on upload API response.

- Upload endpoint receives PDF, creates job, immediately calls extractor, persists invoice, returns response.
- **Pros:** Simple, low latency, demo-friendly.
- **Cons:** Upload endpoint becomes slower; timeouts on large batches.
- **SLO:** 60s per-file extraction; batch timing is informational only in MVP.

**Option B:** Async job queue (Redis/Bull or similar).

- Upload creates job in `queued`; extraction worker processes async.
- **Pros:** Upload endpoint fast; scalable.
- **Cons:** Adds dependency (queue system); more complex testing.
- **Defer to Slice 3+ when throughput is measured.**

### 3.4 File Storage Integration

- Use existing S3 URL (`job.file_url` from Slice 1) to retrieve PDF.
- No change to upload/storage layer; just read and extract.

---

## 4. Schema Changes (Frozen in SCHEMA_FREEZE.md)

### 4.1 invoices Table

Slice 2 populates these columns:

```sql
vendor_name, vendor_name_confidence
invoice_number, invoice_number_confidence
invoice_date, invoice_date_confidence
subtotal, subtotal_confidence
tax, tax_confidence
total, total_confidence
po_number, po_number_confidence
currency, currency_confidence
pdf_url
raw_extraction_json (jsonb containing full LLM response)
```

All `*_confidence` columns set to one of: `high`, `medium`, `low`, `null`.

### 4.2 New Extraction Logging Table (Optional Enhancement)

If retry + fallback logic needed post-MVP, add `extraction_attempts` table:

```sql
-- Not in Slice 2 MVP, but reserved for future
CREATE TABLE extraction_attempts (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  attempt_number INT,
  provider VARCHAR (e.g., 'google-doc-ai', 'aws-textract'),
  status VARCHAR ('success', 'failed', 'timeout'),
  error_details JSONB,
  response_time_ms INT,
  created_at TIMESTAMPTZ
);
```

**Decision:** Defer this until Slice 4 (hardening). For MVP, log to application logs + `job.error_message`.

---

## 5. Success Metrics & Definition of Done

### 5.1 Extraction Accuracy (Measured on Seed Dataset)

| Metric                      | Target         | Measured As                                                                   | Acceptance                           |
| --------------------------- | -------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| **Core Field Completeness** | ≥ 80%          | (# invoices with 8/8 fields present OR 7/8 with null tax) / total             | Pass if ≥ 80% of 20-invoice test set |
| **Vendor Match**            | 100%           | Vendor name extracted matches receipt (case-insensitive)                      | No typos/OCR errors in sample        |
| **Invoice # Accuracy**      | 100%           | Invoice number matches receipt                                                | No digit transpositions              |
| **Total Amount Accuracy**   | 100%           | Total value matches receipt within ±$0.01                                     | Rounding tolerance met               |
| **Confidence Labeling**     | ≥ 90% accuracy | If labeled `high`, field matches receipt; if `low`, reviewer manually entered | Spot-check 5 high/5 low              |

### 5.2 Performance SLOs

| Metric                          | Target        | Acceptance                                            |
| ------------------------------- | ------------- | ----------------------------------------------------- |
| **Per-file extraction latency** | ≤ 60s (p95)   | Single file OCR + LLM round-trip                      |
| **Batch latency (20 files)**    | Informational | Sequential processing; not a launch gate for MVP      |
| **Error rate (transient)**      | ≤ 5%          | OCR service or LLM API failures; retries succeed      |
| **Error rate (permanent)**      | ≤ 1%          | Corrupt PDF or unsupported format; manual review flag |

### 5.3 Data Quality Checks

- **Numeric validation:** If all three present (subtotal, tax, total), verify `subtotal + tax ≈ total` (tolerance ±$0.01). Log mismatch for Slice 3 validation.
- **Date parsing:** Invoice date in valid ISO date format or flag as `invalid_date` in validation_flags.
- **Currency:** Extracted as ISO-4217 code or default to USD; stored normalized.

### 5.4 Acceptance Criteria (Definition of Done)

**Functional AC:**

- [ ] Extract and persist all 8 fields from ≥ 16 of 20 seed invoices (80% completeness).
- [ ] Confidence labels present and consistent for all extracted fields.
- [ ] Partial extraction (e.g., 6 fields) persists with `null` for missing fields; job moves to `extracted`.
- [ ] Total extraction failure surfaces in job.error_message and job.status = `failed`.
- [ ] Raw extraction JSON saved to `raw_extraction_json` column for audit/debugging.

**Integration AC:**

- [ ] Job status automatically transitions queued → processing → extracted (or failed).
- [ ] Validation engine (Slice 3 stub) can read invoices table and apply rules.
- [ ] File URL from Slice 1 job correctly resolves to PDF for extraction.

**Code Quality AC:**

- [ ] Unit tests for extraction schema validation (happy path + missing fields).
- [ ] Unit tests for confidence mapping logic.
- [ ] Unit tests for OCR → LLM payload transformation.
- [ ] Integration test: upload → extract → invoice persisted end-to-end.
- [ ] No TypeScript errors in strict mode.
- [ ] ESLint clean.
- [ ] Error handling for OCR service outage and LLM API errors.

**Performance AC:**

- [ ] Single-file extraction completes in ≤ 60s (measured with real OCR provider, not mock).
- [ ] 20 seed invoices complete successfully with per-file SLO maintained.

**Observability AC:**

- [ ] Each extraction attempt logged with job_id, field count, confidence distribution, timestamp.
- [ ] Retry attempts logged separately (attempt #, error, retry strategy).
- [ ] Failed extractions logged to external logging service (e.g., structured logs with correlation ID).

---

## 6. Phased Release & Risk Mitigation

### 6.1 Phase A: Mock Extraction (Days 1–1.5)

**Objective:** Validate integration and data flow without external OCR dependency.

**Approach:**

- Implement mock OCR service returning hardcoded 8-field JSON.
- All mock extractions set confidence to `medium`.
- Upload a test batch and verify: job → invoices persisted, status transitions, schema valid.
- **Risk mitigation:** Prove Slice 1 + 2 integration works before real OCR integration.

**Acceptance:** Jobs transition to `extracted` status; 20 mock invoices created in DB.

### 6.2 Phase B: Single Real OCR Provider (Days 2–3.5)

**Objective:** Integrate real OCR provider (Google Document AI or AWS Textract) + LLM.

**Approach:**

- Swap mock with real OCR API calls (credentials from env vars).
- Implement retry logic (exponential backoff, 3 attempts max).
- Run extraction on 20 real sample invoices.
- Measure actual accuracy on seed dataset.
- **Risk mitigation:** If accuracy < 80%, escalate decision to choose different OCR or LLM before Day 5.

**Acceptance:** ≥ 80% core field completeness on seed invoices; no transient errors after retries.

### 6.3 Phase C: Validation Integration (Day 5)

**Objective:** Link extraction output to validation engine (Slice 3).

**Approach:**

- Invoke validation rules (Slice 3) immediately after extraction.
- Job transitions: extracted → validated (or extracted → exception if validation flags are critical).
- Verify no data loss in transition.

**Acceptance:** Jobs reach `validated` status; validation_flags table populated.

---

## 7. Key Decisions & Open Questions (for Sign-Off)

| Decision                          | Current Proposal                                     | Owner     | Status  |
| --------------------------------- | ---------------------------------------------------- | --------- | ------- |
| **Extraction Sync vs. Async**     | Sync (60s SLO per file; async fallback if timeout)   | ProdEng   | Pending |
| **OCR Provider**                  | TBD: Google Document AI or AWS Textract              | Tech Lead | Pending |
| **LLM Extraction Provider**       | OpenAI GPT-4 or Anthropic Claude                     | Tech Lead | Pending |
| **Confidence Scoring Validation** | Spot-check 10 sample invoices post-MVP for accuracy  | ProdEng   | Pending |
| **Retry Strategy**                | Exponential backoff: 1s, 2s, 4s, 8s (max 3 attempts) | Tech Lead | Pending |
| **Extraction Timeout**            | 60s per file; batch timing informational only        | Tech Lead | Pending |

---

## 8. Dependencies & Assumptions

### 8.1 Dependencies

- Slice 1 complete (PDF upload + job creation).
- OCR service credentials provisioned (API key, endpoint).
- LLM API access (OpenAI or Claude; credits available).
- S3 or local file storage working (from Slice 1).

### 8.2 Assumptions

- **OCR quality:** Assumption that OCR provider can extract ≥ 80% of text accurately from standard invoices. **Risk:** Poor image quality or unusual layouts. **Mitigation:** Test on diverse sample set early in Phase B.
- **LLM consistency:** Assumption that LLM can parse OCR text into structured JSON consistently. **Risk:** Hallucination or field misattribution. **Mitigation:** Implement extraction schema validation; flag low-confidence results.
- **Batch timing:** Sequential 20-file runs are expected to exceed 5 minutes. **Mitigation:** Treat batch timing as informational only for MVP; use per-file SLO as the gate.

---

## 9. Test Plan Summary

### 9.1 Unit Tests (Test File: src/lib/extractor.test.ts)

```
✓ Mock extraction returns all 8 fields
✓ Confidence mapping (high/medium/low) assigned correctly
✓ Partial extraction handles null fields gracefully
✓ Numeric fields validate (e.g., total ≥ subtotal)
✓ Date parsing converts text to ISO date
✓ Currency defaults to USD if missing
✓ Extraction schema validation rejects malformed output
```

### 9.2 Integration Tests (Test File: src/app/api/extract/route.test.ts)

```
✓ Upload PDF → Job created → Extraction invoked → Invoice persisted
✓ Job status transitions: queued → processing → extracted
✓ raw_extraction_json persisted for audit
✓ Failed extraction sets job.status = failed + error_message
✓ File URL resolution works
```

### 9.3 E2E Test (Acceptance)

```
✓ Upload 20 real sample invoices
✓ All 20 reach extracted status with per-file SLO maintained
✓ ≥ 16 have complete 8-field extraction
✓ Invoices visible in /jobs and /invoices endpoints
✓ Click detail view; all fields readable
```

### 9.4 Seed Dataset

- **Location:** `seed/invoices/` in repo.
- **Count:** 20 real or realistic PDFs (scanned format).
- **Formats:** Mix of layouts, paper quality, fonts.
- **Baseline:** Manually verified ground truth for accuracy comparison.

---

## 10. Non-Functional Requirements

### 10.1 Security

- OCR/LLM API credentials stored in environment variables (never hardcoded).
- Raw extraction JSON may contain PII; log only non-sensitive fields.
- Extraction timeouts enforce (avoid resource exhaustion).

### 10.2 Observability

- Log extraction start/end with job_id, field count, confidence distribution.
- Log retry attempts (attempt #, error, delay).
- Log failures with root cause (OCR error, LLM error, timeout, schema validation).
- Structured JSON logging for easy parsing.

### 10.3 Maintainability

- Extraction logic isolated in `src/lib/extractor.ts` (testable, replaceable).
- LLM prompt versioned separately from code (enable A/B testing later).
- OCR provider abstracted (enable provider swap without code changes).

---

## 11. Success Outcomes (MVP Release Gate)

**Before moving to Slice 3 (Validation & Exceptions):**

1. ✅ 20 invoices uploaded, extracted, and persisted to database.
2. ✅ ≥ 80% core field completeness (16+ invoices with 8/8 or 7/8 fields).
3. ✅ All 8 fields present or null (no undefined/missing data).
4. ✅ Confidence labels accurate (high/medium/low reflect data quality).
5. ✅ Job status transitions correctly (queued → processing → extracted).
6. ✅ No data loss in transition to validation (Slice 3).
7. ✅ Extraction failures logged and surfaced clearly.
8. ✅ All unit + integration tests passing.
9. ✅ Performance targets met (p95 ≤ 60s per file; batch timing informational only).
10. ✅ Code review and sign-off from Tech Lead.

---

## 12. Next Steps

1. **Decision sign-off:** Resolve open decisions in Section 7 (OCR/LLM provider, sync/async, retry strategy).
2. **Environment setup:** Provision OCR and LLM API credentials; test connectivity.
3. **Seed data collection:** Gather or create 20 representative invoice PDFs.
4. **Phase A kickoff:** Implement mock extraction and validate Slice 1 integration.
5. **Daily standup:** Track Phase A/B progress; escalate risks early (accuracy < 80%, latency > 60s).

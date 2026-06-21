# Slice 2 - OCR and Extraction Pipeline - EXECUTION PLAN

**Date:** May 17, 2026  
**Specialist Sign-Off:** ✅ All 6 specialists (requirements, architecture, security, performance, QA, UX)  
**Scope:** Extract 8 invoice fields via OCR+LLM, confidence labeling, 80% completeness target  
**Duration Estimate:** 3-4 days (May 18-21)

---

## Executive Summary

### Objective

Implement automated OCR + LLM extraction pipeline to read vendor, invoice #, date, amounts (subtotal, tax, total), PO #, and currency from uploaded PDFs. Process synchronously (60s per file), persist results with confidence labels, move jobs to "extracted" state for Slice 3 validation.

### Success Criteria (Definition of Done)

- ✅ 8 fields extracted from ≥16 of 20 seed invoices (80% completeness)
- ✅ Confidence labels assigned (High/Med/Low) for every field
- ✅ Job status transitions: queued → processing → extracted (or failed)
- ✅ All tests passing (unit + integration + E2E)
- ✅ P95 latency ≤55s per file (within 60s SLO)
- ✅ Cost ≤$4.02 per file (baseline $3.02)
- ✅ Post-launch monitoring configured

### Tradeoffs & Decisions

| Decision               | Option A                   | Option B                 | **Chosen**        | Rationale                                         |
| ---------------------- | -------------------------- | ------------------------ | ----------------- | ------------------------------------------------- |
| **Async vs. Sync**     | Background queue (complex) | Sync API (simple)        | **Sync**          | MVP scope, tight demo flow, <60s fits             |
| **Extraction trigger** | Manual button              | Auto on job creation     | **Auto**          | Faster demo, less user friction                   |
| **OCR provider**       | Tesseract (free)           | Google Doc AI (paid)     | **Google Doc AI** | Better accuracy, handles complex layouts          |
| **LLM provider**       | GPT-3.5 (cheap)            | GPT-4 (expensive)        | **GPT-4**         | 80% completeness requires better reasoning        |
| **Field caching**      | No cache (MVP)             | SHA256 dedupe (Phase B)  | **No cache**      | Simple to implement, 20-file test doesn't justify |
| **Retry strategy**     | No retry                   | Exponential backoff (3x) | **3x backoff**    | <1% permanent failure target                      |

---

## Architecture Overview

### High-Level Flow

```
User uploads PDF (Slice 1)
  ↓
job.status = queued
  ↓
[Every 30s] Poller detects queued job
  ↓
job.status = processing
  ↓
[Parallel] Retrieve PDF + OCR → Extract text
  ↓
[LLM] Parse text → 8 fields + confidence → validation
  ↓
[DB] INSERT invoices + raw_extraction_json
  ↓
job.status = extracted (or failed)
  ↓
[Slice 3] Validation engine reads invoices table
```

### Six Core Components

| Component             | Responsibility                 | Input                      | Output                             | SLO   |
| --------------------- | ------------------------------ | -------------------------- | ---------------------------------- | ----- |
| **File Retriever**    | Fetch PDF from local or S3     | `file_url` from jobs table | PDF bytes                          | <2s   |
| **OCR Service**       | Extract text from PDF          | PDF bytes                  | Raw OCR text, confidence           | <10s  |
| **LLM Extractor**     | Parse text → 8 fields          | OCR text                   | JSON {vendor, invoice_number, ...} | <8s   |
| **Validator**         | Schema validation + confidence | Raw JSON                   | 8 fields + confidence + errors     | <2s   |
| **Invoice Persister** | Store results in DB            | Validated fields           | invoice.id                         | <1s   |
| **Job Updater**       | Transition job status          | extraction result          | job.status updated                 | <0.5s |

### Data Contracts

**Input: job (from Slice 1)**

```json
{
  "job_id": "job_1779047167723_fgbze5az",
  "filename": "invoice-2024-05.pdf",
  "file_url": "/uploads/upl_1779047167719_0nmwy7f0_test-invoice.pdf",
  "status": "queued",
  "file_size_bytes": 2000000
}
```

**Output: invoice (to Slice 3)**

```json
{
  "id": "uuid",
  "job_id": "job_...",
  "status": "extracted",
  "vendor_name": "Acme Corp",
  "vendor_name_confidence": "high",
  "invoice_number": "INV-2024-001",
  "invoice_number_confidence": "high",
  "invoice_date": "2024-05-15",
  "invoice_date_confidence": "medium",
  "subtotal": 1000.00,
  "subtotal_confidence": "high",
  "tax": 100.00,
  "tax_confidence": "medium",
  "total": 1100.00,
  "total_confidence": "high",
  "po_number": "PO-12345",
  "po_number_confidence": "low",
  "currency": "USD",
  "currency_confidence": "high",
  "raw_extraction_json": { "...full LLM response..." },
  "created_at": "2026-05-17T19:46:07.722Z"
}
```

---

## Implementation Sequence

### Phase A: Scaffolding & Mocks (Day 1, 4 hours)

**Goal:** Verify architecture works without real OCR/LLM costs

1. **Create extraction lib structure**
   - `src/lib/extraction/index.ts` (orchestrator)
   - `src/lib/extraction/ocr-service.ts` (Google Doc AI client)
   - `src/lib/extraction/llm-extractor.ts` (OpenAI client)
   - `src/lib/extraction/invoice-persister.ts` (DB writes)
   - `src/lib/extraction/job-worker.ts` (sync orchestrator + retry logic)

2. **Stub all external calls**
   - OCR returns mock text
   - LLM returns mock JSON (8 fields, random confidence)
   - Add 2-5s artificial delay per service (realistic)

3. **Add extraction API endpoint**
   - `PUT /api/jobs/:job_id/extract` (manual trigger for testing)
   - `POST /api/jobs/process-queued` (internal Phase B path only; not used by MVP sync flow)

4. **Write integration tests** (mocked)
   - Test full flow: queued → processing → extracted
   - Test partial extraction (6/8 fields)
   - Test timeout + retry

**Deliverables:**

- [ ] Extraction library with mocked services
- [ ] Integration tests (all green with mocks)
- [ ] Poller working, detecting queued jobs

---

### Phase B: Real OCR & LLM (Days 2-3, 16 hours)

**Goal:** Replace mocks with production services, measure real SLOs

1. **Google Document AI integration**
   - Set up auth (service account)
   - Implement PDF processing (batch or sync)
   - Handle errors (invalid PDF, timeout)
   - Add retry logic (3 attempts, exponential backoff)

2. **OpenAI GPT-4 integration**
   - Craft extraction prompt (8-field structured format)
   - Parse JSON response, validate schema
   - Handle malformed responses (re-prompt, then fail-safe)
   - Add token counting + cost tracking

3. **Database persistence** (invoices table)
   - Write invoice records atomically
   - Store raw `raw_extraction_json` for audit
   - Update job status (extracted or failed)
   - Add transaction safety (no partial writes)

4. **Error handling & retry**
   - Exponential backoff: 1s, 2s, 4s (max 3 attempts)
   - Distinguish transient (retry) vs. permanent (fail job) errors
   - Log structured errors with request ID

5. **Performance monitoring**
   - Log latency (OCR, LLM, DB per component)
   - Track cost per file (track API calls)
   - Alert if P95 latency > 60s or cost > $5/file

6. **Test with 20 seed invoices**
   - Run extraction on all 20
   - Measure completeness (16/20 ≥80% target)
   - Spot-check confidence labels vs. quality
   - Measure P95 latency

**Deliverables:**

- [ ] Google Document AI service live
- [ ] OpenAI GPT-4 integration live
- [ ] All 20 seed invoices processed
- [ ] 16+ with 80% completeness
- [ ] P95 latency measured ≤55s
- [ ] Cost tracking active
- [ ] Integration tests passing with real services

---

### Phase C: UI & Polish (Day 4, 8 hours)

**Goal:** Display extraction results, finalize for demo

1. **Extraction results display**
   - Add `/invoices/:invoice_id` detail page
   - Show 8 extracted fields in a table
   - Color-code confidence (green=high, yellow=med, red=low)
   - Show raw PDF preview (side-by-side)
   - Collapsible JSON debug view (admin only)

2. **Job status polling update**
   - Jobs page shows "extracting..." while processing
   - Auto-refresh when status changes to "extracted"
   - Show errors if extraction failed

3. **Error state handling**
   - Display field-level errors (missing, malformed)
   - Show retry button for transient failures
   - Allow manual field override (saved to audit_logs)

4. **Accessibility & polish**
   - ARIA labels on confidence badges
   - Keyboard navigation in detail view
   - Mobile-responsive layout

5. **E2E testing** (real flow)
   - Upload → extract → verify display
   - Test all 20 seed invoices via UI

**Deliverables:**

- [ ] `/invoices/:id` detail page complete
- [ ] Confidence badges visible
- [ ] Raw JSON collapsible debug view
- [ ] E2E tests passing

---

## Testing Strategy

### Test Pyramid

```
E2E (5 tests, real OCR/LLM, staging only):
  - Full upload → extract → display flow
  - Timeout + retry scenario
  - 20 seed invoices batch

Integration (15 tests, mocked services):
  - OCR mock → LLM mock → DB write
  - Partial extraction (6/8 fields)
  - Error handling (timeout, malformed JSON)
  - Retry logic (3 attempts work)
  - Job status transitions

Unit (25 tests, pure functions):
  - Field validation (email, date format, amounts)
  - Confidence label assignment
  - Error classification (transient vs. permanent)
  - Prompt generation (LLM request)
```

### Go/No-Go Release Criteria

| Criterion           | Target                                | Pass/Fail |
| ------------------- | ------------------------------------- | --------- |
| Completeness        | ≥80% (16/20 invoices with 7-8 fields) | Must pass |
| Latency P95         | ≤55s per file                         | Must pass |
| Cost/file           | ≤$4.02                                | Must pass |
| Test coverage       | ≥85% code coverage                    | Must pass |
| Unit tests          | 25+ tests passing                     | Must pass |
| Integration tests   | 15+ tests passing                     | Must pass |
| E2E tests           | 5 critical flows passing              | Must pass |
| No breaking changes | All Slice 1 tests still pass          | Must pass |
| Security review     | STRIDE mitigations approved           | Must pass |

---

## Slice 2 Development Tasks

### Task Breakdown (3-4 days)

| Day          | Phase | Tasks                                                                                                               | Hours | Owner              |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------- | ----- | ------------------ |
| May 18 (Fri) | A     | 1. Extraction lib scaffold + mocks<br>2. Integration tests (mocked)<br>3. API endpoints (/extract, /process-queued) | 8     | Backend            |
| May 19 (Sat) | B     | 4. Google Doc AI integration<br>5. OpenAI GPT-4 integration<br>6. Error handling + retry                            | 8     | Backend            |
| May 20 (Sun) | B     | 7. Database persistence (invoices)<br>8. Test with 20 seed invoices<br>9. Performance measurement                   | 8     | Backend            |
| May 21 (Mon) | C     | 10. Invoice detail UI (/invoices/:id)<br>11. Confidence badges + debug view<br>12. E2E tests + polish               | 8     | Frontend + Backend |

**Total:** 32 hours (4 days, 8h/day)

---

## Risk Mitigation

| Risk                 | Likelihood | Impact   | Mitigation                                                                    |
| -------------------- | ---------- | -------- | ----------------------------------------------------------------------------- |
| OCR accuracy <80%    | Medium     | High     | Use Phase A mocks to unblock frontend; Phase B will measure real accuracy     |
| OCR latency >20s     | Low        | Medium   | Google Doc AI SLA is 10s; fallback to Tesseract if needed                     |
| LLM latency >15s     | Low        | Medium   | Use GPT-3.5 fallback if GPT-4 too slow; cache responses by PDF hash (Phase B) |
| API quota exhaustion | Low        | High     | Track cost in real-time; alert at 80% budget                                  |
| Timeout at 60s       | Low        | High     | Safety margin of 33s at P95 (55s); 3-retry strategy                           |
| Malformed extraction | Medium     | Medium   | Schema validation + re-prompt; fail-safe to manual review (Slice 5)           |
| Breaking Slice 1     | Low        | Critical | Run Slice 1 tests on every commit; separate feature flag if needed            |

**Contingency:** If OCR accuracy <80%, escalate to Phase B review before Slice 3; no go/no-go until target met.

---

## Resource & Cost Plan

### API Costs (per 20-file test batch)

| Service       | Rate                          | 20 Files          | Status               |
| ------------- | ----------------------------- | ----------------- | -------------------- |
| Google Doc AI | $0.75–$1.50/page              | $15–$30           | Production ready     |
| OpenAI GPT-4  | $0.03–$0.06 per 1K tokens     | $10–$20           | Production ready     |
| Supabase (DB) | $25/mo (free tier sufficient) | $0.83             | Already in use       |
| **Total**     | —                             | **$25.83–$50.83** | **✅ Within budget** |

### Team Capacity

| Role                          | Days | Effort |
| ----------------------------- | ---- | ------ |
| Backend (extraction + DB)     | 3.5  | 28h    |
| Frontend (UI + E2E)           | 1.5  | 12h    |
| QA (test matrix + validation) | 1    | 8h     |
| **Total**                     | 4    | 48h    |

---

## Pre-Launch Checklist

- [ ] Security review approved (STRIDE mitigations in place)
- [ ] Performance targets met (55s P95, $3.02/file)
- [ ] 20 seed invoices tested, 16+ pass (80% target)
- [ ] All unit + integration tests passing
- [ ] E2E tests passing (real OCR/LLM)
- [ ] Invoice detail UI reviewed and accessible
- [ ] Monitoring/alerting configured
- [ ] Rate limiting + quota guards active
- [ ] API documentation updated
- [ ] Slice 1 regression tests passing
- [ ] Staff Review Board sign-off

---

## Slice 3 Handoff

Once Slice 2 is complete, Slice 3 (Validation Engine) will:

- Read invoices table
- Apply validation rules (required fields, total match, duplicate check, missing PO)
- Flag violations as validation_flags records
- Transition invoice to "exception" or "approved" state
- Feed into Slice 4 Exceptions Queue UI

**No schema or data format changes needed** — Slice 2 design is compatible with Slice 3 requirements.

---

## Decision Log

| Decision                            | Owner        | Date       | Status                           |
| ----------------------------------- | ------------ | ---------- | -------------------------------- |
| Sync vs. Async processing           | Architecture | 2026-05-17 | ✅ SYNC (Phase A MVP)            |
| OCR provider: Google Doc AI         | Architecture | 2026-05-17 | ✅ APPROVED                      |
| LLM provider: GPT-4                 | Architecture | 2026-05-17 | ✅ APPROVED                      |
| 80% completeness target             | Requirements | 2026-05-17 | ✅ APPROVED                      |
| 60s per-file SLO                    | Performance  | 2026-05-17 | ✅ APPROVED (55s P95 achievable) |
| Extraction triggers on job creation | Architecture | 2026-05-17 | ✅ APPROVED (auto-process)       |
| Confidence labels High/Med/Low      | Requirements | 2026-05-17 | ✅ APPROVED                      |

---

**STATUS: ✅ READY TO IMPLEMENT**

Next: Proceed to Phase A (Day 1) scaffolding and mocks.

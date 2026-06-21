# Slice 2 – Extraction Pipeline Architecture

**Status:** Design Review  
**Date:** May 17, 2026  
**Sprint:** Days 3–5

---

## 1. High-Level Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EXTRACTION PIPELINE                                 │
└──────────────────────────────────────────────────────────────────────────────┘

   Slice 1: Uploaded Jobs
        ↓
   ┌─────────────────┐
   │  "queued" Jobs  │  ← Polls every 30s or on-demand
   └────────┬────────┘
            ↓
   ┌──────────────────────────────────────────────────────────────┐
   │  EXTRACTION WORKER (POST /api/jobs/process)                 │
   │  Runs in API layer, 60s timeout, sync per-file              │
   └────────┬─────────────────────────────────────────────────────┘
            │
            ├──→ Job State: queued → processing (optimistic lock)
            │
            ├──→ ┌──────────────────────────────────────────┐
            │    │  1. FILE RETRIEVAL SERVICE               │
            │    │  ├─ Local store: read from /uploads/     │
            │    │  └─ S3: signed URL fetch (if configured) │
            │    └──────────────┬───────────────────────────┘
            │                   ↓
            │    ┌──────────────────────────────────────────┐
            │    │  2. OCR SERVICE (Google Document AI)     │
            │    │  ├─ Raw PDF → text blocks               │
            │    │  ├─ Caching: by file SHA-256 hash       │
            │    │  └─ Timeout: 30s per OCR call            │
            │    └──────────────┬───────────────────────────┘
            │                   ↓ { text, metadata, confidence }
            │    ┌──────────────────────────────────────────┐
            │    │  3. LLM EXTRACTOR (OpenAI GPT-4)         │
            │    │  ├─ Input: OCR text + extraction prompt │
            │    │  ├─ Output: 8 fields + per-field scores │
            │    │  └─ Timeout: 20s per LLM call           │
            │    └──────────────┬───────────────────────────┘
            │                   ↓ { vendor, invoice #, date, ... }
            │    ┌──────────────────────────────────────────┐
            │    │  4. VALIDATION & NORMALIZATION           │
            │    │  ├─ Schema validation                    │
            │    │  ├─ Type coercion (date → ISO string)   │
            │    │  ├─ Numeric precision (decimal 14,2)    │
            │    │  └─ Null handling for optional fields   │
            │    └──────────────┬───────────────────────────┘
            │                   ↓
            ├──→ Job State: processing → extracted
            │    Invoices table: insert(job_id, fields, confidence)
            │
            └──→ On error: Job State: processing → failed
                 error_message + retry_count incremented
                 (max 3 attempts, then manual review flag)

   ↓
   SLICE 3: Validation Engine
   (triggered immediately after successful extraction)
```

---

## 2. Component Breakdown

### 2.1 Job Processing Trigger (API Endpoint)

**Endpoint:** `POST /api/jobs/process`  
**Authentication:** Admin-only (bearer token)  
**Idempotency:** Job ID in request/response; prevents duplicate processing

**Trigger Strategies (production choice):**

| Strategy                   | Invocation                                           | Use Case                    | Latency   |
| -------------------------- | ---------------------------------------------------- | --------------------------- | --------- |
| **On-upload extraction**   | Upload flow calls extractor immediately after insert | MVP default path            | Immediate |
| **Admin retry endpoint**   | Operator retries a failed job via API                | Manual trigger for recovery | Immediate |
| **Event-driven (Phase B)** | Job status change emits event; worker subscribes     | Real-time scale path        | <1s       |

**MVP Choice:** Synchronous extraction in the API request path; no poller.

**Pseudocode:**

```typescript
PUT /api/jobs/:job_id/extract
├─ Load job by id; require status in {queued, failed}
├─ Set job.status = "processing", job.started_at = now()
├─ Try extraction pipeline (OCR → LLM → validate → insert invoice)
├─ On success:
│  └─ Set job.status = "extracted", job.completed_at = now()
│     Trigger Slice 3 validation immediately
├─ On failure:
│  ├─ Apply frozen retry policy for transient failures
│  └─ If final attempt fails: Set job.status = "failed", set error_message
└─ Return { job_id, status, extracted_at, error_message }
```

---

### 2.2 File Retrieval Service

**Interface:**

```typescript
type FileRetrievalConfig =
  | { mode: "local"; uploadsDir: string }
  | { mode: "s3"; bucket: string; region: string; signedUrlTtl: number };

async function retrieveFileBinary(
  fileUrl: string,
  config: FileRetrievalConfig,
): Promise<Buffer>;
```

**Implementation:**

| Mode      | Logic                                   | Timeout        | Failure                                |
| --------- | --------------------------------------- | -------------- | -------------------------------------- |
| **local** | Read from `uploads/{job_id}/{filename}` | 5s             | Throw `FileNotFoundError` → job.failed |
| **s3**    | Generate signed URL, fetch via HTTP     | 15s (download) | Throw `S3FetchError` → retry           |

**Assumptions:**

- Slice 1 already stored file in correct location (local or S3).
- `job.file_url` is set correctly (local path or S3 key).
- PDF is valid and not corrupted.

**Dual-Mode Implementation:**

```typescript
if (process.env.SUPABASE_URL && process.env.S3_BUCKET) {
  config = { mode: "s3", bucket: S3_BUCKET, ... };
} else {
  config = { mode: "local", uploadsDir: "./uploads" };
}
```

---

### 2.3 OCR Service

**Provider:** Google Document AI (or Tesseract for local MVP)  
**Output:** Raw text blocks + OCR confidence per block

**Interface:**

```typescript
type OcrResult = {
  full_text: string; // Complete OCR'd text
  text_blocks: OcrBlock[]; // Per-block breakdown
  ocr_confidence: "high" | "medium" | "low";
  ocr_provider: "google_doc_ai" | "tesseract";
  processing_time_ms: number;
};

type OcrBlock = {
  text: string;
  confidence: number; // 0.0–1.0
  bounding_box?: BoundingBox; // Page coordinates
};

async function runOcr(pdf: Buffer): Promise<OcrResult>;
```

**Caching Strategy (optional for MVP):**

| Strategy    | Key               | TTL    | Benefit                 |
| ----------- | ----------------- | ------ | ----------------------- |
| None        | —                 | —      | Simple, no dependencies |
| File-based  | SHA256(pdf_bytes) | 7 days | Dedup repeated invoices |
| Redis-based | Same              | 24h    | Faster in production    |

**Recommendation:** File-based cache in Phase B; skip for MVP (60s SLO per file is comfortable).

**Timeout:** 30s hard limit; if exceeds, treat as `ocr_error` and retry.

---

### 2.4 LLM Extractor

**Provider:** OpenAI GPT-4  
**Model:** `gpt-4-turbo` or `gpt-4` (cheaper alternative: `gpt-3.5-turbo`)  
**Approach:** Structured JSON output (no fine-tuning for MVP)

**Interface:**

```typescript
type LlmExtractionInput = {
  ocr_text: string;
  pdf_metadata: { filename: string; num_pages: number };
};

type LlmExtractionOutput = {
  vendor_name: string | null;
  vendor_name_confidence: "high" | "medium" | "low";
  invoice_number: string | null;
  invoice_number_confidence: "high" | "medium" | "low";
  invoice_date: string | null; // ISO 8601
  invoice_date_confidence: "high" | "medium" | "low";
  subtotal: number | null; // decimal
  subtotal_confidence: "high" | "medium" | "low";
  tax: number | null;
  tax_confidence: "high" | "medium" | "low";
  total: number | null;
  total_confidence: "high" | "medium" | "low";
  po_number: string | null;
  po_number_confidence: "high" | "medium" | "low";
  currency: string; // ISO 4217, defaults "USD"
  currency_confidence: "high" | "medium" | "low";
  extraction_notes: string; // Free-form reason for low confidence
};

async function extractFields(
  input: LlmExtractionInput,
): Promise<LlmExtractionOutput>;
```

**Prompt Template:**

```
You are an expert invoice processor. Extract the following 8 fields from the OCR text:
1. vendor_name (company name on invoice)
2. invoice_number (unique invoice ID)
3. invoice_date (date of invoice in ISO format YYYY-MM-DD)
4. subtotal (amount before tax)
5. tax (tax amount)
6. total (grand total)
7. po_number (purchase order number, if present)
8. currency (ISO 4217 code, default USD)

For EACH field, provide:
- value (null if not found)
- confidence: "high" (explicit in text), "medium" (inferred), or "low" (default/missing)
- reasoning (1-2 sentences why this confidence level)

OCR Text:
{ocr_text}

Respond in JSON format:
{{
  "vendor_name": "...",
  "vendor_name_confidence": "high",
  ...
}}
```

**Timeout:** 20s hard limit; if exceeds, treat as `llm_timeout` and retry.

**Rate Limiting:**

- OpenAI tier-1: 90 req/min, 40k token/min
- Recommended: Implement rate limiter with exponential backoff

---

### 2.5 Validation & Normalization Service

**Purpose:** Ensure extracted data conforms to schema before database insert.

**Validations:**

```typescript
type ValidationError = { field: string; reason: string };

function validateExtraction(data: LlmExtractionOutput): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Schema shape: required fields must have confidence
  if (
    data.vendor_name &&
    !["high", "medium", "low"].includes(data.vendor_name_confidence)
  ) {
    errors.push({
      field: "vendor_name_confidence",
      reason: "invalid confidence label",
    });
  }

  // 2. Type coercion: ensure numerics are valid
  if (data.total !== null && typeof data.total !== "number") {
    errors.push({ field: "total", reason: "must be numeric" });
  }

  // 3. Date parsing: ISO 8601 format
  if (data.invoice_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.invoice_date)) {
    errors.push({ field: "invoice_date", reason: "must be YYYY-MM-DD" });
  }

  // 4. Numeric precision: max 14 digits + 2 decimals
  if (data.total && data.total.toString().length > 17) {
    errors.push({ field: "total", reason: "exceeds decimal(14,2) precision" });
  }

  // 5. Currency code: ISO 4217
  if (!/^[A-Z]{3}$/.test(data.currency)) {
    errors.push({ field: "currency", reason: "must be 3-letter ISO code" });
  }

  return errors;
}
```

**Normalization:**

```typescript
function normalizeExtraction(data: LlmExtractionOutput): NormalizedInvoice {
  return {
    vendor_name: data.vendor_name?.trim() || null,
    vendor_name_confidence: data.vendor_name_confidence,
    invoice_number: data.invoice_number?.trim().toUpperCase() || null,
    invoice_number_confidence: data.invoice_number_confidence,
    invoice_date: data.invoice_date || null, // Already ISO
    invoice_date_confidence: data.invoice_date_confidence,
    subtotal: data.subtotal ? Number(data.subtotal).toFixed(2) : null,
    subtotal_confidence: data.subtotal_confidence,
    tax: data.tax ? Number(data.tax).toFixed(2) : null,
    tax_confidence: data.tax_confidence,
    total: data.total ? Number(data.total).toFixed(2) : null,
    total_confidence: data.total_confidence,
    po_number: data.po_number?.trim().toUpperCase() || null,
    po_number_confidence: data.po_number_confidence,
    currency: data.currency.toUpperCase(),
    currency_confidence: data.currency_confidence,
    raw_extraction_json: data, // Store full LLM output
    status: "pending", // Initial status for Slice 3
  };
}
```

---

### 2.6 Invoice Persistence Service

**Storage:** Write to `invoices` table (Supabase or fallback: JSON file).

**Interface:**

```typescript
async function createInvoice(
  jobId: string,
  normalized: NormalizedInvoice,
  pdfUrl: string,
): Promise<{ invoice_id: string; created_at: string }>;
```

**SQL (Supabase):**

```sql
INSERT INTO public.invoices (
  job_id, status, vendor_name, vendor_name_confidence,
  invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence,
  subtotal, subtotal_confidence, tax, tax_confidence,
  total, total_confidence, po_number, po_number_confidence,
  currency, currency_confidence, pdf_url, raw_extraction_json, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
  $13, $14, $15, $16, $17, $18, $19, $20, now(), now()
)
RETURNING id, created_at;
```

**Fallback (Local JSON):** Create `data/invoices.json` with same structure; synchronize with Supabase schema.

---

## 3. Error Handling & Retry Strategy

### 3.1 Failure Modes & Blast Radius

| Failure                | Root Cause                             | Blast Radius                                    | Recovery                                        |
| ---------------------- | -------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **OCR Timeout**        | API latency, network flake             | Single job; doesn't block others                | Exponential backoff (1s, 2s, 4s, 8s)            |
| **LLM API Down**       | Service outage, rate limit             | Single job; affects subsequent jobs in queue    | Backoff + manual retry                          |
| **Invalid OCR Output** | Corrupted PDF or image quality         | Single job; schema validation catches           | Fail job, flag for manual upload                |
| **DB Write Failure**   | Connection error, constraint violation | Single invoice write; job stays in "processing" | Retry with exponential backoff                  |
| **File Not Found**     | Slice 1 bug or file deletion           | Single job; should not happen                   | Fail job, alert ops                             |
| **Timeout (60s SLA)**  | Slow OCR + slow LLM in serial          | Single job; within acceptable bounds            | Extend timeout to 90s if needed, or parallelize |

### 3.2 Retry Policy

**Decision Tree:**

```
On Error (OCR, LLM, DB):
├─ If transient (timeout, 429, 503):
│  ├─ job.retry_count < 3?
│  │  └─ YES: Set job.status = "queued"; backoff & retry
│  │  └─ NO: Set job.status = "failed"; escalate to manual review
├─ If permanent (invalid input, auth error, schema validation):
│  └─ Set job.status = "failed"; DO NOT RETRY
└─ If unknown:
   └─ Treat as transient; attempt 3 retries, then fail
```

**Exponential Backoff (Jitter):**

```typescript
const baseDelay = 1000; // 1s
const maxDelay = 32000; // 32s
const maxRetries = 3;
const jitter = Math.random() * 1000;

function getBackoffDelay(retryCount: number): number {
  return Math.min(baseDelay * Math.pow(2, retryCount) + jitter, maxDelay);
}

// Retry counts and delays:
// Attempt 1: Delay ~1s
// Attempt 2: Delay ~2s
// Attempt 3: Delay ~4s
// If all fail: Mark as "failed", manual review flag
```

### 3.3 Error Messaging (User-Facing)

| Error Code              | User Message                                                     | Operator Action                        |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| `ocr_timeout`           | "OCR processing took too long. Retry or contact support."        | Retry via /api/jobs/process            |
| `llm_api_error`         | "LLM service temporarily unavailable. Retry in 1 minute."        | Wait, then manual trigger              |
| `invalid_pdf`           | "PDF is corrupted or not readable. Upload a different file."     | Re-upload PDF                          |
| `extraction_incomplete` | "Extracted 6 of 8 fields. Manual review required."               | Proceed to review, fill missing fields |
| `db_error`              | "Failed to save extraction. Contact support."                    | Contact support (internal error)       |
| `timeout`               | "Processing took longer than 60s. Retry or upload smaller file." | Retry or split large PDF               |

---

## 4. Data Contracts

### 4.1 OCR Service Input/Output

**Input:**

```typescript
{
  pdf_buffer: Buffer; // Raw PDF bytes
  max_size_mb: 20; // Hard limit from Slice 1
  timeout_ms: 30000; // 30s
}
```

**Output (Success):**

```typescript
{
  full_text: "Vendor: Acme Corp\nInvoice: INV-001\n...",
  text_blocks: [
    { text: "Vendor: Acme Corp", confidence: 0.98 },
    { text: "Invoice: INV-001", confidence: 0.95 }
  ],
  ocr_confidence: "high",
  processing_time_ms: 2500,
  error: null
}
```

**Output (Error):**

```typescript
{
  full_text: null,
  text_blocks: [],
  ocr_confidence: null,
  processing_time_ms: 30005,
  error: "OCR request timed out after 30s"
}
```

### 4.2 LLM Extractor Input/Output

**Input:**

```typescript
{
  ocr_text: "Vendor: Acme Corp\nInvoice: INV-001\n...",
  pdf_metadata: {
    filename: "acme_invoice.pdf",
    num_pages: 2,
    file_size_bytes: 512000
  },
  extraction_model: "gpt-4-turbo",
  timeout_ms: 20000
}
```

**Output (Success):**

```typescript
{
  vendor_name: "Acme Corp",
  vendor_name_confidence: "high",
  invoice_number: "INV-001",
  invoice_number_confidence: "high",
  invoice_date: "2024-05-15",
  invoice_date_confidence: "medium",
  subtotal: 1000.00,
  subtotal_confidence: "high",
  tax: 100.00,
  tax_confidence: "medium",
  total: 1100.00,
  total_confidence: "high",
  po_number: "PO-54321",
  po_number_confidence: "high",
  currency: "USD",
  currency_confidence: "high",
  extraction_notes: "Clear invoice format; all fields legible.",
  model_used: "gpt-4-turbo",
  processing_time_ms: 1500,
  tokens_used: { prompt: 450, completion: 250, total: 700 }
}
```

**Output (Error):**

```typescript
{
  vendor_name: null,
  ...(all fields null),
  extraction_notes: null,
  model_used: "gpt-4-turbo",
  processing_time_ms: 20005,
  error: "LLM request timed out"
}
```

### 4.3 Invoice Record (DB Insert)

**Table:** `public.invoices`

**Row (POST):**

```json
{
  "job_id": "uuid",
  "status": "pending",
  "vendor_name": "Acme Corp",
  "vendor_name_confidence": "high",
  "invoice_number": "INV-001",
  "invoice_number_confidence": "high",
  "invoice_date": "2024-05-15",
  "invoice_date_confidence": "medium",
  "subtotal": "1000.00",
  "subtotal_confidence": "high",
  "tax": "100.00",
  "tax_confidence": "medium",
  "total": "1100.00",
  "total_confidence": "high",
  "po_number": "PO-54321",
  "po_number_confidence": "high",
  "currency": "USD",
  "currency_confidence": "high",
  "pdf_url": "/uploads/job_id/filename.pdf",
  "raw_extraction_json": { ...full LLM output },
  "approved_at": null,
  "approved_by": null,
  "rejected_at": null,
  "rejected_by": null,
  "rejection_reason": null,
  "created_at": "2024-05-17T14:30:00.000Z",
  "updated_at": "2024-05-17T14:30:00.000Z"
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (Fast, Mocked)

**Test Files:**

```
src/lib/ocr-service.test.ts         → Mock Google Document AI
src/lib/llm-extractor.test.ts       → Mock OpenAI API
src/lib/extraction-validator.test.ts → No mocks needed
src/lib/file-retrieval.test.ts      → Mock FS / S3 SDK
src/app/api/jobs/process.test.ts    → Mock all services
```

**Mock Strategy:**

```typescript
// ocr-service.test.ts
import { describe, it, expect, vi } from "vitest";
import { runOcr } from "@/lib/ocr-service";

describe("OCR Service", () => {
  it("should call Google Document AI with PDF buffer", async () => {
    const mockGoogleClient = vi.mock("@google-cloud/documentai");

    const pdf = Buffer.from("fake pdf");
    const result = await runOcr(pdf);

    expect(mockGoogleClient.processDocument).toHaveBeenCalledWith(pdf);
    expect(result.full_text).toBeDefined();
  });

  it("should return 'low' confidence if OCR text has < 50 chars", async () => {
    // Stub: return short text
    const result = await runOcr(Buffer.from("short"));
    expect(result.ocr_confidence).toBe("low");
  });

  it("should timeout after 30s", async () => {
    const promise = runOcr(Buffer.from("..."), { timeout_ms: 100 });
    await expect(promise).rejects.toThrow("OCR timeout");
  });
});
```

**LLM Extractor Mock:**

```typescript
// llm-extractor.test.ts
import { extractFields } from "@/lib/llm-extractor";

describe("LLM Extractor", () => {
  it("should extract all 8 fields from valid OCR text", async () => {
    const mockOpenAI = vi.mock("openai");
    const result = await extractFields({
      ocr_text: `
        Vendor: Acme Corp
        Invoice: INV-001
        Date: 2024-05-15
        Subtotal: $1000.00
        Tax: $100.00
        Total: $1100.00
        PO: PO-54321
        Currency: USD
      `,
      pdf_metadata: { filename: "test.pdf", num_pages: 1 },
    });

    expect(result.vendor_name).toBe("Acme Corp");
    expect(result.invoice_number).toBe("INV-001");
    expect(result.total).toBe(1100.0);
  });

  it("should set confidence to 'low' if field is missing", async () => {
    const result = await extractFields({
      ocr_text: "Vendor: Acme Corp\n", // Missing PO
      pdf_metadata: { filename: "test.pdf", num_pages: 1 },
    });

    expect(result.po_number).toBeNull();
    expect(result.po_number_confidence).toBe("low");
  });
});
```

**Validation & Normalization:**

```typescript
// extraction-validator.test.ts (no mocks needed)
describe("Validation", () => {
  it("should reject invalid currency codes", () => {
    const errors = validateExtraction({
      currency: "INVALID",
      currency_confidence: "high",
    });
    expect(errors).toContainEqual({
      field: "currency",
      reason: "must be 3-letter ISO code",
    });
  });

  it("should normalize vendor names to title case", () => {
    const normalized = normalizeExtraction({
      vendor_name: "  acme corp  ",
      vendor_name_confidence: "high",
    });
    expect(normalized.vendor_name).toBe("Acme Corp");
  });

  it("should preserve decimal(14,2) precision", () => {
    const normalized = normalizeExtraction({
      total: 1100.0,
      total_confidence: "high",
    });
    expect(normalized.total).toBe("1100.00"); // String for DB
  });
});
```

**E2E Job Processing:**

```typescript
// app/api/jobs/process.test.ts
describe("POST /api/jobs/process", () => {
  it("should transition job from queued → extracted", async () => {
    // Setup: Create a queued job in mock DB
    const queuedJob = {
      id: "job_123",
      status: "queued",
      file_url: "/uploads/test.pdf",
    };

    // Mock all services
    vi.mock("@/lib/ocr-service", {
      runOcr: async () => ({ full_text: "..." }),
    });
    vi.mock("@/lib/llm-extractor", {
      extractFields: async () => ({ vendor_name: "..." }),
    });
    vi.mock("@/lib/jobs-store", { updateJobStatus: async () => {} });

    const response = await fetch("http://localhost:3000/api/jobs/process", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("extracted");
  });

  it("should retry on transient OCR errors", async () => {
    vi.mock("@/lib/ocr-service", {
      runOcr: async () => {
        throw new Error("OCR timeout");
      },
    });

    const response = await fetch("http://localhost:3000/api/jobs/process", {
      method: "POST",
    });

    // Job should be re-queued for retry
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retry_count).toBe(1);
  });

  it("should fail job after 3 retries", async () => {
    // Setup: Job with retry_count = 3
    const job = {
      id: "job_456",
      status: "queued",
      retry_count: 3,
      file_url: "...",
    };

    vi.mock("@/lib/ocr-service", {
      runOcr: async () => {
        throw new Error("OCR error");
      },
    });

    const response = await fetch("http://localhost:3000/api/jobs/process", {
      method: "POST",
    });

    const body = await response.json();
    expect(body.status).toBe("failed");
    expect(body.error_message).toBeDefined();
  });
});
```

### 5.2 Integration Tests (Slower, Real Services Optional)

**Setup:** Use test invoices from `data/sample-invoices/` (10–20 PDFs).

```typescript
// tests/integration/extraction-e2e.test.ts
describe("Extraction E2E (Integration)", () => {
  it("should extract all 8 fields from real invoice PDF", async () => {
    const pdfPath = "data/sample-invoices/acme-invoice-001.pdf";
    const pdf = await readFile(pdfPath);

    const ocrResult = await runOcr(pdf);
    expect(ocrResult.full_text.length).toBeGreaterThan(100);

    const extracted = await extractFields({
      ocr_text: ocrResult.full_text,
      pdf_metadata: { filename: "acme-invoice-001.pdf", num_pages: 1 },
    });

    expect(extracted.vendor_name).not.toBeNull();
    expect(extracted.total).not.toBeNull();
    expect(extracted.invoice_number).not.toBeNull();
  });

  it("should achieve 80%+ completeness on sample set", async () => {
    const sampleInvoices = await listFiles("data/sample-invoices");
    let completeSamples = 0;

    for (const pdf of sampleInvoices) {
      const extracted = await extractAndStore(pdf);
      const fieldCount = [
        extracted.vendor_name,
        extracted.invoice_number,
        extracted.invoice_date,
        extracted.total,
      ].filter((f) => f !== null).length;

      if (fieldCount === 4) completeSamples++; // Required fields
    }

    const completeness = (completeSamples / sampleInvoices.length) * 100;
    expect(completeness).toBeGreaterThanOrEqual(80);
  });
});
```

### 5.3 Test Data

**Sample Invoices:** Store in `data/sample-invoices/` (gitignored):

```
data/sample-invoices/
├── acme-invoice-001.pdf    (single page, clear)
├── acme-invoice-002.pdf    (multi-page)
├── vendor-a-inv-low-quality.pdf  (degraded scan)
├── vendor-b-no-po.pdf      (missing PO field)
├── vendor-c-foreign-currency.pdf (GBP, EUR)
├── edge-case-handwritten.pdf      (low OCR confidence)
└── edge-case-multi-vendor.pdf     (consolidated invoice)
```

**Seed Test Database:**

```sql
-- For integration tests, pre-populate jobs table
INSERT INTO jobs (filename, file_size_bytes, file_url, status, created_at)
VALUES
  ('acme-001.pdf', 512000, '/uploads/test/acme-001.pdf', 'queued', now()),
  ('acme-002.pdf', 1024000, '/uploads/test/acme-002.pdf', 'queued', now());
```

---

## 6. Production Readiness Checklist

### 6.1 Observability

- [ ] Structured logging (JSON format, correlationId = job_id)
  - Log entry points: `job_start`, `ocr_request`, `ocr_response`, `llm_request`, `llm_response`, `job_success`, `job_failed`
  - Log all retries with attempt number and backoff delay

- [ ] Metrics
  - Counter: `extraction_jobs_total` (labels: status, ocr_provider, llm_model)
  - Histogram: `extraction_duration_seconds` (OCR, LLM, total)
  - Gauge: `extraction_queue_depth` (jobs in "queued" or "processing" state)
  - Counter: `extraction_errors_total` (labels: error_type, retryable)

- [ ] Tracing (optional, Phase B)
  - Span per job: `extract_job`
  - Child spans: `retrieve_file`, `run_ocr`, `extract_fields`, `persist_invoice`

- [ ] Alerts
  - Alert if extraction error rate > 10% in 5 min window
  - Alert if OCR latency > 40s (SLA is 30s)
  - Alert if LLM latency > 25s (SLA is 20s)
  - Alert if job queue depth > 50 (indicates bottleneck)

### 6.2 Security

- [ ] API endpoint auth: Require bearer token; only admin can trigger `/api/jobs/process`
- [ ] Rate limiting: 10 extraction jobs/minute per API key (prevent abuse)
- [ ] PDF validation: File type check (PDF MIME type), file size (max 20MB from Slice 1)
- [ ] OCR provider credentials: Store in `.env.local` (never committed)
- [ ] LLM provider credentials: Store in `.env.local` + rotate API keys monthly
- [ ] DB connection: Use Supabase RLS (row-level security) if multi-tenant in future
- [ ] Input sanitization: Validate all OCR/LLM outputs before DB insert (SQL injection prevention)
- [ ] Audit trail: Log all extractions with actor_id (if authenticated) in `audit_logs` table

### 6.3 Reliability

- [ ] Idempotency: Extract endpoint must be idempotent; use job_id as idempotency key
- [ ] Duplicate invoice prevention: Check for existing invoice by (vendor_name, invoice_number, total) before insert
- [ ] Transaction safety: Wrap job status update + invoice insert in single DB transaction
- [ ] Dead-letter queue (Phase B): Jobs that fail 3 times → moved to manual review queue
- [ ] Graceful degradation: If LLM service down, fall back to partial extraction + confidence = "low"

### 6.4 Performance

- [ ] 60s per-file SLA: Monitor actual latencies; set alert if p95 > 50s
  - OCR target: ≤30s
  - LLM target: ≤20s
  - Overhead (retrieval + validation + DB write): ≤10s
  - Buffer: 10s for cold starts

- [ ] Concurrency: Poll every 30s; process up to 1 job per poll (or increase if needed)
  - If queue depth > 50, increase concurrency to 3 jobs in parallel (Phase B)

- [ ] Caching:
  - File retrieval: No caching (files are unique per job)
  - OCR results: Optional cache by SHA256(pdf) with 7-day TTL (Phase B)
  - LLM: No caching (extraction is deterministic, not repeated)

### 6.5 Compliance & Auditing

- [ ] Audit log entry for each extraction:

  ```sql
  INSERT INTO audit_logs (invoice_id, action, actor_id, field_changes, created_at)
  VALUES (
    invoice_id,
    'extraction_completed',
    'system',
    jsonb_build_object('source', 'ocr', 'fields_count', 8),
    now()
  );
  ```

- [ ] Field history: `raw_extraction_json` stored in invoices table for full traceability
- [ ] Deletion prevention: Soft-delete; set `is_deleted = true` instead of dropping rows
- [ ] Data retention: Keep raw extraction and audit logs for ≥3 years (per SOX/tax requirements)

### 6.6 Deployment & Rollback

- [ ] Feature flag for extraction pipeline (kill switch)
  - `FEATURE_EXTRACTION_ENABLED = true/false`
  - If false, extraction endpoint returns 503 Service Unavailable

- [ ] Blue-green deployment:
  - Deploy new OCR/LLM config to blue environment
  - Route 10% traffic to blue; monitor error rates for 5 min
  - If error rate acceptable, route 100% to blue
  - Keep green available for quick rollback

- [ ] Rollback procedure:
  - If extraction error rate > 20% post-deploy, flip traffic back to green
  - Failed jobs stay in DB; reprocess after fix

### 6.7 Cost Management

- [ ] OpenAI usage tracking:
  - Log tokens_used per extraction
  - Set monthly budget limit: alert if run rate > $100/month
  - Consider batch processing (Phase B) for off-peak hours (50% discount)

- [ ] Google Document AI usage tracking:
  - Track pages processed per month
  - Budget: assume 100 pages/month (MVP = ~20 invoices, avg 5 pages)

### 6.8 Documentation

- [ ] API contract documentation (OpenAPI/Swagger)

  ```yaml
  POST /api/jobs/process:
    description: Trigger extraction for next queued job
    auth: bearer token
    response: { job_id, status, extracted_at, invoice_id }
  ```

- [ ] Runbook for on-call:
  - If extraction queue depth spike: check OCR/LLM health, manual trigger backfill
  - If extraction fails consistently: check PDF file store, verify API credentials
  - If DB writes slow: check Supabase connection pool, run EXPLAIN ANALYZE on queries

- [ ] Incident response template:

  ```markdown
  ## Extraction Pipeline Outage

  - Time detected: [timestamp]
  - Duration: [X minutes]
  - Root cause: [OCR / LLM / DB / Network]
  - Impact: [X jobs affected, Y revenue loss]
  - Resolution: [action taken]
  - Prevention: [future safeguard]
  ```

---

## 7. Design Decision Rationale

### Q: Should extraction run in API endpoint (sync) or background worker?

**Decision: Sync API endpoint with polling trigger.**

**Rationale:**

- MVP constraint: No async queue infrastructure (RabbitMQ, Celery)
- Next.js monolith: Can't easily spawn background workers without external service
- 60s SLO per file: Comfortable for sync processing (OCR 30s + LLM 20s + overhead 10s)
- Simpler operational model: One process, no cross-process coordination
- Idempotency: Poll-based ensures jobs aren't processed twice (unlike event-driven without exactly-once guarantees)

**Trade-off:** Poller adds ~30s latency to job discovery (acceptable for MVP).

**Phase B evolution:** Replace poller with event-driven (job status change → Pub/Sub → worker).

---

### Q: How do we handle PDF retrieval from local file store vs. S3?

**Decision: Abstraction layer with strategy pattern.**

**Rationale:**

- `FileRetrievalService` interface hides implementation details
- Detection logic: Check `process.env.S3_BUCKET`; if set, use S3; else use local
- Dual-mode mirrors Slice 1 (jobs-store already does this)
- Minimal code duplication; testability via mocking

**Phase B evolution:** Add GCS, Azure Blob support without changing extraction logic.

---

### Q: Should we cache OCR results per unique PDF?

**Decision: No caching for MVP; optional file-based cache in Phase B.**

**Rationale:**

- Most invoices are unique (different vendors, dates, amounts)
- 60s SLO already comfortable; caching adds complexity (cache invalidation, storage)
- Cache hit rate likely < 10% in real production (low ROI)
- File-based cache by SHA256(pdf) in Phase B: 7-day TTL, no external dependency

---

### Q: How do we trigger extraction?

**Decision: Sync extraction in the API request path for MVP.**

**Rationale:**

- Keeps Slice 2 deterministic and demo-friendly
- No background queue or poller required for MVP
- Admin retry endpoint can still be used for failed jobs
- Phase B can add event-driven async processing if volume requires it

**Trigger code:**

```typescript
// Can be called manually OR automatically every 30s
if (process.env.ENABLE_AUTO_POLLING === "true") {
  setInterval(() => fetch("/api/jobs/process"), 30000);
}
```

---

### Q: What retry strategy for OCR/LLM failures?

**Decision: Exponential backoff with 3 max retries, transient vs. permanent error classification.**

**Rationale:**

- Transient errors (timeout, 429, 503): Likely to succeed on retry → exponential backoff + jitter
- Permanent errors (invalid PDF, auth error, schema validation): Retry won't help → fail immediately
- 3 retries + backoff: ~1s + 2s + 4s = 7s total wait time before manual review (acceptable)
- Jitter prevents thundering herd (if multiple jobs fail simultaneously, they don't all retry at once)

**Max retries justification:**

- Retry 1: ≤ 1s after failure
- Retry 2: ≤ 2s after first retry
- Retry 3: ≤ 4s after second retry
- If still failing after ~7s, likely a permanent issue → escalate to manual review

---

## 8. Next Steps (Slice 2 Execution)

**Phase 1: Core Implementation (Days 3–4)**

1. Implement `FileRetrievalService` (local + S3)
2. Integrate Google Document AI (or Tesseract as fallback)
3. Implement `LlmExtractorService` (OpenAI GPT-4)
4. Build validation & normalization layer
5. Create `/api/jobs/process` endpoint with retry logic

**Phase 2: Testing (Day 4)**

1. Unit tests with mocked OCR/LLM
2. Sample invoice test set (10–20 PDFs)
3. Integration tests on real services (limited calls to save costs)
4. E2E test: Upload → Extract → Verify invoice created in DB

**Phase 3: Slice 3 Integration (Day 5)**

1. Trigger validation engine immediately after extraction
2. Flag missing PO, mismatched totals, duplicates
3. Create exceptions queue UI

---

## 9. Assumptions & Constraints

**Assumptions:**

1. Slice 1 delivers valid PDFs to file store (no corruption validation needed)
2. Job IDs are unique across all uploads (Slice 1 enforces)
3. Google Document AI or Tesseract is reliable enough for 80% completeness (validated post-MVP)
4. OpenAI API is stable and responsive (SLA: ≤99.9% uptime typical)
5. Database write latency is < 1s (Supabase typical)

**Constraints:**

1. 60s SLA per file (hard limit; exceed → timeout error)
2. Max 20MB file size (from Slice 1)
3. Single OCR provider, single LLM provider (no switching)
4. No async queues or background workers (MVP scope)
5. Local + Supabase dual-mode must both work

---

## 10. Success Criteria (Definition of Done)

- [ ] All 8 fields extracted and persisted to `invoices` table
- [ ] Confidence labels (high/medium/low) assigned per field
- [ ] 80%+ completeness on 10–20 sample invoices
- [ ] 60s SLA maintained on 95th percentile (p95)
- [ ] Error handling: job fails gracefully, retries up to 3 times
- [ ] Partial extraction handled: job marked "extracted" even if 6 of 8 fields present
- [ ] Audit trail: raw_extraction_json stored for full traceability
- [ ] Unit tests: all services mocked, >80% code coverage
- [ ] Integration test: E2E flow Upload → Extract → Validate works end-to-end
- [ ] Runbook & alert configuration documented

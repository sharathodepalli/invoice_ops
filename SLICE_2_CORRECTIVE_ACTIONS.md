# Slice 2 - Staff Review Board Corrective Actions

**Date:** May 17, 2026  
**Status:** Addressing High-Priority Findings  
**Target:** Conditional Go → Go before Day 1 implementation

---

## Critical Findings & Fixes

### Finding 1: SYNC vs ASYNC Architecture Contradiction 🔴 HIGH

**Issue:** Plan claims sync processing but also describes queued polling (async pattern). Conflicting trigger points will cause implementation confusion.

**Fix:**

- **Freeze Decision:** SYNC PROCESSING with AUTO-EXTRACTION on job creation
- **Single Trigger:** When job enters "queued" state (from Slice 1 upload), immediately invoke extraction in the same POST /api/upload response cycle
- **Do NOT implement background poller** for MVP (defer to Phase B if needed)
- **Single Status Flow:** queued → processing → extracted (or failed) within one request

**Updated Contract:**

```typescript
// POST /api/upload response (Slice 1)
{
  "upload_id": "...",
  "jobs": [{
    "job_id": "...",
    "filename": "...",
    "status": "queued"  // ← Will trigger extraction immediately
  }]
}

// Extraction triggers synchronously, status becomes:
// - processing (while OCR/LLM running)
// - extracted (success)
// - failed (permanent error)
```

**Justification:** Tight demo flow, users see results in 2-3 minutes, no complex queue management needed.

---

### Finding 2: SLO Math Contradiction 🔴 HIGH

**Issue:** Requirements demand 60s/file AND 20 files in 5 minutes under sync model (mathematically impossible: 60s × 20 = 1200s).

**Fix:**

- **Single-File SLO:** 60s per file (P95 latency for one extraction)
- **Batch Throughput:** NOT a launch gate for MVP (only 20 test files, processed sequentially)
- **Remove "20 in 5 min" from launch criteria** — defer batching optimization to Phase B
- **Restate Definition of Done:** Process 20 test files with ≥80% completeness (latency per file ≤60s P95)

**Updated SLO Table:**
| SLO | Target | Notes |
|-----|--------|-------|
| P50 per file | ≤40s | Expected |
| P95 per file | ≤55s | Must pass |
| P99 per file | ≤60s | Hard limit |
| Total for 20 files | ≤20 min | Informational (not a gate) |

**Justification:** MVP demos 1-2 files at a time; production batching optimization (Phase B) will use async model.

---

### Finding 3: Security Contract Gap 🔴 HIGH

**Issue:** Architecture requires admin-only auth for extraction, but API contract doesn't define endpoint or auth requirements. Expensive OCR/LLM exposed to abuse.

**Fix:**
**A. Add extraction endpoints to API_CONTRACT_FREEZE.md immediately:**

```yaml
# API Contract Addition - Extraction

PUT /api/jobs/:job_id/extract
  Description: Manual trigger for extraction (admin only)
  Auth: Bearer token with role="admin"
  Request:
    - No body
  Response 202:
    - job_id
    - status: "processing"
  Response 401:
    - { "error": { "code": "unauthorized", "message": "Admin role required" } }
  Response 404:
    - { "error": { "code": "not_found", "message": "Job not found" } }
  Response 409:
    - { "error": { "code": "conflict", "message": "Job already processing" } }
  RateLimit: 10 per minute per user

POST /api/jobs/process-queued [INTERNAL ONLY]
  Description: Job poller (internal worker, do not expose publicly)
  Auth: Bearer token with role="system"
  Response 200:
    - processed_count
    - errors[]
  Response 401:
    - { "error": { "code": "unauthorized" } }
```

**B. Add auth middleware to Next.js API routes:**

```typescript
// src/lib/auth-middleware.ts
export async function verifyAuth(
  req: Request,
  requiredRole: "admin" | "system",
) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("Missing auth token", { cause: 401 });

  // Validate token (JWT or custom scheme)
  const decoded = await validateToken(token);
  if (decoded.role !== requiredRole) {
    throw new Error("Insufficient permissions", { cause: 403 });
  }
  return decoded;
}
```

**C. Apply auth to routes:**

```typescript
// src/app/api/jobs/[job_id]/extract/route.ts
export async function PUT(
  req: Request,
  { params }: { params: { job_id: string } },
) {
  const user = await verifyAuth(req, "admin"); // ← Admin only
  // ... extraction logic
}

// src/app/api/jobs/process-queued/route.ts (internal only)
export async function POST(req: Request) {
  const system = await verifyAuth(req, "system"); // ← System only
  // ... poller logic
}
```

**D. Rate limiting:**

- Admin trigger: 10/minute per user
- System poller: 100/minute (internal only)

**Justification:** Prevents unauthorized expensive API calls; audit trail; separates internal from user-facing endpoints.

---

### Finding 4: Retry Semantics Inconsistency 🟡 MEDIUM

**Issue:** Different docs specify different retry schedules (1s,2s,4s,8s vs 1s,2s,4s).

**Fix:**
**Freeze one retry policy:**

```yaml
# Extraction Retry Policy v1.0

Transient Errors (retry):
  - OCR timeout
  - LLM rate limit
  - Network timeout
  - Temporary DB connection error

Permanent Errors (fail job, no retry):
  - PDF corrupted
  - Invalid credentials
  - LLM schema validation failed (after 1 re-prompt)
  - DB write failed (after 1 attempt)

Retry Schedule:
  - Attempt 1: Immediate
  - Attempt 2: Wait 1s, retry
  - Attempt 3: Wait 2s, retry
  - Attempt 4: Wait 4s, retry
  - Attempt 5+: Fail job, manual escalation

Max Retries: 4 (total 5 attempts including first)
Total timeout: 60s hard limit per file
```

**Justification:** Exponential backoff standard; 4 retries gives ~99.5% recovery rate without exceeding 60s SLO.

---

### Finding 5: Cost Gate Misalignment 🟡 MEDIUM

**Issue:** Different docs cite different pass/fail thresholds ($3.02 vs $4.02 vs no clear gate).

**Fix:**
**Freeze one budget gate:**

```yaml
# Cost Gate - Slice 2 MVP

Baseline (expected): $3.02 per file
  - Google Doc AI: ~$1.50
  - OpenAI GPT-4: ~$1.50
  - Margin: $0.02

Green zone: <$3.50 per file
  - Allow if actual_cost < $3.50

Yellow zone: $3.50–$4.00 per file
  - Document why (e.g., larger PDFs, more retries)
  - May proceed with cost review

Red zone: >$4.00 per file
  - No-go for Slice 2
  - Investigate OCR/LLM inefficiency
  - Consider fallback strategy for Phase B
```

**Tracking:**

```sql
-- Add cost_per_file to monitoring
SELECT
  job_id,
  ocr_cost,
  llm_cost,
  total_cost,
  (ocr_cost + llm_cost) AS actual_cost_per_file,
  CASE
    WHEN (ocr_cost + llm_cost) < 3.50 THEN 'green'
    WHEN (ocr_cost + llm_cost) < 4.00 THEN 'yellow'
    ELSE 'red'
  END AS cost_status
FROM job_costs
WHERE created_at > now() - interval '1 day'
ORDER BY actual_cost_per_file DESC;
```

**Justification:** Single threshold, tracked per file, allows escalation if needed but prevents runaway costs.

---

### Finding 6: Audit Trail Constraints 🟡 MEDIUM

**Issue:** Audit actor nullable and confidence labels unconstrained (no DB validation).

**Fix:**
**Update Schema (invoice-app/supabase/setup.sql):**

```sql
-- Add confidence enum constraint
ALTER TABLE public.invoices
  ADD CONSTRAINT check_vendor_name_confidence
    CHECK (vendor_name_confidence IN ('high', 'medium', 'low') OR vendor_name_confidence IS NULL);
ALTER TABLE public.invoices
  ADD CONSTRAINT check_invoice_number_confidence
    CHECK (invoice_number_confidence IN ('high', 'medium', 'low') OR invoice_number_confidence IS NULL);
-- ... repeat for all 8 fields

-- Make actor non-null for user actions
ALTER TABLE public.audit_logs
  ADD CONSTRAINT check_actor_not_null_on_action
    CHECK ((action NOT IN ('created', 'updated') AND actor_id IS NULL)
           OR (action IN ('created', 'updated') AND actor_id IS NOT NULL));
```

**Code Validation:**

```typescript
// Enforce in LLM extractor
const VALID_CONFIDENCES = ['high', 'medium', 'low'];
for (const field of ['vendor_name', 'invoice_number', ...]) {
  if (!VALID_CONFIDENCES.includes(extracted[`${field}_confidence`])) {
    throw new ValidationError(`Invalid confidence for ${field}`);
  }
}
```

**Justification:** Prevents garbage data in production; audit trail remains reliable.

---

### Finding 7: QA Target Clarity 🟢 LOW

**Issue:** 80% completeness mixed with 100% field accuracy targets (creates ambiguity).

**Fix:**
**Restate QA gates clearly:**

```yaml
# Go/No-Go Gates - Slice 2

MVP Gate (must pass):
  - ≥80% core field completeness (16 of 20 test invoices with 7-8 fields extracted)
  - P95 latency ≤55s per file
  - Cost <$4.00 per file
  - No breaking changes to Slice 1

Stretch Goals (nice to have, Phase B):
  - 100% vendor/invoice/total accuracy on seed set
  - <1% permanent error rate
  - ≤$2.50 per file cost

Pass/Fail Criteria:
  - PASS if: Completeness ≥80% AND latency ≤55s P95 AND cost <$4.00
  - FAIL if: Any gate misses (document in retrospective, plan Phase B response)
```

**Justification:** Clear MVP bar; stretch goals documented separately.

---

## Updated Extraction Contract (Single Source of Truth)

```typescript
// Slice 2 Runtime Contract v1.0

// ======= TRIGGER & FLOW =======
// 1. User uploads PDF (Slice 1)
// 2. POST /api/upload → job.status = queued
// 3. Extraction runs synchronously (same request or immediately after)
// 4. job.status → processing → extracted (or failed)
// 5. invoices table INSERT with 8 fields + confidence + raw JSON
// 6. Slice 3 reads invoices table

// ======= DATA CONTRACTS =======

// Input: Job (from Slice 1 upload)
interface Job {
  job_id: string;
  filename: string;
  file_url: string; // Path or URL to PDF
  file_size_bytes: number;
  status: "queued" | "processing" | "extracted" | "failed";
}

// Output: Invoice (written to DB for Slice 3)
interface Invoice {
  id: UUID;
  job_id: UUID;
  status: "extracted" | "exception" | "approved" | "rejected" | "exported";
  vendor_name: string | null;
  vendor_name_confidence: "high" | "medium" | "low" | null;
  invoice_number: string | null;
  invoice_number_confidence: "high" | "medium" | "low" | null;
  invoice_date: Date | null;
  invoice_date_confidence: "high" | "medium" | "low" | null;
  subtotal: decimal | null;
  subtotal_confidence: "high" | "medium" | "low" | null;
  tax: decimal | null;
  tax_confidence: "high" | "medium" | "low" | null;
  total: decimal | null;
  total_confidence: "high" | "medium" | "low" | null;
  po_number: string | null;
  po_number_confidence: "high" | "medium" | "low" | null;
  currency: string | null; // ISO 4217
  currency_confidence: "high" | "medium" | "low" | null;
  raw_extraction_json: object; // Full LLM response for audit
  created_at: ISO8601;
  updated_at: ISO8601;
}

// ======= SLOs =======
// Per-file extraction: P95 ≤55s
// Per-file cost: <$4.00
// Completeness: ≥80% (16/20 test invoices with 7-8 fields)

// ======= SECURITY =======
// Admin manual trigger: PUT /api/jobs/:job_id/extract (requires admin token)
// System poller: POST /api/jobs/process-queued (internal only, system token)
// Rate limits: 10/min (admin), 100/min (system)
```

---

## Pre-Implementation Checklist (Must Complete Before Day 1)

- [ ] **API Contract Update:** Add extraction endpoints + auth matrix to API_CONTRACT_FREEZE.md
- [ ] **Retry Policy Freeze:** Document exact schedule (4 retries, exponential backoff 1s/2s/4s)
- [ ] **Cost Gate Lock:** Confirm $3.50 green / $4.00 red thresholds
- [ ] **Schema Update:** Add confidence enum constraints + audit actor nullability rules
- [ ] **Auth Middleware:** Implement verifyAuth() with role checking
- [ ] **QA Gate Clarification:** Publish single go/no-go table (80% completeness, <55s P95, <$4/file)
- [ ] **Remove Poller Code:** Defer background job polling to Phase B (don't implement for MVP)
- [ ] **Document Sync-Only Architecture:** Make clear in README that Slice 2 uses sync extraction for MVP

---

## Revised Release Recommendation

**Previous:** No-Go  
**After Fixes:** **Conditional Go**

**Conditional Go Blockers (must fix before Day 1 starts):**

1. ✅ API Contract: Add extraction endpoints with auth
2. ✅ Retry policy: Freeze in SLICE_2_RETRY_POLICY.md
3. ✅ Cost gate: Confirm $4.00 hard limit
4. ✅ Schema: Add confidence enum + audit actor constraints
5. ✅ Auth middleware: Implement and test

**Proceed to Day 1 once all above items checked off.**

**Can Revisit in Phase B:**

- Async queue model (if >100 files/day needed)
- LLM fallback optimization (after real telemetry)
- OCR caching strategy (after baseline cost measured)

---

**Status: ✅ READY FOR FIXES**

Next: Implement the 5 blockers, re-run Staff Review, get to Go status before implementation starts.

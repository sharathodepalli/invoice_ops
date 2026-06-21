# Slice 2 Performance & Cost Engineering Plan

**Status:** Design Freeze  
**Date:** May 17, 2026  
**Prepared by:** Principal Performance and Cost Engineer  
**Scope:** OCR/Extraction synchronous pipeline (60s SLO, batch <5min)

---

## 1. SLOs & Cost Targets

### 1.1 Performance SLOs

| Metric                  | Target            | P95 Threshold | Rationale                                       |
| ----------------------- | ----------------- | ------------- | ----------------------------------------------- |
| **Per-File Latency**    | 60s               | 55s           | Fits Next.js 60s timeout with 5s safety margin  |
| **Batch Throughput**    | <5min for 5 files | 4m 50s        | Enables feedback loop for demo flow             |
| **OCR Latency**         | ≤10s              | 8s            | Accounts for network + processing time          |
| **LLM Latency**         | ≤8s               | 7s            | GPT-4 turbo typical response time               |
| **DB Insert Latency**   | ≤1s               | 0.8s          | Postgres insert + indexes                       |
| **Network Overhead**    | ≤3s               | 2.5s          | File retrieval + API calls                      |
| **Error Recovery Time** | 2-4s              | 3s            | Exponential backoff: 1s, 2s, 4s (max 3 retries) |

### 1.2 Cost Targets (per 100 files, baseline USD)

| Component                       | Unit Cost            | Per-File        | Per-100       | Notes                                           |
| ------------------------------- | -------------------- | --------------- | ------------- | ----------------------------------------------- |
| **Google Document AI**          | $1.50/page           | $1.50–$3.00     | $150–$300     | Assume avg 2 pages/invoice                      |
| **OpenAI GPT-4 Turbo**          | $0.001/1K tokens     | $0.01–$0.02     | $1–$2         | ~1.5K tokens per extraction (prompt + response) |
| **Supabase Postgres**           | $25/mo (100 req/sec) | $0.000001/req   | $0.0001       | Insert + confidence fields (8 rows per invoice) |
| **S3 Storage**                  | $0.023/GB/month      | $0.000046/file  | $0.0046       | Store 2 MB invoices, 30-day retention           |
| **Data Transfer (out)**         | $0.09/GB             | $0.00018/file   | $0.018        | Download from S3 (network egress)               |
| **Cache Misses (missed oppty)** | —                    | —               | —             | No OCR caching in MVP (add in Phase B)          |
| **TOTAL (baseline)**            | —                    | **$1.51–$3.02** | **$151–$302** | Per 100 files, 80% success rate                 |

### 1.3 Acceptable Cost/Performance Trade-offs

| Trade-off                               | Impact                                    | Decision                                                   |
| --------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Local OCR (Tesseract) vs. Google Doc AI | Cost ↓ 90%, Latency +2–3s, Accuracy ↓ 10% | Skip for MVP; accuracy > cost                              |
| GPT-4 Turbo vs. GPT-3.5                 | Cost ↓ 85%, Accuracy ↓ 5–8%               | Use GPT-4 Turbo for MVP demo quality                       |
| Caching OCR results                     | Cost ↓ 60% (for duplicates), Complexity ↑ | Skip for MVP, implement Phase B if >100/day                |
| Parallel OCR+LLM calls                  | Latency ↓ 30%, Throughput ↑ 2x            | Not possible (LLM needs OCR output); stick with sequential |
| Async extraction (queued jobs)          | Latency N/A, Throughput ↑ 10x             | Phase B only if >100 files/day consistently                |

---

## 2. Load & Capacity Model

### 2.1 Critical Path Map

```
File Retrieval (5s) ─→ OCR (10s) ─→ LLM (8s) ─→ Validation (1s) ─→ DB Insert (1s)
                                          ↓
                                    Network/DNS (2s)

Total: 5 + 10 + 8 + 1 + 1 = 25s nominal
       + 15s network/queue overhead
       = ~40s p50, 55s p95 (comfortable within 60s SLO)
```

### 2.2 Per-Component Latency Breakdown (p50 / p95 / p99)

| Stage                          | Nominal            | P95     | P99     | Bottleneck Risk                                     |
| ------------------------------ | ------------------ | ------- | ------- | --------------------------------------------------- |
| File Retrieval (local FS)      | 0.5s / 1s / 2s     | 1s      | 2s      | Low (local read)                                    |
| File Retrieval (S3)            | 3s / 5s / 8s       | 5s      | 8s      | **Medium** (network + S3 latency)                   |
| OCR (Google Doc AI)            | 8s / 10s / 15s     | 10s     | 15s     | **HIGH** (API throttle + processing)                |
| Network jitter (OCR/LLM calls) | 0.5s / 1.5s / 3s   | 1.5s    | 3s      | Medium (regional latency)                           |
| LLM (GPT-4 Turbo)              | 5s / 8s / 12s      | 8s      | 12s     | **HIGH** (API queue, token limit)                   |
| Validation & Normalization     | 0.1s / 0.2s / 0.5s | 0.2s    | 0.5s    | Low (local CPU)                                     |
| DB Insert (Supabase Postgres)  | 0.3s / 0.8s / 1.5s | 0.8s    | 1.5s    | Low–Medium (conn pool contention if >10 concurrent) |
| **TOTAL CRITICAL PATH**        | **17.8s**          | **27s** | **42s** | —                                                   |
| Safety Margin to 60s Timeout   | —                  | **33s** | **18s** | —                                                   |

### 2.3 Concurrency Model

**MVP Implementation:** Synchronous (one file at a time) within POST /api/jobs/process.

**Throughput Capacity (local file storage):**

| Scenario                   | Files/Hour | Files/Day | Latency P95    | Constraint                              |
| -------------------------- | ---------- | --------- | -------------- | --------------------------------------- |
| Single sync call (60s SLO) | 60         | 480       | 55s            | Next.js request timeout                 |
| 5-file batch sequential    | 12         | 96        | 275s (p50)     | Fits <5min demo flow                    |
| 10-file batch sequential   | 6          | 48        | 550s (p50)     | Exceeds 5min, escalate to async         |
| Concurrent (10 workers)    | 600        | 4,800     | 55s per worker | Requires background queue + worker pool |

**MVP Constraint:** Next.js processes 1 file per POST call in 60s. To process 20 test invoices by demo day (1 day), invoke endpoint 20 times sequentially = ~33 min total (acceptable for pre-demo testing).

### 2.4 Failure Scenarios & Recovery

| Failure Mode                    | Detection                      | Recovery                     | Impact                                                  |
| ------------------------------- | ------------------------------ | ---------------------------- | ------------------------------------------------------- |
| OCR timeout (>30s)              | Explicit error from Google API | Retry 1s, 2s, 4s (max 3×)    | Job moves to `queued` after retry; user sees delay      |
| OCR outage (API down)           | 503/429 response               | Backoff + manual review flag | Job status `failed`; operator notified                  |
| LLM timeout (>20s)              | GPT-4 API timeout              | Retry (same schedule)        | Job requeued within 2–4s; max 3 attempts                |
| LLM rate limit (429)            | OpenAI throttle                | Exponential backoff + queue  | Job delays; latency → 20–60s per retry                  |
| Partial extraction (6/8 fields) | LLM returns nulls              | Accept & persist             | Job status `extracted`; validation flags missing fields |
| Network timeout (<1% of calls)  | Socket timeout                 | Retry (same schedule)        | Adds 5–10s per retry; max 3 attempts                    |
| DB insert failure               | Postgres error                 | Retry (pessimistic lock)     | Job status stays `processing`; requeued next poll       |
| Malformed PDF                   | OCR returns empty text         | Job status `failed`          | Error logged; operator manual review                    |

### 2.5 Scalability Ceiling (MVP)

**Current architecture hits scalability limits at:**

- **~100 files/day** with synchronous processing
- **>10 concurrent users** uploading batches simultaneously (connection pool saturation)
- **>5 retries** per file (exponential backoff delays compound)

**Trigger for Escalation to Async (Phase C):**

- If consistent volume >100 files/day: implement background queue (e.g., Bull/Redis, Inngest)
- If batch latency >8 min: add worker pool (2–4 dedicated extraction workers)
- If error rate >5%: increase retry budget + DLQ instrumentation

---

## 3. Bottleneck Hypotheses & Validation

### 3.1 Likely Bottlenecks (Priority Order)

| Rank  | Component              | Hypothesis                                                             | Detection Method                                  | Mitigation                                                                    |
| ----- | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| **1** | **OCR Latency**        | Google Doc AI p95 = 10–12s; represents 38% of critical path            | Profile OCR calls; log per-file timing            | Implement caching (Phase B) if hits >15% of calls; consider Tesseract for dev |
| **2** | **LLM Latency**        | GPT-4 Turbo avg 5–8s; ~30% of critical path; bursty due to token limit | Monitor OpenAI usage dashboard; measure token/req | Implement token-aware batching; fallback to GPT-3.5 if cost spike             |
| **3** | **Network Jitter**     | DNS + TLS handshake + HTTP overhead = 2–3s per external API call       | Use HTTP/2 keep-alives; instrument DNS resolution | Pre-establish connections; implement circuit breaker for API failures         |
| **4** | **DB Connection Pool** | Default 10 conn pool may saturate if >5 concurrent extraction requests | Monitor `active_connections` in Supabase metrics  | Scale pool to 20 conns for batch processing; implement queueing               |
| **5** | **S3 Retrieval**       | If using S3, file download latency = 3–5s (only for remote storage)    | Profile S3 download times; log transfer bytes/sec | Use local storage for MVP (S3 in Phase B); implement pre-signed URL caching   |

### 3.2 Validation Plan

**Pre-Launch Testing (before demo):**

1. **Load Profile:** Run extraction on 20 test invoices sequentially; measure p50/p95/p99 latencies
2. **Error Budget:** Deliberately trigger OCR timeouts, LLM rate limits, corrupt PDFs; verify retry logic
3. **Cost Baseline:** Run 10 files through full pipeline; validate costs against model (expect ±20% variance)
4. **Concurrent Pressure:** Simulate 5 simultaneous extraction requests; verify no connection pool errors
5. **Failure Recovery:** Kill API mid-extraction; verify job resumes on next poll without duplication

**Pass/Fail Thresholds:**

- ✅ **PASS:** 90% of files extracted in <55s; 0 duplicates; <5% error rate
- ❌ **FAIL:** >15% of files timeout; >2 duplicates; cost >$4/file; error rate >10%

---

## 4. Optimization Plan

### 4.1 Quick Wins (0–2 hour dev effort)

| Optimization               | Effort | Impact                                         | Owner   | Implementation                                                                  |
| -------------------------- | ------ | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| **HTTP/2 Keep-Alives**     | 0.5h   | Latency ↓ 500ms (save DNS/TLS per call)        | Backend | `openai.defaultHeaders.connection = "keep-alive"`; Google Doc AI client default |
| **Request Batching (LLM)** | 1h     | Cost ↓ 10% (group prompt instructions)         | Backend | Combine multiple extraction prompts into single API call if batch >1 file       |
| **Async DB Writes**        | 1.5h   | Latency ↓ 300ms (non-blocking insert)          | Backend | Use `Promise.all()` for invoice + confidence + audit log inserts                |
| **Connection Pool Tuning** | 0.5h   | Throughput ↑ 30% (avoid conn wait)             | DevOps  | Scale Supabase pool from 10 → 20 conns; monitor idle conns                      |
| **Local File Caching**     | 1h     | Eliminates 1–2 S3 round-trips (if applicable)  | Backend | Cache OCR results by SHA256(pdf_bytes) in `/tmp/` for 24h                       |
| **Retry Jitter**           | 0.5h   | Latency variance ↓ 20% (avoid thundering herd) | Backend | Add random jitter (100–500ms) to exponential backoff                            |

### 4.2 Structural Improvements (Phase B, 4–8 hour effort)

| Optimization                         | Effort | Impact                                                       | Trade-offs                                                |
| ------------------------------------ | ------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| **OCR Result Caching (Redis)**       | 4h     | Cost ↓ 50% (skip OCR for duplicates); latency ↓ 8s           | Add Redis dependency; 7-day TTL management                |
| **Parallel OCR + LLM (async/await)** | 2h     | Throughput ↑ 50% (cannot parallelize; OCR must finish first) | N/A (architectural constraint: LLM depends on OCR output) |
| **Background Queue (Bull/Inngest)**  | 6h     | Throughput ↑ 10x; latency ∞ (async model)                    | Breaks 60s SLO; enables >1000 files/day                   |
| **LLM Fine-Tuning (OpenAI)**         | 8h     | Accuracy ↑ 5–10%; latency ↓ 20%; cost ↑ 40%                  | Requires labeled dataset (100+ invoices); phase after MVP |
| **Local Tesseract OCR (fallback)**   | 3h     | Cost ↓ 95%; latency +2–3s; accuracy ↓ 10%                    | Add 2–3s per file; only for non-critical batches          |

### 4.3 Recommended Phase B Roadmap

**If >100 files/day by Day 45:**

1. Implement Redis caching for OCR (largest cost/latency win)
2. Scale DB connection pool to 50 conns
3. Add Background queue (Bull) for non-critical batches
4. Implement circuit breaker + fallback for API failures

**If <50 files/day:**

Skip Phase B optimizations; stick with MVP synchronous model.

---

## 5. Monitoring KPIs & Alerting

### 5.1 Instrumentation Points

```typescript
// Add to /api/jobs/process endpoint:

const metrics = {
  // Latency (ms)
  fileRetrievalMs: 0,
  ocrMs: 0,
  llmMs: 0,
  validationMs: 0,
  dbInsertMs: 0,
  totalMs: 0,

  // Cost tracking (USD)
  ocrCost: 0,
  llmCost: 0,
  storageCost: 0,

  // Errors
  ocrError: null,
  llmError: null,
  dbError: null,
  retryCount: 0,

  // Extractions
  fieldsExtracted: 0,
  fieldsNull: 0,
  confidenceHigh: 0,
  confidenceMedium: 0,
  confidenceLow: 0,
};

// Log to structured logging (e.g., Datadog, Splunk, CloudWatch):
logger.info("extraction_complete", {
  job_id: job.job_id,
  file_name: job.filename,
  metrics,
  timestamp: new Date().toISOString(),
});
```

### 5.2 KPI Dashboard (Real-Time)

| KPI                   | Target            | Alert Threshold | Owner            |
| --------------------- | ----------------- | --------------- | ---------------- |
| **P95 Latency**       | ≤55s              | >60s            | Backend Lead     |
| **Error Rate**        | <5%               | >10%            | Backend Lead     |
| **Cost per File**     | ≤$2.50            | >$4.00          | Finance          |
| **OCR Success Rate**  | ≥95%              | <85%            | OCR Provider SLA |
| **LLM Accuracy**      | ≥80% (completion) | <70%            | QA Lead          |
| **DB Insert Latency** | ≤1s               | >2s             | DBA              |
| **API Availability**  | ≥99.5%            | <99%            | Ops Lead         |
| **Cost per Day**      | ≤$250 (20 files)  | >$500           | Finance          |

### 5.3 Alerting Rules

```yaml
# Pseudo-code for alerting configuration (e.g., Datadog, PagerDuty)

alerts:
  - name: "Extraction P95 Latency High"
    condition: "p95(latency_ms) > 60_000"
    duration: 5m
    severity: "warning"
    action: "notify #backend-on-call"

  - name: "OCR Service Timeout"
    condition: "count(error='ocr_timeout') > 5 in 1m"
    duration: 1m
    severity: "critical"
    action: "page oncall; escalate to Google Cloud support"

  - name: "LLM Rate Limit Hit"
    condition: "count(error='openai_429') > 10 in 10m"
    duration: 10m
    severity: "warning"
    action: "notify #ops; reduce batch size"

  - name: "Daily Cost Overage"
    condition: "daily_cost > $500"
    duration: 1d
    severity: "warning"
    action: "notify #finance; investigate root cause"

  - name: "DB Connection Pool Saturation"
    condition: "active_connections > 18 for 2m"
    duration: 2m
    severity: "warning"
    action: "scale pool; notify #database-team"
```

---

## 6. Cost Guardrails & Budget Controls

### 6.1 Daily Cost Budget

```
Daily limit: $250 (for 100 files at $2.50/file)
MVP scope: 20 test files = ~$50 cost budget

Breakdown per 20 files:
  OCR:  20 files × 2 pages × $1.50 = $60 (OVER, but expected; capping at 20 pages)
  LLM:  20 files × $0.015 = $0.30
  DB:   20 files × $0.000001 × 8 fields = negligible
  Storage: $0.46 (one-time; accumulated over month)
  Total: ~$60 for MVP test run

Optimization: Set OCR page limit to 10 pages/file (enough for 99% of invoices)
  Adjusted: 20 files × 10 pages × $1.50 = $300 (acceptable for full test run)
```

### 6.2 Cost Control Measures

| Control                   | Implementation                                           | Trigger                   |
| ------------------------- | -------------------------------------------------------- | ------------------------- |
| **OCR Page Limit**        | Truncate PDF to first 10 pages before OCR API call       | Every extraction          |
| **LLM Token Budget**      | Monitor input token count; reject if >2K tokens          | Pre-API call validation   |
| **Rate Limiting**         | 60 req/min per OpenAI tier-1 account; queue excess       | Incoming request          |
| **File Size Cap**         | Reject PDFs >5 MB before processing                      | Upload validation         |
| **Retry Circuit Breaker** | Skip retries after 3 consecutive failures for same error | After 3rd failure         |
| **Daily Spend Cap**       | Halt all extractions if daily cost >$300 (MVP dev only)  | End-of-day reconciliation |

### 6.3 Cost Anomaly Detection

```
Alert if:
  - OCR cost jumps >$50/day (suggests large batch or OCR API misconfiguration)
  - LLM cost jumps >$20/day (suggests token inflation or prompt bloat)
  - Daily run cost exceeds 3× rolling 7-day average (anomaly)
```

---

## 7. Scaling Strategy (Thresholds & Escalation)

### 7.1 Scaling Triggers

| Metric                       | Threshold                      | Action                                   | Target           |
| ---------------------------- | ------------------------------ | ---------------------------------------- | ---------------- |
| **Files/Day Consistent**     | >100 files/day for 3 days      | Escalate to background queue             | 500+ files/day   |
| **Batch Latency**            | >5 min for batch of 5          | Add concurrent extraction worker         | <3 min per batch |
| **Error Rate**               | >10% (persistent)              | Implement DLQ + manual review queue      | <5%              |
| **API Availability**         | <99% (SLA breach)              | Implement circuit breaker + fallback     | ≥99.5%           |
| **Cost/File**                | >$3.50                         | Implement OCR caching + GPT-3.5 fallback | ≤$2.50           |
| **DB Connection Saturation** | >80% (active_connections > 18) | Scale pool to 50; implement queueing     | <50% utilization |

### 7.2 Scaling Roadmap

**Phase A (MVP, now–Day 30):** Synchronous extraction in API route. Target: 20 test files.

**Phase B (Scale-ready, Day 31–45):** Add Redis caching, connection pool tuning, monitoring. Target: 100 files/day.

**Phase C (Async workers, Day 46+):** Background queue (Bull/Inngest), worker pool (2–4 workers), DLQ. Target: 1000+ files/day.

---

## 8. Release Readiness Verdict

### 8.1 Pre-Launch Checklist

- [ ] **Latency:** Run 20 test files; verify p95 ≤55s
- [ ] **Cost Baseline:** Confirm per-file cost ≤$3.00 (accounting for OCR page limit)
- [ ] **Error Recovery:** Trigger 3 OCR timeouts + 2 LLM rate limits; verify retry logic works
- [ ] **No Duplicates:** Verify idempotency (re-run same file 3×; confirm 1 invoice record only)
- [ ] **Monitoring:** All KPI dashboards live and alerting correctly
- [ ] **Documentation:** API docs, runbook for "extraction stuck", cost accountability doc
- [ ] **Operator UX:** Job status updates in real-time; error messages actionable

### 8.2 Go / No-Go Criteria

**✅ GO Criteria:**

1. P95 latency ≤55s for 90%+ of files
2. Error rate <5% (temporary failures retried successfully)
3. Cost per file ≤$3.00
4. Zero duplicate invoice records across re-runs
5. All KPI alerts functioning
6. Extraction completes for ≥18 of 20 test files with ≥80% field completion

**❌ NO-GO Criteria:**

1. P95 latency >65s (exceeds safety margin)
2. Error rate >15% (unreliable for demo)
3. Cost per file >$4.00 (budget overrun)
4. > 1 duplicate invoice record (data integrity issue)
5. Any KPI alert misconfigured or silent
6. <15 of 20 files successfully extracted
7. Any unrecovered API timeout after retries

### 8.3 Recommended Readiness Date

**Target Launch:** Day 45 (Slice 2 completion)  
**Pre-Launch Testing Window:** Days 40–44 (5 days for tuning + validation)  
**Verdict:** **CONDITIONAL READY** — proceed if quick wins (Section 4.1) are implemented and test results exceed GO criteria. Otherwise, roll to Phase B async architecture before accepting 100+ files/day.

---

## 9. Appendix: Cost Model Detail

### 9.1 API Cost Calculation (Detailed)

#### Google Document AI

**Model:** Standard (non-specialized) document processing  
**Pricing:** $1.50 per page (first 1 million pages free per month)

```
Per-file assumption: 2 pages (most invoices 1–2 pages; outliers 3–5)
Per-file cost: 2 pages × $1.50 = $3.00

Optimization: Truncate PDFs to first 10 pages before API call
  If 95% of invoices are ≤10 pages: cost unchanged at $3.00
  If 5% have >10 pages: charge max 10 pages = $15 max per file
  Weighted avg: 0.95 × $3.00 + 0.05 × $15 = $3.60

Conservative estimate per file: $3.00–$4.00
```

#### OpenAI GPT-4 Turbo

**Model:** `gpt-4-turbo` (128K context)  
**Pricing:** $0.01 per 1K input tokens, $0.03 per 1K output tokens

```
Extraction prompt structure:
  System message: ~200 tokens (instructions)
  OCR text: ~800–1000 tokens (avg invoice ~2 pages × 500 tokens/page)
  Total input: ~1000 tokens

Response: ~200–300 tokens (JSON output: 8 fields × 25 tokens each)

Cost per file:
  Input: 1000 tokens × $0.01 / 1000 = $0.01
  Output: 250 tokens × $0.03 / 1000 = $0.0075
  Total: $0.0175 per file (round to $0.02)

Alternative (GPT-3.5-turbo cheaper):
  Input: $0.0005 per 1K
  Output: $0.0015 per 1K
  Cost: (1000 × $0.0005 + 250 × $0.0015) / 1000 = $0.00088 per file
  Savings: 95%, but accuracy drops 5–8%
```

#### Supabase Postgres Insert

**Model:** ~5 SQL operations per extraction (1 invoice record + confidence updates)  
**Pricing:** $25/mo for 100 concurrent req/sec

```
Cost amortization: $25 / (100 req/sec × 86,400 sec/day × 30 days)
  = $0.000000096 per request

5 operations × $0.000000096 = $0.00000048 per file
Cost is negligible (<$0.01 per 1000 files)
```

#### S3 Storage (if used)

**Model:** 2 MB per invoice; 30-day retention  
**Pricing:** $0.023 per GB-month (storage) + $0.09 per GB (data transfer out)

```
Storage: 2 MB × 100 files / 1000 = 0.2 GB × $0.023 = $0.0046 per 100 files
Transfer (egress): Same, $0.018 per 100 files
Total: ~$0.00005 per file (negligible for MVP)
```

### 9.2 Cost Sensitivity Analysis

```
Base case (20 test files):
  OCR: 20 × $3.00 = $60
  LLM: 20 × $0.02 = $0.40
  DB: negligible
  Storage: negligible
  Total: ~$60

+10% OCR latency (3 pages instead of 2):
  $60 × 1.5 = $90
  Risk: 5% of invoices exceed 2 pages; cumulative impact

+20% LLM token inflation (complex invoices):
  $0.40 × 1.2 = $0.48
  Risk: low; avg token count stable

100+ files/day (no caching):
  ($60/20) × 100 = $300/day
  Unsustainable at current prices; requires caching or cheaper LLM

100+ files/day (with 50% OCR cache hit):
  ($300 × 0.5) + $30 (DB) = $180/day
  Viable with caching + GPT-3.5 fallback
```

---

## 10. Summary Table: Key Metrics

| Metric                      | Value             | Status              | Note                        |
| --------------------------- | ----------------- | ------------------- | --------------------------- |
| **SLO (60s/file)**          | P95 = 55s         | ✅ On Track         | 5s safety margin            |
| **Cost per File**           | $3.02             | ✅ On Track         | Within budget               |
| **Throughput (MVP)**        | 60 files/hr       | ✅ Adequate         | Fits <5min batch demo       |
| **Error Rate Target**       | <5%               | ✅ Achievable       | With 3× retry budget        |
| **Bottleneck #1**           | OCR latency (10s) | ⚠️ Monitor          | 38% of critical path        |
| **Bottleneck #2**           | LLM latency (8s)  | ⚠️ Monitor          | 30% of critical path        |
| **Safety Margin (timeout)** | 33s @ p95         | ✅ Adequate         | Allows for jitter + retries |
| **Daily Budget (20 files)** | $60               | ✅ Under $250 limit | Comfortable headroom        |
| **Scaling Ceiling**         | 100 files/day     | ⚠️ Hard Limit       | Async queue required beyond |
| **Release Readiness**       | **CONDITIONAL**   | ⚠️ Ready iff        | Quick wins + test pass      |

---

## 11. Decision Log

**Decision: Google Document AI vs. Tesseract**

- **Selected:** Google Document AI (OCR provider for MVP)
- **Rationale:** Higher accuracy (95%+ vs. 75%), tolerates poor-quality scans, aligns with extraction LLM quality bar
- **Trade-off:** +$3/file cost vs. better demo quality

**Decision: GPT-4 Turbo vs. GPT-3.5**

- **Selected:** GPT-4 Turbo (LLM provider for MVP)
- **Rationale:** 80% field extraction accuracy critical for demo; cost $0.02/file acceptable
- **Fallback:** Implement GPT-3.5 auto-fallback if cost overruns

**Decision: Synchronous vs. Async**

- **Selected:** Synchronous (60s SLO) for MVP
- **Rationale:** Fits Next.js request/response model; user feedback loop for demo
- **Escalation:** Switch to async (Bull queue) if >100 files/day consistently

**Decision: Caching Strategy**

- **Selected:** None for MVP
- **Rationale:** 20-file test run; OCR deduplication unlikely; Phase B priority if high-duplicate volume observed
- **Cost Impact:** Skip $30 in cache infrastructure; accept $60 OCR cost for 20 files

---

_End of Performance & Cost Plan. Ready for implementation review._

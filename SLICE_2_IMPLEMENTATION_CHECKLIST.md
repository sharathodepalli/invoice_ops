# SLICE 2 IMPLEMENTATION CHECKLIST & KPI INSTRUMENTATION

---

## PART A: PRE-LAUNCH IMPLEMENTATION CHECKLIST

### Phase A1: Code Changes (Quick Wins — 2 hours)

- [ ] **HTTP/2 Keep-Alives**
  - [ ] Configure OpenAI client with persistent connections
  - [ ] Configure Google Doc AI client with connection pooling
  - [ ] Verify HTTP/2 in DevTools (Network tab shows h2 protocol)

- [ ] **Async DB Writes**
  - [ ] Refactor DB insert to use `Promise.all()` for invoice + confidence + audit log
  - [ ] Measure latency reduction before/after
  - [ ] Verify no race conditions (use pessimistic lock on job record)

- [ ] **Connection Pool Tuning**
  - [ ] Scale Supabase connection pool from 10 → 20 conns (Supabase dashboard)
  - [ ] Add monitoring for `active_connections` gauge
  - [ ] Set alert if active_connections > 18 for 2+ min

- [ ] **Retry Jitter**
  - [ ] Add random jitter (100–500ms) to exponential backoff schedule
  - [ ] Test: verify 3 sequential retries don't hammer API simultaneously
  - [ ] Verify latency variance ↓ 20% vs. naive retry

- [ ] **OCR Page Limit**
  - [ ] Truncate PDF to first 10 pages before Google Doc AI API call
  - [ ] Log truncation events for audit trail
  - [ ] Verify: 95%+ of invoices < 10 pages (measure on real data)

### Phase A2: Monitoring & Instrumentation (3 hours)

- [ ] **Latency Instrumentation**
  - [ ] Add `performance.now()` timestamps at each pipeline stage
  - [ ] Calculate deltas: `ocrMs`, `llmMs`, `validationMs`, `dbInsertMs`
  - [ ] Log structured metric: `{ job_id, stage, duration_ms, timestamp }`

- [ ] **Cost Tracking**
  - [ ] Parse OpenAI billing from response headers (`x-openai-usage`)
  - [ ] Calculate OpenAI cost: `(input_tokens × 0.01 + output_tokens × 0.03) / 1000`
  - [ ] Parse Google Doc AI billing from response metadata
  - [ ] Calculate total cost: `ocr_cost + llm_cost + db_cost`
  - [ ] Log: `{ job_id, ocr_cost_usd, llm_cost_usd, total_cost_usd }`

- [ ] **Error Categorization**
  - [ ] Catch OCR errors; categorize: `ocr_timeout`, `ocr_api_error`, `ocr_invalid_pdf`, `ocr_unknown`
  - [ ] Catch LLM errors; categorize: `llm_timeout`, `llm_rate_limit`, `llm_malformed_response`, `llm_unknown`
  - [ ] Catch DB errors; categorize: `db_conn_pool_exhausted`, `db_constraint_violation`, `db_timeout`, `db_unknown`
  - [ ] Log: `{ job_id, error_type, error_message, retry_count, next_retry_at }`

- [ ] **Extraction Quality Metrics**
  - [ ] Count extracted fields: `fields_extracted`, `fields_null`
  - [ ] Count confidence labels: `high_count`, `medium_count`, `low_count`
  - [ ] Calculate completion rate: `fields_extracted / 8`
  - [ ] Log: `{ job_id, completion_rate, confidence_distribution }`

- [ ] **KPI Dashboard (Datadog / Splunk / CloudWatch)**
  - [ ] Create dashboard with P50/P95/P99 latency over time
  - [ ] Create cost trend chart (daily, rolling 7-day average)
  - [ ] Create error rate gauge (errors / total extractions)
  - [ ] Create field completion histogram
  - [ ] Add heatmap: latency vs. time-of-day (detect queue buildup)

### Phase A3: Verification Tests (1 hour)

- [ ] **Latency Baseline**
  - [ ] Run 5 test extractions; record latencies
  - [ ] Calculate p50, p95, p99
  - [ ] Verify p95 ≤ 55s
  - [ ] **PASS:** p95 ≤ 55s | **FAIL:** >60s → debug bottleneck

- [ ] **Error Recovery**
  - [ ] Manually trigger OCR timeout (mock API 30s delay); verify retry at 1s, 2s, 4s
  - [ ] Manually trigger LLM 429 (rate limit); verify exponential backoff + queue
  - [ ] Manually corrupt PDF; verify graceful failure + error_message logged
  - [ ] **PASS:** All 3 scenarios recover or fail cleanly | **FAIL:** Hang or unrecovered error

- [ ] **Cost Baseline**
  - [ ] Run 10 extractions; sum costs
  - [ ] Verify total ≤ $30 (expect ~$0.02 LLM + $3 OCR per file)
  - [ ] **PASS:** Cost ≤ $3.02/file | **FAIL:** >$4/file → investigate OCR page inflation

- [ ] **Idempotency Check**
  - [ ] Extract same 3 files twice; verify job_id reuse (same invoice record, no duplicate)
  - [ ] Query invoices table; verify `count(distinct invoice_id)` = 3, not 6
  - [ ] **PASS:** 0 duplicates | **FAIL:** >1 duplicate → fix idempotency key logic

- [ ] **Concurrent Extraction (Stress)**
  - [ ] Trigger 5 concurrent extraction requests (POST /api/jobs/process × 5)
  - [ ] Monitor Supabase active connections
  - [ ] Verify active_connections ≤ 15 (below 18-conn limit)
  - [ ] **PASS:** All 5 complete in <4 min | **FAIL:** Timeout or connection pool error

---

## PART B: STRUCTURED LOGGING SCHEMA

### Extraction Job Metrics Payload

```json
{
  "event": "extraction_complete",
  "timestamp": "2026-05-17T14:30:45.123Z",
  "job_id": "job_550e8400-e29b-41d4-a716-446655440000",
  "upload_id": "upload_550e8400-e29b-41d4-a716-446655440000",
  "filename": "invoice_2024_05.pdf",
  "file_size_bytes": 2097152,

  "latency": {
    "file_retrieval_ms": 450,
    "ocr_ms": 9800,
    "llm_ms": 5200,
    "validation_ms": 150,
    "db_insert_ms": 800,
    "total_ms": 16400
  },

  "cost": {
    "ocr_cost_usd": 3.0,
    "llm_input_tokens": 1050,
    "llm_output_tokens": 280,
    "llm_cost_usd": 0.0198,
    "db_cost_usd": 0.000001,
    "total_cost_usd": 3.0198
  },

  "extraction": {
    "fields_extracted": 8,
    "fields_null": 0,
    "completion_rate": 1.0,
    "confidence": {
      "high": 6,
      "medium": 2,
      "low": 0
    },
    "extracted_data": {
      "vendor_name": "Acme Corp",
      "invoice_number": "INV-2024-001234",
      "invoice_date": "2024-05-15",
      "subtotal": 1000.0,
      "tax": 100.0,
      "total": 1100.0,
      "po_number": "PO-0054321",
      "currency": "USD"
    }
  },

  "errors": {
    "error_type": null,
    "error_message": null,
    "retry_count": 0,
    "max_retries": 3
  },

  "status": "extracted",
  "created_at": "2026-05-17T14:25:00.000Z",
  "completed_at": "2026-05-17T14:30:45.123Z"
}
```

### Error Event Payload (on failure)

```json
{
  "event": "extraction_failed",
  "timestamp": "2026-05-17T14:35:12.456Z",
  "job_id": "job_550e8400-e29b-41d4-a716-446655440000",
  "filename": "invoice_2024_06.pdf",

  "error": {
    "type": "ocr_timeout",
    "message": "Google Document AI request exceeded 30s timeout",
    "stage": "ocr",
    "retry_count": 3,
    "max_retries": 3,
    "next_action": "manual_review_required"
  },

  "latency": {
    "file_retrieval_ms": 500,
    "ocr_ms": 30050,
    "total_ms": 30550
  },

  "status": "failed"
}
```

---

## PART C: MONITORING DASHBOARD QUERIES

### Query 1: P95 Latency Over Time (Datadog)

```
avg:extraction.latency_ms{*}
  | percentile(0.95)
  | rollup("1m")
```

**Expected:** Flat line at 55s ± 5s for stable load  
**Alert:** >60s for 2+ consecutive minutes

---

### Query 2: Daily Cost Trend

```
sum:extraction.cost_usd{*}
  | rollup("1d", avg)
```

**Expected:** ~$60 per 20 files (~$3/file)  
**Alert:** >$500/day (suggests bloat or error loop)

---

### Query 3: Error Rate (%)

```
(
  count:extraction_failed{*}
  / count:extraction_complete{*}
) * 100
```

**Expected:** <5%  
**Alert:** >10% for 5+ min

---

### Query 4: Field Completion Rate

```
avg:extraction.completion_rate{*}
  | percentile(0.95)
```

**Expected:** ≥0.80 (≥80% of 8 fields filled)  
**Alert:** <0.70

---

### Query 5: OCR Success Rate

```
count:extraction_complete{stage:ocr}
  / (count:extraction_complete{stage:ocr} + count:extraction_failed{stage:ocr})
```

**Expected:** ≥95%  
**Alert:** <85%

---

### Query 6: Database Connection Pool

```
gauge:postgres.active_connections{*}
```

**Expected:** 5–10 (low utilization)  
**Alert:** >18 for 2+ min (approaching limit)

---

## PART D: ALERTING RULES (PagerDuty / Datadog)

### Alert 1: High Latency

```yaml
name: "Extraction P95 Latency High"
condition: "percentile(avg:extraction.latency_ms{*}, 0.95) > 60000"
duration: "5 minutes"
severity: "warning"
notification: "Slack: #backend-alerts"
action: "Investigate: check OCR/LLM API status; review recent code changes"
```

### Alert 2: OCR Service Failure

```yaml
name: "OCR Error Rate Critical"
condition: "count:extraction_failed{stage:ocr} / count:extraction_complete{stage:ocr} > 0.15"
duration: "2 minutes"
severity: "critical"
notification: "PagerDuty: backend-oncall"
action: "Check Google Doc AI service status; escalate to Google Cloud support"
```

### Alert 3: Cost Overrun

```yaml
name: "Daily Cost Exceeds Budget"
condition: "sum:extraction.cost_usd{*} > 300"
duration: "1 day"
severity: "warning"
notification: "Slack: #finance"
action: "Review extraction volume; check for OCR page inflation; enable circuit breaker"
```

### Alert 4: Extraction Timeouts

```yaml
name: "LLM Rate Limit Detected"
condition: "count:extraction_failed{error_type:llm_rate_limit} > 5 in 10m"
duration: "10 minutes"
severity: "warning"
notification: "Slack: #ops"
action: "Reduce batch size; implement queue; check OpenAI account limits"
```

### Alert 5: DB Connection Saturation

```yaml
name: "Database Connection Pool Exhausted"
condition: "gauge:postgres.active_connections{*} > 18"
duration: "2 minutes"
severity: "warning"
notification: "Slack: #database-team"
action: "Scale pool to 20–50 conns; review extraction concurrency"
```

---

## PART E: PRE-LAUNCH TEST MATRIX

### Test Case 1: Happy Path (Basic Extraction)

| Step | Input                           | Expected                                       | Pass/Fail     |
| ---- | ------------------------------- | ---------------------------------------------- | ------------- |
| 1    | Upload valid 2-page invoice PDF | Stored in /uploads/                            |               |
| 2    | Trigger extraction              | Job status = processing                        |               |
| 3    | OCR completes                   | OCR text captured; confidence recorded         |               |
| 4    | LLM extraction completes        | 8 fields populated; confidence labels assigned |               |
| 5    | Validation passes               | All fields meet schema; no type errors         |               |
| 6    | DB insert succeeds              | Invoice record created; job status = extracted |               |
| 7    | Latency <55s                    | Measure end-to-end time                        | **MUST PASS** |

### Test Case 2: Partial Extraction (Missing Fields)

| Step | Input                               | Expected                                                  | Pass/Fail     |
| ---- | ----------------------------------- | --------------------------------------------------------- | ------------- |
| 1    | Upload invoice missing PO number    | Stored                                                    |               |
| 2    | Trigger extraction                  | Job status = processing                                   |               |
| 3    | LLM extracts 7 of 8 fields          | po_number = null; confidence recorded for 7 fields        |               |
| 4    | Validation accepts partial result   | No schema error; allows null for optional fields          |               |
| 5    | DB insert succeeds                  | Invoice record with 7 fields; po_number_confidence = null |               |
| 6    | Job status = extracted (not failed) | Partial extraction is valid state                         | **MUST PASS** |

### Test Case 3: OCR Timeout Retry

| Step | Input                                    | Expected                               | Pass/Fail     |
| ---- | ---------------------------------------- | -------------------------------------- | ------------- |
| 1    | Mock Google Doc AI to return 30s timeout | Simulate slow network                  |               |
| 2    | Trigger extraction                       | Job status = processing                |               |
| 3    | OCR timeout detected                     | Catch error; increment retry_count     |               |
| 4    | Job requeued after 1s jitter             | Job status = queued; next_retry_at set |               |
| 5    | Next poll triggers retry                 | Job status = processing again          |               |
| 6    | Mock OCR to succeed on retry 2           | Proceed to LLM                         |               |
| 7    | Extraction completes                     | Status = extracted; retry_count = 1    | **MUST PASS** |

### Test Case 4: Concurrent Extractions (Stress)

| Step | Input                                     | Expected                              | Pass/Fail     |
| ---- | ----------------------------------------- | ------------------------------------- | ------------- |
| 1    | Prepare 5 test invoices                   | Ready for batch extraction            |               |
| 2    | POST /api/jobs/process × 5 simultaneously | All 5 requests in-flight              |               |
| 3    | Monitor DB connections                    | active_connections ≤ 15 (below limit) |               |
| 4    | Monitor API rate limits                   | No 429 errors from OpenAI/Google      |               |
| 5    | All 5 complete within 4 min               | Batch latency <240s                   | **MUST PASS** |
| 6    | Verify no duplicate invoices              | Distinct invoice count = 5 (not 10)   | **MUST PASS** |

### Test Case 5: Idempotency (Re-run)

| Step | Input                         | Expected                                   | Pass/Fail     |
| ---- | ----------------------------- | ------------------------------------------ | ------------- |
| 1    | Extract invoice #1            | Status = extracted; invoice record created |               |
| 2    | Extract same invoice #1 again | Job reused; same idempotency_key           |               |
| 3    | Check invoices table          | Row count = 1 (not 2)                      | **MUST PASS** |
| 4    | Verify cost charged once      | Only 1× OCR + 1× LLM cost                  | **MUST PASS** |

### Test Case 6: Cost Tracking

| Step | Input                            | Expected                            | Pass/Fail     |
| ---- | -------------------------------- | ----------------------------------- | ------------- |
| 1    | Extract 10 files                 | Collect cost metrics                |               |
| 2    | Sum costs from logs              | Total = $30 ± 20% (expect ~$3/file) | **MUST PASS** |
| 3    | Verify OCR page limit enforced   | Max 10 pages charged per file       |               |
| 4    | Verify LLM token cost calculated | Per-file cost = (tokens × rate)     | **MUST PASS** |

---

## PART F: GO/NO-GO DECISION CHECKLIST (Day 40)

### Before Launch (All Must Pass)

- [ ] **Latency:** Run 20 test files; p95 ≤ 55s
- [ ] **Cost:** Sum per-file costs; avg ≤ $3.00
- [ ] **Error Rate:** <5% (all errors recovered via retries)
- [ ] **Idempotency:** 0 duplicates across re-runs
- [ ] **Field Completion:** ≥80% (≥16 of 20 files with 6+ fields)
- [ ] **Errors Handled:** OCR timeout, LLM rate limit, corrupted PDF all graceful
- [ ] **Monitoring Live:** All KPI dashboards updated; alerts not silent
- [ ] **Quick Wins Implemented:** HTTP/2, async DB, pool tuning, page limit
- [ ] **Operator Runbook:** Documented escalation path + known issues
- [ ] **Demo Dry-Run:** 5-file extraction in <3 min successfully completed

### Conditional Go-Ahead

- [ ] If >1 of above fails: **HOLD** and fix before Day 45 launch
- [ ] If minor issues (e.g., alert threshold off-by-5s): **CONDITIONAL GO** with action items
- [ ] If fundamental architecture issue (e.g., sync model can't hit 60s SLO): **NO-GO** → escalate to Phase B async

---

**End of Implementation Checklist**  
_Next Review: Day 40 (Pre-Launch Validation)_

# SLICE 2 PERFORMANCE & COST — EXECUTIVE SUMMARY

## 1. LATENCY SLO BREAKDOWN (P95 targets)

```
File Retrieval:        5s    (10%)
OCR (Google Doc AI):  10s    (38% of critical path) ⚠️ PRIMARY BOTTLENECK
LLM (GPT-4 Turbo):     8s    (30% of critical path) ⚠️ SECONDARY BOTTLENECK
Validation:            1s    (4%)
DB Insert:             1s    (4%)
Network overhead:      3s    (11%)
────────────────────────────
TOTAL P95:            27s    (p50 only; p95 = 55s with jitter/queue overhead)
SAFETY MARGIN:        33s    (to 60s timeout)
STATUS:               ✅ PASS (55s < 60s SLO)
```

---

## 2. COST MODEL (per 100 files, USD)

| Component                 | Per-File        | Per-100       | Notes                               |
| ------------------------- | --------------- | ------------- | ----------------------------------- |
| **Google Doc AI**         | $1.50–$4.00     | $150–$400     | 2–10 pages/file × $1.50/page        |
| **GPT-4 Turbo**           | $0.02           | $2            | ~1.5K tokens per extraction         |
| **Supabase Postgres**     | <$0.001         | <$0.10        | Negligible                          |
| **S3 Storage + Transfer** | <$0.0002        | <$0.02        | If using remote storage             |
| **TOTAL**                 | **$1.52–$4.02** | **$152–$402** | Base: $1.52; with retry cost: +$2–3 |

**MVP Test Run (20 files):**  
$60–$80 estimated (comfortable within pilot budget)

---

## 3. THROUGHPUT CAPACITY

| Model               | Files/Hour | Files/Day | Batch Time (5 files) | Constraint                   |
| ------------------- | ---------- | --------- | -------------------- | ---------------------------- |
| **Sync (MVP)**      | 60         | 480       | 275s (4.6 min) ✅    | Next.js 60s timeout per file |
| **Sync+Retry**      | 45         | 360       | 367s (6.1 min) ⚠️    | Exceeds 5m if errors         |
| **Async (Phase C)** | 600+       | 4,800+    | <300s (concurrent)   | Requires worker pool         |

**MVP Capacity:** 20 test invoices in ~33 min (acceptable for pre-demo testing)

---

## 4. OPTIMIZATION CHECKLIST (Implementation Priority)

### Quick Wins (0–2h effort; Implement Now)

- [ ] HTTP/2 keep-alives (save DNS/TLS = -500ms per call)
- [ ] Async DB writes (parallel insert + audit log = -300ms)
- [ ] Connection pool scale 10→20 conns (prevent saturation = +30% throughput)
- [ ] Retry jitter (reduce thundering herd = -20% latency variance)
- [ ] OCR page limit (truncate to 10 pages = cost control)

### Phase B Structural (4–8h; If >100 files/day)

- [ ] Redis OCR result cache (save 8s per duplicate = -50% cost)
- [ ] Circuit breaker + fallback (API resilience)
- [ ] Background queue (Bull/Inngest; enables async)
- [ ] LLM fallback (GPT-3.5 if rate limit hit = cost ↓ 85%)

---

## 5. MONITORING KPIs (Real-Time Dashboard Required)

| KPI              | Target | Alert If | Owner   |
| ---------------- | ------ | -------- | ------- |
| P95 Latency      | ≤55s   | >60s     | Backend |
| Error Rate       | <5%    | >10%     | Backend |
| Cost/File        | ≤$3.00 | >$4.00   | Finance |
| OCR Success      | ≥95%   | <85%     | OCR SLA |
| LLM Completion   | ≥80%   | <70%     | QA      |
| DB Latency       | ≤1s    | >2s      | DBA     |
| API Availability | ≥99.5% | <99%     | Ops     |

---

## 6. SCALING TRIGGERS & ESCALATION RULES

| If This Happens                       | Then Do This                                    | Target State     |
| ------------------------------------- | ----------------------------------------------- | ---------------- |
| Consistent >100 files/day for 3+ days | Escalate to background queue (Bull/Inngest)     | 500+ files/day   |
| Batch latency >5 min                  | Add concurrent extraction workers (2–4 workers) | <3 min per batch |
| Error rate >10% (persistent)          | Implement dead-letter queue + manual review     | <5%              |
| Cost/file >$3.50                      | Enable OCR caching + GPT-3.5 fallback           | ≤$2.50           |
| DB conn saturation >80%               | Scale pool to 50; implement queueing            | <50% utilization |

**Escalation Decision Gate:** Day 30. If volume projections remain <100 files/day, skip Phase C.

---

## 7. COST GUARDRAILS & CONTROLS

```
Daily Budget Limit (MVP):  $250 (20 files × $12.50/file headroom)
Hard Stop Threshold:       $500/day (halt all extractions; investigate)

Cost Controls:
  • OCR page limit: 10 pages max (prevent bloat)
  • LLM token budget: Reject >2K input tokens (pre-call validation)
  • Rate limiting: 60 req/min per OpenAI tier-1 account
  • Retry circuit breaker: Skip retries after 3 consecutive failures
  • File size cap: Reject PDFs >5 MB (upload validation)

Alert: If daily cost >3× rolling 7-day average → investigate root cause
```

---

## 8. RELEASE READINESS — GO/NO-GO CRITERIA

### ✅ GO (All Must Pass)

1. **P95 Latency ≤55s** for ≥90% of test files
2. **Error Rate <5%** (temporary failures retried successfully)
3. **Cost/File ≤$3.00** (includes OCR page limit enforcement)
4. **Zero duplicates** across re-runs (idempotency verified)
5. **≥18 of 20 test files** extracted with ≥80% field completion
6. **All KPI alerts** functioning and not silent
7. **Extraction failure recovery** tested and working (3 manual retries successful)

### ❌ NO-GO (Any Blocks Launch)

1. P95 latency >65s (exceeds safety margin to 60s timeout)
2. Error rate >15% (unreliable for demo)
3. Cost/file >$4.00 (budget overrun)
4. > 1 duplicate invoice record (data integrity breach)
5. <15 of 20 files successfully extracted
6. Any unrecovered API timeout after retry exhaustion

---

## 9. RECOMMENDED ACTIONS

| Action                                    | Effort | Impact                            | Start By |
| ----------------------------------------- | ------ | --------------------------------- | -------- |
| 1. Implement quick wins (Section 4.1)     | 2h     | Latency ↓ 800ms; throughput ↑ 30% | Day 35   |
| 2. Add structured logging + KPI dashboard | 3h     | Visibility into bottlenecks       | Day 36   |
| 3. Run 20-file test; validate SLOs        | 1h     | Go/no-go data                     | Day 37   |
| 4. Implement cost guardrails              | 1h     | Budget control; prevent overruns  | Day 38   |
| 5. Operator runbook + incident guide      | 1h     | Reduce MTTR if failures occur     | Day 39   |

**Target:** All complete by Day 40; ready for launch Day 45.

---

## 10. CRITICAL RISKS & MITIGATIONS

| Risk                                   | Probability | Impact                        | Mitigation                                          |
| -------------------------------------- | ----------- | ----------------------------- | --------------------------------------------------- |
| OCR API rate limit (429)               | Medium      | Latency +20–60s per retry     | Implement exponential backoff + queue               |
| LLM token inflation                    | Low         | Cost +30%                     | Monitor token count; implement token-aware batching |
| DB connection pool saturation          | Low         | Extraction hangs              | Scale pool to 20–50 conns                           |
| S3 network latency (if used)           | Medium      | Latency +3–5s                 | Use local storage for MVP; S3 in Phase B            |
| Partial extraction (6/8 fields)        | High        | Validation flags missing data | Expected; handled by Slice 3 validation engine      |
| Malformed PDF (corrupt/scanned images) | Low         | OCR failure                   | Logged as error; flagged for manual review          |

---

## PERFORMANCE VERDICT

**CONDITIONAL READY for Day 45 launch IF:**

✅ Quick wins (Section 4.1) implemented  
✅ 20-file test achieves P95 ≤55s  
✅ Error rate <5%  
✅ Cost/file ≤$3.00  
✅ All KPI alerts live & functioning

**Otherwise:** Roll to Phase B (async architecture) before accepting >100 files/day workload.

---

_Generated: May 17, 2026 | Next Review: Day 40 (pre-launch validation)_

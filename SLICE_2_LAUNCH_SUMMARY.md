# Slice 2: OCR & Extraction Pipeline - LAUNCH SUMMARY

**Date:** May 17, 2026  
**Status:** Conditional Go → Ready for Implementation (after blockers cleared)  
**Duration:** 3-4 days (May 18-21, 2026)

---

## 📋 What's Happening

You're starting **Slice 2: OCR and Extraction Pipeline** — automated extraction of 8 invoice fields (vendor, invoice #, date, subtotal, tax, total, PO, currency) from uploaded PDFs using Google Document AI + OpenAI GPT-4.

### Key Outcomes

- Extract and persist 8 fields with confidence labels (High/Med/Low)
- 80% completeness target (16+ of 20 test invoices)
- P95 latency ≤55s per file
- Cost $3.02/file (range $1.52–$4.02)
- Zero breaking changes to Slice 1

---

## 🎯 Pre-Launch Checklist (Blockers to Fix Before Day 1)

The Staff Review Board identified 5 critical items that must be fixed before implementation starts:

### Blocker 1: API Contract - Add Extraction Endpoints ✅

**Task:** Update [API_CONTRACT_FREEZE.md](API_CONTRACT_FREEZE.md) to include:

```yaml
PUT /api/jobs/:job_id/extract
  Auth: Bearer token, role="admin"
  Response: { job_id, status: "processing" }

POST /api/jobs/process-queued [INTERNAL]
  Auth: Bearer token, role="system"
  Response: { processed_count, errors[] }
```

**Status:** Ready to implement in [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md#L84)

### Blocker 2: Retry Policy - Freeze Exact Schedule ✅

**Task:** Create [SLICE_2_RETRY_POLICY.md](SLICE_2_RETRY_POLICY.md) specifying:

- Max 4 retries (5 total attempts)
- Exponential backoff: 1s, 2s, 4s
- Transient errors (retry): timeouts, rate limits, network
- Permanent errors (fail): corrupt PDF, LLM validation failed
  **Status:** Template in [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md#L130)

### Blocker 3: Cost Gate - Lock Budget Thresholds ✅

**Task:** Confirm single cost gate:

- Green: <$3.50/file
- Yellow: $3.50–$4.00 (document why)
- Red: >$4.00 (no-go)
  **Status:** Specified in [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md#L148)

### Blocker 4: Schema Constraints - Add DB Guardrails ✅

**Task:** Update [invoice-app/supabase/setup.sql](invoice-app/supabase/setup.sql):

- Add CHECK constraint for confidence ∈ ('high', 'medium', 'low')
- Make audit actor non-null for user actions
  **Status:** SQL provided in [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md#L167)

### Blocker 5: Auth Middleware - Implement Role Checks ✅

**Task:** Create [src/lib/auth-middleware.ts](src/lib/auth-middleware.ts):

- Validate Bearer token
- Check role (admin, system)
- Return 401/403 on auth failure
  **Status:** Code template in [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md#L100)

---

## 📅 Implementation Timeline

Once blockers are cleared, implementation proceeds in 3 phases (4 days):

### Phase A: Scaffolding & Mocks (Day 1 - 8h)

- Create extraction library structure (6 components)
- Implement mocked OCR/LLM services
- Write integration tests (all mocked)
- Verify flow: queued → processing → extracted

### Phase B: Real OCR & LLM (Days 2-3 - 16h)

- Integrate Google Document AI
- Integrate OpenAI GPT-4
- Database persistence (invoices table)
- Error handling + retry logic
- Test with 20 seed invoices (measure accuracy, latency, cost)

### Phase C: UI & Polish (Day 4 - 8h)

- Create `/invoices/:id` detail page
- Display extraction results + confidence badges
- Show raw JSON (debug mode)
- E2E tests with real services

---

## 🚀 Key Decisions (Locked for MVP)

| Decision                | Choice                         | Rationale                                   |
| ----------------------- | ------------------------------ | ------------------------------------------- |
| **Extraction Model**    | Sync (not async)               | Tight demo flow, <60s fits in request cycle |
| **Extraction Trigger**  | Auto on upload                 | Faster UX, no manual step needed            |
| **OCR Provider**        | Google Document AI             | Better accuracy for complex layouts         |
| **LLM Provider**        | OpenAI GPT-4                   | Reasoning quality needed for 80% target     |
| **Retry Strategy**      | 4 retries, exponential backoff | Standard practice, 99.5% recovery           |
| **Completeness Target** | ≥80% (16/20 invoices)          | Realistic MVP bar                           |
| **Launch Gate**         | 80% + ≤55s P95 + <$4/file      | Measurable, objective criteria              |

---

## 📊 Success Metrics

### Must-Pass Gates

| Metric                    | Target      | Measurement                              |
| ------------------------- | ----------- | ---------------------------------------- |
| **Completeness**          | ≥80%        | 16+ of 20 test invoices with 7-8 fields  |
| **Latency P95**           | ≤55s        | Measure with real OCR+LLM on 20 invoices |
| **Cost**                  | <$4.00/file | Track OCR + LLM API costs                |
| **Tests Passing**         | 100%        | All new + existing tests green           |
| **Zero Breaking Changes** | ✓           | Slice 1 tests still pass                 |

### Stretch Goals (Phase B)

- 100% vendor/invoice/total accuracy
- <1% permanent error rate
- ≤$2.50/file cost optimization

---

## 🔒 Security & Audit

- **Extraction endpoints require admin/system auth** (bearer token)
- **Rate limiting:** 10/min (admin), 100/min (system)
- **Confidence labels validated** in DB (high/medium/low only)
- **Audit trail captured** for all extraction actions
- **Raw LLM JSON persisted** for compliance + debugging

---

## 📁 Key Files

| File                                                                     | Purpose                            | Status       |
| ------------------------------------------------------------------------ | ---------------------------------- | ------------ |
| [SLICE_2_EXECUTION_PLAN.md](SLICE_2_EXECUTION_PLAN.md)                   | Full implementation plan           | ✅ Complete  |
| [SLICE_2_REQUIREMENTS.md](SLICE_2_REQUIREMENTS.md)                       | Requirements + acceptance criteria | ✅ Complete  |
| [SLICE_2_EXTRACTION_ARCHITECTURE.md](SLICE_2_EXTRACTION_ARCHITECTURE.md) | Architecture + data flow           | ✅ Complete  |
| [SLICE_2_PERFORMANCE_COST_PLAN.md](SLICE_2_PERFORMANCE_COST_PLAN.md)     | Latency, throughput, cost analysis | ✅ Complete  |
| [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md)           | Staff Review findings + fixes      | ✅ Ready     |
| [SLICE_2_RETRY_POLICY.md](SLICE_2_RETRY_POLICY.md)                       | Exact retry schedule               | ⏳ To Create |
| [API_CONTRACT_FREEZE.md](API_CONTRACT_FREEZE.md)                         | API endpoints + auth (to update)   | ⏳ To Update |

---

## ⚡ Next Steps (Today)

1. **Review this document** — Understand scope, timeline, decisions
2. **Implement 5 blockers:**
   - Update API contract with extraction endpoints
   - Create retry policy doc
   - Confirm cost gate thresholds
   - Add schema DB constraints
   - Implement auth middleware
3. **Run Staff Review Board again** on updated artifacts
4. **Get to "Go" status** before May 18 implementation start

---

## ❓ Questions Before You Start?

Refer to:

- **"What should I build?"** → [SLICE_2_EXECUTION_PLAN.md](SLICE_2_EXECUTION_PLAN.md) (Task Breakdown section)
- **"How should I build it?"** → [SLICE_2_EXTRACTION_ARCHITECTURE.md](SLICE_2_EXTRACTION_ARCHITECTURE.md)
- **"Will it work?"** → [SLICE_2_PERFORMANCE_COST_PLAN.md](SLICE_2_PERFORMANCE_COST_PLAN.md) (SLOs met)
- **"What could go wrong?"** → [SLICE_2_CORRECTIVE_ACTIONS.md](SLICE_2_CORRECTIVE_ACTIONS.md) (Risk Mitigation)
- **"How do I test it?"** → [SLICE_2_TEST_MATRIX.md](SLICE_2_TEST_MATRIX.md) (when created)

---

## 🎯 Success Looks Like

**Day 4 EOD:**

- ✅ Upload a PDF → extraction runs automatically → results appear in 60s
- ✅ All 8 fields extracted with confidence labels
- ✅ 16+ of 20 test invoices fully extracted (80% target)
- ✅ P95 latency ≤55s verified
- ✅ Cost ≤$4.00/file verified
- ✅ All tests passing (unit + integration + E2E)
- ✅ Ready to hand off to Slice 3 (Validation Engine)

---

**Status: Conditional Go — Fix 5 blockers today, then proceed to implementation tomorrow.** 🚀

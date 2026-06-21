# Invoice/AP Automation - Master Planning Baseline

Status: Plan-first baseline (no implicit assumptions)
Date: 2026-05-17

## 1) Customer Outcome

### Business goals

- Demonstrate a credible, sellable MVP for AP automation.
- Reduce manual data entry and review time for invoice processing.
- Provide auditable approval and export flow for ERP handoff.

### User outcomes

- AP operator can upload single or batch invoices and monitor job status.
- Reviewer can quickly resolve exceptions with clear, actionable reasons.
- Approver can approve/reject with full audit trail.
- Finance can export approved invoices in ERP-ready CSV format.

### Success metrics (MVP)

- End-to-end demo flow works: Upload -> Extract -> Validate -> Exception Review -> Approve/Reject -> Export.
- > = 80% extraction completeness for core fields on sample invoice set.
- 100% approved invoices export without schema errors.
- 100% approval/rejection actions recorded in audit logs.

## 2) Scope, Non-Goals, and Constraints

### MVP scope (in)

- Single and batch PDF upload.
- OCR + LLM field extraction for 8 core fields.
- Confidence scoring (High/Medium/Low).
- Rule-based validation with severity flags.
- Exceptions queue and invoice detail review screen.
- Approve/Reject workflow with audit logging.
- CSV export and export history.

### Non-goals (out)

- Direct ERP integrations.
- Complex multi-level approval workflows.
- Multi-tenant billing/admin.
- Real-time collaboration.

### Constraints

- Architecture should be production-ready but MVP-speed friendly.
- Security and observability must be built in from the start.
- Prefer reversible design choices over heavy upfront complexity.

## 3) Product Requirements

### Personas

- AP Operator: uploads invoices, monitors processing.
- AP Reviewer: resolves validation issues, edits fields.
- AP Approver: final approval/rejection decisions.
- Finance Ops: exports approved data to ERP.

### Functional requirements

1. Upload PDFs (single and batch), with file type and size validation.
2. Create one processing job per file and track status lifecycle.
3. Extract fields:
   - vendor_name
   - invoice_number
   - invoice_date
   - subtotal
   - tax
   - total
   - po_number
   - currency
4. Store extracted values, confidence labels, and source metadata.
5. Validate each invoice with deterministic rules.
6. Show exception queue with status filters and key invoice columns.
7. Show invoice detail with PDF preview and editable fields.
8. Record all edits and approvals/rejections in audit logs.
9. Export approved invoices as ERP-ready CSV.
10. Record export history with exported_at and actor identity.

### Non-functional requirements

- Reliability: idempotent job processing and duplicate-safe retries.
- Security: strict input validation, secret hygiene, least privilege.
- Observability: structured logs and traceable job IDs.
- Performance: responsive list/detail screens and bounded processing latency.
- Accessibility: keyboard navigation and readable contrast.

## 4) End-to-End Workflow and State Model

### Job states

- queued
- processing
- extracted
- validated
- failed

### Invoice states

- pending
- exception
- approved
- rejected
- exported

### Golden path

1. User uploads PDF(s).
2. System creates job(s) and stores file metadata.
3. OCR + extraction pipeline writes extracted fields.
4. Validation engine writes flags.
5. Invoice moves to exception or pending-approval path.
6. Reviewer edits fields if needed.
7. Approver approves/rejects.
8. Approved invoices exported to CSV.

## 5) Architecture Blueprint

### System components

- Web app: Next.js (App Router) UI + API routes.
- Data: Supabase Postgres.
- Storage: local file storage (dev), S3-compatible abstraction.
- Extraction: OCR provider + LLM extractor module.
- Validation: deterministic rules engine.
- Export: CSV service and export ledger.

### Design tradeoffs

- Monolith-first (fast iteration) over microservices (defer complexity).
- Single OCR provider in MVP for speed and reliability.
- Polling updates first, realtime optional post-MVP.
- Strict schema-first data contracts for safer export compatibility.

### Production-proof controls

- Idempotency key per upload/job.
- Retry policy with capped backoff and dead-letter status.
- Structured logs with correlation IDs.
- Fail-safe status transitions to avoid orphaned jobs.

## 6) Data Model and Contracts

### Core tables

- jobs
- invoices
- validation_flags
- audit_logs
- export_records

### Required data quality checks

- Required field presence: vendor_name, invoice_number, total.
- Math check: subtotal + tax ~= total (tolerance 0.01).
- Duplicate candidate check: vendor_name + invoice_number + total.
- Missing PO check.

### API contract list

- POST /api/upload
- GET /api/jobs
- GET /api/invoices
- GET /api/invoices/:id
- PATCH /api/invoices/:id
- POST /api/invoices/:id/approve
- POST /api/invoices/:id/reject
- POST /api/export
- GET /api/export/history

## 7) UX Plan (iOS-level quality target)

### Screens

1. Upload/Jobs
2. Exceptions Queue
3. Invoice Detail
4. Export

### UX quality requirements

- Clear hierarchy and dense-but-readable tables.
- Strong empty/loading/error states.
- Inline field edits with obvious save/cancel model.
- Confidence and severity visual language with accessible color contrast.
- Keyboard-first actions for triage speed.
- Mobile/tablet responsive behavior (no broken flows).

### Micro-interaction requirements

- Staggered loading states for long operations.
- Optimistic UI only where rollback is safe.
- Explicit confirmation for approve/reject and export actions.

## 8) Security and Threat Model Summary

### Top threat categories

- Untrusted file upload abuse.
- Prompt injection via invoice text payloads.
- Data leakage via logs/exports.
- Authorization bypass for approve/reject actions.

### Controls

- MIME/type + extension + size + scanning gate for uploads.
- Extraction prompt boundaries and output schema validation.
- Role-aware endpoint authorization checks.
- Secret management via env only; no hardcoded credentials.
- Audit event on all mutable operations.

## 9) Performance and Cost Plan

### Targets (MVP)

- List/detail pages return within practical interactive latency.
- Extraction pipeline bounded with timeout + retry policy.
- Export operation scales for expected demo volumes.

### Cost controls

- Batch extraction where possible.
- Cache static lookups and reference data.
- Retention policy for uploaded files and logs.
- Monitor token usage and per-document extraction cost.

## 10) QA Strategy and Quality Gates

### Test layers

- Unit: validation rules, confidence mapping, CSV formatter.
- Integration: job pipeline, DB persistence, state transitions.
- API: endpoint contracts, auth checks, error paths.
- E2E: upload->review->approve->export core journey.
- Regression: historical bug scenarios and edge invoices.

### Minimum release gates

- Zero critical test failures in core flow.
- Validation and duplicate checks verified on seed set.
- Audit log correctness verified for edits and decisions.
- Export CSV schema validation passes for approved records.
- Security and performance reviews complete.

## 11) Execution Sequence (2-week slice plan)

### Week 1

1. Planning sign-off + contract freeze.
2. Schema and migrations finalization.
3. Upload/jobs flow implementation.
4. Extraction pipeline implementation.
5. Validation engine implementation.

### Week 2

1. Exceptions queue and detail review flows.
2. Approve/reject + audit trail.
3. CSV export + export history.
4. Hardening: security, performance, observability.
5. Demo data, rehearsal, and release gate review.

## 12) Risks and Mitigations

1. Requirement ambiguity

- Mitigation: maintain explicit decision log and sign-off points.

2. Extraction variance across invoice formats

- Mitigation: fallback heuristics + confidence-driven review path.

3. Duplicate/retry inconsistencies

- Mitigation: idempotency and deterministic dedupe checks.

4. Security/privacy gaps

- Mitigation: endpoint auth checks, log redaction, threat review.

5. Over-scope risk

- Mitigation: strict MVP boundary and deferred backlog list.

## 13) Open Decisions (No-Assumption Register)

These must be confirmed before implementation starts:

1. OCR provider for MVP (single provider choice).
2. File size and batch size limits.
3. Required auth model for internal demo vs external demo.
4. CSV schema exact column ordering for target ERP.
5. Retention period for uploaded PDFs and audit data.
6. Who can approve/reject/export (role policy).
7. Required SLA for processing completion.

## 14) Next-Step Plan (Immediate)

1. Confirm the 7 open decisions in Section 13.
2. Freeze API contracts and DB schema.
3. Finalize test data pack (10-20 sample invoices + edge cases).
4. Begin Slice 1 implementation only after sign-off.

## 15) Definition of Done (Planning Phase)

Planning phase is complete only when:

- Scope, non-goals, and success metrics are signed off.
- Open decisions are resolved and documented.
- Architecture, QA, security, performance, and UX plans are approved.
- Implementation slices and release gates are accepted.

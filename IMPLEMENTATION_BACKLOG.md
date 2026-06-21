# Implementation Backlog - Invoice/AP Automation MVP

Status: Ready after planning sign-off
Source baseline: MASTER_PLAN.md
Date: 2026-05-17

## 1) Delivery Model

- Work mode: thin vertical slices.
- Rule: no slice closes without acceptance checks + tests.
- Final gate: Staff Review Board Go/Conditional Go.

## 2) Milestones

1. M1: Ingestion foundation complete
2. M2: Extraction + validation complete
3. M3: Review + decision workflow complete
4. M4: Export + hardening complete
5. M5: Demo and release gate complete

## 3) Backlog by Slice

## Slice 0 - Decision Lock and Contract Freeze

### Tasks

- Confirm 7 open decisions from MASTER_PLAN Section 13.
- Freeze API contracts and error model.
- Freeze DB schema and migration plan.
- Confirm role policy for approve/reject/export.

### Deliverables

- Approved decision log.
- Frozen API spec document.
- Frozen schema version.

### Acceptance Criteria

- All 7 open decisions marked resolved.
- No unresolved API/schema blockers.
- Sign-off checklist Sections B and C fully checked.

### Test/Validation

- Contract lint/check passes.
- Migration dry run successful.

## Slice 1 - Upload and Job Lifecycle

### Tasks

- Build upload endpoint with PDF type/size checks.
- Support batch uploads.
- Persist file metadata and create one job per file.
- Implement job states: queued -> processing -> extracted -> validated -> failed.
- Add jobs listing API/page with polling updates.

### Deliverables

- Upload API + jobs API.
- Upload UI and jobs dashboard.

### Acceptance Criteria

- User uploads 10 PDFs in one batch.
- 10 jobs are created and visible with valid statuses.
- Invalid file types rejected with clear errors.

### Test/Validation

- Unit: file validator and state transitions.
- API: upload success/failure cases.
- Integration: upload persistence + job creation.
- E2E: upload then see jobs update.

## Slice 2 - OCR and Extraction Pipeline

### Tasks

- Integrate chosen OCR provider.
- Implement extractor for 8 fields with confidence labels.
- Add schema validation for extracted payload.
- Persist extracted fields and raw extraction metadata.
- Add retry with capped backoff for transient failures.

### Deliverables

- Extraction worker/module.
- Extraction persistence layer.

### Acceptance Criteria

- 80%+ core field completeness on seed dataset.
- Failed extraction jobs surface explicit failure reason.
- Confidence values present for each extracted field.

### Test/Validation

- Unit: extraction schema validator, confidence mapping.
- Integration: OCR->extract->persist path.
- Regression: mixed-format invoice fixtures.

## Slice 3 - Validation Engine and Exception Flagging

### Tasks

- Implement deterministic rules:
  - Required fields missing.
  - subtotal + tax ~= total (tolerance 0.01).
  - duplicate candidate detection.
  - missing PO.
- Persist validation_flags with severity + message.
- Derive invoice state from rule outcomes.

### Deliverables

- Validation engine module.
- Validation flag APIs/queries.

### Acceptance Criteria

- Each test invoice receives correct validation outcome.
- Severity levels mapped consistently (critical/warning/info).
- Duplicate check correctly identifies test duplicates.

### Test/Validation

- Unit: each validation rule + tolerance math.
- Integration: extraction-to-validation state change.
- API: invoice includes validation flag payload.

## Slice 4 - Exceptions Queue UI

### Tasks

- Build exceptions queue table with filters:
  - all/pending/exception/approved/rejected.
- Add sort/search and key columns.
- Add status summary cards and loading/empty/error states.
- Add auto-refresh polling.

### Deliverables

- Exceptions queue page.

### Acceptance Criteria

- Reviewer can filter and find exception invoices quickly.
- Table remains usable on desktop and tablet.
- Empty/loading/error states render correctly.

### Test/Validation

- Unit: filter/query state logic.
- E2E: filter transitions + row navigation.
- UX check: keyboard tab/enter access.

## Slice 5 - Invoice Detail, Editing, and Decisions

### Tasks

- Build detail view with split layout: PDF + fields.
- Show confidence badges and validation issues.
- Enable edit/save/cancel for fields.
- Implement approve/reject endpoints and UI actions.
- Capture audit logs for edit and decision actions.

### Deliverables

- Invoice detail page.
- Approve/reject/update APIs.

### Acceptance Criteria

- User can correct fields and save changes.
- Approve/reject transitions invoice state correctly.
- Audit trail captures actor, timestamp, before/after changes.

### Test/Validation

- Unit: change diff/audit payload generation.
- API: approve/reject authorization and status transitions.
- E2E: exception -> edit -> approve path.

## Slice 6 - CSV Export and Export History

### Tasks

- Build export endpoint for approved invoices.
- Implement ERP-ready CSV format and escaping.
- Add selection UI and export action.
- Persist export_records with exported_at and actor.

### Deliverables

- Export page + export history view.
- Export API and formatter module.

### Acceptance Criteria

- Only approved invoices are exportable.
- CSV schema matches approved ordering.
- Export history records every run.

### Test/Validation

- Unit: CSV formatter with edge values (comma, quote, newline).
- Integration: export request -> file generation -> history write.
- E2E: select approved invoices and download CSV.

## Slice 7 - Security, Performance, Observability Hardening

### Tasks

- Add role checks on sensitive endpoints.
- Enforce upload constraints and log redaction.
- Add structured logs + correlation IDs.
- Add performance profiling and bottleneck fixes.
- Define retention and cleanup jobs for files/logs.

### Deliverables

- Security hardening checklist status.
- Performance report with measured baselines.
- Observability dashboard/query guide.

### Acceptance Criteria

- No critical security findings open.
- Key flows meet agreed practical latency targets.
- Every major workflow has traceable logs.

### Test/Validation

- Security tests: authz negative cases, unsafe input cases.
- Performance tests: load/stress/soak on critical endpoints.
- Operational tests: retry/failure/recovery scenarios.

## Slice 8 - Demo Pack and Release Gate

### Tasks

- Finalize realistic seed dataset (10-20 invoices).
- Rehearse 3-minute demo flow.
- Execute full regression run.
- Run Staff Review Board gate and resolve blockers.

### Deliverables

- Demo-ready environment and script.
- Final gate report (Go/Conditional Go/No-Go).

### Acceptance Criteria

- Full golden flow succeeds without manual workaround.
- Review board returns Go or approved Conditional Go.
- Sign-off checklist Sections D and E complete.

### Test/Validation

- Full E2E suite run.
- Manual exploratory pass on exception-heavy invoices.
- Review-gate findings recheck pass.

## 4) Cross-Cutting Work Items

- CI quality checks (lint, typecheck, tests).
- Migration and rollback scripts.
- Environment configuration templates.
- Error taxonomy and user-facing message map.
- Accessibility audit pass.

## 5) Owners and Accountability (Template)

- Product Owner: scope and acceptance sign-off.
- Engineering Lead: implementation and architecture integrity.
- QA Lead: test coverage and release confidence.
- Security Reviewer: threat and control validation.
- UX Owner: interaction quality and usability checks.

## 6) Risk-Driven Priority Rules

1. Critical path features first (upload->review->export).
2. High-risk unknowns first (extraction quality, authz, duplicates).
3. Postpone non-core polish until core flow passes quality gates.

## 7) Definition of Ready (per task)

A task is ready only if:

- Acceptance criteria are explicit and testable.
- Dependencies are identified.
- API/schema impacts are documented.
- Rollback impact is understood.

## 8) Definition of Done (per slice)

A slice is done only if:

- Acceptance criteria met.
- Required tests passed and documented.
- Observability hooks added for new behavior.
- Security and performance implications reviewed.
- No unresolved critical defects.

## 9) Immediate Next 5 Actions

1. Resolve Section 13 open decisions in MASTER_PLAN.md.
2. Freeze CSV schema and endpoint error model.
3. Finalize migration scripts and run dry-run.
4. Start Slice 1 implementation with test scaffolding.
5. Schedule review checkpoints at end of each slice.

# Decision Log - Slice 0

Status: Provisional Approved (build-start defaults)
Date: 2026-05-17

## How to use

- Mark each decision as Approved, Deferred, or Rejected.
- Record owner and date.
- Do not start Slice 1 until all required items are Approved.

## D-001 OCR Provider (MVP)

- Decision: Choose single OCR provider for MVP.
- Options:
  - AWS Textract
  - Azure Document Intelligence
  - Google Document AI
  - Hybrid (defer)
- Decision Selected: Google Document AI (MVP)
- Recommendation: Single provider with best invoice accuracy and stable SDK support.
- Status: Approved (Provisional)
- Owner: Product + Engineering
- Due: Before Slice 1

## D-002 Upload File Size Limit

- Decision: Maximum file size per PDF.
- Options: 10MB, 20MB, 25MB, 50MB
- Decision Selected: 20MB max file size
- Recommendation: 20MB (MVP default)
- Status: Approved (Provisional)
- Owner: Engineering
- Due: Before Slice 1

## D-003 Batch Upload Count Limit

- Decision: Maximum files per batch upload.
- Options: 10, 25, 50, 100
- Decision Selected: 25 files per batch
- Recommendation: 25 (MVP default)
- Status: Approved (Provisional)
- Owner: Product + Engineering
- Due: Before Slice 1

## D-004 Auth Model

- Decision: Access control model for MVP.
- Options:
  - Internal demo mode (single shared user)
  - Role-based auth (operator/reviewer/approver)
  - SSO-backed auth (defer)
- Decision Selected: Role-based auth with internal identities
- Recommendation: Role-based auth with simple internal identities.
- Status: Approved (Provisional)
- Owner: Product + Security
- Due: Before Slice 1

## D-005 CSV Schema and Column Ordering

- Decision: Final CSV schema for ERP import.
- Required columns (proposed):
  - invoice_id
  - vendor_name
  - invoice_number
  - invoice_date
  - subtotal
  - tax
  - total
  - po_number
  - currency
  - status
  - exported_at
- Status: Approved (Provisional)
- Owner: Finance Ops + Product
- Due: Before Slice 6

## D-006 Data Retention Policy

- Decision: Retention for uploaded PDFs, extraction payloads, logs.
- Options:
  - PDFs: 30/90/180 days
  - Audit logs: 1 year / 2 years
  - Export records: 1 year / 2 years
- Decision Selected: PDFs 90 days, audit/export records 2 years
- Recommendation: PDFs 90 days, audit/export records 2 years.
- Status: Approved (Provisional)
- Owner: Product + Security
- Due: Before Slice 7

## D-007 Role Policy for Approve/Reject/Export

- Decision: Which roles can perform sensitive actions.
- Proposed policy:
  - Operator: upload, view jobs
  - Reviewer: edit fields, request info
  - Approver: approve/reject
  - Finance Ops: export approved invoices
- Status: Approved (Provisional)
- Owner: Product + Security
- Due: Before Slice 5

## D-008 Processing SLA Target

- Decision: Target processing completion time per invoice.
- Options: P50 < 20s, P95 < 60s, P99 < 120s
- Decision Selected: P50 < 20s, P95 < 60s, P99 < 120s
- Recommendation: P50 < 20s, P95 < 60s for MVP.
- Status: Approved (Provisional)
- Owner: Engineering
- Due: Before Slice 2

## Approval Summary

Note: These are build-start provisional approvals to unblock Slice 1. Final business sign-off can override values before production release.

- Product Owner: **\*\*\*\***\_\_**\*\*\*\*** Date: \***\*\_\_\*\***
- Engineering Lead: **\*\***\_\_\_**\*\*** Date: \***\*\_\_\*\***
- QA Lead: ****\*\*****\_\_\_\_****\*\***** Date: \***\*\_\_\*\***
- Security Reviewer: **\*\***\_\_\_**\*\*** Date: \***\*\_\_\*\***

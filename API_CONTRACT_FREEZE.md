# API Contract Freeze - MVP v1

Status: Frozen for Build Start (Provisional)
Version: v1.0
Date: 2026-05-17

## Conventions

- Content-Type: application/json
- Timestamp format: ISO-8601 UTC
- Currency amounts: decimal string or number with 2 decimals
- Error envelope:
  - error.code
  - error.message
  - error.details (optional)
  - request_id

## 1) POST /api/upload

Purpose: Upload one or more PDF invoices and create jobs.

Request (multipart/form-data)

- files[]: PDF file(s)
- uploaded_by: string (optional for demo mode)

Response 201

- upload_id: string
- jobs: array of
  - job_id: string
  - filename: string
  - status: queued

Errors

- 400 invalid_file_type
- 400 file_too_large
- 400 batch_limit_exceeded
- 500 upload_failed

## 2) GET /api/jobs

Purpose: List processing jobs.

Query params

- status: queued|processing|extracted|validated|failed (optional)
- limit: number (optional)
- cursor: string (optional)

Response 200

- jobs: array
  - job_id
  - filename
  - status
  - created_at
  - updated_at
  - error_message (nullable)
- next_cursor (nullable)

## 3) PUT /api/jobs/:job_id/extract

Purpose: Trigger invoice extraction for a queued job.

Authorization

- Bearer token required
- Role: admin

Request

- No body

Response 202

- job_id
- status: processing

Errors

- 401 unauthorized
- 403 forbidden
- 404 job_not_found
- 409 job_already_processing
- 429 rate_limited

## 4) POST /api/jobs/process-queued

Purpose: Internal worker entrypoint for queued extraction jobs.

Authorization

- Bearer token required
- Role: system

Request

- No body

Response 200

- processed_count
- errors: array of
  - job_id
  - error_code
  - message

Errors

- 401 unauthorized
- 403 forbidden
- 429 rate_limited

## 5) GET /api/invoices

Purpose: List invoices with filters for queue views.

Query params

- status: pending|exception|approved|rejected|exported (optional)
- search: string (optional)
- limit: number (optional)
- cursor: string (optional)

Response 200

- invoices: array
  - id
  - status
  - vendor_name
  - invoice_number
  - invoice_date
  - total
  - currency
  - has_flags: boolean
  - created_at
- next_cursor (nullable)

## 6) GET /api/invoices/:id

Purpose: Fetch invoice detail including flags and confidence.

Response 200

- invoice:
  - id
  - status
  - fields:
    - vendor_name: { value, confidence }
    - invoice_number: { value, confidence }
    - invoice_date: { value, confidence }
    - subtotal: { value, confidence }
    - tax: { value, confidence }
    - total: { value, confidence }
    - po_number: { value, confidence }
    - currency: { value, confidence }
  - pdf_url
  - validation_flags: array
    - type
    - severity
    - field
    - message
  - audit_summary:
    - last_action
    - last_actor
    - last_updated_at

Errors

- 404 invoice_not_found

## 7) PATCH /api/invoices/:id

Purpose: Update editable invoice fields.

Request

- updates:
  - vendor_name?
  - invoice_number?
  - invoice_date?
  - subtotal?
  - tax?
  - total?
  - po_number?
  - currency?
- actor: string
- comment: string (optional)

Response 200

- invoice_id
- status
- updated_fields: string[]
- audit_log_id

Errors

- 400 invalid_field_value
- 403 forbidden
- 404 invoice_not_found

## 8) POST /api/invoices/:id/approve

Purpose: Approve an invoice.

Request

- actor: string
- comment: string (optional)

Response 200

- invoice_id
- status: approved
- approved_at
- audit_log_id

Errors

- 403 forbidden
- 409 invalid_state_transition

## 9) POST /api/invoices/:id/reject

Purpose: Reject an invoice.

Request

- actor: string
- reason: string

Response 200

- invoice_id
- status: rejected
- rejected_at
- audit_log_id

Errors

- 400 missing_reason
- 403 forbidden
- 409 invalid_state_transition

## 10) POST /api/export

Purpose: Export approved invoices to CSV.

Request

- invoice_ids: string[] (optional; if omitted export all approved not yet exported)
- actor: string

Response 200

- export_id
- file_name
- record_count
- exported_at
- download_url

Errors

- 400 no_approved_invoices
- 403 forbidden
- 500 export_failed

## 11) GET /api/export/history

Purpose: Fetch export ledger.

Response 200

- exports: array
  - export_id
  - file_name
  - record_count
  - exported_by
  - exported_at

## Authorization Matrix (Draft)

- Operator: upload, jobs, invoice read
- Reviewer: invoice update, invoice read
- Approver: approve/reject
- Finance Ops: export, export history
- Admin: extraction trigger, invoice read, jobs read
- System: internal queued-processing only

## State Transition Rules

- pending -> exception (if flags present)
- pending|exception -> approved
- pending|exception -> rejected
- approved -> exported
- exported is terminal for export lifecycle

## Freeze Conditions

Contract is considered frozen when:

1. Product + Engineering + QA approve this file.
2. Endpoint names and payload fields stop changing.
3. Error codes are finalized.

## Freeze Record

- Freeze date: 2026-05-17
- Freeze type: Provisional build-start freeze
- Change policy: Any breaking change requires a version bump (v1.x -> v2.0)

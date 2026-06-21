# Slice 1 Execution Plan - Upload and Job Lifecycle

Status: Ready to execute
Date: 2026-05-17
Depends on: DECISION_LOG.md, API_CONTRACT_FREEZE.md, SCHEMA_FREEZE.md

## Goal

Implement upload + job lifecycle so users can upload single/batch PDFs and monitor processing status.

## Scope

- POST /api/upload
- GET /api/jobs
- Upload UI flow
- Jobs dashboard with polling updates
- File validation and basic idempotency handling

## Work Breakdown

### 1) Data and storage plumbing

- Implement file storage adapter (local dev mode).
- Persist file metadata in jobs table.
- Generate idempotency key per upload request.

### 2) Upload API

- Accept multipart form with files[].
- Enforce PDF type and 20MB max file size.
- Enforce batch max 25 files.
- Create one job per accepted file with queued status.
- Return upload_id + jobs[] response contract.

### 3) Job lifecycle handler

- Introduce state transitions:
  - queued -> processing -> extracted -> validated
  - - -> failed on unrecoverable errors
- Ensure status updates persist with updated_at.

### 4) Jobs listing API

- Implement query filters for status, limit, cursor.
- Return paginated jobs list with error_message field.

### 5) UI implementation

- Upload page: drag/drop and browse, validation messages.
- Jobs page: table view + status badges + polling refresh.
- Handle loading/empty/error states.

### 6) Reliability and observability

- Add request_id and correlation id to logs.
- Log upload acceptance/rejection reasons.
- Ensure duplicate-safe behavior via idempotency key.

## Acceptance Criteria

1. User can upload 1 PDF and see a queued job.
2. User can upload 10 PDFs in one batch and see 10 jobs.
3. Non-PDF files are rejected with invalid_file_type.
4. Oversize files rejected with file_too_large.
5. Batch >25 rejected with batch_limit_exceeded.
6. Jobs page shows statuses and updates every 10s.
7. Failed jobs show error_message.

## API Response Examples

### POST /api/upload 201

{
"upload_id": "upl_20260517_001",
"jobs": [
{ "job_id": "job_1", "filename": "inv_1.pdf", "status": "queued" }
]
}

### GET /api/jobs 200

{
"jobs": [
{
"job_id": "job_1",
"filename": "inv_1.pdf",
"status": "processing",
"created_at": "2026-05-17T10:00:00Z",
"updated_at": "2026-05-17T10:00:03Z",
"error_message": null
}
],
"next_cursor": null
}

## Out of Scope (Slice 1)

- OCR and extraction logic
- Validation rules and exception flags
- Approve/reject actions
- Export flow

## Done Definition (Slice 1)

- API contracts for upload/jobs implemented and passing tests.
- UI upload/jobs pages functional for core scenarios.
- Test suite for Slice 1 passes (unit + integration + API + E2E smoke).
- Checkpoint added in EXECUTION_TRACKER.md.

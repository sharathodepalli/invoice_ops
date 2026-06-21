# Slice 1 Test Matrix - Upload and Job Lifecycle

Status: Ready
Date: 2026-05-17

## Unit Tests

1. File validator accepts valid PDF mime and extension.
2. File validator rejects non-PDF mime/extension.
3. File validator rejects files > 20MB.
4. Batch validator rejects > 25 files.
5. Job state transition validator blocks invalid transitions.

## Integration Tests

1. Upload persists file metadata and creates one job per file.
2. Upload with mixed valid/invalid files returns expected errors.
3. Jobs query returns correct status filtering.
4. Idempotency key prevents duplicate job creation on retry.

## API Tests

### POST /api/upload

- 201 success with single PDF.
- 201 success with batch PDFs.
- 400 invalid_file_type.
- 400 file_too_large.
- 400 batch_limit_exceeded.
- 500 upload_failed (simulated storage failure).

### GET /api/jobs

- 200 default list.
- 200 filtered by status.
- 200 paginated list with cursor.

## E2E Smoke Tests

1. Upload one PDF -> jobs page shows queued/processing.
2. Upload 10 PDFs -> jobs page shows all entries.
3. Upload invalid type -> error surfaced in UI.
4. Simulated failed job -> error_message visible in jobs table.

## Test Data

- Valid sample PDFs: 10
- Invalid file samples: .png, .txt
- Oversize sample: 21MB pdf fixture

## Exit Criteria

- 100% API tests pass for upload/jobs endpoints.
- 0 critical defects in upload and jobs flow.
- E2E smoke passes on local dev environment.

# Slice 2 Retry Policy v1.0

**Status:** Frozen for implementation
**Scope:** OCR + LLM extraction only

## Goals

- Retry transient extraction failures without exceeding the 60s per-file SLO.
- Keep retry semantics identical across docs, tests, and runtime code.

## Retry Budget

- Maximum attempts: 5 total
- Immediate attempt: 1
- Backoff delays after failure: 1s, 2s, 4s, 8s
- Hard timeout per file: 60s

## Retryable Errors

- OCR timeout
- OCR rate limit
- LLM timeout
- LLM rate limit
- Temporary database connection failure
- Network interruption while retrieving the PDF

## Non-Retryable Errors

- Corrupted or unreadable PDF
- Unsupported file type
- Invalid or missing credentials
- LLM response that fails schema validation after one re-prompt
- Unique constraint violation on a confirmed duplicate invoice

## Execution Rules

- Retry only transient failures.
- Persist the last error message on the job record.
- Mark the job `failed` after the final attempt.
- Do not create duplicate invoice rows during retries.
- Preserve `raw_extraction_json` for the last successful OCR/LLM response if partial data exists.

## Observability

- Log attempt number, delay, and failure class for every retry.
- Emit metrics for `retry_count`, `attempt_duration_ms`, and `final_failure_reason`.
- Alert if retry rate exceeds 10% over a 1-hour window.

## Acceptance Criteria

- The same retry policy is referenced by the architecture, QA plan, and implementation code.
- Unit tests cover transient vs. permanent classification.
- Integration tests verify final failure after 5 attempts.

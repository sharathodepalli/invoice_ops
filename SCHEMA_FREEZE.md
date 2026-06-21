# Schema Freeze - MVP v1

Status: Frozen for Build Start (Provisional)
Version: v1.0
Date: 2026-05-17

## Principles

- Use UUID primary keys.
- Use created_at and updated_at timestamps on all mutable tables.
- Keep status fields explicit and indexed.
- Preserve auditability for all user-impacting changes.

## 1) jobs

Purpose: track upload and processing lifecycle per file.

Columns

- id (uuid, pk)
- filename (text, not null)
- file_size_bytes (bigint, not null)
- file_url (text, not null)
- upload_id (text, nullable)
- status (text, not null) # queued|processing|extracted|validated|failed
- error_message (text, nullable)
- idempotency_key (text, nullable, unique)
- created_by (text, nullable)
- created_at (timestamptz, not null default now())
- updated_at (timestamptz, not null default now())

Indexes

- idx_jobs_status (status)
- idx_jobs_created_at (created_at desc)
- uq_jobs_idempotency_key (idempotency_key)

## 2) invoices

Purpose: canonical invoice record with extracted fields.

Columns

- id (uuid, pk)
- job_id (uuid, not null, fk jobs.id)
- status (text, not null) # pending|exception|approved|rejected|exported
- vendor_name (text, nullable)
- vendor_name_confidence (text, nullable) # high|medium|low
- invoice_number (text, nullable)
- invoice_number_confidence (text, nullable)
- invoice_date (date, nullable)
- invoice_date_confidence (text, nullable)
- subtotal (numeric(14,2), nullable)
- subtotal_confidence (text, nullable)
- tax (numeric(14,2), nullable)
- tax_confidence (text, nullable)
- total (numeric(14,2), nullable)
- total_confidence (text, nullable)
- po_number (text, nullable)
- po_number_confidence (text, nullable)
- currency (text, nullable)
- currency_confidence (text, nullable)
- pdf_url (text, nullable)
- raw_extraction_json (jsonb, nullable)
- approved_at (timestamptz, nullable)
- approved_by (text, nullable)
- rejected_at (timestamptz, nullable)
- rejected_by (text, nullable)
- rejection_reason (text, nullable)
- created_at (timestamptz, not null default now())
- updated_at (timestamptz, not null default now())

Indexes

- idx_invoices_status (status)
- idx_invoices_job_id (job_id)
- idx_invoices_vendor_invoice_total (vendor_name, invoice_number, total)
- idx_invoices_created_at (created_at desc)

## 3) validation_flags

Purpose: store validation outcomes and exception reasons.

Columns

- id (uuid, pk)
- invoice_id (uuid, not null, fk invoices.id)
- type (text, not null) # missing_required|total_mismatch|duplicate_candidate|missing_po|low_confidence
- severity (text, not null) # critical|warning|info
- field (text, nullable)
- message (text, not null)
- details (jsonb, nullable)
- resolved (boolean, not null default false)
- resolved_at (timestamptz, nullable)
- created_at (timestamptz, not null default now())

Indexes

- idx_flags_invoice_id (invoice_id)
- idx_flags_severity (severity)
- idx_flags_resolved (resolved)

## 4) audit_logs

Purpose: append-only trail of user actions.

Columns

- id (uuid, pk)
- invoice_id (uuid, not null, fk invoices.id)
- action (text, not null) # update|approve|reject|request_info|export
- actor_id (text, nullable)
- actor_name (text, nullable)
- field_changes (jsonb, nullable) # { field: { before, after } }
- comment (text, nullable)
- created_at (timestamptz, not null default now())

Indexes

- idx_audit_invoice_id (invoice_id)
- idx_audit_action (action)
- idx_audit_created_at (created_at desc)

## 5) export_records

Purpose: ledger of export operations.

Columns

- id (uuid, pk)
- invoice_ids (jsonb, not null)
- file_name (text, not null)
- record_count (integer, not null)
- exported_by (text, nullable)
- exported_at (timestamptz, not null default now())

Indexes

- idx_exports_exported_at (exported_at desc)

## Constraints and Business Rules

- invoices.job_id must reference an existing job.
- approval and rejection are mutually exclusive terminal decision states.
- exported status only allowed from approved.
- validation flags do not delete; resolve instead.
- audit_logs is append-only.

## Migration Freeze Checklist

- Table names and core columns confirmed.
- Status enum/value sets confirmed.
- Required indexes confirmed.
- Foreign keys and cascade behavior confirmed.
- Rollback SQL validated in dry run.

## Freeze Conditions

Schema is considered frozen when:

1. Product + Engineering + QA approve this file.
2. Migration script version is tagged and checked in.
3. Dry-run migration + rollback both pass.

## Freeze Record

- Freeze date: 2026-05-17
- Freeze type: Provisional build-start freeze
- Change policy: Any schema change requires migration version increment and changelog entry.

-- Invoice/AP MVP schema (v1.0)
-- Based on SCHEMA_FREEZE.md

create extension if not exists "pgcrypto";

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_size_bytes bigint not null,
  file_url text not null,
  upload_id text,
  status text not null check (status in ('queued', 'processing', 'extracted', 'validated', 'failed')),
  error_message text,
  idempotency_key text unique,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  status text not null check (status in ('pending', 'exception', 'approved', 'rejected', 'exported')),
  vendor_name text,
  vendor_name_confidence text check (vendor_name_confidence in ('high', 'medium', 'low') or vendor_name_confidence is null),
  invoice_number text,
  invoice_number_confidence text check (invoice_number_confidence in ('high', 'medium', 'low') or invoice_number_confidence is null),
  invoice_date date,
  invoice_date_confidence text check (invoice_date_confidence in ('high', 'medium', 'low') or invoice_date_confidence is null),
  subtotal numeric(14,2),
  subtotal_confidence text check (subtotal_confidence in ('high', 'medium', 'low') or subtotal_confidence is null),
  tax numeric(14,2),
  tax_confidence text check (tax_confidence in ('high', 'medium', 'low') or tax_confidence is null),
  total numeric(14,2),
  total_confidence text check (total_confidence in ('high', 'medium', 'low') or total_confidence is null),
  po_number text,
  po_number_confidence text check (po_number_confidence in ('high', 'medium', 'low') or po_number_confidence is null),
  currency text,
  currency_confidence text check (currency_confidence in ('high', 'medium', 'low') or currency_confidence is null),
  pdf_url text,
  raw_extraction_json jsonb,
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.validation_flags (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  type text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  field text,
  message text not null,
  details jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  action text not null,
  actor_id text,
  actor_name text,
  field_changes jsonb,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.export_records (
  id uuid primary key default gen_random_uuid(),
  invoice_ids jsonb not null,
  file_name text not null,
  record_count integer not null,
  exported_by text,
  exported_at timestamptz not null default now()
);

create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_created_at on public.jobs(created_at desc);

create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_job_id on public.invoices(job_id);
create index if not exists idx_invoices_vendor_invoice_total on public.invoices(vendor_name, invoice_number, total);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);

create index if not exists idx_flags_invoice_id on public.validation_flags(invoice_id);
create index if not exists idx_flags_severity on public.validation_flags(severity);
create index if not exists idx_flags_resolved on public.validation_flags(resolved);

create index if not exists idx_audit_invoice_id on public.audit_logs(invoice_id);
create index if not exists idx_audit_action on public.audit_logs(action);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);

create index if not exists idx_exports_exported_at on public.export_records(exported_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create or replace function public.require_audit_actor()
returns trigger as $$
begin
  if new.actor_id is null and new.action in ('updated', 'approved', 'rejected', 'exported') then
    raise exception 'actor_id is required for user-initiated audit actions';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_actor_required on public.audit_logs;
create trigger trg_audit_actor_required
before insert on public.audit_logs
for each row execute function public.require_audit_actor();

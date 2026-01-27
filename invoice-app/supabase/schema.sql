-- Invoice Automation Platform - Database Schema
-- Run this in Supabase SQL editor or via migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table - tracks upload and processing status
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  user_id UUID,
  error_message TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices table - stores extracted invoice data
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'exception', 'approved', 'rejected', 'exported')),
  
  -- Extracted fields with confidence
  vendor_value TEXT,
  vendor_confidence TEXT CHECK (vendor_confidence IN ('high', 'medium', 'low')),
  
  invoice_number_value TEXT,
  invoice_number_confidence TEXT CHECK (invoice_number_confidence IN ('high', 'medium', 'low')),
  
  invoice_date_value DATE,
  invoice_date_confidence TEXT CHECK (invoice_date_confidence IN ('high', 'medium', 'low')),
  
  subtotal_value DECIMAL(12, 2),
  subtotal_confidence TEXT CHECK (subtotal_confidence IN ('high', 'medium', 'low')),
  
  tax_value DECIMAL(12, 2),
  tax_confidence TEXT CHECK (tax_confidence IN ('high', 'medium', 'low')),
  
  total_value DECIMAL(12, 2),
  total_confidence TEXT CHECK (total_confidence IN ('high', 'medium', 'low')),
  
  po_number_value TEXT,
  po_number_confidence TEXT CHECK (po_number_confidence IN ('high', 'medium', 'low')),
  
  currency_value TEXT DEFAULT 'USD',
  currency_confidence TEXT CHECK (currency_confidence IN ('high', 'medium', 'low')),
  
  -- Metadata
  pdf_url TEXT NOT NULL,
  extracted_json JSONB,
  
  -- Approval tracking
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  exported_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation flags table - stores validation issues
CREATE TABLE validation_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('missing_field', 'total_mismatch', 'duplicate', 'missing_po', 'custom')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  field TEXT,
  message TEXT NOT NULL,
  details JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table - tracks all changes and approvals
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'rejected', 'exported', 'comment_added')),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  field_changes JSONB,
  comment TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Export records table - tracks CSV exports
CREATE TABLE export_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_ids UUID[] NOT NULL,
  exported_by UUID NOT NULL,
  exported_by_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_uploaded_at ON jobs(uploaded_at DESC);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);

CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

CREATE INDEX idx_validation_flags_invoice_id ON validation_flags(invoice_id);
CREATE INDEX idx_validation_flags_severity ON validation_flags(severity);
CREATE INDEX idx_validation_flags_resolved ON validation_flags(resolved_at) WHERE resolved_at IS NULL;

CREATE INDEX idx_audit_logs_invoice_id ON audit_logs(invoice_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

CREATE INDEX idx_export_records_exported_at ON export_records(exported_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_records ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (we'll add proper auth later)
-- In production, these would check auth.uid()
CREATE POLICY "Allow all for authenticated users" ON jobs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON invoices FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON validation_flags FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON export_records FOR ALL USING (true);

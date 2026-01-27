-- Clear all test data to start fresh with real extraction
-- Run this in Supabase SQL Editor

-- Delete in correct order due to foreign keys
DELETE FROM audit_logs;
DELETE FROM validation_flags;
DELETE FROM export_records;
DELETE FROM invoices;
DELETE FROM jobs;

-- Verify cleanup
SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs
UNION ALL
SELECT 'validation_flags', COUNT(*) FROM validation_flags
UNION ALL
SELECT 'export_records', COUNT(*) FROM export_records
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs;

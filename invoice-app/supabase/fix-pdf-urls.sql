-- Fix existing PDF URLs to use /api/uploads/ instead of /uploads/
-- Run this in Supabase SQL Editor

-- Update invoices table
UPDATE invoices 
SET pdf_url = REPLACE(pdf_url, '/uploads/', '/api/uploads/')
WHERE pdf_url LIKE '/uploads/%';

-- Update jobs table
UPDATE jobs 
SET file_url = REPLACE(file_url, '/uploads/', '/api/uploads/')
WHERE file_url LIKE '/uploads/%';

-- Verify the changes
SELECT id, pdf_url FROM invoices LIMIT 5;
SELECT id, file_url FROM jobs LIMIT 5;

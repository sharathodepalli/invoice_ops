# Supabase Schema Setup Guide

## Step 1: Access Supabase SQL Editor

1. Go to: https://app.supabase.com
2. Log in to your account
3. Select project: **invoice_ops**
4. Go to **SQL Editor** in the left sidebar

## Step 2: Create New Query

1. Click **+ New Query**
2. Name it: `Setup Invoice AP Schema v1.0`
3. Copy the full SQL from `supabase/setup.sql`
4. Paste into the editor

## Step 3: Run Query

1. Click **Run** (or Cmd+Enter)
2. Wait for success message
3. You should see:
   - 5 tables created: `jobs`, `invoices`, `validation_flags`, `audit_logs`, `export_records`
   - Multiple indexes created
   - 2 triggers created for `updated_at` timestamps

## Step 4: Verify Tables

1. Go to **Table Editor** in the left sidebar
2. You should see all 5 tables listed

## Step 5: Start App

```bash
cd invoice-app
npm run dev
```

Open:

- http://localhost:3000/upload
- http://localhost:3000/jobs

Try uploading a PDF and verify the job appears in the jobs table in Supabase SQL Editor:

```sql
select * from public.jobs order by created_at desc limit 1;
```

You should see your uploaded PDF as a job with status `queued`.

## Troubleshooting

If you get an error:

1. Check project ID in .env.local matches: `rdpirtzcjekiwzgcmysn`
2. Verify API keys are correct
3. Check that tables don't already exist (run schema will fail if tables exist)

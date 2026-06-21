# Invoice AP Automation - App

Slice 1 implementation for upload and job lifecycle.

## Current Features

- Upload one or multiple PDF files
- Enforce file limits (20MB/file, 25 files/batch)
- Create processing jobs
- View jobs with status filters and polling
- API routes:
  - POST /api/upload
  - GET /api/jobs

Persistence mode:

- Supabase-backed when env vars are configured
- Local file fallback when Supabase env is missing

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env.local
```

Fill values in `.env.local`:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

3. (Optional but recommended) Apply DB schema in Supabase

Run SQL from:

- `supabase/setup.sql`

4. Start app

```bash
npm run dev
```

Open:

- `/`
- `/upload`
- `/jobs`

## Quality Commands

```bash
npm run test
npm run lint
npm run build
```

## Notes

- Local fallback stores files under `uploads/` and job data under `data/jobs.json`.
- Supabase mode uses the `jobs` table and keeps API response format unchanged.

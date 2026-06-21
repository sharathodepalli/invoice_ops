# Invoice/AP Automation Platform

Invoice automation MVP built with Next.js 16, React 19, TypeScript, Tailwind CSS, and optional Supabase persistence.

## What it does

- Upload PDF invoices and create one job per file.
- Extract core fields with a deterministic MVP pipeline.
- Validate totals, required fields, duplicates, and missing PO numbers.
- Review exceptions, edit invoice fields, approve or reject, and track audit history.
- Export approved invoices to ERP-ready CSV and retain export history.

## Current App Surface

- `/` home
- `/upload` upload and processing entry point
- `/jobs` job list and processing status
- `/exceptions` queue for filtered review
- `/invoices/[id]` invoice detail and review actions
- `/exports` CSV export and export history
- API routes under `/api/upload`, `/api/jobs`, `/api/invoices`, `/api/exports`, and `/api/maintenance/cleanup`

## Auth Model

- Admin-protected routes expect a bearer token.
- System-only maintenance cleanup uses the system token.
- In development, the app supports fallback tokens when env vars are not configured.

## Setup

```bash
cd invoice-app
npm install
cp .env.example .env.local
npm run dev
```

Required environment values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SLICE_2_ADMIN_TOKEN`
- `SLICE_2_SYSTEM_TOKEN`

## Validation

```bash
npm run test
npm run lint
npm run build
```

Current verification status:

- Tests: 31/31 passing
- Lint: passing
- Build: passing

## Notes

- The app uses local JSON/file fallback when Supabase is not configured.
- The known Turbopack NFT trace warnings are from filesystem-backed paths and are non-blocking.
- Demo and testing flows are documented in [TESTING_GUIDE.md](TESTING_GUIDE.md) and [DEMO_SCRIPT.md](DEMO_SCRIPT.md).
- If you are selling this, start with [SALES_PITCH.md](SALES_PITCH.md).
- The first paid offer is described in [invoice-app/src/app/pricing/page.tsx](invoice-app/src/app/pricing/page.tsx).

# Testing & Demo Workflow Guide

## Prerequisites

- Start the app with `npm run dev`.
- Have at least one sample PDF invoice ready for upload.
- Use the admin bearer token required by the review and export pages.

## End-to-End Test Flow

### 1. Upload an invoice

- Go to `http://localhost:3000/upload`.
- Upload a PDF invoice.
- Confirm a job is created and the app routes to processing.

Expected result:

- A new job appears in `/jobs`.
- The upload is persisted locally or in Supabase, depending on your environment.

### 2. Check the processing queue

- Open `http://localhost:3000/jobs`.
- Confirm the uploaded file appears with a status like `queued`, `processing`, `extracted`, or `validated`.

Expected result:

- The job list updates without a full page reload.
- The job status changes reflect the extraction pipeline.

### 3. Review exceptions

- Open `http://localhost:3000/exceptions`.
- Enter the admin token in the page header if the app is prompting for it.
- Filter by `Exception` and inspect the queue summary cards.

Expected result:

- Rows show status, vendor, invoice number, total, and validation counts.
- Search and sort controls work.

### 4. Open invoice detail

- Click an exception invoice.
- Enter the admin token if prompted.
- Review the fields, validation flags, and audit summary.

Expected result:

- The PDF URL and invoice data are visible.
- Validation flags are listed with severities.
- Recent activity shows the latest audit events.

### 5. Edit and approve

1. Change one or more fields.
2. Save the edit.
3. Approve or reject the invoice.

Expected result:

- The invoice saves successfully.
- The audit trail records the action.
- The invoice status changes to `approved` or `rejected`.

### 6. Export approved invoices

- Open `http://localhost:3000/exports`.
- Enter the admin token.
- Select approved invoices and download CSV.

Expected result:

- Only approved invoices are exportable.
- Export history updates after download.

## Maintenance Check

- The protected maintenance route is `POST /api/maintenance/cleanup`.
- It requires the system token.
- Invalid retention values should return a `400` error.

## Troubleshooting

- If invoice pages return `401`, confirm the admin token is set.
- If export data does not load, confirm the same admin token is used on the export page.
- If a cleanup request fails, confirm the system token and retention query parameters are valid integers.

## Validation Commands

```bash
npm run test
npm run lint
npm run build
```

## Final Demo Rehearsal

Before recording or presenting live, follow [DEMO_REHEARSAL.md](DEMO_REHEARSAL.md).

After testing:

1. Configure production Supabase project
2. Set up Vercel deployment
3. Add authentication (Supabase Auth)
4. Configure S3 for file storage
5. Set up email notifications
6. Deploy to production

---

**All features working?** Record your demo video and share!

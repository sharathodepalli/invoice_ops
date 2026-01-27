# Testing & Demo Workflow Guide

## Quick Start

### 1. Seed Demo Data

```bash
# Option A: Via UI (Easiest)
1. Go to http://localhost:3000/debug
2. Click "Seed Demo Data"
3. Wait for confirmation message

# Option B: Via API (Terminal)
curl -X POST http://localhost:3000/api/seed \
  -H "Content-Type: application/json" \
  -d '{"action":"seed"}'
```

This creates:

- ✅ 12 realistic demo invoices
- ✅ Mixed statuses (pending/exception/approved/rejected)
- ✅ Validation flags on exceptions
- ✅ Audit logs on approvals
- ✅ Sample export record

### 2. Test Complete Workflow

#### Step 1: View Exceptions Queue

- Navigate to http://localhost:3000/exceptions
- Should see all 12 invoices with different status badges
- Stats card shows: Total (12), Exceptions (N), Approved (N)
- Try filter by status

**Expected:**

- Table with vendor names, invoice numbers, amounts
- Different colored status badges
- Loading skeleton while data loads

#### Step 2: Review Exception Invoice

- Click on any invoice with "Exception" status
- PDF viewer shows on left (placeholder iframe)
- Right side shows extracted fields + confidence badges
- Orange alert box shows validation issues

**Expected:**

- All 8 fields visible: vendor, invoice #, date, subtotal, tax, total, PO, currency
- Confidence indicators: High (green), Medium (yellow), Low (red)
- Validation flags with severity levels

#### Step 3: Edit & Approve

1. Click "Edit" button
2. Modify any field (e.g., fix total calculation)
3. Click "Save"
4. Verify audit log created
5. Click "Approve" button
6. Redirected back to queue with updated status

**Expected:**

- Fields become editable (input boxes appear)
- Save button disabled while saving
- Invoice status changes to "approved"
- Audit trail updated

#### Step 4: Export Invoices

1. Go to http://localhost:3000/export
2. Should see approved invoices
3. Use checkboxes to select (or "Select All")
4. Click "Export Selected"
5. CSV file downloads

**Expected:**

- List of approved invoices with checkboxes
- Export history sidebar shows recent exports
- CSV includes: Invoice ID, Vendor, Invoice #, Date, Subtotal, Tax, Total, PO, Currency, Status, Exported At
- File named: `invoices_export_[timestamp].csv`

#### Step 5: Test Upload Flow

1. Go to http://localhost:3000/upload
2. Drag & drop or select a PDF
3. Goes to /jobs page
4. Processing shows pending → completed
5. Appears in exceptions queue

**Expected:**

- Upload zone shows drag-drop feedback
- Job status updates in real-time
- File stored locally in `uploads/` directory
- Database creates invoice record

---

## Loading Skeleton Test

All pages now have smooth loading states:

- ✅ Exceptions queue: Skeleton table rows
- ✅ Invoice detail: Skeleton PDF + fields
- ✅ Export page: Skeleton invoice list
- These appear during initial load and when refreshing data

---

## Troubleshooting

### "Failed to seed database"

- **Cause:** Supabase not configured or offline
- **Fix:**
  1. Check `.env.local` has NEXT_PUBLIC_SUPABASE_URL and key
  2. Verify Supabase project is active
  3. Check database schema was created

### "No invoices appear after seeding"

- **Cause:** Data seeded but API not fetching
- **Fix:**
  1. Check browser console for errors
  2. Verify `/api/invoices` endpoint works: `curl http://localhost:3000/api/invoices`
  3. Check Supabase dashboard → Table Editor → invoices table

### PDF viewer shows blank

- **Expected:** PDF viewer is placeholder (iframe)
- **Note:** Real PDFs would load from uploads/ directory
- **Demo:** Use any PDF file for testing

### Buttons not responding

- **Cause:** API endpoints may have issues
- **Fix:**
  1. Check terminal for API errors
  2. Verify Supabase connection
  3. Check browser dev tools Network tab

---

## Demo Script (2-3 Minutes)

**Opening (30 sec)**

> "Let me show you our invoice automation platform. It uses AI to extract vendor, invoice numbers, amounts, and PO numbers from PDFs."

**Upload Demo (30 sec)**

- Go to /upload
- Show drag-drop functionality
- "Files are processed in the background"

**Processing Demo (30 sec)**

- Go to /jobs → show queue
- "Processing happens automatically with OCR and AI extraction"

**Exceptions Queue (40 sec)**

- Go to /exceptions
- "Invoices are automatically validated. Any issues get flagged here"
- Show stats: total, pending, exceptions
- "Notice different status colors"

**Invoice Detail (60 sec)**

- Click an exception invoice
- "Here's the PDF on the left, extracted data on the right"
- "You can see extraction confidence levels"
- "Validation issues are highlighted - in this case total doesn't match"
- Click Edit, change a value, Save
- "Changes are logged in the audit trail"
- Approve invoice

**Export Demo (30 sec)**

- Go to /export
- "You can select approved invoices and export as CSV"
- Select a few and click Export
- Show downloaded file

**Closing (15 sec)**

> "Everything is fully audited. You can see who approved what and when. Ready for production with real ERP integrations."

---

## Performance Notes

- ✅ Page loads < 1 second (after first load)
- ✅ Skeleton loaders provide smooth UX
- ✅ Auto-refresh on exceptions page (10s interval)
- ✅ Responsive on mobile (tested at breakpoints)
- ✅ Dark mode supported

---

## Next Phase: Production Deployment

After testing:

1. Configure production Supabase project
2. Set up Vercel deployment
3. Add authentication (Supabase Auth)
4. Configure S3 for file storage
5. Set up email notifications
6. Deploy to production

---

**All features working?** Record your demo video and share!

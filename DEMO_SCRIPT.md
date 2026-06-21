# Demo Script & Recording Guide

## Prep

1. Start the app with `npm run dev`.
2. Open the app in dark mode at 125% zoom.
3. Prepare one or two sample invoice PDFs to upload during the demo.
4. Have the admin token ready for the exceptions, invoice detail, and export pages.

## Demo Flow

### Scene 1: Landing page

Narration:

> "This is our invoice automation MVP. It turns PDF invoices into validated records that can be reviewed, approved, and exported."

Show:

- Home page hero and key workflow cards.
- Navigation to upload, jobs, exceptions, and export.

### Scene 2: Upload and processing

Narration:

> "We upload a PDF, create a processing job, and extract the invoice data automatically."

Show:

1. `/upload`
2. Drag and drop or select a PDF.
3. `/jobs`
4. Job status moving through the pipeline.

### Scene 3: Exceptions queue

Narration:

> "Any invoices that need attention land in the exceptions queue with clear validation counts and filters."

Show:

1. `/exceptions`
2. Enter the admin token if prompted.
3. Filter by exception status.
4. Sort by critical flags or vendor.

### Scene 4: Invoice detail and review

Narration:

> "The detail screen shows the extracted fields, validation flags, and the full audit trail. We can correct fields and approve from here."

Show:

1. Open an exception invoice.
2. Enter the admin token if prompted.
3. Edit a field and save.
4. Show the audit entry.
5. Approve or reject the invoice.

### Scene 5: Export

Narration:

> "Approved invoices can be exported to CSV, and every export is tracked in history."

Show:

1. `/exports`
2. Enter the admin token.
3. Select approved invoices.
4. Download CSV.
5. Show export history updating.

### Scene 6: Closing

Narration:

> "That gives us a complete AP workflow with validation, auditability, and export readiness."

Show:

- Return to the home page.
- End on the workflow summary.

## Recording Notes

- Keep each screen up long enough to read the labels.
- Pause briefly when showing the validation and audit areas.
- If the app asks for a token, type it once and keep the demo moving.
- Keep the final video under 3 minutes.

If recording doesn't go perfectly:

**Version A (60 seconds - Ultra-Short)**

> "This is our invoice automation platform. Upload PDFs, we extract data with AI, validate it, flag issues, you approve, we export to CSV. Done. Ready for production."

**Version B (90 seconds - Medium)**

> "Upload invoices → AI extracts vendor, invoice number, amounts, PO → System validates for errors → You review exceptions → Approve/reject with audit logging → Export CSV to ERP. Complete automation with full oversight."

---

## Demo Checklist

- [ ] Browser at 125% zoom
- [ ] Dark mode enabled
- [ ] Demo data seeded
- [ ] All data loaded (no loading skeletons showing)
- [ ] Sound checked
- [ ] Screen recording app ready
- [ ] Speaking points reviewed
- [ ] Timing practiced (can do demo in 2:45)
- [ ] Clear microphone path
- [ ] Computer won't interrupt (notifications off)
- [ ] Backups of recording (save locally + cloud)

---

## Final Notes

- **Don't be perfect.** Small hiccups are fine - users expect real demos
- **Emphasize speed.** Show how fast the system works
- **Highlight UI.** Design is a big selling point
- **Show the data.** Real numbers/vendors look more impressive
- **End strong.** Leave them wanting to try it

**You've got this! 🎬**

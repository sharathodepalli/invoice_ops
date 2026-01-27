# Demo Script & Recording Guide

## Pre-Recording Setup (5 minutes)

### 1. Clear old data

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "Content-Type: application/json" \
  -d '{"action":"clear"}'
```

### 2. Seed fresh demo data

- Go to http://localhost:3000/debug
- Click "Seed Demo Data"
- Wait for success message

### 3. Prepare recording environment

- Close unnecessary tabs/notifications
- Set zoom to 125% (readable on video)
- Use dark mode (looks professional)
- Test microphone audio levels
- Use screen recording tool (OBS, ScreenFlow, etc.)

---

## Demo Script (2:45 Total)

### Scene 1: Landing Page (0:15)

**Narration:**

> "Hi! Today I'm showing you our AI-powered invoice automation platform for The Shades. This solution eliminates manual data entry by automatically extracting vendor information, invoice numbers, amounts, and PO numbers from PDFs."

**Actions:**

1. Load http://localhost:3000
2. Scroll to show:
   - Hero section
   - Stats cards (if filled in)
   - Feature cards
3. Show responsive design by adjusting window

**End:** 15 seconds

---

### Scene 2: Upload Flow (0:30)

**Narration:**

> "Let me show you how it works. First, we upload invoices. You can either drag and drop or click to select files."

**Actions:**

1. Click "Start Processing" or go to /upload
2. Show drag-drop zone
3. Click "Browse Files"
4. Show file picker (don't select, just show)
5. Say "Once uploaded, processing begins automatically"
6. Go back to home, show upload card
7. Navigate to /jobs page
8. Show:
   - Job queue with status
   - Pending → Processing
   - Real-time updates

**Lines on screen:**

- "Drag files here or click to browse"
- "Uploaded 12 invoices"
- "Processing..." (animated)

**End:** 30 seconds | Cumulative: 45 seconds

---

### Scene 3: Processing & Exceptions (0:35)

**Narration:**

> "Our system automatically extracts data from PDFs using OCR and AI. It then validates the information. Any issues get flagged for review."

**Actions:**

1. Go to /exceptions page
2. Show:
   - Loading skeletons (briefly)
   - Stats cards loading
   - Stats showing: Total (12), Pending (X), Exceptions (X), Approved (X)
3. Explain different colors:
   - Gray = Pending
   - Orange = Exception (needs review)
   - Green = Approved
   - Red = Rejected
4. Point to a few rows showing different statuses
5. Show filter buttons: "All, Pending, Exception, Approved, Rejected"
6. Click Exception filter to show just exceptions

**Key Quote:**

> "Our validation engine catches these issues automatically, so nothing bad makes it to your ERP system."

**End:** 35 seconds | Cumulative: 1:20

---

### Scene 4: Invoice Detail & Review (0:45)

**Narration:**

> "Let me click on an exception invoice to see the details. Here we have the PDF on the left and the extracted data on the right."

**Actions:**

1. Click on an "Exception" status invoice
2. Wait for detail page to load (show skeleton briefly)
3. Show layout:
   - Left: PDF viewer
   - Right: Extracted fields
4. Point out:
   - **Confidence badges:** High (green), Medium (yellow), Low (red)
   - Each field shows confidence level
5. Scroll down to show validation issues box:
   - Orange alert
   - Issue message: "Total doesn't match subtotal + tax"
   - Severity indicator
6. Show Edit button
7. Click Edit
8. Highlight one field (e.g., total)
9. Show input becomes editable
10. Type a different value
11. Click Save
12. Show success (field updates)

**Key Quote:**

> "You can see exactly why each invoice was flagged and fix any issues right here."

**End:** 45 seconds | Cumulative: 2:05

---

### Scene 5: Approval & Export (0:40)

**Narration:**

> "Once the data looks good, we approve the invoice. This is automatically logged for audit purposes."

**Actions:**

1. Click "Approve" button (green)
2. Confirm if prompted
3. Shows redirect to exceptions page
4. Navigate to /export page
5. Show:
   - List of approved invoices with checkboxes
   - Export history sidebar (empty or with records)
   - Stats on approved count
6. Narrate: "Here we can see all approved invoices"
7. Use "Select All" button
8. Show count badge: "Export 3 Selected" (or however many)
9. Click "Export Selected"
10. Show:
    - Button shows "Exporting..."
    - File downloads
    - Page refreshes
    - Export history updates

**Key Quote:**

> "The system generates a perfectly formatted CSV that's ready to import directly into your ERP system. Every action is tracked in the audit log."

**End:** 40 seconds | Cumulative: 2:45

---

### Scene 6: Closing (0:15)

**Actions:**

1. Go back to home page
2. Do final scroll of features

**Narration:**

> "That's the complete workflow - from upload to approval to export. Our platform handles complex validation, maintains full audit trails, and ensures data accuracy every step of the way. Ready to transform your AP process?"

**Visual:**

- Show logo/company name
- Maybe include tech stack subtitle

**End:** 15 seconds | Cumulative: 3:00

---

## Recording Tips

### Audio Quality

- Speak clearly and slowly (pause between thoughts)
- Use a microphone, not laptop audio
- Test audio levels before recording
- Avoid background noise
- Add subtle background music if needed

### Visual Quality

- Zoom: 125% (text readable)
- Theme: Dark mode (looks more professional)
- Cursor: Make visible
- Pointer: Use OS pointer highlight tool
- Timing: Let screens fully load before narrating

### Pacing

- Don't rush - give viewers time to absorb info
- Pause 1-2 seconds on each screen change
- Use cursor to point out important elements
- Show transitions (loading states, animations)

### Voiceover

- Record narration separately if possible
- Use clear project/company names
- Emphasize key features:
  - "Automatic AI extraction"
  - "Intelligent validation"
  - "Complete audit trail"
  - "One-click export"
- End with call-to-action

---

## Post-Recording

### Editing (if using external editor)

1. Trim to 2:45-3:00 max
2. Add title slide (3 seconds)
3. Add tech stack slide (3 seconds)
4. Add closing CTA slide (3 seconds)
5. Total: ~3:15 with extras
6. Add subtitle captions for key features
7. Adjust audio levels to -6dB average

### Export Settings

- Format: MP4
- Resolution: 1920x1080 (1080p)
- Bitrate: 5-8 Mbps
- Frame rate: 30 fps
- Audio: 128 kbps AAC

### Upload & Share

- YouTube (unlisted or public)
- Vimeo
- Product Hunt
- Company website
- Email to prospects

---

## Backup Script (If You Mess Up)

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

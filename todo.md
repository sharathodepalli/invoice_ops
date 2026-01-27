### MVP Plan — “Sellable Demo” for The Shades (Invoice/AP Automation)

**Goal:** a credible demo you can show on calls + record as a 2–3 min video:
**Upload → Extract → Validate → Exceptions Queue → Export CSV**

---

## 1) MVP scope (must-have)

### A) Intake (demo mode)

- Upload **single + batch** PDF invoices
- Auto-create a “processing job” per file
- Store original PDF + extracted JSON

### B) OCR + extraction

- Extract these fields (minimum):
  **Vendor, Invoice #, Invoice date, Subtotal, Tax, Total, PO #, Currency**
- Show **confidence** per field (even simple High/Med/Low is fine)

### C) Validation rules (MVP rules)

- Missing required fields (Invoice # / Total / Vendor)
- Total mismatch (Subtotal + Tax ≠ Total within tolerance)
- Duplicate detection (Vendor + Invoice # + Total)
- Missing PO (flag as exception)

### D) Exceptions queue (core UI)

- Table view: status, vendor, invoice #, total, flags
- Detail view:
  - PDF viewer
  - Extracted fields (editable)
  - Flags + validation messages
  - Actions: **Approve / Reject / Request Info** (request info can just tag/comment)

### E) Export

- Export approved items to **ERP-ready CSV**
- Download CSV + “exported_at” timestamp
- Keep audit trail: who approved, when, what changed

---

## 2) What to skip (for speed)

- Full ERP integrations (CSV is enough)
- Complex approval trees (start with 1 simple rule or manual approve)
- Multi-tenant billing/admin
- Claiming hard accuracy % until you measure on real data

---

## 3) Screens you need (minimum)

1. **Upload / Jobs page** (batch upload + processing status)
2. **Exceptions Queue** (filters: All / Exceptions / Approved / Rejected)
3. **Invoice Detail** (PDF + fields + validations + actions)
4. **Export page** (CSV download + export history)

---

## 4) Suggested build order (10 working days)

**Day 1:** Project setup + database schema + file storage
**Day 2:** Upload flow + job runner skeleton
**Day 3–4:** OCR/extraction pipeline + save extracted fields
**Day 5:** Validation engine + flags
**Day 6–7:** Exceptions queue UI + detail page editing
**Day 8:** Approve/Reject + audit logs
**Day 9:** CSV export + export history
**Day 10:** Polish + seed demo data + record demo video

---

## 5) Tech architecture (simple & reliable)

- **Frontend:** Next.js (your site already fits this direction)
- **Backend API:** Next.js API routes _or_ FastAPI (either is fine—pick fastest for you)
- **Storage:** S3 (or local for dev) for PDFs
- **DB:** Postgres (Supabase is easiest) for invoices/jobs/audit
- **OCR:** start with one provider (no switching early)
- **Extraction:** LLM-based field extraction on top of OCR text, plus confidence heuristics

---

## 6) Definition of “done” (sellable)

- You can upload 10–20 sample invoices
- 80%+ get extracted with fields filled
- Exceptions show up with clear reasons
- You can correct fields and approve
- You can export a clean CSV + show audit trail
- You can record a 2–3 min walkthrough video

---

If you want, I can also turn this into a **dev task list (Jira-style tickets)** + **DB schema (tables/fields)** + **demo script** so you can build without confusion.

# Invoice/AP Automation - AI Coding Agent Instructions

## Project Overview

Invoice/AP automation platform for "The Shades" - extracting, validating, and exporting invoice data from PDFs. The goal is a sellable MVP demo showing: **Upload → Extract → Validate → Exceptions Queue → Export CSV**.

## Architecture & Tech Stack

- **Frontend:** Next.js for UI and site integration
- **Backend:** Next.js API routes OR FastAPI (choose based on speed)
- **Storage:** S3 (or local for dev) for PDF files
- **Database:** Postgres via Supabase for invoices, jobs, audit trails
- **OCR/Extraction:** Single OCR provider + LLM-based field extraction with confidence scoring

## Core Components

### 1. Data Pipeline

- **Intake:** Upload single/batch PDFs → create processing jobs → store original PDF + extracted JSON
- **Extraction:** OCR text → LLM extracts: Vendor, Invoice #, Invoice date, Subtotal, Tax, Total, PO #, Currency
- **Validation:** Check for missing fields, total mismatch (Subtotal + Tax ≠ Total), duplicates (Vendor + Invoice # + Total), missing PO
- **Exceptions:** Flag violations for manual review

### 2. Database Schema (key tables)

- `jobs`: processing status per uploaded file
- `invoices`: extracted fields + confidence scores + validation flags
- `audit_logs`: who approved/rejected, when, field changes

### 3. UI Screens

1. **Upload/Jobs page:** batch upload + processing status
2. **Exceptions Queue:** filterable table (All/Exceptions/Approved/Rejected)
3. **Invoice Detail:** PDF viewer + editable fields + validation messages + actions (Approve/Reject/Request Info)
4. **Export page:** CSV download + export history

## Developer Workflows

### Build Order (10-day sprint)

- Day 1: Project setup + DB schema + file storage
- Day 2: Upload flow + job runner skeleton
- Day 3-4: OCR/extraction pipeline + save fields
- Day 5: Validation engine + flags
- Day 6-7: Exceptions queue UI + detail page editing
- Day 8: Approve/Reject + audit logs
- Day 9: CSV export + export history
- Day 10: Polish + seed demo data + record demo video

## Project-Specific Conventions

- **Confidence scoring:** Use simple High/Med/Low labels initially (avoid claiming hard accuracy % until measured on real data)
- **Validation tolerance:** For total mismatch, use reasonable tolerance (e.g., ±$0.01) to handle rounding
- **CSV export:** Must be ERP-ready format with exported_at timestamp
- **Audit trail:** Track every field edit, approval, rejection with user + timestamp

## MVP Scope Boundaries

**Include:**

- Single OCR provider (no switching logic)
- Simple manual approve/reject (no complex approval trees)
- CSV export (no direct ERP integrations yet)
- 80%+ extraction accuracy target

**Exclude for MVP:**

- Multi-tenant billing/admin
- Complex approval workflows
- Direct ERP system integrations
- Real-time collaboration features

## Definition of Done

- Upload 10-20 sample invoices with 80%+ field extraction success
- Exceptions show clear, actionable reasons
- Field correction + approval flow works end-to-end
- Clean CSV export with audit trail
- 2-3 min demo video ready

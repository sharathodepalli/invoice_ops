# Demo Rehearsal Checklist

Use this once the app is already running locally and the demo docs are up to date.

Pair this with [DEMO_ASSET_PACK.md](DEMO_ASSET_PACK.md) so the rehearsal uses the same invoice mix every time.

## Assets to Prepare

- 2 to 3 sample PDF invoices with different outcomes:
  - one clean invoice
  - one exception invoice with a total mismatch or missing PO
  - one invoice that can be approved and exported
- Admin bearer token for `/exceptions`, `/invoices/[id]`, and `/exports`
- System token for the maintenance cleanup route if you want to show it

## Rehearsal Order

1. Open the home page and show the workflow summary.
2. Upload a sample PDF from `/upload`.
3. Open `/jobs` and let the queue update.
4. Open `/exceptions`, enter the admin token, and filter to exceptions.
5. Open an invoice detail page, edit one field, save, and approve.
6. Open `/exports`, enter the admin token, and export approved invoices.
7. Return to the home page and end on the platform summary.

## Timing Targets

- Landing page: 10-15 seconds
- Upload and jobs: 20-30 seconds
- Exceptions queue: 30-40 seconds
- Invoice detail and approval: 45-60 seconds
- Export: 25-35 seconds

## Presentation Notes

- Keep the cursor moving slowly and deliberately.
- Pause after each page load so the audience can read the status cards.
- If a token prompt appears, type it once and continue.
- Do not show the maintenance cleanup route during the primary demo unless explicitly asked.

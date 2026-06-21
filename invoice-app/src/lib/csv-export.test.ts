import { describe, expect, it } from "vitest";
import { buildExportFileName, buildInvoiceExportCsv } from "@/lib/csv-export";

describe("csv-export", () => {
  it("escapes quotes and newlines in invoice rows", () => {
    const csv = buildInvoiceExportCsv([
      {
        invoice_id: "inv_1",
        job_id: "job_1",
        status: "approved",
        vendor_name: 'ACME, "North"',
        vendor_name_confidence: "high",
        invoice_number: "INV-1001",
        invoice_number_confidence: "high",
        invoice_date: "2026-05-18",
        invoice_date_confidence: "high",
        subtotal: 100,
        subtotal_confidence: "high",
        tax: 10,
        tax_confidence: "high",
        total: 110,
        total_confidence: "high",
        po_number: "PO-1\nSecond line",
        po_number_confidence: "medium",
        currency: "USD",
        currency_confidence: "high",
        pdf_url: null,
        raw_extraction_json: {},
        approved_at: "2026-05-18T10:00:00.000Z",
        approved_by: "admin",
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
        created_at: "2026-05-18T10:00:00.000Z",
        updated_at: "2026-05-18T10:00:00.000Z",
      },
    ]);

    expect(csv).toContain('"ACME, ""North"""');
    expect(csv).toContain('"PO-1');
    expect(csv).toContain('approved');
  });

  it("builds a stable export file name", () => {
    expect(buildExportFileName("2026-05-18T10:00:00.000Z")).toBe(
      "approved-invoices-2026-05-18T10-00-00.000Z.csv",
    );
  });
});

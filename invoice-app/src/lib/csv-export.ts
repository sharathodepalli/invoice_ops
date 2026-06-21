import type { InvoiceRecord } from "@/lib/invoices-store";

const CSV_HEADERS = [
  "invoice_id",
  "vendor_name",
  "invoice_number",
  "invoice_date",
  "subtotal",
  "tax",
  "total",
  "po_number",
  "currency",
  "status",
  "approved_at",
  "approved_by",
] as const;

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
}

export function buildInvoiceExportCsv(invoices: InvoiceRecord[]): string {
  const rows = [CSV_HEADERS.join(",")];

  for (const invoice of invoices) {
    rows.push(
      [
        invoice.invoice_id,
        invoice.vendor_name,
        invoice.invoice_number,
        invoice.invoice_date,
        invoice.subtotal,
        invoice.tax,
        invoice.total,
        invoice.po_number,
        invoice.currency,
        invoice.status,
        invoice.approved_at,
        invoice.approved_by,
      ]
        .map((value) => escapeCsvValue(formatValue(value)))
        .join(","),
    );
  }

  return `${rows.join("\n")}\n`;
}

export function buildExportFileName(exportedAt: string): string {
  return `approved-invoices-${exportedAt.replace(/[:]/g, "-")}.csv`;
}

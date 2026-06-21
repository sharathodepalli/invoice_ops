import { listValidationFlags, replaceValidationFlagsForInvoice, type ValidationFlagRecord } from "@/lib/validation-flags-store";
import { getInvoiceByJobId, listInvoices, upsertInvoiceForJob, type InvoiceRecord } from "@/lib/invoices-store";

type ValidationResult = {
  invoice: InvoiceRecord;
  flags: ValidationFlagRecord[];
};

function nearlyEqual(left: number, right: number, tolerance = 0.01): boolean {
  return Math.abs(left - right) <= tolerance;
}

function hasMeaningfulValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return Number.isFinite(value);
}

function normalizeCurrency(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length === 3 ? normalized : normalized;
}

export async function validateInvoice(jobId: string): Promise<ValidationResult> {
  const invoice = await getInvoiceByJobId(jobId);
  if (!invoice) {
    throw new Error(`Invoice not found for job ${jobId}`);
  }

  const flags: Array<{
    type: "error" | "warning";
    severity: "critical" | "warning" | "info";
    field: string | null;
    message: string;
    details?: Record<string, unknown> | null;
  }> = [];

  const requiredFields: Array<{ field: keyof InvoiceRecord; label: string }> = [
    { field: "vendor_name", label: "vendor_name" },
    { field: "invoice_number", label: "invoice_number" },
    { field: "invoice_date", label: "invoice_date" },
    { field: "subtotal", label: "subtotal" },
    { field: "total", label: "total" },
    { field: "currency", label: "currency" },
  ];

  for (const required of requiredFields) {
    const value = invoice[required.field] as string | number | null;
    if (!hasMeaningfulValue(value)) {
      flags.push({
        type: "error",
        severity: "critical",
        field: required.label,
        message: `${required.label} is required.`,
      });
    }
  }

  if (!hasMeaningfulValue(invoice.po_number)) {
    flags.push({
      type: "warning",
      severity: "critical",
      field: "po_number",
      message: "PO number is missing.",
    });
  }

  if (hasMeaningfulValue(invoice.subtotal) && hasMeaningfulValue(invoice.tax) && hasMeaningfulValue(invoice.total)) {
    const subtotal = Number(invoice.subtotal);
    const tax = Number(invoice.tax);
    const total = Number(invoice.total);

    if (!nearlyEqual(subtotal + tax, total)) {
      flags.push({
        type: "error",
        severity: "critical",
        field: "total",
        message: "Subtotal + tax does not match total.",
        details: {
          subtotal,
          tax,
          total,
          expected_total: Number((subtotal + tax).toFixed(2)),
        },
      });
    }
  }

  const duplicateCandidates = invoice.vendor_name && invoice.invoice_number && hasMeaningfulValue(invoice.total)
    ? await listInvoices({ limit: 100 }).then((page) =>
        page.invoices.some((candidate) =>
          candidate.invoice_id !== invoice.invoice_id &&
          candidate.vendor_name?.trim().toLowerCase() === invoice.vendor_name?.trim().toLowerCase() &&
          candidate.invoice_number?.trim().toLowerCase() === invoice.invoice_number?.trim().toLowerCase() &&
          Number(candidate.total ?? Number.NaN) === Number(invoice.total ?? Number.NaN),
        ),
      )
    : false;

  if (duplicateCandidates) {
    flags.push({
      type: "error",
      severity: "critical",
      field: "invoice_number",
      message: "Duplicate invoice candidate detected.",
      details: {
        vendor_name: invoice.vendor_name,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
      },
    });
  }

  if (invoice.currency) {
    const normalizedCurrency = normalizeCurrency(invoice.currency);
    if (normalizedCurrency !== invoice.currency) {
      flags.push({
        type: "warning",
        severity: "info",
        field: "currency",
        message: "Currency normalized to ISO-4217 uppercase code.",
        details: { normalized_currency: normalizedCurrency },
      });
    }
  }

  const savedFlags = await replaceValidationFlagsForInvoice({
    invoiceId: invoice.invoice_id,
    flags,
  });

  const nextStatus = savedFlags.some((flag) => flag.severity === "critical") ? "exception" : "pending";

  const updatedInvoice = await upsertInvoiceForJob({
    jobId,
    pdfUrl: invoice.pdf_url,
    status: nextStatus,
    vendor_name: invoice.vendor_name,
    vendor_name_confidence: invoice.vendor_name_confidence,
    invoice_number: invoice.invoice_number,
    invoice_number_confidence: invoice.invoice_number_confidence,
    invoice_date: invoice.invoice_date,
    invoice_date_confidence: invoice.invoice_date_confidence,
    subtotal: invoice.subtotal,
    subtotal_confidence: invoice.subtotal_confidence,
    tax: invoice.tax,
    tax_confidence: invoice.tax_confidence,
    total: invoice.total,
    total_confidence: invoice.total_confidence,
    po_number: invoice.po_number,
    po_number_confidence: invoice.po_number_confidence,
    currency: normalizeCurrency(invoice.currency),
    currency_confidence: invoice.currency_confidence,
    raw_extraction_json: invoice.raw_extraction_json,
  });

  return {
    invoice: updatedInvoice,
    flags: savedFlags,
  };
}

export async function getValidationSummary(jobId: string): Promise<{
  invoice: InvoiceRecord | null;
  flags: ValidationFlagRecord[];
}> {
  const invoice = await getInvoiceByJobId(jobId);
  if (!invoice) {
    return { invoice: null, flags: [] };
  }

  const flags = await listValidationFlags(invoice.invoice_id);
  return { invoice, flags };
}
import type { ExtractedInvoiceData } from "./extraction";
import { createValidationFlag } from "./db";

export interface ValidationResult {
  hasErrors: boolean;
  flags: Array<{
    type: "missing_field" | "total_mismatch" | "duplicate" | "missing_po" | "custom";
    severity: "critical" | "warning" | "info";
    field?: string;
    message: string;
    details?: Record<string, any>;
  }>;
}

/**
 * Validate extracted invoice data
 * Returns validation flags for any issues found
 */
export async function validateInvoiceData(
  data: ExtractedInvoiceData
): Promise<ValidationResult> {
  const flags: ValidationResult["flags"] = [];

  // Rule 1: Check for missing required fields
  const requiredFields = [
    { key: "vendor", label: "Vendor" },
    { key: "invoiceNumber", label: "Invoice Number" },
    { key: "total", label: "Total Amount" },
  ] as const;

  for (const field of requiredFields) {
    if (!data[field.key].value) {
      flags.push({
        type: "missing_field",
        severity: "critical",
        field: field.key,
        message: `Missing required field: ${field.label}`,
      });
    }
  }

  // Rule 2: Check total calculation (Subtotal + Tax = Total)
  if (data.subtotal.value && data.tax.value && data.total.value) {
    const calculatedTotal = data.subtotal.value + data.tax.value;
    const difference = Math.abs(calculatedTotal - data.total.value);
    const tolerance = 0.02; // $0.02 tolerance for rounding

    if (difference > tolerance) {
      flags.push({
        type: "total_mismatch",
        severity: "critical",
        field: "total",
        message: `Total mismatch: Subtotal ($${data.subtotal.value}) + Tax ($${data.tax.value}) ≠ Total ($${data.total.value})`,
        details: {
          subtotal: data.subtotal.value,
          tax: data.tax.value,
          total: data.total.value,
          calculatedTotal,
          difference,
        },
      });
    }
  }

  // Rule 3: Check for missing PO number
  if (!data.poNumber.value) {
    flags.push({
      type: "missing_po",
      severity: "warning",
      field: "poNumber",
      message: "Missing Purchase Order number",
    });
  }

  // Rule 4: Check for low confidence fields
  const confidenceThreshold = "low";
  Object.entries(data).forEach(([key, field]) => {
    if (field.confidence === confidenceThreshold && field.value) {
      flags.push({
        type: "custom",
        severity: "info",
        field: key,
        message: `Low confidence on ${key}: please verify`,
        details: {
          confidence: field.confidence,
          value: field.value,
        },
      });
    }
  });

  return {
    hasErrors: flags.some((f) => f.severity === "critical"),
    flags,
  };
}

/**
 * Save validation flags to database
 */
export async function saveValidationFlags(
  invoiceId: string,
  validationResult: ValidationResult
): Promise<void> {
  for (const flag of validationResult.flags) {
    await createValidationFlag({
      invoiceId,
      type: flag.type,
      severity: flag.severity,
      field: flag.field,
      message: flag.message,
      details: flag.details,
    });
  }
}

/**
 * Check for duplicate invoices
 * TODO: Implement duplicate detection based on vendor + invoice number + total
 */
export async function checkForDuplicates(
  vendor: string | null,
  invoiceNumber: string | null,
  total: number | null
): Promise<boolean> {
  // This would query the database for existing invoices with same details
  // For now, return false (no duplicates)
  return false;
}

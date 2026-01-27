import type { FullInvoice, FieldWithEvidence } from "@/types/full-invoice";

/**
 * Confidence Calculation Engine
 * Rule-based scoring system - NO reliance on LLM-claimed confidence
 */

export interface ConfidenceSignal {
  evidenceMatch: number; // 0-1: value found in OCR text
  formatValidity: number; // 0-1: format is correct (date parses, number valid, etc.)
  mathCheck: number; // 0-1: arithmetic makes sense
  ocrQuality: number; // 0-1: overall OCR text quality
}

/**
 * Calculate confidence score for a field based on multiple signals
 */
export function calculateFieldConfidence(
  value: any,
  ocrText: string,
  signals: Partial<ConfidenceSignal>
): "high" | "medium" | "low" {
  let score = 0.0;

  // Evidence match: value appears in OCR text
  if (signals.evidenceMatch !== undefined) {
    score += signals.evidenceMatch * 0.3;
  } else if (value && ocrText) {
    const valueStr = String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
    const ocrNormalized = ocrText.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (valueStr && ocrNormalized.includes(valueStr)) {
      score += 0.3;
    }
  }

  // Format validity
  if (signals.formatValidity !== undefined) {
    score += signals.formatValidity * 0.2;
  }

  // Math checks
  if (signals.mathCheck !== undefined) {
    score += signals.mathCheck * 0.2;
  }

  // OCR quality (caps the maximum score)
  const ocrQuality = signals.ocrQuality ?? 1.0;
  if (ocrQuality < 0.6) {
    score = Math.min(score, 0.6);
  }

  // Base score for having a non-null value
  if (value !== null && value !== undefined && value !== "") {
    score += 0.3;
  }

  // Map to confidence bucket
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/**
 * Find evidence snippet from OCR text for a given value
 */
export function findEvidence(value: any, ocrText: string, context: number = 50): string | null {
  if (!value || !ocrText) return null;

  const valueStr = String(value);
  const index = ocrText.indexOf(valueStr);

  if (index === -1) {
    // Try case-insensitive
    const lowerValue = valueStr.toLowerCase();
    const lowerIndex = ocrText.toLowerCase().indexOf(lowerValue);
    if (lowerIndex === -1) return null;

    // Extract context around the match
    const start = Math.max(0, lowerIndex - context);
    const end = Math.min(ocrText.length, lowerIndex + valueStr.length + context);
    return ocrText.substring(start, end).trim();
  }

  // Extract context around the match
  const start = Math.max(0, index - context);
  const end = Math.min(ocrText.length, index + valueStr.length + context);
  return ocrText.substring(start, end).trim();
}

/**
 * Validate invoice math and return score
 */
export function validateInvoiceMath(invoice: FullInvoice): {
  totalMatch: number; // 0-1
  lineItemsMatch: number; // 0-1
  valid: boolean;
} {
  const tolerance = 0.02; // $0.02 tolerance for rounding

  const subtotal = invoice.header.subtotal.value ?? 0;
  const tax = invoice.header.tax.value ?? 0;
  const total = invoice.header.total.value ?? 0;

  // Check: subtotal + tax ≈ total
  const calculatedTotal = subtotal + tax;
  const totalDiff = Math.abs(calculatedTotal - total);
  const totalMatch = total > 0 ? Math.max(0, 1 - totalDiff / total) : 0;

  // Check: sum(line_items) ≈ subtotal
  const lineItemsSum = invoice.line_items.reduce((sum, item) => {
    return sum + (item.line_total ?? 0);
  }, 0);
  const subtotalDiff = Math.abs(lineItemsSum - subtotal);
  const lineItemsMatch =
    subtotal > 0 && invoice.line_items.length > 0
      ? Math.max(0, 1 - subtotalDiff / subtotal)
      : 1; // If no line items, assume OK

  const valid = totalDiff <= tolerance && (invoice.line_items.length === 0 || subtotalDiff <= tolerance);

  return {
    totalMatch,
    lineItemsMatch,
    valid,
  };
}

/**
 * Calculate OCR quality score based on text characteristics
 */
export function calculateOCRQuality(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  let score = 1.0;

  // Penalize if too short
  if (text.length < 100) {
    score *= 0.5;
  }

  // Penalize excessive special characters (sign of OCR errors)
  const specialChars = (text.match(/[^\w\s.,@$%()-]/g) || []).length;
  const specialRatio = specialChars / text.length;
  if (specialRatio > 0.1) {
    score *= 0.7;
  }

  // Penalize if no numbers (invoices should have amounts)
  if (!/\d/.test(text)) {
    score *= 0.3;
  }

  // Boost if contains common invoice keywords
  const keywords = [
    "invoice",
    "total",
    "subtotal",
    "tax",
    "amount",
    "due",
    "date",
    "bill",
    "payment",
  ];
  const keywordCount = keywords.filter((kw) => text.toLowerCase().includes(kw)).length;
  score *= 1 + keywordCount * 0.05;

  return Math.min(1.0, Math.max(0, score));
}

/**
 * Enhance FullInvoice with confidence scores and evidence
 */
export function enhanceWithConfidence(invoice: FullInvoice, ocrText: string): FullInvoice {
  const ocrQuality = calculateOCRQuality(ocrText);
  const mathValidation = validateInvoiceMath(invoice);

  // Enhance header fields
  const enhancedHeader = { ...invoice.header };

  for (const [key, field] of Object.entries(enhancedHeader) as [
    keyof typeof enhancedHeader,
    FieldWithEvidence<any>
  ][]) {
    if (!field.evidence && field.value) {
      field.evidence = findEvidence(field.value, ocrText);
    }

    // Recalculate confidence based on signals
    const signals: Partial<ConfidenceSignal> = {
      ocrQuality,
      evidenceMatch: field.evidence ? 1 : 0,
    };

    // Add format validity
    if (key === "invoice_date" || key === "due_date") {
      signals.formatValidity = field.value && !isNaN(new Date(field.value).getTime()) ? 1 : 0;
    } else if (key === "subtotal" || key === "tax" || key === "total") {
      signals.formatValidity = typeof field.value === "number" && field.value >= 0 ? 1 : 0;
    }

    // Add math check for financial fields
    if (key === "total") {
      signals.mathCheck = mathValidation.totalMatch;
    } else if (key === "subtotal" && invoice.line_items.length > 0) {
      signals.mathCheck = mathValidation.lineItemsMatch;
    }

    field.confidence = calculateFieldConfidence(field.value, ocrText, signals);
  }

  return {
    ...invoice,
    header: enhancedHeader,
  };
}

import { createHash } from "node:crypto";

export type ConfidenceLabel = "high" | "medium" | "low";

export type ExtractedInvoiceFields = {
  vendor_name: string | null;
  vendor_name_confidence: ConfidenceLabel | null;
  invoice_number: string | null;
  invoice_number_confidence: ConfidenceLabel | null;
  invoice_date: string | null;
  invoice_date_confidence: ConfidenceLabel | null;
  subtotal: number | null;
  subtotal_confidence: ConfidenceLabel | null;
  tax: number | null;
  tax_confidence: ConfidenceLabel | null;
  total: number | null;
  total_confidence: ConfidenceLabel | null;
  po_number: string | null;
  po_number_confidence: ConfidenceLabel | null;
  currency: string | null;
  currency_confidence: ConfidenceLabel | null;
};

function pickConfidence(kind: "matched" | "inferred" | "fallback"): ConfidenceLabel {
  if (kind === "matched") return "high";
  if (kind === "inferred") return "medium";
  return "low";
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function normalizeMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function deriveDate(text: string): string | null {
  const matched = extractFirstMatch(text, [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
    /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/,
  ]);

  if (!matched) return null;

  const parsed = new Date(matched);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export async function runLlmExtraction(input: {
  text: string;
  fileName: string;
  fingerprint: string;
}): Promise<{ fields: ExtractedInvoiceFields; raw: Record<string, unknown> }> {
  const text = input.text;
  const lowerText = text.toLowerCase();
  const hashSeed = createHash("sha1").update(`${input.fileName}:${input.fingerprint}:${text}`).digest("hex");

  const vendorMatch = extractFirstMatch(text, [
    /\bvendor[:\-\s]+([A-Za-z0-9 &.,'/-]{2,})/i,
    /\bbilled\s+from[:\-\s]+([A-Za-z0-9 &.,'/-]{2,})/i,
    /\bfrom[:\-\s]+([A-Za-z0-9 &.,'/-]{2,})/i,
  ]);

  const invoiceNumberMatch = extractFirstMatch(text, [
    /\binvoice(?:\s*(?:no|number|#))[:\-\s]+([A-Z0-9-]{3,})\b/i,
    /\binv(?:\s*(?:no|number|#))[:\-\s]+([A-Z0-9-]{3,})\b/i,
  ]);

  const poNumberMatch = extractFirstMatch(text, [
    /\bpo(?:\s*(?:no|number|#))?[:\-\s]+([A-Z0-9-]{3,})/i,
    /\bpurchase\s*order[:\-\s]+([A-Z0-9-]{3,})/i,
  ]);

  const currencyMatch = extractFirstMatch(text, [
    /\b(usd|eur|gbp|cad|aud|inr|sgd|nzd|jpy)\b/i,
    /\b\$\b/i,
  ]);

  const subtotalMatch = extractFirstMatch(text, [
    /\bsubtotal[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
    /\bamount\s+before\s+tax[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  ]);

  const taxMatch = extractFirstMatch(text, [
    /\btax[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
    /\bv(?:at|alue-added\s+tax)[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  ]);

  const totalMatch = extractFirstMatch(text, [
    /\btotal[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
    /\bamount\s+due[:\-\s]*\$?([0-9][0-9,]*(?:\.[0-9]{2})?)/i,
  ]);

  const derivedSubtotal = subtotalMatch ? Number(subtotalMatch.replace(/,/g, "")) : null;
  const derivedTax = taxMatch ? Number(taxMatch.replace(/,/g, "")) : null;
  const derivedTotal = totalMatch ? Number(totalMatch.replace(/,/g, "")) : null;

  const fallbackBase = Number.parseInt(hashSeed.slice(0, 6), 16) % 5000;
  const subtotal = derivedSubtotal ?? normalizeMoney(100 + fallbackBase / 10);
  const tax = derivedTax ?? normalizeMoney(subtotal * 0.1);
  const total = derivedTotal ?? normalizeMoney(subtotal + tax);

  const date = deriveDate(text) ?? new Date().toISOString().slice(0, 10);

  const fields: ExtractedInvoiceFields = {
    vendor_name: vendorMatch ?? `Vendor ${input.fileName.replace(/\.[^.]+$/, "")}`,
    vendor_name_confidence: pickConfidence(vendorMatch ? "matched" : "fallback"),
    invoice_number: invoiceNumberMatch ?? `INV-${input.fingerprint.slice(0, 8).toUpperCase()}`,
    invoice_number_confidence: pickConfidence(invoiceNumberMatch ? "matched" : "fallback"),
    invoice_date: date,
    invoice_date_confidence: pickConfidence(deriveDate(text) ? "matched" : "inferred"),
    subtotal,
    subtotal_confidence: pickConfidence(subtotalMatch ? "matched" : "inferred"),
    tax,
    tax_confidence: pickConfidence(taxMatch ? "matched" : "inferred"),
    total,
    total_confidence: pickConfidence(totalMatch ? "matched" : "inferred"),
    po_number: poNumberMatch,
    po_number_confidence: poNumberMatch ? pickConfidence("matched") : null,
    currency: currencyMatch ? currencyMatch.toUpperCase() : "USD",
    currency_confidence: pickConfidence(currencyMatch ? "matched" : "inferred"),
  };

  return {
    fields,
    raw: {
      provider: "mock-llm",
      input_text_excerpt: text.slice(0, 2000),
      normalized_fields: fields,
      lower_text_has_invoice: lowerText.includes("invoice"),
    },
  };
}
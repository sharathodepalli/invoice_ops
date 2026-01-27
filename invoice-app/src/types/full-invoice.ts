/**
 * Comprehensive Invoice Schema
 * Canonical structure for all invoice data extraction
 */

export interface FieldWithEvidence<T> {
  value: T | null;
  confidence: "high" | "medium" | "low";
  evidence?: string | null; // Snippet from OCR text proving this value
}

export interface InvoiceHeader {
  vendor_name: FieldWithEvidence<string>;
  invoice_number: FieldWithEvidence<string>;
  invoice_date: FieldWithEvidence<string>; // ISO date string
  po_number: FieldWithEvidence<string>;
  currency: FieldWithEvidence<string>;
  subtotal: FieldWithEvidence<number>;
  tax: FieldWithEvidence<number>;
  total: FieldWithEvidence<number>;
  due_date: FieldWithEvidence<string>; // ISO date string
  payment_terms: FieldWithEvidence<string>;
}

export interface Party {
  name: string | null;
  address: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
}

export interface InvoiceParties {
  seller: Party;
  buyer: Party;
  ship_to: {
    name: string | null;
    address: string | null;
  };
}

export interface BankDetails {
  iban: string | null;
  swift: string | null;
  account_number: string | null;
  routing_number: string | null;
}

export interface PaymentInfo {
  method: string | null;
  bank_details: BankDetails;
  remittance_info: string | null;
}

export interface LineItem {
  description: string | null;
  sku: string | null;
  quantity: number | null;
  uom: string | null; // unit of measure
  unit_price: number | null;
  tax_rate: number | null;
  discount: number | null;
  line_total: number | null;
}

export interface TaxDetail {
  type: string | null; // "VAT", "Sales Tax", "GST", etc.
  rate: number | null;
  base: number | null; // taxable amount
  amount: number | null;
  tax_id: string | null;
}

export interface Discount {
  description: string | null;
  amount: number | null;
}

/**
 * Full Invoice Schema - Canonical output for all invoices
 */
export interface FullInvoice {
  header: InvoiceHeader;
  parties: InvoiceParties;
  payment: PaymentInfo;
  line_items: LineItem[];
  taxes: TaxDetail[];
  discounts: Discount[];
  notes: string[];
  raw_kv: Record<string, any>; // Catch-all for extra fields
}

/**
 * Helper to create empty field with evidence
 */
export function emptyField<T>(value: T | null = null): FieldWithEvidence<T> {
  return {
    value,
    confidence: "low",
    evidence: null,
  };
}

/**
 * Create empty FullInvoice with all null values
 */
export function createEmptyFullInvoice(): FullInvoice {
  return {
    header: {
      vendor_name: emptyField<string>(),
      invoice_number: emptyField<string>(),
      invoice_date: emptyField<string>(),
      po_number: emptyField<string>(),
      currency: emptyField<string>("USD"),
      subtotal: emptyField<number>(),
      tax: emptyField<number>(),
      total: emptyField<number>(),
      due_date: emptyField<string>(),
      payment_terms: emptyField<string>(),
    },
    parties: {
      seller: {
        name: null,
        address: null,
        tax_id: null,
        email: null,
        phone: null,
      },
      buyer: {
        name: null,
        address: null,
        tax_id: null,
        email: null,
        phone: null,
      },
      ship_to: {
        name: null,
        address: null,
      },
    },
    payment: {
      method: null,
      bank_details: {
        iban: null,
        swift: null,
        account_number: null,
        routing_number: null,
      },
      remittance_info: null,
    },
    line_items: [],
    taxes: [],
    discounts: [],
    notes: [],
    raw_kv: {},
  };
}

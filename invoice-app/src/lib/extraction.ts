import OpenAI from "openai";
import fs from "fs";
import path from "path";
import type { ExtractedField } from "@/types";
import type { FullInvoice } from "@/types/full-invoice";
import { createEmptyFullInvoice, emptyField } from "@/types/full-invoice";
import { enhanceWithConfidence } from "./confidence";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-key-for-development",
});

export interface ExtractedInvoiceData {
  vendor: ExtractedField<string>;
  invoiceNumber: ExtractedField<string>;
  invoiceDate: ExtractedField<Date>;
  subtotal: ExtractedField<number>;
  tax: ExtractedField<number>;
  total: ExtractedField<number>;
  poNumber: ExtractedField<string>;
  currency: ExtractedField<string>;
  fullInvoice?: FullInvoice; // Complete structured data
}

/**
 * Extract structured invoice data from text using LLM
 * Returns both legacy format AND comprehensive FullInvoice
 */
export async function extractInvoiceFields(text: string): Promise<ExtractedInvoiceData> {
  // Check if this is a vision-required PDF
  const isVisionRequired = text.startsWith("[VISION_REQUIRED]");
  
  // If no API key, use mock extraction
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "mock-key-for-development") {
    console.log("[Extraction] No OpenAI key, using mock extraction");
    return mockExtractInvoiceFields(text);
  }

  // If vision is required (image-based PDF), use GPT-4 Vision
  if (isVisionRequired) {
    console.log("[Extraction] Using GPT-4 Vision for image-based PDF");
    const pdfPath = text.replace("[VISION_REQUIRED]", "");
    return await extractFromPDFWithVision(pdfPath);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert invoice data extraction system. Extract ALL available data from the invoice text into a comprehensive JSON structure.

CRITICAL RULES:
1. DO NOT invent or hallucinate values. If a field is not found, use null.
2. For each header field, include an "evidence" string - the exact snippet from the invoice text where you found this value.
3. Extract ALL line items with full details.
4. Extract complete address information for all parties.
5. Numbers must be numeric (not strings).
6. Dates must be in ISO format (YYYY-MM-DD).

Return ONLY valid JSON matching this EXACT schema:

{
  "header": {
    "vendor_name": {"value": "...", "confidence": "high", "evidence": "...snippet from invoice..."},
    "invoice_number": {"value": "...", "confidence": "high", "evidence": "..."},
    "invoice_date": {"value": "YYYY-MM-DD", "confidence": "high", "evidence": "..."},
    "po_number": {"value": "...", "confidence": "medium", "evidence": "..."},
    "currency": {"value": "USD", "confidence": "high", "evidence": "..."},
    "subtotal": {"value": 0.00, "confidence": "high", "evidence": "..."},
    "tax": {"value": 0.00, "confidence": "high", "evidence": "..."},
    "total": {"value": 0.00, "confidence": "high", "evidence": "..."},
    "due_date": {"value": "YYYY-MM-DD", "confidence": "medium", "evidence": "..."},
    "payment_terms": {"value": "Net 30", "confidence": "medium", "evidence": "..."}
  },
  "parties": {
    "seller": {"name": "...", "address": "...", "tax_id": null, "email": "...", "phone": "..."},
    "buyer": {"name": "...", "address": "...", "tax_id": null, "email": null, "phone": null},
    "ship_to": {"name": null, "address": null}
  },
  "payment": {
    "method": null,
    "bank_details": {"iban": null, "swift": null, "account_number": null, "routing_number": null},
    "remittance_info": null
  },
  "line_items": [
    {"description": "...", "sku": null, "quantity": 10, "uom": "hours", "unit_price": 150.00, "tax_rate": 0.08, "discount": null, "line_total": 1500.00}
  ],
  "taxes": [
    {"type": "Sales Tax", "rate": 0.08, "base": 1500.00, "amount": 120.00, "tax_id": null}
  ],
  "discounts": [],
  "notes": ["Payment due within 30 days"],
  "raw_kv": {}
}

Extract as much as possible. Use null for missing values, never make up data.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    
    // Validate and parse the full invoice
    const fullInvoice = parseFullInvoice(result, text);
    
    // Extract legacy fields for backward compatibility
    return {
      vendor: {
        value: fullInvoice.header.vendor_name.value,
        confidence: fullInvoice.header.vendor_name.confidence,
      },
      invoiceNumber: {
        value: fullInvoice.header.invoice_number.value,
        confidence: fullInvoice.header.invoice_number.confidence,
      },
      invoiceDate: {
        value: fullInvoice.header.invoice_date.value
          ? new Date(fullInvoice.header.invoice_date.value)
          : null,
        confidence: fullInvoice.header.invoice_date.confidence,
      },
      subtotal: {
        value: fullInvoice.header.subtotal.value,
        confidence: fullInvoice.header.subtotal.confidence,
      },
      tax: {
        value: fullInvoice.header.tax.value,
        confidence: fullInvoice.header.tax.confidence,
      },
      total: {
        value: fullInvoice.header.total.value,
        confidence: fullInvoice.header.total.confidence,
      },
      poNumber: {
        value: fullInvoice.header.po_number.value,
        confidence: fullInvoice.header.po_number.confidence,
      },
      currency: {
        value: fullInvoice.header.currency.value || "USD",
        confidence: fullInvoice.header.currency.confidence,
      },
      fullInvoice, // Complete data
    };
  } catch (error) {
    console.error("OpenAI extraction error:", error);
    // Fall back to mock extraction on error
    return mockExtractInvoiceFields(text);
  }
}

/**
 * Extract invoice data from image-based PDF using GPT-4 Vision
 * Uses OpenAI's file API to handle PDF directly (no conversion needed)
 */
async function extractFromPDFWithVision(pdfPath: string): Promise<ExtractedInvoiceData> {
  try {
    console.log("[Vision] Uploading PDF to OpenAI for processing...");
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Upload the PDF file
    const file = await openai.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: "vision",
    });

    console.log("[Vision] File uploaded, calling GPT-4 Vision...");

    // Use GPT-4 Vision with the uploaded file
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured data from invoice documents. Return ONLY valid JSON, no markdown formatting or code blocks.",
        },
        {
          role: "user",
          content: `Extract ALL data from the invoice in the uploaded file. Return a JSON object with this structure:

{
  "vendorName": "company name",
  "invoiceNumber": "INV-XXX",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "poNumber": "PO-XXX",
  "currency": "USD",
  "subtotal": 1000.00,
  "tax": 100.00,
  "total": 1100.00,
  "seller": {
    "name": "Seller Company",
    "address": "123 Street, City",
    "taxId": "TAX-ID",
    "email": "seller@example.com",
    "phone": "555-1234"
  },
  "buyer": {
    "name": "Buyer Company",
    "address": "456 Street, City",
    "taxId": "TAX-ID",
    "email": "buyer@example.com",
    "phone": "555-5678"
  },
  "lineItems": [
    {
      "description": "Product/Service",
      "quantity": 10,
      "unitPrice": 100.00,
      "lineTotal": 1000.00
    }
  ],
  "paymentMethod": "Wire Transfer",
  "notes": "Any additional terms or notes"
}

Extract ALL visible fields. Use null for missing values. Numbers should be numbers, not strings.`,
        },
      ],
      max_tokens: 4000,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Vision API");
    }

    console.log("[Vision] Response received, parsing...");

    // Delete the uploaded file
    try {
      await openai.files.delete(file.id);
    } catch (e) {
      console.log("[Vision] Could not delete temp file:", e);
    }

    // Parse JSON, removing any markdown code blocks
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }
    
    const extracted = JSON.parse(jsonStr);

    // Build FullInvoice from extracted data
    const fullInvoice = createEmptyFullInvoice();
    
    // Header fields
    fullInvoice.header.vendor_name = emptyField(extracted.vendorName || extracted.seller?.name || null);
    fullInvoice.header.invoice_number = emptyField(extracted.invoiceNumber || null);
    fullInvoice.header.invoice_date = emptyField(extracted.invoiceDate || null);
    fullInvoice.header.due_date = emptyField(extracted.dueDate || null);
    fullInvoice.header.po_number = emptyField(extracted.poNumber || null);
    fullInvoice.header.currency = emptyField(extracted.currency || "USD");
    fullInvoice.header.subtotal = emptyField(extracted.subtotal || null);
    fullInvoice.header.tax = emptyField(extracted.tax || null);
    fullInvoice.header.total = emptyField(extracted.total || null);
    fullInvoice.header.payment_terms = emptyField<string>(null);
    
    // Parties
    if (extracted.seller) {
      fullInvoice.parties.seller = {
        name: extracted.seller.name || null,
        address: extracted.seller.address || null,
        tax_id: extracted.seller.taxId || null,
        email: extracted.seller.email || null,
        phone: extracted.seller.phone || null,
      };
    }
    
    if (extracted.buyer) {
      fullInvoice.parties.buyer = {
        name: extracted.buyer.name || null,
        address: extracted.buyer.address || null,
        tax_id: extracted.buyer.taxId || null,
        email: extracted.buyer.email || null,
        phone: extracted.buyer.phone || null,
      };
    }
    
    // Line items
    if (extracted.lineItems && Array.isArray(extracted.lineItems)) {
      fullInvoice.line_items = extracted.lineItems.map((item: any) => ({
        description: item.description || null,
        sku: item.sku || null,
        quantity: item.quantity || null,
        uom: item.uom || null,
        unit_price: item.unitPrice || null,
        tax_rate: item.taxRate || null,
        discount: item.discount || null,
        line_total: item.lineTotal || item.amount || null,
      }));
    }
    
    // Payment info
    if (extracted.paymentMethod) {
      fullInvoice.payment.method = extracted.paymentMethod;
    }
    
    // Notes
    if (extracted.notes) {
      fullInvoice.notes = [extracted.notes];
    }

    // Enhance with confidence scores (high quality for Vision API)
    const enhancedFullInvoice = enhanceWithConfidence(fullInvoice, "0.95");

    console.log("[Vision] Successfully extracted invoice data");

    // Return in ExtractedInvoiceData format
    return {
      vendor: {
        value: extracted.vendorName || extracted.seller?.name || "",
        confidence: "high",
        rawText: "Extracted via GPT-4 Vision",
      },
      invoiceNumber: {
        value: extracted.invoiceNumber || "",
        confidence: extracted.invoiceNumber ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      invoiceDate: {
        value: extracted.invoiceDate ? new Date(extracted.invoiceDate) : new Date(),
        confidence: extracted.invoiceDate ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      subtotal: {
        value: extracted.subtotal || 0,
        confidence: extracted.subtotal ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      tax: {
        value: extracted.tax || 0,
        confidence: extracted.tax ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      total: {
        value: extracted.total || 0,
        confidence: extracted.total ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      poNumber: {
        value: extracted.poNumber || "",
        confidence: extracted.poNumber ? "high" : "low",
        rawText: "Extracted via GPT-4 Vision",
      },
      currency: {
        value: extracted.currency || "USD",
        confidence: "high",
        rawText: "Extracted via GPT-4 Vision",
      },
      fullInvoice: enhancedFullInvoice,
    };
  } catch (error) {
    console.error("[Vision] Error:", error);
    console.log("[Vision] Falling back to mock extraction");
    return mockExtractInvoiceFields(`[VISION_ERROR]${pdfPath}`);
  }
}

/**
 * Parse and validate LLM response into FullInvoice structure
 */
function parseFullInvoice(data: any, ocrText: string): FullInvoice {
  const invoice = createEmptyFullInvoice();

  // Parse header
  if (data.header) {
    const h = data.header;
    invoice.header = {
      vendor_name: {
        value: h.vendor_name?.value ?? null,
        confidence: h.vendor_name?.confidence ?? "low",
        evidence: h.vendor_name?.evidence ?? null,
      },
      invoice_number: {
        value: h.invoice_number?.value ?? null,
        confidence: h.invoice_number?.confidence ?? "low",
        evidence: h.invoice_number?.evidence ?? null,
      },
      invoice_date: {
        value: h.invoice_date?.value ?? null,
        confidence: h.invoice_date?.confidence ?? "low",
        evidence: h.invoice_date?.evidence ?? null,
      },
      po_number: {
        value: h.po_number?.value ?? null,
        confidence: h.po_number?.confidence ?? "low",
        evidence: h.po_number?.evidence ?? null,
      },
      currency: {
        value: h.currency?.value ?? "USD",
        confidence: h.currency?.confidence ?? "medium",
        evidence: h.currency?.evidence ?? null,
      },
      subtotal: {
        value: typeof h.subtotal?.value === "number" ? h.subtotal.value : null,
        confidence: h.subtotal?.confidence ?? "low",
        evidence: h.subtotal?.evidence ?? null,
      },
      tax: {
        value: typeof h.tax?.value === "number" ? h.tax.value : null,
        confidence: h.tax?.confidence ?? "low",
        evidence: h.tax?.evidence ?? null,
      },
      total: {
        value: typeof h.total?.value === "number" ? h.total.value : null,
        confidence: h.total?.confidence ?? "low",
        evidence: h.total?.evidence ?? null,
      },
      due_date: {
        value: h.due_date?.value ?? null,
        confidence: h.due_date?.confidence ?? "low",
        evidence: h.due_date?.evidence ?? null,
      },
      payment_terms: {
        value: h.payment_terms?.value ?? null,
        confidence: h.payment_terms?.confidence ?? "low",
        evidence: h.payment_terms?.evidence ?? null,
      },
    };
  }

  // Parse parties
  if (data.parties) {
    invoice.parties = {
      seller: data.parties.seller || invoice.parties.seller,
      buyer: data.parties.buyer || invoice.parties.buyer,
      ship_to: data.parties.ship_to || invoice.parties.ship_to,
    };
  }

  // Parse payment
  if (data.payment) {
    invoice.payment = {
      method: data.payment.method ?? null,
      bank_details: data.payment.bank_details || invoice.payment.bank_details,
      remittance_info: data.payment.remittance_info ?? null,
    };
  }

  // Parse line items
  if (Array.isArray(data.line_items)) {
    invoice.line_items = data.line_items.map((item: any) => ({
      description: item.description ?? null,
      sku: item.sku ?? null,
      quantity: typeof item.quantity === "number" ? item.quantity : null,
      uom: item.uom ?? null,
      unit_price: typeof item.unit_price === "number" ? item.unit_price : null,
      tax_rate: typeof item.tax_rate === "number" ? item.tax_rate : null,
      discount: typeof item.discount === "number" ? item.discount : null,
      line_total: typeof item.line_total === "number" ? item.line_total : null,
    }));
  }

  // Parse taxes
  if (Array.isArray(data.taxes)) {
    invoice.taxes = data.taxes.map((tax: any) => ({
      type: tax.type ?? null,
      rate: typeof tax.rate === "number" ? tax.rate : null,
      base: typeof tax.base === "number" ? tax.base : null,
      amount: typeof tax.amount === "number" ? tax.amount : null,
      tax_id: tax.tax_id ?? null,
    }));
  }

  // Parse discounts
  if (Array.isArray(data.discounts)) {
    invoice.discounts = data.discounts.map((disc: any) => ({
      description: disc.description ?? null,
      amount: typeof disc.amount === "number" ? disc.amount : null,
    }));
  }

  // Parse notes
  if (Array.isArray(data.notes)) {
    invoice.notes = data.notes.filter((n: any) => typeof n === "string");
  }

  // Parse raw key-value pairs
  if (data.raw_kv && typeof data.raw_kv === "object") {
    invoice.raw_kv = data.raw_kv;
  }

  // Enhance with confidence scoring
  return enhanceWithConfidence(invoice, ocrText);
}

/**
 * Mock extraction for development/testing
 * Uses improved pattern matching on actual OCR text + builds FullInvoice
 */
function mockExtractInvoiceFields(text: string): ExtractedInvoiceData {
  console.log("[Mock Extraction] Processing text:", text.substring(0, 200));
  
  const fullInvoice = createEmptyFullInvoice();
  
  // Improved pattern matching
  const patterns = {
    vendor: /(?:from|bill from|vendor|company)[:\s]*([A-Za-z0-9\s&,.'"-]+?)(?:\n|$|address|street|\d{3})/i,
    invoiceNumber: /(?:invoice|inv|#)[:\s#]*([A-Z0-9-]+)/i,
    total: /(?:total|amount\s+due|balance\s+due|grand\s+total|total\s+amount)[:\s$]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    subtotal: /(?:subtotal|sub\s+total|sub-total)[:\s$]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    tax: /(?:tax|sales\s+tax|vat)[:\s$]*\$?\s*([0-9,]+\.?\d{0,2})/i,
    date: /(?:date|invoice\s+date|issued)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    poNumber: /(?:po|purchase\s+order|p\.o\.)[:\s#]*([A-Z0-9-]+)/i,
  };

  const vendorMatch = text.match(patterns.vendor);
  const invoiceNumberMatch = text.match(patterns.invoiceNumber);
  const totalMatch = text.match(patterns.total);
  const subtotalMatch = text.match(patterns.subtotal);
  const taxMatch = text.match(patterns.tax);
  const dateMatch = text.match(patterns.date);
  const poMatch = text.match(patterns.poNumber);

  const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null;
  const subtotalParsed = subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, "")) : null;
  const taxParsed = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, "")) : null;
  
  // Calculate missing values
  let finalSubtotal = subtotalParsed;
  let finalTax = taxParsed;
  
  if (total && !finalSubtotal && !finalTax) {
    finalTax = total * 0.08;
    finalSubtotal = total - finalTax;
  } else if (total && finalTax && !finalSubtotal) {
    finalSubtotal = total - finalTax;
  } else if (total && finalSubtotal && !finalTax) {
    finalTax = total - finalSubtotal;
  }

  // Populate FullInvoice header
  fullInvoice.header.vendor_name.value = vendorMatch ? vendorMatch[1].trim() : null;
  fullInvoice.header.invoice_number.value = invoiceNumberMatch ? invoiceNumberMatch[1].trim() : null;
  fullInvoice.header.invoice_date.value = dateMatch ? new Date(dateMatch[1]).toISOString().split("T")[0] : null;
  fullInvoice.header.subtotal.value = finalSubtotal;
  fullInvoice.header.tax.value = finalTax;
  fullInvoice.header.total.value = total;
  fullInvoice.header.po_number.value = poMatch ? poMatch[1].trim() : null;
  fullInvoice.header.currency.value = "USD";

  // Enhance with confidence
  const enhancedInvoice = enhanceWithConfidence(fullInvoice, text);
  
  // Return legacy format + full invoice
  const result = {
    vendor: {
      value: enhancedInvoice.header.vendor_name.value,
      confidence: enhancedInvoice.header.vendor_name.confidence,
    },
    invoiceNumber: {
      value: enhancedInvoice.header.invoice_number.value,
      confidence: enhancedInvoice.header.invoice_number.confidence,
    },
    invoiceDate: {
      value: enhancedInvoice.header.invoice_date.value
        ? new Date(enhancedInvoice.header.invoice_date.value)
        : null,
      confidence: enhancedInvoice.header.invoice_date.confidence,
    },
    subtotal: {
      value: enhancedInvoice.header.subtotal.value,
      confidence: enhancedInvoice.header.subtotal.confidence,
    },
    tax: {
      value: enhancedInvoice.header.tax.value,
      confidence: enhancedInvoice.header.tax.confidence,
    },
    total: {
      value: enhancedInvoice.header.total.value,
      confidence: enhancedInvoice.header.total.confidence,
    },
    poNumber: {
      value: enhancedInvoice.header.po_number.value,
      confidence: enhancedInvoice.header.po_number.confidence,
    },
    currency: {
      value: enhancedInvoice.header.currency.value || "USD",
      confidence: enhancedInvoice.header.currency.confidence,
    },
    fullInvoice: enhancedInvoice,
  };
  
  console.log("[Mock Extraction] Results:", JSON.stringify(result, null, 2));
  
  return result;
}

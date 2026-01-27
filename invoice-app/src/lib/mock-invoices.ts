import fs from "fs";
import path from "path";

/**
 * Seed script to create mock invoice data for demo/testing
 * Generates sample invoices with realistic vendor names and data
 */

interface MockInvoice {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal: number;
  tax: number;
  total: number;
  poNumber: string;
  currency: string;
}

const VENDORS = [
  "Acme Corporation",
  "Tech Solutions Inc",
  "Global Supplies Ltd",
  "Digital Systems Co",
  "Office Materials Plus",
  "Industrial Parts Wholesale",
  "Software Development Services",
  "Business Consulting Group",
  "Cloud Services Provider",
  "Marketing Agency Pro",
];

const generateMockInvoices = (count: number): MockInvoice[] => {
  const invoices: MockInvoice[] = [];

  for (let i = 0; i < count; i++) {
    const subtotal = Math.round(Math.random() * 9000 + 500) / 100;
    const tax = Math.round(subtotal * 0.1 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const invoiceNumber = `INV-${2024 + Math.floor(Math.random() * 2)}-${String(1000 + i).slice(-4)}`;
    const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const poNumber = `PO-${String(Math.floor(Math.random() * 100000)).padStart(6, "0")}`;

    invoices.push({
      vendor: VENDORS[Math.floor(Math.random() * VENDORS.length)],
      invoiceNumber,
      invoiceDate: date.toISOString().split("T")[0],
      subtotal,
      tax,
      total,
      poNumber,
      currency: "USD",
    });
  }

  return invoices;
};

/**
 * Generate HTML representation of invoice for PDF generation
 */
export const generateInvoiceHTML = (invoice: MockInvoice): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 8.5in; height: 11in; margin: 0 auto; padding: 0.5in; background: white; }
    header { border-bottom: 2px solid #333; margin-bottom: 2rem; padding-bottom: 1rem; }
    .company-name { font-size: 24px; font-weight: bold; margin-bottom: 0.25rem; }
    .invoice-title { font-size: 18px; font-weight: bold; margin-top: 1rem; }
    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 1.5rem 0; }
    .info-block { font-size: 14px; }
    .label { font-weight: bold; color: #555; margin-bottom: 0.25rem; }
    .value { margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    th { background-color: #f5f5f5; padding: 0.75rem; text-align: left; font-weight: bold; border-bottom: 2px solid #333; }
    td { padding: 0.75rem; border-bottom: 1px solid #ddd; }
    .text-right { text-align: right; }
    .total-row { background-color: #f9f9f9; font-weight: bold; }
    .summary { margin-top: 2rem; width: 50%; margin-left: auto; }
    .summary-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #ddd; }
    .summary-total { font-size: 18px; font-weight: bold; margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #333; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="company-name">${invoice.vendor}</div>
      <div style="color: #666; font-size: 14px;">Invoice Management System</div>
      <div class="invoice-title">INVOICE</div>
    </header>

    <div class="info-section">
      <div class="info-block">
        <div class="label">From:</div>
        <div class="value">${invoice.vendor}</div>
        <div class="value">123 Business Street</div>
        <div class="value">New York, NY 10001</div>
      </div>
      <div class="info-block">
        <div class="label">Bill To:</div>
        <div class="value">The Shades</div>
        <div class="value">456 Commerce Ave</div>
        <div class="value">Chicago, IL 60601</div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-block">
        <div class="label">Invoice Number:</div>
        <div class="value">${invoice.invoiceNumber}</div>
        <div class="label" style="margin-top: 1rem;">Invoice Date:</div>
        <div class="value">${invoice.invoiceDate}</div>
      </div>
      <div class="info-block">
        <div class="label">PO Number:</div>
        <div class="value">${invoice.poNumber}</div>
        <div class="label" style="margin-top: 1rem;">Due Date:</div>
        <div class="value">${invoice.invoiceDate}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Professional Services</td>
          <td class="text-right">\$${invoice.subtotal.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>Subtotal</td>
          <td class="text-right">\$${invoice.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Tax (10%)</td>
          <td class="text-right">\$${invoice.tax.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Amount Due</td>
          <td class="text-right">\$${invoice.total.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Subtotal:</span>
        <span>\$${invoice.subtotal.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Tax:</span>
        <span>\$${invoice.tax.toFixed(2)}</span>
      </div>
      <div class="summary-total">
        <div class="summary-row">
          <span>TOTAL DUE:</span>
          <span>\$${invoice.total.toFixed(2)} ${invoice.currency}</span>
        </div>
      </div>
    </div>

    <footer>
      <p>Thank you for your business! Please make payment within 30 days.</p>
      <p style="margin-top: 0.5rem;">Generated by Invoice Automation System • ${new Date().toLocaleDateString()}</p>
    </footer>
  </div>
</body>
</html>
  `;
};

// Generate 12 mock invoices
const mockInvoices = generateMockInvoices(12);

// Export for use in other files
export { mockInvoices, generateMockInvoices };

// Log summary
console.log("✅ Mock Invoice Generator");
console.log(`Generated ${mockInvoices.length} sample invoices`);
console.log("\nSample invoice:");
console.log(JSON.stringify(mockInvoices[0], null, 2));

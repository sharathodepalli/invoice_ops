import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceIds, userId = "demo-user", userName = "Demo User", format = "header" } = body;

    if (!invoiceIds || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "No invoices selected for export" },
        { status: 400 }
      );
    }

    // Fetch approved invoices
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .in("id", invoiceIds)
      .eq("status", "approved");

    if (error) throw error;

    if (!invoices || invoices.length === 0) {
      return NextResponse.json(
        { error: "No approved invoices found" },
        { status: 404 }
      );
    }

    // Generate CSV based on format
    const csv = format === "line-items" 
      ? generateLineItemsCSV(invoices) 
      : generateHeaderCSV(invoices);

    // Create export record
    const exportRecord = {
      invoice_ids: invoiceIds,
      exported_by: userId,
      exported_by_name: userName,
      file_name: `invoices_export_${format}_${Date.now()}.csv`,
      record_count: invoices.length,
      exported_at: new Date().toISOString(),
    };

    const { data: exportData, error: exportError } = await supabase
      .from("export_records")
      .insert(exportRecord)
      .select()
      .single();

    if (exportError) throw exportError;

    // Mark invoices as exported
    await supabase
      .from("invoices")
      .update({ exported_at: new Date().toISOString(), status: "exported" })
      .in("id", invoiceIds);

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${exportRecord.file_name}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export invoices" },
      { status: 500 }
    );
  }
}

/**
 * Generate header-only CSV (one row per invoice)
 */
function generateHeaderCSV(invoices: any[]): string {
  // CSV Headers
  const headers = [
    "Invoice ID",
    "Vendor",
    "Invoice Number",
    "Invoice Date",
    "Subtotal",
    "Tax",
    "Total",
    "PO Number",
    "Currency",
    "Status",
    "Exported At",
  ];

  // CSV Rows
  const rows = invoices.map((inv) => {
    return [
      inv.id,
      inv.vendor_value || "",
      inv.invoice_number_value || "",
      inv.invoice_date_value || "",
      inv.subtotal_value || 0,
      inv.tax_value || 0,
      inv.total_value || 0,
      inv.po_number_value || "",
      inv.currency_value || "USD",
      inv.status,
      new Date().toISOString(),
    ].map(escapeCSVField);
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Generate line-item CSV (one row per line item, invoice header repeated)
 */
function generateLineItemsCSV(invoices: any[]): string {
  // CSV Headers
  const headers = [
    "Invoice ID",
    "Vendor",
    "Invoice Number",
    "Invoice Date",
    "PO Number",
    "Currency",
    "Line Description",
    "SKU",
    "Quantity",
    "UOM",
    "Unit Price",
    "Tax Rate",
    "Discount",
    "Line Total",
    "Invoice Subtotal",
    "Invoice Tax",
    "Invoice Total",
    "Exported At",
  ];

  const rows: string[][] = [];
  const exportedAt = new Date().toISOString();

  for (const inv of invoices) {
    const fullInvoice = inv.extracted_json;
    const lineItems = fullInvoice?.line_items || [];

    // If no line items, create one row with header data only
    if (lineItems.length === 0) {
      rows.push([
        inv.id,
        inv.vendor_value || "",
        inv.invoice_number_value || "",
        inv.invoice_date_value || "",
        inv.po_number_value || "",
        inv.currency_value || "USD",
        "", // Line Description
        "", // SKU
        "", // Quantity
        "", // UOM
        "", // Unit Price
        "", // Tax Rate
        "", // Discount
        "", // Line Total
        inv.subtotal_value || 0,
        inv.tax_value || 0,
        inv.total_value || 0,
        exportedAt,
      ].map(escapeCSVField));
    } else {
      // Create one row per line item
      for (const item of lineItems) {
        rows.push([
          inv.id,
          inv.vendor_value || "",
          inv.invoice_number_value || "",
          inv.invoice_date_value || "",
          inv.po_number_value || "",
          inv.currency_value || "USD",
          item.description || "",
          item.sku || "",
          item.quantity ?? "",
          item.uom || "",
          item.unit_price ?? "",
          item.tax_rate ? (item.tax_rate * 100).toFixed(2) + "%" : "",
          item.discount ?? "",
          item.line_total ?? "",
          inv.subtotal_value || 0,
          inv.tax_value || 0,
          inv.total_value || 0,
          exportedAt,
        ].map(escapeCSVField));
      }
    }
  }

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Escape CSV field values
 */
function escapeCSVField(field: any): string {
  const str = String(field ?? "");
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  // Combine headers and rows
  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  return csvContent;
}

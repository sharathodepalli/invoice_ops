import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(
        `
        *,
        jobs (
          id,
          filename,
          file_size,
          status,
          uploaded_at
        ),
        validation_flags (
          id,
          type,
          severity,
          field,
          message,
          details
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        pdfUrl: invoice.pdf_url,
        job: invoice.jobs,
        fields: {
          vendor: {
            value: invoice.vendor_value,
            confidence: invoice.vendor_confidence,
          },
          invoiceNumber: {
            value: invoice.invoice_number_value,
            confidence: invoice.invoice_number_confidence,
          },
          invoiceDate: {
            value: invoice.invoice_date_value,
            confidence: invoice.invoice_date_confidence,
          },
          subtotal: {
            value: invoice.subtotal_value,
            confidence: invoice.subtotal_confidence,
          },
          tax: {
            value: invoice.tax_value,
            confidence: invoice.tax_confidence,
          },
          total: {
            value: invoice.total_value,
            confidence: invoice.total_confidence,
          },
          poNumber: {
            value: invoice.po_number_value,
            confidence: invoice.po_number_confidence,
          },
          currency: {
            value: invoice.currency_value,
            confidence: invoice.currency_confidence,
          },
        },
        fullInvoice: invoice.extracted_json || null, // Complete structured data
        validationFlags: invoice.validation_flags || [],
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
      },
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

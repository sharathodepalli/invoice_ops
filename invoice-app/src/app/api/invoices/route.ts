import { NextRequest, NextResponse } from "next/server";
import { getInvoices } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status = statusParam ? statusParam.split(",") : undefined;

    const invoices = await getInvoices({ status, limit: 100 });

    return NextResponse.json({
      success: true,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        filename: invoice.jobs?.filename,
        vendor: invoice.vendor_value,
        invoiceNumber: invoice.invoice_number_value,
        total: invoice.total_value,
        currency: invoice.currency_value,
        createdAt: invoice.created_at,
      })),
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

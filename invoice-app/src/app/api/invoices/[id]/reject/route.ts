import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceStatus, createAuditLog } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { reason, user } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Update invoice status to rejected
    const invoice = await updateInvoiceStatus(params.id, "rejected");

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Create audit log
    await createAuditLog({
      invoiceId: params.id,
      action: "rejected",
      userId: user?.id || "system",
      userName: user?.name || "System User",
      comment: reason,
      fieldChanges: [],
    });

    return NextResponse.json({ 
      success: true,
      invoice,
      message: "Invoice rejected"
    });
  } catch (error) {
    console.error("Error rejecting invoice:", error);
    return NextResponse.json(
      { error: "Failed to reject invoice" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceStatus, createAuditLog } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { comment, user } = body;

    // Update invoice status to approved
    const invoice = await updateInvoiceStatus(params.id, "approved");

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Create audit log
    await createAuditLog({
      invoiceId: params.id,
      action: "approved",
      userId: user?.id || "system",
      userName: user?.name || "System User",
      comment: comment || "Invoice approved",
      fieldChanges: [],
    });

    return NextResponse.json({ 
      success: true,
      invoice,
      message: "Invoice approved successfully"
    });
  } catch (error) {
    console.error("Error approving invoice:", error);
    return NextResponse.json(
      { error: "Failed to approve invoice" },
      { status: 500 }
    );
  }
}

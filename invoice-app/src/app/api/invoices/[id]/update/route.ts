import { NextRequest, NextResponse } from "next/server";
import { updateInvoiceFields, createAuditLog } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { fields, user } = body;

    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Invalid field data" },
        { status: 400 }
      );
    }

    // Update invoice fields
    const invoice = await updateInvoiceFields(params.id, fields);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Create audit log
    await createAuditLog({
      invoiceId: params.id,
      action: "updated",
      userId: user?.id || "system",
      userName: user?.name || "System User",
      comment: "Fields manually edited",
      fieldChanges: [fields],
    });

    return NextResponse.json({ 
      success: true,
      invoice,
      message: "Invoice updated successfully"
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

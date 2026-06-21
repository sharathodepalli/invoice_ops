import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { buildExportFileName, buildInvoiceExportCsv } from "@/lib/csv-export";
import { createExportRecord, listExportRecords } from "@/lib/export-history-store";
import { listInvoices } from "@/lib/invoices-store";
import { buildRequestLogContext, logRequestEvent, resolveRequestId } from "@/lib/request-logger";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    { status },
  );
}

export async function GET(req: Request) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/exports", null, requestId);
  try {
    verifyAuth(req, "admin");
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    if (limitParam && Number.isNaN(limit)) {
      logRequestEvent("warn", logContext, "export_history_rejected", { reason: "invalid_limit" });
      return errorResponse("invalid_limit", "Limit must be a valid number.", 400, requestId);
    }

    const records = await listExportRecords(limit);
    logRequestEvent("info", logContext, "export_history_loaded", { record_count: records.length });
    return NextResponse.json({ export_records: records }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "export_history_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "export_history_failed");
    return errorResponse("export_history_failed", "Failed to load export history.", 500, requestId);
  }
}

export async function GET_READY(req: Request) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/exports/ready", null, requestId);
  try {
    verifyAuth(req, "admin");

    const [approvedInvoices, exportRecords] = await Promise.all([
      listInvoices({ status: "approved", limit: 100 }),
      listExportRecords(20),
    ]);

    return NextResponse.json(
      {
        approved_invoices: approvedInvoices.invoices.map((invoice) => ({
          invoice_id: invoice.invoice_id,
          vendor_name: invoice.vendor_name,
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          currency: invoice.currency,
          approved_at: invoice.approved_at,
          approved_by: invoice.approved_by,
        })),
        export_records: exportRecords,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "export_ready_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "export_ready_failed");
    return errorResponse("export_ready_failed", "Failed to load export data.", 500, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/exports", null, requestId);
  try {
    const claims = verifyAuth(req, "admin");
    const payload = (await req.json()) as { invoice_ids?: string[] };
    const requestedIds = Array.isArray(payload.invoice_ids) ? payload.invoice_ids.filter((value) => typeof value === "string") : [];

    const approvedInvoices = await listInvoices({ status: "approved", limit: 100 });
    const availableById = new Map(approvedInvoices.invoices.map((invoice) => [invoice.invoice_id, invoice]));

    const selectedInvoices = requestedIds.length > 0
      ? requestedIds.map((invoiceId) => availableById.get(invoiceId)).filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice))
      : approvedInvoices.invoices;

    if (requestedIds.length > 0 && selectedInvoices.length !== requestedIds.length) {
      logRequestEvent("warn", logContext, "export_rejected", { reason: "invalid_selection", selected_count: requestedIds.length });
      return errorResponse("invalid_selection", "Only approved invoices can be exported.", 400, requestId);
    }

    if (selectedInvoices.length === 0) {
      logRequestEvent("warn", logContext, "export_rejected", { reason: "no_exportable_invoices" });
      return errorResponse("no_exportable_invoices", "No approved invoices are available for export.", 400, requestId);
    }

    const exportedAt = new Date().toISOString();
    const fileName = buildExportFileName(exportedAt);
    const csv = buildInvoiceExportCsv(selectedInvoices);

    const record = await createExportRecord({
      invoiceIds: selectedInvoices.map((invoice) => invoice.invoice_id),
      fileName,
      recordCount: selectedInvoices.length,
      exportedBy: claims.subject,
      exportedAt,
    });

    logRequestEvent("info", logContext, "export_created", { record_count: selectedInvoices.length, file_name: fileName });

    return NextResponse.json(
      {
        export_record: record,
        file_name: fileName,
        csv,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "export_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "export_failed");
    return errorResponse("export_failed", "Failed to export invoices.", 500, requestId);
  }
}

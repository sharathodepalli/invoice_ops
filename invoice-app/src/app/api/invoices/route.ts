import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { listInvoices, type InvoiceStatus } from "@/lib/invoices-store";
import { buildRequestLogContext, logRequestEvent, resolveRequestId } from "@/lib/request-logger";

export const runtime = "nodejs";

const VALID_STATUSES: Array<InvoiceStatus> = ["pending", "exception", "approved", "rejected", "exported"];

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
  const logContext = buildRequestLogContext(req, "/api/invoices", null, requestId);
  try {
    verifyAuth(req, "admin");
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "invoice_list_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "invoice_list_failed");
    return errorResponse("invoice_list_failed", "Failed to load invoices.", 500, requestId);
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search") ?? undefined;
  const limitParam = searchParams.get("limit");
  const cursor = searchParams.get("cursor") ?? undefined;

  if (statusParam && !VALID_STATUSES.includes(statusParam as InvoiceStatus)) {
    logRequestEvent("warn", logContext, "invoice_list_rejected", { reason: "invalid_status", status: statusParam });
    return errorResponse("invalid_status", "Invalid invoice status query parameter.", 400, requestId);
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  if (limitParam && Number.isNaN(limit)) {
    logRequestEvent("warn", logContext, "invoice_list_rejected", { reason: "invalid_limit", limit: limitParam });
    return errorResponse("invalid_limit", "Limit must be a valid number.", 400, requestId);
  }

  const result = await listInvoices({
    status: statusParam as InvoiceStatus | undefined,
    search,
    limit,
    cursor,
  });

  logRequestEvent("info", logContext, "invoice_list_loaded", { invoice_count: result.invoices.length, has_next_cursor: Boolean(result.next_cursor) });
  return NextResponse.json(result, { status: 200 });
}
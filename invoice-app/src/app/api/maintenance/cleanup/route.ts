import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { buildRequestLogContext, logRequestEvent, resolveRequestId } from "@/lib/request-logger";
import { runRetentionCleanup } from "@/lib/retention-cleanup";

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

export async function POST(req: Request) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/maintenance/cleanup", null, requestId);

  try {
    verifyAuth(req, "system");
    const { searchParams } = new URL(req.url);
    const parseRetentionDays = (value: string | null, defaultValue: number, field: string) => {
      if (value === null) return { value: defaultValue, error: null };

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 3650) {
        return { value: defaultValue, error: `${field} must be a positive integer between 1 and 3650.` };
      }

      return { value: parsed, error: null };
    };

    const auditLogRetention = parseRetentionDays(searchParams.get("audit_log_days"), 30, "audit_log_days");
    const exportRecordRetention = parseRetentionDays(searchParams.get("export_record_days"), 90, "export_record_days");
    const uploadRetention = parseRetentionDays(searchParams.get("upload_days"), 14, "upload_days");

    const validationError = auditLogRetention.error ?? exportRecordRetention.error ?? uploadRetention.error;
    if (validationError) {
      logRequestEvent("warn", logContext, "retention_cleanup_rejected", { reason: "invalid_retention_window" });
      return errorResponse("invalid_retention_window", validationError, 400, requestId);
    }

    const result = await runRetentionCleanup({
      auditLogRetentionDays: auditLogRetention.value,
      exportRecordRetentionDays: exportRecordRetention.value,
      uploadRetentionDays: uploadRetention.value,
    });

    logRequestEvent("info", logContext, "retention_cleanup_complete", result);
    return NextResponse.json({ cleanup: result }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "retention_cleanup_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "retention_cleanup_failed");
    return errorResponse("cleanup_failed", "Failed to run retention cleanup.", 500, requestId);
  }
}
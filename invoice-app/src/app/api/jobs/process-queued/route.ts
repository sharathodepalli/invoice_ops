import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { processQueuedJobs } from "@/lib/extraction/pipeline";
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

export async function POST(req: Request) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/jobs/process-queued", null, requestId);
  try {
    verifyAuth(req, "system");
    const result = await processQueuedJobs();
    logRequestEvent("info", logContext, "queued_jobs_processed", { processed_count: result.processed_count, error_count: result.errors.length });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "process_queued_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "process_queued_failed");
    return errorResponse("processing_failed", "Failed to process queued jobs.", 500, requestId);
  }
}
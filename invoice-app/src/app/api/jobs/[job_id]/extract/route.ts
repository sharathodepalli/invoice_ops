import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { extractJob, ExtractionError } from "@/lib/extraction/pipeline";
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

export async function PUT(req: Request, context: { params: Promise<{ job_id: string }> }) {
  const requestId = resolveRequestId(req);
  const logContext = buildRequestLogContext(req, "/api/jobs/[job_id]/extract", null, requestId);
  try {
    verifyAuth(req, "admin");
    const { job_id: jobId } = await context.params;
    const result = await extractJob(jobId);
    logRequestEvent("info", logContext, "job_extracted", { job_id: jobId, status: result.job.status });

    return NextResponse.json(
      {
        job_id: result.job.job_id,
        status: result.job.status,
        invoice_id: result.invoiceId,
        extracted_fields: result.fields,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", logContext, "job_extract_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    if (error instanceof ExtractionError) {
      logRequestEvent("warn", logContext, "job_extract_failed", { reason: error.code, status: error.status });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    logRequestEvent("error", logContext, "job_extract_failed", { reason: "extraction_failed" });
    return errorResponse("extraction_failed", "Failed to extract invoice.", 500, requestId);
  }
}
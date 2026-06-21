import { NextResponse } from "next/server";
import {
  buildIdempotencyKey,
  buildUploadId,
  createJobsForUpload,
  getJobById,
  persistUploadFile,
} from "@/lib/jobs-store";
import { extractJob } from "@/lib/extraction/pipeline";
import { isLikelyPdf, UPLOAD_LIMITS } from "@/lib/upload-config";
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
  const logContext = buildRequestLogContext(req, "/api/upload", null, requestId);
  try {
    const form = await req.formData();
    const files = form.getAll("files[]");

    if (!files.length) {
      logRequestEvent("warn", logContext, "upload_rejected", { reason: "no_files" });
      return errorResponse("invalid_file_type", "No files provided.", 400, requestId);
    }

    if (files.length > UPLOAD_LIMITS.maxBatchFiles) {
      logRequestEvent("warn", logContext, "upload_rejected", { reason: "batch_limit_exceeded", file_count: files.length });
      return errorResponse(
        "batch_limit_exceeded",
        `Batch limit is ${UPLOAD_LIMITS.maxBatchFiles} files.`,
        400,
        requestId,
      );
    }

    const parsedFiles: Array<{ file: File; name: string; size: number }> = [];

    for (const entry of files) {
      if (!(entry instanceof File)) {
        logRequestEvent("warn", logContext, "upload_rejected", { reason: "invalid_payload" });
        return errorResponse("invalid_file_type", "Invalid file payload.", 400, requestId);
      }

      if (!isLikelyPdf(entry.name, entry.type)) {
        logRequestEvent("warn", logContext, "upload_rejected", { reason: "invalid_file_type", file_name: entry.name });
        return errorResponse(
          "invalid_file_type",
          `Only PDF files are allowed. Invalid file: ${entry.name}`,
          400,
          requestId,
        );
      }

      if (entry.size > UPLOAD_LIMITS.maxFileSizeBytes) {
        logRequestEvent("warn", logContext, "upload_rejected", { reason: "file_too_large", file_name: entry.name, file_size_bytes: entry.size });
        return errorResponse(
          "file_too_large",
          `File ${entry.name} exceeds ${UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)}MB limit.`,
          400,
          requestId,
        );
      }

      parsedFiles.push({ file: entry, name: entry.name, size: entry.size });
    }

    const uploadId = buildUploadId();
    const forCreate: Array<{
      fileName: string;
      fileSizeBytes: number;
      fileUrl: string;
      idempotencyKey: string;
    }> = [];

    for (const item of parsedFiles) {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const fileUrl = await persistUploadFile(uploadId, item.name, bytes);
      forCreate.push({
        fileName: item.name,
        fileSizeBytes: item.size,
        fileUrl,
        idempotencyKey: buildIdempotencyKey(uploadId, item.name),
      });
    }

    const createdJobs = await createJobsForUpload({
      uploadId,
      files: forCreate,
    });

    const jobs = [] as typeof createdJobs;
    for (const job of createdJobs) {
      try {
        const extracted = await extractJob(job.job_id);
        jobs.push(extracted.job);
      } catch {
        jobs.push((await getJobById(job.job_id)) ?? job);
      }
    }

    return NextResponse.json(
      {
        upload_id: uploadId,
        jobs: jobs.map((job) => ({
          job_id: job.job_id,
          filename: job.filename,
          status: job.status,
        })),
      },
      { status: 201 },
    );
  } catch {
    logRequestEvent("error", logContext, "upload_failed");
    return errorResponse("upload_failed", "Failed to process upload request.", 500, requestId);
  }
}

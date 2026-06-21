import { NextResponse } from "next/server";
import { listJobs, type JobStatus } from "@/lib/jobs-store";

export const runtime = "nodejs";

const VALID_STATUSES: JobStatus[] = [
  "queued",
  "processing",
  "extracted",
  "validated",
  "failed",
];

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: crypto.randomUUID(),
      },
    },
    { status },
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const cursor = searchParams.get("cursor") ?? undefined;

  if (statusParam && !VALID_STATUSES.includes(statusParam as JobStatus)) {
    return errorResponse("invalid_status", "Invalid status query parameter.", 400);
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  if (limitParam && Number.isNaN(limit)) {
    return errorResponse("invalid_limit", "Limit must be a valid number.", 400);
  }

  const result = await listJobs({
    status: statusParam as JobStatus | undefined,
    limit,
    cursor,
  });

  return NextResponse.json(result, { status: 200 });
}

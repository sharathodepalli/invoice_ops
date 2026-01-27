import { NextRequest, NextResponse } from "next/server";
import { getJobs } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const jobs = await getJobs(100);

    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        filename: job.filename,
        fileSize: job.fileSize,
        status: job.status,
        uploadedAt: job.uploadedAt.toISOString(),
        processedAt: job.processedAt?.toISOString(),
        errorMessage: job.errorMessage,
      })),
    });
  } catch (error) {
    console.error("Get jobs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

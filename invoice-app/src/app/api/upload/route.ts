import { NextRequest, NextResponse } from "next/server";
import { storeFile, validatePdfFile } from "@/lib/storage";
import { createJob, createInvoice } from "@/lib/db";
import { processInvoiceJob } from "@/lib/processor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Store file
    const fileResult = await storeFile(file);

    // Create job record
    const job = await createJob({
      filename: file.name,
      fileSize: file.size,
      fileUrl: fileResult.url,
      // userId: "demo-user", // Removed - will be null until auth is added
    });

    // Create invoice record
    const invoiceId = await createInvoice({
      jobId: job.id,
      pdfUrl: fileResult.url,
    });

    // Trigger background processing (async, don't wait)
    processInvoiceJob(job.id, invoiceId, fileResult.path).catch((error) => {
      console.error("Background processing error:", error);
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        filename: job.filename,
        status: job.status,
      },
      invoiceId,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // This endpoint can be used to get upload status
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    // TODO: Implement job status check
    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}

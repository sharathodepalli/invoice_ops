import { promises as fs } from "node:fs";
import path from "node:path";
import { getJobById, listJobs, updateJobStatus, type JobRecord } from "@/lib/jobs-store";
import { getInvoiceByJobId, upsertInvoiceForJob } from "@/lib/invoices-store";
import { runLlmExtraction } from "@/lib/extraction/llm-extractor";
import { runOcr } from "@/lib/extraction/ocr-service";
import { validateInvoice } from "@/lib/validation-engine";

export class ExtractionError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ExtractionError";
    this.status = status;
    this.code = code;
  }
}

function resolveLocalFilePath(fileUrl: string): string {
  if (fileUrl.startsWith("/")) {
    return path.join(process.cwd(), fileUrl.slice(1));
  }

  return path.isAbsolute(fileUrl) ? fileUrl : path.join(process.cwd(), fileUrl);
}

async function readJobFile(job: JobRecord): Promise<Uint8Array> {
  const filePath = resolveLocalFilePath(job.file_url);
  try {
    return new Uint8Array(await fs.readFile(filePath));
  } catch {
    throw new ExtractionError(404, "job_file_not_found", "Could not find uploaded PDF for this job.");
  }
}

async function finishFailedJob(jobId: string, message: string): Promise<void> {
  await updateJobStatus({ jobId, status: "failed", errorMessage: message });
}

export async function extractJob(jobId: string): Promise<{
  job: JobRecord;
  invoiceId: string;
  fields: Record<string, unknown>;
}> {
  const existingInvoice = await getInvoiceByJobId(jobId);
  const currentJob = await getJobById(jobId);

  if (!currentJob) {
    throw new ExtractionError(404, "job_not_found", "Job not found.");
  }

  if (currentJob.status === "processing") {
    throw new ExtractionError(409, "job_already_processing", "Job is already being processed.");
  }

  if (existingInvoice && currentJob.status === "extracted") {
    return {
      job: currentJob,
      invoiceId: existingInvoice.invoice_id,
      fields: existingInvoice.raw_extraction_json,
    };
  }

  await updateJobStatus({ jobId, status: "processing", errorMessage: null });

  try {
    const job = (await getJobById(jobId)) ?? currentJob;
    const bytes = await readJobFile(job);
    const ocr = await runOcr(bytes, job.filename);
    const llm = await runLlmExtraction({
      text: ocr.text,
      fileName: job.filename,
      fingerprint: ocr.fingerprint,
    });

    const invoice = await upsertInvoiceForJob({
      jobId,
      pdfUrl: job.file_url,
      status: "pending",
      vendor_name: llm.fields.vendor_name,
      vendor_name_confidence: llm.fields.vendor_name_confidence,
      invoice_number: llm.fields.invoice_number,
      invoice_number_confidence: llm.fields.invoice_number_confidence,
      invoice_date: llm.fields.invoice_date,
      invoice_date_confidence: llm.fields.invoice_date_confidence,
      subtotal: llm.fields.subtotal,
      subtotal_confidence: llm.fields.subtotal_confidence,
      tax: llm.fields.tax,
      tax_confidence: llm.fields.tax_confidence,
      total: llm.fields.total,
      total_confidence: llm.fields.total_confidence,
      po_number: llm.fields.po_number,
      po_number_confidence: llm.fields.po_number_confidence,
      currency: llm.fields.currency,
      currency_confidence: llm.fields.currency_confidence,
      raw_extraction_json: {
        ocr,
        llm,
        job_id: jobId,
      },
    });

    const validated = await validateInvoice(jobId);

    const updated = await updateJobStatus({
      jobId,
      status: "validated",
      errorMessage: null,
    });

    if (!updated) {
      throw new ExtractionError(500, "job_update_failed", "Unable to update job status.");
    }

    return {
      job: updated,
      invoiceId: invoice.invoice_id,
      fields: {
        extraction: invoice.raw_extraction_json,
        validation_flags: validated.flags,
        final_status: validated.invoice.status,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    await finishFailedJob(jobId, message);

    if (error instanceof ExtractionError) {
      throw error;
    }

    throw new ExtractionError(500, "extraction_failed", message);
  }
}

export async function processQueuedJobs(): Promise<{
  processed_count: number;
  errors: Array<{ job_id: string; error_code: string; message: string }>;
}> {
  const page = await listJobs({ status: "queued", limit: 100 });
  const errors: Array<{ job_id: string; error_code: string; message: string }> = [];
  let processedCount = 0;

  for (const job of page.jobs) {
    try {
      await extractJob(job.job_id);
      processedCount += 1;
    } catch (error) {
      if (error instanceof ExtractionError) {
        errors.push({
          job_id: job.job_id,
          error_code: error.code,
          message: error.message,
        });
        continue;
      }

      errors.push({
        job_id: job.job_id,
        error_code: "extraction_failed",
        message: error instanceof Error ? error.message : "Extraction failed.",
      });
    }
  }

  return { processed_count: processedCount, errors };
}
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { getInvoiceByJobId, upsertInvoiceForJob } from "@/lib/invoices-store";
import { validateInvoice } from "@/lib/validation-engine";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("validation-engine", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("marks a clean invoice as pending and stores no flags", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 clean invoice"));
    const fileUrl = await persistUploadFile(uploadId, "clean.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "clean.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "clean.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      vendor_name: "Acme Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-1001",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-17",
      invoice_date_confidence: "high",
      subtotal: 100,
      subtotal_confidence: "high",
      tax: 10,
      tax_confidence: "high",
      total: 110,
      total_confidence: "high",
      po_number: "PO-1",
      po_number_confidence: "medium",
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
    });

    const result = await validateInvoice(job.job_id);
    expect(result.flags).toHaveLength(0);
    expect(result.invoice.status).toBe("pending");

    const invoice = await getInvoiceByJobId(job.job_id);
    expect(invoice?.status).toBe("pending");
  });

  it("flags mismatched totals and missing po number", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 mismatch invoice"));
    const fileUrl = await persistUploadFile(uploadId, "mismatch.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "mismatch.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "mismatch.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      vendor_name: "Broken Corp",
      vendor_name_confidence: "medium",
      invoice_number: "INV-DUP-1",
      invoice_number_confidence: "medium",
      invoice_date: "2026-05-17",
      invoice_date_confidence: "medium",
      subtotal: 100,
      subtotal_confidence: "medium",
      tax: 10,
      tax_confidence: "medium",
      total: 50,
      total_confidence: "low",
      po_number: null,
      po_number_confidence: null,
      currency: "usd",
      currency_confidence: "low",
      raw_extraction_json: { source: "test" },
    });

    const result = await validateInvoice(job.job_id);
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
    expect(result.invoice.status).toBe("exception");
    expect(result.flags.some((flag) => flag.field === "total")).toBe(true);
    expect(result.flags.some((flag) => flag.field === "po_number")).toBe(true);
  });

  it("flags a real duplicate invoice candidate", async () => {
    const firstUploadId = buildUploadId();
    const firstBytes = new Uint8Array(Buffer.from("%PDF-1.4 duplicate invoice one"));
    const firstFileUrl = await persistUploadFile(firstUploadId, "duplicate-one.pdf", firstBytes);

    const [firstJob] = await createJobsForUpload({
      uploadId: firstUploadId,
      files: [
        {
          fileName: "duplicate-one.pdf",
          fileSizeBytes: firstBytes.length,
          fileUrl: firstFileUrl,
          idempotencyKey: buildIdempotencyKey(firstUploadId, "duplicate-one.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: firstJob.job_id,
      pdfUrl: firstFileUrl,
      vendor_name: "Duplicate Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-DUP-100",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-17",
      invoice_date_confidence: "high",
      subtotal: 100,
      subtotal_confidence: "high",
      tax: 10,
      tax_confidence: "high",
      total: 110,
      total_confidence: "high",
      po_number: "PO-10",
      po_number_confidence: "high",
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
    });

    const firstResult = await validateInvoice(firstJob.job_id);
    expect(firstResult.flags.some((flag) => flag.field === "invoice_number" && flag.severity === "critical")).toBe(false);

    const secondUploadId = buildUploadId();
    const secondBytes = new Uint8Array(Buffer.from("%PDF-1.4 duplicate invoice two"));
    const secondFileUrl = await persistUploadFile(secondUploadId, "duplicate-two.pdf", secondBytes);

    const [secondJob] = await createJobsForUpload({
      uploadId: secondUploadId,
      files: [
        {
          fileName: "duplicate-two.pdf",
          fileSizeBytes: secondBytes.length,
          fileUrl: secondFileUrl,
          idempotencyKey: buildIdempotencyKey(secondUploadId, "duplicate-two.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: secondJob.job_id,
      pdfUrl: secondFileUrl,
      vendor_name: "Duplicate Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-DUP-100",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-18",
      invoice_date_confidence: "high",
      subtotal: 100,
      subtotal_confidence: "high",
      tax: 10,
      tax_confidence: "high",
      total: 110,
      total_confidence: "high",
      po_number: "PO-11",
      po_number_confidence: "high",
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
    });

    const duplicateResult = await validateInvoice(secondJob.job_id);
    expect(duplicateResult.invoice.status).toBe("exception");
    expect(
      duplicateResult.flags.some((flag) => flag.field === "invoice_number" && flag.severity === "critical"),
    ).toBe(true);
  });
});
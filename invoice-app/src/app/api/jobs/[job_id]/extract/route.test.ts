import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/jobs/[job_id]/extract/route";
import {
  buildIdempotencyKey,
  buildUploadId,
  createJobsForUpload,
  persistUploadFile,
} from "@/lib/jobs-store";
import { getInvoiceByJobId } from "@/lib/invoices-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("PUT /api/jobs/:job_id/extract", () => {
  beforeEach(() => {
    ctx = withTempCwd();
    process.env.SLICE_2_ADMIN_TOKEN = "test-admin-token";
  });

  afterEach(() => {
    delete process.env.SLICE_2_ADMIN_TOKEN;
    ctx.cleanup();
  });

  it("rejects missing auth", async () => {
    const req = new Request("http://localhost/api/jobs/job_123/extract", {
      method: "PUT",
    });

    const res = await PUT(req, {
      params: Promise.resolve({ job_id: "job_123" }),
    } as never);
    const json = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("unauthorized");
  });

  it("extracts a queued job and persists an invoice", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 demo invoice data"));
    const fileUrl = await persistUploadFile(uploadId, "demo-invoice.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "demo-invoice.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "demo-invoice.pdf"),
        },
      ],
    });

    const req = new Request(`http://localhost/api/jobs/${job.job_id}/extract`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer test-admin-token",
      },
    });

    const res = await PUT(req, {
      params: Promise.resolve({ job_id: job.job_id }),
    } as never);
    const json = (await res.json()) as {
      job_id: string;
      status: string;
      invoice_id: string;
      extracted_fields: Record<string, unknown>;
    };

    expect(res.status).toBe(200);
    expect(json.job_id).toBe(job.job_id);
    expect(json.status).toBe("validated");
    expect(json.invoice_id.length).toBeGreaterThan(0);
    expect(json.extracted_fields).toBeTruthy();

    const invoice = await getInvoiceByJobId(job.job_id);
    expect(invoice?.status).toBe("pending");
    expect(invoice?.invoice_number).toContain("INV-");
  });
});
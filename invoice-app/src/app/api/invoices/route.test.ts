import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/invoices/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { validateInvoice } from "@/lib/validation-engine";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalAdminToken = process.env.SLICE_2_ADMIN_TOKEN;

describe("GET /api/invoices", () => {
  beforeEach(() => {
    ctx = withTempCwd();
    process.env.SLICE_2_ADMIN_TOKEN = "test-admin-token";
  });

  afterEach(() => {
    ctx.cleanup();
    if (originalAdminToken === undefined) {
      delete process.env.SLICE_2_ADMIN_TOKEN;
    } else {
      process.env.SLICE_2_ADMIN_TOKEN = originalAdminToken;
    }
  });

  it("lists invoices and supports status filtering", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 invoice list"));
    const fileUrl = await persistUploadFile(uploadId, "list.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "list.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "list.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      vendor_name: "List Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-5001",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-17",
      invoice_date_confidence: "high",
      subtotal: 10,
      subtotal_confidence: "high",
      tax: 1,
      tax_confidence: "high",
      total: 50,
      total_confidence: "low",
      po_number: null,
      po_number_confidence: null,
      currency: "usd",
      currency_confidence: "medium",
      raw_extraction_json: { source: "test" },
    });

    await validateInvoice(job.job_id);

    const req = new Request("http://localhost/api/invoices?status=exception&search=list&limit=10", {
      method: "GET",
      headers: { Authorization: "Bearer test-admin-token" },
    });

    const res = await GET(req);
    const json = (await res.json()) as {
      invoices: Array<{
        invoice_id: string;
        has_flags: boolean;
        validation_summary: { total_flags: number; critical_flags: number; warning_flags: number; info_flags: number };
        status: string;
      }>;
      next_cursor: string | null;
    };

    expect(res.status).toBe(200);
    expect(json.invoices).toHaveLength(1);
    expect(json.invoices[0].status).toBe("exception");
    expect(json.invoices[0].has_flags).toBe(true);
    expect(json.invoices[0].validation_summary.total_flags).toBeGreaterThan(0);
  });
});
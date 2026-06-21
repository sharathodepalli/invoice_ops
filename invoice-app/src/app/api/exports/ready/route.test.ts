import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/exports/ready/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalAdminToken = process.env.SLICE_2_ADMIN_TOKEN;

describe("GET /api/exports/ready", () => {
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

  it("returns approved invoices and export history only for admin tokens", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 export ready"));
    const fileUrl = await persistUploadFile(uploadId, "ready.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "ready.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "ready.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      status: "approved",
      vendor_name: "Ready Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-READY-1",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-18",
      invoice_date_confidence: "high",
      subtotal: 10,
      subtotal_confidence: "high",
      tax: 1,
      tax_confidence: "high",
      total: 11,
      total_confidence: "high",
      po_number: "PO-READY",
      po_number_confidence: "medium",
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
      approved_at: "2026-05-18T10:00:00.000Z",
      approved_by: "admin",
    });

    const res = await GET(
      new Request("http://localhost/api/exports/ready", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
    );

    const json = (await res.json()) as {
      approved_invoices: Array<{ invoice_id: string; vendor_name: string | null }>;
      export_records: Array<{ file_name: string }>;
    };

    expect(res.status).toBe(200);
    expect(json.approved_invoices).toHaveLength(1);
    expect(json.approved_invoices[0].vendor_name).toBe("Ready Corp");
    expect(json.export_records).toHaveLength(0);
  });
});

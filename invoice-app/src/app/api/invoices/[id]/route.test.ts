import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/invoices/[id]/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { validateInvoice } from "@/lib/validation-engine";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalAdminToken = process.env.SLICE_2_ADMIN_TOKEN;

describe("GET /api/invoices/:id", () => {
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

  it("returns invoice detail with validation flags", async () => {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 invoice detail"));
    const fileUrl = await persistUploadFile(uploadId, "detail.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "detail.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "detail.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      vendor_name: "Detail Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-9001",
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

    const validated = await validateInvoice(job.job_id);
    const req = new Request(`http://localhost/api/invoices/${validated.invoice.invoice_id}`, {
      method: "GET",
      headers: { Authorization: "Bearer test-admin-token" },
    });

    const res = await GET(req, {
      params: Promise.resolve({ id: validated.invoice.invoice_id }),
    } as never);

    const json = (await res.json()) as {
      invoice: {
        id: string;
        status: string;
        validation_summary: { total_flags: number; critical_flags: number; warning_flags: number; info_flags: number };
        fields: Record<string, { value: unknown; confidence: string | null }>;
        validation_flags: Array<{ field: string | null; severity: string }>;
      };
    };

    expect(res.status).toBe(200);
    expect(json.invoice.id).toBe(validated.invoice.invoice_id);
    expect(json.invoice.fields.vendor_name.value).toBe("Detail Corp");
    expect(json.invoice.validation_summary.total_flags).toBeGreaterThan(0);
    expect(json.invoice.validation_flags.length).toBeGreaterThan(0);
  });
});
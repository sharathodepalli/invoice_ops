import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/exports/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalAdminToken = process.env.SLICE_2_ADMIN_TOKEN;

describe("/api/exports", () => {
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

  async function seedInvoice(status: "approved" | "pending", vendorName: string) {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 export"));
    const fileUrl = await persistUploadFile(uploadId, `${vendorName}.pdf`, pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: `${vendorName}.pdf`,
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, `${vendorName}.pdf`),
        },
      ],
    });

    const invoice = await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      status,
      vendor_name: vendorName,
      vendor_name_confidence: "high",
      invoice_number: `INV-${vendorName}`,
      invoice_number_confidence: "high",
      invoice_date: "2026-05-18",
      invoice_date_confidence: "high",
      subtotal: 10,
      subtotal_confidence: "high",
      tax: 1,
      tax_confidence: "high",
      total: 11,
      total_confidence: "high",
      po_number: "PO-1",
      po_number_confidence: "medium",
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
      approved_at: status === "approved" ? "2026-05-18T10:00:00.000Z" : null,
      approved_by: status === "approved" ? "admin" : null,
    });

    return invoice.invoice_id;
  }

  it("exports approved invoices and stores history", async () => {
    const approvedId = await seedInvoice("approved", "Approved Corp");
    await seedInvoice("pending", "Pending Corp");

    const res = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoice_ids: [approvedId] }),
      }),
    );

    const json = (await res.json()) as {
      export_record: { record_count: number; file_name: string; invoice_ids: string[] };
      csv: string;
    };

    expect(res.status).toBe(200);
    expect(json.export_record.record_count).toBe(1);
    expect(json.export_record.invoice_ids).toEqual([approvedId]);
    expect(json.csv).toContain("vendor_name");
    expect(json.csv).toContain("Approved Corp");

    const historyRes = await GET(
      new Request("http://localhost/api/exports?limit=10", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
    );
    const historyJson = (await historyRes.json()) as { export_records: Array<{ file_name: string; record_count: number }> };

    expect(historyRes.status).toBe(200);
    expect(historyJson.export_records).toHaveLength(1);
    expect(historyJson.export_records[0].record_count).toBe(1);
    expect(historyJson.export_records[0].file_name).toBe(json.export_record.file_name);
  });

  it("rejects export requests that include pending invoices", async () => {
    const pendingId = await seedInvoice("pending", "Pending Corp");

    const res = await POST(
      new Request("http://localhost/api/exports", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoice_ids: [pendingId] }),
      }),
    );

    const json = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_selection");
  });
});

import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { runRetentionCleanup } from "@/lib/retention-cleanup";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

function isoDaysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("retention cleanup", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("prunes stale audit logs, export records, and upload files", async () => {
    const now = new Date("2026-05-18T12:00:00.000Z");
    const dataDir = path.join(process.cwd(), "data");
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });

    await fs.writeFile(
      path.join(dataDir, "audit-logs.json"),
      JSON.stringify(
        {
          audit_logs: [
            { created_at: isoDaysAgo(45, now) },
            { created_at: isoDaysAgo(5, now) },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(
      path.join(dataDir, "export-records.json"),
      JSON.stringify(
        {
          export_records: [
            { exported_at: isoDaysAgo(120, now) },
            { exported_at: isoDaysAgo(2, now) },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const referencedUploadId = buildUploadId();
    const referencedBytes = new Uint8Array(Buffer.from("%PDF-referenced"));
    const referencedFileUrl = await persistUploadFile(referencedUploadId, "referenced.pdf", referencedBytes);
    const [referencedJob] = await createJobsForUpload({
      uploadId: referencedUploadId,
      files: [
        {
          fileName: "referenced.pdf",
          fileSizeBytes: referencedBytes.length,
          fileUrl: referencedFileUrl,
          idempotencyKey: buildIdempotencyKey(referencedUploadId, "referenced.pdf"),
        },
      ],
    });
    await upsertInvoiceForJob({
      jobId: referencedJob.job_id,
      pdfUrl: referencedFileUrl,
      vendor_name: "Referenced Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-REF",
      invoice_number_confidence: "high",
      invoice_date: "2026-05-18",
      invoice_date_confidence: "high",
      subtotal: 10,
      subtotal_confidence: "high",
      tax: 1,
      tax_confidence: "high",
      total: 11,
      total_confidence: "high",
      po_number: null,
      po_number_confidence: null,
      currency: "USD",
      currency_confidence: "high",
      raw_extraction_json: { source: "test" },
    });

    const staleUnreferencedUpload = path.join(uploadsDir, "stale.pdf");
    const freshUpload = path.join(uploadsDir, "fresh.pdf");
    const referencedUpload = path.join(uploadsDir, path.basename(referencedFileUrl));
    await fs.writeFile(staleUnreferencedUpload, "old", "utf8");
    await fs.writeFile(freshUpload, "fresh", "utf8");
    const oldUploadTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await fs.utimes(staleUnreferencedUpload, oldUploadTime, oldUploadTime);
    await fs.utimes(freshUpload, now, now);

    const result = await runRetentionCleanup(
      { auditLogRetentionDays: 30, exportRecordRetentionDays: 90, uploadRetentionDays: 14 },
      now,
    );

    expect(result).toEqual({
      audit_logs_removed: 1,
      export_records_removed: 1,
      upload_files_removed: 1,
    });

    const auditData = JSON.parse(await fs.readFile(path.join(dataDir, "audit-logs.json"), "utf8")) as {
      audit_logs: Array<{ created_at: string }>;
    };
    const exportData = JSON.parse(await fs.readFile(path.join(dataDir, "export-records.json"), "utf8")) as {
      export_records: Array<{ exported_at: string }>;
    };

    expect(auditData.audit_logs).toHaveLength(1);
    expect(exportData.export_records).toHaveLength(1);
    await expect(fs.access(staleUnreferencedUpload)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(referencedUpload)).resolves.toBeUndefined();
    await expect(fs.access(freshUpload)).resolves.toBeUndefined();
  });
});
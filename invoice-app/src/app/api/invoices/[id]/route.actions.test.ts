import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH, POST } from "@/app/api/invoices/[id]/route";
import { buildIdempotencyKey, buildUploadId, createJobsForUpload, persistUploadFile } from "@/lib/jobs-store";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { validateInvoice } from "@/lib/validation-engine";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;
const originalAdminToken = process.env.SLICE_2_ADMIN_TOKEN;

describe("PATCH/POST /api/invoices/:id", () => {
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

  async function seedInvoice() {
    const uploadId = buildUploadId();
    const pdfBytes = new Uint8Array(Buffer.from("%PDF-1.4 invoice actions"));
    const fileUrl = await persistUploadFile(uploadId, "actions.pdf", pdfBytes);

    const [job] = await createJobsForUpload({
      uploadId,
      files: [
        {
          fileName: "actions.pdf",
          fileSizeBytes: pdfBytes.length,
          fileUrl,
          idempotencyKey: buildIdempotencyKey(uploadId, "actions.pdf"),
        },
      ],
    });

    await upsertInvoiceForJob({
      jobId: job.job_id,
      pdfUrl: fileUrl,
      vendor_name: "Action Corp",
      vendor_name_confidence: "high",
      invoice_number: "INV-7001",
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
    return validated.invoice.invoice_id;
  }

  it("updates editable fields and records an audit entry", async () => {
    const invoiceId = await seedInvoice();
    const req = new Request(`http://localhost/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer test-admin-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          vendor_name: "Action Corp Updated",
          po_number: "PO-2001",
          currency: "usd",
        },
        comment: "Manual correction",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: invoiceId }) } as never);
    const json = (await res.json()) as {
      invoice: { id: string; status: string; validation_summary: { total_flags: number } };
    };

    expect(res.status).toBe(200);
    expect(json.invoice.id).toBe(invoiceId);
    expect(json.invoice.status).toBe("exception");
    expect(json.invoice.validation_summary.total_flags).toBeGreaterThan(0);

    const detail = await GET(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
      { params: Promise.resolve({ id: invoiceId }) } as never,
    );
    const detailJson = (await detail.json()) as {
      invoice: { fields: { vendor_name: { value: string } }; audit_logs: Array<{ action: string }> };
    };

    expect(detailJson.invoice.fields.vendor_name.value).toBe("Action Corp Updated");
    expect(detailJson.invoice.audit_logs[0]?.action).toBe("updated");
  });

  it("approves and rejects invoices with audit trail metadata", async () => {
    const invoiceId = await seedInvoice();

    const approveRes = await POST(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve", comment: "Ready to export" }),
      }),
      { params: Promise.resolve({ id: invoiceId }) } as never,
    );

    expect(approveRes.status).toBe(200);

    const approvedDetail = await GET(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
      { params: Promise.resolve({ id: invoiceId }) } as never,
    );
    const approvedJson = (await approvedDetail.json()) as {
      invoice: { status: string; approved_at: string | null; approved_by: string | null; audit_logs: Array<{ action: string }> };
    };

    expect(approvedJson.invoice.status).toBe("approved");
    expect(approvedJson.invoice.approved_at).not.toBeNull();
    expect(approvedJson.invoice.approved_by).toBe("admin");
    expect(approvedJson.invoice.audit_logs[0]?.action).toBe("approved");

    const rejectedInvoiceId = await seedInvoice();
    const rejectRes = await POST(
      new Request(`http://localhost/api/invoices/${rejectedInvoiceId}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reject", comment: "Missing approval support" }),
      }),
      { params: Promise.resolve({ id: rejectedInvoiceId }) } as never,
    );

    expect(rejectRes.status).toBe(200);

    const rejectedDetail = await GET(
      new Request(`http://localhost/api/invoices/${rejectedInvoiceId}`, {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
      { params: Promise.resolve({ id: rejectedInvoiceId }) } as never,
    );
    const rejectedJson = (await rejectedDetail.json()) as {
      invoice: { status: string; rejected_at: string | null; rejected_by: string | null; rejection_reason: string | null; audit_logs: Array<{ action: string }> };
    };

    expect(rejectedJson.invoice.status).toBe("rejected");
    expect(rejectedJson.invoice.rejected_at).not.toBeNull();
    expect(rejectedJson.invoice.rejected_by).toBe("admin");
    expect(rejectedJson.invoice.rejection_reason).toBe("Missing approval support");
    expect(rejectedJson.invoice.audit_logs[0]?.action).toBe("rejected");
  });

  it("rejects repeated decisions on terminal invoices", async () => {
    const invoiceId = await seedInvoice();

    const firstDecision = await POST(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve", comment: "Initial approval" }),
      }),
      { params: Promise.resolve({ id: invoiceId }) } as never,
    );

    expect(firstDecision.status).toBe(200);

    const secondDecision = await POST(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-admin-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "reject", comment: "Too late" }),
      }),
      { params: Promise.resolve({ id: invoiceId }) } as never,
    );

    const json = (await secondDecision.json()) as { error: { code: string } };

    expect(secondDecision.status).toBe(409);
    expect(json.error.code).toBe("invalid_state_transition");
  });
});

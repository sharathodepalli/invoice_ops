import { NextResponse } from "next/server";
import { AuthError, verifyAuth } from "@/lib/auth-middleware";
import { getInvoiceById } from "@/lib/invoices-store";
import { appendAuditLog, listAuditLogsForInvoice } from "@/lib/audit-log-store";
import { listValidationFlags } from "@/lib/validation-flags-store";
import { validateInvoice } from "@/lib/validation-engine";
import { upsertInvoiceForJob } from "@/lib/invoices-store";
import { buildRequestLogContext, logRequestEvent, resolveRequestId } from "@/lib/request-logger";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    { status },
  );
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = resolveRequestId(req);
  try {
    const claims = verifyAuth(req, "admin");
    const logContext = buildRequestLogContext(req, "/api/invoices/[id]", claims.subject, requestId);
    const { id } = await context.params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      logRequestEvent("warn", logContext, "invoice_detail_missing", { invoice_id: id });
      return errorResponse("invoice_not_found", "Invoice not found.", 404, requestId);
    }

    const flags = await listValidationFlags(invoice.invoice_id);
    const auditLogs = await listAuditLogsForInvoice(invoice.invoice_id, 5);
    const validationSummary = flags.reduce(
      (summary, flag) => {
        summary.total_flags += 1;
        if (flag.severity === "critical") summary.critical_flags += 1;
        if (flag.severity === "warning") summary.warning_flags += 1;
        if (flag.severity === "info") summary.info_flags += 1;
        return summary;
      },
      { total_flags: 0, critical_flags: 0, warning_flags: 0, info_flags: 0 },
    );

    logRequestEvent("info", logContext, "invoice_detail_loaded", { invoice_id: id, flag_count: flags.length, audit_count: auditLogs.length });
    return NextResponse.json(
      {
        invoice: {
          id: invoice.invoice_id,
          status: invoice.status,
          approved_at: invoice.approved_at,
          approved_by: invoice.approved_by,
          rejected_at: invoice.rejected_at,
          rejected_by: invoice.rejected_by,
          rejection_reason: invoice.rejection_reason,
          fields: {
            vendor_name: { value: invoice.vendor_name, confidence: invoice.vendor_name_confidence },
            invoice_number: { value: invoice.invoice_number, confidence: invoice.invoice_number_confidence },
            invoice_date: { value: invoice.invoice_date, confidence: invoice.invoice_date_confidence },
            subtotal: { value: invoice.subtotal, confidence: invoice.subtotal_confidence },
            tax: { value: invoice.tax, confidence: invoice.tax_confidence },
            total: { value: invoice.total, confidence: invoice.total_confidence },
            po_number: { value: invoice.po_number, confidence: invoice.po_number_confidence },
            currency: { value: invoice.currency, confidence: invoice.currency_confidence },
          },
          validation_summary: validationSummary,
          validation_flags: flags.map((flag) => ({
            type: flag.type,
            severity: flag.severity,
            field: flag.field,
            message: flag.message,
          })),
          audit_summary: {
            last_action: auditLogs[0]?.action ?? invoice.status,
            last_actor: auditLogs[0]?.actor_name ?? auditLogs[0]?.actor_id ?? null,
            last_updated_at: auditLogs[0]?.created_at ?? invoice.updated_at,
          },
          audit_logs: auditLogs.map((log) => ({
            action: log.action,
            actor_name: log.actor_name,
            actor_id: log.actor_id,
            comment: log.comment,
            created_at: log.created_at,
            field_changes: log.field_changes,
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logRequestEvent("warn", buildRequestLogContext(req, "/api/invoices/[id]", null, requestId), "invoice_detail_rejected", { reason: error.code });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    return errorResponse("invoice_detail_failed", error instanceof Error ? error.message : "Failed to load invoice.", 500, requestId);
  }
}

function normalizeText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = verifyAuth(req, "admin");
    const requestId = resolveRequestId(req);
    const logContext = buildRequestLogContext(req, "/api/invoices/[id]", claims.subject, requestId);
    const { id } = await context.params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      logRequestEvent("warn", logContext, "invoice_update_missing", { invoice_id: id });
      return errorResponse("invoice_not_found", "Invoice not found.", 404, requestId);
    }

    if (["approved", "rejected", "exported"].includes(invoice.status)) {
      logRequestEvent("warn", logContext, "invoice_update_rejected", { invoice_id: id, status: invoice.status });
      return errorResponse("invoice_locked", "Approved or rejected invoices cannot be edited.", 409, requestId);
    }

    const payload = (await req.json()) as {
      fields?: {
        vendor_name?: string | null;
        invoice_number?: string | null;
        invoice_date?: string | null;
        subtotal?: number | null;
        tax?: number | null;
        total?: number | null;
        po_number?: string | null;
        currency?: string | null;
      };
      comment?: string | null;
    };

    const fieldChanges: Record<string, { before: unknown; after: unknown }> = {};
    const nextFields = {
      vendor_name: payload.fields?.vendor_name ?? invoice.vendor_name,
      invoice_number: payload.fields?.invoice_number ?? invoice.invoice_number,
      invoice_date: payload.fields?.invoice_date ?? invoice.invoice_date,
      subtotal: payload.fields?.subtotal ?? invoice.subtotal,
      tax: payload.fields?.tax ?? invoice.tax,
      total: payload.fields?.total ?? invoice.total,
      po_number: payload.fields?.po_number ?? invoice.po_number,
      currency: payload.fields?.currency ?? invoice.currency,
    };

    for (const [field, value] of Object.entries(nextFields)) {
      const previous = invoice[field as keyof typeof nextFields];
      if (previous !== value) {
        fieldChanges[field] = { before: previous, after: value };
      }
    }

    const saved = await upsertInvoiceForJob({
      jobId: invoice.job_id,
      pdfUrl: invoice.pdf_url,
      status: invoice.status === "exception" ? "exception" : "pending",
      vendor_name: normalizeText(nextFields.vendor_name),
      vendor_name_confidence: invoice.vendor_name_confidence,
      invoice_number: normalizeText(nextFields.invoice_number),
      invoice_number_confidence: invoice.invoice_number_confidence,
      invoice_date: normalizeText(nextFields.invoice_date),
      invoice_date_confidence: invoice.invoice_date_confidence,
      subtotal: nextFields.subtotal,
      subtotal_confidence: invoice.subtotal_confidence,
      tax: nextFields.tax,
      tax_confidence: invoice.tax_confidence,
      total: nextFields.total,
      total_confidence: invoice.total_confidence,
      po_number: normalizeText(nextFields.po_number),
      po_number_confidence: invoice.po_number_confidence,
      currency: normalizeText(nextFields.currency)?.toUpperCase() ?? null,
      currency_confidence: invoice.currency_confidence,
      raw_extraction_json: invoice.raw_extraction_json,
      approved_at: invoice.approved_at,
      approved_by: invoice.approved_by,
      rejected_at: invoice.rejected_at,
      rejected_by: invoice.rejected_by,
      rejection_reason: invoice.rejection_reason,
    });

    const validated = await validateInvoice(invoice.job_id);

    await appendAuditLog({
      invoiceId: saved.invoice_id,
      action: "updated",
      actorId: claims.subject,
      actorName: claims.subject,
      fieldChanges,
      comment: payload.comment ?? null,
    });

    logRequestEvent("info", logContext, "invoice_updated", { invoice_id: id, changed_fields: Object.keys(fieldChanges), status: validated.invoice.status });

    return NextResponse.json(
      {
        invoice: {
          id: validated.invoice.invoice_id,
          status: validated.invoice.status,
          updated_at: validated.invoice.updated_at,
          validation_summary: {
            total_flags: validated.flags.length,
            critical_flags: validated.flags.filter((flag) => flag.severity === "critical").length,
            warning_flags: validated.flags.filter((flag) => flag.severity === "warning").length,
            info_flags: validated.flags.filter((flag) => flag.severity === "info").length,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.code, error.message, error.status, resolveRequestId(req));
    }

    return errorResponse("invoice_update_failed", error instanceof Error ? error.message : "Failed to update invoice.", 500, resolveRequestId(req));
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const claims = verifyAuth(req, "admin");
    const requestId = resolveRequestId(req);
    const logContext = buildRequestLogContext(req, "/api/invoices/[id]", claims.subject, requestId);
    const { id } = await context.params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      logRequestEvent("warn", logContext, "invoice_decision_missing", { invoice_id: id });
      return errorResponse("invoice_not_found", "Invoice not found.", 404, requestId);
    }

    const payload = (await req.json()) as { action?: string; comment?: string | null };
    const action = payload.action === "approve" ? "approved" : payload.action === "reject" ? "rejected" : null;

    if (!action) {
      logRequestEvent("warn", logContext, "invoice_decision_rejected", { invoice_id: id, reason: "invalid_action" });
      return errorResponse("invalid_action", "Action must be approve or reject.", 400, requestId);
    }

    if (["approved", "rejected", "exported"].includes(invoice.status)) {
      logRequestEvent("warn", logContext, "invoice_decision_rejected", { invoice_id: id, reason: "invalid_state_transition", status: invoice.status });
      return errorResponse(
        "invalid_state_transition",
        "Terminal invoices cannot be approved or rejected again.",
        409,
        requestId,
      );
    }

    const now = new Date().toISOString();
    const nextStatus = action;

    await upsertInvoiceForJob({
      jobId: invoice.job_id,
      pdfUrl: invoice.pdf_url,
      status: nextStatus,
      vendor_name: invoice.vendor_name,
      vendor_name_confidence: invoice.vendor_name_confidence,
      invoice_number: invoice.invoice_number,
      invoice_number_confidence: invoice.invoice_number_confidence,
      invoice_date: invoice.invoice_date,
      invoice_date_confidence: invoice.invoice_date_confidence,
      subtotal: invoice.subtotal,
      subtotal_confidence: invoice.subtotal_confidence,
      tax: invoice.tax,
      tax_confidence: invoice.tax_confidence,
      total: invoice.total,
      total_confidence: invoice.total_confidence,
      po_number: invoice.po_number,
      po_number_confidence: invoice.po_number_confidence,
      currency: invoice.currency,
      currency_confidence: invoice.currency_confidence,
      raw_extraction_json: invoice.raw_extraction_json,
      approved_at: action === "approved" ? now : invoice.approved_at,
      approved_by: action === "approved" ? claims.subject : invoice.approved_by,
      rejected_at: action === "rejected" ? now : invoice.rejected_at,
      rejected_by: action === "rejected" ? claims.subject : invoice.rejected_by,
      rejection_reason: action === "rejected" ? (payload.comment ?? invoice.rejection_reason) : invoice.rejection_reason,
    });

    await appendAuditLog({
      invoiceId: invoice.invoice_id,
      action,
      actorId: claims.subject,
      actorName: claims.subject,
      comment: payload.comment ?? null,
      fieldChanges: {
        status: { before: invoice.status, after: nextStatus },
        timestamp: now,
      },
    });

    logRequestEvent("info", logContext, "invoice_decision_saved", { invoice_id: id, action, status: nextStatus });

    return NextResponse.json(
      {
        invoice: {
          id: invoice.invoice_id,
          status: nextStatus,
          updated_at: now,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.code, error.message, error.status, resolveRequestId(req));
    }

    return errorResponse("invoice_decision_failed", error instanceof Error ? error.message : "Failed to update invoice decision.", 500, resolveRequestId(req));
  }
}
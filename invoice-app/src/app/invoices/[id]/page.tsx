"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type InvoiceDetail = {
  id: string;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  fields: Record<string, { value: unknown; confidence: string | null }>;
  pdf_url: string | null;
  validation_summary: {
    total_flags: number;
    critical_flags: number;
    warning_flags: number;
    info_flags: number;
  };
  validation_flags: Array<{
    type: string;
    severity: string;
    field: string | null;
    message: string;
  }>;
  audit_logs: Array<{
    action: string;
    actor_name: string | null;
    actor_id: string | null;
    comment: string | null;
    created_at: string;
    field_changes: Record<string, unknown> | null;
  }>;
  audit_summary: {
    last_action: string;
    last_actor: string | null;
    last_updated_at: string;
  };
};

type InvoiceResponse = {
  invoice: InvoiceDetail;
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({
    vendor_name: "",
    invoice_number: "",
    invoice_date: "",
    subtotal: "",
    tax: "",
    total: "",
    po_number: "",
    currency: "",
  });
  const [adminToken, setAdminToken] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem("invoice-app-admin-token");
    if (!savedToken) return;

    const timer = window.setTimeout(() => {
      setAdminToken(savedToken);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("invoice-app-admin-token", adminToken);
  }, [adminToken]);

  useEffect(() => {
    let active = true;

    async function loadInvoice() {
      try {
        if (!id) return;
        if (active) setError("");
        const res = await fetch(`/api/invoices/${id}`, {
          cache: "no-store",
          ...(adminToken
            ? { headers: { Authorization: `Bearer ${adminToken}` } }
            : {}),
        });
        const payload = (await res.json()) as
          | InvoiceResponse
          | { error?: { message?: string } };

        if (!res.ok) {
          const msg =
            "error" in payload
              ? payload.error?.message
              : "Failed to load invoice.";
          if (active) setError(msg ?? "Failed to load invoice.");
          return;
        }

        if (active) setInvoice((payload as InvoiceResponse).invoice);
      } catch {
        if (active) setError("Failed to load invoice.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadInvoice();
    return () => {
      active = false;
    };
  }, [adminToken, id]);

  useEffect(() => {
    if (invoice) {
      const timer = window.setTimeout(() => {
        setDraft({
          vendor_name: String(invoice.fields.vendor_name.value ?? ""),
          invoice_number: String(invoice.fields.invoice_number.value ?? ""),
          invoice_date: String(invoice.fields.invoice_date.value ?? ""),
          subtotal: String(invoice.fields.subtotal.value ?? ""),
          tax: String(invoice.fields.tax.value ?? ""),
          total: String(invoice.fields.total.value ?? ""),
          po_number: String(invoice.fields.po_number.value ?? ""),
          currency: String(invoice.fields.currency.value ?? ""),
        });
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [invoice]);

  const hasChanges = useMemo(() => {
    if (!invoice) return false;
    return Object.entries(draft).some(([key, value]) => {
      const original = String(invoice.fields[key]?.value ?? "");
      return original !== value;
    });
  }, [draft, invoice]);

  async function sendAction(
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
  ) {
    if (!id) return;
    setActionError("");
    setActionMessage("");

    const res = await fetch(`/api/invoices/${id}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload = (await res.json()) as
      | InvoiceResponse
      | { error?: { message?: string } };

    if (!res.ok) {
      const msg =
        "error" in payload ? payload.error?.message : "Action failed.";
      setActionError(msg ?? "Action failed.");
      return;
    }

    setActionMessage("Action saved.");
    if (method === "POST") {
      setInvoice((current) =>
        current
          ? {
              ...current,
              status: (body.action === "approve"
                ? "approved"
                : "rejected") as string,
            }
          : current,
      );
    }
    const refreshed = await fetch(`/api/invoices/${id}`, {
      cache: "no-store",
      ...(adminToken
        ? { headers: { Authorization: `Bearer ${adminToken}` } }
        : {}),
    });
    if (refreshed.ok) {
      const nextPayload = (await refreshed.json()) as InvoiceResponse;
      setInvoice(nextPayload.invoice);
    }
  }

  async function saveChanges() {
    await sendAction("PATCH", {
      fields: {
        vendor_name: draft.vendor_name,
        invoice_number: draft.invoice_number,
        invoice_date: draft.invoice_date,
        subtotal: draft.subtotal === "" ? null : Number(draft.subtotal),
        tax: draft.tax === "" ? null : Number(draft.tax),
        total: draft.total === "" ? null : Number(draft.total),
        po_number: draft.po_number,
        currency: draft.currency,
      },
      comment: "Manual correction from invoice detail page.",
    });
  }

  async function decide(action: "approve" | "reject") {
    await sendAction("POST", {
      action,
      comment:
        action === "approve"
          ? "Approved from detail page."
          : "Rejected from detail page.",
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-600">
              Invoice Detail
            </p>
            <h1 className="font-mono text-xl font-semibold text-zinc-900">
              {id}
            </h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link
              className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              href="/exceptions"
            >
              Back to Exceptions
            </Link>
            <Link
              className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              href="/jobs"
            >
              Jobs
            </Link>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        {actionError ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {actionError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {actionMessage}
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading invoice...</p>
          ) : invoice ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    Review Controls
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {Object.entries({
                      vendor_name: "Vendor name",
                      invoice_number: "Invoice number",
                      invoice_date: "Invoice date",
                      subtotal: "Subtotal",
                      tax: "Tax",
                      total: "Total",
                      po_number: "PO number",
                      currency: "Currency",
                    }).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex flex-col gap-1 text-sm"
                      >
                        <span className="font-medium text-zinc-700">
                          {label}
                        </span>
                        <input
                          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
                          value={draft[key] ?? ""}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
                      disabled={!hasChanges}
                      onClick={saveChanges}
                      type="button"
                    >
                      Save Changes
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
                      onClick={() => {
                        if (!invoice) return;
                        setDraft({
                          vendor_name: String(
                            invoice.fields.vendor_name.value ?? "",
                          ),
                          invoice_number: String(
                            invoice.fields.invoice_number.value ?? "",
                          ),
                          invoice_date: String(
                            invoice.fields.invoice_date.value ?? "",
                          ),
                          subtotal: String(invoice.fields.subtotal.value ?? ""),
                          tax: String(invoice.fields.tax.value ?? ""),
                          total: String(invoice.fields.total.value ?? ""),
                          po_number: String(
                            invoice.fields.po_number.value ?? "",
                          ),
                          currency: String(invoice.fields.currency.value ?? ""),
                        });
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    Decision Actions
                  </p>
                  <label className="mt-3 flex flex-col gap-1 text-sm">
                    <span className="font-medium text-zinc-700">
                      Admin token
                    </span>
                    <input
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
                      placeholder="Bearer token"
                      value={adminToken}
                      onChange={(event) => setAdminToken(event.target.value)}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                      onClick={() => decide("approve")}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                      onClick={() => decide("reject")}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Object.entries(invoice.fields).map(([fieldName, field]) => (
                  <div
                    key={fieldName}
                    className="rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {fieldName.replace(/_/g, " ")}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">
                      {String(field.value ?? "-")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Confidence: {field.confidence ?? "n/a"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    Validation Flags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-rose-50 px-2 py-1 font-medium text-rose-700">
                      {invoice.validation_summary.critical_flags} critical
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
                      {invoice.validation_summary.warning_flags} warning
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
                      {invoice.validation_summary.total_flags} total
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {invoice.validation_flags.length === 0 ? (
                      <p className="text-zinc-500">No validation flags.</p>
                    ) : (
                      invoice.validation_flags.map((flag, index) => (
                        <div
                          key={`${flag.field ?? "flag"}-${index}`}
                          className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                        >
                          <p className="font-medium capitalize text-zinc-900">
                            {flag.severity} - {flag.field ?? "general"}
                          </p>
                          <p className="text-zinc-700">{flag.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    Audit Summary
                  </p>
                  <dl className="mt-3 space-y-2 text-sm text-zinc-700">
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Last action</dt>
                      <dd className="font-medium text-zinc-900">
                        {invoice.audit_summary.last_action}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Last actor</dt>
                      <dd className="font-medium text-zinc-900">
                        {invoice.audit_summary.last_actor ?? "system"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Updated</dt>
                      <dd className="font-medium text-zinc-900">
                        {new Date(
                          invoice.audit_summary.last_updated_at,
                        ).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 space-y-2 text-xs text-zinc-600">
                    {invoice.approved_at ? (
                      <p>
                        Approved by {invoice.approved_by ?? "system"} at{" "}
                        {new Date(invoice.approved_at).toLocaleString()}
                      </p>
                    ) : null}
                    {invoice.rejected_at ? (
                      <p>
                        Rejected by {invoice.rejected_by ?? "system"} at{" "}
                        {new Date(invoice.rejected_at).toLocaleString()}
                        {invoice.rejection_reason
                          ? ` - ${invoice.rejection_reason}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {invoice.pdf_url ? (
                    <p className="mt-4 text-xs text-zinc-500">
                      PDF URL: {invoice.pdf_url}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-900">
                  Recent Activity
                </p>
                <div className="mt-3 space-y-3 text-sm">
                  {invoice.audit_logs.length === 0 ? (
                    <p className="text-zinc-500">No audit entries yet.</p>
                  ) : (
                    invoice.audit_logs.map((log) => (
                      <div
                        key={`${log.action}-${log.created_at}`}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-medium capitalize text-zinc-900">
                            {log.action}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-zinc-700">
                          Actor: {log.actor_name ?? log.actor_id ?? "system"}
                        </p>
                        {log.comment ? (
                          <p className="text-zinc-700">
                            Comment: {log.comment}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No invoice data found.</p>
          )}
        </section>
      </div>
    </main>
  );
}

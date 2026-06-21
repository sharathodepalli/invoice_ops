"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ApprovedInvoice = {
  invoice_id: string;
  vendor_name: string | null;
  invoice_number: string | null;
  total: number | null;
  currency: string | null;
  approved_at: string | null;
  approved_by: string | null;
};

type ExportRecord = {
  export_record_id: string;
  invoice_ids: string[];
  file_name: string;
  record_count: number;
  exported_by: string | null;
  exported_at: string;
};

type ApprovedInvoicesResponse = {
  approved_invoices: ApprovedInvoice[];
  export_records: ExportRecord[];
};

type ExportResponse = {
  export_record: ExportRecord;
  file_name: string;
  csv: string;
};

export default function ExportsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [invoices, setInvoices] = useState<ApprovedInvoice[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCount = selectedIds.length;

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (!adminToken) {
          if (active) {
            setIsLoading(false);
            setInvoices([]);
            setHistory([]);
            setSelectedIds([]);
          }
          return;
        }

        if (active) setError("");
        const approvedRes = await fetch("/api/exports/ready", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const approvedPayload = (await approvedRes.json()) as
          | ApprovedInvoicesResponse
          | { error?: { message?: string } };

        if (!approvedRes.ok) {
          const msg =
            "error" in approvedPayload
              ? approvedPayload.error?.message
              : "Failed to load approved invoices.";
          throw new Error(msg ?? "Failed to load approved invoices.");
        }

        if (active) {
          const approved = approvedPayload as ApprovedInvoicesResponse;
          setInvoices(approved.approved_invoices);
          setHistory(approved.export_records);
          setSelectedIds((current) =>
            current.filter((id) =>
              approved.approved_invoices.some(
                (invoice) => invoice.invoice_id === id,
              ),
            ),
          );
        }
      } catch (fetchError) {
        if (active)
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load export data.",
          );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [adminToken]);

  const selectedInvoiceRows = useMemo(
    () =>
      invoices.filter((invoice) => selectedIds.includes(invoice.invoice_id)),
    [invoices, selectedIds],
  );

  async function exportInvoices() {
    if (!adminToken) {
      setError("Admin token is required for export.");
      return;
    }

    try {
      setError("");
      setMessage("");
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          invoice_ids: selectedIds.length > 0 ? selectedIds : undefined,
        }),
      });

      const payload = (await res.json()) as
        | ExportResponse
        | { error?: { message?: string } };
      if (!res.ok) {
        const msg =
          "error" in payload ? payload.error?.message : "Export failed.";
        setError(msg ?? "Export failed.");
        return;
      }

      const exportPayload = payload as ExportResponse;
      const blob = new Blob([exportPayload.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exportPayload.file_name;
      anchor.click();
      URL.revokeObjectURL(url);

      setMessage(
        `Exported ${exportPayload.export_record.record_count} invoice(s).`,
      );
      setHistory((current) => [exportPayload.export_record, ...current]);
      setSelectedIds([]);
    } catch {
      setError("Export failed.");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-600">
              CSV Export
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Export Approved Invoices
            </h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link
              className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              href="/exceptions"
            >
              Exceptions
            </Link>
            <Link
              className="font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
              href="/jobs"
            >
              Jobs
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Admin token</span>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
              placeholder="Bearer token"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              onClick={exportInvoices}
              type="button"
            >
              Download CSV
            </button>
            <button
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
              onClick={() =>
                setSelectedIds(invoices.map((invoice) => invoice.invoice_id))
              }
              type="button"
            >
              Select All
            </button>
            <button
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              Clear
            </button>
            <p className="text-sm font-medium text-zinc-700">
              {selectedCount} selected
            </p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {message}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">
                Approved Invoices
              </h2>
              <p className="text-sm text-zinc-600">
                {selectedInvoiceRows.length} ready to export
              </p>
            </div>
            {isLoading ? (
              <p className="text-sm text-zinc-500">
                Loading approved invoices...
              </p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No approved invoices available.
              </p>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <label
                    key={invoice.invoice_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm transition hover:bg-zinc-50"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {invoice.vendor_name ?? (
                          <span className="text-zinc-400">Unknown vendor</span>
                        )}
                      </p>
                      <p className="text-zinc-600">
                        {invoice.invoice_number ?? (
                          <span className="text-zinc-400">-</span>
                        )}{" "}
                        · {invoice.currency ?? "USD"}{" "}
                        {invoice.total?.toFixed(2) ?? (
                          <span className="text-zinc-400">-</span>
                        )}
                      </p>
                    </div>
                    <input
                      checked={selectedIds.includes(invoice.invoice_id)}
                      onChange={(event) => {
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, invoice.invoice_id]
                            : current.filter(
                                (id) => id !== invoice.invoice_id,
                              ),
                        );
                      }}
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              Export History
            </h2>
            <div className="mt-3 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-zinc-500">No exports yet.</p>
              ) : (
                history.map((record) => (
                  <div
                    key={record.export_record_id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
                  >
                    <p className="font-medium text-zinc-900">
                      {record.file_name}
                    </p>
                    <p className="text-zinc-700">
                      {record.record_count} invoice(s)
                    </p>
                    <p className="text-zinc-500">
                      {new Date(record.exported_at).toLocaleString()}
                    </p>
                    <p className="text-zinc-500">
                      Exported by {record.exported_by ?? "system"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

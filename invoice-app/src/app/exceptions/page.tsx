"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InvoiceStatus =
  | "pending"
  | "exception"
  | "approved"
  | "rejected"
  | "exported";

type InvoiceItem = {
  invoice_id: string;
  job_id: string;
  status: InvoiceStatus;
  vendor_name: string | null;
  invoice_number: string | null;
  total: number | null;
  currency: string | null;
  has_flags: boolean;
  validation_summary: {
    total_flags: number;
    critical_flags: number;
    warning_flags: number;
    info_flags: number;
  };
  created_at: string;
};

type InvoicesResponse = {
  invoices: InvoiceItem[];
  next_cursor: string | null;
};

type SortKey = "newest" | "oldest" | "critical" | "flags" | "vendor";

const STATUS_OPTIONS: Array<{ label: string; value: "" | InvoiceStatus }> = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Exceptions", value: "exception" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

export default function ExceptionsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("exception");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const total = items.length;
    const flagged = items.filter((invoice) => invoice.has_flags).length;
    const pending = items.filter(
      (invoice) => invoice.status === "pending",
    ).length;
    const exceptions = items.filter(
      (invoice) => invoice.status === "exception",
    ).length;
    const criticalFlags = items.reduce(
      (count, invoice) => count + invoice.validation_summary.critical_flags,
      0,
    );
    const warningFlags = items.reduce(
      (count, invoice) => count + invoice.validation_summary.warning_flags,
      0,
    );

    return { total, flagged, pending, exceptions, criticalFlags, warningFlags };
  }, [items]);

  const visibleItems = useMemo(() => {
    const sorted = [...items];

    sorted.sort((left, right) => {
      if (sortBy === "vendor") {
        return (left.vendor_name ?? "").localeCompare(right.vendor_name ?? "");
      }

      if (sortBy === "flags") {
        return (
          right.validation_summary.total_flags -
          left.validation_summary.total_flags
        );
      }

      if (sortBy === "critical") {
        return (
          right.validation_summary.critical_flags -
            left.validation_summary.critical_flags ||
          right.validation_summary.total_flags -
            left.validation_summary.total_flags
        );
      }

      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();

      if (sortBy === "oldest") {
        return leftTime - rightTime;
      }

      return rightTime - leftTime;
    });

    return sorted;
  }, [items, sortBy]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "50");
    return params.toString();
  }, [search, status]);

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

    async function loadInvoices() {
      try {
        if (active) setError("");
        const res = await fetch(`/api/invoices?${query}`, {
          cache: "no-store",
          ...(adminToken
            ? { headers: { Authorization: `Bearer ${adminToken}` } }
            : {}),
        });
        const payload = (await res.json()) as
          | InvoicesResponse
          | { error?: { message?: string } };

        if (!res.ok) {
          const msg =
            "error" in payload
              ? payload.error?.message
              : "Failed to load invoices.";
          if (active) setError(msg ?? "Failed to load invoices.");
          return;
        }

        const okPayload = payload as InvoicesResponse;
        if (active) setItems(okPayload.invoices);
      } catch {
        if (active) setError("Failed to load invoices.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadInvoices();
    const timer = setInterval(loadInvoices, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [adminToken, query]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-600">
              Validation Queue
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Exceptions Queue
            </h1>
          </div>
          <Link
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
            href="/jobs"
          >
            View Jobs
          </Link>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Visible invoices
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Exceptions
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">
              {summary.exceptions}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Flagged
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">
              {summary.flagged}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Critical flags
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-800">
              {summary.criticalFlags}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Warnings
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-700">
              {summary.warningFlags}
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <span>Admin token</span>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
              placeholder="Bearer token"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
            />
          </label>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                status === opt.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
              }`}
              onClick={() => setStatus(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm font-medium text-zinc-700">
            <span>Sort by</span>
            <select
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="critical">Most critical flags</option>
              <option value="flags">Most flags</option>
              <option value="vendor">Vendor A-Z</option>
            </select>
          </label>
          <input
            className="min-w-60 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500"
            placeholder="Search vendor, invoice #, PO"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}

        <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Invoice ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Flags
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-5 text-center text-zinc-500" colSpan={7}>
                    Loading invoices...
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-center text-zinc-500" colSpan={7}>
                    No invoices found.
                  </td>
                </tr>
              ) : (
                visibleItems.map((invoice) => (
                  <tr
                    className="bg-white hover:bg-zinc-50"
                    key={invoice.invoice_id}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                      <Link
                        className="text-zinc-700 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-700"
                        href={`/invoices/${invoice.invoice_id}`}
                      >
                        {invoice.invoice_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {invoice.vendor_name ?? (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-900">
                      <Link
                        className="text-zinc-700 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-700"
                        href={`/invoices/${invoice.invoice_id}`}
                      >
                        {invoice.invoice_number ?? (
                          <span className="text-zinc-400 no-underline">
                            -
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {invoice.total !== null
                        ? `${invoice.currency ?? "USD"} ${invoice.total.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          invoice.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : invoice.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : invoice.status === "exception"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.has_flags ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                            {invoice.validation_summary.total_flags} flag(s)
                          </span>
                          {invoice.validation_summary.critical_flags > 0 ? (
                            <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
                              {invoice.validation_summary.critical_flags}{" "}
                              critical
                            </span>
                          ) : null}
                          {invoice.validation_summary.warning_flags > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                              {invoice.validation_summary.warning_flags}{" "}
                              warning
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {new Date(invoice.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

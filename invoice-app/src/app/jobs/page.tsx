"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type JobStatus = "queued" | "processing" | "extracted" | "validated" | "failed";

type Job = {
  job_id: string;
  filename: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  error_message: string | null;
};

type JobsResponse = {
  jobs: Job[];
  next_cursor: string | null;
};

type InvoiceSummary = {
  invoice_id: string;
  job_id: string;
  status: string;
  vendor_name: string | null;
  total: number | null;
};

type InvoicesResponse = {
  invoices: InvoiceSummary[];
  next_cursor: string | null;
};

const STATUS_OPTIONS: Array<{ label: string; value: "" | JobStatus }> = [
  { label: "All", value: "" },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Extracted", value: "extracted" },
  { label: "Validated", value: "validated" },
  { label: "Failed", value: "failed" },
];

const STATUS_BADGE: Record<
  JobStatus,
  { bg: string; text: string; label: string }
> = {
  queued: { bg: "bg-zinc-100", text: "text-zinc-800", label: "Queued" },
  processing: { bg: "bg-blue-100", text: "text-blue-800", label: "Processing" },
  extracted: { bg: "bg-sky-100", text: "text-sky-800", label: "Extracted" },
  validated: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Validated" },
  failed: { bg: "bg-rose-100", text: "text-rose-800", label: "Failed" },
};

export default function JobsPage() {
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoicesByJobId, setInvoicesByJobId] = useState<
    Record<string, InvoiceSummary>
  >({});
  const [adminToken, setAdminToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", "50");
    return params.toString();
  }, [status]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("invoice-app-admin-token");
    if (savedToken) setAdminToken(savedToken);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      try {
        if (active) setError("");
        const res = await fetch(`/api/jobs?${query}`, { cache: "no-store" });
        const payload = (await res.json()) as
          | JobsResponse
          | { error?: { message?: string } };

        if (!res.ok) {
          const msg =
            "error" in payload
              ? payload.error?.message
              : "Failed to load jobs.";
          if (active) setError(msg ?? "Failed to load jobs.");
          return;
        }

        const okPayload = payload as JobsResponse;
        if (active) setJobs(okPayload.jobs);
      } catch {
        if (active) setError("Failed to load jobs.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadJobs();
    const timer = setInterval(loadJobs, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [query]);

  // Load invoices to map job_id -> invoice_id for linking (only if token present)
  useEffect(() => {
    let active = true;

    async function loadInvoices() {
      if (!adminToken) {
        if (active) setInvoicesByJobId({});
        return;
      }
      try {
        const res = await fetch("/api/invoices?limit=100", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as InvoicesResponse;
        if (active && payload.invoices) {
          const map: Record<string, InvoiceSummary> = {};
          for (const inv of payload.invoices) {
            map[inv.job_id] = inv;
          }
          setInvoicesByJobId(map);
        }
      } catch {
        // Silently fail — invoice linking is optional
      }
    }

    loadInvoices();
    return () => {
      active = false;
    };
  }, [adminToken]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Processing Jobs
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Track upload, extraction, and validation status
            </p>
          </div>
          <Link
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
            href="/upload"
          >
            Upload Files
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
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
                  Job ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Updated
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Error
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Next step
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-5 text-center text-zinc-500" colSpan={6}>
                    Loading jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-5 text-center text-zinc-500"
                    colSpan={6}
                  >
                    No jobs found.{" "}
                    <Link
                      className="font-medium text-zinc-900 underline"
                      href="/upload"
                    >
                      Upload files
                    </Link>{" "}
                    to get started.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const invoice = invoicesByJobId[job.job_id];
                  const badge = STATUS_BADGE[job.status];
                  return (
                    <tr
                      className="bg-white hover:bg-zinc-50"
                      key={job.job_id}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                        {job.job_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {job.filename}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {new Date(job.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {job.error_message ? (
                          <span className="text-rose-700">
                            {job.error_message}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {invoice ? (
                          <Link
                            className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700"
                            href={`/invoices/${invoice.invoice_id}`}
                          >
                            View Invoice →
                          </Link>
                        ) : job.status === "validated" ||
                          job.status === "extracted" ? (
                          <Link
                            className="font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700"
                            href="/exceptions"
                          >
                            Open Exceptions →
                          </Link>
                        ) : job.status === "failed" ? (
                          <span className="text-zinc-500">Needs review</span>
                        ) : (
                          <span className="text-zinc-400">Waiting...</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <h3 className="font-semibold text-zinc-900">
            What happens after upload?
          </h3>
          <ol className="mt-2 space-y-1 text-zinc-700">
            <li>
              <strong>Queued → Processing:</strong> PDF is being read
            </li>
            <li>
              <strong>Processing → Extracted:</strong> Fields are extracted
            </li>
            <li>
              <strong>Extracted → Validated:</strong> Rules are checked
            </li>
            <li className="text-zinc-900">
              <strong>Then go to Exceptions:</strong> Review and approve/reject
              invoices before export
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}

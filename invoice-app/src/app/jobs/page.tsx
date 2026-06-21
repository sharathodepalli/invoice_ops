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

const STATUS_OPTIONS: Array<{ label: string; value: "" | JobStatus }> = [
  { label: "All", value: "" },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Extracted", value: "extracted" },
  { label: "Validated", value: "validated" },
  { label: "Failed", value: "failed" },
];

export default function JobsPage() {
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", "50");
    return params.toString();
  }, [status]);

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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Processing Jobs</h1>
        <Link className="text-sm underline" href="/upload">
          Upload Files
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              status === opt.value ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => setStatus(opt.value)}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <section className="overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Job ID</th>
              <th className="px-4 py-3 text-left font-medium">Filename</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-5" colSpan={5}>
                  Loading jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-5" colSpan={5}>
                  No jobs found.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr className="border-t border-black/5" key={job.job_id}>
                  <td className="px-4 py-3 font-mono text-xs">{job.job_id}</td>
                  <td className="px-4 py-3">{job.filename}</td>
                  <td className="px-4 py-3">{job.status}</td>
                  <td className="px-4 py-3">
                    {new Date(job.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-red-700">
                    {job.error_message ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

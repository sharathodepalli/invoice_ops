"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UploadResponse = {
  upload_id: string;
  jobs: Array<{ job_id: string; filename: string; status: string }>;
};

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(
    () => files.length > 0 && !isUploading,
    [files, isUploading],
  );

  async function handleSubmit() {
    setError("");
    setMessage("");
    if (!files.length) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files[]", file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as
        | UploadResponse
        | { error?: { message?: string } };
      if (!res.ok) {
        const msg =
          "error" in payload ? payload.error?.message : "Upload failed.";
        setError(msg ?? "Upload failed.");
        return;
      }

      const okPayload = payload as UploadResponse;
      setMessage(`Upload created ${okPayload.jobs.length} job(s).`);
      setFiles([]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Upload Invoices
          </h1>
          <Link
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
            href="/jobs"
          >
            View Jobs
          </Link>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="mb-4 block text-sm font-medium text-zinc-900">
            Select PDF files
          </label>
          <input
            className="block w-full rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
            type="file"
            multiple
            accept="application/pdf,.pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />

          <p className="mt-3 text-xs text-zinc-600">
            Max size: 20MB per file. Max batch: 25 files.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Persistence uses Supabase when configured, otherwise local
            development storage.
          </p>

          {files.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  {file.name}{" "}
                  <span className="text-xs text-zinc-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              {isUploading ? "Uploading..." : "Upload Files"}
            </button>
            <Link
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:border-zinc-400"
              href="/jobs"
            >
              Go to Jobs
            </Link>
          </div>

          {message ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

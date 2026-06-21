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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upload Invoices</h1>
        <Link className="text-sm underline" href="/jobs">
          View Jobs
        </Link>
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <label className="mb-4 block text-sm font-medium">
          Select PDF files
        </label>
        <input
          className="block w-full rounded-md border border-black/15 p-3 text-sm"
          type="file"
          multiple
          accept="application/pdf,.pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />

        <p className="mt-3 text-xs text-black/65">
          Max size: 20MB per file. Max batch: 25 files.
        </p>
        <p className="mt-1 text-xs text-black/65">
          Persistence uses Supabase when configured, otherwise local development
          storage.
        </p>

        {files.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!canSubmit}
            onClick={handleSubmit}
            type="button"
          >
            {isUploading ? "Uploading..." : "Upload Files"}
          </button>
          <Link
            className="rounded-md border border-black/20 px-4 py-2 text-sm"
            href="/jobs"
          >
            Go to Jobs
          </Link>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-green-700">{message}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}

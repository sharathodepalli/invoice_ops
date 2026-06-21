import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

export type JobStatus =
  | "queued"
  | "processing"
  | "extracted"
  | "validated"
  | "failed";

export type JobRecord = {
  job_id: string;
  filename: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  file_size_bytes: number;
  file_url: string;
  upload_id: string;
  idempotency_key: string;
};

type JobsData = {
  jobs: JobRecord[];
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "jobs.json");
  const uploadsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
  return { dataDir, storeFile, uploadsDir };
}

async function ensureStore(): Promise<void> {
  const { dataDir, uploadsDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: JobsData = { jobs: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<JobsData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as JobsData;
}

async function writeStore(nextData: JobsData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildUploadId(): string {
  return randomId("upl");
}

export function buildIdempotencyKey(uploadId: string, filename: string): string {
  return `${uploadId}:${filename}`;
}

type SupabaseJobRow = {
  id: string;
  filename: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  file_size_bytes: number;
  file_url: string;
  upload_id: string;
  idempotency_key: string;
};

function mapSupabaseRow(row: SupabaseJobRow): JobRecord {
  return {
    job_id: row.id,
    filename: row.filename,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    error_message: row.error_message,
    file_size_bytes: row.file_size_bytes,
    file_url: row.file_url,
    upload_id: row.upload_id,
    idempotency_key: row.idempotency_key,
  };
}

export async function persistUploadFile(
  uploadId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string> {
  await ensureStore();
  const { uploadsDir } = getPaths();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const targetName = `${uploadId}_${safeName}`;
  const targetPath = path.join(uploadsDir, targetName);
  await fs.writeFile(targetPath, bytes);
  return `/uploads/${targetName}`;
}

export async function createJobsForUpload(input: {
  uploadId: string;
  files: Array<{
    fileName: string;
    fileSizeBytes: number;
    fileUrl: string;
    idempotencyKey: string;
  }>;
}): Promise<JobRecord[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const created: JobRecord[] = [];

    for (const file of input.files) {
      const { data: existing, error: existingError } = await supabase
        .from("jobs")
        .select(
          "id, filename, status, created_at, updated_at, error_message, file_size_bytes, file_url, upload_id, idempotency_key",
        )
        .eq("idempotency_key", file.idempotencyKey)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        created.push(mapSupabaseRow(existing as SupabaseJobRow));
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("jobs")
        .insert({
          id: crypto.randomUUID(),
          filename: file.fileName,
          file_size_bytes: file.fileSizeBytes,
          file_url: file.fileUrl,
          upload_id: input.uploadId,
          status: "queued",
          error_message: null,
          idempotency_key: file.idempotencyKey,
        })
        .select(
          "id, filename, status, created_at, updated_at, error_message, file_size_bytes, file_url, upload_id, idempotency_key",
        )
        .single();

      if (insertError) throw insertError;
      created.push(mapSupabaseRow(inserted as SupabaseJobRow));
    }

    return created;
  }

  const store = await readStore();
  const now = nowIso();

  const existingByKey = new Map(
    store.jobs.map((job) => [job.idempotency_key, job]),
  );

  const created: JobRecord[] = [];

  for (const file of input.files) {
    const existing = existingByKey.get(file.idempotencyKey);
    if (existing) {
      created.push(existing);
      continue;
    }

    const next: JobRecord = {
      job_id: randomId("job"),
      filename: file.fileName,
      status: "queued",
      created_at: now,
      updated_at: now,
      error_message: null,
      file_size_bytes: file.fileSizeBytes,
      file_url: file.fileUrl,
      upload_id: input.uploadId,
      idempotency_key: file.idempotencyKey,
    };
    store.jobs.push(next);
    created.push(next);
  }

  await writeStore(store);
  return created;
}

export async function getJobById(jobId: string): Promise<JobRecord | null> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, filename, status, created_at, updated_at, error_message, file_size_bytes, file_url, upload_id, idempotency_key",
      )
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSupabaseRow(data as SupabaseJobRow) : null;
  }

  const store = await readStore();
  return store.jobs.find((job) => job.job_id === jobId) ?? null;
}

export async function updateJobStatus(input: {
  jobId: string;
  status: JobStatus;
  errorMessage?: string | null;
}): Promise<JobRecord | null> {
  const updatedAt = nowIso();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const patch: Record<string, unknown> = {
      status: input.status,
      error_message: input.errorMessage ?? null,
      updated_at: updatedAt,
    };

    const { data, error } = await supabase
      .from("jobs")
      .update(patch)
      .eq("id", input.jobId)
      .select(
        "id, filename, status, created_at, updated_at, error_message, file_size_bytes, file_url, upload_id, idempotency_key",
      )
      .maybeSingle();

    if (error) throw error;
    return data ? mapSupabaseRow(data as SupabaseJobRow) : null;
  }

  const store = await readStore();
  const job = store.jobs.find((candidate) => candidate.job_id === input.jobId);
  if (!job) return null;

  job.status = input.status;
  job.error_message = input.errorMessage ?? null;
  job.updated_at = updatedAt;
  await writeStore(store);
  return job;
}

export async function listJobs(params: {
  status?: JobStatus;
  limit?: number;
  cursor?: string;
}): Promise<{ jobs: JobRecord[]; next_cursor: string | null }> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("jobs")
      .select(
        "id, filename, status, created_at, updated_at, error_message, file_size_bytes, file_url, upload_id, idempotency_key",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((row) => mapSupabaseRow(row as SupabaseJobRow));

    let startIndex = 0;
    if (params.cursor) {
      const idx = rows.findIndex((job) => job.job_id === params.cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    const safeLimit = Math.max(1, Math.min(params.limit ?? 20, 100));
    const page = rows.slice(startIndex, startIndex + safeLimit);
    const next = rows[startIndex + safeLimit];

    return {
      jobs: page,
      next_cursor: next ? next.job_id : null,
    };
  }

  const store = await readStore();
  const ordered = [...store.jobs].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const filtered = params.status
    ? ordered.filter((job) => job.status === params.status)
    : ordered;

  let startIndex = 0;
  if (params.cursor) {
    const idx = filtered.findIndex((job) => job.job_id === params.cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }

  const safeLimit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const page = filtered.slice(startIndex, startIndex + safeLimit);
  const next = filtered[startIndex + safeLimit];

  return {
    jobs: page,
    next_cursor: next ? next.job_id : null,
  };
}

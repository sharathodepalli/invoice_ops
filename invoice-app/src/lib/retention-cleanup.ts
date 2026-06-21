import { promises as fs } from "node:fs";
import path from "node:path";

export type RetentionCleanupOptions = {
  auditLogRetentionDays?: number;
  exportRecordRetentionDays?: number;
  uploadRetentionDays?: number;
};

export type RetentionCleanupResult = {
  audit_logs_removed: number;
  export_records_removed: number;
  upload_files_removed: number;
};

type AuditLogsData = {
  audit_logs: Array<{ created_at: string }>;
};

type ExportHistoryData = {
  export_records: Array<{ exported_at: string }>;
};

function getPaths() {
  const baseDir = path.join(/* turbopackIgnore: true */ process.cwd());
  const dataDir = path.join(baseDir, "data");
  const uploadsDir = path.join(baseDir, "uploads");
  return {
    auditStoreFile: path.join(dataDir, "audit-logs.json"),
    exportStoreFile: path.join(dataDir, "export-records.json"),
    uploadsDir,
  };
}

function fileNameFromUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const lastSegment = url.split("/").filter(Boolean).pop();
  return lastSegment ?? null;
}

function cutoffFromDays(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function pruneJsonStore<T extends { [key: string]: Array<Record<string, unknown>> }>(
  filePath: string,
  key: keyof T,
  timestampKey: string,
  retentionDays: number,
  now: Date,
): Promise<number> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as T;
    const items = parsed[key] ?? [];
    const cutoff = cutoffFromDays(retentionDays, now).toISOString();
    const kept = items.filter((item) => typeof item[timestampKey] === "string" && String(item[timestampKey]) >= cutoff);
    const removed = items.length - kept.length;

    if (removed > 0) {
      await fs.writeFile(filePath, JSON.stringify({ ...parsed, [key]: kept }, null, 2), "utf8");
    }

    return removed;
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }

    throw error;
  }
}

async function collectReferencedUploadFiles(dataDir: string): Promise<Set<string>> {
  const referenced = new Set<string>();

  try {
    const jobsRaw = await fs.readFile(path.join(dataDir, "jobs.json"), "utf8");
    const jobsData = JSON.parse(jobsRaw) as { jobs?: Array<{ file_url?: string | null }> };
    for (const job of jobsData.jobs ?? []) {
      const fileName = fileNameFromUploadUrl(job.file_url);
      if (fileName) referenced.add(fileName);
    }
  } catch (error) {
    if (!(error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
      throw error;
    }
  }

  try {
    const invoicesRaw = await fs.readFile(path.join(dataDir, "invoices.json"), "utf8");
    const invoicesData = JSON.parse(invoicesRaw) as { invoices?: Array<{ pdf_url?: string | null }> };
    for (const invoice of invoicesData.invoices ?? []) {
      const fileName = fileNameFromUploadUrl(invoice.pdf_url);
      if (fileName) referenced.add(fileName);
    }
  } catch (error) {
    if (!(error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
      throw error;
    }
  }

  return referenced;
}

async function pruneUploadFiles(
  uploadsDir: string,
  dataDir: string,
  retentionDays: number,
  now: Date,
): Promise<number> {
  try {
    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    const cutoff = cutoffFromDays(retentionDays, now).getTime();
    const referencedFiles = await collectReferencedUploadFiles(dataDir);
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (referencedFiles.has(entry.name)) continue;

      const filePath = path.join(uploadsDir, entry.name);
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filePath);
        removed += 1;
      }
    }

    return removed;
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }

    throw error;
  }
}

export async function runRetentionCleanup(
  options: RetentionCleanupOptions = {},
  now = new Date(),
): Promise<RetentionCleanupResult> {
  const paths = getPaths();
  await fs.mkdir(path.dirname(paths.auditStoreFile), { recursive: true });
  await fs.mkdir(paths.uploadsDir, { recursive: true });

  const auditLogsRemoved = await pruneJsonStore<AuditLogsData>(
    paths.auditStoreFile,
    "audit_logs",
    "created_at",
    options.auditLogRetentionDays ?? 30,
    now,
  );
  const exportRecordsRemoved = await pruneJsonStore<ExportHistoryData>(
    paths.exportStoreFile,
    "export_records",
    "exported_at",
    options.exportRecordRetentionDays ?? 90,
    now,
  );
  const uploadFilesRemoved = await pruneUploadFiles(paths.uploadsDir, path.dirname(paths.auditStoreFile), options.uploadRetentionDays ?? 14, now);

  return {
    audit_logs_removed: auditLogsRemoved,
    export_records_removed: exportRecordsRemoved,
    upload_files_removed: uploadFilesRemoved,
  };
}
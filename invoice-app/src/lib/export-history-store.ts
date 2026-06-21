import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

export type ExportRecord = {
  export_record_id: string;
  invoice_ids: string[];
  file_name: string;
  record_count: number;
  exported_by: string | null;
  exported_at: string;
};

type ExportHistoryData = {
  export_records: ExportRecord[];
};

type ExportRecordRow = {
  id: string;
  invoice_ids: unknown;
  file_name: string;
  record_count: number;
  exported_by: string | null;
  exported_at: string;
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "export-records.json");
  return { dataDir, storeFile };
}

async function ensureStore(): Promise<void> {
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: ExportHistoryData = { export_records: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<ExportHistoryData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as ExportHistoryData;
}

async function writeStore(nextData: ExportHistoryData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapSupabaseRow(row: ExportRecordRow): ExportRecord {
  return {
    export_record_id: row.id,
    invoice_ids: Array.isArray(row.invoice_ids) ? (row.invoice_ids as string[]) : [],
    file_name: row.file_name,
    record_count: row.record_count,
    exported_by: row.exported_by,
    exported_at: row.exported_at,
  };
}

export async function listExportRecords(limit = 20): Promise<ExportRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("export_records")
      .select("id, invoice_ids, file_name, record_count, exported_by, exported_at")
      .order("exported_at", { ascending: false })
      .limit(safeLimit);

    if (error) throw error;
    return (data ?? []).map((row) => mapSupabaseRow(row as ExportRecordRow));
  }

  const store = await readStore();
  return [...store.export_records]
    .sort((left, right) => right.exported_at.localeCompare(left.exported_at))
    .slice(0, safeLimit);
}

export async function createExportRecord(input: {
  invoiceIds: string[];
  fileName: string;
  recordCount: number;
  exportedBy: string | null;
  exportedAt?: string;
}): Promise<ExportRecord> {
  const exportedAt = input.exportedAt ?? nowIso();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("export_records")
      .insert({
        id: crypto.randomUUID(),
        invoice_ids: input.invoiceIds,
        file_name: input.fileName,
        record_count: input.recordCount,
        exported_by: input.exportedBy,
        exported_at: exportedAt,
      })
      .select("id, invoice_ids, file_name, record_count, exported_by, exported_at")
      .single();

    if (error) throw error;
    return mapSupabaseRow(data as ExportRecordRow);
  }

  const store = await readStore();
  const record: ExportRecord = {
    export_record_id: randomId("export"),
    invoice_ids: input.invoiceIds,
    file_name: input.fileName,
    record_count: input.recordCount,
    exported_by: input.exportedBy,
    exported_at: exportedAt,
  };

  store.export_records.push(record);
  await writeStore(store);
  return record;
}

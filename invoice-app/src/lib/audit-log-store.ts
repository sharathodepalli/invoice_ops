import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

export type AuditAction = "updated" | "approved" | "rejected" | "exported";

export type AuditLogRecord = {
  audit_log_id: string;
  invoice_id: string;
  action: AuditAction;
  actor_id: string | null;
  actor_name: string | null;
  field_changes: Record<string, unknown> | null;
  comment: string | null;
  created_at: string;
};

type AuditLogsData = {
  audit_logs: AuditLogRecord[];
};

type AuditLogRow = {
  id: string;
  invoice_id: string;
  action: AuditAction;
  actor_id: string | null;
  actor_name: string | null;
  field_changes: Record<string, unknown> | null;
  comment: string | null;
  created_at: string;
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "audit-logs.json");
  return { dataDir, storeFile };
}

async function ensureStore(): Promise<void> {
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: AuditLogsData = { audit_logs: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<AuditLogsData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as AuditLogsData;
}

async function writeStore(nextData: AuditLogsData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapSupabaseRow(row: AuditLogRow): AuditLogRecord {
  return {
    audit_log_id: row.id,
    invoice_id: row.invoice_id,
    action: row.action,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    field_changes: row.field_changes,
    comment: row.comment,
    created_at: row.created_at,
  };
}

export async function listAuditLogsForInvoice(
  invoiceId: string,
  limit = 10,
): Promise<AuditLogRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, invoice_id, action, actor_id, actor_name, field_changes, comment, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (error) throw error;
    return (data ?? []).map((row) => mapSupabaseRow(row as AuditLogRow));
  }

  const store = await readStore();
  return store.audit_logs
    .filter((log) => log.invoice_id === invoiceId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, safeLimit);
}

export async function appendAuditLog(input: {
  invoiceId: string;
  action: AuditAction;
  actorId: string | null;
  actorName?: string | null;
  fieldChanges?: Record<string, unknown> | null;
  comment?: string | null;
}): Promise<AuditLogRecord> {
  const createdAt = nowIso();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const payload = {
      id: crypto.randomUUID(),
      invoice_id: input.invoiceId,
      action: input.action,
      actor_id: input.actorId,
      actor_name: input.actorName ?? null,
      field_changes: input.fieldChanges ?? null,
      comment: input.comment ?? null,
      created_at: createdAt,
    };

    const { data, error } = await supabase
      .from("audit_logs")
      .insert(payload)
      .select("id, invoice_id, action, actor_id, actor_name, field_changes, comment, created_at")
      .single();

    if (error) throw error;
    return mapSupabaseRow(data as AuditLogRow);
  }

  const store = await readStore();
  const record: AuditLogRecord = {
    audit_log_id: randomId("audit"),
    invoice_id: input.invoiceId,
    action: input.action,
    actor_id: input.actorId,
    actor_name: input.actorName ?? null,
    field_changes: input.fieldChanges ?? null,
    comment: input.comment ?? null,
    created_at: createdAt,
  };

  store.audit_logs.push(record);
  await writeStore(store);
  return record;
}

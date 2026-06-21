import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

export type ValidationSeverity = "critical" | "warning" | "info";
export type ValidationType = "error" | "warning";

export type ValidationFlagRecord = {
  flag_id: string;
  invoice_id: string;
  type: ValidationType;
  severity: ValidationSeverity;
  field: string | null;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

type ValidationFlagsData = {
  validation_flags: ValidationFlagRecord[];
};

type ValidationFlagRow = {
  id: string;
  invoice_id: string;
  type: ValidationType;
  severity: ValidationSeverity;
  field: string | null;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "validation-flags.json");
  return { dataDir, storeFile };
}

async function ensureStore(): Promise<void> {
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: ValidationFlagsData = { validation_flags: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<ValidationFlagsData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as ValidationFlagsData;
}

async function writeStore(nextData: ValidationFlagsData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapSupabaseRow(row: ValidationFlagRow): ValidationFlagRecord {
  return {
    flag_id: row.id,
    invoice_id: row.invoice_id,
    type: row.type,
    severity: row.severity,
    field: row.field,
    message: row.message,
    details: row.details,
    resolved: row.resolved,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
  };
}

export async function listValidationFlags(invoiceId: string): Promise<ValidationFlagRecord[]> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("validation_flags")
      .select("id, invoice_id, type, severity, field, message, details, resolved, resolved_at, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => mapSupabaseRow(row as ValidationFlagRow));
  }

  const store = await readStore();
  return store.validation_flags.filter((flag) => flag.invoice_id === invoiceId);
}

export async function replaceValidationFlagsForInvoice(input: {
  invoiceId: string;
  flags: Array<{
    type: ValidationType;
    severity: ValidationSeverity;
    field: string | null;
    message: string;
    details?: Record<string, unknown> | null;
  }>;
}): Promise<ValidationFlagRecord[]> {
  const now = nowIso();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { error: deleteError } = await supabase
      .from("validation_flags")
      .delete()
      .eq("invoice_id", input.invoiceId);

    if (deleteError) throw deleteError;

    if (!input.flags.length) return [];

    const { data, error } = await supabase
      .from("validation_flags")
      .insert(
        input.flags.map((flag) => ({
          id: crypto.randomUUID(),
          invoice_id: input.invoiceId,
          type: flag.type,
          severity: flag.severity,
          field: flag.field,
          message: flag.message,
          details: flag.details ?? null,
          resolved: false,
          resolved_at: null,
          created_at: now,
        })),
      )
      .select("id, invoice_id, type, severity, field, message, details, resolved, resolved_at, created_at");

    if (error) throw error;
    return (data ?? []).map((row) => mapSupabaseRow(row as ValidationFlagRow));
  }

  const store = await readStore();
  store.validation_flags = store.validation_flags.filter((flag) => flag.invoice_id !== input.invoiceId);

  const created = input.flags.map<ValidationFlagRecord>((flag) => ({
    flag_id: randomId("flag"),
    invoice_id: input.invoiceId,
    type: flag.type,
    severity: flag.severity,
    field: flag.field,
    message: flag.message,
    details: flag.details ?? null,
    resolved: false,
    resolved_at: null,
    created_at: now,
  }));

  store.validation_flags.push(...created);
  await writeStore(store);
  return created;
}
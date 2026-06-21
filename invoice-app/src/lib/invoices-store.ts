import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabaseAdminClient, hasSupabaseConfig } from "@/lib/supabase-admin";

export type ConfidenceLabel = "high" | "medium" | "low";
export type InvoiceStatus = "pending" | "exception" | "approved" | "rejected" | "exported";

export type InvoiceRecord = {
  invoice_id: string;
  job_id: string;
  status: InvoiceStatus;
  vendor_name: string | null;
  vendor_name_confidence: ConfidenceLabel | null;
  invoice_number: string | null;
  invoice_number_confidence: ConfidenceLabel | null;
  invoice_date: string | null;
  invoice_date_confidence: ConfidenceLabel | null;
  subtotal: number | null;
  subtotal_confidence: ConfidenceLabel | null;
  tax: number | null;
  tax_confidence: ConfidenceLabel | null;
  total: number | null;
  total_confidence: ConfidenceLabel | null;
  po_number: string | null;
  po_number_confidence: ConfidenceLabel | null;
  currency: string | null;
  currency_confidence: ConfidenceLabel | null;
  pdf_url: string | null;
  raw_extraction_json: Record<string, unknown>;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceListItem = InvoiceRecord & {
  has_flags: boolean;
  validation_summary: {
    total_flags: number;
    critical_flags: number;
    warning_flags: number;
    info_flags: number;
  };
};

type InvoicesData = {
  invoices: InvoiceRecord[];
};

type InvoiceRow = {
  id: string;
  job_id: string;
  status: InvoiceStatus;
  vendor_name: string | null;
  vendor_name_confidence: ConfidenceLabel | null;
  invoice_number: string | null;
  invoice_number_confidence: ConfidenceLabel | null;
  invoice_date: string | null;
  invoice_date_confidence: ConfidenceLabel | null;
  subtotal: number | null;
  subtotal_confidence: ConfidenceLabel | null;
  tax: number | null;
  tax_confidence: ConfidenceLabel | null;
  total: number | null;
  total_confidence: ConfidenceLabel | null;
  po_number: string | null;
  po_number_confidence: ConfidenceLabel | null;
  currency: string | null;
  currency_confidence: ConfidenceLabel | null;
  pdf_url: string | null;
  raw_extraction_json: Record<string, unknown> | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "invoices.json");
  return { dataDir, storeFile };
}

async function ensureStore(): Promise<void> {
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: InvoicesData = { invoices: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<InvoicesData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as InvoicesData;
}

async function writeStore(nextData: InvoicesData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapSupabaseRow(row: InvoiceRow): InvoiceRecord {
  return {
    invoice_id: row.id,
    job_id: row.job_id,
    status: row.status,
    vendor_name: row.vendor_name,
    vendor_name_confidence: row.vendor_name_confidence,
    invoice_number: row.invoice_number,
    invoice_number_confidence: row.invoice_number_confidence,
    invoice_date: row.invoice_date,
    invoice_date_confidence: row.invoice_date_confidence,
    subtotal: row.subtotal,
    subtotal_confidence: row.subtotal_confidence,
    tax: row.tax,
    tax_confidence: row.tax_confidence,
    total: row.total,
    total_confidence: row.total_confidence,
    po_number: row.po_number,
    po_number_confidence: row.po_number_confidence,
    currency: row.currency,
    currency_confidence: row.currency_confidence,
    pdf_url: row.pdf_url,
    raw_extraction_json: row.raw_extraction_json ?? {},
    approved_at: row.approved_at ?? null,
    approved_by: row.approved_by ?? null,
    rejected_at: row.rejected_at ?? null,
    rejected_by: row.rejected_by ?? null,
    rejection_reason: row.rejection_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeInvoiceRecord(record: Partial<InvoiceRecord> & Pick<InvoiceRecord, "invoice_id" | "job_id" | "status" | "created_at" | "updated_at">): InvoiceRecord {
  return {
    ...record,
    vendor_name: record.vendor_name ?? null,
    vendor_name_confidence: record.vendor_name_confidence ?? null,
    invoice_number: record.invoice_number ?? null,
    invoice_number_confidence: record.invoice_number_confidence ?? null,
    invoice_date: record.invoice_date ?? null,
    invoice_date_confidence: record.invoice_date_confidence ?? null,
    subtotal: record.subtotal ?? null,
    subtotal_confidence: record.subtotal_confidence ?? null,
    tax: record.tax ?? null,
    tax_confidence: record.tax_confidence ?? null,
    total: record.total ?? null,
    total_confidence: record.total_confidence ?? null,
    po_number: record.po_number ?? null,
    po_number_confidence: record.po_number_confidence ?? null,
    currency: record.currency ?? null,
    currency_confidence: record.currency_confidence ?? null,
    pdf_url: record.pdf_url ?? null,
    raw_extraction_json: record.raw_extraction_json ?? {},
    approved_at: record.approved_at ?? null,
    approved_by: record.approved_by ?? null,
    rejected_at: record.rejected_at ?? null,
    rejected_by: record.rejected_by ?? null,
    rejection_reason: record.rejection_reason ?? null,
  };
}

export async function getInvoiceByJobId(jobId: string): Promise<InvoiceRecord | null> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("id, job_id, status, vendor_name, vendor_name_confidence, invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence, subtotal, subtotal_confidence, tax, tax_confidence, total, total_confidence, po_number, po_number_confidence, currency, currency_confidence, pdf_url, raw_extraction_json, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_at, updated_at")
      .eq("job_id", jobId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSupabaseRow(data as InvoiceRow) : null;
  }

  const store = await readStore();
  const record = store.invoices.find((invoice) => invoice.job_id === jobId);
  return record ? normalizeInvoiceRecord(record) : null;
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("id, job_id, status, vendor_name, vendor_name_confidence, invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence, subtotal, subtotal_confidence, tax, tax_confidence, total, total_confidence, po_number, po_number_confidence, currency, currency_confidence, pdf_url, raw_extraction_json, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_at, updated_at")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSupabaseRow(data as InvoiceRow) : null;
  }

  const store = await readStore();
  const record = store.invoices.find((invoice) => invoice.invoice_id === invoiceId);
  return record ? normalizeInvoiceRecord(record) : null;
}

export async function listInvoices(params: {
  status?: InvoiceStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ invoices: InvoiceListItem[]; next_cursor: string | null }> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const search = params.search?.trim().toLowerCase() ?? "";

  const resolveValidationSummary = async (invoiceId: string): Promise<{
    total_flags: number;
    critical_flags: number;
    warning_flags: number;
    info_flags: number;
  }> => {
    if (hasSupabaseConfig()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("validation_flags")
        .select("severity")
        .eq("invoice_id", invoiceId);

      if (error) throw error;
      const severities = (data ?? []).map((row) => (row as { severity: string }).severity);
      return {
        total_flags: severities.length,
        critical_flags: severities.filter((severity) => severity === "critical").length,
        warning_flags: severities.filter((severity) => severity === "warning").length,
        info_flags: severities.filter((severity) => severity === "info").length,
      };
    }

    const { listValidationFlags } = await import("@/lib/validation-flags-store");
    const flags = await listValidationFlags(invoiceId);
    return {
      total_flags: flags.length,
      critical_flags: flags.filter((flag) => flag.severity === "critical").length,
      warning_flags: flags.filter((flag) => flag.severity === "warning").length,
      info_flags: flags.filter((flag) => flag.severity === "info").length,
    };
  };

  const sourceInvoices: InvoiceRecord[] = hasSupabaseConfig()
    ? await (async () => {
        const supabase = getSupabaseAdminClient();
        let query = supabase
          .from("invoices")
          .select("id, job_id, status, vendor_name, vendor_name_confidence, invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence, subtotal, subtotal_confidence, tax, tax_confidence, total, total_confidence, po_number, po_number_confidence, currency, currency_confidence, pdf_url, raw_extraction_json, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (params.status) {
          query = query.eq("status", params.status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((row) => mapSupabaseRow(row as InvoiceRow));
      })()
    : (await readStore()).invoices.map((invoice) => normalizeInvoiceRecord(invoice)).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const filtered = sourceInvoices.filter((invoice) => {
    if (params.status && invoice.status !== params.status) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      invoice.vendor_name,
      invoice.invoice_number,
      invoice.po_number,
      invoice.currency,
      invoice.job_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });

  let startIndex = 0;
  if (params.cursor) {
    const idx = filtered.findIndex((invoice) => invoice.invoice_id === params.cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }

  const page = filtered.slice(startIndex, startIndex + limit);
  const next = filtered[startIndex + limit];

  const invoices = [] as InvoiceListItem[];
  for (const invoice of page) {
    const validationSummary = await resolveValidationSummary(invoice.invoice_id);
    invoices.push({
      ...invoice,
      has_flags: validationSummary.total_flags > 0,
      validation_summary: validationSummary,
    });
  }

  return {
    invoices,
    next_cursor: next ? next.invoice_id : null,
  };
}

export async function upsertInvoiceForJob(input: {
  jobId: string;
  pdfUrl: string | null;
  status?: InvoiceStatus;
  vendor_name: string | null;
  vendor_name_confidence: ConfidenceLabel | null;
  invoice_number: string | null;
  invoice_number_confidence: ConfidenceLabel | null;
  invoice_date: string | null;
  invoice_date_confidence: ConfidenceLabel | null;
  subtotal: number | null;
  subtotal_confidence: ConfidenceLabel | null;
  tax: number | null;
  tax_confidence: ConfidenceLabel | null;
  total: number | null;
  total_confidence: ConfidenceLabel | null;
  po_number: string | null;
  po_number_confidence: ConfidenceLabel | null;
  currency: string | null;
  currency_confidence: ConfidenceLabel | null;
  raw_extraction_json: Record<string, unknown>;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
}): Promise<InvoiceRecord> {
  const now = nowIso();

  if (hasSupabaseConfig()) {
    const supabase = getSupabaseAdminClient();
    const existing = await getInvoiceByJobId(input.jobId);

    const payload = {
      job_id: input.jobId,
      status: input.status ?? "pending",
      vendor_name: input.vendor_name,
      vendor_name_confidence: input.vendor_name_confidence,
      invoice_number: input.invoice_number,
      invoice_number_confidence: input.invoice_number_confidence,
      invoice_date: input.invoice_date,
      invoice_date_confidence: input.invoice_date_confidence,
      subtotal: input.subtotal,
      subtotal_confidence: input.subtotal_confidence,
      tax: input.tax,
      tax_confidence: input.tax_confidence,
      total: input.total,
      total_confidence: input.total_confidence,
      po_number: input.po_number,
      po_number_confidence: input.po_number_confidence,
      currency: input.currency,
      currency_confidence: input.currency_confidence,
      pdf_url: input.pdfUrl,
      raw_extraction_json: input.raw_extraction_json,
      approved_at: input.approved_at ?? (existing?.approved_at ?? null),
      approved_by: input.approved_by ?? (existing?.approved_by ?? null),
      rejected_at: input.rejected_at ?? (existing?.rejected_at ?? null),
      rejected_by: input.rejected_by ?? (existing?.rejected_by ?? null),
      rejection_reason: input.rejection_reason ?? (existing?.rejection_reason ?? null),
      updated_at: now,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("invoices")
        .update(payload)
        .eq("id", existing.invoice_id)
        .select("id, job_id, status, vendor_name, vendor_name_confidence, invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence, subtotal, subtotal_confidence, tax, tax_confidence, total, total_confidence, po_number, po_number_confidence, currency, currency_confidence, pdf_url, raw_extraction_json, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_at, updated_at")
        .single();

      if (error) throw error;
      return mapSupabaseRow(data as InvoiceRow);
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        id: crypto.randomUUID(),
        ...payload,
        created_at: now,
      })
      .select("id, job_id, status, vendor_name, vendor_name_confidence, invoice_number, invoice_number_confidence, invoice_date, invoice_date_confidence, subtotal, subtotal_confidence, tax, tax_confidence, total, total_confidence, po_number, po_number_confidence, currency, currency_confidence, pdf_url, raw_extraction_json, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_at, updated_at")
      .single();

    if (error) throw error;
    return mapSupabaseRow(data as InvoiceRow);
  }

  const store = await readStore();
  const existingIndex = store.invoices.findIndex((invoice) => invoice.job_id === input.jobId);

  const record: InvoiceRecord = {
    invoice_id: existingIndex >= 0 ? store.invoices[existingIndex].invoice_id : randomId("inv"),
    job_id: input.jobId,
    status: input.status ?? "pending",
    vendor_name: input.vendor_name,
    vendor_name_confidence: input.vendor_name_confidence,
    invoice_number: input.invoice_number,
    invoice_number_confidence: input.invoice_number_confidence,
    invoice_date: input.invoice_date,
    invoice_date_confidence: input.invoice_date_confidence,
    subtotal: input.subtotal,
    subtotal_confidence: input.subtotal_confidence,
    tax: input.tax,
    tax_confidence: input.tax_confidence,
    total: input.total,
    total_confidence: input.total_confidence,
    po_number: input.po_number,
    po_number_confidence: input.po_number_confidence,
    currency: input.currency,
    currency_confidence: input.currency_confidence,
    pdf_url: input.pdfUrl,
    raw_extraction_json: input.raw_extraction_json,
    approved_at: input.approved_at ?? (existingIndex >= 0 ? store.invoices[existingIndex].approved_at ?? null : null),
    approved_by: input.approved_by ?? (existingIndex >= 0 ? store.invoices[existingIndex].approved_by ?? null : null),
    rejected_at: input.rejected_at ?? (existingIndex >= 0 ? store.invoices[existingIndex].rejected_at ?? null : null),
    rejected_by: input.rejected_by ?? (existingIndex >= 0 ? store.invoices[existingIndex].rejected_by ?? null : null),
    rejection_reason: input.rejection_reason ?? (existingIndex >= 0 ? store.invoices[existingIndex].rejection_reason ?? null : null),
    created_at: existingIndex >= 0 ? store.invoices[existingIndex].created_at : now,
    updated_at: now,
  };

  if (existingIndex >= 0) {
    store.invoices[existingIndex] = record;
  } else {
    store.invoices.push(record);
  }

  await writeStore(store);
  return record;
}
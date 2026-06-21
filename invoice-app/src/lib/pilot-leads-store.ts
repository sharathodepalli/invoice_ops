import { promises as fs } from "node:fs";
import path from "node:path";

export type PilotLeadRecord = {
  pilot_lead_id: string;
  name: string;
  email: string;
  company: string;
  monthly_invoice_volume: string | null;
  biggest_pain: string | null;
  notes: string | null;
  created_at: string;
  source: string;
};

type PilotLeadsData = {
  pilot_leads: PilotLeadRecord[];
};

function getPaths() {
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const storeFile = path.join(dataDir, "pilot-leads.json");
  return { dataDir, storeFile };
}

async function ensureStore(): Promise<void> {
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(storeFile);
  } catch {
    const seed: PilotLeadsData = { pilot_leads: [] };
    await fs.writeFile(storeFile, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<PilotLeadsData> {
  await ensureStore();
  const { storeFile } = getPaths();
  const raw = await fs.readFile(storeFile, "utf8");
  return JSON.parse(raw) as PilotLeadsData;
}

async function writeStore(nextData: PilotLeadsData): Promise<void> {
  const { storeFile } = getPaths();
  await fs.writeFile(storeFile, JSON.stringify(nextData, null, 2), "utf8");
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeLeadText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createPilotLead(input: {
  name: string;
  email: string;
  company: string;
  monthly_invoice_volume?: string | null;
  biggest_pain?: string | null;
  notes?: string | null;
  source?: string;
}): Promise<PilotLeadRecord> {
  const store = await readStore();
  const record: PilotLeadRecord = {
    pilot_lead_id: randomId("lead"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company.trim(),
    monthly_invoice_volume: normalizeLeadText(input.monthly_invoice_volume),
    biggest_pain: normalizeLeadText(input.biggest_pain),
    notes: normalizeLeadText(input.notes),
    created_at: nowIso(),
    source: input.source ?? "pricing_page",
  };

  store.pilot_leads.unshift(record);
  await writeStore(store);
  return record;
}

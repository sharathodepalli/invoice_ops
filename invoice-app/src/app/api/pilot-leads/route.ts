import { NextResponse } from "next/server";
import { createPilotLead } from "@/lib/pilot-leads-store";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: { code, message },
    },
    { status },
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function forwardLeadToWebhook(lead: { name: string; email: string; company: string; monthly_invoice_volume: string | null; biggest_pain: string | null; notes: string | null; created_at: string; source: string; }): Promise<boolean> {
  const webhookUrl = process.env.PILOT_LEAD_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "pilot_lead_created",
        lead,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      name?: unknown;
      email?: unknown;
      company?: unknown;
      monthly_invoice_volume?: unknown;
      biggest_pain?: unknown;
      notes?: unknown;
    };

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const company = typeof payload.company === "string" ? payload.company.trim() : "";

    if (!name) return errorResponse("invalid_name", "Name is required.", 400);
    if (!email || !isValidEmail(email)) return errorResponse("invalid_email", "A valid email is required.", 400);
    if (!company) return errorResponse("invalid_company", "Company is required.", 400);

    const lead = await createPilotLead({
      name,
      email,
      company,
      monthly_invoice_volume: typeof payload.monthly_invoice_volume === "string" ? payload.monthly_invoice_volume : null,
      biggest_pain: typeof payload.biggest_pain === "string" ? payload.biggest_pain : null,
      notes: typeof payload.notes === "string" ? payload.notes : null,
      source: "pricing_page",
    });

    const forwarded = await forwardLeadToWebhook(lead);

    return NextResponse.json(
      {
        pilot_lead: lead,
        delivery_status: forwarded ? "forwarded" : "stored",
        next_step: forwarded
          ? "Thanks. Your pilot request has been sent to our team."
          : "We will reach out to schedule a pilot call.",
      },
      { status: 201 },
    );
  } catch {
    return errorResponse("lead_capture_failed", "Failed to save pilot request.", 500);
  }
}

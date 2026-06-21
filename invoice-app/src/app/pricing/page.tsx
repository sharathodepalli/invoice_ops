"use client";

import Link from "next/link";
import { useState } from "react";

const pilotIncludes = [
  "Load 10 to 20 sample invoices",
  "Configure review queue and export flow",
  "Validate totals, missing PO, and duplicates",
  "Run guided approval and audit trail demo",
  "Export approved invoices to CSV",
];

const pilotOutcomes = [
  "Measure manual touches saved per invoice",
  "Show how fast exceptions are resolved",
  "Prove that approved invoices export cleanly",
  "Give finance a simple before/after story",
];

export default function PricingPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    monthly_invoice_volume: "",
    biggest_pain: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitLead() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/pilot-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await res.json()) as
        | { next_step?: string; error?: { message?: string } }
        | undefined;

      if (!res.ok) {
        setError(payload?.error?.message ?? "Failed to submit pilot request.");
        return;
      }

      setMessage(
        payload?.next_step ??
          "Thanks. We will reach out to schedule a pilot call.",
      );
      setForm({
        name: "",
        email: "",
        company: "",
        monthly_invoice_volume: "",
        biggest_pain: "",
        notes: "",
      });
    } catch {
      setError("Failed to submit pilot request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#fffaf4_0%,_#ffffff_45%,_#f8fafc_100%)] px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-800">
              Pilot offer
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Sell the first win, not the whole platform.
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-zinc-700">
              The fastest path to revenue is a small paid pilot that proves time
              saved, exceptions caught, and export readiness.
            </p>
          </div>
          <Link
            className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-zinc-400"
            href="/"
          >
            Back home
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Recommended offer
            </p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-5xl font-semibold">$2.5k</span>
              <span className="text-sm text-zinc-500">paid pilot, 2 weeks</span>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700">
              This is not a free demo. It is a paid implementation sprint that
              configures the workflow, loads sample invoices, and proves the
              value on real AP data.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-500">Includes</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                  {pilotIncludes.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-sm font-semibold text-zinc-500">Outcomes</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
                  {pilotOutcomes.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                Conversion line
              </p>
              <p className="mt-2 text-lg font-medium leading-8">
                If the pilot saves time and reduces exceptions, roll it into a
                monthly subscription for the AP workflow.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Sales angle
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                Promise one measurable result.
              </h2>
              <p className="mt-3 text-base leading-7 text-zinc-700">
                Don&rsquo;t sell generic AI. Sell reduced manual review, faster
                approvals, and a clean export handoff.
              </p>
            </div>

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Pricing structure
              </p>
              <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-700">
                <p>
                  <strong>Pilot:</strong> fixed fee, short timeline, clear
                  success criteria.
                </p>
                <p>
                  <strong>Subscription:</strong> monthly fee after the pilot if
                  the workflow becomes part of the AP process.
                </p>
                <p>
                  <strong>Services:</strong> optional setup and data cleanup for
                  the first customer only.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                What to say on sales calls
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-700">
                <li>- We remove invoice cleanup before ERP.</li>
                <li>
                  - We show the exception queue instead of hiding the mess.
                </li>
                <li>- We prove time saved on your invoices, not ours.</li>
                <li>
                  - We start with a paid pilot so the buyer has skin in the
                  game.
                </li>
              </ul>
            </div>

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Request a pilot
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                Put a buyer in the pipeline.
              </h2>
              <p className="mt-3 text-base leading-7 text-zinc-700">
                Capture a real lead, not just a contact us page.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="Name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="Work email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="Company"
                  value={form.company}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      company: event.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="Approx. invoices per month"
                  value={form.monthly_invoice_volume}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      monthly_invoice_volume: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="min-h-28 rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="What hurts today?"
                  value={form.biggest_pain}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      biggest_pain: event.target.value,
                    }))
                  }
                />
                <textarea
                  className="min-h-24 rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  placeholder="Anything else we should know?"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-60"
                  disabled={isSubmitting}
                  onClick={submitLead}
                  type="button"
                >
                  {isSubmitting ? "Submitting..." : "Request pilot"}
                </button>
                {message ? (
                  <p className="text-sm font-medium text-emerald-700">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="text-sm font-medium text-rose-700">{error}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-800">
              AP automation for teams that hate invoice chaos
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-zinc-900 md:text-6xl">
              Turn invoice review from a backlog into a 5-minute approval flow.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700 md:text-xl">
              Upload PDFs, catch exceptions automatically, approve with an audit
              trail, and export clean CSVs without the spreadsheet scramble.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-zinc-800"
                href="/upload"
              >
                Start an invoice run
              </Link>
              <Link
                className="rounded-full border border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-100"
                href="/pricing"
              >
                Book a pilot
              </Link>
              <Link
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:-translate-y-0.5 hover:border-zinc-400"
                href="/exceptions"
              >
                See the review queue
              </Link>
              <Link
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:-translate-y-0.5 hover:border-zinc-400"
                href="/exports"
              >
                Show export flow
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">
                  Faster review
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">
                  Minutes
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  not spreadsheet churn
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">Risk caught</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">
                  Before ERP
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  validation blocks bad data
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">Audit ready</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">
                  Always
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  who changed what, when
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
                  What a buyer sees
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">
                  A clean path from invoice to approved export
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Live demo ready
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-zinc-900 p-4 shadow-lg">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Buyer pain
                </p>
                <p className="mt-2 text-lg font-medium text-white">
                  &ldquo;We waste time fixing invoice errors after they already
                  hit accounting.&rdquo;
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-medium text-zinc-500">
                    Review queue
                  </p>
                  <p className="mt-2 text-base font-semibold text-zinc-900">
                    Exceptions surfaced with reasons
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-medium text-zinc-500">
                    Approval flow
                  </p>
                  <p className="mt-2 text-base font-semibold text-zinc-900">
                    Edit, approve, reject, audit
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-medium text-zinc-500">Export</p>
                  <p className="mt-2 text-base font-semibold text-zinc-900">
                    Clean CSV with history
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-medium text-zinc-500">
                    Ops control
                  </p>
                  <p className="mt-2 text-base font-semibold text-zinc-900">
                    Admin and system access separated
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              For founders
            </p>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Show a buyer one workflow and one number: fewer manual touches per
              invoice.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              For finance teams
            </p>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Make exceptions obvious, approvals traceable, and exports
              repeatable.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              For buyers
            </p>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Reduce rework, speed up close, and keep every approval
              accountable.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Selling the first pilot
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                Start with a paid 2-week AP pilot.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">
                Load 10 to 20 invoices, prove faster review and cleaner export,
                and convert the pilot into a recurring AP workflow subscription.
              </p>
            </div>
            <Link
              className="inline-flex rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
              href="/pricing"
            >
              See pilot pricing
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

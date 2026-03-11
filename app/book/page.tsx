import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Sparkles } from "lucide-react";

import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";

export default async function BookAcceleratorPlaceholderPage() {
  await requireDashboardAccess();

  return (
    <main className="relative min-h-screen text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_22%_-8%,rgba(251,191,36,0.12),transparent_58%),radial-gradient(900px_circle_at_86%_6%,rgba(56,189,248,0.09),transparent_55%)]" />

      <header className="mx-auto w-full max-w-4xl px-4 pb-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/8 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pick your tool
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-4xl items-center px-4 pb-20 pt-10 sm:px-6">
        <div className="w-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 text-center shadow-[0_28px_90px_rgba(2,6,23,0.52)] backdrop-blur-xl sm:p-10">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/12 text-amber-200">
            <BookOpenCheck className="h-7 w-7" />
          </div>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Coming soon
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Book Accelerator
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
            Book Accelerator is coming soon.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}


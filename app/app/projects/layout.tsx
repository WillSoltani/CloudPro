// app/app/projects/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-slate-100">
      {/* Full-width header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b16]/55 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6">
          {/* Left: back + title */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10
                         shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition"
            >
              <span className="text-base opacity-80 group-hover:opacity-100">←</span>
              <span>Portfolio</span>
            </Link>

            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5
                           shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
              >
                <span className="text-lg">⚡</span>
              </div>

              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-100">
                  Serverless File Converter
                </p>
                <p className="text-xs text-slate-400">
                  Projects, uploads, and pipeline history
                </p>
              </div>
            </div>
          </div>

          {/* Right: New Project */}
          <Link
            href="/app/projects?create=1"
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15
                       shadow-[0_12px_30px_rgba(56,189,248,0.12)]
                       hover:shadow-[0_18px_45px_rgba(56,189,248,0.18)]
                       transition"
          >
            New Project
          </Link>
        </div>

        {/* subtle glow line */}
        <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
      </header>

      {/* Content padding for fixed header */}
      <div className="px-4 pt-24 pb-10 sm:px-6">{children}</div>
    </div>
  );
}

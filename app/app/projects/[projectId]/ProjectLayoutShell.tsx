"use client";

import Link from "next/link";
import { FileCountProvider, useFileCount } from "./FileCountContext";

function ProjectHeader({ projectName }: { projectName: string }) {
  const fileCount = useFileCount();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b16]/55 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/app/projects"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10
                       shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition"
          >
            <span className="text-base opacity-80 group-hover:opacity-100">←</span>
            <span>Back to Projects</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <span className="text-lg">📁</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-100">{projectName}</p>
              <p className="text-xs text-slate-400">{fileCount} {fileCount === 1 ? "file" : "files"}</p>
            </div>
          </div>
        </div>

        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
    </header>
  );
}

export function ProjectLayoutShell({
  projectName,
  initialFileCount,
  children,
}: {
  projectName: string;
  initialFileCount: number;
  children: React.ReactNode;
}) {
  return (
    <FileCountProvider initial={initialFileCount}>
      <div className="relative min-h-screen text-slate-100">
        <ProjectHeader projectName={projectName} />
        <main className="w-full px-4 pt-8 pb-12 sm:px-6">
          {children}
        </main>
      </div>
    </FileCountProvider>
  );
}

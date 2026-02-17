// app/app/projects/[projectId]/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";

type ProjectRow = {
  projectId: string;
  name: string;
};

type FilesResponse = { files?: unknown[] };

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>) {
  const all = store.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function getOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function fetchProjectName(projectId: string): Promise<string> {
  const origin = await getOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(`${origin}/app/api/projects`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (!res.ok) return "Untitled Project";

  const data = (await res.json()) as { projects?: ProjectRow[] };
  const project = (data.projects ?? []).find((p) => p.projectId === projectId);
  return project?.name ?? "Untitled Project";
}

async function fetchFileCount(projectId: string): Promise<number> {
  const origin = await getOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(
    `${origin}/app/api/projects/${encodeURIComponent(projectId)}/files`,
    { method: "GET", headers: cookie ? { cookie } : {}, cache: "no-store" }
  );

  if (!res.ok) return 0;

  const data = (await res.json()) as FilesResponse;
  const files = Array.isArray(data.files) ? data.files : [];
  return files.length;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [projectName, fileCount] = await Promise.all([
    fetchProjectName(projectId),
    fetchFileCount(projectId),
  ]);

  return (
    <div className="relative min-h-screen text-slate-100">
      {/* Fixed, full-width header for Project Detail */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b16]/55 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-6 py-4">
          {/* Left: Back to Projects + Project meta */}
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
                <p className="text-xs text-slate-400">{fileCount} files</p>
              </div>
            </div>
          </div>

          {/* Right side intentionally empty like your screenshot */}
          <div className="h-9 w-9" aria-hidden="true" />
        </div>

        <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
      </header>

      {/* Body pushed below fixed header */}
      <main className="w-full px-4 pt-28 pb-12 sm:px-6">
      {children}
      </main>
    </div>
  );
}

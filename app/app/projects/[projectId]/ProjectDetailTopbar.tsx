// app/app/projects/[projectId]/ProjectDetailTopbar.tsx
import Link from "next/link";
import { cookies, headers } from "next/headers";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

type FileRow = {
  fileId: string;
  projectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  bucket: string;
  key: string;
};

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

async function fetchProjects(): Promise<ProjectRow[]> {
  const origin = await getOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(`${origin}/app/api/projects`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (!res.ok) return [];
  const data = (await res.json()) as { projects?: ProjectRow[] };
  return data.projects ?? [];
}

async function fetchProjectFiles(projectId: string): Promise<FileRow[]> {
  const origin = await getOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(
    `${origin}/app/api/projects/${encodeURIComponent(projectId)}/files`,
    {
      method: "GET",
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    }
  );

  if (!res.ok) return [];
  const data = (await res.json()) as { files?: FileRow[] };
  return data.files ?? [];
}

export default async function ProjectDetailTopbar() {
  // Works because we're inside /app/projects/[projectId]
  const h = await headers();
  const pathname = h.get("x-invoke-path") || ""; // may be empty in some environments

  // Fallback: parse from referer if needed
  const referer = h.get("referer") ?? "";
  const url = pathname || referer;

  const match = url.match(/\/app\/projects\/([^/?#]+)/);
  const projectId = match ? decodeURIComponent(match[1]) : "";

  const [projects, files] = await Promise.all([
    projectId ? fetchProjects() : Promise.resolve([]),
    projectId ? fetchProjectFiles(projectId) : Promise.resolve([]),
  ]);

  const project = projects.find((p) => p.projectId === projectId);
  const name = project?.name ?? "Project";
  const count = files.length;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b16]/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/app/projects"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10
                       shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          >
            <span className="text-base opacity-80">←</span>
            <span>Back to Projects</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <span className="text-lg">📁</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-100">{name}</p>
              <p className="text-xs text-slate-400">
                {count} {count === 1 ? "file" : "files"}
              </p>
            </div>
          </div>
        </div>

        {/* Intentionally empty: NO New Project, NO Portfolio */}
        <div />
      </div>

      <div className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.18),transparent)]" />
    </header>
  );
}

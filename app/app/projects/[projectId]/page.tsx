// app/app/projects/[projectId]/page.tsx
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
  // Your Next version returns Promises here, so we await.
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

  if (!res.ok) {
    if (res.status === 401) return [];
    const text = await res.text();
    throw new Error(`GET /app/api/projects failed: ${res.status} ${text}`);
  }

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

  if (!res.ok) {
    if (res.status === 401) return [];
    const text = await res.text();
    throw new Error(
      `GET /app/api/projects/${projectId}/files failed: ${res.status} ${text}`
    );
  }

  const data = (await res.json()) as { files?: FileRow[] };
  return data.files ?? [];
}

function fmtBytes(n: number | null) {
  if (n == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function AppProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [projects, files] = await Promise.all([
    fetchProjects(),
    fetchProjectFiles(projectId),
  ]);

  const project = projects.find((p) => p.projectId === projectId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Project
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">
            {project?.name ?? "Untitled Project"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            <span className="text-slate-400">ID:</span> {projectId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/projects"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
          >
            Back to Projects
          </Link>
          <Link
            href={`/app/upload?projectId=${encodeURIComponent(projectId)}`}
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
          >
            Upload
          </Link>
        </div>
      </div>

      {/* Files */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Files</h2>
            <p className="mt-1 text-sm text-slate-300">
              Uploaded inputs for this project.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
            {files.length} total
          </span>
        </div>

        {files.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-300">No files yet.</p>
            <p className="mt-2 text-xs text-slate-400">
              Upload a file to start building your pipeline history.
            </p>
            <div className="mt-4">
              <Link
                href={`/app/upload?projectId=${encodeURIComponent(projectId)}`}
                className="text-sm text-sky-300 hover:text-sky-200"
              >
                Upload a file →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {files.map((f) => (
              <Link
                key={f.fileId}
                href={`/app/files/${encodeURIComponent(f.fileId)}`}
                className="group rounded-2xl border border-white/10 bg-white/4 p-4 transition hover:bg-white/8 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_70px_rgba(56,189,248,0.10)]"
              >
                <div className="flex items-center gap-4">
                  {/* Thumbnail-ish square */}
                  <div className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 bg-white/6 grid place-items-center text-slate-200">
                    <span className="text-xs opacity-80">FILE</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
                      {f.filename}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {f.contentType} • {fmtBytes(f.sizeBytes)} •{" "}
                      {new Date(f.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs",
                        f.status === "completed"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : f.status === "failed"
                          ? "border-red-400/20 bg-red-400/10 text-red-200"
                          : f.status === "running"
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          : "border-white/10 bg-white/8 text-slate-200",
                      ].join(" ")}
                    >
                      {f.status}
                    </span>
                  </div>
                </div>
              </Link>

            ))}
          </div>
        )}
      </div>
    </div>
  );
}

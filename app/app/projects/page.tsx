// app/app/projects/page.tsx
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { CreateProjectButton } from "./CreateProjectButton";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
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

  if (!res.ok) {
    if (res.status === 401) return [];
    const text = await res.text();
    throw new Error(`GET /app/api/projects failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { projects?: ProjectRow[] };
  return data.projects ?? [];
}

export default async function AppProjectsPage() {
  const projects = await fetchProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-2 text-sm text-slate-300">
            Create a project and upload files to it.
          </p>
        </div>

        <CreateProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">No projects yet.</p>
          <div className="mt-4">
            <Link
              href="/app/upload"
              className="text-sm text-sky-300 hover:text-sky-200"
            >
              Upload a file →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link
              key={p.projectId}
              href={`/app/projects/${encodeURIComponent(p.projectId)}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Project</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100 group-hover:text-white">
                    {p.name}
                  </h2>
                  <p className="mt-2 text-xs text-slate-400">
                    Updated {new Date(p.updatedAt).toLocaleString()}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-200">
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// app/app/projects/[projectId]/layout.tsx
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { ProjectLayoutShell } from "./ProjectLayoutShell";

type ProjectRow = { projectId: string; name: string };
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
  return Array.isArray(data.files) ? data.files.length : 0;
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
    <ProjectLayoutShell projectId={projectId} projectName={projectName} initialFileCount={fileCount}>
      {children}
    </ProjectLayoutShell>
  );
}

// app/app/projects/[projectId]/page.tsx
import { cookies, headers } from "next/headers";
import ProjectDetailClient from "./ProjectDetailClient";
import type { FileRow } from "../_lib/types";

type ProjectRow = {
  projectId: string;
  name: string;
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

export default async function AppProjectDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await paramsPromise;

  const [projects, files] = await Promise.all([
    fetchProjects(),
    fetchProjectFiles(projectId),
  ]);

  const project = projects.find((p) => p.projectId === projectId);

  return (
    <ProjectDetailClient
      projectId={projectId}
      projectName={project?.name ?? "Untitled Project"}
      files={files}
    />
  );
}

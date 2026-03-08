import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { FileRow } from "../../../_lib/types";
import FillPdfClient from "./FillPdfClient";

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

  if (res.status === 401) return [];
  if (!res.ok) return [];
  const data = (await res.json()) as { projects?: ProjectRow[] };
  return data.projects ?? [];
}

async function fetchProjectFiles(projectId: string): Promise<FileRow[]> {
  const origin = await getOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(
    `${origin}/app/api/projects/${encodeURIComponent(projectId)}/files?validate=1`,
    {
      method: "GET",
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    }
  );

  if (res.status === 401) return [];
  if (!res.ok) return [];
  const data = (await res.json()) as { files?: FileRow[] };
  return data.files ?? [];
}

function isPdfFile(file: FileRow): boolean {
  if ((file.contentType || "").toLowerCase().includes("pdf")) return true;
  return file.filename.toLowerCase().endsWith(".pdf");
}

export default async function FillPdfPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const { projectId, fileId } = await params;

  const jar = await cookies();
  if (!jar.get("id_token")?.value) redirect("/?auth=required");

  const [projects, files] = await Promise.all([
    fetchProjects(),
    fetchProjectFiles(projectId),
  ]);

  const project = projects.find((p) => p.projectId === projectId);
  if (!project) redirect("/?auth=required");

  const file = files.find((f) => f.fileId === fileId);
  if (!file) notFound();
  if (!isPdfFile(file)) notFound();

  return (
    <FillPdfClient
      projectId={projectId}
      projectName={project.name}
      fileId={fileId}
      filename={file.filename}
    />
  );
}

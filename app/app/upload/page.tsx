"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

type PresignResponse = {
  upload: {
    uploadId: string;
    fileId: string;
    key: string;
    bucket: string;
    putUrl: string;
    headers: Record<string, string>;
  };
};

function bytesToHuman(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function AppUploadPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  // 1) Load projects
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingProjects(true);
      setStatus("");
      try {
        const res = await fetch("/app/api/projects", { cache: "no-store" });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load projects: ${res.status} ${t}`);
        }
        const data = (await res.json()) as { projects: Project[] };
        if (cancelled) return;

        const list = data.projects ?? [];
        setProjects(list);

        // Default to first project if present
        if (list.length > 0) setProjectId(list[0].projectId);
      } catch (e) {
        if (!cancelled) setStatus(String(e));
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canUpload = useMemo(() => {
    return Boolean(projectId) && Boolean(file) && !busy;
  }, [projectId, file, busy]);

  async function onUpload() {
    if (!file || !projectId) return;

    setBusy(true);
    setStatus("Requesting upload URL...");

    try {
      // 2) Presign
      const presRes = await fetch(`/app/api/projects/${projectId}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });

      if (!presRes.ok) {
        const t = await presRes.text();
        throw new Error(`Presign failed: ${presRes.status} ${t}`);
      }

      const pres = (await presRes.json()) as PresignResponse;

      const putUrl = pres.upload?.putUrl;
      if (!putUrl) throw new Error("Presign response missing putUrl.");

      setStatus("Uploading directly to S3...");

      // 3) PUT to S3
      const put = await fetch(putUrl, {
        method: "PUT",
        headers: {
          // Cognito presign usually expects Content-Type to match what you signed.
          "Content-Type": file.type || "application/octet-stream",
          ...pres.upload.headers,
        },
        body: file,
      });

      if (!put.ok) {
        const t = await put.text().catch(() => "");
        throw new Error(`S3 upload failed: ${put.status} ${t}`);
      }

      setStatus("Finalizing upload...");

      // 4) Complete (write DynamoDB record)
      const completeRes = await fetch(
        `/app/api/projects/${projectId}/uploads/${pres.upload.uploadId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            bucket: pres.upload.bucket,
            key: pres.upload.key,
          }),
        }
      );

      if (!completeRes.ok) {
        const t = await completeRes.text();
        throw new Error(`Complete failed: ${completeRes.status} ${t}`);
      }

      setStatus("Done. Redirecting…");

      // 5) Redirect to project detail
      router.push(`/app/projects/${projectId}`);
      router.refresh();
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload</h1>
        <p className="mt-2 text-sm text-slate-300">
          Uploads go direct-to-S3 via presigned URL, then we write metadata to DynamoDB.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Project selector */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loadingProjects || busy}
              className="w-full rounded-xl border border-white/10 bg-[#070b16]/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/40"
            >
              {loadingProjects ? (
                <option value="">Loading projects…</option>
              ) : projects.length === 0 ? (
                <option value="">No projects yet</option>
              ) : (
                projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.name}
                  </option>
                ))
              )}
            </select>

            {projects.length === 0 && !loadingProjects ? (
              <p className="text-xs text-slate-400">
                Create a project first from the Projects page.
              </p>
            ) : null}
          </div>

          {/* File picker */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">File</label>
            <input
              type="file"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-white/15"
            />
            {file ? (
              <p className="text-xs text-slate-400">
                Selected: <span className="text-slate-200">{file.name}</span> ·{" "}
                {bytesToHuman(file.size)}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Pick a file to upload.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onUpload}
            disabled={!canUpload}
            className={[
              "rounded-full px-4 py-2 text-sm transition",
              canUpload
                ? "border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15"
                : "border border-white/5 bg-white/5 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>

          {status ? (
            <p className="text-sm text-slate-300">{status}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Presign → S3 PUT → Complete
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

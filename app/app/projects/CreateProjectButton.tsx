"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

type CreateResponse =
  | { project: ProjectRow }
  | { error: string };

function isCreateResponse(v: unknown): v is CreateResponse {
  if (typeof v !== "object" || v === null) return false;
  if ("error" in v) return typeof (v as { error?: unknown }).error === "string";
  if (!("project" in v)) return false;
  const p = (v as { project?: unknown }).project;
  if (typeof p !== "object" || p === null) return false;
  const pp = p as Partial<ProjectRow>;
  return (
    typeof pp.projectId === "string" &&
    typeof pp.name === "string" &&
    typeof pp.createdAt === "string" &&
    typeof pp.updatedAt === "string" &&
    typeof pp.status === "string"
  );
}

export function CreateProjectButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && !busy, [name, busy]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function create() {
    const n = name.trim();
    if (!n || busy) return;

    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/app/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: n }),
      });

      const text = await res.text();
      let data: unknown = null;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        // leave as null
      }

      if (!res.ok) {
        const msg =
          (data && typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: unknown }).error ?? "")
            : "") || `Create failed: ${res.status}`;
        throw new Error(msg);
      }

      if (!isCreateResponse(data) || !("project" in data)) {
        throw new Error("Create succeeded but response shape was unexpected.");
      }

      const projectId = data.project.projectId;

      // close modal + reset
      setOpen(false);
      setName("");

      // Navigate straight to the project page (what you asked for)
      router.push(`/app/projects/${encodeURIComponent(projectId)}`);

      // optional: refresh server components after navigation
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Top-right button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15 transition shadow-[0_12px_35px_rgba(0,0,0,0.35)]"
      >
        <Plus className="h-4 w-4" />
        New Project
      </button>

      {/* Modal */}
      {open ? (
        <div className="fixed inset-0 z-50">
          {/* overlay */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55"
          />

          {/* dialog */}
          <div className="relative mx-auto mt-24 w-[92%] max-w-lg">
            <div className="rounded-[28px] border border-white/10 bg-[#0b1224]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Create
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-100">
                    New Project
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Name your workspace. You can rename it later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/10 bg-white/8 p-2 text-slate-200 hover:bg-white/12 transition"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tax docs, Real estate, Client uploads…"
                  className="w-full rounded-2xl border border-white/10 bg-[#070b16]/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/20 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
                />

                {err ? (
                  <p className="text-xs text-rose-200">{err}</p>
                ) : null}

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={create}
                    disabled={!canSubmit}
                    className="flex-1 rounded-2xl bg-sky-600/90 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 disabled:hover:bg-sky-600/90 transition shadow-[0_10px_30px_rgba(2,132,199,0.25)]"
                  >
                    {busy ? "Creating..." : "Create Project"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setName("");
                      setErr(null);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition"
                    title="Clear"
                    aria-label="Clear"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Tip: Press Escape to close.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

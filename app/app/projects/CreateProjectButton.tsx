"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CreateProjectResponse = {
  project?: {
    projectId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    status: string;
  };
  error?: string;
};

export function CreateProjectButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = useMemo(() => name.trim(), [name]);
  const canSubmit = trimmed.length > 0 && trimmed.length <= 80 && !busy;

  const close = () => {
    setOpen(false);
    setErr(null);
    setName("");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/app/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.status === 401) {
        // not logged in (or session expired)
        window.location.assign("/auth/login");
        return;
      }

      const data = (await res.json()) as CreateProjectResponse;

      if (!res.ok || !data.project) {
        setErr(data.error ?? "Failed to create project.");
        return;
      }

      // Go straight to project detail
      close();
      router.push(`/app/projects/${encodeURIComponent(data.project.projectId)}`);
      router.refresh();
    } catch (e) {
      setErr(`Network error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
      >
        New Project
      </button>

      {open ? (
        <div className="fixed inset-0 z-60">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-black/50"
          />

          {/* dialog */}
          <div className="relative mx-auto mt-24 w-[92vw] max-w-md rounded-2xl border border-white/10 bg-[#070b16] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-100">
              Create project
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Give it a short name. You can change it later.
            </p>

            <div className="mt-4">
              <label className="text-xs text-slate-400">Project name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") close();
                }}
                placeholder="e.g. Tax forms 2026"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{trimmed.length}/80</span>
                {trimmed.length > 80 ? (
                  <span className="text-rose-300">Too long</span>
                ) : null}
              </div>
            </div>

            {err ? (
              <p className="mt-3 text-sm text-rose-300">{err}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15 disabled:opacity-60"
              >
                {busy ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

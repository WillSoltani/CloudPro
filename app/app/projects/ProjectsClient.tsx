"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, FolderKanban, Clock, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

type Stats = {
  totalProjects: number;
  totalFiles: number;
  spaceSavedBytes: number;
};

type Props = {
  initialProjects: ProjectRow[];
  initialStats: Stats;
};

type MenuState =
  | { open: false }
  | { open: true; projectId: string; x: number; y: number };

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

type ProjectMeta = {
  fileCount: number;
  latestActivityAt: string; // ISO
};

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Client-only date renderer (avoids hydration locale mismatch)
function ClientDate({ iso }: { iso: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return <span>{text || "…"}</span>;
}

function getIsoOrFallback(v: unknown, fallbackIso: string) {
  if (typeof v === "string" && v.length >= 10) return v;
  return fallbackIso;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}

function parseCreatedProject(json: unknown): ProjectRow | null {
  if (typeof json !== "object" || json === null) return null;
  const root = json as { project?: unknown };
  if (typeof root.project !== "object" || root.project === null) return null;
  const p = root.project as Record<string, unknown>;

  const projectId = typeof p.projectId === "string" ? p.projectId : "";
  const name = typeof p.name === "string" ? p.name : "";
  const createdAt =
    typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString();
  const updatedAt = typeof p.updatedAt === "string" ? p.updatedAt : createdAt;
  const status = typeof p.status === "string" ? p.status : "active";

  if (!projectId || !name) return null;
  return { projectId, name, createdAt, updatedAt, status };
}

async function readErrorBody(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();

  // Try to extract {"error": "..."} nicely
  if (ct.includes("application/json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        const maybe = (parsed as { error?: unknown }).error;
        if (typeof maybe === "string" && maybe.trim()) return maybe.trim();
      }
    } catch {
      // fall through
    }
  }

  return text.trim();
}

export default function ProjectsClient({ initialProjects, initialStats }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [stats, setStats] = useState<Stats>(initialStats);

  const [meta, setMeta] = useState<Record<string, ProjectMeta>>({});
  const [menu, setMenu] = useState<MenuState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // For safe menu placement without SSR window usage
  const [viewportW, setViewportW] = useState<number>(0);
  useEffect(() => {
    const update = () => setViewportW(window.innerWidth);
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  // Keep state in sync if server refreshes
  useEffect(() => setProjects(initialProjects), [initialProjects]);
  useEffect(() => setStats(initialStats), [initialStats]);

  // Open create modal if navigated from top bar: /app/projects?create=1
  useEffect(() => {
    if (sp.get("create") === "1") {
      setCreateOpen(true);
      router.replace("/app/projects");
    }
  }, [sp, router]);

  const closeMenu = useCallback(() => setMenu({ open: false }), []);

  // Close menu/modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMenu]);

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return arr;
  }, [projects]);

  // Fetch file counts + latest activity per project
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (projects.length === 0) {
        setMeta({});
        return;
      }

      const results = await Promise.all(
        projects.map(async (p) => {
          try {
            const res = await fetch(
              `/app/api/projects/${encodeURIComponent(p.projectId)}/files`,
              { cache: "no-store" }
            );

            if (!res.ok) {
              return {
                projectId: p.projectId,
                fileCount: 0,
                latestActivityAt: p.updatedAt,
              };
            }

            const data = (await res.json()) as { files?: unknown };
            const files = Array.isArray(data.files) ? (data.files as FileRow[]) : [];

            let latest = p.updatedAt;
            for (const f of files) {
              const candidate = getIsoOrFallback(f.updatedAt, f.createdAt);
              if (candidate > latest) latest = candidate;
            }

            return {
              projectId: p.projectId,
              fileCount: files.length,
              latestActivityAt: latest,
            };
          } catch {
            return { projectId: p.projectId, fileCount: 0, latestActivityAt: p.updatedAt };
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, ProjectMeta> = {};
      for (const r of results) {
        next[r.projectId] = { fileCount: r.fileCount, latestActivityAt: r.latestActivityAt };
      }
      setMeta(next);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // --- Create Project ---
  async function createProject() {
    const name = createName.trim();
    if (!name || createBusy) return;

    setCreateBusy(true);
    setCreateErr(null);

    try {
      const res = await fetch("/app/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Create failed: ${res.status}`);
      }

      const json = JSON.parse(text) as unknown;
      const created = parseCreatedProject(json);
      if (!created) throw new Error("Create succeeded but response shape was unexpected.");

      setProjects((prev) => [created, ...prev]);
      setStats((s) => ({ ...s, totalProjects: s.totalProjects + 1 }));

      setCreateName("");
      setCreateOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setCreateErr(getErrorMessage(e).replace(/^Error:\s*/, ""));
    } finally {
      setCreateBusy(false);
    }
  }

  // --- Rename ---
  async function renameProject(projectId: string) {
    try {
      closeMenu();

      const current = projects.find((p) => p.projectId === projectId);
      const nextName = window.prompt("Rename project", current?.name ?? "");
      const name = (nextName ?? "").trim();
      if (!name) return;

      setBusyId(projectId);

      const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const msg = await readErrorBody(res);
        throw new Error(msg || `Rename failed: ${res.status}`);
      }

      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? { ...p, name, updatedAt: now } : p))
      );

      router.refresh();
    } catch (e: unknown) {
      console.error(e);
      window.alert(`Rename failed: ${getErrorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  // --- Delete (hardened + fixes your current error behavior) ---
  async function deleteProject(projectId: string) {
    try {
      closeMenu();
      const ok = window.confirm("Delete this project? This cannot be undone.");
      if (!ok) return;

      setBusyId(projectId);

      const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });

      // If the server says not found, treat it as already deleted (UI should still update)
      if (res.status === 404) {
        setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
        setStats((s) => ({ ...s, totalProjects: Math.max(0, s.totalProjects - 1) }));
        router.refresh();
        return;
      }

      if (!res.ok) {
        const msg = await readErrorBody(res);
        throw new Error(msg || `Delete failed: ${res.status}`);
      }

      setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
      setStats((s) => ({ ...s, totalProjects: Math.max(0, s.totalProjects - 1) }));
      router.refresh();
    } catch (e: unknown) {
      console.error(e);
      window.alert(`Delete failed: ${getErrorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* Header / Stats */}
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">
            Serverless File Converter
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Projects are isolated per-user. Uploads go direct-to-S3 via presigned URLs,
            metadata lives in DynamoDB, and outputs become artifacts.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<FolderKanban className="h-5 w-5" />}
            label="Total projects"
            value={String(stats.totalProjects)}
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Files converted"
            value={String(stats.totalFiles)}
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5" />}
            label="Space saved"
            value={fmtBytes(stats.spaceSavedBytes)}
          />
        </div>
      </div>

      {/* Projects grid */}
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Your Projects</h2>
            <p className="mt-1 text-sm text-slate-300">
              Each project is a workspace. Hover a card for actions.
            </p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm text-slate-300">No projects yet.</p>
            <p className="mt-2 text-xs text-slate-400">
              Click “New Project” in the top-right to create your first workspace.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {sorted.map((p) => (
              <ProjectCard
                key={p.projectId}
                project={p}
                busy={busyId === p.projectId}
                fileCount={meta[p.projectId]?.fileCount ?? 0}
                latestActivityAt={meta[p.projectId]?.latestActivityAt ?? p.updatedAt}
                onMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  setMenu({ open: true, projectId: p.projectId, x: rect.right, y: rect.bottom });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating menu */}
      <AnimatePresence>
        {menu.open ? (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
            />

            <motion.div
              className="fixed z-50 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1224]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
              style={{
                left: Math.max(12, Math.min(menu.x - 176, (viewportW || 1000) - 200)),
                top: menu.y + 10,
              }}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
            >
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-white/10"
                onClick={() => renameProject(menu.projectId)}
              >
                Rename
              </button>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm text-rose-200 hover:bg-rose-500/10"
                onClick={() => deleteProject(menu.projectId)}
              >
                Delete
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Create Project Modal */}
      <AnimatePresence>
        {createOpen ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setCreateOpen(false);
                setCreateErr(null);
              }}
            />

            <motion.div
              className="fixed left-1/2 top-1/2 z-[60] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              <div className="rounded-[32px] border border-white/10 bg-[#0b1224]/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.65)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/6">
                      <span className="text-xl">＋</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">New Project</p>
                      <p className="text-xs text-slate-400">
                        Create a workspace for uploads and conversions
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateErr(null);
                    }}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void createProject();
                    }}
                    placeholder="Enter project name..."
                    className="w-full rounded-2xl border border-white/10 bg-[#070b16]/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-white/20 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void createProject()}
                      disabled={createBusy || !createName.trim()}
                      className="flex-1 rounded-2xl bg-sky-600/90 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 disabled:hover:bg-sky-600/90 transition shadow-[0_10px_30px_rgba(2,132,199,0.25)]"
                    >
                      {createBusy ? "Creating..." : "Create Project"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreateName("");
                        setCreateErr(null);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition"
                      aria-label="Clear"
                      title="Clear"
                    >
                      ✕
                    </button>
                  </div>

                  {createErr ? <p className="text-xs text-rose-200">{createErr}</p> : null}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StatCard(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3 text-slate-300">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200">
          {props.icon}
        </div>
        <p className="text-xs uppercase tracking-wide">{props.label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-100">{props.value}</p>
    </div>
  );
}

function ProjectCard(props: {
  project: ProjectRow;
  busy: boolean;
  fileCount: number;
  latestActivityAt: string;
  onMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const p = props.project;

  const activityLine =
    props.fileCount > 0 ? (
      <>
        Latest activity <ClientDate iso={props.latestActivityAt} /> •{" "}
        <span className="text-slate-300">{props.fileCount} files</span>
      </>
    ) : (
      <>
        No activity yet • <span className="text-slate-300">0 files</span>
      </>
    );

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group relative"
    >
      <div
        className="pointer-events-none absolute -inset-0.5 rounded-[30px] opacity-0 blur-xl transition group-hover:opacity-100
        bg-[radial-gradient(1000px_circle_at_20%_0%,rgba(56,189,248,0.20),transparent_35%),radial-gradient(900px_circle_at_80%_100%,rgba(168,85,247,0.18),transparent_40%)]"
      />

      <Link
        href={`/app/projects/${encodeURIComponent(p.projectId)}`}
        className="relative block rounded-[30px] border border-white/10 bg-white/5 p-7 shadow-[0_14px_40px_rgba(0,0,0,0.40)]
          transition group-hover:border-white/15 group-hover:bg-white/7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-400">Your Project</p>
            <h3 className="mt-2 truncate text-lg font-semibold text-slate-100">{p.name}</h3>
            <p className="mt-3 text-xs text-slate-400">{activityLine}</p>
          </div>

          <button
            type="button"
            onClick={props.onMenu}
            className="opacity-0 transition group-hover:opacity-100"
            aria-label="Project options"
            title="Options"
          >
            <div className="rounded-full border border-white/10 bg-white/8 p-2 text-slate-200 hover:bg-white/12">
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end text-xs">
          {props.busy ? (
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-slate-200">
              Working…
            </span>
          ) : (
            <span className="opacity-0 transition group-hover:opacity-100 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              Open →
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

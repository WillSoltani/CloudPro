// app/app/projects/[projectId]/components/ConvertedFiles.tsx
"use client";

import {
  Download, List, Grid2X2, Check, Loader2, AlertCircle, Trash2, RefreshCw,
  Search, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import type { ItemSettings, LocalConvertedFile, OutputFormat, PresetId } from "../_lib/ui-types";
import { VALID_OUTPUT_FORMATS, IMAGE_OUTPUT_FORMATS } from "../_lib/ui-types";
import { Thumb } from "./Thumb";

type SortField = "name" | "size" | "date";
type SortDir = "asc" | "desc";
type SortBy = { field: SortField; dir: SortDir };

type Props = {
  files: LocalConvertedFile[];
  projectId: string;
  onDeleteFile?: (fileId: string) => void;
  onReconvert?: (sourceFileId: string, settings: ItemSettings) => void;
  globalSettings: ItemSettings;
};

async function triggerDownload(projectId: string, fileId: string) {
  const res = await fetch(
    `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`
  );
  if (!res.ok) return;
  const data = (await res.json()) as { downloadUrl?: string };
  if (!data.downloadUrl) return;
  const a = document.createElement("a");
  a.href = data.downloadUrl;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function StatusBadge({ status }: { status: LocalConvertedFile["status"] }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
        <Check className="h-3 w-3" />Done
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200">
        <AlertCircle className="h-3 w-3" />Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
      <Loader2 className="h-3 w-3 animate-spin" />Processing
    </span>
  );
}

function Badge(props: { children: React.ReactNode; tone?: "active" }) {
  const cls =
    props.tone === "active"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/20"
      : "bg-white/5 text-slate-200 border-white/10";
  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", cls].join(" ")}>
      {props.children}
    </span>
  );
}

function MultiOutputBadge({ file }: { file: LocalConvertedFile }) {
  if (file.packaging !== "zip") return null;
  const count = file.outputCount ?? file.pageCount ?? 0;
  if (count <= 1) return <Badge>ZIP</Badge>;
  return <Badge>{`${count} pages (ZIP)`}</Badge>;
}

function Checkbox({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
        checked
          ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
          : "border-white/15 bg-white/5 text-transparent hover:bg-white/10",
      ].join(" ")}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}

function ReconvertPanel({
  file,
  globalSettings,
  onReconvert,
  onClose,
}: {
  file: LocalConvertedFile;
  globalSettings: ItemSettings;
  onReconvert: (sourceFileId: string, settings: ItemSettings) => void;
  onClose: () => void;
}) {
  const [fmt, setFmt] = useState<OutputFormat>(globalSettings.format);
  const [quality, setQuality] = useState(globalSettings.quality);
  const [preset, setPreset] = useState<PresetId>(globalSettings.preset);
  const [resizePct, setResizePct] = useState(globalSettings.resizePct);

  if (!file.sourceFileId) return null;

  // Only show formats valid for the source file type
  const availableFormats: OutputFormat[] =
    VALID_OUTPUT_FORMATS[file.fromLabel] ?? IMAGE_OUTPUT_FORMATS;

  return (
    <div className="border-t border-white/10 bg-white/2 px-5 py-4 space-y-4">
      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Reconvert settings</div>

      <div>
        <div className="mb-2 text-xs text-slate-400">Output format</div>
        <div className="flex flex-wrap gap-1.5">
          {availableFormats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFmt(f)}
              className={[
                "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                fmt === f
                  ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {fmt !== "PDF" && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Quality</span>
              <span className="text-slate-200">{quality}%</span>
            </div>
            <input
              type="range" min={1} max={100} value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Resize</span>
              <span className="text-slate-200">{resizePct === 100 ? "No resize" : `${resizePct}%`}</span>
            </div>
            <input
              type="range" min={10} max={100} step={5} value={resizePct}
              onChange={(e) => setResizePct(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onReconvert(file.sourceFileId!, { format: fmt, quality, preset, resizePct });
            onClose();
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <RefreshCw className="h-3.5 w-3.5" />Reconvert
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SortButton({
  field, label, current, onChange,
}: {
  field: SortField;
  label: string;
  current: SortBy;
  onChange: (s: SortBy) => void;
}) {
  const active = current.field === field;
  return (
    <button
      type="button"
      onClick={() => onChange({ field, dir: active && current.dir === "asc" ? "desc" : "asc" })}
      className={[
        "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition",
        active
          ? "border-sky-400/30 bg-sky-500/15 text-sky-200"
          : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {label}
      {active
        ? current.dir === "asc"
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        : null}
    </button>
  );
}

export function ConvertedFiles({
  files, projectId, onDeleteFile, onReconvert, globalSettings,
}: Props) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [expandedReconvert, setExpandedReconvert] = useState<string | null>(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Search + sort
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>({ field: "date", dir: "desc" });

  const doneFiles = useMemo(() => files.filter((f) => f.status === "done"), [files]);

  const displayFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? files.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.fromLabel.toLowerCase().includes(q) ||
            f.toLabel.toLowerCase().includes(q)
        )
      : files;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy.field === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy.field === "size") {
        cmp = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
      } else {
        cmp = (a.whenLabel ?? "").localeCompare(b.whenLabel ?? "");
      }
      return sortBy.dir === "asc" ? cmp : -cmp;
    });
  }, [files, query, sortBy]);

  const allDisplaySelected =
    displayFiles.length > 0 && displayFiles.every((f) => selectedIds.has(f.id));
  const someSelected = selectedIds.size > 0;
  const selectedDoneIds = useMemo(
    () =>
      [...selectedIds].filter((id) => files.find((f) => f.id === id)?.status === "done"),
    [selectedIds, files]
  );

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllDisplay = useCallback(() => {
    setSelectedIds((prev) => {
      if (allDisplaySelected) {
        const next = new Set(prev);
        displayFiles.forEach((f) => next.delete(f.id));
        return next;
      }
      const next = new Set(prev);
      displayFiles.forEach((f) => next.add(f.id));
      return next;
    });
  }, [allDisplaySelected, displayFiles]);

  async function handleDownloadOne(fileId: string) {
    if (downloadingId === fileId) return;
    setDownloadingId(fileId);
    try {
      await triggerDownload(projectId, fileId);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    if (downloadingAll || doneFiles.length === 0) return;
    setDownloadingAll(true);
    try {
      for (const f of doneFiles) {
        await triggerDownload(projectId, f.id);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  async function handleBulkDownload() {
    if (bulkDownloading || selectedDoneIds.length === 0) return;
    setBulkDownloading(true);
    try {
      for (const id of selectedDoneIds) {
        await triggerDownload(projectId, id);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setBulkDownloading(false);
    }
  }

  async function handleBulkDelete() {
    if (!onDeleteFile || bulkDeleting || selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    try {
      for (const id of ids) onDeleteFile(id);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xl font-semibold text-slate-100">
          Converted Files
          {files.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">({files.length})</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {someSelected && (
            <>
              <button
                type="button"
                onClick={() => void handleBulkDownload()}
                disabled={bulkDownloading || selectedDoneIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40"
              >
                {bulkDownloading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Download ({selectedDoneIds.length})
              </button>
              {onDeleteFile && (
                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/15 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />Delete ({selectedIds.size})
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => void handleDownloadAll()}
            disabled={downloadingAll || doneFiles.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {downloadingAll ? "Downloading…" : "All"}
          </button>

          <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={["px-3 py-2 text-slate-200 transition hover:bg-white/10", view === "list" ? "bg-white/10" : ""].join(" ")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={["px-3 py-2 text-slate-200 transition hover:bg-white/10", view === "grid" ? "bg-white/10" : ""].join(" ")}
              aria-label="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search + Sort */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Sort:</span>
            <SortButton field="name" label="Name" current={sortBy} onChange={setSortBy} />
            <SortButton field="size" label="Size" current={sortBy} onChange={setSortBy} />
            <SortButton field="date" label="Date" current={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/3 px-5 py-8 text-sm text-slate-400">
          No converted files yet.
        </div>
      ) : displayFiles.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/3 px-5 py-6 text-sm text-slate-400">
          No files match &ldquo;{query}&rdquo;.
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-1 py-1">
            <Checkbox checked={allDisplaySelected} onClick={toggleAllDisplay} label="Select all" />
            <span className="text-xs text-slate-500">
              {someSelected ? `${selectedIds.size} selected` : "Select files"}
            </span>
          </div>

          {displayFiles.map((f) => (
            <div
              key={f.id}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-white/3 shadow-[0_14px_60px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <Checkbox
                  checked={selectedIds.has(f.id)}
                  onClick={() => toggleOne(f.id)}
                  label={`Select ${f.name}`}
                />
                <Thumb src={f.previewUrl} alt={f.name} fallbackLabel={f.toLabel} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{f.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {f.sizeLabel && <span>{f.sizeLabel}</span>}
                    {f.whenLabel && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>{formatTime(f.whenLabel)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                  <Badge>{f.fromLabel}</Badge>
                  <span className="text-slate-600">→</span>
                  <Badge tone="active">{f.toLabel}</Badge>
                  <MultiOutputBadge file={f} />
                  <StatusBadge status={f.status} />
                </div>

                <div className="flex items-center gap-1">
                  {f.status === "done" && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadOne(f.id)}
                      disabled={downloadingId === f.id}
                      title="Download"
                      className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-slate-200 disabled:opacity-40"
                    >
                      {downloadingId === f.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />}
                    </button>
                  )}
                  {onReconvert && f.sourceFileId && (
                    <button
                      type="button"
                      onClick={() => setExpandedReconvert(expandedReconvert === f.id ? null : f.id)}
                      title="Reconvert"
                      className={[
                        "grid h-8 w-8 place-items-center rounded-xl transition",
                        expandedReconvert === f.id
                          ? "bg-sky-500/20 text-sky-300"
                          : "text-slate-500 hover:bg-white/10 hover:text-slate-200",
                      ].join(" ")}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteFile && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(f.id)}
                      title="Remove"
                      className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {expandedReconvert === f.id && onReconvert && f.sourceFileId && (
                <ReconvertPanel
                  file={f}
                  globalSettings={globalSettings}
                  onReconvert={onReconvert}
                  onClose={() => setExpandedReconvert(null)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-1 py-1">
            <Checkbox checked={allDisplaySelected} onClick={toggleAllDisplay} label="Select all" />
            <span className="text-xs text-slate-500">
              {someSelected ? `${selectedIds.size} selected` : "Select files"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {displayFiles.map((f) => (
              <div
                key={f.id}
                className={[
                  "flex flex-col overflow-hidden rounded-[20px] border bg-white/3 shadow-[0_14px_60px_rgba(0,0,0,0.35)]",
                  selectedIds.has(f.id) ? "border-sky-400/25" : "border-white/10",
                ].join(" ")}
              >
                <div className="relative aspect-square w-full bg-white/5">
                  {/* Always-visible fallback text behind the image */}
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="text-lg font-bold tracking-wide text-slate-400/60">
                      {f.toLabel.toUpperCase()}
                    </span>
                  </div>
                  {f.previewUrl && (
                    <img
                      key={f.previewUrl}
                      src={f.previewUrl}
                      alt={f.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="absolute bottom-2 right-2">
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="absolute left-2 top-2">
                    <Checkbox
                      checked={selectedIds.has(f.id)}
                      onClick={() => toggleOne(f.id)}
                      label={`Select ${f.name}`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 px-3 py-2">
                  <div className="truncate text-xs font-semibold text-slate-100">{f.name}</div>
                  <div className="flex items-center gap-1.5">
                    <Badge>{f.fromLabel}</Badge>
                    <span className="text-slate-600 text-xs">→</span>
                    <Badge tone="active">{f.toLabel}</Badge>
                    <MultiOutputBadge file={f} />
                  </div>
                </div>

                <div className="flex border-t border-white/10">
                  {f.status === "done" && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadOne(f.id)}
                      disabled={downloadingId === f.id}
                      className="flex flex-1 items-center justify-center gap-1.5 py-2 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {downloadingId === f.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      Download
                    </button>
                  )}
                  {onReconvert && f.sourceFileId && (
                    <button
                      type="button"
                      onClick={() => setExpandedReconvert(expandedReconvert === f.id ? null : f.id)}
                      className="flex items-center justify-center gap-1.5 border-l border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-sky-500/10 hover:text-sky-300"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDeleteFile && (
                    <button
                      type="button"
                      onClick={() => onDeleteFile(f.id)}
                      className="flex items-center justify-center gap-1.5 border-l border-white/10 px-3 py-2 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {expandedReconvert === f.id && onReconvert && f.sourceFileId && (
                  <ReconvertPanel
                    file={f}
                    globalSettings={globalSettings}
                    onReconvert={onReconvert}
                    onClose={() => setExpandedReconvert(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// app/app/projects/[projectId]/ProjectDetailClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConvertedFiles } from "./components/ConvertedFiles";
import { ConversionSettings } from "./components/ConversionSettings";

import type { FileRow } from "../_lib/types";
import type { ItemSettings, LocalConvertedFile, LocalReadyFile, OutputFormat, PresetId } from "./_lib/ui-types";
import { ALL_OUTPUT_FORMATS, IMAGE_OUTPUT_FORMATS, VALID_OUTPUT_FORMATS } from "./_lib/ui-types";
import {
  FORMAT_CAPABILITIES,
  INPUT_ONLY_FORMAT_LABELS,
  invalidTargetReasonForSourceLabel,
  recommendedOutputsForSourceLabels,
  sortOutputsByRecommendation,
} from "@/app/app/_lib/conversion-support";

import { completeUpload, convertFiles, createUpload } from "./_lib/api-client";
import { fmtBytes, formatFromFilenameOrContentType, safeFilenameFromRow } from "./_lib/format";

import { useSignedUrls } from "./hooks/useSignedUrls";
import { useStagedFiles } from "./hooks/useStagedFiles";
import { useServerFiles } from "./hooks/useServerFiles";
import { useSetFileCount } from "./FileCountContext";

type Props = {
  projectId: string;
  projectName: string;
  initialFiles: FileRow[];
};

type FillPdfTarget = {
  name: string;
  source: "staged" | "uploaded";
  fileId?: string;
};

const DEFAULT_SETTINGS: ItemSettings = {
  format: "JPG",
  quality: 100,
  preset: "web",
  resizePct: 100,
};

function buildFakeFile(filename: string, contentType: string) {
  return new File([], filename, { type: contentType || "application/octet-stream" });
}

function summarizeConvert(results: Array<{ ok: boolean; error?: string }>) {
  const okCount = results.reduce((acc, r) => acc + (r.ok ? 1 : 0), 0);
  const failCount = results.length - okCount;
  const firstError = results.find((r) => !r.ok && r.error)?.error;
  return { okCount, failCount, firstError };
}

export default function ProjectDetailClient({ projectId, initialFiles }: Props) {
  // Global defaults shown in the sidebar
  const [globalFormat, setGlobalFormat] = useState<OutputFormat>("JPG");
  const [globalQuality, setGlobalQuality] = useState(100);
  const [globalPreset, setGlobalPreset] = useState<PresetId>("web");
  const [globalResizePct, setGlobalResizePct] = useState(100);

  // Per-item settings overrides — keyed by fileId
  const [itemSettings, setItemSettings] = useState<Record<string, ItemSettings>>({});

  const [uploadBusy, setUploadBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fillPdfTarget, setFillPdfTarget] = useState<FillPdfTarget | null>(null);

  const setFileCount = useSetFileCount();
  const staged = useStagedFiles();
  const server = useServerFiles({ projectId, initialFiles, onError: setError });
  const signed = useSignedUrls(projectId, server.files);

  // Keep navbar file count in sync with live file list
  useEffect(() => {
    setFileCount(server.files.length);
  }, [server.files, setFileCount]);

  // Inject dropSignedUrl into server hook
  useEffect(() => {
    server.setDropSignedUrl(signed.dropSignedUrl);
  }, [server, signed.dropSignedUrl]);

  // Effective settings for a file (per-item override or global defaults)
  const getSettings = useCallback(
    (fileId: string): ItemSettings =>
      itemSettings[fileId] ?? { ...DEFAULT_SETTINGS },
    [itemSettings]
  );

  // Per-item format override (inline selector in ReadyQueue row)
  const setItemFormat = useCallback(
    (fileId: string, fmt: OutputFormat) => {
      setItemSettings((prev) => {
        const existing = prev[fileId] ?? { ...DEFAULT_SETTINGS };
        return { ...prev, [fileId]: { ...existing, format: fmt } };
      });
    },
    []
  );

  // Sidebar changes apply to all selected items + update global default
  const handleGlobalFormat = useCallback(
    (f: OutputFormat) => {
      setGlobalFormat(f);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), format: f };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalQuality = useCallback(
    (q: number) => {
      setGlobalQuality(q);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), quality: q };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalPreset = useCallback(
    (p: PresetId) => {
      const presetDefaults: Record<PresetId, { format: OutputFormat; quality: number }> = {
        web: { format: "WebP", quality: 80 },
        hq: { format: "PNG", quality: 95 },
        email: { format: "JPG", quality: 70 },
      };
      const { format, quality } = presetDefaults[p];
      setGlobalPreset(p);
      setGlobalFormat(format);
      setGlobalQuality(quality);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), preset: p, format, quality };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  const handleGlobalResizePct = useCallback(
    (r: number) => {
      setGlobalResizePct(r);
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of server.selectedReadyIds) {
          next[id] = { ...(prev[id] ?? { ...DEFAULT_SETTINGS }), resizePct: r };
        }
        return next;
      });
    },
    [server.selectedReadyIds]
  );

  // Keep per-item settings isolated:
  // - remove settings for deleted files
  // - initialize new raw files once using current global defaults
  const prevFileIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentRawIds = new Set(server.rawReadyFiles.map((f) => f.fileId));
    const removed = [...prevFileIdsRef.current].filter((id) => !currentRawIds.has(id));
    const added = [...currentRawIds].filter((id) => !prevFileIdsRef.current.has(id));

    if (removed.length > 0 || added.length > 0) {
      setItemSettings((prev) => {
        const next = { ...prev };
        for (const id of removed) delete next[id];
        for (const id of added) {
          if (!next[id]) {
            next[id] = {
              format: globalFormat,
              quality: globalQuality,
              preset: globalPreset,
              resizePct: globalResizePct,
            };
          }
        }
        return next;
      });
    }

    prevFileIdsRef.current = currentRawIds;
  }, [server.rawReadyFiles, globalFormat, globalQuality, globalPreset, globalResizePct]);

  // ---- Upload ----
  const onUploadClick = useCallback(async () => {
    if (uploadBusy || staged.uploadDisabled) return;
    setError(null);
    setNotice(null);
    setUploadBusy(true);
    try {
      for (const item of staged.selectedFiles) {
        const file = item.file;
        const upload = await createUpload(projectId, file);
        const putRes = await fetch(upload.putUrl, { method: "PUT", headers: upload.headers, body: file });
        if (!putRes.ok) throw new Error(`S3 PUT failed: ${putRes.status}`);
        await completeUpload(projectId, {
          uploadId: upload.uploadId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          bucket: upload.bucket,
          key: upload.key,
        });
      }
      staged.consumeSelected();
      await server.refreshFiles({ validate: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      await server.refreshFiles({ validate: true });
    } finally {
      setUploadBusy(false);
    }
  }, [uploadBusy, staged, projectId, server]);

  // ---- Ready view (raw) ----
  const readyView: LocalReadyFile[] = useMemo(() => {
    return server.rawReadyFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const from = formatFromFilenameOrContentType(filename, f.contentType);
      const s = getSettings(f.fileId);
      return {
        id: f.fileId,
        file: buildFakeFile(filename, f.contentType),
        previewUrl: signed.signedUrls[f.fileId] || "",
        fromLabel: String(from),
        toFormat: s.format,
        quality: s.quality,
        preset: s.preset,
        resizePct: s.resizePct,
        sizeLabel: fmtBytes(f.sizeBytes),
        selected: Boolean(server.selectedReady[f.fileId]),
      };
    });
  }, [server.rawReadyFiles, server.selectedReady, signed.signedUrls, getSettings]);

  // ---- Converted view (output) — toLabel is IMMUTABLE from DDB ----
  const convertedView: LocalConvertedFile[] = useMemo(() => {
    return server.outputFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      // Derive fromLabel from source file. Priority:
      // 1. Live source row (if still in file list)
      // 2. Stored sourceContentType (persisted in DDB on output row creation)
      // 3. Fallback to output contentType (pre-Lambda update, may be source CT)
      const sourceFile = f.sourceFileId
        ? server.files.find((sf) => sf.fileId === f.sourceFileId)
        : undefined;
      const from = sourceFile
        ? formatFromFilenameOrContentType(safeFilenameFromRow(sourceFile), sourceFile.contentType)
        : f.sourceContentType
          ? formatFromFilenameOrContentType(filename, f.sourceContentType)
          : formatFromFilenameOrContentType(filename, f.contentType);
      const st = String(f.status || "").toLowerCase();
      const status: "done" | "processing" | "failed" =
        st === "done" ? "done" : st === "failed" ? "failed" : "processing";

      // toLabel = actual output format stored in DDB — never derived from current UI state
      const toLabel =
        f.outputFormat ?? (filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : "?");

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        fromLabel: String(from),
        toLabel,
        sourceFileId: f.sourceFileId,
        sizeBytes: f.sizeBytes ?? undefined,
        sizeLabel: fmtBytes(f.sizeBytes),
        whenLabel: f.updatedAt || f.createdAt || "",
        status,
        packaging: f.packaging,
        pageCount: f.pageCount,
        outputCount: f.outputCount,
      };
    });
  }, [server.outputFiles, server.files, signed.signedUrls]);

  const availableSidebarFormats = useMemo<OutputFormat[]>(() => {
    const selectedReady = readyView.filter((f) => f.selected);
    if (selectedReady.length === 0) {
      return sortOutputsByRecommendation(FORMAT_CAPABILITIES.supportedOutputs, []);
    }

    const allowedSets = selectedReady.map((f) => VALID_OUTPUT_FORMATS[f.fromLabel] ?? IMAGE_OUTPUT_FORMATS);
    const intersection = ALL_OUTPUT_FORMATS.filter((fmt) =>
      allowedSets.every((list) => list.includes(fmt))
    );
    const sensibleIntersection = intersection.filter((fmt) =>
      selectedReady.every((f) => !invalidTargetReasonForSourceLabel(f.fromLabel, fmt))
    );
    const selectedSourceLabels = selectedReady.map((f) => f.fromLabel);
    return sortOutputsByRecommendation(
      sensibleIntersection.length > 0 ? sensibleIntersection : intersection.length > 0 ? intersection : [...IMAGE_OUTPUT_FORMATS],
      selectedSourceLabels
    );
  }, [readyView]);

  const recommendedSidebarFormats = useMemo<OutputFormat[]>(() => {
    const selectedReady = readyView.filter((f) => f.selected);
    const sourceLabels = selectedReady.map((f) => f.fromLabel);
    return recommendedOutputsForSourceLabels(sourceLabels, availableSidebarFormats);
  }, [readyView, availableSidebarFormats]);

  const inputOnlySidebarFormats = useMemo<string[]>(
    () => [...INPUT_ONLY_FORMAT_LABELS],
    []
  );

  useEffect(() => {
    if (availableSidebarFormats.includes(globalFormat)) return;
    setGlobalFormat(availableSidebarFormats[0] ?? "JPG");
  }, [availableSidebarFormats, globalFormat]);

  // ---- Convert ----
  const onConvert = useCallback(async () => {
    if (convertBusy || !server.anyReadySelected) return;
    setConvertBusy(true);
    setError(null);
    setNotice(null);
    try {
      const conversions = server.selectedReadyIds.map((fileId) => {
        const s = getSettings(fileId);
        return {
          fileId,
          outputFormat: s.format,
          quality: s.quality,
          preset: s.preset,
          resizePct: s.resizePct < 100 ? s.resizePct : null,
        };
      });

      const res = await convertFiles(projectId, { conversions });
      const summary = summarizeConvert(
        res.results.map((r) => (r.ok ? { ok: true } : { ok: false, error: (r as { error: string }).error }))
      );

      if (summary.failCount === 0) {
        setNotice(`Queued ${summary.okCount} conversion${summary.okCount !== 1 ? "s" : ""}.`);
      } else {
        setNotice(
          `${summary.okCount} queued, ${summary.failCount} failed${summary.firstError ? ` (${summary.firstError})` : ""}.`
        );
      }

      await server.refreshFiles({ validate: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setConvertBusy(false);
    }
  }, [convertBusy, server, projectId, getSettings]);

  // ---- Reconvert ----
  const onReconvert = useCallback(
    async (sourceFileId: string, settings: ItemSettings) => {
      setError(null);
      try {
        const res = await convertFiles(projectId, {
          conversions: [{
            fileId: sourceFileId,
            outputFormat: settings.format,
            quality: settings.quality,
            preset: settings.preset,
            resizePct: settings.resizePct < 100 ? settings.resizePct : null,
          }],
        });
        const r = res.results[0];
        if (r && !r.ok) {
          setError(`Reconvert failed: ${(r as { error: string }).error}`);
        } else {
          setNotice("Reconversion queued.");
          await server.refreshFiles({ validate: false });
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Reconvert failed");
      }
    },
    [projectId, server]
  );

  const openFillPdfPlaceholder = useCallback((target: FillPdfTarget) => {
    setFillPdfTarget(target);
  }, []);

  const closeFillPdfPlaceholder = useCallback(() => {
    setFillPdfTarget(null);
  }, []);

  return (
    <>
      <div className="mx-auto grid max-w-350 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {notice}
            </div>
          ) : null}

          <DropzoneCard
            pendingCount={staged.staged.length}
            onPickFiles={staged.onPickFiles}
            onUploadClick={onUploadClick}
            uploadDisabled={uploadBusy || staged.uploadDisabled}
            stagedItems={staged.stagedItems}
            onRemoveStagedItem={staged.removeStaged}
            onFillPdf={openFillPdfPlaceholder}
          />

          <ReadyQueue
            files={readyView}
            onToggleAll={server.onToggleAllReady}
            onToggleOne={server.onToggleOneReady}
            onRemoveSelected={server.onRemoveSelectedReady}
            onConvert={onConvert}
            onSetItemFormat={setItemFormat}
            onFillPdf={openFillPdfPlaceholder}
            convertBusy={convertBusy}
          />

          <ConvertedFiles
            files={convertedView}
            projectId={projectId}
            onDeleteFile={server.deleteOne}
            onReconvert={onReconvert}
            globalSettings={{ format: globalFormat, quality: globalQuality, preset: globalPreset, resizePct: globalResizePct }}
          />
        </div>

        <aside className="space-y-6">
          <ConversionSettings
            format={globalFormat}
            availableFormats={availableSidebarFormats}
            inputOnlyFormats={inputOnlySidebarFormats}
            recommendedFormats={recommendedSidebarFormats}
            onFormat={handleGlobalFormat}
            quality={globalQuality}
            onQuality={handleGlobalQuality}
            preset={globalPreset}
            onPreset={handleGlobalPreset}
            resizePct={globalResizePct}
            onResizePct={handleGlobalResizePct}
            selectedCount={server.selectedReadyIds.length}
          />
        </aside>
      </div>

      {fillPdfTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fill PDF placeholder"
          onClick={closeFillPdfPlaceholder}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Placeholder</div>
            <h3 className="mt-2 text-xl font-semibold text-slate-100">Fill & Sign PDF</h3>
            <p className="mt-3 text-sm text-slate-300">
              This is a UI-only stub for now. No PDF fill logic runs yet.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              File: <span className="font-semibold text-slate-200">{fillPdfTarget.name}</span> ({fillPdfTarget.source})
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeFillPdfPlaceholder}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

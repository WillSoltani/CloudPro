"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConvertedFiles } from "./components/ConvertedFiles";
import { ConversionSettings } from "./components/ConversionSettings";

import type { FileRow } from "../_lib/types";
import type { ItemSettings, LocalConvertedFile, LocalReadyFile, OutputFormat, PresetId } from "./_lib/ui-types";
import { ALL_OUTPUT_FORMATS, VALID_OUTPUT_FORMATS } from "./_lib/ui-types";
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
  const router = useRouter();
  const [globalFormat, setGlobalFormat] = useState<OutputFormat>("JPG");
  const [globalQuality, setGlobalQuality] = useState(100);
  const [globalPreset, setGlobalPreset] = useState<PresetId>("web");
  const [globalResizePct, setGlobalResizePct] = useState(100);

  const [itemSettings, setItemSettings] = useState<Record<string, ItemSettings>>({});

  const [uploadBusy, setUploadBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setFileCount = useSetFileCount();
  const staged = useStagedFiles();
  const server = useServerFiles({ projectId, initialFiles, onError: setError });
  const signed = useSignedUrls(projectId, server.files);

  useEffect(() => {
    setFileCount(server.files.length);
  }, [server.files, setFileCount]);

  useEffect(() => {
    server.setDropSignedUrl(signed.dropSignedUrl);
  }, [server, signed.dropSignedUrl]);

  const getSettings = useCallback(
    (fileId: string): ItemSettings =>
      itemSettings[fileId] ?? { ...DEFAULT_SETTINGS },
    [itemSettings]
  );

  const setItemFormat = useCallback(
    (fileId: string, fmt: OutputFormat) => {
      setItemSettings((prev) => {
        const existing = prev[fileId] ?? { ...DEFAULT_SETTINGS };
        return { ...prev, [fileId]: { ...existing, format: fmt } };
      });
    },
    []
  );

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

  const readyView: LocalReadyFile[] = useMemo(() => {
    return server.rawReadyFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const from = formatFromFilenameOrContentType(filename, f.contentType);
      const s = getSettings(f.fileId);
      return {
        id: f.fileId,
        file: buildFakeFile(filename, f.contentType),
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
        status: f.status,
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

  const convertedView: LocalConvertedFile[] = useMemo(() => {
    return server.outputFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
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

      const toLabel =
        f.outputFormat ?? (filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : "?");

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
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

  const filledPdfView: LocalConvertedFile[] = useMemo(() => {
    return server.filledPdfFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const sourceFile = f.sourceFileId
        ? server.files.find((sf) => sf.fileId === f.sourceFileId)
        : undefined;
      const from = sourceFile
        ? formatFromFilenameOrContentType(safeFilenameFromRow(sourceFile), sourceFile.contentType)
        : "PDF";
      const st = String(f.status || "").toLowerCase();
      const status: "done" | "processing" | "failed" =
        st === "done" ? "done" : st === "failed" ? "failed" : "processing";

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        contentType: f.contentType,
        fromLabel: String(from),
        toLabel: "PDF",
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
  }, [server.filledPdfFiles, server.files, signed.signedUrls]);

  const selectedReadyView = useMemo(
    () => readyView.filter((f) => f.selected),
    [readyView]
  );

  const selectedReadySourceLabels = useMemo(
    () => selectedReadyView.map((f) => f.fromLabel),
    [selectedReadyView]
  );

  const allSidebarFormats = useMemo<OutputFormat[]>(
    () => sortOutputsByRecommendation(FORMAT_CAPABILITIES.supportedOutputs, selectedReadySourceLabels),
    [selectedReadySourceLabels]
  );

  const enabledSidebarFormats = useMemo<OutputFormat[]>(() => {
    if (selectedReadyView.length === 0) return [];
    const allowedSets = selectedReadyView.map((f) => VALID_OUTPUT_FORMATS[f.fromLabel] ?? []);
    const intersection = ALL_OUTPUT_FORMATS.filter((fmt) =>
      allowedSets.every((list) => list.includes(fmt))
    );
    return intersection.filter((fmt) =>
      selectedReadyView.every((f) => !invalidTargetReasonForSourceLabel(f.fromLabel, fmt))
    );
  }, [selectedReadyView]);

  const recommendedSidebarFormats = useMemo<OutputFormat[]>(() => {
    if (selectedReadyView.length === 0) return [];
    return recommendedOutputsForSourceLabels(
      selectedReadySourceLabels,
      enabledSidebarFormats,
      3
    );
  }, [selectedReadyView.length, selectedReadySourceLabels, enabledSidebarFormats]);

  const inputOnlySidebarFormats = useMemo<string[]>(
    () => [...INPUT_ONLY_FORMAT_LABELS],
    []
  );

  useEffect(() => {
    if (allSidebarFormats.includes(globalFormat)) return;
    setGlobalFormat(allSidebarFormats[0] ?? "JPG");
  }, [allSidebarFormats, globalFormat]);

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

  const openFillPdf = useCallback(
    (target: FillPdfTarget) => {
      if (target.source !== "uploaded" || !target.fileId) {
        setNotice(`Upload "${target.name}" first to open Fill PDF.`);
        return;
      }
      setError(null);
      setNotice(null);
      router.push(
        `/app/projects/${encodeURIComponent(projectId)}/fill/${encodeURIComponent(target.fileId)}`
      );
    },
    [projectId, router]
  );

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
            onFillPdf={openFillPdf}
          />

          <ReadyQueue
            projectId={projectId}
            files={readyView}
            onToggleAll={server.onToggleAllReady}
            onToggleOne={server.onToggleOneReady}
            onRemoveSelected={server.onRemoveSelectedReady}
            onConvert={onConvert}
            onSetItemFormat={setItemFormat}
            onFillPdf={openFillPdf}
            convertBusy={convertBusy}
          />

          <ConvertedFiles
            files={convertedView}
            projectId={projectId}
            onDeleteFile={server.deleteOne}
            onReconvert={onReconvert}
            globalSettings={{ format: globalFormat, quality: globalQuality, preset: globalPreset, resizePct: globalResizePct }}
          />

          {filledPdfView.length > 0 ? (
            <ConvertedFiles
              files={filledPdfView}
              projectId={projectId}
              onDeleteFile={server.deleteOne}
              title="Filled PDFs"
              emptyMessage="No filled PDFs yet."
              globalSettings={{ format: globalFormat, quality: globalQuality, preset: globalPreset, resizePct: globalResizePct }}
            />
          ) : null}
        </div>

        <aside className="space-y-6">
          <ConversionSettings
            format={globalFormat}
            allFormats={allSidebarFormats}
            enabledFormats={enabledSidebarFormats}
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

    </>
  );
}

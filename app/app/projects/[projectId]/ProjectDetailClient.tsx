// app/app/projects/[projectId]/ProjectDetailClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConvertedFiles } from "./components/ConvertedFiles";
import { ConversionSettings } from "./components/ConversionSettings";

import type { FileRow } from "../_lib/types";
import type { LocalConvertedFile, LocalReadyFile, OutputFormat, PresetId } from "./_lib/ui-types";

import { completeUpload, convertFiles, createUpload } from "./_lib/api-client";
import { fmtBytes, formatFromFilenameOrContentType, safeFilenameFromRow } from "./_lib/format";

import { useSignedUrls } from "./hooks/useSignedUrls";
import { useStagedFiles } from "./hooks/useStagedFiles";
import { useServerFiles } from "./hooks/useServerFiles";

type Props = {
  projectId: string;
  projectName: string;
  initialFiles: FileRow[];
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
  const [format, setFormat] = useState<OutputFormat>("JPG");
  const [quality, setQuality] = useState(55);
  const [preset, setPreset] = useState<PresetId>("web");

  const [uploadBusy, setUploadBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const staged = useStagedFiles();

  const server = useServerFiles({
    projectId,
    initialFiles,
    onError: setError,
  });

  const signed = useSignedUrls(projectId, server.files);

  // If your server hook needs dropSignedUrl injected, do it safely.
  useEffect(() => {
    if (typeof (server as unknown as { setDropSignedUrl?: unknown }).setDropSignedUrl === "function") {
      (server as unknown as { setDropSignedUrl: (fn: (id: string) => void) => void }).setDropSignedUrl(
        signed.dropSignedUrl
      );
    }
  }, [server, signed.dropSignedUrl]);

  // ---- Upload ----
  const onUploadClick = useCallback(async () => {
    if (uploadBusy) return;
    if (staged.uploadDisabled) return;

    setError(null);
    setNotice(null);
    setUploadBusy(true);

    try {
      for (const item of staged.selectedFiles) {
        const file = item.file;

        const upload = await createUpload(projectId, file);

        const putRes = await fetch(upload.putUrl, {
          method: "PUT",
          headers: upload.headers,
          body: file,
        });

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

      return {
        id: f.fileId,
        file: buildFakeFile(filename, f.contentType),
        previewUrl: signed.signedUrls[f.fileId] || "",
        fromLabel: from,
        toFormat: format,
        sizeLabel: fmtBytes(f.sizeBytes),
        selected: Boolean(server.selectedReady[f.fileId]),
      };
    });
  }, [server.rawReadyFiles, server.selectedReady, signed.signedUrls, format]);

  // ---- Converted view (output) ----
  const convertedView: LocalConvertedFile[] = useMemo(() => {
    return server.outputFiles.map((f) => {
      const filename = safeFilenameFromRow(f);
      const from = formatFromFilenameOrContentType(filename, f.contentType);

      const st = String(f.status || "").toLowerCase();
      const status: "done" | "processing" | "failed" =
        st === "done" ? "done" : st === "failed" ? "failed" : "processing";

      const toLabel =
        typeof (f as unknown as { outputFormat?: unknown }).outputFormat === "string"
          ? String((f as unknown as { outputFormat: string }).outputFormat)
          : format;

      return {
        id: f.fileId,
        filename,
        name: filename,
        previewUrl: signed.signedUrls[f.fileId] || "",
        fromLabel: from,
        toLabel,
        sizeLabel: fmtBytes(f.sizeBytes),
        whenLabel: f.updatedAt || f.createdAt || "",
        status,
        progress: undefined,
        format,
      };
    });
  }, [server.outputFiles, signed.signedUrls, format]);

  // ---- Convert ----
  const onConvert = useCallback(async () => {
    if (convertBusy) return;
    if (!server.anyReadySelected) return;

    setConvertBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await convertFiles(projectId, {
        fileIds: server.selectedReadyIds,
        outputFormat: format,
        quality,
        preset,
      });

      const summary = summarizeConvert(
        res.results.map((r) => ("ok" in r && r.ok ? { ok: true } : { ok: false, error: (r as { error: string }).error }))
      );

      if (summary.failCount === 0) {
        setNotice(`Converted: ${summary.okCount} succeeded.`);
      } else {
        setNotice(
          `Converted: ${summary.okCount} succeeded, ${summary.failCount} failed${summary.firstError ? ` (${summary.firstError})` : ""}.`
        );
      }

      await server.refreshFiles({ validate: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setConvertBusy(false);
    }
  }, [convertBusy, server, projectId, format, quality, preset]);

  return (
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
          selectedItems={staged.selectedItems}
          onToggleSelectedItem={staged.toggleOneStaged}
          onToggleAllSelected={staged.toggleAllStaged}
        />

        <ReadyQueue
          files={readyView}
          onToggleAll={server.onToggleAllReady}
          onToggleOne={server.onToggleOneReady}
          onRemoveSelected={server.onRemoveSelectedReady}
          onConvert={onConvert}
        />

        <ConvertedFiles files={convertedView} />
      </div>

      <aside className="space-y-6">
        <ConversionSettings
          format={format}
          onFormat={setFormat}
          quality={quality}
          onQuality={setQuality}
          preset={preset}
          onPreset={setPreset}
        />
      </aside>
    </div>
  );
}
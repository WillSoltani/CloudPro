"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConvertedFiles } from "./components/ConvertedFiles";
import { ConversionSettings } from "./components/ConversionSettings";

import type { FileRow } from "../_lib/types";
import type {
  LocalReadyFile,
  LocalConvertedFile,
  OutputFormat,
  PresetId,
} from "./_lib/ui-types";

type Props = {
  projectId: string;
  projectName: string;
  initialFiles: FileRow[];
};

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string;
  fromLabel: string;
  sizeLabel: string;
  selected: boolean;
  fingerprint: string; // helps dedupe
};

function fmtBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function extFromName(name: string) {
  const base = (name || "").split("?")[0].split("#")[0];
  const i = base.lastIndexOf(".");
  if (i === -1) return "";
  return base.slice(i + 1).toLowerCase();
}

function formatFromFilenameOrContentType(
  filename: string,
  contentType?: string | null
): OutputFormat | "IMG" {
  const ext = extFromName(filename);
  const ct = (contentType ?? "").toLowerCase();

  if (ext === "png" || ct.includes("png")) return "PNG";
  if (ext === "jpg" || ext === "jpeg" || ct.includes("jpeg") || ct.includes("jpg"))
    return "JPG";
  if (ext === "webp" || ct.includes("webp")) return "WebP";
  if (ext === "gif" || ct.includes("gif")) return "GIF";
  if (ext === "svg" || ct.includes("svg")) return "SVG";
  if (ext === "ico" || ct.includes("icon")) return "ICO";
  if (ext === "bmp" || ct.includes("bmp")) return "BMP";
  if (ext === "tif" || ext === "tiff" || ct.includes("tiff")) return "TIFF";
  return "IMG";
}

function normalizeStatus(s: string | null | undefined) {
  const v = (s ?? "").toLowerCase();
  if (v === "queued") return "queued";
  if (v === "processing") return "processing";
  if (v === "done" || v === "completed" || v === "complete") return "done";
  if (v === "failed" || v === "error") return "failed";
  return "unknown";
}

function fingerprintFile(f: File) {
  return `${f.name}::${f.size}::${f.lastModified}`;
}

function safeFilenameFromRow(row: FileRow) {
  const name = (row.filename ?? "").trim();
  return name || row.fileId || "file";
}

export default function ProjectDetailClient({
  projectId,
  initialFiles,
}: Props) {
  const [format, setFormat] = useState<OutputFormat>("JPG");
  const [quality, setQuality] = useState(55);
  const [preset, setPreset] = useState<PresetId>("web");

  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [files, setFiles] = useState<FileRow[]>(initialFiles);

  // Selection state for server-ready items (keyed by fileId)
  const [selectedReady, setSelectedReady] = useState<Record<string, boolean>>(
    {}
  );

  const [uploadBusy, setUploadBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track blob URLs for staged previews
  const stagedUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return () => {
      for (const url of stagedUrlsRef.current) URL.revokeObjectURL(url);
      stagedUrlsRef.current.clear();
    };
  }, []);

  // Signed GET URLs (fileId -> url)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inFlightSignedUrlRef = useRef<Set<string>>(new Set());

  const refreshFiles = useCallback(
    async (opts?: { validate?: boolean }) => {
      const qs = opts?.validate ? "?validate=1" : "";
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(projectId)}/files${qs}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { files?: FileRow[] };
      setFiles(data.files ?? []);
    },
    [projectId]
  );
  

  const onPickFiles = useCallback((list: FileList) => {
    const incoming = Array.from(list);
    setError(null);

    setStaged((prev) => {
      const existing = new Set(prev.map((p) => p.fingerprint));
      const next = [...prev];

      for (const file of incoming) {
        const fp = fingerprintFile(file);
        if (existing.has(fp)) continue;
        existing.add(fp);

        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);
        stagedUrlsRef.current.add(previewUrl);

        next.push({
          id,
          file,
          previewUrl,
          fromLabel: formatFromFilenameOrContentType(file.name, file.type),
          sizeLabel: fmtBytes(file.size),
          selected: true,
          fingerprint: fp,
        });
      }

      return next;
    });
  }, []);

  // Toggle staged selection (for Upload)
  const toggleOneStaged = useCallback((id: string) => {
    setStaged((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const toggleAllStaged = useCallback(() => {
    setStaged((prev) => {
      const allSelected = prev.length > 0 && prev.every((p) => p.selected);
      const nextSelected = !allSelected;
      return prev.map((p) => ({ ...p, selected: nextSelected }));
    });
  }, []);

  // Feed DropzoneCard's UI list
  const stagedItemsForDropzone = useMemo(
    () =>
      staged.map((s) => ({
        id: s.id,
        name: s.file.name,
        sizeLabel: s.sizeLabel,
        selected: s.selected,
      })),
    [staged]
  );

  const createUpload = useCallback(
    async (file: File) => {
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(projectId)}/uploads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`create upload failed: ${res.status} ${t}`);
      }

      const data = (await res.json()) as {
        upload?: {
          uploadId: string;
          putUrl: string;
          bucket: string;
          key: string;
          headers: Record<string, string>;
        };
      };

      if (!data.upload?.uploadId || !data.upload.putUrl) {
        throw new Error("create upload returned invalid payload");
      }

      return data.upload;
    },
    [projectId]
  );

  const completeUpload = useCallback(
    async (payload: {
      uploadId: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      bucket: string;
      key: string;
    }) => {
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(
          projectId
        )}/uploads/${encodeURIComponent(payload.uploadId)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            filename: payload.filename,
            contentType: payload.contentType,
            sizeBytes: payload.sizeBytes,
            bucket: payload.bucket,
            key: payload.key,
          }),
        }
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`complete upload failed: ${res.status} ${t}`);
      }
    },
    [projectId]
  );

  const onUploadClick = useCallback(async () => {
    if (uploadBusy) return;

    const targets = staged.filter((f) => f.selected);
    if (!targets.length) return;

    setError(null);
    setUploadBusy(true);

    try {
      for (const item of targets) {
        const file = item.file;

        const upload = await createUpload(file);

        const putRes = await fetch(upload.putUrl, {
          method: "PUT",
          headers: upload.headers,
          body: file,
        });

        if (!putRes.ok) throw new Error(`S3 PUT failed: ${putRes.status}`);

        await completeUpload({
          uploadId: upload.uploadId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          bucket: upload.bucket,
          key: upload.key,
        });
      }

      // Remove uploaded staged files + revoke previews
      setStaged((prev) => {
        const keep: StagedFile[] = [];
        for (const f of prev) {
          if (f.selected) {
            URL.revokeObjectURL(f.previewUrl);
            stagedUrlsRef.current.delete(f.previewUrl);
          } else {
            keep.push(f);
          }
        }
        return keep;
      });

      await refreshFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }, [uploadBusy, staged, createUpload, completeUpload, refreshFiles]);

  // ✅ Make delete fully functional: optimistic UI + refresh fallback
  const deleteFile = useCallback(
    async (fileId: string) => {
      // optimistic remove from UI immediately
      setFiles((prev) => prev.filter((f) => f.fileId !== fileId));

      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      setSelectedReady((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      inFlightSignedUrlRef.current.delete(fileId);

      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(
          projectId
        )}/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE", cache: "no-store" }
      );

      if (!res.ok) {
        // rollback by re-syncing from server
        await refreshFiles();
        const t = await res.text().catch(() => "");
        setError(`Delete failed: ${res.status}${t ? ` ${t}` : ""}`);
        return;
      }

      // also re-sync to avoid drift
      await refreshFiles();
    },
    [projectId, refreshFiles]
  );

  const getDownloadUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(
          projectId
        )}/files/${encodeURIComponent(fileId)}/download`,
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { url?: string };
      return typeof data.url === "string" ? data.url : null;
    },
    [projectId]
  );

  // Fetch signed URLs in small batches (deduped)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ids = files.map((f) => f.fileId).filter(Boolean);

      const need = ids.filter(
        (id) => !signedUrls[id] && !inFlightSignedUrlRef.current.has(id)
      );
      if (!need.length) return;

      const batch = need.slice(0, 10);
      for (const id of batch) inFlightSignedUrlRef.current.add(id);

      for (const id of batch) {
        const url = await getDownloadUrl(id);
        if (cancelled) return;

        if (url) setSignedUrls((prev) => ({ ...prev, [id]: url }));
        inFlightSignedUrlRef.current.delete(id);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [files, signedUrls, getDownloadUrl]);

  // Clean up selectedReady keys when file list changes
  useEffect(() => {
    const valid = new Set(files.map((f) => f.fileId));
    setSelectedReady((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (valid.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [files]);

  const serverReady = useMemo(() => {
    return files.filter((f) => normalizeStatus(f.status) !== "done");
  }, [files]);

  const readyView: LocalReadyFile[] = useMemo(() => {
    return serverReady.map((f) => {
      const filename = safeFilenameFromRow(f);
      const from = formatFromFilenameOrContentType(filename, f.contentType);

      // safe File-like object so ReadyQueue can read f.file.name
      const fakeFile = new File([], filename, {
        type: f.contentType || "application/octet-stream",
      });

      return {
        id: f.fileId,
        file: fakeFile,
        previewUrl: signedUrls[f.fileId] || "",
        fromLabel: from,
        toFormat: format,
        sizeLabel: fmtBytes(f.sizeBytes),
        selected: Boolean(selectedReady[f.fileId]),
      };
    });
  }, [serverReady, signedUrls, format, selectedReady]);

  const onToggleAllReady = useCallback(() => {
    const allSelected =
      readyView.length > 0 && readyView.every((r) => r.selected);
    const next = !allSelected;

    setSelectedReady((prev) => {
      const copy = { ...prev };
      for (const r of readyView) copy[r.id] = next;
      return copy;
    });
  }, [readyView]);

  const onToggleOneReady = useCallback((id: string) => {
    setSelectedReady((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onRemoveSelectedReady = useCallback(async () => {
    const ids = readyView.filter((r) => r.selected).map((r) => r.id);
    // sequential for predictable behavior
    for (const id of ids) await deleteFile(id);
  }, [readyView, deleteFile]);

  const anyReadySelected = readyView.some((r) => r.selected);

  const onConvert = useCallback(async () => {
    if (convertBusy) return;
    if (!anyReadySelected) return;

    setConvertBusy(true);
    setError(null);
    try {
      // placeholder for server-side conversion trigger
      console.warn("Convert not wired yet. Upload + queue works.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setConvertBusy(false);
    }
  }, [convertBusy, anyReadySelected]);

  // until conversion is wired
  const converted: LocalConvertedFile[] = useMemo(() => [], []);

  const uploadDisabled =
    uploadBusy || stagedItemsForDropzone.every((x) => !x.selected);

  return (
    <div className="mx-auto grid max-w-350 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <DropzoneCard
          pendingCount={staged.length}
          onPickFiles={onPickFiles}
          onUploadClick={onUploadClick}
          uploadDisabled={uploadDisabled}
          selectedItems={stagedItemsForDropzone}
          onToggleSelectedItem={toggleOneStaged}
          onToggleAllSelected={toggleAllStaged}
        />

        <ReadyQueue
          files={readyView}
          onToggleAll={onToggleAllReady}
          onToggleOne={onToggleOneReady}
          onRemoveSelected={onRemoveSelectedReady}
          onConvert={onConvert}
        />

        {/* If you want per-row delete buttons: wire your ReadyQueue to call deleteFile(id) */}
        {/* For now Remove Selected deletes fully (calls API). */}

        <ConvertedFiles files={converted} />
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

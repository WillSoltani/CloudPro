// app/app/projects/[projectId]/hooks/useServerFiles.ts
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FileRow } from "../../_lib/types";
import { deleteFile as apiDeleteFile, listFiles } from "../_lib/api-client";
import { normalizeStatus } from "../_lib/format";

const MAX_CONVERT_BATCH = 25;

type FileKind = "raw" | "output";

function readKind(f: FileRow): FileKind {
  return f.kind === "output" ? "output" : "raw";
}

function pruneSelection(prev: Record<string, boolean>, validIds: Set<string>) {
  let changed = false;
  const next: Record<string, boolean> = {};

  for (const [k, v] of Object.entries(prev)) {
    if (validIds.has(k)) next[k] = v;
    else changed = true;
  }

  return changed ? next : prev;
}

type ApplyUpdater = FileRow[] | ((prev: FileRow[]) => FileRow[]);

export function useServerFiles(args: {
  projectId: string;
  initialFiles: FileRow[];
  onError: (msg: string | null) => void;
}) {
  const { projectId, initialFiles, onError } = args;

  const [files, setFiles] = useState<FileRow[]>(initialFiles);
  const [selectedReady, setSelectedReady] = useState<Record<string, boolean>>({});

  // dropSignedUrl is injected later (after useSignedUrls exists)
  const dropSignedUrlRef = useRef<(fileId: string) => void>(() => {});
  const setDropSignedUrl = useCallback((fn: (fileId: string) => void) => {
    dropSignedUrlRef.current = fn;
  }, []);

  const applyFiles = useCallback((updater: ApplyUpdater) => {
    setFiles((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const valid = new Set(next.map((f) => f.fileId));
      setSelectedReady((selPrev) => pruneSelection(selPrev, valid));
      return next;
    });
  }, []);

  /**
   * Default validate=true so we reconcile missing S3 objects automatically.
   */
  const refreshFiles = useCallback(
    async (opts?: { validate?: boolean }) => {
      const validate = opts?.validate ?? true;
      const next = await listFiles(projectId, { validate });
      applyFiles(next);
    },
    [projectId, applyFiles]
  );

  // Ready = kind=raw and not done
  const rawReadyFiles = useMemo(
    () => files.filter((f) => readKind(f) === "raw" && normalizeStatus(f.status) !== "done"),
    [files]
  );

  // Converted section = kind=output (any status)
  const outputFiles = useMemo(
    () => files.filter((f) => readKind(f) === "output"),
    [files]
  );

  const selectedReadyIds = useMemo(() => {
    // Only raw-ready can be selected (even if selectedReady has other keys)
    const out: string[] = [];
    for (const f of rawReadyFiles) {
      if (selectedReady[f.fileId]) out.push(f.fileId);
    }
    return out;
  }, [rawReadyFiles, selectedReady]);

  const anyReadySelected = useMemo(() => selectedReadyIds.length > 0, [selectedReadyIds]);

  const onToggleAllReady = useCallback(() => {
    const currentlySelectedCount = selectedReadyIds.length;
    const allSelected = rawReadyFiles.length > 0 && currentlySelectedCount === rawReadyFiles.length;

    // If all selected already -> clear all (for raw-ready only)
    if (allSelected) {
      setSelectedReady((prev) => {
        const copy: Record<string, boolean> = { ...prev };
        for (const f of rawReadyFiles) delete copy[f.fileId];
        return copy;
      });
      return;
    }

    // Otherwise select up to MAX_CONVERT_BATCH
    const toSelect = rawReadyFiles.slice(0, MAX_CONVERT_BATCH);
    if (rawReadyFiles.length > MAX_CONVERT_BATCH) {
      onError(`You can convert up to ${MAX_CONVERT_BATCH} files at a time. Select fewer files.`);
    }

    setSelectedReady((prev) => {
      const copy: Record<string, boolean> = { ...prev };
      for (const f of toSelect) copy[f.fileId] = true;
      // ensure the rest of raw-ready are unselected to avoid confusion
      for (const f of rawReadyFiles.slice(MAX_CONVERT_BATCH)) delete copy[f.fileId];
      return copy;
    });
  }, [rawReadyFiles, selectedReadyIds, onError]);

  const onToggleOneReady = useCallback(
    (fileId: string) => {
      // Only allow toggling raw-ready items
      const isRawReady = rawReadyFiles.some((f) => f.fileId === fileId);
      if (!isRawReady) return;

      const isCurrentlySelected = Boolean(selectedReady[fileId]);

      // If selecting (from false -> true), enforce cap
      if (!isCurrentlySelected) {
        const count = selectedReadyIds.length;
        if (count >= MAX_CONVERT_BATCH) {
          onError(`You can convert up to ${MAX_CONVERT_BATCH} files at a time. Deselect one first.`);
          return;
        }
      }

      setSelectedReady((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
    },
    [rawReadyFiles, selectedReady, selectedReadyIds.length, onError]
  );

  const deleteOne = useCallback(
    async (fileId: string) => {
      // optimistic remove
      applyFiles((prev) => prev.filter((f) => f.fileId !== fileId));

      // drop cached signed url (if injected)
      dropSignedUrlRef.current(fileId);

      // also clear selection for that file
      setSelectedReady((prev) => {
        if (!prev[fileId]) return prev;
        const next = { ...prev };
        delete next[fileId];
        return next;
      });

      try {
        await apiDeleteFile(projectId, fileId);
      } catch (e: unknown) {
        await refreshFiles({ validate: true });
        const msg = e instanceof Error ? e.message : "Delete failed";
        onError(msg);
        return;
      }

      await refreshFiles({ validate: true });
    },
    [applyFiles, projectId, refreshFiles, onError]
  );

  const onRemoveSelectedReady = useCallback(async () => {
    // deterministic order for predictable UX
    for (const id of selectedReadyIds) {
      await deleteOne(id);
    }
  }, [selectedReadyIds, deleteOne]);

  return {
    files,
    refreshFiles,

    rawReadyFiles,
    outputFiles,

    selectedReady,
    selectedReadyIds,
    anyReadySelected,

    onToggleAllReady,
    onToggleOneReady,
    onRemoveSelectedReady,

    deleteOne,

    // inject dropSignedUrl once useSignedUrls is ready
    setDropSignedUrl,
  };
}
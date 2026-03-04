// app/app/projects/[projectId]/hooks/useStagedFiles.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StagedFile, SelectedItem } from "../_lib/local-types";
import { fingerprintFile, fmtBytes, formatFromFilenameOrContentType } from "../_lib/format";

export function useStagedFiles() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const stagedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      for (const url of stagedUrlsRef.current) URL.revokeObjectURL(url);
      stagedUrlsRef.current.clear();
    };
  }, []);

  const onPickFiles = useCallback((list: FileList) => {
    const incoming = Array.from(list);

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

  const toggleOneStaged = useCallback((id: string) => {
    setStaged((prev) => prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)));
  }, []);

  const toggleAllStaged = useCallback(() => {
    setStaged((prev) => {
      const allSelected = prev.length > 0 && prev.every((p) => p.selected);
      const nextSelected = !allSelected;
      return prev.map((p) => ({ ...p, selected: nextSelected }));
    });
  }, []);

  const selectedItems: SelectedItem[] = useMemo(
    () =>
      staged.map((s) => ({
        id: s.id,
        name: s.file.name,
        sizeLabel: s.sizeLabel,
        selected: s.selected,
      })),
    [staged]
  );

  const uploadDisabled = useMemo(() => staged.length === 0 || staged.every((x) => !x.selected), [staged]);

  const consumeSelected = useCallback(() => {
    // remove selected staged items and revoke their object URLs
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
  }, []);

  const selectedFiles = useMemo(() => staged.filter((s) => s.selected), [staged]);

  return {
    staged,
    selectedItems,
    uploadDisabled,
    selectedFiles,
    onPickFiles,
    toggleOneStaged,
    toggleAllStaged,
    consumeSelected,
  };
}
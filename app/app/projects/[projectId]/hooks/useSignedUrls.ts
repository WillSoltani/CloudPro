// app/app/projects/[projectId]/hooks/useSignedUrls.ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { FileRow } from "../../_lib/types";
import { getInlineUrl } from "../_lib/api-client";
import { isLikelyImage } from "../../_lib/ui";

export function useSignedUrls(projectId: string, files: FileRow[]) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ids = files
        .filter((f) => isLikelyImage(f.filename, f.contentType))
        .map((f) => f.fileId)
        .filter((x): x is string => Boolean(x));

      const need = ids.filter((id) => !signedUrls[id] && !inFlightRef.current.has(id));
      if (!need.length) return;

      const batch = need.slice(0, 10);
      for (const id of batch) inFlightRef.current.add(id);

      for (const id of batch) {
        const url = await getInlineUrl(projectId, id);
        inFlightRef.current.delete(id);
        if (cancelled) return;

        if (url) {
          setSignedUrls((prev) => ({ ...prev, [id]: url }));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, files, signedUrls]);

  function dropSignedUrl(fileId: string) {
    setSignedUrls((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    inFlightRef.current.delete(fileId);
  }

  return { signedUrls, dropSignedUrl };
}

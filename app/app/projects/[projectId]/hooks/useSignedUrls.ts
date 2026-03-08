"use client";

import { useEffect, useRef, useState } from "react";
import type { FileRow } from "../../_lib/types";
import { getInlineUrl } from "../_lib/api-client";
import {
  isPresignedUrlExpired,
  previewLifecycleBlockedReason,
  supportsBrowserImagePreview,
} from "../_lib/preview";

export function useSignedUrls(projectId: string, files: FileRow[]) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ids = files
        .filter((f) => supportsBrowserImagePreview({
          filename: f.filename,
          contentType: f.contentType,
        }))
        .filter((f) => !previewLifecycleBlockedReason({ status: f.status }))
        .map((f) => f.fileId)
        .filter((x): x is string => Boolean(x));

      const need = ids.filter((id) => {
        if (inFlightRef.current.has(id)) return false;
        const current = signedUrls[id];
        if (!current) return true;
        return isPresignedUrlExpired(current);
      });
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

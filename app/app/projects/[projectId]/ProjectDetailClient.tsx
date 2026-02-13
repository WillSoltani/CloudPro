"use client";

import { useMemo, useRef, useState } from "react";
import type { FileRow } from "./_lib/types";
import { fetchFiles, uploadViaPresign } from "./_lib/api";
import { UploadCard } from "./components/UploadCard";
import { HistoryList } from "./components/HistoryList";

type Props = {
  projectId: string;
  projectName: string;
  files: FileRow[];
};

export default function ProjectDetailClient({ projectId, projectName, files }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<FileRow[]>(files);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  // upload UI state
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return arr;
  }, [rows]);

  function onBrowse() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    setPicked(f);
    setUploadErr(null);
  }

  async function refreshList() {
    const fresh = await fetchFiles(projectId);
    setRows(fresh);
  }

  async function uploadAndConvert() {
    if (!picked || uploading) return;

    setUploading(true);
    setUploadErr(null);

    try {
      const { createdFile } = await uploadViaPresign({ projectId, file: picked });

      setPicked(null);

      if (createdFile) {
        setRows((prev) => [createdFile, ...prev]);
      } else {
        await refreshList();
      }
    } catch (e) {
      console.error(e);
      setUploadErr(e instanceof Error ? e.message.replace(/^Error:\s*/, "") : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(fileId: string) {
    try {
      setBusyFileId(fileId);
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(
          fileId
        )}/download`,
        { method: "GET", cache: "no-store" }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Download failed: ${res.status}`);
      }

      const data = (await res.json()) as { url?: unknown };
      const url = typeof data.url === "string" ? data.url : "";
      if (!url) throw new Error("Missing presigned url");

      window.location.href = url;
    } catch (e) {
      console.error(e);
      window.alert("Download failed. Check console.");
    } finally {
      setBusyFileId(null);
    }
  }

  function onModify(_fileId: string) {
    window.alert("Modify will be wired after backend is ready.");
  }

  async function onDelete(fileId: string) {
    const ok = window.confirm("Delete this conversion? This cannot be undone.");
    if (!ok) return;

    try {
      setBusyFileId(fileId);
      const res = await fetch(
        `/app/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Delete failed: ${res.status}`);
      }

      setRows((prev) => prev.filter((r) => r.fileId !== fileId));
    } catch (e) {
      console.error(e);
      window.alert("Delete failed. Check console.");
    } finally {
      setBusyFileId(null);
    }
  }

  return (
    <div className="space-y-8">
      <UploadCard
        dragOver={dragOver}
        setDragOver={setDragOver}
        picked={picked}
        setPicked={(f) => {
          setPicked(f);
          setUploadErr(null);
        }}
        uploading={uploading}
        uploadErr={uploadErr}
        onBrowse={onBrowse}
        onDrop={onDrop}
        onUpload={() => void uploadAndConvert()}
        inputRef={inputRef}
      />

      <HistoryList
        projectId={projectId}
        projectName={projectName}
        rows={sorted}
        busyFileId={busyFileId}
        onDownload={(id) => void onDownload(id)}
        onModify={onModify}
        onDelete={(id) => void onDelete(id)}
      />
    </div>
  );
}

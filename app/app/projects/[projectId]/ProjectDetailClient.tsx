"use client";

import { useMemo, useRef, useState } from "react";
import type { FileRow } from "../_lib/types";
import type { OutputFormat, PendingItem } from "../_lib/ui-types";

import { DropzoneCard } from "./components/DropzoneCard";
import { ReadyQueue } from "./components/ReadyQueue";
import { ConversionSettings } from "./components/ConversionSettings";
import { ConvertedFiles } from "./components/ConvertedFiles";

type Props = {
  projectId: string;
  projectName: string;
  files: FileRow[];
};

function uid() {
  // Best option
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function ProjectDetailClient({ projectName, files }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Left UI state
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<PendingItem[]>([]);

  // Right settings state (UI-only)
  const [output, setOutput] = useState<OutputFormat>("JPG");
  const [quality, setQuality] = useState<number>(55);
  const [preset, setPreset] = useState<"web" | "hq" | "email">("web");

  const sortedConverted = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return arr;
  }, [files]);

  function onBrowse() {
    inputRef.current?.click();
  }

  function addFile(f: File) {
    setQueue((prev) => [{ id: uid(), file: f, selected: true }, ...prev]);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);

    const list = e.dataTransfer.files;
    if (!list || list.length === 0) return;

    const next: PendingItem[] = Array.from(list).map((f) => ({
      id: uid(),
      file: f,
      selected: true,
    }));

    setQueue((prev) => [...next, ...prev]);
  }

  const selectedCount = useMemo(
    () => queue.reduce((acc, x) => acc + (x.selected ? 1 : 0), 0),
    [queue]
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr,420px]">
        {/* LEFT */}
        <div className="space-y-6">
          <DropzoneCard
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={onDrop}
            onBrowse={onBrowse}
            inputRef={inputRef}
            onPick={(f) => {
              if (f) addFile(f);
            }}
          />

          <ReadyQueue
            items={queue}
            output={output}
            onToggleAll={(v) =>
              setQueue((prev) => prev.map((x) => ({ ...x, selected: v })))
            }
            onToggleOne={(id) =>
              setQueue((prev) =>
                prev.map((x) =>
                  x.id === id ? { ...x, selected: !x.selected } : x
                )
              )
            }
            onRemoveSelected={() =>
              setQueue((prev) => prev.filter((x) => !x.selected))
            }
            onConvertSelected={() => {
              alert(
                `UI only: would convert ${selectedCount} file(s) to ${output} @ ${quality}%`
              );
            }}
          />

          <ConvertedFiles
            files={sortedConverted}
            onDownloadAll={() => alert("UI only: Download All")}
          />
        </div>

        {/* RIGHT */}
        <div className="h-fit lg:sticky lg:top-28">
          <ConversionSettings
            output={output}
            setOutput={setOutput}
            quality={quality}
            setQuality={setQuality}
            preset={preset}
            setPreset={setPreset}
          />
        </div>
      </div>
    </div>
  );
}

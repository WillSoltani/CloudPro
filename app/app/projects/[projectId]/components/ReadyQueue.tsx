// app/app/projects/[projectId]/components/ReadyQueue.tsx
"use client";

import { Trash2, Play, Check } from "lucide-react";
import type { LocalReadyFile, OutputFormat } from "../_lib/ui-types";
import { VALID_OUTPUT_FORMATS, IMAGE_OUTPUT_FORMATS } from "../_lib/ui-types";
import { Thumb } from "./Thumb";

type Props = {
  files: LocalReadyFile[];
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onRemoveSelected: () => void;
  onConvert: () => void;
  onSetItemFormat: (fileId: string, format: OutputFormat) => void;
  convertBusy: boolean;
};

export function ReadyQueue({
  files, onToggleAll, onToggleOne, onRemoveSelected, onConvert, onSetItemFormat, convertBusy,
}: Props) {
  const total = files.length;
  const selected = files.reduce((acc, f) => acc + (f.selected ? 1 : 0), 0);
  const allSelected = total > 0 && selected === total;
  const removeDisabled = selected === 0;
  const convertDisabled = selected === 0 || convertBusy;

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/3 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/2 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleAll}
            className={[
              "grid h-5 w-5 place-items-center rounded-md border transition",
              allSelected
                ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                : "border-white/15 bg-white/5 text-transparent hover:bg-white/10",
            ].join(" ")}
            aria-label="Select all"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <div className="text-base font-semibold text-slate-100">
            Ready to Convert{" "}
            <span className="ml-2 text-sm font-normal text-slate-400">({total} files)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRemoveSelected}
            disabled={removeDisabled}
            className={[
              "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition",
              removeDisabled ? "cursor-not-allowed text-slate-500" : "text-rose-200 hover:bg-rose-500/10",
            ].join(" ")}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
          <button
            type="button"
            onClick={onConvert}
            disabled={convertDisabled}
            className={[
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
              convertDisabled
                ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                : "bg-sky-600/90 text-white shadow-[0_10px_30px_rgba(2,132,199,0.25)] hover:bg-sky-500",
            ].join(" ")}
          >
            <Play className="h-4 w-4" />
            {convertBusy ? "Converting…" : `Convert (${selected})`}
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">
          No files uploaded yet. Click <span className="text-slate-200">Browse Files</span>.
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {files.map((f) => {
            const name = f.file?.name || f.id;
            // Only show formats valid for this file's source type (never render disabled chips)
            const validFormats: OutputFormat[] =
              VALID_OUTPUT_FORMATS[f.fromLabel] ?? IMAGE_OUTPUT_FORMATS;

            return (
              <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleOne(f.id)}
                  className={[
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                    f.selected
                      ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                      : "border-white/15 bg-white/5 text-transparent hover:bg-white/10",
                  ].join(" ")}
                  aria-label={`Select ${name}`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>

                {/* Thumbnail */}
                <Thumb src={f.previewUrl} alt={name} fallbackLabel={f.fromLabel} />

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{name || "Untitled"}</div>
                  <div className="text-xs text-slate-400">{f.sizeLabel}</div>
                </div>

                {/* Per-item format selector — only valid formats for this input type */}
                {f.selected ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{f.fromLabel}</Badge>
                    <span className="text-slate-600 text-xs">→</span>
                    {validFormats.map((fmt: OutputFormat) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => onSetItemFormat(f.id, fmt)}
                        className={[
                          "rounded-full border px-2 py-0.5 text-xs font-semibold transition",
                          f.toFormat === fmt
                            ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
                        ].join(" ")}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge>{f.fromLabel}</Badge>
                    <span className="text-xs text-slate-600">select to configure</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge(props: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">
      {props.children}
    </span>
  );
}

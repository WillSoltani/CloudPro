"use client";

import { useMemo, useRef } from "react";
import { Upload, ArrowUpFromLine, Check } from "lucide-react";

type SelectedItem = {
  id: string;
  name: string;
  sizeLabel: string;
  selected: boolean;
};

export function DropzoneCard(props: {
  pendingCount: number;
  onPickFiles: (files: FileList) => void;
  onUploadClick: () => void;
  uploadDisabled?: boolean;

  // ✅ small tweak: show what's staged + selectable
  selectedItems: SelectedItem[];
  onToggleSelectedItem: (id: string) => void;
  onToggleAllSelected: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedCount = useMemo(
    () => props.selectedItems.filter((x) => x.selected).length,
    [props.selectedItems]
  );

  const allSelected =
    props.selectedItems.length > 0 && selectedCount === props.selectedItems.length;

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/3 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="rounded-[28px] border border-dashed border-white/15 bg-white/2 p-10">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <Upload className="h-7 w-7 text-sky-200" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-slate-100">
            Drop files to convert
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            PNG, JPG, SVG, WebP, GIF, ICO, BMP, TIFF
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,.svg"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.currentTarget.files;
              if (files && files.length) props.onPickFiles(files);
              e.currentTarget.value = "";
            }}
          />

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 hover:bg-white/10"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg border border-white/10 bg-white/5">
                <Upload className="h-4 w-4 text-slate-200" />
              </span>
              Browse Files
            </button>

            <button
              type="button"
              onClick={props.onUploadClick}
              disabled={props.uploadDisabled}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition",
                props.uploadDisabled
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500"
                  : "bg-sky-600/90 text-white shadow-[0_10px_30px_rgba(2,132,199,0.25)] hover:bg-sky-500",
              ].join(" ")}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Upload{selectedCount ? ` (${selectedCount})` : ""}
            </button>
          </div>

          {/* ✅ NEW: small staged indicator */}
          {props.selectedItems.length > 0 ? (
            <div className="mt-5 w-full">
              <div className="flex items-center justify-between gap-3 text-left">
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {selectedCount}
                  </span>{" "}
                  selected for upload
                  <span className="text-slate-600"> • </span>
                  click to include/exclude
                </div>

                <button
                  type="button"
                  onClick={props.onToggleAllSelected}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                >
                  <span
                    className={[
                      "grid h-4 w-4 place-items-center rounded border transition",
                      allSelected
                        ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                        : "border-white/15 bg-white/5 text-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {allSelected ? "Unselect all" : "Select all"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {props.selectedItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => props.onToggleSelectedItem(it.id)}
                    className={[
                      "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                      it.selected
                        ? "border-sky-400/20 bg-sky-500/15 text-sky-200 hover:bg-sky-500/20"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                    ].join(" ")}
                    title={it.name}
                  >
                    <span
                      className={[
                        "grid h-4 w-4 place-items-center rounded border transition",
                        it.selected
                          ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                          : "border-white/15 bg-white/5 text-transparent group-hover:text-slate-400",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" />
                    </span>

                    <span className="max-w-[220px] truncate font-semibold">
                      {it.name}
                    </span>
                    <span className="text-slate-500">{it.sizeLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-slate-500">
            Browse selects files. Upload will send selected files.
          </p>
        </div>
      </div>
    </div>
  );
}

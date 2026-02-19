"use client";

import { Download, List, Grid2X2, Check, Bolt } from "lucide-react";
import { useState } from "react";
import type { LocalConvertedFile } from "../_lib/ui-types";
import { Thumb } from "./Thumb";

export function ConvertedFiles(props: { files: LocalConvertedFile[] }) {
  const [view, setView] = useState<"list" | "grid">("list");
  const total = props.files.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold text-slate-100">Converted Files</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Download All
          </button>

          <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={["px-3 py-2 text-slate-200 transition hover:bg-white/10", view === "list" ? "bg-white/10" : ""].join(" ")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={["px-3 py-2 text-slate-200 transition hover:bg-white/10", view === "grid" ? "bg-white/10" : ""].join(" ")}
              aria-label="Grid view"
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/3 px-5 py-8 text-sm text-slate-400">
          No converted files yet.
        </div>
      ) : (
        <div className="space-y-3">
          {props.files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-white/3 px-5 py-4 shadow-[0_14px_60px_rgba(0,0,0,0.35)]"
            >
              <Thumb src={f.previewUrl} alt={f.name} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-100">{f.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {f.fromSizeLabel ? <span>{f.fromSizeLabel}</span> : null}
                  {f.toSizeLabel ? (
                    <>
                      <span>→</span>
                      <span>{f.toSizeLabel}</span>
                    </>
                  ) : null}
                  {f.whenLabel ? (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>{f.whenLabel}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <Badge>{f.fromLabel}</Badge>
                <span className="text-slate-600">→</span>
                <Badge tone="active">{f.toLabel}</Badge>

                {f.status === "done" ? (
                  <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3" />
                    </span>
                    Done
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-500/15">
                      <Bolt className="h-3 w-3" />
                    </span>
                    {f.progress ?? 0}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge(props: { children: React.ReactNode; tone?: "active" }) {
  const cls =
    props.tone === "active"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/20"
      : "bg-white/5 text-slate-200 border-white/10";

  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", cls].join(" ")}>
      {props.children}
    </span>
  );
}

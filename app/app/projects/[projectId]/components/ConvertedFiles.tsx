"use client";

import { motion } from "framer-motion";
import { DownloadCloud, CheckCircle2, Loader2 } from "lucide-react";
import type { FileRow } from "../../_lib/types";
import { fmtBytes, normalizeStatus } from "../../_lib/ui";
import { ClientDate } from "./ClientDate";

function extFromName(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toUpperCase() : "FILE";
}

export function ConvertedFiles(props: {
  files: FileRow[];
  onDownloadAll?: () => void; // UI-only for now
}) {
  const visible = props.files.slice(0, 12);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Converted Files</h3>
          <p className="mt-1 text-sm text-slate-400">Recent conversions in this project</p>
        </div>

        <button
          type="button"
          onClick={props.onDownloadAll}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 transition"
        >
          <DownloadCloud className="h-4 w-4 text-slate-300" />
          Download All
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          No converted files yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((f) => {
            const st = normalizeStatus(f.status);
            const from = extFromName(f.filename);
            const to = "WEBP"; // UI mock until backend returns actual output

            return (
              <motion.div
                key={f.fileId}
                whileHover={{ scale: 1.012 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="group relative"
              >
                {/* hover glow */}
                <div
                  className="pointer-events-none absolute -inset-0.5 rounded-[22px] opacity-0 blur-xl transition group-hover:opacity-100
                  bg-[radial-gradient(900px_circle_at_20%_0%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(800px_circle_at_80%_110%,rgba(168,85,247,0.14),transparent_55%)]"
                />

                <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition group-hover:border-white/15 group-hover:bg-white/7">
                  <div className="flex items-center justify-between gap-4">
                    {/* left */}
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {f.filename}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {fmtBytes(f.sizeBytes)} •{" "}
                          <ClientDate iso={f.updatedAt || f.createdAt} />
                        </p>
                      </div>
                    </div>

                    {/* right */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Pill cls="bg-sky-600/80 text-white" label={from} />
                      <span className="text-slate-500">→</span>
                      <Pill cls="bg-emerald-600/80 text-white" label={to} />

                      <span className="ml-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                        {st === "processing" || st === "queued" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                            Processing
                          </>
                        ) : st === "failed" ? (
                          <>Failed</>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                            Done
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Pill(props: { label: string; cls: string }) {
  return (
    <span className={["rounded-lg px-2.5 py-1 text-xs font-semibold", props.cls].join(" ")}>
      {props.label}
    </span>
  );
}

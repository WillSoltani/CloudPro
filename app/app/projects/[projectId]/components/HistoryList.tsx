"use client";

import { motion } from "framer-motion";
import { Download, FileText, Image as ImageIcon, Trash2, Wand2 } from "lucide-react";
import type { FileRow } from "../_lib/types";
import { fmtBytes, isLikelyImage, normalizeStatus } from "../_lib/utils";
import { ClientDate } from "./ClientDate";
import { StatusPill } from "./StatusPill";
import { IconButton } from "./IconButton";

export function HistoryList(props: {
  projectId: string;
  projectName: string;
  rows: FileRow[];
  busyFileId: string | null;
  onDownload: (fileId: string) => void;
  onModify: (fileId: string) => void;
  onDelete: (fileId: string) => void;
}) {
  const { projectName, rows, busyFileId, onDownload, onModify, onDelete } = props;

  if (rows.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Conversion history</h2>
            <p className="mt-1 text-sm text-slate-300">
              Recent files in this project:{" "}
              <span className="text-slate-200 font-semibold">{projectName}</span>
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            0
          </span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">No conversions yet.</p>
          <p className="mt-2 text-xs text-slate-400">Upload something to populate this list.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Conversion history</h2>
          <p className="mt-1 text-sm text-slate-300">
            Recent files in this project:{" "}
            <span className="text-slate-200 font-semibold">{projectName}</span>
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
          {rows.length}
        </span>
      </div>

      <div className="grid gap-3">
        {rows.slice(0, 12).map((f) => {
          const Icon = isLikelyImage(f.filename, f.contentType) ? ImageIcon : FileText;
          const st = normalizeStatus(f.status);
          const busy = busyFileId === f.fileId;

          return (
            <motion.div
              key={f.fileId}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="group relative"
            >
              <div
                className="pointer-events-none absolute -inset-0.5 rounded-[26px] opacity-0 blur-xl transition group-hover:opacity-100
                bg-[radial-gradient(900px_circle_at_20%_0%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(800px_circle_at_80%_100%,rgba(168,85,247,0.14),transparent_50%)]"
              />

              <div className="relative rounded-[26px] border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition group-hover:border-white/15 group-hover:bg-white/7">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{f.filename}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {f.contentType || "application/octet-stream"} • {fmtBytes(f.sizeBytes)} •{" "}
                        <span className="text-slate-300">
                          <ClientDate iso={f.updatedAt || f.createdAt} />
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <StatusPill status={st} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                  <IconButton
                    label={busy ? "Working…" : "Download"}
                    onClick={() => onDownload(f.fileId)}
                    icon={<Download className="h-4 w-4" />}
                    disabled={busy}
                  />
                  <IconButton
                    label="Modify"
                    onClick={() => onModify(f.fileId)}
                    icon={<Wand2 className="h-4 w-4" />}
                    disabled={busy}
                  />
                  <IconButton
                    label="Delete"
                    onClick={() => onDelete(f.fileId)}
                    icon={<Trash2 className="h-4 w-4" />}
                    danger
                    disabled={busy}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

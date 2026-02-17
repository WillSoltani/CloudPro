"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Play } from "lucide-react";
import type { OutputFormat, PendingItem } from "../../_lib/ui-types";
import { SoftButton } from "../../../../../components/Pills";
import { Thumb } from "./Thumb";

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toUpperCase() : "";
}

export function ReadyQueue(props: {
  items: PendingItem[];
  output: OutputFormat;
  onToggleAll: (v: boolean) => void;
  onToggleOne: (id: string) => void;
  onRemoveSelected: () => void;
  onConvertSelected: () => void; // UI only for now
}) {
  const selectedCount = props.items.filter((x) => x.selected).length;
  const allSelected = props.items.length > 0 && selectedCount === props.items.length;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_14px_45px_rgba(0,0,0,0.40)] backdrop-blur">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => props.onToggleAll(e.target.checked)}
              className="h-5 w-5 rounded border-white/20 bg-white/5"
            />
            <p className="text-base font-semibold text-slate-100">
              Ready to Convert{" "}
              <span className="ml-2 text-sm font-medium text-slate-400">
                ({props.items.length} files)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={props.onRemoveSelected}
              className="inline-flex items-center gap-2 text-sm font-semibold text-rose-300 hover:text-rose-200 transition"
              disabled={selectedCount === 0}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>

            <SoftButton
              primary
              label={`Convert (${selectedCount || 0})`}
              icon={<Play className="h-4 w-4" />}
              onClick={props.onConvertSelected}
              disabled={selectedCount === 0}
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        <AnimatePresence initial={false}>
          {props.items.map((it) => (
            <motion.div
              key={it.id}
              layout
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="group flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-4">
                <input
                  type="checkbox"
                  checked={it.selected}
                  onChange={() => props.onToggleOne(it.id)}
                  className="h-5 w-5 rounded border-white/20 bg-white/5"
                />

                <Thumb file={it.file} />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {it.file.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {fmtBytes(it.file.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-600/80 px-2.5 py-1 text-xs font-semibold text-white">
                  {ext(it.file.name) || "FILE"}
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded-lg bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-white">
                  {props.output}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {props.items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            Add files above to build a conversion queue.
          </div>
        ) : null}
      </div>
    </section>
  );
}

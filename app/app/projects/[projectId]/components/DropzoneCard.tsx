"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

export type DropzoneCardProps = {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onBrowse: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | null) => void;
};

export function DropzoneCard({
  dragOver,
  setDragOver,
  onDrop,
  onBrowse,
  inputRef,
  onPick,
}: DropzoneCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(900px_circle_at_30%_0%,rgba(56,189,248,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-55 bg-[radial-gradient(900px_circle_at_90%_110%,rgba(168,85,247,0.13),transparent_55%)]" />

      <div
        className={[
          "relative rounded-[22px] border border-dashed p-10 text-center transition",
          dragOver
            ? "border-sky-300/55 bg-sky-500/10 shadow-[0_0_0_6px_rgba(56,189,248,0.10)]"
            : "border-white/15 bg-white/5 hover:border-white/25",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <Upload className="h-6 w-6 text-sky-200" />
        </div>

        <p className="mt-5 text-lg font-semibold text-slate-100">
          Drop files to convert
        </p>
        <p className="mt-2 text-sm text-slate-400">
          PNG, JPG, SVG, WebP, GIF, ICO, BMP, TIFF
        </p>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onBrowse}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10 transition"
          >
            Browse Files
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            const first = e.target.files?.[0] ?? null;
            onPick(first);
          }}
        />
      </div>
    </motion.section>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Upload } from "lucide-react";
import { fmtBytes } from "../_lib/utils";

export function UploadCard(props: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  picked: File | null;
  setPicked: (f: File | null) => void;
  uploading: boolean;
  uploadErr: string | null;
  onBrowse: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onUpload: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const {
    dragOver,
    setDragOver,
    picked,
    setPicked,
    uploading,
    uploadErr,
    onBrowse,
    onDrop,
    onUpload,
    inputRef,
  } = props;

  return (
    <motion.section
      className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(900px_circle_at_30%_0%,rgba(56,189,248,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(900px_circle_at_90%_100%,rgba(168,85,247,0.14),transparent_55%)]" />

      <div
        className={[
          "relative rounded-[26px] border border-dashed p-7 transition",
          dragOver
            ? "border-sky-300/50 bg-sky-500/10 shadow-[0_0_0_6px_rgba(56,189,248,0.10)]"
            : "border-white/15 bg-white/5 hover:border-white/25",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <Upload className="h-6 w-6 text-sky-200" />
          </div>

          <p className="mt-4 text-base font-semibold text-slate-100">
            Drag and drop to upload
          </p>
          <p className="mt-1 text-sm text-slate-300">Or browse from your device.</p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15 transition shadow-[0_18px_45px_rgba(56,189,248,0.14)]"
              disabled={uploading}
            >
              Choose file
            </button>
            <span className="text-xs text-slate-400">PDF, PNG, JPG, DOCX, TXT</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
          />

          <AnimatePresence>
            {picked ? (
              <motion.div
                className="mt-6 w-full rounded-2xl border border-white/10 bg-[#070b16]/40 p-4 text-left"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {picked.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {picked.type || "application/octet-stream"} • {fmtBytes(picked.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition"
                    disabled={uploading}
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-2xl bg-sky-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition shadow-[0_12px_35px_rgba(2,132,199,0.25)] inline-flex items-center gap-2"
                    onClick={onUpload}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      "Upload & convert"
                    )}
                  </button>
                </div>

                {uploadErr ? <p className="mt-3 text-xs text-rose-200">{uploadErr}</p> : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}

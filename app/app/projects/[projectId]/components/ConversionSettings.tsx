"use client";

import { useMemo } from "react";
import { SlidersHorizontal, Bolt, Sparkles, Mail, Info } from "lucide-react";
import type { OutputFormat, PresetId } from "../_lib/ui-types";

const FORMATS: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "SVG", "ICO", "BMP", "TIFF"];

export function ConversionSettings(props: {
  format: OutputFormat;
  onFormat: (f: OutputFormat) => void;
  quality: number;
  onQuality: (q: number) => void;
  preset: PresetId;
  onPreset: (p: PresetId) => void;
}) {
  const presets = useMemo(
    () => [
      { id: "web" as const, icon: <Bolt className="h-4 w-4 text-sky-200" />, title: "Web Optimized", sub: "WebP • 80%" },
      { id: "hq" as const, icon: <Sparkles className="h-4 w-4 text-sky-200" />, title: "High Quality", sub: "PNG • 100%" },
      { id: "email" as const, icon: <Mail className="h-4 w-4 text-sky-200" />, title: "Email Friendly", sub: "JPG • 70%" },
    ],
    []
  );

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/3 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <SlidersHorizontal className="h-5 w-5 text-sky-200" />
        </div>
        <div className="text-lg font-semibold text-slate-100">Conversion Settings</div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-200">Output Format</div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {FORMATS.map((opt) => {
            const active = opt === props.format;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => props.onFormat(opt)}
                className={[
                  "rounded-2xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-sky-600/90 text-white shadow-[0_12px_30px_rgba(2,132,199,0.22)]"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">Quality</div>
          <div className="text-sm font-semibold text-slate-100">{props.quality}%</div>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={100}
            value={props.quality}
            onChange={(e) => props.onQuality(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-slate-200">Quick Presets</div>
        <div className="mt-3 space-y-3">
          {presets.map((p) => {
            const active = props.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => props.onPreset(p.id)}
                className={[
                  "group w-full rounded-3xl border px-4 py-4 text-left transition",
                  "hover:shadow-[0_18px_55px_rgba(56,189,248,0.14)] hover:bg-white/6",
                  active
                    ? "border-sky-400/25 bg-white/6 ring-1 ring-sky-400/25"
                    : "border-white/10 bg-white/3",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "grid h-10 w-10 place-items-center rounded-2xl border bg-white/5 transition",
                      active ? "border-sky-400/25" : "border-white/10",
                      "group-hover:scale-[1.03]",
                    ].join(" ")}
                  >
                    {p.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.sub}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="
          mt-4
          rounded-xl
          border border-sky-400/20
          bg-sky-400/5
          px-4 py-3
          text-sm
          text-sky-200/90
          backdrop-blur-sm

          shadow-[0_0_0_1px_rgba(56,189,248,0.06)]
        "
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-sky-300">ⓘ</div>

          <div className="leading-relaxed">
            WebP offers excellent compression while maintaining visual quality. Ideal for websites and performance-sensitive delivery.
          </div>
        </div>
      </div>

    </div>
  );
}

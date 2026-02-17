"use client";

import { motion } from "framer-motion";
import { SlidersHorizontal, Zap, Sparkles, Mail } from "lucide-react";
import type { OutputFormat } from "../../_lib/ui-types";
import { FormatPill } from "../../../../../components/Pills";

const formats: OutputFormat[] = ["PNG", "JPG", "WebP", "GIF", "SVG", "ICO", "BMP", "TIFF"];

export function ConversionSettings(props: {
  output: OutputFormat;
  setOutput: (f: OutputFormat) => void;
  quality: number;
  setQuality: (n: number) => void;
  preset: "web" | "hq" | "email";
  setPreset: (p: "web" | "hq" | "email") => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div className="pointer-events-none absolute inset-0 opacity-65 bg-[radial-gradient(900px_circle_at_60%_0%,rgba(56,189,248,0.12),transparent_55%)]" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <SlidersHorizontal className="h-5 w-5 text-sky-200" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Conversion Settings</h3>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-200">Output Format</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {formats.map((f) => (
              <FormatPill
                key={f}
                label={f}
                active={props.output === f}
                onClick={() => props.setOutput(f)}
              />
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">Quality</p>
            <p className="text-sm font-semibold text-slate-100">{props.quality}%</p>
          </div>

          <div className="mt-3">
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={props.quality}
              onChange={(e) => props.setQuality(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-semibold text-slate-200">Quick Presets</p>

          <div className="mt-3 space-y-3">
            <PresetCard
              active={props.preset === "web"}
              title="Web Optimized"
              subtitle="WebP • 80%"
              icon={<Zap className="h-5 w-5 text-sky-200" />}
              onClick={() => {
                props.setPreset("web");
                props.setOutput("WebP");
                props.setQuality(80);
              }}
            />
            <PresetCard
              active={props.preset === "hq"}
              title="High Quality"
              subtitle="PNG • 100%"
              icon={<Sparkles className="h-5 w-5 text-sky-200" />}
              onClick={() => {
                props.setPreset("hq");
                props.setOutput("PNG");
                props.setQuality(100);
              }}
            />
            <PresetCard
              active={props.preset === "email"}
              title="Email Friendly"
              subtitle="JPG • 70%"
              icon={<Mail className="h-5 w-5 text-sky-200" />}
              onClick={() => {
                props.setPreset("email");
                props.setOutput("JPG");
                props.setQuality(70);
              }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <span className="text-slate-100 font-semibold">WebP</span> offers excellent compression while
          maintaining quality. Ideal for web use.
        </div>
      </div>
    </motion.aside>
  );
}

function PresetCard(props: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "w-full rounded-2xl border border-white/10 p-4 text-left transition",
        props.active ? "bg-white/10" : "bg-white/5 hover:bg-white/8",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
          {props.icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">{props.title}</p>
          <p className="text-xs text-slate-400">{props.subtitle}</p>
        </div>
      </div>
    </button>
  );
}

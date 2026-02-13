"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { UiStatus } from "../_lib/types";

export function StatusPill({ status }: { status: UiStatus }) {
  const cfg =
    status === "done"
      ? {
          label: "Complete",
          Icon: CheckCircle2,
          cls: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
          glow: "shadow-[0_0_18px_rgba(16,185,129,0.18)]",
        }
      : status === "processing"
        ? {
            label: "Processing",
            Icon: Clock,
            cls: "border-sky-400/20 bg-sky-500/10 text-sky-200",
            glow: "shadow-[0_0_18px_rgba(56,189,248,0.18)]",
          }
        : status === "queued"
          ? {
              label: "Queued",
              Icon: Clock,
              cls: "border-white/15 bg-white/5 text-slate-200",
              glow: "shadow-none",
            }
          : status === "failed"
            ? {
                label: "Failed",
                Icon: AlertTriangle,
                cls: "border-rose-400/20 bg-rose-500/10 text-rose-200",
                glow: "shadow-[0_0_18px_rgba(244,63,94,0.16)]",
              }
            : {
                label: "Unknown",
                Icon: Clock,
                cls: "border-white/15 bg-white/5 text-slate-200",
                glow: "shadow-none",
              };

  const Icon = cfg.Icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        cfg.cls,
        cfg.glow,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

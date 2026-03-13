"use client";

import { Lock } from "lucide-react";
import type { BadgeItem } from "@/app/book/data/mockProgress";

type BadgeStripProps = {
  badges: BadgeItem[];
  onSelectBadge: (badge: BadgeItem) => void;
};

export function BadgeStrip({ badges, onSelectBadge }: BadgeStripProps) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {earnedCount} of {badges.length} earned
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2">
        {badges.map((badge) => (
          <button
            key={badge.id}
            type="button"
            onClick={() => onSelectBadge(badge)}
            className={[
              "group relative min-w-32.5 rounded-2xl border px-3.5 py-3.5 text-left transition duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
              badge.earned
                ? "border-amber-300/35 bg-[linear-gradient(140deg,rgba(251,191,36,0.14),rgba(251,191,36,0.06))] text-amber-100 shadow-[0_4px_16px_rgba(251,191,36,0.10)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(251,191,36,0.24)]"
                : "border-white/8 bg-white/3 text-slate-500 hover:border-white/16 hover:bg-white/5",
            ].join(" ")}
            aria-label={`${badge.name} — ${badge.earned ? "Earned" : "Locked"}`}
          >
            {/* Lock overlay */}
            {!badge.earned && (
              <span className="absolute right-2.5 top-2.5 opacity-40">
                <Lock className="h-3 w-3" />
              </span>
            )}

            <p className={["text-2xl", !badge.earned && "opacity-40 grayscale"].join(" ")}>
              {badge.icon}
            </p>
            <p className="mt-2 text-xs font-semibold leading-snug">{badge.name}</p>
            <p className={["mt-0.5 text-[10px]", badge.earned ? "text-amber-300/80" : "text-slate-600"].join(" ")}>
              {badge.earned ? "Earned" : "Locked"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}


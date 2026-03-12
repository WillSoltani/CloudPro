"use client";

import type { BadgeItem } from "@/app/book/data/mockProgress";

type BadgeStripProps = {
  badges: BadgeItem[];
  onSelectBadge: (badge: BadgeItem) => void;
};

export function BadgeStrip({ badges, onSelectBadge }: BadgeStripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {badges.map((badge) => (
        <button
          key={badge.id}
          type="button"
          onClick={() => onSelectBadge(badge)}
          className={[
            "min-w-[160px] rounded-2xl border px-3 py-3 text-left transition duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
            badge.earned
              ? "border-amber-300/40 bg-amber-300/12 text-amber-100 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(251,191,36,0.22)]"
              : "border-white/12 bg-white/[0.03] text-slate-400 hover:border-white/25",
          ].join(" ")}
          aria-label={`Open badge details for ${badge.name}`}
        >
          <p className="text-2xl">{badge.icon}</p>
          <p className="mt-2 text-sm font-semibold">{badge.name}</p>
          <p className="mt-1 text-xs">{badge.earned ? "Earned" : "Locked"}</p>
        </button>
      ))}
    </div>
  );
}


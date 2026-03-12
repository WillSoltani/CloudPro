"use client";

import { FileText, HelpCircle, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

const tabs: Array<{
  id: ChapterTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "examples", label: "Examples", icon: Lightbulb },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
];

type ChapterTabsProps = {
  value: ChapterTab;
  onChange: (tab: ChapterTab) => void;
};

export function ChapterTabs({ value, onChange }: ChapterTabsProps) {
  return (
    <div className="inline-flex rounded-2xl border border-white/25 bg-white/[0.03] p-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xl font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
              active
                ? "border border-white/20 bg-sky-500/14 text-slate-50 shadow-[0_0_0_1px_rgba(56,189,248,0.22)]"
                : "text-slate-300 hover:bg-white/8 hover:text-slate-100",
            ].join(" ")}
            aria-pressed={active}
          >
            <Icon className={active ? "h-5 w-5 text-sky-200" : "h-5 w-5 text-slate-400"} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

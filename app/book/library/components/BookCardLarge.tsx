"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { LibraryBookEntry } from "@/app/book/data/mockUserLibraryState";
import { BookCover } from "@/app/book/components/BookCover";

function statusBadge(entry: LibraryBookEntry): {
  label: string;
  className: string;
} {
  if (entry.status === "completed") {
    return {
      label: "Completed",
      className: "border-emerald-300/30 bg-emerald-400/18 text-emerald-100",
    };
  }
  if (entry.status === "in_progress") {
    return {
      label: "In Progress",
      className: "border-sky-300/30 bg-sky-400/18 text-sky-100",
    };
  }
  return {
    label: entry.isNew ? "New" : "Not Started",
    className: "border-white/30 bg-white/8 text-slate-200",
  };
}

function difficultyChipClass(value: LibraryBookEntry["difficulty"]): string {
  if (value === "Easy") return "border-emerald-300/28 bg-emerald-400/12 text-emerald-200";
  if (value === "Medium") return "border-amber-300/28 bg-amber-400/12 text-amber-200";
  return "border-rose-300/28 bg-rose-400/12 text-rose-200";
}

type BookCardLargeProps = {
  entry: LibraryBookEntry;
  onOpen: () => void;
};

export function BookCardLarge({ entry, onOpen }: BookCardLargeProps) {
  const badge = statusBadge(entry);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-sky-300/30 hover:shadow-[0_22px_52px_rgba(2,6,23,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 sm:p-5"
      aria-label={`Open details for ${entry.title}`}
    >
      <div className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(140deg,rgba(51,65,85,0.6),rgba(30,41,59,0.65))] sm:h-80">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_0%_0%,rgba(56,189,248,0.10),transparent_56%)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_100%,rgba(2,6,23,0.35),transparent_70%)]"
        />
        <span className="absolute right-3 top-3">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              badge.className,
            ].join(" ")}
          >
            {entry.status === "completed" ? <Check className="h-3.5 w-3.5" /> : null}
            {badge.label}
          </span>
        </span>
        <div className="absolute inset-0 flex items-center justify-center px-10 py-8">
          <BookCover
            bookId={entry.id}
            title={entry.title}
            icon={entry.icon}
            coverImage={entry.coverImage}
            className="h-full w-full rounded-2xl border border-white/10 bg-white/6"
            fallbackClassName="text-6xl drop-shadow-[0_10px_22px_rgba(2,6,23,0.55)]"
            sizes="(max-width: 768px) 70vw, 28vw"
          />
        </div>
        {entry.status === "in_progress" ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-400/12 px-2.5 py-1 text-xs text-sky-100 opacity-0 transition duration-200 group-hover:opacity-100">
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <h3 className="text-3xl font-semibold tracking-tight text-slate-100">{entry.title}</h3>
        <p className="mt-1 text-xl text-slate-300">{entry.author}</p>

        <div className="mt-3 flex flex-wrap gap-2.5 text-sm">
          <span className="rounded-xl border border-white/28 bg-white/7 px-3 py-1 text-slate-200">
            {entry.category}
          </span>
          <span
            className={[
              "rounded-xl border px-3 py-1",
              difficultyChipClass(entry.difficulty),
            ].join(" ")}
          >
            {entry.difficulty}
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.03] px-3 py-1 text-slate-300">
            <Sparkles className="h-3.5 w-3.5" />
            ~{Math.round((entry.estimatedMinutes / 60) * 10) / 10} hours
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>
              {entry.chaptersCompleted}/{entry.chaptersTotal} chapters
            </span>
            <span>{entry.progressPercent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-900/55">
            <div
              className={[
                "h-full rounded-full transition-[width] duration-300",
                entry.status === "completed"
                  ? "bg-emerald-300"
                  : entry.status === "in_progress"
                    ? "bg-sky-300"
                    : "bg-white/25",
              ].join(" ")}
              style={{ width: `${Math.max(entry.progressPercent, 0)}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

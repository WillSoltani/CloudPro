"use client";

import { ArrowRight, BookOpenText } from "lucide-react";
import type { BookCatalogItem } from "@/app/book/data/booksCatalog";
import type { RecentBookProgress } from "@/app/book/data/mockProgress";

function estimateMinutesRemaining(
  book: BookCatalogItem,
  progress: RecentBookProgress,
  dailyGoalMinutes: number
) {
  const chapterBudget = Math.max(10, Math.round(book.estimatedMinutes / progress.totalChapters));
  const chapterCompletion = progress.progressPercent / 100;
  const remainingChapterMinutes = Math.max(4, Math.round(chapterBudget * (1 - chapterCompletion)));
  return Math.min(remainingChapterMinutes, Math.max(6, dailyGoalMinutes));
}

type CurrentlyReadingCardProps = {
  book: BookCatalogItem;
  progress: RecentBookProgress;
  dailyGoalMinutes: number;
  onContinue: () => void;
};

export function CurrentlyReadingCard({
  book,
  progress,
  dailyGoalMinutes,
  onContinue,
}: CurrentlyReadingCardProps) {
  const remainingMinutes = estimateMinutesRemaining(book, progress, dailyGoalMinutes);

  return (
    <article className="relative overflow-hidden rounded-[30px] border border-sky-300/28 bg-[linear-gradient(130deg,rgba(14,116,144,0.30),rgba(15,23,42,0.86))] p-5 shadow-[0_18px_55px_rgba(2,132,199,0.30)] sm:p-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-sky-300/14 blur-3xl"
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="inline-flex h-28 w-24 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-4xl shadow-[0_10px_25px_rgba(2,6,23,0.38)]">
          {book.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="inline-flex rounded-full border border-sky-300/35 bg-sky-300/16 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
            Currently Reading
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {book.title}
          </h2>
          <p className="text-base text-slate-200">by {book.author}</p>

          <p className="mt-4 text-sm text-slate-200">
            Chapter {progress.chapter} of {progress.totalChapters}
          </p>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-900/45">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-200"
              style={{ width: `${Math.max(2, progress.progressPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-200">{progress.progressPercent}% complete</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_22px_rgba(14,165,233,0.45)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/60"
            >
              Continue Chapter {progress.chapter}
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-200">~{remainingMinutes} min remaining</span>
          </div>
        </div>
      </div>

      <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-slate-100">
        <BookOpenText className="h-3.5 w-3.5" />
        App Preview
      </span>
    </article>
  );
}


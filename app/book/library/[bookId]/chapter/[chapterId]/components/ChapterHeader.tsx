"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Focus, NotebookPen } from "lucide-react";
import { FontSizeControls } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/FontSizeControls";
import type { FontScale } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";

type ChapterHeaderProps = {
  bookId: string;
  bookTitle: string;
  chapterLabel: string;
  chapterTitle: string;
  author: string;
  minutes: number;
  chapterOrder: number;
  totalChapters: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenNotes: () => void;
  fontScale: FontScale;
  onChangeFontScale: (value: FontScale) => void;
};

export function ChapterHeader({
  bookId,
  bookTitle,
  chapterLabel,
  chapterTitle,
  author,
  minutes,
  chapterOrder,
  totalChapters,
  focusMode,
  onToggleFocus,
  onOpenNotes,
  fontScale,
  onChangeFontScale,
}: ChapterHeaderProps) {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
          <Link href={`/book/library/${encodeURIComponent(bookId)}`} className="inline-flex items-center gap-1 text-slate-300 hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span>Library</span>
          <span>›</span>
          <span>{bookTitle}</span>
          <span>›</span>
          <span className="truncate text-slate-100">{chapterLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <p className="mr-1 text-sm text-slate-400">
            {chapterOrder} / {totalChapters}
          </p>
          <button
            type="button"
            onClick={onToggleFocus}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition",
              focusMode
                ? "border-sky-300/45 bg-sky-500/16 text-sky-100"
                : "border-white/25 bg-white/6 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            <Focus className="h-4 w-4" />
            Focus
          </button>
          <button
            type="button"
            onClick={onOpenNotes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-500/14 px-3 py-1.5 text-sm text-amber-100"
          >
            <NotebookPen className="h-4 w-4" />
            Notes
          </button>
          <FontSizeControls value={fontScale} onChange={onChangeFontScale} />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-5xl font-semibold tracking-tight text-slate-50 sm:text-6xl">{chapterLabel}: {chapterTitle}</h1>
        <p className="flex flex-wrap items-center gap-2 text-2xl text-slate-400">
          <BookOpen className="h-4 w-4" />
          {bookTitle} · {author} · {minutes} min read
        </p>
      </div>
    </header>
  );
}

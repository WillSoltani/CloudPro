"use client";

import { useEffect, useMemo, useState } from "react";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import {
  buildLibraryCatalog,
  type LibraryBookEntry,
} from "@/app/book/data/mockUserLibraryState";

type StoredBookProgress = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  streakDays: number;
  lastReadChapterId: string;
};

type DashboardSnapshot = {
  streakDays: number;
  minutesReadToday: number;
};

export type BookProgressSnapshot = {
  book: LibraryBookEntry;
  status: "completed" | "in_progress" | "not_started";
  completedChapters: number;
  totalChapters: number;
  progressPercent: number;
  bestScore: number;
  avgScore: number;
  lastOpenedLabel: string;
  resumeChapterId: string;
};

export type HeatmapCell = {
  key: string;
  dateLabel: string;
  minutes: number;
  chapters: number;
  level: number;
};

export type UpcomingReviewItem = {
  id: string;
  prompt: string;
  dueLabel: string;
  bookId: string;
};

export type AnalyticsState = {
  streakDays: number;
  dailyGoalMinutes: number;
  minutesReadToday: number;
  booksCompleted: number;
  avgQuizScore: number;
  maxQuizScore: number;
  totalCompletedChapters: number;
  longestStreak: number;
  bookSnapshots: BookProgressSnapshot[];
  heatmapCells: HeatmapCell[];
  upcomingReviews: UpcomingReviewItem[];
  hasAnyProgress: boolean;
};

const DASHBOARD_KEY = "book-accelerator:dashboard:v1";
const PROGRESS_PREFIX = "book-accelerator:book-progress:v2:";

function parseDashboard(raw: string | null): DashboardSnapshot {
  if (!raw) {
    return {
      streakDays: 1,
      minutesReadToday: 0,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardSnapshot>;
    return {
      streakDays:
        Number.isFinite(Number(parsed.streakDays)) && Number(parsed.streakDays) > 0
          ? Math.floor(Number(parsed.streakDays))
          : 1,
      minutesReadToday:
        Number.isFinite(Number(parsed.minutesReadToday)) && Number(parsed.minutesReadToday) >= 0
          ? Math.floor(Number(parsed.minutesReadToday))
          : 0,
    };
  } catch {
    return {
      streakDays: 1,
      minutesReadToday: 0,
    };
  }
}

function parseBookProgress(raw: string | null): StoredBookProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBookProgress>;
    return {
      currentChapterId:
        typeof parsed.currentChapterId === "string" ? parsed.currentChapterId : "",
      completedChapterIds: Array.isArray(parsed.completedChapterIds)
        ? parsed.completedChapterIds.filter((value): value is string => typeof value === "string")
        : [],
      unlockedChapterIds: Array.isArray(parsed.unlockedChapterIds)
        ? parsed.unlockedChapterIds.filter((value): value is string => typeof value === "string")
        : [],
      chapterScores:
        parsed.chapterScores && typeof parsed.chapterScores === "object"
          ? Object.fromEntries(
              Object.entries(parsed.chapterScores).filter(
                ([chapterId, score]) =>
                  typeof chapterId === "string" && Number.isFinite(Number(score))
              )
            )
          : {},
      streakDays:
        Number.isFinite(Number(parsed.streakDays)) && Number(parsed.streakDays) > 0
          ? Math.floor(Number(parsed.streakDays))
          : 1,
      lastReadChapterId:
        typeof parsed.lastReadChapterId === "string" ? parsed.lastReadChapterId : "",
    };
  } catch {
    return null;
  }
}

function chapterLabelById(bookId: string, chapterId: string): string {
  if (!chapterId) return "Not started";
  const chapter = getBookChaptersBundle(bookId).chapters.find((item) => item.id === chapterId);
  if (!chapter) return "Not started";
  return `${chapter.code} ${chapter.title}`;
}

function statusFromCounts(completed: number, total: number): "completed" | "in_progress" | "not_started" {
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "in_progress";
  return "not_started";
}

function generateHeatmap(
  totalCompletedChapters: number,
  streakDays: number,
  minutesReadToday: number
): HeatmapCell[] {
  const now = new Date();
  const days = 84;
  const cells: HeatmapCell[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - index);

    const seed = (index * 37 + totalCompletedChapters * 11 + streakDays * 13) % 100;
    let minutes = 0;

    if (index === 0) {
      minutes = minutesReadToday;
    } else if (index < streakDays) {
      minutes = 12 + (seed % 54);
    } else if (seed > 78) {
      minutes = 15 + (seed % 40);
    } else if (seed > 62) {
      minutes = 5 + (seed % 20);
    }

    const chapters = minutes > 35 ? 2 : minutes > 0 ? 1 : 0;

    const level =
      minutes === 0 ? 0 : minutes < 15 ? 1 : minutes < 30 ? 2 : minutes < 50 ? 3 : 4;

    cells.push({
      key: date.toISOString(),
      dateLabel: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      minutes,
      chapters,
      level,
    });
  }

  return cells;
}

export function useBookAnalytics(selectedBookIds: string[], dailyGoalMinutes: number) {
  const [hydrated, setHydrated] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);

  const seedKey = useMemo(
    () => `${selectedBookIds.join("|")}::${dailyGoalMinutes}`,
    [dailyGoalMinutes, selectedBookIds]
  );

  useEffect(() => {
    const dashboard = parseDashboard(window.localStorage.getItem(DASHBOARD_KEY));
    const entries = buildLibraryCatalog();

    const bookSnapshots = entries.map((entry): BookProgressSnapshot => {
      const stored = parseBookProgress(
        window.localStorage.getItem(`${PROGRESS_PREFIX}${entry.id}`)
      );

      const totalChapters = getBookChaptersBundle(entry.id).chapters.length || entry.chaptersTotal;

      if (!stored) {
        const status = entry.status;
        return {
          book: entry,
          status,
          completedChapters: entry.chaptersCompleted,
          totalChapters,
          progressPercent: entry.progressPercent,
          bestScore: status === "completed" ? 96 : status === "in_progress" ? 88 : 0,
          avgScore: status === "not_started" ? 0 : status === "completed" ? 92 : 84,
          lastOpenedLabel:
            status === "not_started"
              ? "Not started"
              : `${entry.chaptersCompleted}/${totalChapters} chapters`,
          resumeChapterId:
            status === "not_started"
              ? "ch-01"
              : `ch-${String(Math.min(entry.chaptersCompleted + 1, totalChapters)).padStart(2, "0")}`,
        };
      }

      const completedChapters = new Set(stored.completedChapterIds).size;
      const status = statusFromCounts(completedChapters, totalChapters);
      const progressPercent = totalChapters
        ? Math.min(100, Math.round((completedChapters / totalChapters) * 100))
        : 0;

      const scores = Object.values(stored.chapterScores).map((value) => Number(value));
      const bestScore = scores.length ? Math.max(...scores) : 0;
      const avgScore = scores.length
        ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
        : 0;

      const resumeChapterId =
        stored.currentChapterId ||
        `ch-${String(Math.min(completedChapters + 1, totalChapters)).padStart(2, "0")}`;

      return {
        book: entry,
        status,
        completedChapters,
        totalChapters,
        progressPercent,
        bestScore,
        avgScore,
        lastOpenedLabel: chapterLabelById(entry.id, stored.lastReadChapterId),
        resumeChapterId,
      };
    });

    const scoreValues = bookSnapshots
      .map((item) => item.avgScore)
      .filter((score) => score > 0);

    const avgQuizScore = scoreValues.length
      ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
      : 0;

    const maxQuizScore = Math.max(0, ...bookSnapshots.map((item) => item.bestScore));

    const booksCompleted = bookSnapshots.filter((item) => item.status === "completed").length;
    const totalCompletedChapters = bookSnapshots.reduce(
      (sum, item) => sum + item.completedChapters,
      0
    );

    const heatmapCells = generateHeatmap(
      totalCompletedChapters,
      dashboard.streakDays,
      dashboard.minutesReadToday
    );

    const inProgress = bookSnapshots.filter((item) => item.status === "in_progress");
    const upcomingReviews: UpcomingReviewItem[] = inProgress.slice(0, 3).map((item, index) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + index + 1);
      return {
        id: `${item.book.id}-review-${index}`,
        prompt: `Review ${item.book.title}: chapter ${Math.max(item.completedChapters, 1)} takeaways`,
        dueLabel: dueDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        bookId: item.book.id,
      };
    });

    setAnalytics({
      streakDays: dashboard.streakDays,
      dailyGoalMinutes,
      minutesReadToday: dashboard.minutesReadToday,
      booksCompleted,
      avgQuizScore,
      maxQuizScore,
      totalCompletedChapters,
      longestStreak: Math.max(dashboard.streakDays, 12),
      bookSnapshots,
      heatmapCells,
      upcomingReviews,
      hasAnyProgress: totalCompletedChapters > 0,
    });

    setHydrated(true);
  }, [seedKey, dailyGoalMinutes]);

  return {
    hydrated,
    analytics,
  };
}

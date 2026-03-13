"use client";

import { useEffect, useMemo, useState } from "react";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import {
  buildLibraryCatalog,
  type LibraryBookEntry,
} from "@/app/book/data/mockUserLibraryState";
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";

type StoredBookProgress = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  chapterCompletedAt: Record<string, string>;
  lastReadChapterId: string;
  lastOpenedAt: string;
};

type CompletionActivity = {
  bookId: string;
  chapterId: string;
  completedAt: string;
  minutes: number;
  dayKey: string;
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
  lastActivityAt: string;
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
  lastActiveLabel: string;
  bookSnapshots: BookProgressSnapshot[];
  heatmapCells: HeatmapCell[];
  upcomingReviews: UpcomingReviewItem[];
  hasAnyProgress: boolean;
};

const PROGRESS_PREFIX = "book-accelerator:book-progress:v3:";
const EMPTY_ACTIVITY_LABEL = "No activity yet";

function isValidTimestamp(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function toDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00`);
}

function previousDayKey(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}

function formatDayLabel(dayKey: string): string {
  return dayKeyToDate(dayKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDayLabel(dayKey: string | null): string {
  if (!dayKey) return EMPTY_ACTIVITY_LABEL;
  const today = toDayKey(new Date());
  if (dayKey === today) return "Today";
  if (dayKey === previousDayKey(today)) return "Yesterday";
  return formatDayLabel(dayKey);
}

function parseBookProgress(raw: string | null): StoredBookProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBookProgress>;
    return {
      currentChapterId:
        typeof parsed.currentChapterId === "string" ? parsed.currentChapterId : "",
      completedChapterIds: Array.isArray(parsed.completedChapterIds)
        ? parsed.completedChapterIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      unlockedChapterIds: Array.isArray(parsed.unlockedChapterIds)
        ? parsed.unlockedChapterIds.filter(
            (value): value is string => typeof value === "string"
          )
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
      chapterCompletedAt:
        parsed.chapterCompletedAt && typeof parsed.chapterCompletedAt === "object"
          ? Object.fromEntries(
              Object.entries(parsed.chapterCompletedAt).filter(
                ([chapterId, completedAt]) =>
                  typeof chapterId === "string" &&
                  typeof completedAt === "string" &&
                  completedAt.trim() &&
                  isValidTimestamp(completedAt)
              )
            )
          : {},
      lastReadChapterId:
        typeof parsed.lastReadChapterId === "string" ? parsed.lastReadChapterId : "",
      lastOpenedAt:
        typeof parsed.lastOpenedAt === "string" && parsed.lastOpenedAt.trim()
          ? parsed.lastOpenedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function chapterLabelById(bookId: string, chapterId: string): string {
  if (!chapterId) return "Not started";
  const chapter = getBookChaptersBundle(bookId).chapters.find(
    (item) => item.id === chapterId
  );
  if (!chapter) return "Not started";
  return `${chapter.code} ${chapter.title}`;
}

function statusFromCounts(
  completed: number,
  total: number
): "completed" | "in_progress" | "not_started" {
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "in_progress";
  return "not_started";
}

function buildActivities(
  bookId: string,
  chapterCompletedAt: Record<string, string>
): CompletionActivity[] {
  const chapters = getBookChaptersBundle(bookId).chapters;
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return Object.entries(chapterCompletedAt)
    .map(([chapterId, completedAt]) => {
      const chapter = chapterMap.get(chapterId);
      if (!chapter) return null;
      const dayKey = toDayKey(completedAt);
      if (!dayKey) return null;
      return {
        bookId,
        chapterId,
        completedAt,
        minutes: chapter.minutes,
        dayKey,
      };
    })
    .filter((activity): activity is CompletionActivity => Boolean(activity));
}

function buildHeatmap(
  activityByDay: Map<string, { minutes: number; chapters: number }>
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 83; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const dayKey = toDayKey(date);
    const stats = activityByDay.get(dayKey) ?? { minutes: 0, chapters: 0 };

    const level =
      stats.minutes <= 0
        ? 0
        : stats.minutes < 15
          ? 1
          : stats.minutes < 30
            ? 2
            : stats.minutes < 50
              ? 3
              : 4;

    cells.push({
      key: dayKey,
      dateLabel: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      minutes: stats.minutes,
      chapters: stats.chapters,
      level,
    });
  }

  return cells;
}

function calculateCurrentStreak(activityDays: Set<string>): number {
  if (activityDays.size === 0) return 0;

  let cursor = toDayKey(new Date());
  let streak = 0;

  while (activityDays.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }

  return streak;
}

function calculateLongestStreak(dayKeys: string[]): number {
  if (!dayKeys.length) return 0;

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = dayKeys[index - 1];
    const currentDay = dayKeys[index];
    if (previousDayKey(currentDay) === previous) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function useBookAnalytics(selectedBookIds: string[], dailyGoalMinutes: number) {
  const [hydrated, setHydrated] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [revision, setRevision] = useState(0);

  const seedKey = useMemo(
    () => `${selectedBookIds.join("|")}::${dailyGoalMinutes}`,
    [dailyGoalMinutes, selectedBookIds]
  );

  useEffect(() => {
    function onStorageChange() {
      setRevision((value) => value + 1);
    }

    window.addEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("focus", onStorageChange);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("focus", onStorageChange);
    };
  }, []);

  useEffect(() => {
    const entries = buildLibraryCatalog();
    const allActivities: CompletionActivity[] = [];

    const bookSnapshots = entries.map((entry): BookProgressSnapshot => {
      const chaptersBundle = getBookChaptersBundle(entry.id);
      const chapters = chaptersBundle.chapters;
      const totalChapters = chapters.length || entry.chaptersTotal;
      const stored = parseBookProgress(
        window.localStorage.getItem(`${PROGRESS_PREFIX}${entry.id}`)
      );

      if (!stored) {
        return {
          book: entry,
          status: "not_started",
          completedChapters: 0,
          totalChapters,
          progressPercent: 0,
          bestScore: 0,
          avgScore: 0,
          lastOpenedLabel: "Not started",
          lastActivityAt: entry.lastActivityAt,
          resumeChapterId: chapters[0]?.id ?? "",
        };
      }

      const activities = buildActivities(entry.id, stored.chapterCompletedAt);
      allActivities.push(...activities);

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

      const resumeChapterId = stored.currentChapterId || chapters[0]?.id || "";

      const latestCompletionAt = activities
        .map((activity) => activity.completedAt)
        .sort()
        .at(-1);

      const lastActivityAt =
        [stored.lastOpenedAt, latestCompletionAt]
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0 && isValidTimestamp(value)
          )
          .sort()
          .at(-1) ?? entry.lastActivityAt;

      return {
        book: entry,
        status,
        completedChapters,
        totalChapters,
        progressPercent,
        bestScore,
        avgScore,
        lastOpenedLabel:
          stored.lastReadChapterId && stored.lastOpenedAt !== new Date(0).toISOString()
            ? chapterLabelById(entry.id, stored.lastReadChapterId)
            : "Not started",
        lastActivityAt,
        resumeChapterId,
      };
    });

    const activityByDay = new Map<string, { minutes: number; chapters: number }>();
    for (const activity of allActivities) {
      const current = activityByDay.get(activity.dayKey) ?? { minutes: 0, chapters: 0 };
      activityByDay.set(activity.dayKey, {
        minutes: current.minutes + activity.minutes,
        chapters: current.chapters + 1,
      });
    }

    const activityDays = Array.from(activityByDay.keys()).sort();
    const todayKey = toDayKey(new Date());
    const todayStats = activityByDay.get(todayKey) ?? { minutes: 0, chapters: 0 };

    const scoreValues = bookSnapshots
      .map((item) => item.avgScore)
      .filter((score) => score > 0);

    const avgQuizScore = scoreValues.length
      ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
      : 0;

    const maxQuizScore = Math.max(0, ...bookSnapshots.map((item) => item.bestScore));
    const booksCompleted = bookSnapshots.filter(
      (item) => item.status === "completed"
    ).length;
    const totalCompletedChapters = bookSnapshots.reduce(
      (sum, item) => sum + item.completedChapters,
      0
    );

    const currentStreak = calculateCurrentStreak(new Set(activityDays));
    const longestStreak = calculateLongestStreak(activityDays);
    const heatmapCells = buildHeatmap(activityByDay);

    const inProgress = bookSnapshots.filter((item) => item.status === "in_progress");
    const upcomingReviews: UpcomingReviewItem[] = inProgress.slice(0, 3).map((item, index) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + index + 1);
      return {
        id: `${item.book.id}-review-${index}`,
        prompt: `Review ${item.book.title}: chapter ${Math.max(
          item.completedChapters,
          1
        )} takeaways`,
        dueLabel: dueDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        bookId: item.book.id,
      };
    });

    setAnalytics({
      streakDays: currentStreak,
      dailyGoalMinutes,
      minutesReadToday: todayStats.minutes,
      booksCompleted,
      avgQuizScore,
      maxQuizScore,
      totalCompletedChapters,
      longestStreak,
      lastActiveLabel: formatRelativeDayLabel(activityDays.at(-1) ?? null),
      bookSnapshots,
      heatmapCells,
      upcomingReviews,
      hasAnyProgress: totalCompletedChapters > 0,
    });

    setHydrated(true);
  }, [seedKey, dailyGoalMinutes, revision]);

  return {
    hydrated,
    analytics,
  };
}

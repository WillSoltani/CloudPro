"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookChapter } from "@/app/book/data/mockChapters";

type ChapterState = "completed" | "current" | "locked";

type PersistedBookProgress = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
  chapterScores: Record<string, number>;
  streakDays: number;
  lastReadChapterId: string;
};

const STORAGE_PREFIX = "book-accelerator:book-progress:v2";

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function initialProgress(chapters: BookChapter[]): PersistedBookProgress {
  const firstChapterId = chapters[0]?.id ?? "";

  return {
    currentChapterId: firstChapterId,
    completedChapterIds: [],
    unlockedChapterIds: firstChapterId ? [firstChapterId] : [],
    chapterScores: {},
    streakDays: 0,
    lastReadChapterId: firstChapterId,
  };
}

function getNextChapterId(chapters: BookChapter[], currentChapterId: string): string {
  const index = chapters.findIndex((chapter) => chapter.id === currentChapterId);
  if (index < 0) return chapters[0]?.id ?? "";
  return chapters[index + 1]?.id ?? "";
}

function getFirstIncompleteUnlocked(
  chapters: BookChapter[],
  completedSet: Set<string>,
  unlockedSet: Set<string>
): string {
  return (
    chapters.find(
      (chapter) => unlockedSet.has(chapter.id) && !completedSet.has(chapter.id)
    )?.id ?? ""
  );
}

function normalizeProgress(
  raw: Partial<PersistedBookProgress>,
  fallback: PersistedBookProgress,
  chapters: BookChapter[]
): PersistedBookProgress {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  const completedChapterIds = uniqueIds(
    Array.isArray(raw.completedChapterIds)
      ? raw.completedChapterIds.filter((id): id is string => typeof id === "string" && chapterIds.has(id))
      : fallback.completedChapterIds
  );

  const baseUnlocked = Array.isArray(raw.unlockedChapterIds)
    ? raw.unlockedChapterIds.filter((id): id is string => typeof id === "string" && chapterIds.has(id))
    : fallback.unlockedChapterIds;

  const unlockedChapterIds = uniqueIds([...baseUnlocked, ...completedChapterIds]);

  const chapterScores =
    raw.chapterScores && typeof raw.chapterScores === "object"
      ? Object.fromEntries(
          Object.entries(raw.chapterScores).filter(
            ([chapterId, score]) =>
              chapterIds.has(chapterId) &&
              Number.isFinite(Number(score)) &&
              Number(score) >= 0 &&
              Number(score) <= 100
          )
        )
      : fallback.chapterScores;

  const streakDays =
    Number.isFinite(Number(raw.streakDays)) && Number(raw.streakDays) >= 0
      ? Math.floor(Number(raw.streakDays))
      : fallback.streakDays;

  const completedSet = new Set(completedChapterIds);
  const unlockedSet = new Set(unlockedChapterIds);

  const requestedCurrent =
    typeof raw.currentChapterId === "string" && chapterIds.has(raw.currentChapterId)
      ? raw.currentChapterId
      : fallback.currentChapterId;

  let currentChapterId = requestedCurrent;
  if (completedSet.has(currentChapterId) || !unlockedSet.has(currentChapterId)) {
    currentChapterId =
      getFirstIncompleteUnlocked(chapters, completedSet, unlockedSet) ||
      fallback.currentChapterId;
  }

  const lastReadChapterId =
    typeof raw.lastReadChapterId === "string" && chapterIds.has(raw.lastReadChapterId)
      ? raw.lastReadChapterId
      : currentChapterId;

  return {
    currentChapterId,
    completedChapterIds,
    unlockedChapterIds: uniqueIds([...unlockedChapterIds, currentChapterId]),
    chapterScores,
    streakDays,
    lastReadChapterId,
  };
}

function parseStored(
  raw: string | null,
  chapters: BookChapter[]
): PersistedBookProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedBookProgress>;
    return normalizeProgress(parsed, initialProgress(chapters), chapters);
  } catch {
    return null;
  }
}

export function useBookProgress(bookId: string, chapters: BookChapter[]) {
  const storageKey = `${STORAGE_PREFIX}:${bookId}`;
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState<PersistedBookProgress>(() =>
    initialProgress(chapters)
  );

  useEffect(() => {
    const parsed = parseStored(window.localStorage.getItem(storageKey), chapters);
    setProgress(parsed ?? initialProgress(chapters));
    setHydrated(true);
  }, [chapters, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [hydrated, progress, storageKey]);

  const completedSet = useMemo(
    () => new Set(progress.completedChapterIds),
    [progress.completedChapterIds]
  );
  const unlockedSet = useMemo(
    () => new Set(progress.unlockedChapterIds),
    [progress.unlockedChapterIds]
  );

  const currentChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === progress.currentChapterId) ?? chapters[0],
    [chapters, progress.currentChapterId]
  );

  const lastReadChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === progress.lastReadChapterId) ?? currentChapter,
    [chapters, currentChapter, progress.lastReadChapterId]
  );

  const completedCount = progress.completedChapterIds.length;
  const totalCount = chapters.length;
  const progressPercent = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const avgScore = (() => {
    const values = Object.values(progress.chapterScores);
    if (!values.length) return 0;
    const total = values.reduce((sum, value) => sum + Number(value), 0);
    return Math.round(total / values.length);
  })();

  const getChapterState = useCallback(
    (chapterId: string): ChapterState => {
      if (completedSet.has(chapterId)) return "completed";
      if (chapterId === progress.currentChapterId) return "current";
      return "locked";
    },
    [completedSet, progress.currentChapterId]
  );

  const isChapterUnlocked = useCallback(
    (chapterId: string): boolean => completedSet.has(chapterId) || unlockedSet.has(chapterId),
    [completedSet, unlockedSet]
  );

  const setLastReadChapter = useCallback((chapterId: string) => {
    setProgress((prev) => {
      if (!chapters.some((chapter) => chapter.id === chapterId)) return prev;
      return { ...prev, lastReadChapterId: chapterId };
    });
  }, [chapters]);

  const setCurrentChapter = useCallback(
    (chapterId: string) => {
      setProgress((prev) => {
        const allowed = prev.completedChapterIds.includes(chapterId) || prev.unlockedChapterIds.includes(chapterId);
        if (!allowed) return prev;
        return {
          ...prev,
          currentChapterId: chapterId,
          lastReadChapterId: chapterId,
        };
      });
    },
    []
  );

  const markChapterComplete = useCallback(
    (chapterId: string, score: number) => {
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

      setProgress((prev) => {
        if (!chapters.some((chapter) => chapter.id === chapterId)) return prev;

        const alreadyCompleted = prev.completedChapterIds.includes(chapterId);
        const completedChapterIds = alreadyCompleted
          ? prev.completedChapterIds
          : [...prev.completedChapterIds, chapterId];

        const nextChapterId = getNextChapterId(chapters, chapterId);
        const unlockedChapterIds = uniqueIds([
          ...prev.unlockedChapterIds,
          chapterId,
          ...completedChapterIds,
          nextChapterId,
        ]);

        const completedSetLocal = new Set(completedChapterIds);
        const unlockedSetLocal = new Set(unlockedChapterIds);

        const nextCurrent =
          (nextChapterId && !completedSetLocal.has(nextChapterId) && unlockedSetLocal.has(nextChapterId)
            ? nextChapterId
            : getFirstIncompleteUnlocked(chapters, completedSetLocal, unlockedSetLocal)) ||
          chapterId;

        return {
          ...prev,
          completedChapterIds,
          unlockedChapterIds,
          chapterScores: {
            ...prev.chapterScores,
            [chapterId]: Math.max(prev.chapterScores[chapterId] ?? 0, clampedScore),
          },
          currentChapterId: nextCurrent,
          lastReadChapterId: chapterId,
          streakDays: alreadyCompleted ? prev.streakDays : prev.streakDays + 1,
        };
      });
    },
    [chapters]
  );

  const markCurrentChapterComplete = useCallback(
    (score: number) => {
      const chapterId = progress.currentChapterId;
      if (!chapterId) return;
      markChapterComplete(chapterId, score);
    },
    [markChapterComplete, progress.currentChapterId]
  );

  const markBookComplete = useCallback(
    (score = 100) => {
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      setProgress((prev) => {
        const chapterIds = chapters.map((chapter) => chapter.id);
        const chapterScores = { ...prev.chapterScores };
        for (const chapterId of chapterIds) {
          chapterScores[chapterId] = Math.max(chapterScores[chapterId] ?? 0, clampedScore);
        }

        return {
          ...prev,
          completedChapterIds: chapterIds,
          unlockedChapterIds: chapterIds,
          chapterScores,
          currentChapterId: chapterIds[chapterIds.length - 1] ?? prev.currentChapterId,
          lastReadChapterId: chapterIds[chapterIds.length - 1] ?? prev.lastReadChapterId,
          streakDays: prev.streakDays + 1,
        };
      });
    },
    [chapters]
  );

  const resetProgress = useCallback(() => {
    setProgress(initialProgress(chapters));
  }, [chapters]);

  return {
    hydrated,
    progress,
    currentChapter,
    lastReadChapter,
    completedCount,
    totalCount,
    progressPercent,
    avgScore,
    getChapterState,
    isChapterUnlocked,
    setCurrentChapter,
    setLastReadChapter,
    markChapterComplete,
    markCurrentChapterComplete,
    markBookComplete,
    resetProgress,
  };
}

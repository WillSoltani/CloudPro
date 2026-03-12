"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type RecentBookProgress,
  type SessionTask,
  buildRecentBooks,
  buildTodaySessionTasks,
} from "@/app/book/data/mockProgress";

export type BookDashboardState = {
  streakDays: number;
  minutesReadToday: number;
  currentBookId: string;
  searchQuery: string;
  dismissMobileCta: boolean;
  recentBooks: RecentBookProgress[];
  todaySession: SessionTask[];
};

type DashboardSeed = {
  selectedBookIds: string[];
  dailyGoalMinutes: number;
};

const STORAGE_KEY = "book-accelerator:dashboard:v1";

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function createDefaultState(seed: DashboardSeed): BookDashboardState {
  const recentBooks = buildRecentBooks(seed.selectedBookIds);
  const primary = recentBooks[0];
  const currentChapter = Math.max(1, primary?.chapter ?? 1);

  return {
    streakDays: 12,
    minutesReadToday: Math.min(14, Math.max(0, seed.dailyGoalMinutes - 6)),
    currentBookId: primary?.bookId || seed.selectedBookIds[0] || "",
    searchQuery: "",
    dismissMobileCta: false,
    recentBooks,
    todaySession: buildTodaySessionTasks(currentChapter),
  };
}

function parseStored(value: string | null, seed: DashboardSeed): BookDashboardState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BookDashboardState>;
    const defaults = createDefaultState(seed);
    const recentBooks = Array.isArray(parsed.recentBooks) && parsed.recentBooks.length
      ? parsed.recentBooks
      : defaults.recentBooks;

    const fallbackCurrent = recentBooks[0]?.bookId || defaults.currentBookId;
    const currentBookId =
      typeof parsed.currentBookId === "string" && parsed.currentBookId.trim()
        ? parsed.currentBookId
        : fallbackCurrent;

    return {
      ...defaults,
      ...parsed,
      streakDays: clampNonNegative(Number(parsed.streakDays ?? defaults.streakDays)),
      minutesReadToday: clampNonNegative(
        Number(parsed.minutesReadToday ?? defaults.minutesReadToday)
      ),
      currentBookId,
      recentBooks,
      todaySession:
        Array.isArray(parsed.todaySession) && parsed.todaySession.length
          ? parsed.todaySession
          : defaults.todaySession,
      searchQuery:
        typeof parsed.searchQuery === "string" ? parsed.searchQuery : defaults.searchQuery,
      dismissMobileCta: Boolean(parsed.dismissMobileCta),
    };
  } catch {
    return null;
  }
}

export function useBookState(seed: DashboardSeed) {
  const seedKey = useMemo(
    () => `${seed.selectedBookIds.join("|")}::${seed.dailyGoalMinutes}`,
    [seed.dailyGoalMinutes, seed.selectedBookIds]
  );

  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookDashboardState>(() => createDefaultState(seed));

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY), seed);
    if (stored) {
      setState(stored);
    } else {
      setState(createDefaultState(seed));
    }
    setHydrated(true);
  }, [seedKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.recentBooks.some((book) => book.bookId === state.currentBookId)) {
      const fallback = state.recentBooks[0]?.bookId || "";
      setState((prev) => ({ ...prev, currentBookId: fallback }));
    }
  }, [hydrated, state.currentBookId, state.recentBooks]);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((prev) => ({ ...prev, searchQuery }));
  }, []);

  const addReadMinutes = useCallback((minutes: number) => {
    setState((prev) => ({
      ...prev,
      minutesReadToday: clampNonNegative(prev.minutesReadToday + minutes),
    }));
  }, []);

  const setCurrentBookId = useCallback((currentBookId: string) => {
    setState((prev) => ({ ...prev, currentBookId }));
  }, []);

  const toggleSessionTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      todaySession: prev.todaySession.map((task) =>
        task.id === taskId ? { ...task, complete: !task.complete } : task
      ),
    }));
  }, []);

  const dismissMobileCta = useCallback(() => {
    setState((prev) => ({ ...prev, dismissMobileCta: true }));
  }, []);

  return {
    state,
    hydrated,
    setSearchQuery,
    addReadMinutes,
    setCurrentBookId,
    toggleSessionTask,
    dismissMobileCta,
  };
}


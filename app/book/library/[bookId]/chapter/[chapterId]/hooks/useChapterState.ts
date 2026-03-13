"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadingDepth } from "@/app/book/data/mockChapters";

export type ChapterTab = "summary" | "examples" | "quiz";
export type ExampleFilter = "all" | "work" | "school" | "personal";
export type FontScale = "sm" | "md" | "lg";

export type QuizResult = {
  score: number;
  passed: boolean;
};

type PersistedChapterState = {
  activeTab: ChapterTab;
  readingDepth: ReadingDepth;
  exampleFilter: ExampleFilter;
  quizAnswers: Record<string, number>;
  quizResult: QuizResult | null;
  notes: string;
  focusMode: boolean;
  fontScale: FontScale;
  showRecap: boolean;
  explanationOpen: Record<string, boolean>;
};

const STORAGE_PREFIX = "book-accelerator:chapter-reader:v1";
const PREFS_KEY = "book-accelerator:reader-prefs:v1";

type ReaderPrefs = {
  focusMode: boolean;
  fontScale: FontScale;
};

const defaultState: PersistedChapterState = {
  activeTab: "summary",
  readingDepth: "deeper",
  exampleFilter: "all",
  quizAnswers: {},
  quizResult: null,
  notes: "",
  focusMode: false,
  fontScale: "md",
  showRecap: false,
  explanationOpen: {},
};

function isTab(value: unknown): value is ChapterTab {
  return value === "summary" || value === "examples" || value === "quiz";
}

function isReadingDepth(value: unknown): value is ReadingDepth {
  return value === "simple" || value === "standard" || value === "deeper";
}

function isExampleFilter(value: unknown): value is ExampleFilter {
  return value === "all" || value === "work" || value === "school" || value === "personal";
}

function isFontScale(value: unknown): value is FontScale {
  return value === "sm" || value === "md" || value === "lg";
}

function parseStored(value: string | null): PersistedChapterState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersistedChapterState>;
    const quizAnswers =
      parsed.quizAnswers && typeof parsed.quizAnswers === "object"
        ? Object.fromEntries(
            Object.entries(parsed.quizAnswers).filter(
              ([key, answer]) =>
                typeof key === "string" &&
                Number.isFinite(Number(answer)) &&
                Number(answer) >= 0 &&
                Number(answer) <= 10
            )
          )
        : {};

    const quizResult =
      parsed.quizResult && typeof parsed.quizResult === "object"
        ? {
            score: Number(parsed.quizResult.score ?? 0),
            passed: Boolean(parsed.quizResult.passed),
          }
        : null;

    return {
      activeTab: isTab(parsed.activeTab) ? parsed.activeTab : defaultState.activeTab,
      readingDepth: isReadingDepth(parsed.readingDepth)
        ? parsed.readingDepth
        : defaultState.readingDepth,
      exampleFilter: isExampleFilter(parsed.exampleFilter)
        ? parsed.exampleFilter
        : defaultState.exampleFilter,
      quizAnswers,
      quizResult,
      notes: typeof parsed.notes === "string" ? parsed.notes : defaultState.notes,
      focusMode:
        typeof parsed.focusMode === "boolean" ? parsed.focusMode : defaultState.focusMode,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : defaultState.fontScale,
      showRecap:
        typeof parsed.showRecap === "boolean" ? parsed.showRecap : defaultState.showRecap,
      explanationOpen:
        parsed.explanationOpen && typeof parsed.explanationOpen === "object"
          ? Object.fromEntries(
              Object.entries(parsed.explanationOpen).filter(
                ([key, open]) => typeof key === "string" && typeof open === "boolean"
              )
            )
          : {},
    };
  } catch {
    return null;
  }
}

function parsePrefs(value: string | null): ReaderPrefs | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ReaderPrefs>;
    return {
      focusMode:
        typeof parsed.focusMode === "boolean" ? parsed.focusMode : defaultState.focusMode,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : defaultState.fontScale,
    };
  } catch {
    return null;
  }
}

export function useChapterState(bookId: string, chapterId: string) {
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${bookId}:${chapterId}`,
    [bookId, chapterId]
  );
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PersistedChapterState>(defaultState);

  useEffect(() => {
    const parsed = parseStored(window.localStorage.getItem(storageKey));
    const prefs = parsePrefs(window.localStorage.getItem(PREFS_KEY));
    setState({
      ...(parsed ?? defaultState),
      focusMode: prefs?.focusMode ?? parsed?.focusMode ?? defaultState.focusMode,
      fontScale: prefs?.fontScale ?? parsed?.fontScale ?? defaultState.fontScale,
    });
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const prefs: ReaderPrefs = {
      focusMode: state.focusMode,
      fontScale: state.fontScale,
    };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [hydrated, state.focusMode, state.fontScale]);

  const setActiveTab = useCallback((activeTab: ChapterTab) => {
    setState((prev) => ({ ...prev, activeTab }));
  }, []);

  const setReadingDepth = useCallback((readingDepth: ReadingDepth) => {
    setState((prev) => ({
      ...prev,
      readingDepth,
      quizAnswers: {},
      quizResult: null,
      explanationOpen: {},
    }));
  }, []);

  const setExampleFilter = useCallback((exampleFilter: ExampleFilter) => {
    setState((prev) => ({ ...prev, exampleFilter }));
  }, []);

  const setQuizAnswer = useCallback((questionId: string, answerIndex: number) => {
    setState((prev) => ({
      ...prev,
      quizAnswers: {
        ...prev.quizAnswers,
        [questionId]: answerIndex,
      },
    }));
  }, []);

  const clearQuizState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      quizAnswers: {},
      quizResult: null,
      explanationOpen: {},
    }));
  }, []);

  const setQuizResult = useCallback((quizResult: QuizResult | null) => {
    setState((prev) => ({ ...prev, quizResult }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  const appendNote = useCallback((snippet: string) => {
    setState((prev) => {
      const nextNotes = prev.notes.trim()
        ? `${prev.notes.trim()}\n\n${snippet}`
        : snippet;
      return {
        ...prev,
        notes: nextNotes,
      };
    });
  }, []);

  const toggleFocusMode = useCallback(() => {
    setState((prev) => ({ ...prev, focusMode: !prev.focusMode }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setState((prev) => ({ ...prev, fontScale }));
  }, []);

  const toggleRecap = useCallback(() => {
    setState((prev) => ({ ...prev, showRecap: !prev.showRecap }));
  }, []);

  const toggleExplanation = useCallback((questionId: string) => {
    setState((prev) => ({
      ...prev,
      explanationOpen: {
        ...prev.explanationOpen,
        [questionId]: !prev.explanationOpen[questionId],
      },
    }));
  }, []);

  return {
    hydrated,
    state,
    setActiveTab,
    setReadingDepth,
    setExampleFilter,
    setQuizAnswer,
    clearQuizState,
    setQuizResult,
    setNotes,
    appendNote,
    toggleFocusMode,
    setFontScale,
    toggleRecap,
    toggleExplanation,
  };
}

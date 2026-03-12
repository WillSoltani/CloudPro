"use client";

import { useCallback, useEffect, useState } from "react";

export type ReaderFontDefault = "sm" | "md" | "lg";

export type BookPreferencesState = {
  dailyReminderEnabled: boolean;
  streakReminderEnabled: boolean;
  reducedMotion: boolean;
  fontDefault: ReaderFontDefault;
  whatsNewSeenAt: string | null;
};

const STORAGE_KEY = "book-accelerator:preferences:v1";

const defaultState: BookPreferencesState = {
  dailyReminderEnabled: true,
  streakReminderEnabled: true,
  reducedMotion: false,
  fontDefault: "md",
  whatsNewSeenAt: null,
};

function parseStored(raw: string | null): BookPreferencesState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BookPreferencesState>;
    return {
      dailyReminderEnabled:
        typeof parsed.dailyReminderEnabled === "boolean"
          ? parsed.dailyReminderEnabled
          : defaultState.dailyReminderEnabled,
      streakReminderEnabled:
        typeof parsed.streakReminderEnabled === "boolean"
          ? parsed.streakReminderEnabled
          : defaultState.streakReminderEnabled,
      reducedMotion:
        typeof parsed.reducedMotion === "boolean"
          ? parsed.reducedMotion
          : defaultState.reducedMotion,
      fontDefault:
        parsed.fontDefault === "sm" || parsed.fontDefault === "lg" || parsed.fontDefault === "md"
          ? parsed.fontDefault
          : defaultState.fontDefault,
      whatsNewSeenAt:
        typeof parsed.whatsNewSeenAt === "string" || parsed.whatsNewSeenAt === null
          ? parsed.whatsNewSeenAt
          : defaultState.whatsNewSeenAt,
    };
  } catch {
    return null;
  }
}

export function useBookPreferences() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<BookPreferencesState>(defaultState);

  useEffect(() => {
    const parsed = parseStored(window.localStorage.getItem(STORAGE_KEY));
    setState(parsed ?? defaultState);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const patch = useCallback((values: Partial<BookPreferencesState>) => {
    setState((prev) => ({ ...prev, ...values }));
  }, []);

  const reset = useCallback(() => setState(defaultState), []);

  return {
    hydrated,
    state,
    patch,
    reset,
  };
}

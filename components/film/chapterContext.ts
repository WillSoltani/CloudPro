"use client";

import { createContext, useContext, type RefObject } from "react";
import type { MotionValue } from "framer-motion";
import type { ChapterChoreo, HeadWindows } from "@/components/film/choreo";

/** What a FilmChapter shares with its composition (Reveal, ChapterHead, FrameColumns, the plate). */
export type ChapterContextValue = {
  /** The section id (the anchor's id; the h2 is `${id}-title`). */
  id: string;
  /** Reel index of the chapter's film. */
  index: number;
  /** Smoothed film frame (float): p·M in the move, M + g(τ)·T in the tail. Reveals key to it. */
  frame: MotionValue<number>;
  /** Smoothed move progress p (0→1). */
  progress: MotionValue<number>;
  /** Smoothed tail fraction τ (0 in the move). */
  tau: MotionValue<number>;
  /** τ at the end of the read pin (Reveal `pin` windows scale by it). */
  tauRead: MotionValue<number>;
  /** The move's last frame M. */
  end: number;
  choreo: ChapterChoreo;
  /** The heading windows in play: the plate's (h2 at `land`) when it draws, else the amber ones. */
  head: HeadWindows;
  reduced: boolean;
  platesOn: boolean;
  /** The composition is stacked (phones; a framed layout that would not fit): Reveal `stackedPin` applies. */
  stacked: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  composeRef: RefObject<HTMLDivElement | null>;
  /** The raw (unsmoothed) move frame from the scroll position (0 before the chapter, M from camera rest). */
  rawFrame: () => number;
};

export const ChapterContext = createContext<ChapterContextValue | null>(null);

export function useChapter(): ChapterContextValue {
  const ctx = useContext(ChapterContext);
  if (!ctx) throw new Error("useChapter must be used inside <FilmChapter>");
  return ctx;
}

/** The chapter around this component, or null outside one (RackPlate on a legacy divider). */
export function useChapterOptional(): ChapterContextValue | null {
  return useContext(ChapterContext);
}

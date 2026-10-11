import { createContext, useContext } from "react";
import type { MotionValue } from "framer-motion";

/**
 * 0→1 progress of the enclosing <FilmSegment>, in step with what the backdrop paints: the backdrop
 * sets it to `clamp(r − index, 0, 1)` from the (spring-smoothed) reel position `r`.
 */
export const FilmProgressContext = createContext<MotionValue<number> | null>(null);

/** Smoothed 0→1 scroll progress of the enclosing <FilmSegment>. */
export function useFilmProgress(): MotionValue<number> {
  const progress = useContext(FilmProgressContext);
  if (!progress) throw new Error("useFilmProgress must be used inside <FilmSegment>");
  return progress;
}

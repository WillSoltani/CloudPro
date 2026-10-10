"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/ScrollFilm";

type Range = { from?: number; to?: number };

type FadeProps = Required<Range> & {
  /** "out": canvas → page base across the window; "in": page base → canvas. */
  direction: "in" | "out";
};

/** A page-base overlay that ramps across [from, to] of the film, so the stage hands off to the page without a step. */
export function FilmFade({ from, to, direction }: FadeProps) {
  const progress = useFilmProgress();
  const opacity = useTransform(progress, [from, to], direction === "out" ? [0, 1] : [1, 0]);
  return (
    <motion.div
      aria-hidden
      data-fade={direction}
      className="pointer-events-none absolute inset-0 bg-night"
      style={{ opacity }}
    />
  );
}

/** Resolves the last 8 % of the film to the page base so the next section lands without a step. */
export function FilmFadeOut({ from = 0.92, to = 1 }: Range = {}) {
  return <FilmFade from={from} to={to} direction="out" />;
}

/** The twin for chapter dividers: the film emerges from the page base over its first 8 %. */
export function FilmFadeIn({ from = 0, to = 0.08 }: Range = {}) {
  return <FilmFade from={from} to={to} direction="in" />;
}

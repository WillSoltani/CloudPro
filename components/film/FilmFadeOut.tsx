"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/ScrollFilm";

/** Resolves the last 8 % of the film to the page base so the next section lands without a step. */
export function FilmFadeOut() {
  const progress = useFilmProgress();
  const opacity = useTransform(progress, [0.92, 1], [0, 1]);
  return (
    <motion.div
      aria-hidden
      data-fade=""
      className="pointer-events-none absolute inset-0 bg-night"
      style={{ opacity }}
    />
  );
}

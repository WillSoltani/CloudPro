"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/ScrollFilm";

// Landscape film aspect (manifest `aspect`); the hairlines only show in the landscape `wide:` layout.
const ASPECT = 1.7778;

/**
 * Two drafting hairlines on desktop: the caption column's right edge and the painted horizon.
 * The horizon leaves with the skyline; the column line with the film.
 *
 * Column: the same expression as BeaconCaptions' COLUMN (`left-[5vw] w-[25vw] min-w-[20rem]
 * max-w-[34rem]`), so below 1280 px, where the min-width rather than 25 vw sets the edge, the
 * line clears the text instead of running through it.
 *
 * Horizon: 60 % of the *drawn* frame, not the stage. ScrollFilm paints with `fit="cover"` and
 * `focus=[0.5,0.45]`, so `drawnH = max(stageH, stageW / aspect)` offset by `(stageH − drawnH) · 0.45`;
 * the horizon therefore sits at `0.6·drawnH + 0.45·(stageH − drawnH) = 0.15·drawnH + 0.45·stageH`.
 * The wrapper is a size container so `cqw` reads the stage width.
 */
export function GridHairlines() {
  const progress = useFilmProgress();
  const column = useTransform(progress, [0.9, 0.98], [1, 0]);
  const horizon = useTransform(progress, [0.78, 0.86], [1, 0]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden @container wide:block">
      <motion.div
        className="absolute inset-y-0 left-[min(calc(5vw+34rem),max(30vw,calc(5vw+20rem)))] w-px bg-white/[0.07]"
        style={{ opacity: column }}
      />
      {/* Starts at the column line so it never threads between caption rows. */}
      <motion.div
        className="absolute right-0 left-[min(calc(5vw+34rem),max(30vw,calc(5vw+20rem)))] h-px bg-white/[0.07]"
        style={{ opacity: horizon, top: `calc(0.15 * max(100%, 100cqw / ${ASPECT}) + 45%)` }}
      />
    </div>
  );
}

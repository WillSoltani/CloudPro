"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/filmProgress";
import { HERO_INTRO_END } from "@/components/film/heroBeats";

/**
 * One drafting hairline on desktop: the caption column's right edge, leaving with the hero's intro copy. (The painted
 * horizon rule is gone: it belonged to the old skyline frames and would cut across a rack.)
 *
 * Column: the same expression as captionTokens' CAPTION_COLUMN (`left-[5vw] w-[25vw] min-w-[20rem]
 * max-w-[34rem]`), so below 1280 px, where the min-width rather than 25 vw sets the edge, the
 * line clears the text instead of running through it.
 */
export function GridHairlines() {
  const progress = useFilmProgress();
  const column = useTransform(progress, [HERO_INTRO_END - 0.04, HERO_INTRO_END], [1, 0]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden wide:block">
      <motion.div
        className="absolute inset-y-0 left-[min(calc(5vw+34rem),max(30vw,calc(5vw+20rem)))] w-px bg-white/[0.07]"
        style={{ opacity: column }}
      />
    </div>
  );
}

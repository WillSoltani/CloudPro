"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/ScrollFilm";

type Props = {
  /** Desktop-only left scrim; enable if the beat labels fall under 4.5:1 on K1/K2. */
  left?: boolean;
  /**
   * Progress window over which the left scrim leaves (opacity 1 → 0). The default is the hero's:
   * its left column is empty from scene 4 (centred caption over dark sky), so the band leaves with
   * scene 3. Pass `null` to keep the band for the whole film.
   */
  leftFade?: readonly [number, number] | null;
};

/** Legibility scrims under the captions: a bottom band on phones, an optional left band on desktop. */
export function FilmScrims({ left = false, leftFade = [0.74, 0.8] }: Props) {
  const progress = useFilmProgress();
  const leftOpacity = useTransform(
    progress,
    leftFade ? [leftFade[0], leftFade[1]] : [0, 1],
    leftFade ? [1, 0] : [1, 1],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 bottom-0 h-[42svh] bg-[linear-gradient(to_top,#070b16_18%,rgba(7,11,22,0.75)_48%,transparent)] wide:hidden" />
      {left ? (
        // Holds ≈0.65 alpha across the whole caption column (x 5–30 vw), where K0–K3's haze is brightest,
        // then falls off before the drafting lines / cranes begin around x ≈ 0.35 of the frame.
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-y-0 left-0 hidden w-[46vw] bg-[linear-gradient(to_right,rgba(7,11,22,0.78)_0,rgba(7,11,22,0.65)_30vw,rgba(7,11,22,0.3)_38vw,transparent_46vw)] wide:block"
        />
      ) : null}
    </div>
  );
}

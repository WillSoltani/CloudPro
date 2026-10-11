"use client";

import { motion, useTransform } from "framer-motion";
import { useFilmProgress } from "@/components/film/filmProgress";

type Props = {
  /** Desktop-only left scrim; enable if the beat labels fall under 4.5:1 on K1/K2. */
  left?: boolean;
  /**
   * Progress window over which the left scrim arrives (opacity 0 → 1). `null` (default): present from
   * the start, as the hero needs for its opening block. Dividers bring it in with their caption, so
   * the stage enters from the hold as the bare frame.
   */
  leftIn?: readonly [number, number] | null;
  /**
   * Progress window over which the left scrim leaves (opacity 1 → 0). `null` (default): the band stays
   * for the whole segment, as the hero needs (every scene, 04 included, captions in the left column).
   * Dividers pass their caption's exit window.
   */
  leftFade?: readonly [number, number] | null;
};

/**
 * Legibility scrims under the captions: a bottom band on phones, an optional left band on desktop.
 *
 * Seams with the hold panels (HoldPanel): the phone band is always on, so every stage ends on solid
 * night at its bottom edge, which is where the panel after it starts; the left band is feathered out
 * at the stage's top and bottom (captions sit in the middle), so a stage's edges are always the bare
 * frame on desktop.
 */
export function FilmScrims({ left = false, leftIn = null, leftFade = null }: Props) {
  const progress = useFilmProgress();
  const input: number[] = [];
  const output: number[] = [];
  if (leftIn) {
    input.push(leftIn[0], leftIn[1]);
    output.push(0, 1);
  }
  if (leftFade) {
    input.push(leftFade[0], leftFade[1]);
    output.push(1, 0);
  }
  if (!input.length) {
    input.push(0, 1);
    output.push(1, 1);
  }
  const leftOpacity = useTransform(progress, input, output);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 bottom-0 h-[42svh] bg-[linear-gradient(to_top,#070b16_18%,rgba(7,11,22,0.75)_48%,transparent)] wide:hidden" />
      {left ? (
        // Holds ≈0.65 alpha across the whole caption column (x 5–30 vw), where K0–K3's haze is brightest,
        // then falls off before the drafting lines / cranes begin around x ≈ 0.35 of the frame.
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-y-0 left-0 hidden w-[46vw] bg-[linear-gradient(to_right,rgba(7,11,22,0.78)_0,rgba(7,11,22,0.65)_30vw,rgba(7,11,22,0.3)_38vw,transparent_46vw)] [mask-image:linear-gradient(to_bottom,transparent,#000_15%,#000_85%,transparent)] wide:block"
        />
      ) : null}
    </div>
  );
}

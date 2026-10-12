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
  /**
   * Peak alpha of the left band (default 0.65, which the dark server-hall frames want). Lower it over
   * brighter frames, where a strong band reads as a dark rectangle with a visible edge.
   */
  leftAlpha?: number;
};

const NIGHT = "7,11,22";

/**
 * The left band's gradient: `a` across the caption column (to 20 vw), then an eased fall to transparent
 * at 46 vw with no slope break, so the band has no visible vertical edge over a bright frame. The first
 * stop overshoots (1.2 a) to keep the page edge as dark as it was.
 */
function leftBand(a: number): string {
  const c = (k: number) => `rgba(${NIGHT},${Math.round(Math.min(1, k * a) * 1000) / 1000})`;
  return [
    `linear-gradient(to right`,
    `${c(1.2)} 0`,
    `${c(1)} 20vw`,
    `${c(0.78)} 28vw`,
    `${c(0.5)} 34vw`,
    `${c(0.26)} 39vw`,
    `${c(0.1)} 43vw`,
    `transparent 46vw)`,
  ].join(", ");
}

/**
 * Legibility scrims under the captions: a bottom band on phones, an optional left band on desktop.
 *
 * Seams with the hold panels (HoldPanel): the phone band is always on, so every stage ends on solid
 * night at its bottom edge, which is where the panel after it starts; the left band is feathered out
 * at the stage's top and bottom (captions sit in the middle), so a stage's edges are always the bare
 * frame on desktop.
 */
export function FilmScrims({ left = false, leftIn = null, leftFade = null, leftAlpha = 0.65 }: Props) {
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
        // Holds the peak alpha across the caption column (to 20 vw, where K0–K3's haze is brightest),
        // then eases out before the drafting lines / cranes begin around x ≈ 0.35 of the frame.
        <motion.div
          style={{ opacity: leftOpacity, backgroundImage: leftBand(leftAlpha) }}
          className="absolute inset-y-0 left-0 hidden w-[46vw] [mask-image:linear-gradient(to_bottom,transparent,#000_15%,#000_85%,transparent)] wide:block"
        />
      ) : null}
    </div>
  );
}

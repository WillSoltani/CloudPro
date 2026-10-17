"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { useFilmProgress } from "@/components/film/filmProgress";
import { HERO_BEATS } from "@/components/film/heroBeats";

const LAMP = "#f0a63c";
const SLATE = "#64748b";

/** The numbered caption windows of the hero (heroBeats.ts, shared with BeaconCaptions); a tick at each start. */
const TICKS = HERO_BEATS.flatMap((b) =>
  b.kind === "caption" && b.n ? [{ n: b.n, from: b.from, to: b.to }] : [],
);

function Tick({
  progress,
  n,
  from,
  to,
}: {
  progress: MotionValue<number>;
  n: string;
  from: number;
  to: number;
}) {
  // Lit in lamp while its beat plays, slate otherwise, with a short ramp either side.
  const color = useTransform(
    progress,
    [from - 0.02, from, to, Math.min(1.001, to + 0.02)],
    [SLATE, LAMP, LAMP, to >= 1 ? LAMP : SLATE],
  );
  return (
    <motion.div
      className="absolute right-0 flex -translate-y-1/2 items-center gap-2.5"
      style={{ top: `${from * 100}%`, color }}
    >
      <span className="font-mono text-[10px] leading-none tracking-[0.22em]">{n}</span>
      <span className="h-px w-2 bg-current opacity-70" />
    </motion.div>
  );
}

/**
 * The lighthouse's progress: a hairline on the right that fills in amber as the film plays,
 * a 7 px lamp riding the fill, and one tick per numbered beat (none for the rack hero). Desktop only;
 * leaves with the film.
 */
export function TickRail() {
  const progress = useFilmProgress();
  const opacity = useTransform(progress, [0.9, 0.98], [1, 0]);
  const lampTop = useTransform(progress, (p) => `${p * 100}%`);

  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 right-6 hidden h-[min(44svh,26rem)] w-px -translate-y-1/2 bg-white/15 wide:block xl:right-10"
      style={{ opacity }}
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-full origin-top bg-lamp"
        style={{ scaleY: progress }}
      />
      {TICKS.map((t) => (
        <Tick key={t.n} progress={progress} n={t.n} from={t.from} to={t.to} />
      ))}
      <motion.div
        className="absolute -left-[3px] h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-lamp shadow-[0_0_10px_2px_rgba(240,166,60,0.55)]"
        style={{ top: lampTop }}
      />
    </motion.div>
  );
}

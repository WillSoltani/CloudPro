"use client";

import type { ReactNode } from "react";
import { motion, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/components/film/filmCore";
import { useFilmProgress } from "@/components/film/filmProgress";

/**
 * HTML caption that fades and drifts across [from, to] of the segment's progress. While faded out it
 * is also `visibility: hidden` (unfocusable, out of the accessibility tree) unless `persistent`.
 */
export function FilmCaption({
  from,
  to,
  persistent = false,
  className,
  children,
}: {
  from: number;
  to: number;
  /** Keep the block in the accessibility tree when faded out (e.g. the page's h1). */
  persistent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const progress = useFilmProgress();
  const reduced = useReducedMotionSafe();
  const fade = Math.min(0.05, (to - from) / 4);
  const opacity = useTransform(
    progress,
    [from, from + fade, to - fade, to],
    [from <= 0 ? 1 : 0, 1, 1, to >= 1 ? 1 : 0],
  );
  const drift = reduced ? 0 : 24;
  const y = useTransform(progress, [from, to], [from <= 0 ? 0 : drift, to >= 1 ? 0 : -drift]);
  const visibility = useTransform(opacity, (o) =>
    persistent || o > 0.001 ? "visible" : "hidden",
  );
  return (
    <motion.div style={{ opacity, y, visibility }} className={className}>
      {children}
    </motion.div>
  );
}

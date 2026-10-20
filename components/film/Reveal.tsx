"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/components/film/filmCore";
import type { FrameWindow } from "@/components/film/choreo";
import { useChapter } from "@/components/film/chapterContext";

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * The reveal curve: 0 up to `a`, ease-out cubic to 1 at `b`, 1 after. Shared with the plate's hand-off
 * (alpha = 1 − revealAt(frame, h2 window)) so the crossfade has one writer.
 */
export function revealAt(v: number, [a, b]: FrameWindow): number {
  if (v <= a) return 0;
  if (v >= b) return 1;
  // Snap the last 0.05 %: a window ending on a frame the scroll lands a hair short of still ends at exactly
  // opacity 1 with an identity transform.
  const t = easeOutCubic((v - a) / (b - a));
  return t > 0.9995 ? 1 : t;
}

const TAGS = { div: motion.div, li: motion.li, p: motion.p, span: motion.span } as const;

/**
 * One element of a chapter's composition arriving with the film (part five §2c): opacity 0→1 and
 * y `y`→0 px (ease-out cubic) over the window `at` = [f0, f1] in the chapter's smoothed film frames,
 * `tail` = [τa, τb] in its tail fraction, or `pin` = [a, b] in fractions of its read pin (τ = pin·τ_read,
 * so a window keeps its place in the pin whatever the body's height). Pure functions of the clock, so
 * scrolling back reverses them.
 *
 * - SSR and hydration: the chapter's `frame` starts at its last frame, so the server HTML is fully
 *   revealed (no-JS, SEO, a deep link's first paint).
 * - Reduced motion: all or nothing — visible exactly when the chapter is on its end still.
 * - `[data-reveal]:focus-within` (app/globals.css) forces it visible, so a focused link never sits at 0.
 * - Pointer events follow the reveal (the composition box is `pointer-events: none`).
 * - Test hooks: `data-reveal`, and the window as `data-at` / `data-tail` / `data-pin` ("a,b"); a `passive`
 *   layer (a tone: no pointer events, aria-hidden) carries its frame window as `data-tone-at` instead, so
 *   content checks (revealed items take pointer events) do not count it.
 */
export function Reveal({
  at: atFrames,
  tail,
  pin: pinWindow,
  stackedPin,
  y = 10,
  passive = false,
  as = "div",
  className,
  style,
  children,
  ...rest
}: {
  at?: FrameWindow;
  tail?: FrameWindow;
  pin?: FrameWindow;
  /** On a stacked composition (phones), this read-pin window replaces `at` and `pin` (choreo `stacked`). */
  stackedPin?: FrameWindow;
  /** Rise in px (0 for the h2, whose box is the plate's landing target). */
  y?: number;
  /** Never take pointer events (a tone layer). */
  passive?: boolean;
  as?: keyof typeof TAGS;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & { "aria-hidden"?: "true" } & Record<`data-${string}`, string | undefined>) {
  const ch = useChapter();
  const { end, reduced } = ch;
  const restack = ch.stacked && !!stackedPin;
  const at = restack ? undefined : atFrames;
  const pin = restack ? stackedPin : pinWindow;
  // Reduced motion keys every element to the end still; otherwise frames (`at`), the tail (`tail`) or
  // the read pin (`pin`, scaled by τ_read).
  const source = reduced || at ? ch.frame : ch.tau;
  const win: FrameWindow = at ?? tail ?? pin ?? [0, 0];
  const scaled = !reduced && !at && !tail && !!pin;
  const shown = useTransform([source, ch.tauRead], ([v, r]: number[]) =>
    reduced
      ? v >= end - 0.5
        ? 1
        : 0
      : revealAt(v, scaled ? [win[0] * r, win[1] * r] : win),
  );
  // Under reduced motion nothing rises: hidden and shown alike sit at an identity transform.
  const rise = useTransform(shown, (v: number) => (reduced ? 0 : (1 - v) * y));
  const pointerEvents = useTransform(shown, (v: number) => (v > 0.5 ? "auto" : "none"));
  const Tag = TAGS[as] as typeof motion.div;
  return (
    <Tag
      data-reveal=""
      data-at={at && !passive ? at.join(",") : undefined}
      data-tone-at={at && passive ? at.join(",") : undefined}
      data-tail={tail ? tail.join(",") : undefined}
      data-pin={pin && !at && !tail ? pin.join(",") : undefined}
      className={className}
      style={{ ...style, opacity: shown, y: rise, pointerEvents: passive ? "none" : pointerEvents }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * A flow item below a composition's fold (a chapter's body): it fades in on raw scroll (DOM to DOM, no
 * film lag) as its top rises through the bottom 18 % of the viewport, 10 px rise, ease-out cubic. Fully
 * visible on the server, under reduced motion and when it holds focus.
 */
export function FlowReveal({
  as = "div",
  className,
  children,
}: {
  as?: "div" | "li";
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotionSafe();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const vh = window.innerHeight;
      // The untransformed top: subtract the rise actually rendered (read from the computed style, since
      // `[data-reveal]:focus-within` may override it), so the ramp follows the scroll, not the last value.
      const tr = getComputedStyle(el).transform;
      const ty = tr === "none" ? 0 : new DOMMatrixReadOnly(tr).m42;
      const t = Math.min(1, Math.max(0, (vh - (el.getBoundingClientRect().top - ty)) / (0.18 * vh)));
      const o = easeOutCubic(t);
      el.style.opacity = String(+o.toFixed(3));
      el.style.transform = o >= 1 ? "" : `translateY(${((1 - o) * 10).toFixed(2)}px)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.style.opacity = "";
      el.style.transform = "";
    };
  }, [reduced]);
  const Tag = as;
  return (
    <Tag ref={ref as never} data-reveal="" data-flow="" className={className}>
      {children}
    </Tag>
  );
}

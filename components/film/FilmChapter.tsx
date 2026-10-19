"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useReducedMotionSafe, type FilmEntry } from "@/components/film/filmCore";
import { WIDE_QUERY } from "@/components/film/filmBase";
import { REEL_FOCUS, type SegmentRegistration } from "@/components/film/FilmBackdrop";
import { useSegmentRegistration } from "@/components/film/useSegmentRegistration";
import { useRackPlatesOn } from "@/components/film/RackPlate";
import { ChapterContext, type ChapterContextValue } from "@/components/film/chapterContext";
import type { ChapterChoreo } from "@/components/film/choreo";
import { FILM_ASPECT, framePoint, frameVars } from "@/components/film/frameBox";
import { BODY_MASK, BODY_MASK_BOTTOM, bodyTone, halo, toneOf } from "@/components/film/tones";

/**
 * The deep-link anchor sits this far below the move's end: html's scroll-padding-top (app/globals.css),
 * plus 1 px so a fragment jump (which lands on a whole px) is never a fraction short of camera rest.
 */
const ANCHOR_PADDING = 88;
const ANCHOR_OFFSET = ANCHOR_PADDING + 1;
/** Content closer than this to the viewport edge fails the fit guard. */
const FIT_EDGE = 24;
/** A row (FrameRows) further than this share of the frame height from its band fails the fit guard. */
const ROW_DRIFT = 0.02;
/**
 * Stacked compositions taller than the viewport: during the read pin the composition lifts by its overflow
 * (smoothstep over the first LIFT_BY of the pin), so its last line ends LIFT_CLEAR px above the bottom
 * edge; until then a FEATHER_PX feather at the bottom edge fades any line the edge would cut.
 */
const LIFT_BY = 0.6;
const LIFT_CLEAR = 32;
const FEATHER_PX = 72;

const COMPOSE_STYLE = frameVars(REEL_FOCUS) as CSSProperties;

/**
 * One section of the homepage as a chapter of the film (part five §2b): the element that carries its film's
 * camera move AND its content. The film's frames drive the composition; nothing scrolls in as a plain
 * block.
 *
 *   div[data-chapter]
 *     the plate (a fixed sibling outside the sticky box, so it paints with the canvas)
 *     section[data-film-segment][aria-labelledby=<id>-title]
 *       span#<id>[data-anchor]  absolute at moveVh·100svh + 88 px: deep links, skip links and the nav land
 *                               at camera rest (scrollY = section top + m, frame M, the hold key)
 *       div[data-compose]       sticky, min-h-svh, container-type: inline-size, pointer-events: none (revealed
 *                               items turn theirs on); the frame variables (frameBox) and the content
 *       div aria-hidden         spacer (moveVh + readVh)·100svh: the box stays pinned through the move and the
 *                               read pin, then releases; content taller than a viewport enters on release
 *
 * The backdrop clock treats the move as `moveVh` and everything after it (read pin, release, body) as the
 * tail, so `frame` (smoothed) runs 0 → M over the move and the composition's Reveals key to it.
 *
 * `join`: the chapter starts where the previous segment's move ends (`margin-top: −100svh`), so there is
 * no hold between them (hero → About, the exit → the bridge); the previous stage rides out under this
 * chapter's first viewport (the composition box is transparent to the pointer, so the hero's CTA stays
 * clickable). `body`: content after the framed composition, below the fold during the pin, entering on
 * release over the body tone (a light centre tone with a 160 px eased top mask). Focus
 * moving into the chapter before `headAt` (raw frame) scrolls to the anchor, so Tab lands on a revealed
 * hold. A fit guard flips `data-compose-mode="stacked"` when the framed layout would overflow the viewport
 * or come within 24 px of its edges (app/globals.css then lays it out as on phones).
 */
export function FilmChapter({
  film,
  id,
  moveVh,
  choreo,
  section,
  reducedSteps = 3,
  tail,
  breath,
  plate,
  join = false,
  dissolveIn,
  body,
  children,
}: {
  /** The reel entry (components/film/reel.ts REEL), the same object the backdrop holds. */
  film: FilmEntry;
  /** The section id: the anchor's id (`#certifications`), the h2 is `${id}-title`. */
  id: string;
  /** The camera move in viewport heights (reel.ts moveVhOf: segment frames / pace). */
  moveVh: number;
  /** The chapter's windows (components/film/choreo.ts). */
  choreo: ChapterChoreo;
  /** The nav section (active from the unit's amber frame, `choreo.amber`). */
  section: string;
  reducedSteps?: number;
  /** Rendered breathing-tail frames (renderer §2e; reel.ts tailOf). A module constant. */
  tail?: SegmentRegistration["tail"];
  /**
   * The key layer's breath wherever no tail frames play (the tower; the rack's fallback paths). A module
   * constant.
   */
  breath?: SegmentRegistration["breath"];
  /** The section's plate (RackPlate with `handoff`); rendered only where plates draw. */
  plate?: ReactNode;
  /** Start where the previous segment's move ends (no hold between them). */
  join?: boolean;
  /** The crossfade out of the previous hold key over this share of the move (FilmSegment `dissolveIn`). */
  dissolveIn?: number;
  /** Flow content after the framed composition (it enters on release over the body tone). */
  body?: ReactNode;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionSafe();
  const platesOn = useRackPlatesOn();
  const lastFrame = film.landscape.count - 1;
  // The tones' colour: RACK_NIGHT on the rack, NIGHT on the tower (tones.ts).
  const tone = toneOf(choreo.film);
  const haloStyle = { "--halo": halo(tone) } as CSSProperties;
  const seg = useSegmentRegistration(film, sectionRef, {
    reducedSteps,
    moveVh,
    readVh: choreo.readVh,
    tail,
    breath,
    section,
    activeFrom: choreo.activeFrom ?? choreo.amber,
    dissolveIn,
    initialFrame: lastFrame,
    initialTau: 1,
  });
  const end = tail ? tail.from : seg.manifest.count - 1;
  const { index, frame, progress, tau, tauRead } = seg;

  // The stacked lift (LIFT_BY): the composition's overflow and the viewport height, from the fit guard.
  const [stacked, setStacked] = useState(false);
  const overflow = useMotionValue(0);
  const viewH = useMotionValue(0);
  const lift = useTransform([tau, tauRead, overflow], ([t, r, o]: number[]) => {
    if (!o || reduced) return 0;
    const x = Math.min(1, Math.max(0, r > 0 ? t / r / LIFT_BY : 1));
    return x * x * (3 - 2 * x);
  });
  const liftY = useTransform([lift, overflow], ([s, o]: number[]) => -o * s);
  // The feather rides at the viewport's bottom edge while the composition lifts, and leaves below it as the
  // lift completes (by then the last line is LIFT_CLEAR px above the edge).
  const feather = useTransform([lift, overflow, viewH], ([s, o, vh]: number[]) => {
    if (!o || s >= 1) return "none";
    const end = vh + (o + FEATHER_PX) * s;
    return `linear-gradient(to bottom, #000 ${(end - FEATHER_PX).toFixed(1)}px, transparent ${end.toFixed(1)}px)`;
  });

  const ctx = useMemo<ChapterContextValue>(
    () => ({
      id,
      index,
      frame,
      progress,
      tau,
      tauRead,
      end,
      choreo,
      head: platesOn ? choreo.head.plate : choreo.head.noPlate,
      reduced,
      platesOn,
      stacked,
      sectionRef,
      composeRef,
      // The raw (unsmoothed) move frame, from the DOM: what the plate snaps to on a jump.
      rawFrame: () => {
        const el = sectionRef.current;
        const anchor = anchorRef.current;
        if (!el || !anchor) return 0;
        const m = anchor.offsetTop - ANCHOR_OFFSET;
        const y = -el.getBoundingClientRect().top;
        return m > 0 ? Math.min(1, Math.max(0, y / m)) * end : end;
      },
    }),
    [id, index, frame, progress, tau, tauRead, end, choreo, platesOn, reduced, stacked],
  );

  // The fit guard (framed layout only exists where the `wide` rule holds).
  useEffect(() => {
    const el = composeRef.current;
    if (!el) return;
    const wide = window.matchMedia(WIDE_QUERY);
    const area = el.querySelector<HTMLElement>("[data-frame-area]") ?? el;
    // Stacked: how far the composition's last band runs past the viewport's bottom edge (less LIFT_CLEAR).
    const measureLift = () => {
      const isStacked = !wide.matches || el.dataset.composeMode === "stacked";
      const bands = area.querySelectorAll(":scope > [data-band]");
      const last = bands[bands.length - 1];
      const vh = window.innerHeight;
      const bottom = last ? last.getBoundingClientRect().bottom - area.getBoundingClientRect().top : 0;
      setStacked(isStacked);
      viewH.set(vh);
      overflow.set(isStacked ? Math.max(0, Math.round(bottom - (vh - LIFT_CLEAR))) : 0);
    };
    const check = () => {
      el.dataset.composeMode = "auto";
      if (!wide.matches) return measureLift();
      const vw = el.clientWidth;
      // The framed part must fit the viewport (a body below it is meant to overflow).
      let fits = area.scrollHeight <= window.innerHeight + 1;
      if (fits) {
        const vh = window.innerHeight;
        const fh = Math.max(vw, vh * FILM_ASPECT.landscape) / FILM_ASPECT.landscape;
        const top = el.getBoundingClientRect().top;
        for (const item of el.querySelectorAll<HTMLElement>("[data-fit]")) {
          const r = item.getBoundingClientRect();
          if (r.left < FIT_EDGE - 0.5 || r.right > vw - FIT_EDGE + 0.5) {
            fits = false;
            break;
          }
          // A row pushed off its band (its head overflowed) no longer sits on the frame: stack instead.
          const y = item.dataset.rowY;
          if (y !== undefined) {
            const band = framePoint(vw, vh, FILM_ASPECT.landscape, REEL_FOCUS, [0.5, Number(y)])[1];
            if (Math.abs((r.top + r.bottom) / 2 - top - band) > ROW_DRIFT * fh + 0.5) {
              fits = false;
              break;
            }
          }
        }
      }
      if (!fits) el.dataset.composeMode = "stacked";
      measureLift();
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    wide.addEventListener("change", check);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", check);
      window.removeEventListener("resize", check);
    };
  }, [overflow, viewH]);

  // Keyboard focus always lands in view, between the header's clearance and FIT_EDGE above the bottom:
  // - into the composition before its heading has arrived, or onto an item out of view: the revealed hold
  //   (the anchor); stacked, an item the bottom feather would cover at rest goes on to the end of the lift;
  // - onto the body (it enters on release, below the pinned composition): scrolled to the nearest edge.
  const focusRaf = useRef(0);
  const focusTarget = useRef<HTMLElement | null>(null);
  useEffect(() => () => cancelAnimationFrame(focusRaf.current), []);
  const onFocusCapture = (e: FocusEvent<HTMLElement>) => {
    focusTarget.current = e.target instanceof HTMLElement ? e.target : null;
    if (focusRaf.current) return;
    // After the browser's own focus scroll, so the position read is the one the viewer will see.
    focusRaf.current = requestAnimationFrame(() => {
      focusRaf.current = 0;
      const el = sectionRef.current;
      const anchor = anchorRef.current;
      const target = focusTarget.current;
      if (!el || !anchor || !target) return;
      const top = ANCHOR_PADDING;
      const bottom = () => window.innerHeight - FIT_EDGE;
      // Where the target sits once the stacked lift is complete (0 framed).
      const liftLeft = () => overflow.get() + liftY.get();
      if (target.closest("[data-body]")) {
        // Scroll by the difference until it is in view: a pinned composition does not move with the scroll,
        // so the first steps may only use up the read pin before the body starts to rise.
        for (let k = 0; k < 24; k++) {
          const r = target.getBoundingClientRect();
          const t = r.top - liftLeft();
          const b = r.bottom - liftLeft();
          const d = t < top ? t - top : b > bottom() ? Math.min(b - bottom(), t - top) : 0;
          const before = window.scrollY;
          if (Math.abs(d) < 1) break;
          window.scrollBy({ top: d, behavior: "instant" });
          if (window.scrollY === before) break;
        }
        return;
      }
      const m = anchor.offsetTop - ANCHOR_OFFSET;
      const y = -el.getBoundingClientRect().top;
      const raw = m > 0 ? Math.min(1, Math.max(0, y / m)) * end : end;
      const r = target.getBoundingClientRect();
      if (!(y < 0 || raw < choreo.headAt || r.top < top || r.bottom > bottom())) return;
      anchor.scrollIntoView({ block: "start", behavior: "instant" });
      // Stacked: at rest the bottom feather would cover it, so on to the end of the lift (the read pin's
      // LIFT_BY; the svh from the move: m = moveVh·100svh).
      if (overflow.get() > 0 && moveVh > 0) {
        const atRest = target.getBoundingClientRect().bottom - liftY.get();
        if (atRest > window.innerHeight - FEATHER_PX) {
          const rest = el.getBoundingClientRect().top + window.scrollY + m;
          const readPx = choreo.readVh * (m / moveVh);
          window.scrollTo({ top: Math.round(rest + LIFT_BY * readPx), behavior: "instant" });
        }
      }
    });
  };

  return (
    <ChapterContext.Provider value={ctx}>
      {/* Transparent to the pointer (what lies under a chapter, e.g. the hero's CTA riding out under About,
          stays clickable); revealed items and the body turn their own pointer events back on. */}
      <div
        data-chapter={id}
        className={join ? "pointer-events-none relative -mt-[100svh]" : "pointer-events-none relative"}
      >
        {platesOn ? plate : null}
        <section
          ref={sectionRef}
          aria-labelledby={`${id}-title`}
          data-film={seg.manifest.name}
          data-count={seg.manifest.count}
          data-film-segment=""
          data-index={index}
          className="relative"
          onFocusCapture={onFocusCapture}
        >
          <span
            ref={anchorRef}
            id={id}
            data-anchor=""
            className="pointer-events-none absolute left-0 h-px w-px"
            style={{ top: `calc(${+(moveVh * 100).toFixed(4)}svh + ${ANCHOR_OFFSET}px)` }}
          />
          <motion.div
            ref={composeRef}
            data-compose=""
            data-compose-mode="auto"
            className="pointer-events-none sticky top-0 min-h-svh w-full [container-type:inline-size]"
            style={{ ...COMPOSE_STYLE, ...haloStyle, y: liftY }}
          >
            <motion.div data-frame-area="" className="relative flow-root min-h-svh" style={{ maskImage: feather }}>
              {children}
            </motion.div>
            {body ? (
              <div
                data-body=""
                className="pointer-events-auto relative pt-24 pb-40 wide:pt-40"
                style={
                  {
                    "--body-tone": bodyTone(undefined, undefined, tone),
                    "--body-flat": `rgb(${tone} / 0.85)`,
                    "--body-mask": BODY_MASK,
                    "--body-mask-bottom": BODY_MASK_BOTTOM,
                  } as CSSProperties
                }
              >
                {body}
              </div>
            ) : null}
          </motion.div>
          <div aria-hidden style={{ height: `${+((moveVh + choreo.readVh) * 100).toFixed(4)}svh` }} />
        </section>
      </div>
    </ChapterContext.Provider>
  );
}

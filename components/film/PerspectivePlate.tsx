"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { MotionValue } from "framer-motion";
import { LAYER_HEIGHT_CLASS, placement } from "@/components/film/placement";
import { filmViewport, subscribeFilmViewport } from "@/components/film/viewport";
import { useReducedMotionSafe } from "@/components/film/filmCore";
import { matrix3dFor, projectCorners, squareToQuad } from "@/components/film/homography";
import { REEL_FOCUS, useFilmBackdrop } from "@/components/film/FilmBackdrop";
import type { FrameWindow } from "@/components/film/choreo";
import { revealAt } from "@/components/film/Reveal";
import { subscribeScroll } from "@/components/film/scrollHub";
import { overlayFrame } from "@/components/film/overlayFrame";
import type { OverlayJob } from "@/components/film/overlayScheduler";
import {
  createFaceWriter,
  createRestHint,
  flightQuad,
  HIDDEN,
  liftFrameOf,
  mayBeReleased,
  trackRow,
  type PlateFace,
} from "@/components/film/plateFace";

/**
 * A plate's track for one camera, one row per film frame (exported by the renderer, e.g.
 * components/film/plates/<film>.json). `corners[k]` is x0, y0, x1, y1, x2, y2, x3, y3 in fractions of the
 * frame, top-left origin, in screen order top-left, top-right, bottom-right, bottom-left; `alpha[k]` is
 * the plate's opacity at frame k (0 where a corner is behind the camera, the face turns away or the well
 * is occluded). `count` ≥ the film's frame count reads row k at frame k (the export pads tail rows after
 * the move); a shorter track maps proportionally.
 */
export type PlateTrack = {
  count: number;
  corners: number[][];
  alpha: number[];
};

/**
 * The plate's hand-off to the live heading (part five §2d): after `lift` (the track's last opaque frame)
 * the plate leaves the metal and flies, corner by corner, to the `[data-plate-target]` box in the h2,
 * landing at `land`; its alpha is 1 − the h2's reveal so the crossfade has one writer.
 */
export type PlateHandoff = {
  /** The chapter's smoothed film frame (float): the flight's clock. */
  frame: MotionValue<number>;
  /** The frame the flight lands on (the h2 window's start). */
  land: number;
  /** The h2's reveal window (Reveal `at`); the plate's alpha is 1 − revealAt(frame, h2). */
  h2: FrameWindow;
  /** The live landing box, read on every apply. */
  target: () => HTMLElement | null;
  /** The pinned composition box: once it leaves its pinned top by > 1 px the flight completes at once. */
  pinned: () => HTMLElement | null;
  /** The raw (unsmoothed) frame: when the smoothed clock trails it by more than SNAP_FRAMES (a jump) the flight completes at once. */
  raw?: () => number;
  /**
   * The move's last frame M: the composition cannot have left its pin before the raw frame reaches it, so until then
   * `pinned` is not read. Without it (or without `raw`) the pin is read on every run.
   */
  end?: number;
};

/** A jump: the smoothed clock trailing the raw frame by more than this snaps the flight onto its target. */
const SNAP_FRAMES = 8;

/** The last frame of the track's opaque run (alpha ≥ 0.99), or −1: where a hand-off lifts off. */
export function liftOf(track: PlateTrack): number {
  let last = -1;
  track.alpha.forEach((a, k) => {
    if (a >= 0.99) last = k;
  });
  return last;
}

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

type Props = {
  /** The segment (reel index) whose frames carry the plate; hidden whenever another segment is painted. */
  index: number;
  /** The track for the landscape film. */
  track: PlateTrack;
  /** The track for the entry's portrait film; without it nothing shows while the portrait film plays. */
  portraitTrack?: PlateTrack;
  /** Intrinsic size [w0, h0] in px of the plate element, laid out unscaled; keep it large for crisp text. */
  box: readonly [number, number];
  /** Classes for the plate element (the w0 × h0 box the content is laid out in). */
  className?: string;
  /** Fly to the chapter's heading after the track's opaque run (a stable object). */
  handoff?: PlateHandoff;
  children: ReactNode;
};

const noSubscribe = () => () => {};
const saveDataOn = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const onClient = () => true;
const onServer = () => false;

/**
 * HTML pinned onto a quad in the film, in true perspective: a `fixed inset-0 -z-10` layer as tall as the large
 * viewport (the canvas's own box, painted with the canvas and the hold keys, under every panel, scrim and caption)
 * holding one `box`-sized element with `transform-origin: 0 0`, whose `transform` is
 *   matrix3dFor(squareToQuad(projectCorners(corners[frame], placement(layer w, layer h, svh, aspect, REEL_FOCUS))), w0, h0)
 * (placement.ts: where the canvas paints the frame) and whose opacity is `alpha[frame]`, written straight to the DOM
 * (no React renders) whenever the backdrop's `drawnSegment`/`drawnFrame` change, the layer resizes or the film
 * viewport changes (viewport.ts; a toolbar move alone is none of these). `frame` is the frame actually on the
 * canvas, not the scroll target, so the plate never runs ahead of the picture while coarse passes land.
 *
 * Per animation frame (stage 8): the triggers (the painted segment, the painted frame, the chapter's clock, the scroll
 * in flight) only invalidate the plate; it is computed once, in the frame the canvas paints the picture it belongs to
 * (overlayFrame.ts: the frame loop's pre-render step after the clock's tick, or a microtask after a paint outside it),
 * with its layout reads before any overlay's writes. Before the flight it reads only the section's top (the raw frame);
 * in flight the h2's box too, and the composition's top once the raw frame is at camera rest. It writes only what
 * changed (plateFace.ts createFaceWriter) and carries `will-change: transform` only while it moves.
 *
 * Render it outside any sticky stage or transformed ancestor (FilmChapter `plate`), since both would
 * break `fixed` or lift it above the panels. Decorative: `aria-hidden` (the section's real heading stays
 * in HTML). Nothing renders on the server, under prefers-reduced-motion or under Save-Data.
 *
 * Test hooks: layer `data-perspective-plate` (= index) and `data-plate-frame` (the track row applied, −1
 * while hidden); the plate element `data-plate`.
 */
export function PerspectivePlate({
  index,
  track,
  portraitTrack,
  box,
  className,
  handoff,
  children,
}: Props) {
  const backdrop = useFilmBackdrop();
  const reduced = useReducedMotionSafe();
  const saveData = useSyncExternalStore(noSubscribe, saveDataOn, onServer);
  const mounted = useSyncExternalStore(noSubscribe, onClient, onServer);
  const off = !mounted || reduced || saveData;
  const layerRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const [w0, h0] = box;

  useEffect(() => {
    const layer = layerRef.current;
    const plate = plateRef.current;
    const entry = backdrop.reel[index];
    const film = backdrop.manifestAt(index);
    if (off || !layer || !plate || !entry || !film) return;
    const t = film === entry.portrait ? portraitTrack : track;
    const { drawnSegment, drawnFrame } = backdrop;
    // The layer's box and the stage, read on a resize (never per frame): where the canvas paints the frame.
    const layerBox = { w: 0, h: 0, svh: 0 };
    const measureLayer = () => {
      layerBox.w = layer.clientWidth;
      layerBox.h = layer.clientHeight;
      layerBox.svh = filmViewport().svh;
    };
    const placed = () => {
      if (!layerBox.w) measureLayer();
      return placement(layerBox.w, layerBox.h, layerBox.svh, film.aspect, REEL_FOCUS);
    };
    // The hand-off's lift, as a track row and as a film frame.
    const liftRow = t && handoff ? liftOf(t) : -1;
    const liftFrame = t ? liftFrameOf(liftRow, t.count, film.count) : liftRow;

    // The layer hint while the plate moves (plateFace.ts createRestHint), and the writer that sets only what changed.
    const hint = createRestHint({
      set: (on) => {
        plate.style.willChange = on ? "transform" : "";
      },
      now: () => performance.now(),
      later: (fn, ms) => window.setTimeout(fn, ms),
      clear: (handle) => window.clearTimeout(handle as number),
    });
    const write = createFaceWriter(layer, plate, hint);

    // The flight: the track quad at lift → the target box, smootherstep on the smoothed clock; `snap`
    // completes it at once (released, or a jump the smoothed clock has not caught up with yet).
    const fly = (f: number, snap: boolean): PlateFace => {
      const target = handoff?.target();
      if (!t || !handoff || !target) return HIDDEN;
      const alpha = 1 - revealAt(f, handoff.h2);
      if (!(alpha > 0.001)) return HIDDEN;
      // The plate layer is fixed at the viewport's origin: the target's client box is in the layer's own px.
      const box = target.getBoundingClientRect();
      const span = Math.max(1, handoff.land - liftFrame);
      const s = snap ? 1 : smootherstep(Math.min(1, Math.max(0, (f - liftFrame) / span)));
      const quad = flightQuad(projectCorners(t.corners[liftRow], placed()), box, s);
      const css = matrix3dFor(squareToQuad(quad), w0, h0);
      if (css === "none") return HIDDEN;
      return { shown: true, transform: css, opacity: String(Math.min(1, alpha)), row: liftRow, flight: s.toFixed(3) };
    };

    // What the plate shows for the painted frame (and, in flight, the clock and the page): every layout read happens
    // here, in the flush's read phase, before any overlay writes (overlayScheduler.ts).
    const face = (): PlateFace => {
      const frame = drawnFrame.get();
      if (!t || drawnSegment.get() !== index || frame < 0) return HIDDEN;
      if (handoff && liftRow >= 0) {
        const f = handoff.frame.get();
        // The release guard first: once the composition scrolls off its pin the plate belongs to the heading whatever
        // the smoothed clock says (a flick past the pin). The pin can only have released at or past camera rest, so
        // before that only the raw frame is read.
        const raw = handoff.raw?.();
        const pinned = mayBeReleased(raw, handoff.end) ? handoff.pinned() : null;
        const released = !!pinned && pinned.getBoundingClientRect().top < -1;
        const leap = raw !== undefined && raw >= liftFrame && raw - f > SNAP_FRAMES;
        if (released || leap) return fly(f, true);
        if (f >= liftFrame) return fly(f, false);
      }
      const k = trackRow(frame, t.count, film.count);
      const corners = t.corners[k];
      const alpha = t.alpha[k] ?? 0;
      if (!corners || corners.length !== 8 || !(alpha > 0)) return { shown: false, flight: null };
      const css = matrix3dFor(squareToQuad(projectCorners(corners, placed())), w0, h0);
      if (css === "none") return { shown: false, flight: null };
      return { shown: true, transform: css, opacity: String(Math.min(1, alpha)), row: k, flight: null };
    };

    // One run per animation frame whichever of the four triggers fired, in the frame the canvas paints (overlayFrame).
    let next: PlateFace = HIDDEN;
    const job: OverlayJob = {
      name: `plate:${index}`,
      read: () => {
        next = face();
      },
      write: () => write(next),
    };
    const apply = () => overlayFrame.invalidate(job);
    const offSegment = drawnSegment.on("change", apply);
    const offFrame = drawnFrame.on("change", apply);
    // The flight follows the chapter's clock and its live target (the release moves it with the scroll).
    const offClock = handoff?.frame.on("change", apply);
    const onScroll = () => overlayFrame.defer(job);
    const offScroll = handoff ? subscribeScroll(onScroll) : undefined;
    const relayout = () => {
      measureLayer();
      apply();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(layer);
    const offViewport = subscribeFilmViewport(relayout);
    apply();
    return () => {
      offSegment();
      offFrame();
      offClock?.();
      offScroll?.();
      ro.disconnect();
      offViewport();
      overlayFrame.cancel(job);
      hint.off();
    };
  }, [backdrop, index, track, portraitTrack, off, w0, h0, handoff]);

  if (off) return null;
  return (
    <div
      ref={layerRef}
      aria-hidden
      data-perspective-plate={index}
      data-plate-frame="-1"
      className={`pointer-events-none fixed inset-0 -z-10 w-full overflow-hidden ${LAYER_HEIGHT_CLASS}`}
    >
      <div
        ref={plateRef}
        data-plate=""
        className={["absolute top-0 left-0", className].filter(Boolean).join(" ")}
        style={{
          width: w0,
          height: h0,
          transformOrigin: "0 0",
          backfaceVisibility: "hidden",
          visibility: "hidden",
          opacity: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

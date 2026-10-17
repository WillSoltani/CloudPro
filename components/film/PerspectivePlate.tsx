"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { MotionValue } from "framer-motion";
import { coverRect } from "@/components/film/filmBase";
import { useReducedMotionSafe } from "@/components/film/filmCore";
import { matrix3dFor, projectCorners, squareToQuad } from "@/components/film/homography";
import { REEL_FOCUS, useFilmBackdrop } from "@/components/film/FilmBackdrop";
import type { FrameWindow } from "@/components/film/choreo";
import { revealAt } from "@/components/film/Reveal";

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
 * HTML pinned onto a quad in the film, in true perspective: a `fixed inset-0 -z-10 h-dvh` layer (the
 * canvas's own box, painted with the canvas and the hold keys, under every panel, scrim and caption)
 * holding one `box`-sized element with `transform-origin: 0 0`, whose `transform` is
 *   matrix3dFor(squareToQuad(projectCorners(corners[frame], coverRect(layer w, layer h, aspect, REEL_FOCUS))), w0, h0)
 * and whose opacity is `alpha[frame]`, written straight to the DOM (no React renders) whenever the
 * backdrop's `drawnSegment`/`drawnFrame` change or the layer resizes. `frame` is the frame actually on the
 * canvas, not the scroll target, so the plate never runs ahead of the picture while coarse passes land.
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
    let shown = -2;
    // The hand-off's lift, as a track row and as a film frame.
    const liftRow = t && handoff ? liftOf(t) : -1;
    const liftFrame =
      !t || liftRow < 0 || t.count >= film.count || t.count < 2
        ? liftRow
        : Math.round((liftRow * (film.count - 1)) / (t.count - 1));

    const hide = () => {
      if (shown === -1) return;
      shown = -1;
      plate.style.visibility = "hidden";
      plate.style.opacity = "0";
      layer.dataset.plateFrame = "-1";
    };

    // The flight: the track quad at lift → the target box, smootherstep on the smoothed clock; `snap`
    // completes it at once (released, or a jump the smoothed clock has not caught up with yet).
    const fly = (f: number, snap: boolean) => {
      const target = handoff?.target();
      if (!t || !handoff || !target) return hide();
      const alpha = 1 - revealAt(f, handoff.h2);
      if (!(alpha > 0.001)) return hide();
      const box = target.getBoundingClientRect();
      const origin = layer.getBoundingClientRect();
      const span = Math.max(1, handoff.land - liftFrame);
      const s = snap ? 1 : smootherstep(Math.min(1, Math.max(0, (f - liftFrame) / span)));
      const rect = coverRect(layer.clientWidth, layer.clientHeight, film.aspect, REEL_FOCUS);
      const from = projectCorners(t.corners[liftRow], rect);
      const x0 = box.left - origin.left;
      const y0 = box.top - origin.top;
      const x1 = box.right - origin.left;
      const y1 = box.bottom - origin.top;
      const to: [number, number][] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const quad = from.map(
        ([x, y], i): [number, number] => [x + (to[i][0] - x) * s, y + (to[i][1] - y) * s],
      );
      const css = matrix3dFor(squareToQuad(quad), w0, h0);
      if (css === "none") return hide();
      plate.style.transform = css;
      plate.style.opacity = String(Math.min(1, alpha));
      plate.style.visibility = "visible";
      shown = -3;
      layer.dataset.plateFrame = String(liftRow);
      layer.dataset.plateFlight = s.toFixed(3);
    };

    const apply = () => {
      const frame = drawnFrame.get();
      if (!t || drawnSegment.get() !== index || frame < 0) return hide();
      if (handoff && liftRow >= 0) {
        const f = handoff.frame.get();
        // The release guard first: once the composition scrolls off its pin the plate belongs to the
        // heading whatever the smoothed clock says (a flick past the pin).
        const pinned = handoff.pinned();
        const released = !!pinned && pinned.getBoundingClientRect().top < -1;
        const raw = handoff.raw?.();
        const leap = raw !== undefined && raw >= liftFrame && raw - f > SNAP_FRAMES;
        if (released || leap) return fly(f, true);
        if (f >= liftFrame) return fly(f, false);
      }
      delete layer.dataset.plateFlight;
      // A track at least as long as the film is row-per-frame (the export pads the breathing tail's rows
      // after the move, so a film built without its tail still reads rows 0…M); a shorter one maps
      // proportionally.
      const k =
        t.count >= film.count || film.count < 2
          ? Math.min(frame, t.count - 1)
          : Math.round((frame * (t.count - 1)) / (film.count - 1));
      const corners = t.corners[k];
      const alpha = t.alpha[k] ?? 0;
      if (!corners || corners.length !== 8 || !(alpha > 0)) return hide();
      const rect = coverRect(layer.clientWidth, layer.clientHeight, film.aspect, REEL_FOCUS);
      const css = matrix3dFor(squareToQuad(projectCorners(corners, rect)), w0, h0);
      if (css === "none") return hide();
      plate.style.transform = css;
      plate.style.opacity = String(Math.min(1, alpha));
      plate.style.visibility = "visible";
      shown = k;
      layer.dataset.plateFrame = String(k);
    };

    const offSegment = drawnSegment.on("change", apply);
    const offFrame = drawnFrame.on("change", apply);
    // The flight follows the chapter's clock and its live target (the release moves it with the scroll).
    const offClock = handoff?.frame.on("change", apply);
    if (handoff) window.addEventListener("scroll", apply, { passive: true });
    const ro = new ResizeObserver(apply);
    ro.observe(layer);
    window.addEventListener("resize", apply);
    apply();
    return () => {
      offSegment();
      offFrame();
      offClock?.();
      window.removeEventListener("scroll", apply);
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [backdrop, index, track, portraitTrack, off, w0, h0, handoff]);

  if (off) return null;
  return (
    <div
      ref={layerRef}
      aria-hidden
      data-perspective-plate={index}
      data-plate-frame="-1"
      className="pointer-events-none fixed inset-0 -z-10 h-dvh w-full overflow-hidden"
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

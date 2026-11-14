"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pickFilmOrientation, subscribeWide, wideMatches } from "@/components/film/filmCore";
import { FILM_ASPECT } from "@/components/film/frameBox";
import { REEL_FOCUS, useFilmBackdrop } from "@/components/film/FilmBackdrop";
import { placement } from "@/components/film/placement";
import { filmViewport, subscribeFilmViewport } from "@/components/film/viewport";
import { useChapter } from "@/components/film/chapterContext";
import { overlayFrame } from "@/components/film/overlayFrame";
import type { OverlayJob } from "@/components/film/overlayScheduler";
import { rideTransform } from "@/components/film/plateFace";

/** An exported anchor's per-frame positions (frame fractions, row = film frame), per camera. */
type AnchorTracks = {
  film: string;
  landscape: Readonly<Record<string, readonly (readonly [number, number])[]>>;
  portrait: Readonly<Record<string, readonly (readonly [number, number])[]>>;
};

/**
 * The anchors' tracks, split out of rack.timeline.json (components/film/anchors/<film>.json) so the page
 * bundle carries only their rest positions; loaded on approach, like the plates.
 */
const TRACKS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {
  "rack-01": () => import("@/components/film/anchors/rack-01.json"),
  "rack-02": () => import("@/components/film/anchors/rack-02.json"),
  "rack-03": () => import("@/components/film/anchors/rack-03.json"),
  "rack-04": () => import("@/components/film/anchors/rack-04.json"),
};

/** The chapter film's anchor tracks, once its segment is within one of the painted one. */
function useAnchorTracks(film: string, index: number): AnchorTracks | null {
  const backdrop = useFilmBackdrop();
  const [tracks, setTracks] = useState<AnchorTracks | null>(null);
  useEffect(() => {
    const load = TRACKS[film];
    if (!load) return;
    const { drawnSegment } = backdrop;
    let cancelled = false;
    let requested = false;
    const approach = () => {
      const painted = drawnSegment.get();
      if (requested || painted < 0 || Math.abs(painted - index) > 1) return;
      requested = true;
      load().then(
        (m) => {
          if (!cancelled) setTracks(m.default as AnchorTracks);
        },
        () => {}, // no tracks: the item simply stays at its rest anchor
      );
    };
    const off = drawnSegment.on("change", approach);
    approach();
    return () => {
      cancelled = true;
      off();
    };
  }, [backdrop, film, index]);
  return tracks;
}

/**
 * Keeps an item on its anchor while the camera settles (part 3, §2f): from frame `from` until camera rest
 * (M) the wrapper is translated by (track(frame) − rest) through the cover fit, on the chapter's smoothed
 * clock (the item's own reveal clock), so a column laid out at the anchor's rest position arrives riding its
 * cartridge instead of sliding against it; identity at and after rest. Framed layouts on the landscape
 * camera only (stacked compositions do not sit on anchors); nothing under reduced motion.
 *
 * Stage 8: applied through the overlay scheduler (overlayFrame.ts) with the plates, once per animation frame and after
 * their layout reads; the composition's width is read only after a viewport change, and the transform is written only
 * when it changes (on a stacked composition, never).
 */
export function RideAnchor({
  film,
  anchor,
  rest,
  from,
  children,
}: {
  film: string;
  anchor: string;
  rest: readonly [number, number];
  /** First frame to ride (before it the item is hidden anyway): its reveal window's start − 1. */
  from: number;
  children: ReactNode;
}) {
  const ch = useChapter();
  const ref = useRef<HTMLDivElement>(null);
  const tracks = useAnchorTracks(film, ch.index);

  useEffect(() => {
    const el = ref.current;
    const track = tracks?.landscape[anchor];
    if (!el || !track || ch.reduced) return;
    const { frame, end, composeRef } = ch;
    // The `wide` rule, kept from its change events (no media query per frame).
    let wideOn = wideMatches();
    // The composition box's width, read in a read phase once and again after a film viewport change (never per frame).
    let width = -1;
    // What the wrapper's transform is: written only when it changes (on a stacked composition, never).
    let written = el.style.transform;
    const job: OverlayJob = {
      name: `ride:${anchor}`,
      read: () => {
        const compose = composeRef.current;
        if (width < 0 && compose) width = compose.clientWidth;
      },
      write: () => {
        const compose = composeRef.current;
        const f = frame.get();
        const framed =
          wideOn && compose?.dataset.composeMode === "auto" && pickFilmOrientation() === "landscape";
        let next = "";
        if (framed && compose && f >= from && f < end) {
          // The frame's size where the canvas paints it (placement.ts), on the composition box's width.
          const view = filmViewport();
          const r = placement(width, view.lvh, view.svh, FILM_ASPECT.landscape, REEL_FOCUS);
          next = rideTransform(track, f, rest, r);
        }
        if (next === written) return;
        el.style.transform = written = next;
      },
    };
    // Applied with the plates, once per animation frame in the frame the clock ticks (overlayFrame.ts).
    const apply = () => overlayFrame.invalidate(job);
    const onWide = () => {
      wideOn = wideMatches();
      apply();
    };
    const relayout = () => {
      width = -1;
      apply();
    };
    const off = frame.on("change", apply);
    const offWide = subscribeWide(onWide);
    const offViewport = subscribeFilmViewport(relayout);
    apply();
    return () => {
      off();
      offWide();
      offViewport();
      overlayFrame.cancel(job);
      el.style.transform = "";
    };
  }, [tracks, anchor, rest, from, ch]);

  return (
    <div ref={ref} data-ride={anchor}>
      {children}
    </div>
  );
}

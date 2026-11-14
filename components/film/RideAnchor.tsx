"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pickFilmOrientation } from "@/components/film/filmCore";
import { WIDE_QUERY } from "@/components/film/filmBase";
import { FILM_ASPECT } from "@/components/film/frameBox";
import { REEL_FOCUS, useFilmBackdrop } from "@/components/film/FilmBackdrop";
import { placement } from "@/components/film/placement";
import { filmViewport, subscribeFilmViewport } from "@/components/film/viewport";
import { useChapter } from "@/components/film/chapterContext";

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
    const wide = window.matchMedia(WIDE_QUERY);
    const { frame, end, composeRef } = ch;
    const apply = () => {
      const compose = composeRef.current;
      const f = frame.get();
      const framed =
        wide.matches && compose?.dataset.composeMode === "auto" && pickFilmOrientation() === "landscape";
      if (!framed || !compose || f < from || f >= end) {
        el.style.transform = "";
        return;
      }
      const i = Math.min(track.length - 1, Math.max(0, f));
      const i0 = Math.floor(i);
      const i1 = Math.min(track.length - 1, i0 + 1);
      const t = i - i0;
      const x = track[i0][0] + (track[i1][0] - track[i0][0]) * t;
      const y = track[i0][1] + (track[i1][1] - track[i0][1]) * t;
      // The frame's size where the canvas paints it (placement.ts), on the composition box's width.
      const view = filmViewport();
      const r = placement(compose.clientWidth, view.lvh, view.svh, FILM_ASPECT.landscape, REEL_FOCUS);
      const dx = (x - rest[0]) * r.width;
      const dy = (y - rest[1]) * r.height;
      el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
    };
    const off = frame.on("change", apply);
    const offViewport = subscribeFilmViewport(apply);
    apply();
    return () => {
      off();
      offViewport();
      el.style.transform = "";
    };
  }, [tracks, anchor, rest, from, ch]);

  return (
    <div ref={ref} data-ride={anchor}>
      {children}
    </div>
  );
}

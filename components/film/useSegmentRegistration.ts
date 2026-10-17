"use client";

import { useEffect, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { useFilmOrientation, type FilmEntry, type FilmManifest } from "@/components/film/filmCore";
import { manifestFor } from "@/components/film/filmBase";
import { useFilmBackdrop, type SegmentRegistration } from "@/components/film/FilmBackdrop";

/** What a segment tells the backdrop beyond its film and element (FilmBackdrop SegmentRegistration). */
export type SegmentOptions = Pick<
  SegmentRegistration,
  | "reducedSteps"
  | "dissolveIn"
  | "keyIn"
  | "moveVh"
  | "readVh"
  | "tail"
  | "breath"
  | "section"
  | "activeFrom"
> & {
  /**
   * The `frame` value before the backdrop runs (server render, hydration): 0 for a legacy segment; a
   * chapter passes its last frame so the server HTML is fully revealed (no-JS, SEO, deep-link LCP).
   */
  initialFrame?: number;
  /** The `tau` / `tauRead` values before the backdrop runs: a chapter passes 1 so its tail items are revealed too. */
  initialTau?: number;
};

export type SegmentHandle = {
  /** Position in the reel (−1 if the film is not in the backdrop's reel). */
  index: number;
  entry: FilmEntry | undefined;
  /** The manifest this render shows (landscape on the server and during hydration). */
  manifest: FilmManifest;
  progress: MotionValue<number>;
  frame: MotionValue<number>;
  tau: MotionValue<number>;
  /** τ at the end of the read pin, kept current by the backdrop. */
  tauRead: MotionValue<number>;
};

/**
 * Registers one reel segment with the FilmBackdrop (extracted from FilmSegment so FilmChapter shares it):
 * resolves the segment's index and manifest, owns its `progress` / `frame` / `tau` MotionValues and
 * registers `el` with the manifest the backdrop picked for this page load (not the rendered one, which is
 * landscape until hydration has finished), so a portrait page registers once, with the portrait film.
 * Object options (`tail`, `breath`) must be stable (module constants).
 */
export function useSegmentRegistration(
  film: FilmEntry | FilmManifest,
  elRef: RefObject<HTMLElement | null>,
  {
    reducedSteps = 5,
    dissolveIn,
    keyIn,
    moveVh,
    readVh,
    tail,
    breath,
    section,
    activeFrom,
    initialFrame = 0,
    initialTau = 0,
  }: SegmentOptions,
): SegmentHandle {
  const backdrop = useFilmBackdrop();
  const index = backdrop.indexOf(film);
  const entry: FilmEntry | undefined = backdrop.reel[index];
  const orientation = useFilmOrientation();
  const manifest = entry
    ? manifestFor(entry, orientation)
    : "landscape" in film
      ? film.landscape
      : film;
  const progress = useMotionValue(0);
  const frame = useMotionValue(initialFrame);
  const tau = useMotionValue(initialTau);
  const tauRead = useMotionValue(initialTau);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const played = backdrop.manifestAt(index);
    if (!played) {
      const name = "landscape" in film ? film.landscape.name : film.name;
      console.error(`FilmSegment: "${name}" is not in the backdrop's reel`);
      return;
    }
    return backdrop.register({
      index,
      film: played,
      el,
      reducedSteps,
      progress,
      frame,
      tau,
      tauRead,
      dissolveIn,
      keyIn,
      moveVh,
      readVh,
      tail,
      breath,
      section,
      activeFrom,
    });
  }, [
    backdrop,
    elRef,
    index,
    film,
    reducedSteps,
    progress,
    frame,
    tau,
    tauRead,
    dissolveIn,
    keyIn,
    moveVh,
    readVh,
    tail,
    breath,
    section,
    activeFrom,
  ]);

  return { index, entry, manifest, progress, frame, tau, tauRead };
}

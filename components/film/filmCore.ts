import { useSyncExternalStore } from "react";
import { WIDE_QUERY } from "@/components/film/filmBase";

/** Written by scripts/films/build-film.sh to public/films/<name>/manifest.json. */
export type FilmManifest = {
  name: string;
  count: number;
  fps: number;
  widths: number[];
  aspect: number;
  pad: number;
  ext: string;
  base: string;
  poster: string;
  kb?: Record<string, number>;
};

/**
 * One segment of the reel (components/film/reel.ts): its landscape film and, optionally, an upright film
 * rendered on the same animation for screens where the `wide` rule fails (phones, portrait tablets), plus
 * the hold key after it per orientation. A `portraitKey` applies only when `portrait` is set (it is the
 * exact last frame of the portrait film); without a portrait film every screen plays `landscape` and
 * holds `key`.
 */
export type FilmEntry = {
  landscape: FilmManifest;
  portrait?: FilmManifest;
  key?: string;
  portraitKey?: string;
  /**
   * Film frames per viewport height of scroll for this entry's camera move (reel.ts moveVhOf/lengthOf);
   * default the timeline's page constant (96). Part five: chapters and the tower at 84, the hero at 96.
   */
  pace?: number;
  /**
   * The hold key's breath wherever no tail frames play (part five §2a: the tower; the rack's fallback
   * paths): the key layer scales by 1 + scale·sin²(π·g(τ)) about `origin` (frame fractions) during the tail.
   */
  breath?: { scale: number; origin: readonly [number, number] };
  /** Rendered breathing-tail frames after the move (renderer §2e): frames from … from + frames. */
  tail?: { from: number; frames: number };
  /** The timeline film this entry's data comes from, when it is not the manifest's own name (a stand-in). */
  timeline?: string;
  /**
   * Stand-in frames: both cameras stand in for `timeline`'s film and the move uses the landscape manifest's
   * own frame count (no tail). None in the reel today: every film is final.
   */
  standIn?: boolean;
};

/** Which camera a page load plays: `landscape` where the `wide` rule holds, else `portrait`. */
export type FilmOrientation = "landscape" | "portrait";

/** The hold keys per orientation (FilmBackdrop `keys`); index i is the hold after segment i. */
export type HoldKeys = {
  landscape: readonly (string | undefined)[];
  portrait: readonly (string | undefined)[];
};

// Pure and server-safe, so it lives with resolveFilm; re-exported here with the rest of the film core.
export { frameUrl } from "@/components/film/filmBase";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_QUERY).matches;

/**
 * Same query as useReducedMotion(), but with a server snapshot so hydration matches the SSR markup;
 * React re-renders with the viewer's preference right after. Use it wherever the preference changes
 * server-rendered styles (caption drift, section parallax, the dither wipes) or the film's playback.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}

let picked: FilmOrientation | null = null;

/**
 * The orientation this page load plays, picked once (the first call, on the client) with the page's
 * `wide` rule (WIDE_QUERY) and never changed after: a rotation or resize keeps the films, keys and plate
 * tracks it started with. app/page.tsx's boot script evaluates the same query before any JS. Client only.
 */
export function pickFilmOrientation(): FilmOrientation {
  if (picked === null) picked = window.matchMedia(WIDE_QUERY).matches ? "landscape" : "portrait";
  return picked;
}

const noSubscribe = () => () => {};

/**
 * pickFilmOrientation() for rendering: `landscape` on the server and during hydration (so the markup
 * matches), then the picked orientation. Effects should call pickFilmOrientation() directly.
 */
export function useFilmOrientation(): FilmOrientation {
  return useSyncExternalStore(noSubscribe, pickFilmOrientation, () => "landscape");
}

import { useSyncExternalStore } from "react";

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

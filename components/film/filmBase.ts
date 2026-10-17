import type { FilmEntry, FilmManifest, FilmOrientation } from "@/components/film/filmCore";

// Pure and server-safe (app/page.tsx and the node tests import it): no React, no DOM.

// Optional override of where the frames live (e.g. the CloudFront `.../films` root) so a committed
// manifest can point at the CDN while QA runs from the local `/films` copy. Shared by the hero, the
// chapter dividers and the poster preload in app/page.tsx so they all name the same URLs.
const FILM_BASE = process.env.NEXT_PUBLIC_FILM_BASE;

/**
 * The page's `wide` rule (app/globals.css `@custom-variant wide`): the landscape film layout. Where it
 * fails, a reel entry with a portrait film plays that film instead (filmCore pickFilmOrientation).
 */
export const WIDE_QUERY = "(min-width: 64rem) and (orientation: landscape)";

/** Rewrites a manifest's `base`/`poster` under NEXT_PUBLIC_FILM_BASE; returns it unchanged when unset. */
export function resolveFilm(film: FilmManifest): FilmManifest {
  if (!FILM_BASE) return film;
  const base = `${FILM_BASE.replace(/\/+$/, "")}/${film.name}`;
  const poster = film.poster.startsWith(film.base)
    ? `${base}${film.poster.slice(film.base.length)}`
    : film.poster;
  return { ...film, base, poster };
}

/** URL of frame `index` (0-based) at the `width` tier. Server-safe (re-exported by filmCore). */
export function frameUrl(film: FilmManifest, width: number, index: number): string {
  return `${film.base}/${width}/f_${String(index + 1).padStart(film.pad, "0")}.${film.ext}`;
}

/** The manifest an entry plays in `orientation`: its portrait film where it has one, else landscape. */
export function manifestFor(entry: FilmEntry, orientation: FilmOrientation): FilmManifest {
  return orientation === "portrait" && entry.portrait ? entry.portrait : entry.landscape;
}

/** Where a cover-fitted frame lands in a `vw` x `vh` box, in the same units as the box. */
export interface CoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The cover fit, the single source of truth for where a frame lands: FilmBackdrop's draw() paints with
 * it, the hold-key layers are sized and positioned with it, and PerspectivePlate maps its corners through
 * it, so nothing drawn over the canvas can drift from the canvas. The frame is scaled by
 * max(vw / frameW, vh / frameH) and offset by (vw - w) * fx, (vh - h) * fy, so `focus` is the share of the
 * overflow cropped from the left and from the top. `aspect` is frameW / frameH; pass the image's natural
 * size ratio when you have it, because the manifest's four-decimal aspect is off by about 1e-5 (0.03 px at
 * 2560 wide). Units are the caller's: CSS px for DOM layers, device px on the DPR-sized canvas (the
 * layout is the same scaled by the DPR).
 */
export function coverRect(
  vw: number,
  vh: number,
  aspect: number,
  focus: readonly [number, number],
): CoverRect {
  const width = Math.max(vw, vh * aspect);
  const height = width / aspect;
  return {
    left: (vw - width) * focus[0],
    top: (vh - height) * focus[1],
    width,
    height,
  };
}

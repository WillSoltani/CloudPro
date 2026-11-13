import type { FilmEntry, FilmManifest, FilmOrientation, FilmPack } from "@/components/film/filmCore";
import { PACK_FILE_PATTERN } from "@/components/film/loader/pack-format.mjs";

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

/**
 * Rewrites a manifest's `base`/`poster` under NEXT_PUBLIC_FILM_BASE; returns it unchanged when unset. Packs name a
 * bare file under `<base>/<width>/` (packUrl), so they follow the same rewrite.
 */
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

const positiveInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/**
 * The manifest's pack for `width`, when it names a usable one: a bare file name (no path) and whole positive sizes
 * with header ≤ skeletonEnd ≤ bytes. Null otherwise (no entry, or a malformed one): that width then loads frame by
 * frame. The sizes are hints; the pack's own header is what the reader trusts.
 */
export function packFor(film: FilmManifest, width: number): FilmPack | null {
  const p: unknown = film.packs?.[String(width)];
  if (!p || typeof p !== "object") return null;
  const { file, bytes, header, skeletonEnd } = p as Partial<Record<keyof FilmPack, unknown>>;
  if (typeof file !== "string" || !PACK_FILE_PATTERN.test(file)) return null;
  if (!positiveInt(bytes) || !positiveInt(header) || !positiveInt(skeletonEnd)) return null;
  if (header > skeletonEnd || skeletonEnd > bytes) return null;
  return { file, bytes, header, skeletonEnd };
}

/** URL of the pack holding every frame of the `width` tier, or null when the manifest names none (packFor). */
export function packUrl(film: FilmManifest, width: number): string | null {
  const p = packFor(film, width);
  return p ? `${film.base}/${width}/${p.file}` : null;
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

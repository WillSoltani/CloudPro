import type { FilmManifest } from "@/components/film/filmCore";

// Optional override of where the frames live (e.g. the CloudFront `.../films` root) so a committed
// manifest can point at the CDN while QA runs from the local `/films` copy. Shared by the hero, the
// chapter dividers and the poster preload in app/page.tsx so they all name the same URLs.
const FILM_BASE = process.env.NEXT_PUBLIC_FILM_BASE;

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

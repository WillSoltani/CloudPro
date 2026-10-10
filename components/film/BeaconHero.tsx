"use client";

import manifest from "@/public/films/beacon/manifest.json";
import { ScrollFilm, type FilmManifest } from "@/components/film/ScrollFilm";
import { BeaconCaptions } from "@/components/film/BeaconCaptions";
import { FilmFadeOut } from "@/components/film/FilmFadeOut";
import { FilmScrims } from "@/components/film/FilmScrims";
import { GridHairlines } from "@/components/film/GridHairlines";
import { TickRail } from "@/components/film/TickRail";

// Optional override of where the frames live (e.g. the CloudFront `.../films` root) so the
// committed manifest can point at the CDN while QA runs from the local `/films` copy.
// app/page.tsx mirrors this rewrite for the poster preload.
const FILM_BASE = process.env.NEXT_PUBLIC_FILM_BASE;

function resolveFilm(film: FilmManifest): FilmManifest {
  if (!FILM_BASE) return film;
  const base = `${FILM_BASE.replace(/\/+$/, "")}/${film.name}`;
  const poster = film.poster.startsWith(film.base)
    ? `${base}${film.poster.slice(film.base.length)}`
    : film.poster;
  return { ...film, base, poster };
}

// Module-level so ScrollFilm sees one stable object (a new object would restart loading).
const beacon = resolveFilm(manifest);

/** The homepage opener: the "beacon" film scrubbed by scroll, with the hero and beat captions as HTML. */
export function BeaconHero() {
  return (
    <ScrollFilm
      film={beacon}
      id="hero"
      aria-labelledby="hero-title"
      focus={[0.5, 0.45]}
      fit="cover"
      reducedSteps={5}
      length={6}
      className="bg-night"
    >
      <FilmFadeOut />
      <FilmScrims left />
      <GridHairlines />
      <BeaconCaptions />
      <TickRail />
    </ScrollFilm>
  );
}

"use client";

import manifest from "@/public/films/beacon/manifest.json";
import { ScrollFilm } from "@/components/film/ScrollFilm";
import { resolveFilm } from "@/components/film/filmBase";
import { BeaconCaptions } from "@/components/film/BeaconCaptions";
import { FilmFadeOut } from "@/components/film/FilmFadeOut";
import { FilmScrims } from "@/components/film/FilmScrims";
import { GridHairlines } from "@/components/film/GridHairlines";
import { TickRail } from "@/components/film/TickRail";

// Module-level so ScrollFilm sees one stable object (a new object would restart loading).
// resolveFilm applies NEXT_PUBLIC_FILM_BASE; app/page.tsx preloads the same poster URL.
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

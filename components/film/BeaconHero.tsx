"use client";

import { FilmSegment } from "@/components/film/FilmSegment";
import { HERO_FILM } from "@/components/film/reel";
import { BeaconCaptions } from "@/components/film/BeaconCaptions";
import { FilmScrims } from "@/components/film/FilmScrims";
import { GridHairlines } from "@/components/film/GridHairlines";
import { TickRail } from "@/components/film/TickRail";

/**
 * The homepage opener: segment 0 of the reel (reel-01: "One Aisle, One Light", clips 01–04) scrubbed by scroll on the backdrop,
 * with the hero and beat captions as HTML. It hands over to the first hold panel with no fade: the
 * backdrop keeps its last frame behind the sections that follow.
 */
export function BeaconHero() {
  return (
    <FilmSegment
      film={HERO_FILM}
      id="hero"
      aria-labelledby="hero-title"
      length={6}
      reducedSteps={5}
    >
      <FilmScrims left />
      <GridHairlines />
      <BeaconCaptions />
      <TickRail />
    </FilmSegment>
  );
}

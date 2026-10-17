"use client";

import { FilmSegment } from "@/components/film/FilmSegment";
import { HERO_FILM } from "@/components/film/reel";
import { BeaconCaptions } from "@/components/film/BeaconCaptions";
import { FilmScrims } from "@/components/film/FilmScrims";
import { GridHairlines } from "@/components/film/GridHairlines";
import { TickRail } from "@/components/film/TickRail";

/**
 * The homepage opener: segment 0 of the reel (HERO_FILM; today rack-00, the data hall down to the whole
 * rack square-on) scrubbed by scroll on the backdrop, with the hero block and its caption windows as HTML
 * (components/film/heroBeats.ts). It hands over to the next hold panel or segment with no fade: the
 * backdrop keeps its last frame behind what follows.
 */
export function BeaconHero({
  length = 5,
  reducedSteps = 5,
  intoSegment = false,
}: {
  /** Scroll distance in viewport heights (FilmSegment `length`; the rack hero reads it from rack.timeline.json). */
  length?: number;
  /** Reduced-motion stills (the rack hero: 4, f0 / 72 / 144 / 216). */
  reducedSteps?: number;
  /**
   * A segment follows directly, with no hold panel between (the rack hero's last frame is held for one
   * viewport while rack-01's stage enters): the phone scrim then eases out at the stage's bottom edge
   * (FilmScrims `phoneEnd="clear"`) instead of ending on solid night.
   */
  intoSegment?: boolean;
} = {}) {
  return (
    <FilmSegment
      film={HERO_FILM}
      id="hero"
      aria-labelledby="hero-title"
      length={length}
      reducedSteps={reducedSteps}
      section=""
    >
      <FilmScrims left phoneEnd={intoSegment ? "clear" : "solid"} />
      <GridHairlines />
      <BeaconCaptions />
      <TickRail />
    </FilmSegment>
  );
}

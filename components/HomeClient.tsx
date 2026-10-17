"use client";

import { BeaconHero } from "@/components/film/BeaconHero";
import { FilmBackdrop } from "@/components/film/FilmBackdrop";
import { FilmSegment } from "@/components/film/FilmSegment";
import { HOLD_KEYS, REEL, REEL_INDEX, keyInOf, lengthOf } from "@/components/film/reel";
import { ScrollToTop } from "@/components/ScrollToTop";

import { AboutSection } from "@/sections/AboutSection";
import { CertificationsSection } from "@/sections/CertificationsSection";
import { SkillsSection } from "@/sections/SkillsSection";
import { ProjectsBlock } from "@/sections/ProjectsBlock";
import { ExperienceSection } from "@/sections/ExperienceSection";
import { ContactSection } from "@/sections/ContactSection";

const hero = REEL[REEL_INDEX.hero];
const exit = REEL[REEL_INDEX.exit];

/**
 * The homepage as one film, part five "Round Trip, then up" (the plan's §1–§2): FilmBackdrop paints the reel
 * on a single fixed canvas and every section is a chapter of it (FilmChapter): the film's move and the
 * section's content are one element, the heading is the plate on the machine landing in the h2, the items
 * arrive with the mechanism, and the composition stays pinned for a short read while the picture breathes
 * (the rendered tail on the rack, the held key's push on the tower).
 *
 *   hero rack-00 ─join─ About rack-01 ─ Certifications rack-02 ─ Skills rack-03 ─ Projects rack-04
 *     ─ the exit rack-05 (no section) ─join─ Experience tower-01 (the bridge + lights-on)
 *     ─ Contact + footer tower-04, the page ending in Contact's read pin
 *
 * Lengths come from the reel (reel.ts moveVhOf: frames / pace). Holds: keep in step with HOLD_SECTIONS
 * (components/film/reel.ts), which the boot script in app/page.tsx reads.
 */
export function HomeClient() {
  return (
    <FilmBackdrop reel={REEL} keys={HOLD_KEYS}>
      {/* rack-00: its line and CTA ride out over About's first viewport (About is joined: no hero hold). */}
      <BeaconHero length={lengthOf(hero)} reducedSteps={4} intoSegment />

      <AboutSection />
      <CertificationsSection />
      <SkillsSection />
      <ProjectsBlock />

      {/* The exit, rack-05 (both cameras): the lid closes, the server slides home, the door shuts and the
          reply climbs into the fog; no section, so the nav clears. No dissolve in: rack-04's last frame (its
          tail's end, the hold frame) is rack-05's first, byte for byte on both cameras, so the canvas runs
          straight on (where Projects' key is up, on the fallback paths, it leaves over the usual ≈ 120 px;
          a long dissolve would hold rack-04's last frame over the lid closing: a double image). Its key
          fades in over the static tail (`keyIn`, f144–162) and dissolves into the bridge (Experience's
          `dissolveIn`). */}
      <FilmSegment
        film={exit}
        id="exit"
        aria-label="Interlude: the reply leaves the rack"
        length={lengthOf(exit)}
        reducedSteps={2}
        keyIn={keyInOf(exit)}
        section=""
      />

      <ExperienceSection />
      <ContactSection />

      <ScrollToTop />
    </FilmBackdrop>
  );
}

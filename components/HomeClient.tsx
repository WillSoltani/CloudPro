"use client";

import { BeaconHero } from "@/components/film/BeaconHero";
import { FilmBackdrop } from "@/components/film/FilmBackdrop";
import { FilmDivider } from "@/components/film/FilmDivider";
import { HoldPanel } from "@/components/film/HoldPanel";
import { HOLD_KEYS, REEL } from "@/components/film/reel";
import { ProofStrip } from "@/components/ProofStrip";
import { DeliveryStrip } from "@/components/DeliveryStrip";
import { ScrollToTop } from "@/components/ScrollToTop";

import { delivery } from "@/content/delivery";

import { AboutSection } from "@/sections/AboutSection";
import { CertificationsSection } from "@/sections/CertificationsSection";
import { SkillsSection } from "@/sections/SkillsSection";
import { ProjectsBlock } from "@/sections/ProjectsBlock";
import { ExperienceSection } from "@/sections/ExperienceSection";
import { ContactSection } from "@/sections/ContactSection";

const [, itRuns, oneThread, oneLight] = REEL;


/**
 * The homepage as one film: FilmBackdrop paints the reel on a single fixed canvas; the hero and the
 * three dividers scroll it, and each run of HTML sections sits on a HoldPanel over the held frame.
 */
export function HomeClient() {
  return (
    <FilmBackdrop reel={REEL} keys={HOLD_KEYS}>
      <BeaconHero />

      {/* Holds: keep in step with HOLD_SECTIONS (components/film/reel.ts). */}
      <HoldPanel>
        {/* The film ends flush; ProofStrip used to sit on the Hero's own padding. */}
        <div className="pt-16 sm:pt-24">
          <ProofStrip />
        </div>
        <DeliveryStrip items={delivery} />
        <AboutSection />
        <CertificationsSection />
        <SkillsSection />
      </HoldPanel>

      {/* Chapter dividers between the remaining sections (wording: films-src/reel/storyboard.md §6). */}
      <FilmDivider
        film={itRuns}
        id="chapter-05"
        label="05 / It runs"
        line="I write case studies that explain architecture decisions, not just screenshots."
        support={[
          "Retries with backoff and DLQ for poison messages",
          "Idempotency to prevent double-processing",
        ]}
        ariaLabel="Chapter 05: It runs"
      />
      <HoldPanel>
        <ProjectsBlock />
      </HoldPanel>

      <FilmDivider
        film={oneThread}
        id="chapter-06"
        label="06 / One thread"
        line="From architecture decisions to release readiness and production support."
        support={[
          "Co-founder, Silicon X · 2022 – Present",
          "Bachelors Degree, Computer Science · University of British Columbia · 2019 – 2024",
        ]}
        ariaLabel="Chapter 06: One thread"
      />
      <HoldPanel>
        <ExperienceSection />
      </HoldPanel>

      <FilmDivider
        film={oneLight}
        id="chapter-07"
        label="07 / One light"
        line="Currently based in Toronto, ON. Open to remote roles across Canada."
        support="will@soltani.org · GitHub · LinkedIn"
        holdCaption
        ariaLabel="Chapter 07: One light"
      />
      <HoldPanel closing>
        <ContactSection />
      </HoldPanel>

      <ScrollToTop />
    </FilmBackdrop>
  );
}

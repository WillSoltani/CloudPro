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

// Act one (the server hall): the hero and itRuns. Act two (the city): lightsOn and oneLight.
const [, itRuns, lightsOn, oneLight] = REEL;

/**
 * The homepage as one film: FilmBackdrop paints the reel on a single fixed canvas; the hero and the
 * three dividers scroll it, and each run of HTML sections sits on a HoldPanel over the held frame.
 * Act one is the server hall (hero, chapter 05); act two is the city (chapters 06 and 07). The act
 * break is the slow dissolve out of the Projects hold into chapter 06.
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

      {/* Chapter dividers between the remaining sections. Chapters 05 and 07 are worded from
          films-src/reel/storyboard.md; chapter 06's line is a verbatim fragment of content/experience.ts
          (work[0].bullets[2], parenthetical elided). */}
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

      {/* The act break: a long dissolve from the hall (K5) into the city, the caption held back until
          the dissolve has nearly resolved. */}
      <FilmDivider
        film={lightsOn}
        id="chapter-06"
        label="06 / Lights on"
        line="Designed and operated AWS-based systems with CI/CD and CloudWatch monitoring."
        support={[
          "Co-founder, Silicon X · 2022 – Present",
          "Bachelors Degree, Computer Science · University of British Columbia · 2019 – 2024",
        ]}
        ariaLabel="Chapter 06: Lights on"
        dissolveIn={0.45}
        captionFrom={0.4}
        scrimAlpha={0.6}
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
        scrimAlpha={0.45}
      />
      <HoldPanel closing>
        <ContactSection />
      </HoldPanel>

      <ScrollToTop />
    </FilmBackdrop>
  );
}

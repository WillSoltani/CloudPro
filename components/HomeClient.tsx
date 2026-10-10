"use client";

import film05 from "@/public/films/beacon-05/manifest.json";
import film06 from "@/public/films/beacon-06/manifest.json";
import film07 from "@/public/films/beacon-07/manifest.json";

import { BeaconHero } from "@/components/film/BeaconHero";
import { FilmDivider } from "@/components/film/FilmDivider";
import { SectionHalftone } from "@/components/film/SectionHalftone";
import { resolveFilm } from "@/components/film/filmBase";
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

// Module-level so each ScrollFilm sees one stable manifest object (a new object would restart loading).
const itRuns = resolveFilm(film05);
const oneThread = resolveFilm(film06);
const oneLight = resolveFilm(film07);

export function HomeClient() {
  return (
    <>
      <BeaconHero />
      {/* The film ends flush; ProofStrip used to sit on the Hero's own padding. */}
      <div className="pt-16 sm:pt-24">
        <ProofStrip />
      </div>
      <DeliveryStrip items={delivery} />

      {/* Part two: the cloud continues as amber halftone behind these headers; each section dissolves in. */}
      <SectionHalftone>
        <AboutSection />
      </SectionHalftone>
      <SectionHalftone>
        <CertificationsSection />
      </SectionHalftone>
      <SectionHalftone>
        <SkillsSection />
      </SectionHalftone>

      {/* Chapter dividers: short films between the remaining sections (wording: films-src/beacon2/storyboard.md). */}
      <FilmDivider
        film={itRuns}
        id="chapter-05"
        label="05 / It runs"
        line="Case studies that explain architecture decisions, not just screenshots."
        support={[
          "Browser → S3 (presigned) → SQS → Lambda → DynamoDB",
          "Serverless File Processing Pipeline · ChapterFlow",
        ]}
        ariaLabel="Chapter 05: It runs"
      />
      <ProjectsBlock />

      <FilmDivider
        film={oneThread}
        id="chapter-06"
        label="06 / One thread"
        line="From architecture decisions to release readiness and production support."
        support={[
          "Co-founder, Silicon X · 2022 – Present",
          "Computer Science, University of British Columbia · 2019 – 2024",
        ]}
        ariaLabel="Chapter 06: One thread"
      />
      <ExperienceSection />

      <FilmDivider
        film={oneLight}
        id="chapter-07"
        label="07 / One light"
        line="Currently based in Toronto, ON. Open to remote roles across Canada."
        support="will@soltani.org · GitHub · LinkedIn"
        holdCaption
        focus={[0.5, 0.5]}
        ariaLabel="Chapter 07: One light"
      />
      <ContactSection />

      <ScrollToTop />
    </>
  );
}

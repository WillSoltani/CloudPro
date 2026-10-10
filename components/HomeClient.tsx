"use client";

import { BeaconHero } from "@/components/film/BeaconHero";
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

export function HomeClient() {
  return (
    <>
      <BeaconHero />
      {/* The film ends flush; ProofStrip used to sit on the Hero's own padding. */}
      <div className="pt-16 sm:pt-24">
        <ProofStrip />
      </div>
      <DeliveryStrip items={delivery} />
      <AboutSection />
      <CertificationsSection />
      <SkillsSection />
      <ProjectsBlock />
      <ExperienceSection />
      <ContactSection />

      <ScrollToTop />
    </>
  );
}

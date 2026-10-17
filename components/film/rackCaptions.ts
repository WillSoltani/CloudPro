/**
 * Caption strings for the rack reel (part four "Round Trip"; since part five the page uses plates 01–04 of
 * rack-01…04 only, the exit rack-05 carries no caption), copied verbatim
 * from films-src/rack/captions.json (G1, 2026-10-11; that file is gitignored, so the copy lives here).
 * G1 chose plate labels by section name (option B: `label`; `labelAlt` is the unused machine names) and the
 * hero line below. Re-copy this file if captions.json changes; never edit a string here alone.
 *
 * Sources (file · field), as listed in captions.json:
 * - hero.badge / name / title / location / cta: components/film/BeaconCaptions.tsx HERO (now heroBeats.ts HERO_COPY)
 * - hero.line: content/about.ts bullets[0], contiguous, leading "I build " dropped
 * - plates.headingText: the `title` of sections/AboutSection.tsx (content/about.ts headline),
 *   CertificationsSection, SkillsSection, ProjectsBlock, ExperienceSection, ContactSection
 * - contact.line: content/about.ts closing; contact.links: sections/ContactSection.tsx ContactCTA email,
 *   content/social.ts github / linkedin
 * - alternates.heroLine: content/about.ts bullets[1], the clause after "but"
 */

export type RackCaptions = {
  hero: {
    badge: string;
    name: string;
    title: readonly [string, string];
    location: string;
    line: string;
    cta: { label: string; href: string };
  };
  plates: readonly {
    n: string;
    section: string;
    label: string;
    headingText: string;
    machine: string;
    labelAlt: string;
  }[];
  contact: {
    line: string;
    links: readonly { id: "email" | "github" | "linkedin"; label: string; href: string }[];
  };
  alternates: { heroLine: string };
};

export const RACK_CAPTIONS = {
  hero: {
    badge: "Open to impactful roles and select project collaborations.",
    name: "Will Soltani",
    title: ["Cloud Engineer", "AWS Solutions Architect"],
    location: "Toronto, ON · Remote-friendly",
    line: "AWS systems that are secure by default and observable in production.",
    cta: { label: "View Projects & Case Studies", href: "#projects" },
  },
  plates: [
    { n: "01", section: "about", label: "01 / About", headingText: "About", machine: "Switch", labelAlt: "01 / Switch" },
    { n: "02", section: "certifications", label: "02 / Certifications", headingText: "Certifications", machine: "Security", labelAlt: "02 / Security" },
    { n: "03", section: "skills", label: "03 / Skills", headingText: "Skills", machine: "Storage", labelAlt: "03 / Storage" },
    { n: "04", section: "projects", label: "04 / Projects", headingText: "Projects", machine: "Server", labelAlt: "04 / Server" },
    { n: "05", section: "experience", label: "05 / Experience", headingText: "Experience", machine: "Power", labelAlt: "05 / Power" },
    { n: "06", section: "contact", label: "06 / Contact", headingText: "Contact", machine: "Fibre", labelAlt: "06 / Fibre" },
  ],
  contact: {
    line: "Currently based in Toronto, ON. Open to remote roles across Canada.",
    links: [
      { id: "email", label: "will@soltani.org", href: "mailto:will@soltani.org" },
      { id: "github", label: "GitHub", href: "https://github.com/WillSoltani" },
      { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/will-soltani" },
    ],
  },
  alternates: {
    heroLine: "I pick tradeoffs based on latency, cost, and ops burden.",
  },
} as const satisfies RackCaptions;

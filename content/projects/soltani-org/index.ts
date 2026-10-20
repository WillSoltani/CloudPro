import type { Project } from "@/types/project";

export const soltaniOrg: Project = {
  slug: "soltani-org",
  title: "soltani.org",
  description:
    "This page: one scroll-scrubbed film on a single canvas, from a scripted Blender scene and generated footage, served as WebP frames from CloudFront.",
  tags: ["Blender", "Canvas 2D", "CloudFront", "Claude Code"],
  featured: false,

  type: "This site",
  stack: "Next.js 16, Blender 5.2, Higgsfield, Canvas 2D, S3 + CloudFront, CDK, Playwright",
  status: "Live",
  githubUrl: "https://github.com/WillSoltani/CloudPro",
  byline: "Built by me with Claude Code agents. Live at soltani.org.",
  nextStep: { label: "See the page", href: "/" },

  caseStudy: {
    overview:
      "The homepage is one continuous film. A fixed canvas behind the page paints pre-rendered frames picked by scroll position, and each section is a chapter the film reveals: a server rack opens one machine per section, then the camera rises out of the fog to a lamp for Contact. Every word on the page is HTML; the film never renders text.",
    architecture: [
      "The film: eight films per camera (six rack, two tower), 1,442 frames per camera, played as one continuous shot; phones get their own portrait camera chain.",
      "The scene: the rack act is one Blender 5.2 scene built entirely by a script of about 5,650 lines and rendered in EEVEE; a second render must match byte for byte.",
      "The joins: neighbouring films share their boundary frame byte for byte, and each hold's key image is the exact last frame of its film.",
      "The tails: four rack films carry 48 extra frames, so the picture keeps breathing while a chapter is pinned for reading; on the tower, a slow push does the same.",
      "The plates: each section title starts as HTML mapped onto its machine's label in perspective, then lifts into the heading.",
      "The tower act: stills and 6-second 1080p clips generated through Higgsfield, each kept only if it passed brightness and join checks.",
      "The reel clock: a spring-smoothed clock turns scroll position into a frame number, and a 2D canvas paints that frame.",
      "The CDN: WebP frames at quality 75 in three width tiers, on S3 behind CloudFront over HTTP/2 and HTTP/3, cached for a year.",
      "The page: Next.js 16 on App Runner, deployed by hand from main; CI runs the build, the tests and cdk synth, and infra deploys from GitHub Actions through OIDC.",
    ],
    decisions: [
      {
        title: "A scripted scene for the rack",
        detail:
          "Generated keyframes could not agree on rigid geometry: the number of racks and cables kept changing between shots. One Blender scene built by a script holds still, renders the same bytes twice and needed no generation credits. The cost is that every object is built in code.",
      },
      {
        title: "Generated footage for the tower",
        detail:
          "The tower act uses generated stills and 6-second clips. Each take was kept only if it passed brightness and join checks and a vision-judge panel, and I accepted the final ones.",
      },
      {
        title: "Frames on a canvas",
        detail:
          "Each chapter keys its text to exact frame numbers, and neighbouring films share a boundary frame byte for byte, so the page plays as one shot. The cost is bytes: a full scroll is 7.5 to 27.5 MB of frames, depending on the tier.",
      },
      {
        title: "One tier per visitor",
        detail:
          "Each visitor loads a single width tier picked by pixel count, so a phone never pays for desktop frames. Coarse pointers are capped near 1.15 megapixels; Save-Data and slow connections (a 2g or 3g class, or slow first frames where the browser reports none) get the smallest tier.",
      },
      {
        title: "Wait for the first scroll",
        detail:
          "Until the visitor scrolls, the loader now fetches only every fourth frame of the opening film and three frames of the next one, so an idle phone no longer downloads two films. The first scroll starts the full loader, nearest frames first.",
      },
      {
        title: "Never rewrite a frame",
        detail:
          "Frames are immutable at the edge for a year. A re-cut ships under a new film name instead of invalidating the cache, and git keeps only the manifests.",
      },
      {
        title: "Agents, with gates",
        detail:
          "Opus agents wrote, designed and judged; Sonnet agents rendered, built and ran QA. Every paid generation waited at an approval gate first.",
      },
    ],
    security: [
      "Frames sit in a private S3 bucket that only CloudFront can read, through origin access control.",
      "The page loads no third-party scripts.",
      "Infra deploys from GitHub Actions through OIDC, and a CI check fails if a frame is ever committed.",
    ],
    observability: [
      "A scroll-qa agent drives Chromium with Playwright through 21 numbered checks, from frame joins and keys to contrast and bytes per tier.",
      "Registration is checked at 12 window sizes, with keyboard, reduced-motion and phone passes.",
      "film-qa.py gates every still and clip on brightness continuity and join identity.",
      "The 2026-10-15 pass found no blocker and no major issue; production LCP was 64 to 124 ms.",
    ],
    failureModes: [
      "A slow network: the smallest tier, and frames load coarse to fine and nearest first, so the canvas never shows an unrelated moment.",
      "Reduced motion: stepped stills instead of the scrub. Save-Data: the smallest tier, without the breathing tails.",
      "No JavaScript: the server HTML carries every word in reading order.",
      "A reload or deep link into a section: its key frame paints before the page's scripts load.",
    ],
    cost: [
      "A full scroll is 7.5 MB of frames at 768 px, 15.2 MB at 1280 and 27.5 MB at 1920; on phones, 8.3 MB at 432 and 15.2 MB at 720.",
      "Frames are cached for a year on CloudFront (PriceClass 100), so a repeat visit reuses them.",
      "The rack act needed no generation credits: it is a local Blender render.",
    ],
    next: ["A shorter page under reduced motion."],
  },
};

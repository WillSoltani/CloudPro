"use client";

import { ArrowRight } from "lucide-react";
import { FilmCaption } from "@/components/film/FilmCaption";
import {
  CAPTION_COLUMN,
  CAPTION_LINE,
  CAPTION_SUPPORT,
  CaptionLabel,
} from "@/components/film/captionTokens";

/** Caption beats, verbatim from the content files (films-src/reel/storyboard.md §6). Labels are set in uppercase by CSS. */
const BEATS = [
  {
    n: "01",
    label: "Design it",
    line: "I pick tradeoffs based on latency, cost, and ops burden.",
    support: "Event-driven processing via S3 events → SQS → Lambda",
    from: 0.08,
    to: 0.27,
  },
  {
    n: "02",
    label: "Build it",
    line: "CDK / CloudFormation for repeatable infra",
    support: "GitHub Actions: lint, build, deploy + cache invalidation",
    from: 0.29,
    to: 0.5,
  },
  {
    n: "03",
    label: "Keep it running",
    line: "AWS systems that are secure by default and observable in production.",
    support: "CloudWatch alarms, structured logs, and runbooks",
    from: 0.53,
    to: 0.75,
  },
  {
    n: "04",
    label: "Ship it",
    line: "Serverless File Processing Pipeline · ChapterFlow",
    support: "Browser → S3 (presigned) → SQS → Lambda → DynamoDB + outputs.",
    from: 0.78,
    to: 1,
  },
] as const;

const HERO = {
  badge: "Open to impactful roles and select project collaborations.",
  name: "Will Soltani",
  title: ["Cloud Engineer", "AWS Solutions Architect"],
  location: "Toronto, ON · Remote-friendly",
  cta: "View Projects & Case Studies",
} as const;

// Every scene shares the caption column on desktop (captionTokens.CAPTION_COLUMN); the reel's K4 puts its
// subject and light at the centre of the frame, so scene 4 keeps clear of it too. On phones scene 4 stays
// the centred bottom block, a touch taller (40svh) for the CTA.
const FINALE = [
  "absolute inset-x-0 bottom-0 flex max-h-[40svh] flex-col items-center justify-end px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center",
  "wide:inset-x-auto wide:top-1/2 wide:bottom-auto wide:left-[5vw] wide:w-[25vw] wide:max-w-[34rem] wide:min-w-[20rem] wide:max-h-none wide:-translate-y-1/2 wide:items-start wide:justify-start wide:px-0 wide:pb-0 wide:text-left",
].join(" ");

export function BeaconCaptions() {
  const [beat1, beat2, beat3, finale] = BEATS;
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Hero strings: the page's h1 lives here and never leaves the accessibility tree. */}
      <FilmCaption from={0} to={0.1} persistent className={CAPTION_COLUMN}>
        <span className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-lamp/40 bg-lamp/10 px-3.5 py-1.5 text-[11px] leading-snug text-slate-200 backdrop-blur-sm sm:text-xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-lamp/60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lamp" />
          </span>
          <span className="text-balance">{HERO.badge}</span>
        </span>
        <h1
          id="hero-title"
          className="mt-5 font-serif text-[2.5rem] font-medium leading-[0.95] tracking-[-0.02em] text-white sm:text-5xl wide:text-[clamp(3rem,4.2vw,4.75rem)]"
        >
          {HERO.name}
        </h1>
        <p className="mt-3 font-serif text-lg leading-snug text-slate-200 wide:text-[1.375rem]">
          {HERO.title[0]} <span className="text-slate-500">|</span>{" "}
          {/* Keep the second title whole so a wrap can only fall after the pipe, never orphan "Architect". */}
          <span className="whitespace-nowrap">{HERO.title[1]}</span>
        </p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
          {HERO.location}
        </p>
      </FilmCaption>

      {[beat1, beat2, beat3].map((b) => (
        <FilmCaption key={b.n} from={b.from} to={b.to} className={CAPTION_COLUMN}>
          <div aria-hidden>
            <CaptionLabel n={b.n} label={b.label} />
            <p className={CAPTION_LINE}>{b.line}</p>
            <p className={CAPTION_SUPPORT}>{b.support}</p>
          </div>
        </FilmCaption>
      ))}

      <FilmCaption from={finale.from} to={finale.to} className={FINALE}>
        <div aria-hidden>
          <CaptionLabel n={finale.n} label={finale.label} />
          <p className="mt-3 font-serif text-3xl leading-[1.08] text-balance text-slate-50 wide:text-[clamp(1.75rem,2.1vw,2.5rem)] wide:leading-[1.12] wide:text-pretty">
            {finale.line}
          </p>
          <p className={CAPTION_SUPPORT}>{finale.support}</p>
        </div>
        <a
          href="#projects"
          className="pointer-events-auto mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-full border border-lamp/50 bg-lamp/10 px-6 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-100 transition-colors hover:bg-lamp/20 focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night wide:mt-8"
        >
          {HERO.cta}
          <ArrowRight aria-hidden className="h-4 w-4 text-lamp" />
        </a>
      </FilmCaption>

      {/* The four beats as one readable list, since the visual captions come and go with scroll. */}
      <div className="sr-only">
        <h2>How I work</h2>
        <ol>
          {BEATS.map((b) => (
            <li key={b.n}>
              {b.n} {b.label}: {b.line} {b.support}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import { FilmCaption } from "@/components/film/FilmCaption";
import {
  CAPTION_COLUMN,
  CAPTION_LINE,
  CAPTION_SUPPORT,
  CaptionLabel,
} from "@/components/film/captionTokens";
import { HERO_BEATS, HERO_COPY, type HeroBeat } from "@/components/film/heroBeats";
import { FILM_LINK } from "@/components/film/sectionTokens";

// Every caption shares the caption column on desktop (captionTokens.CAPTION_COLUMN); a caption with a
// CTA (the finale) keeps clear of the centre of the frame too. On phones the finale is the centred bottom
// block, a touch taller (40svh) for the CTA.
const FINALE = [
  "absolute inset-x-0 bottom-0 flex max-h-[40svh] flex-col items-center justify-end px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center",
  "wide:inset-x-auto wide:top-1/2 wide:bottom-auto wide:left-[5vw] wide:w-[25vw] wide:max-w-[34rem] wide:min-w-[20rem] wide:max-h-none wide:-translate-y-1/2 wide:items-start wide:justify-start wide:px-0 wide:pb-0 wide:text-left",
].join(" ");

const FINALE_LINE =
  "mt-3 font-serif text-3xl leading-[1.08] text-balance text-slate-50 wide:text-[clamp(1.75rem,2.1vw,2.5rem)] wide:leading-[1.12] wide:max-w-[20ch] wide:text-balance";

/** The hero block: the page's h1 lives here and never leaves the accessibility tree. */
function Intro({ from, to }: { from: number; to: number }) {
  return (
    <FilmCaption from={from} to={to} persistent className={CAPTION_COLUMN}>
      <span className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-lamp/40 bg-lamp/10 px-3.5 py-1.5 text-[11px] leading-snug text-slate-200 backdrop-blur-sm sm:text-xs">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-lamp/60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lamp" />
        </span>
        <span className="text-balance">{HERO_COPY.badge}</span>
      </span>
      <h1
        id="hero-title"
        // Focusable from script only: back-to-top puts focus here after the jump.
        tabIndex={-1}
        className="mt-5 font-serif text-[2.5rem] font-medium leading-[0.95] tracking-[-0.02em] text-white sm:text-5xl wide:text-[clamp(3rem,4.2vw,4.75rem)]"
      >
        {HERO_COPY.name}
      </h1>
      <p className="mt-3 font-serif text-lg leading-snug text-slate-200 wide:text-[1.375rem]">
        {/* Two clean lines, never a pipe left hanging at the column's edge. */}
        <span className="block">{HERO_COPY.title[0]}</span>
        <span className="block">{HERO_COPY.title[1]}</span>
      </p>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
        {HERO_COPY.location}
      </p>
    </FilmCaption>
  );
}

/** One caption window: the visible copy is aria-hidden (read from the sr-only text below); the CTA is real. */
function Caption({ beat }: { beat: HeroBeat }) {
  const { n, label, line, support, cta, secondary } = beat;
  return (
    <FilmCaption from={beat.from} to={beat.to} className={cta ? FINALE : CAPTION_COLUMN}>
      <div aria-hidden>
        {n && label ? <CaptionLabel n={n} label={label} /> : null}
        {line ? <p className={cta ? FINALE_LINE : CAPTION_LINE}>{line}</p> : null}
        {support ? <p className={CAPTION_SUPPORT}>{support}</p> : null}
      </div>
      {cta ? (
        <a
          href={cta.href}
          className="pointer-events-auto mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-full border border-lamp/50 bg-lamp/10 px-6 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-100 transition-colors hover:bg-lamp/20 focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night wide:mt-8"
        >
          {cta.label}
          <ArrowRight aria-hidden className="h-4 w-4 text-lamp" />
        </a>
      ) : null}
      {secondary ? (
        // One line under the button: the lead in mono, the address as the film's text link (not capitalised).
        <p className="mt-3 whitespace-nowrap font-mono text-[11px] tracking-[0.12em] text-slate-300 wide:mt-4 wide:text-xs">
          <span aria-hidden>{secondary.lead} </span>
          <a
            href={secondary.href}
            aria-label={`Email ${secondary.label}`}
            className={`pointer-events-auto ${FILM_LINK.replace("uppercase ", "")} tracking-[0.12em]`}
          >
            {secondary.label}
          </a>
        </p>
      ) : null}
    </FilmCaption>
  );
}

/** The hero's captions, from components/film/heroBeats.ts HERO_BEATS. */
export function BeaconCaptions() {
  const numbered = HERO_BEATS.filter((b) => b.kind === "caption" && b.n);
  const plain = HERO_BEATS.filter((b) => b.kind === "caption" && !b.n && b.line);
  return (
    <div className="pointer-events-none absolute inset-0">
      {HERO_BEATS.map((b, i) =>
        b.kind === "intro" ? (
          <Intro key={`intro-${i}`} from={b.from} to={b.to} />
        ) : (
          <Caption key={b.n ?? `caption-${i}`} beat={b} />
        ),
      )}

      {/* The numbered beats as one readable list, since the visual captions come and go with scroll. */}
      {numbered.length ? (
        <div className="sr-only">
          <h2>How I work</h2>
          <ol>
            {numbered.map((b) => (
              <li key={b.n}>
                {b.n} {b.label}: {b.line} {b.support}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {plain.map((b, i) => (
        <p key={`line-${i}`} className="sr-only">
          {b.line}
        </p>
      ))}
    </div>
  );
}

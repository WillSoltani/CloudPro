"use client";

import { Fragment } from "react";
import Link from "next/link";
import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand, FrameColumns } from "@/components/film/FrameLayout";
import { FlowReveal, Reveal } from "@/components/film/Reveal";
import { RackPlate } from "@/components/film/RackPlate";
import { ANCHORS, CHOREO, type FrameWindow } from "@/components/film/choreo";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf, tailOf } from "@/components/film/reel";
import {
  BODY_TEXT,
  FILM_LINK,
  ITEM_META,
  ITEM_NAME,
  MONO_LABEL,
  SEP_DOT,
  SEP_ITEM,
  SEP_LIST,
  TEXT_LINK,
} from "@/components/film/sectionTokens";
import { projects } from "@/content/projects";
import type { Project } from "@/types/project";

const FILM = REEL[REEL_INDEX.projects];
const C = CHOREO.projects;
const PLATE = RACK_CAPTIONS.plates[3];
/** Card centres on the two heat sinks at rest (the renderer's exported anchors, choreo.ts ANCHORS). */
const HEATSINKS = ANCHORS.heatsinks.map(([x]) => x);
/**
 * Each card's width as a share of the frame: the plan's 0.30 where it leaves ≥ 32 px between the cards at
 * the narrowest framed frame (1024 px: the `wide` rule's 64 rem), else 0.28. With the exported centres
 * (0.322 apart) 0.30 leaves 23 px there, so the cards are 0.28 (43–107 px apart from 1024 to 2560).
 */
const NARROWEST_FRAME_PX = 1024;
const CARD_GAP_MIN_PX = 32;
const CARD_WIDTH =
  (HEATSINKS[1] - HEATSINKS[0] - 0.3) * NARROWEST_FRAME_PX >= CARD_GAP_MIN_PX ? 0.3 : 0.28;

const FEATURED = projects.filter((p) => p.featured).slice(0, HEATSINKS.length);
const PROJECT_EMAIL = "mailto:will@soltani.org?subject=Project%20enquiry";
const MORE = projects.filter((p) => !FEATURED.includes(p));

/** A card's links: Geist Sans 14 px, underlined, so they read as links rather than as one more row of tags. */
const CARD_LINK = `${TEXT_LINK} text-sm`;

function external(href: string, label: string, name: string) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: ${name} (opens in a new tab)`}
      className={CARD_LINK}
    >
      {label} <span aria-hidden>↗</span>
    </a>
  );
}

function ProjectItem({ p, at, stackedPin }: { p: Project; at: FrameWindow; stackedPin?: FrameWindow }) {
  // Type · stack, each stack item kept whole (a line never breaks inside "Lambda (container)").
  const meta = [p.type, ...(p.stack ? p.stack.split(", ") : [])].filter(Boolean);
  return (
    <Reveal at={at} stackedPin={stackedPin} data-halo="">
      <h3 className={ITEM_NAME.replace("mt-2 ", "")}>{p.title}</h3>
      {meta.length ? (
        <p className={`mt-2 ${ITEM_META}`}>
          {meta.map((m, i) => (
            <Fragment key={m}>
              {i === 0 ? null : i === 1 && p.type ? " · " : ", "}
              <span className="whitespace-nowrap">{m}</span>
            </Fragment>
          ))}
        </p>
      ) : null}
      <p className={`mt-3 ${BODY_TEXT}`}>{p.description}</p>
      {p.tags?.length ? (
        <ul aria-label="Tags" className={`mt-3 ${SEP_LIST}`}>
          {p.tags.map((t, i) => (
            <li key={t} className={`${ITEM_META} ${SEP_ITEM}`}>
              {i > 0 ? (
                <span aria-hidden className={SEP_DOT}>
                  ·
                </span>
              ) : null}
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <Link href={`/projects/${p.slug}`} className={CARD_LINK} aria-label={`Case study: ${p.title}`}>
          Case study <span aria-hidden>→</span>
        </Link>
        {p.demoUrl ? (
          /^https?:\/\//.test(p.demoUrl) ? (
            external(p.demoUrl, new URL(p.demoUrl).host, p.title)
          ) : (
            // An internal demo (the guest converter): same tab, no arrow, not for crawlers.
            <Link
              href={p.demoUrl}
              rel="nofollow"
              prefetch={false}
              aria-label={`${p.demoLabel ?? "Live demo"}: ${p.title}`}
              className={CARD_LINK}
            >
              {p.demoLabel ?? "Live demo"}
            </Link>
          )
        ) : null}
        {p.githubUrl ? external(p.githubUrl, "GitHub", p.title) : null}
      </p>
    </Reveal>
  );
}

/**
 * The chapter's body, on release after the cards: non-featured projects as a plain list (soltani.org), then
 * one closing line with the email, so it is on screen as the cards leave and before the wordless passage.
 */
function ProjectsBody() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
      {MORE.length ? (
        <>
          <h3 className={MONO_LABEL}>More projects</h3>
          <ul className="mt-4 space-y-4">
            {MORE.map((p) => (
              <FlowReveal as="li" key={p.slug}>
                <Link href={`/projects/${p.slug}`} className={`${FILM_LINK} normal-case`}>
                  {p.title} <span aria-hidden>→</span>
                </Link>
                <p className={`mt-1 max-w-[44rem] ${BODY_TEXT}`}>{p.description}</p>
              </FlowReveal>
            ))}
          </ul>
        </>
      ) : null}
      <FlowReveal>
        <p className="mt-12 font-serif text-lg leading-snug text-slate-200 wide:text-[clamp(1.05rem,1.25vw,1.3rem)]">
          Building something like this?{" "}
          <a href={PROJECT_EMAIL} aria-label="Email will@soltani.org" className={TEXT_LINK}>
            will@soltani.org
          </a>
        </p>
      </FlowReveal>
    </div>
  );
}

/**
 * 04 Projects (§2f): rack-04 opens the server; plate 04 at f32 (nav → Projects), lifting at f37 for the long
 * flight to the heading at f80 while the server slides out and the air cover clears the heat sinks
 * (f72–86); the h2, "● SERVER" and the lede; then the two featured projects, one on each heat sink. No filter
 * chips and no duplicate list; the body (on release) lists the non-featured projects under "More projects"
 * and closes with the email.
 *
 * Desktop: head x 0.18 from max(96 px, frame y 0.14); its band is drawn to 0.26 but the head (h2, support
 * line, a two-line lede) is taller, so it ends at ≈ frame y 0.29–0.31 (to 0.36 on the shortest laptop windows;
 * only at 2560 px wide does it fit by 0.26) and the cards follow 0.04 of the frame below it, wherever it ends
 * (≈ 0.33–0.57 at 1440×900) · card k centred on heat sink k (x 0.339 / 0.661): title, type · stack (mono),
 * description (halo), tags (mono), "Case study →". Phones: one block from y 0.54; project 1 in the block,
 * project 2 flows.
 */
export function ProjectsBlock() {
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={C}
      section={PLATE.section}
      breath={breathOf(FILM)}
      tail={tailOf(FILM)}
      plate={<RackPlate index={REEL_INDEX.projects} n={PLATE.n} name={PLATE.headingText} handoff />}
      body={<ProjectsBody />}
    >
      <BlockTone top={0.54} />
      {/* The head starts on the first card's left edge (heat sink 0 less half a card). */}
      <FrameBand from={0.14} to={0.26} x={HEATSINKS[0] - CARD_WIDTH / 2} right={0.74} stackedTop={0.54}>
        <ChapterHead
          n={PLATE.n}
          title={PLATE.headingText}
          support={PLATE.machine}
          lede="Two products I built and run. Each case study covers the architecture and the tradeoffs."
        />
      </FrameBand>
      <FrameBand from={0.3} to={0.8} after={0.26}>
        <FrameColumns
          anchors={HEATSINKS}
          width={CARD_WIDTH}
          items={FEATURED.map((p, k) => ({
            key: p.slug,
            node: (
              <ProjectItem
                p={p}
                at={C.items[Math.min(k, C.items.length - 1)]}
                stackedPin={C.stacked?.items?.[k] ?? undefined}
              />
            ),
          }))}
        />
      </FrameBand>
    </FilmChapter>
  );
}

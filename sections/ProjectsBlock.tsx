"use client";

import Link from "next/link";
import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand, FrameColumns } from "@/components/film/FrameLayout";
import { FlowReveal, Reveal } from "@/components/film/Reveal";
import { RackPlate } from "@/components/film/RackPlate";
import { ANCHORS, CHOREO, type FrameWindow } from "@/components/film/choreo";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf, tailOf } from "@/components/film/reel";
import { BODY_TEXT, FILM_LINK, ITEM_META, ITEM_NAME, MONO_LABEL } from "@/components/film/sectionTokens";
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
const MORE = projects.filter((p) => !FEATURED.includes(p));

function external(href: string, label: string, name: string) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}: ${name} (opens in a new tab)`}
      className={FILM_LINK}
    >
      {label} <span aria-hidden>↗</span>
    </a>
  );
}

function ProjectItem({ p, at }: { p: Project; at: FrameWindow }) {
  const meta = [p.type, p.stack].filter(Boolean).join(" · ");
  return (
    <Reveal at={at} data-halo="">
      <h3 className={ITEM_NAME.replace("mt-2 ", "")}>{p.title}</h3>
      {meta ? <p className={`mt-2 ${ITEM_META}`}>{meta}</p> : null}
      <p className={`mt-3 ${BODY_TEXT}`}>{p.description}</p>
      {p.tags?.length ? (
        <ul aria-label="Tags" className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {p.tags.map((t, i) => (
            <li key={t} className={`${ITEM_META} flex items-baseline gap-x-2.5`}>
              {i > 0 ? (
                <span aria-hidden className="text-slate-500">
                  ·
                </span>
              ) : null}
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <Link href={`/projects/${p.slug}`} className={FILM_LINK} aria-label={`Case study: ${p.title}`}>
          Case study <span aria-hidden>→</span>
        </Link>
        {p.githubUrl ? external(p.githubUrl, "GitHub", p.title) : null}
        {p.demoUrl ? external(p.demoUrl, "Live demo", p.title) : null}
      </p>
    </Reveal>
  );
}

/** Non-featured projects as a plain list after the cards (none today, so no body). */
function MoreProjects() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
      <h3 className={MONO_LABEL}>More projects</h3>
      <ul className="mt-4 space-y-4">
        {MORE.map((p) => (
          <FlowReveal as="li" key={p.slug}>
            <Link href={`/projects/${p.slug}`} className={`${FILM_LINK} normal-case`}>
              {p.title} <span aria-hidden>→</span>
            </Link>
            <p className={`mt-1 ${BODY_TEXT}`}>{p.description}</p>
          </FlowReveal>
        ))}
      </ul>
    </div>
  );
}

/**
 * 04 Projects (§2f): rack-04 opens the server; plate 04 at f32 (nav → Projects), lifting at f37 for the long
 * flight to the heading at f80 while the server slides out and the air cover clears the heat sinks
 * (f72–86); the h2, "● SERVER" and the lede; then the two featured projects, one on each heat sink. No filter
 * chips and no duplicate list (a "More projects" list returns as the body when a non-featured project
 * exists).
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
      body={MORE.length ? <MoreProjects /> : undefined}
    >
      <BlockTone top={0.54} />
      <FrameBand from={0.14} to={0.26} x={0.18} right={0.74} stackedTop={0.54}>
        <ChapterHead
          n={PLATE.n}
          title={PLATE.headingText}
          support={PLATE.machine}
          lede="Portfolio-grade builds with real security, reliability, and observability. Click into a case study for architecture + tradeoffs."
        />
      </FrameBand>
      <FrameBand from={0.3} to={0.8} after={0.26}>
        <FrameColumns
          anchors={HEATSINKS}
          width={CARD_WIDTH}
          items={FEATURED.map((p, k) => ({
            key: p.slug,
            node: <ProjectItem p={p} at={C.items[Math.min(k, C.items.length - 1)]} />,
          }))}
        />
      </FrameBand>
    </FilmChapter>
  );
}

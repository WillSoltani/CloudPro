"use client";

import type { CSSProperties } from "react";
import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand, FrameSplit } from "@/components/film/FrameLayout";
import { Reveal } from "@/components/film/Reveal";
import { CHOREO, type FrameWindow } from "@/components/film/choreo";
import { fhOf, fwOf, fx, fy } from "@/components/film/frameBox";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf } from "@/components/film/reel";
import { GROUP_TITLE, ITEM_META, MONO_LABEL } from "@/components/film/sectionTokens";
import { boxHalo, columnTone, sideTone, sideToneMask } from "@/components/film/tones";
import { experience, type ExperienceItem } from "@/content/experience";

const FILM = REEL[REEL_INDEX.experience];
const C = CHOREO.experience;
const PLATE = RACK_CAPTIONS.plates[4];

/**
 * Column tones over the fog (framed layouts only; the contrast gate C16, slate-300 ≥ 7:1, slate-400 ≥ 4.5:1):
 * a side tone behind the head and Work, night 0.9 flat to frame x 0.29, then a long shallow fall (0.53 under
 * the lines' right ends at x 0.42) to clear at the tower's axis (x 0.50), so it reads as shade rather than a
 * panel while the lamp (0.50, 0.35) and its beam stay unshaded; its foot fades evenly to clear at y 0.70 (the
 * lake). And a radial one behind Education (x 0.52–1.0, y 0.04–0.34), above the beam.
 */
const WORK_X: readonly [number, number] = [-0.1, 0.5];
const WORK_Y: readonly [number, number] = [-0.06, 0.7];
const WORK_TONE: CSSProperties = {
  position: "absolute",
  zIndex: -1, // under the text: an absolute layer would otherwise paint over the in-flow heading
  left: fx(WORK_X[0]),
  top: fy(WORK_Y[0]),
  width: fwOf(WORK_X[1] - WORK_X[0]),
  height: fhOf(WORK_Y[1] - WORK_Y[0]),
  backgroundImage: sideTone(0.9, WORK_X[0], WORK_X[1]),
  maskImage: sideToneMask(WORK_Y[0], WORK_Y[1]),
};
const EDU_TONE: CSSProperties = {
  position: "absolute",
  zIndex: -1,
  left: fx(0.52),
  top: fy(0.04),
  width: fwOf(0.48),
  height: fhOf(0.3),
  backgroundImage: columnTone(0.6),
};

/**
 * Small frames (fh < 880 px: 1280×800, 1366×768 and shorter laptop windows), where the fixed-px type fills
 * more of the frame and the columns would run onto the skyline (Work) or the beam (Education): the bullets
 * scale with the frame (16/26 px at fh ≥ 900, 15/22 px at 768: Geist Sans 15–16 px, §2g), the entries
 * tighten (`wide-small`), Work starts at frame x 0.05 (it wraps to 8 lines, not 10), Education sits at the
 * band's top, and each block over bright fog gets a soft box halo that follows it (tones.ts boxHalo):
 * Work's bullets night 0.75 over the left of the column, clear before the tower and 84 px below the last
 * line (above the lake); Education's blocks a light 0.25, clear 26 px below their last line (above the beam).
 * Larger frames keep the radial halo.
 *
 * The short laptop windows (`wide-tight`: ≤ 760 px tall, or cropped by an aspect ≥ 1.85: 1366×657,
 * 1440×700–775, 1536×730, 1280×650–720), where the 96 px header line falls at frame y 0.13–0.19: each
 * entry's label sits beside its title on one baseline, the bullets are 15/21 px with 3 px between them,
 * Work starts at frame x 0.03 and ends above the lake with its halo's foot (the halo flat to 70 % of the
 * column there, since its line ends sit over the skyline beside the tower), and Education spans x 0.58–0.97
 * (its meta on one line) with its two bullets set inline after it, so it ends by frame y 0.31, above the beam.
 */
const BULLET_TEXT =
  "text-[15px] leading-relaxed text-pretty text-slate-200 wide:text-[length:clamp(15px,calc(var(--fh)*0.01778),16px)] wide:leading-[clamp(21px,calc(var(--fh)*0.0289),26px)] wide-tight:text-[15px] wide-tight:leading-[21px]";
const WORK_BULLETS_BOX = boxHalo(0.75, [24, 0, 84, 40], "left", "wide") as CSSProperties;
const EDU_BOX = boxHalo(0.25, [40, 70, 26, 70]) as CSSProperties;

type EntryHalos = { head?: CSSProperties; bullets?: CSSProperties };

function Entry({
  label,
  items,
  at,
  pin,
  halos = {},
  inlineTight = false,
}: {
  label: string;
  items: readonly ExperienceItem[];
  at: FrameWindow;
  pin?: FrameWindow;
  /** Small-frame box halos per block (the radial halo elsewhere). */
  halos?: EntryHalos;
  /** On the short laptop windows, set the bullets inline after the meta line (still a list). */
  inlineTight?: boolean;
}) {
  return (
    <div>
      {items.map((it) => (
        <div key={`${it.org}-${it.title}`}>
          <Reveal
            at={at}
            data-halo={halos.head ? "box" : ""}
            style={halos.head}
            className="wide-tight:flex wide-tight:flex-wrap wide-tight:items-baseline wide-tight:gap-x-3"
          >
            <p className={MONO_LABEL}>{label}</p>
            <h3 className={`mt-2 ${GROUP_TITLE} wide-small:mt-1 wide-small:leading-[1.25] wide-tight:mt-0`}>
              {it.title}
            </h3>
            <p className={`mt-1.5 ${ITEM_META} wide-small:mt-1 wide-tight:basis-full`}>
              {[it.org, it.location, it.dates].filter(Boolean).join(" · ")}
            </p>
          </Reveal>
          <Reveal pin={pin} data-halo={halos.bullets ? "box" : ""} style={halos.bullets}>
            <ul
              data-inline-tight={inlineTight ? "" : undefined}
              className={`mt-3 list-disc space-y-2 pl-4 marker:text-slate-500 wide-small:mt-2 wide-small:space-y-1 wide-tight:mt-1.5 wide-tight:space-y-[3px]${
                inlineTight ? " wide-tight:list-none wide-tight:pl-0" : ""
              }`}
            >
              {it.bullets.map((b) => (
                <li key={b} className={inlineTight ? `${BULLET_TEXT} wide-tight:inline` : BULLET_TEXT}>
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      ))}
    </div>
  );
}

/**
 * 05 Experience on the tower (§2f, tower-01: the bridge out of the fog and the city's lights): the bridge half carries
 * nothing; "05" as the lamp resolves (L), the name just after (nav → Experience at L); Work as the first
 * wave of the city's windows comes on, Education with the second; the bullets on the read pin while tower-K3
 * breathes (the key's push about the lamp); release.
 *
 * Desktop: head x 0.08, y 0.10 · Work x 0.08–0.42 from y 0.18 over a column tone (the stand-in's fog is
 * bright) · Education x 0.58–0.92 from y 0.12, above the beam · the lake (y 0.70+) clear. Phones (the
 * landscape film cover-fitted: x 0.37–0.63): one block from y 0.62; the Work header in it, the rest flows.
 */
export function ExperienceSection() {
  const [workAt, eduAt] = C.items;
  const [workPin, eduPin] = C.pins ?? [];
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={C}
      section={PLATE.section}
      breath={breathOf(FILM)}
      join
      dissolveIn={0.2}
    >
      {/* The column tone arrives with the Work header, never ahead of it (alone it reads as a smudge). */}
      <Reveal at={workAt} y={0} passive aria-hidden="true" data-framed-only="" style={WORK_TONE} />
      <Reveal at={eduAt} y={0} passive aria-hidden="true" data-framed-only="" style={EDU_TONE} />
      <BlockTone top={0.62} />
      <FrameBand from={0.1} to={0.7} stackedTop={0.62}>
        <FrameSplit
          left={[0.08, 0.42]}
          right={[0.58, 0.92]}
          rightTop={0.02}
          smallLeft={0.05}
          smallRightTop={0}
          tight={{ left: 0.03, right: [0.58, 0.97] }}
        >
          {[
            <div key="left">
              <ChapterHead n={PLATE.n} title={PLATE.headingText} plateTarget={false} h2ClassName="wide-tight:text-[2.25rem]" />
              <div className="mt-6 wide:mt-[calc(var(--fh)*0.02)] wide-tight:mt-2">
                <Entry label="Work" items={experience.work} at={workAt} pin={workPin} halos={{ bullets: WORK_BULLETS_BOX }} />
              </div>
            </div>,
            <Entry
              key="right"
              label="Education"
              items={experience.education}
              at={eduAt}
              pin={eduPin}
              halos={{ head: EDU_BOX, bullets: EDU_BOX }}
              inlineTight
            />,
          ]}
        </FrameSplit>
      </FrameBand>
    </FilmChapter>
  );
}

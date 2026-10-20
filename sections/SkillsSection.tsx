"use client";

import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand, FrameRows } from "@/components/film/FrameLayout";
import { Reveal } from "@/components/film/Reveal";
import { RackPlate } from "@/components/film/RackPlate";
import { CHOREO } from "@/components/film/choreo";
import { fwOf } from "@/components/film/frameBox";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf, tailOf } from "@/components/film/reel";
import { GROUP_TITLE, ITEM_META, SEP_DOT, SEP_ITEM, SEP_LIST } from "@/components/film/sectionTokens";
import { skillCategories } from "@/content/skills";

const FILM = REEL[REEL_INDEX.skills];
const C = CHOREO.skills;
const PLATE = RACK_CAPTIONS.plates[2];
/**
 * The five text rows' y centres on the held drawer (the plan's rows, y 0.27–0.88, ≈ 0.12 each). A layout of
 * the page, not of the film: the drawer's own drive rows sit 0.55 of the frame apart at rest (the exported
 * `row_k` anchors: only rows 2 and 3 are in view), so the groups are placed by these bands and timed by the
 * rows' exported beats (choreo.ts).
 */
const ROWS = [0.33, 0.45, 0.57, 0.69, 0.81] as const;
const ROW_PITCH = ROWS[1] - ROWS[0];
const ROWS_FROM = ROWS[0] - ROW_PITCH / 2;
const ROWS_TO = ROWS[ROWS.length - 1] + ROW_PITCH / 2;
/**
 * The head band's end (frame y): 0.015 of the frame above the first row, so a head that the header clearance
 * pushes below its frame y (fh < 960 px, or a frame cropped by a short window) still ends before the rows and
 * they keep their frame y; on windows ≤ 800 px tall the compact head (`wide-short`: the h2 in the title
 * track, "● STORAGE" over the lede in the items track) is what makes it fit, down to 1366×657 where only
 * ≈ 50 px are left between the clearance and the head's end.
 */
const HEAD_TO = ROWS_FROM - 0.015;
/** The rows' two tracks, which the compact head shares (its lede sits on the items column). */
const COLS = { title: fwOf(0.22), gap: fwOf(0.02) };

/**
 * 03 Skills (§2f): rack-03 pulls the storage drawer out; plate 03 at f42 (nav → Skills), lifting at f71 and
 * landing in the heading at f92; one skill group arrives as each drive row clears the rack face; then the
 * h2, "● STORAGE" and the lede; read pin 0.5 vh.
 *
 * Desktop: head x 0.13, y 0.10–0.255 · five rows over the drives, y 0.27–0.87 (0.12 each): the group's
 * title at x 0.13–0.35 (Fraunces), its items at x 0.37–0.87 as one inline mono list. Phones: one block from
 * y 0.54 (clear of the drawer at 0.52) over a 0.75 tone; groups 1–2 in the block, 3–5 flow.
 */
export function SkillsSection() {
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={C}
      section={PLATE.section}
      breath={breathOf(FILM)}
      tail={tailOf(FILM)}
      plate={<RackPlate index={REEL_INDEX.skills} n={PLATE.n} name={PLATE.headingText} handoff />}
    >
      <BlockTone top={0.54} alpha={0.75} />
      <FrameBand from={0.1} to={HEAD_TO} x={0.13} right={0.87} stackedTop={0.54}>
        <ChapterHead
          compact={{ cols: `${COLS.title} minmax(0, 1fr)`, gap: COLS.gap }}
          n={PLATE.n}
          title={PLATE.headingText}
          support={PLATE.machine}
          lede="Five areas I work across, from the cloud bill to the pixel."
        />
      </FrameBand>
      <FrameBand from={ROWS_FROM} to={ROWS_TO} after={HEAD_TO} x={0.13} right={0.87}>
        <FrameRows
          cols={`${COLS.title} minmax(0, 1fr)`}
          gap={COLS.gap}
          rowH={ROW_PITCH}
          from={ROWS_FROM}
          items={skillCategories.map((g, k) => ({
            key: g.title,
            node: (
              <Reveal
                at={C.items[Math.min(k, C.items.length - 1)]}
                stackedPin={C.stacked?.items?.[k] ?? undefined}
                data-halo=""
              >
                <div>
                  <h3 className={GROUP_TITLE}>{g.title}</h3>
                  {/* The row's proof, under its title where the rows are framed (desktop). */}
                  {g.claim ? (
                    <p className="mt-1 hidden text-[13px] leading-snug text-pretty text-slate-300 wide:block">
                      {g.claim}
                    </p>
                  ) : null}
                </div>
                <ul className={`mt-1.5 ${SEP_LIST} wide:mt-0`}>
                  {g.items.map((it, i) => (
                    <li key={it} className={`${ITEM_META.replace("text-slate-300", "text-slate-200")} ${SEP_ITEM}`}>
                      {i > 0 ? (
                        <span aria-hidden className={SEP_DOT}>
                          ·
                        </span>
                      ) : null}
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ),
          }))}
        />
      </FrameBand>
    </FilmChapter>
  );
}

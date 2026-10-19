"use client";

import type { CSSProperties, ReactNode } from "react";
import { useChapter } from "@/components/film/chapterContext";
import { Reveal } from "@/components/film/Reveal";
import {
  CHAPTER_H2,
  CHAPTER_H2_CLIP,
  CHAPTER_H2_PLAIN,
  CHAPTER_H2_PLATE,
  CHAPTER_NAME,
  CHAPTER_NUMBER,
  LEDE,
  PLATE_TARGET,
  PLAIN_TARGET,
  SUPPORT_DOT,
  SUPPORT_LINE,
} from "@/components/film/sectionTokens";

/**
 * The `compact` head's overrides (the `wide-short` variant, app/globals.css): two columns, the h2 (36 px)
 * alone in the first, the support line over the lede in the second, all on one bottom line: the head is the
 * h2's own 49 px (≈ 110 px stacked).
 */
const COMPACT = {
  head: "wide-short:grid wide-short:grid-cols-[var(--head-cols)] wide-short:grid-rows-[1fr_auto] wide-short:gap-x-[var(--head-gap)] wide-short:items-end",
  h2: "wide-short:text-[2.25rem] wide-short:col-start-1 wide-short:row-start-1 wide-short:row-span-2",
  support: "wide-short:mt-0 wide-short:col-start-2 wide-short:row-start-1",
  lede: "wide-short:mt-1 wide-short:leading-[1.25] wide-short:col-start-2 wide-short:row-start-2",
} as const;

/**
 * A chapter's heading block (part five §2c): the one real h2 (`#<id>-title`, the section's label) with the
 * amber number `aria-hidden`; the support line "● MACHINE" (the unit's lit status light); the lede over a
 * halo. Each arrives on the chapter's heading windows (the plate's when it draws, else the unit's amber
 * frame).
 *
 * On the rack the h2's `[data-plate-target]` carries the plate's em metrics so the plate lands in it, and it
 * reveals by opacity only (no rise), so its box is where the plate lands. On the tower (`plateTarget`
 * false) there is no plate: the number and the name arrive on their own windows (`head.number`, `head.h2`).
 */
export function ChapterHead({
  n,
  title,
  support,
  lede,
  plateTarget = true,
  compact,
  className,
}: {
  n: string;
  title: string;
  /** The machine (RACK_CAPTIONS.plates[i].machine); set in caps by CSS. None on the tower. */
  support?: string;
  lede?: ReactNode;
  plateTarget?: boolean;
  /**
   * On windows at most 800 px tall (the `wide-short` variant) the head becomes two columns, `cols` (a CSS
   * grid template) with `gap` between them: the h2 (36 px) in the first, the support line over the lede in
   * the second. For a head whose frame band is tight under the header clearance (Skills: its rows keep their
   * frame y from 1280×800 down to 1366×657, the support line and lede on the rows' item column).
   */
  compact?: { cols: string; gap: string };
  className?: string;
}) {
  const { id, head } = useChapter();
  const number = (
    <span aria-hidden className={CHAPTER_NUMBER}>
      {n}
    </span>
  );
  const name = <span className={CHAPTER_NAME}>{title}</span>;
  return (
    <div
      data-head=""
      className={compact ? `${COMPACT.head}${className ? ` ${className}` : ""}` : className}
      style={compact ? ({ "--head-cols": compact.cols, "--head-gap": compact.gap } as CSSProperties) : undefined}
    >
      <h2
        id={`${id}-title`}
        // Focusable from script only (back-to-top hands focus here when it hides); never a Tab stop.
        tabIndex={-1}
        className={`${
          plateTarget
            ? `${CHAPTER_H2} ${CHAPTER_H2_PLATE} ${CHAPTER_H2_CLIP}`
            : `${CHAPTER_H2} ${CHAPTER_H2_PLAIN}`
        }${compact ? ` ${COMPACT.h2}` : ""}`}
      >
        {plateTarget || !head.number ? (
          <Reveal
            as="span"
            at={head.h2}
            y={0}
            data-plate-target={plateTarget ? "" : undefined}
            className={plateTarget ? PLATE_TARGET : PLAIN_TARGET}
          >
            {/* The space keeps the heading's text "01 About" for crawlers; the flex box drops it from layout. */}
            {number}{" "}
            {name}
          </Reveal>
        ) : (
          <span className={PLAIN_TARGET}>
            <Reveal as="span" at={head.number} y={0}>
              {number}
            </Reveal>{" "}
            <Reveal as="span" at={head.h2} y={6}>
              {name}
            </Reveal>
          </span>
        )}
      </h2>
      {support && head.support ? (
        // The machine's label ("● Security" under Certifications) is part of the picture, not a claim: not read.
        <Reveal
          as="p"
          at={head.support}
          aria-hidden="true"
          className={compact ? `${SUPPORT_LINE} ${COMPACT.support}` : SUPPORT_LINE}
        >
          <span aria-hidden className={SUPPORT_DOT}>
            ●
          </span>
          {support}
        </Reveal>
      ) : null}
      {lede && head.lede ? (
        <Reveal as="p" at={head.lede} data-halo="" className={compact ? `${LEDE} ${COMPACT.lede}` : LEDE}>
          {lede}
        </Reveal>
      ) : null}
    </div>
  );
}

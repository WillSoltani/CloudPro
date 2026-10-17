"use client";

import type { CSSProperties, ReactNode } from "react";
import { columnTracks, fhOf, fx, fy } from "@/components/film/frameBox";
import { blockTone } from "@/components/film/tones";
import { Reveal } from "@/components/film/Reveal";
import { useChapter } from "@/components/film/chapterContext";
import type { FrameWindow } from "@/components/film/choreo";

// Composition primitives (part five §2c). Two layouts from one DOM, switched in app/globals.css:
// - framed: the page's `wide` rule holds and FilmChapter's fit guard has not set
//   `data-compose-mode="stacked"`; bands sit at frame fractions of the landscape film, columns centred on
//   anchors;
// - stacked (phones, portrait tablets, short or narrow desktops): one block from `stackedTop` of the
//   playing film's frame, bands in a single column over the phone block tone.
// Bands are normal flow, so content that does not fit pushes the next band down and never overlaps.

const EDGE = "24px";
/** Nothing in a composition starts above the header's clearance. */
const HEADER_CLEAR = "96px";

/**
 * A horizontal band of the frame, from frame y `from` to `to` (framed). The first band (no `after`) starts
 * at `from` from the composition's top, never above 96 px (the header), and ends at `to` even when that
 * clearance delays its start (its content permitting), so the bands after it keep their frame y; a later
 * band starts `from − after` frame heights below the previous band (whose `to` is `after`). `x` / `right`
 * bound its content in frame x (framed; ≥ 24 px from the viewport edge). Stacked, the first band starts at
 * `stackedTop` of the frame and later ones follow `stackedGap` px below.
 */
export function FrameBand({
  from,
  to,
  after,
  x,
  right,
  stackedTop = 0.62,
  stackedGap = 20,
  className,
  children,
}: {
  from: number;
  to: number;
  after?: number;
  x?: number;
  right?: number;
  stackedTop?: number;
  stackedGap?: number;
  className?: string;
  children: ReactNode;
}) {
  const style = {
    "--band-mt":
      after === undefined ? `max(${HEADER_CLEAR}, ${fy(from)})` : fhOf(Math.max(0, from - after)),
    "--band-min":
      after === undefined
        ? `max(0px, calc(${fy(to)} - max(${HEADER_CLEAR}, ${fy(from)})))`
        : fhOf(Math.max(0, to - from)),
    "--band-mt-s": after === undefined ? `max(${HEADER_CLEAR}, ${fy(stackedTop)})` : `${stackedGap}px`,
    ...(x !== undefined ? { "--band-pl": `max(${EDGE}, ${fx(x)})` } : {}),
    ...(right !== undefined ? { "--band-max": `min(calc(100cqw - ${EDGE}), ${fx(right)})` } : {}),
  } as CSSProperties;
  return (
    <div data-band="" className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * A row of columns centred on frame x `anchors` (e.g. the four cartridges), each `width` of the frame
 * wide (framed); a single column of rows when stacked. Renders a real list: each item an `<li>`
 * (`data-fit`: the fit guard checks it stays ≥ 24 px inside the viewport).
 */
export function FrameColumns({
  anchors,
  width,
  items,
  className,
}: {
  anchors: readonly number[];
  width: number;
  items: readonly { key: string; node: ReactNode }[];
  className?: string;
}) {
  return (
    <ul
      data-columns=""
      className={className}
      style={{ "--cols": columnTracks(anchors, width) } as CSSProperties}
    >
      {items.map((item, k) => (
        <li key={item.key} data-col="" data-fit="" style={{ "--col": String(2 * k + 2) } as CSSProperties}>
          {item.node}
        </li>
      ))}
    </ul>
  );
}

/**
 * The phone block tone behind a stacked composition: clear above `top` (frame y of the playing film),
 * feathering to night 0.85 over 160 px and flat to the composition's end; it arrives with the block on
 * the smoothed clock (`at`, default the four frames before the heading). Hidden when framed.
 */
export function BlockTone({
  top,
  at,
  alpha,
}: {
  top: number;
  at?: FrameWindow;
  /** The tone's flat alpha (default tones.ts BLOCK_ALPHA 0.85; Skills 0.75). */
  alpha?: number;
}) {
  const { head } = useChapter();
  return (
    <Reveal
      at={at ?? [head.h2[0] - 4, head.h2[0]]}
      y={0}
      passive
      aria-hidden="true"
      data-block-tone=""
      style={{ backgroundImage: blockTone(`max(${HEADER_CLEAR}, ${fy(top)})`, alpha) }}
    />
  );
}

/**
 * Rows across the frame (Skills' five groups over the drives): each row a title track and a body track
 * (`cols`, CSS lengths, e.g. fwOf(0.22) and 1fr) at least `rowH` (frame-height fraction) tall when framed;
 * stacked, each row is a title above its body. A real list: each item an `<li>` whose one child (usually
 * its Reveal) becomes the two-track grid.
 */
export function FrameRows({
  cols,
  gap,
  rowH,
  from,
  items,
  className,
}: {
  cols: string;
  gap: string;
  rowH: number;
  /** Frame y of the first row's top: each row's band centre is from + (k + ½)·rowH (`data-row-y`, the fit guard's check). */
  from: number;
  items: readonly { key: string; node: ReactNode }[];
  className?: string;
}) {
  return (
    <ul
      data-rows=""
      className={className}
      style={{ "--row-cols": cols, "--row-gap": gap, "--row-h": fhOf(rowH) } as CSSProperties}
    >
      {items.map((item, k) => (
        <li key={item.key} data-row="" data-row-y={+(from + (k + 0.5) * rowH).toFixed(4)} data-fit="">
          {item.node}
        </li>
      ))}
    </ul>
  );
}

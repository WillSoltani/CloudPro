"use client";

import type { CSSProperties, ReactNode } from "react";
import { columnTracks, fhOf, fwOf, fx, fy } from "@/components/film/frameBox";
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

/**
 * Two columns at frame x [left[0], left[1]] and [right[0], right[1]] (framed; the right one offset down by
 * `rightTop` frame heights relative to the left), one column when stacked (Experience: Work beside
 * Education). On small frames (fh < 880 px, the `wide-small` variant) the left column may start at
 * `smallLeft` instead (wider, so it wraps less) and the right one sit `smallRightTop` down; on the short
 * laptop windows (`wide-tight`) the left one may start at `tight.left` and the right span `tight.right`.
 * Children: exactly two nodes, left then right.
 */
export function FrameSplit({
  left,
  right,
  rightTop = 0,
  smallLeft,
  smallRightTop,
  tight,
  children,
}: {
  left: readonly [number, number];
  right: readonly [number, number];
  rightTop?: number;
  smallLeft?: number;
  smallRightTop?: number;
  tight?: { left: number; right: readonly [number, number] };
  children: readonly [ReactNode, ReactNode];
}) {
  // Each column keeps its frame x where it can and is cut back (never moved) where the frame runs past the
  // viewport's 24 px edges on 4:3-ish windows: the left one starts at ≥ 24 px and still ends on left[1], the
  // right one starts on right[0] and ends ≤ 24 px from the right edge.
  const cols = (x0: number, r: readonly [number, number] = right) => {
    const lead = `max(${EDGE}, ${fx(x0)})`;
    return [
      lead,
      `min(${fwOf(left[1] - x0)}, calc(${fx(left[1])} - ${lead}))`,
      fwOf(r[0] - left[1]),
      `min(${fwOf(r[1] - r[0])}, calc(100cqw - ${EDGE} - ${fx(r[0])}))`,
    ].join(" ");
  };
  const style = {
    "--split-cols": cols(left[0]),
    "--split-right-mt": fhOf(rightTop),
    ...(smallLeft !== undefined ? { "--split-cols-s": cols(smallLeft) } : {}),
    ...(smallRightTop !== undefined ? { "--split-right-mt-s": fhOf(smallRightTop) } : {}),
    ...(tight ? { "--split-cols-t": cols(tight.left, tight.right) } : {}),
  } as CSSProperties;
  return (
    <div data-split="" style={style}>
      <div data-split-left="" data-fit="">
        {children[0]}
      </div>
      <div data-split-right="" data-fit="">
        {children[1]}
      </div>
    </div>
  );
}

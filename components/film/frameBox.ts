// Frame maths for chapter compositions (part five §2c), as CSS: where the film frame lands in a chapter's sticky
// composition box, so HTML can be placed at frame fractions and stay on the picture at every viewport. It must agree
// with placement.ts placement(), where the canvas paints the frame (tested: components/film/frameBox.test.ts, run by
// `npm run test:film-unit`). Pure.
//
// The variables, declared on `[data-compose]` (a `container-type: inline-size` box as wide as the canvas, pinned at
// the viewport's top like the film layers), with S the stage (`var(--film-svh, 100svh)`) and L the film layers'
// height (`var(--film-lvh, 100lvh)`):
//   --fa   the playing film's aspect: --fa-l (landscape) where the page's `wide` rule holds, else --fa-p
//          (app/globals.css picks it by the same media query FilmBackdrop's orientation pick uses)
//   --fw   max(100cqw, (S + (L − S) / (1 − focusY)) · fa)    the frame's width in px (placement.ts)
//   --fh   fw / fa                                            its height
//   --fx0  (100cqw − fw) · focusX                             its left edge (negative when cropped)
//   --fy0  (S − fh) · focusY                                  its top edge
// The canvas is `fixed`, as tall as the large viewport and as wide as the box; the picture is the stage's cover fit
// (grown where it would not cover the canvas), so where L = S (desktop) these are the cover fit of 100cqw x 100svh.

// The `.ts` extension is for Node's type stripping (the test runs this file as it stands); see homography.ts.
// @ts-expect-error TS5097: Node's type stripping resolves only the full file name.
import { SVH, stageHeightCss } from "./placement.ts";

/** The film aspects (frame width / height) of the two cameras: 1920 × 1080 and 1080 × 2340. */
export const FILM_ASPECT = { landscape: 1920 / 1080, portrait: 1080 / 2340 } as const;

const num = (v: number) => String(+v.toFixed(5));

/**
 * The frame variables for a composition box, as an inline style object. `focus` is the reel's crop point
 * (FilmBackdrop REEL_FOCUS); `aspect` overrides the camera aspects (e.g. a film's natural size ratio).
 */
export function frameVars(
  focus: readonly [number, number],
  aspect: { landscape: number; portrait: number } = FILM_ASPECT,
): Record<string, string> {
  return {
    "--fa-l": num(aspect.landscape),
    "--fa-p": num(aspect.portrait),
    "--fw": `max(100cqw, calc(${stageHeightCss(focus)} * var(--fa)))`,
    "--fh": "calc(var(--fw) / var(--fa))",
    "--fx0": `calc((100cqw - var(--fw)) * ${num(focus[0])})`,
    "--fy0": `calc((${SVH} - var(--fh)) * ${num(focus[1])})`,
  };
}

/** CSS length of frame x-fraction `x` from the box's left edge. */
export const fx = (x: number) => `calc(var(--fx0) + var(--fw) * ${num(x)})`;
/** CSS length of frame y-fraction `y` from the box's top edge. */
export const fy = (y: number) => `calc(var(--fy0) + var(--fh) * ${num(y)})`;
/** CSS length of a frame-width fraction. */
export const fwOf = (w: number) => `calc(var(--fw) * ${num(w)})`;
/** CSS length of a frame-height fraction. */
export const fhOf = (h: number) => `calc(var(--fh) * ${num(h)})`;

/** The same placement in px where lvh = svh (QA, desktop): frame point (x, y) in a vw × vh box (placement.ts placementPoint). */
export function framePoint(
  vw: number,
  vh: number,
  aspect: number,
  focus: readonly [number, number],
  [x, y]: readonly [number, number],
): [number, number] {
  const w = Math.max(vw, vh * aspect);
  const h = w / aspect;
  return [(vw - w) * focus[0] + w * x, (vh - h) * focus[1] + h * y];
}

/**
 * FrameColumns' `grid-template-columns`: 2n tracks, per anchor a lead or gap then a column centred on the
 * anchor's x. The column is `width` of the frame, narrowed where needed so the outer columns keep `edge` px
 * from the viewport's sides (the frame is cropped on 4:3-ish windows: at 1024×768 the four cartridges' outer
 * columns would otherwise run past the edge). Negative gaps clamp at 0 (the fit guard then stacks).
 */
export function columnTracks(anchors: readonly number[], width: number, edge = 24): string {
  return columnTrackList(anchors, width, edge).join(" ");
}

/** The column width as CSS: `width` of the frame, at most twice the room between each outer anchor and its edge. */
export function columnWidth(anchors: readonly number[], width: number, edge = 24): string {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  return `min(${fwOf(width)}, calc(2 * (100cqw - ${edge}px - ${fx(last)})), calc(2 * (${fx(first)} - ${edge}px)))`;
}

/** columnTracks() as a list, one CSS length per track. */
export function columnTrackList(anchors: readonly number[], width: number, edge = 24): string[] {
  const w = columnWidth(anchors, width, edge);
  const tracks: string[] = [];
  anchors.forEach((a, k) => {
    tracks.push(
      k === 0
        ? `max(0px, calc(${fx(a)} - ${w} / 2))`
        : `max(0px, calc(var(--fw) * ${num(a - anchors[k - 1])} - ${w}))`,
    );
    tracks.push(w);
  });
  return tracks;
}

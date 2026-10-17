// Frame maths for chapter compositions (part five §2c), as CSS: where the cover-fitted film frame lands in
// a chapter's sticky composition box, so HTML can be placed at frame fractions and stay on the picture at
// every viewport. It must agree with filmBase coverRect(), the
// canvas's own fit (tested: components/film/frameBox.test.mjs). Pure and erasable TypeScript, so Node's
// type stripping runs the test on this file as it stands:
//   node --experimental-strip-types --test components/film/frameBox.test.mjs
//
// The variables, declared on `[data-compose]` (a `container-type: inline-size` box as wide as the canvas):
//   --fa   the playing film's aspect: --fa-l (landscape) where the page's `wide` rule holds, else --fa-p
//          (app/globals.css picks it by the same media query FilmBackdrop's orientation pick uses)
//   --fw   max(100cqw, 100dvh · fa)          the frame's width in px (cover fit)
//   --fh   fw / fa                            its height
//   --fx0  (100cqw − fw) · focusX             its left edge (negative when cropped)
//   --fy0  (100dvh − fh) · focusY             its top edge
// The canvas is `fixed h-dvh w-full`, so dvh and the box's inline size are its exact size.

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
    "--fw": "max(100cqw, 100dvh * var(--fa))",
    "--fh": "calc(var(--fw) / var(--fa))",
    "--fx0": `calc((100cqw - var(--fw)) * ${num(focus[0])})`,
    "--fy0": `calc((100dvh - var(--fh)) * ${num(focus[1])})`,
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

/** The same placement in px (the guard, QA): frame point (x, y) in a vw × vh box. */
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

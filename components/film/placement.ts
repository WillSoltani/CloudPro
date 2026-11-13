// Where the film's picture lands on the fixed film layers, in one place (pure: no React, no DOM; erasable
// TypeScript, so Node's type stripping runs it as it stands). FilmBackdrop's draw() and its hold-key layers,
// PerspectivePlate, RideAnchor, FilmChapter's fit guard, the frame variables (frameBox.ts) and the hero poster
// (FilmSegment.tsx) all place the picture with it, so no overlay can drift from the canvas.
//
// The geometry. A phone's browser toolbar moves while the viewer scrolls: the dynamic viewport (dvh) runs between
// the small viewport (svh, toolbar shown) and the large one (lvh, toolbar hidden). The fixed film layers (the canvas,
// the hold keys, the plate layer) are as tall as the LARGE viewport and anchored at the top, so their size never
// changes while the toolbar moves (no backing-store reallocation, no redraw, no re-layout). The picture is placed
// where the cover fit of the SMALL-viewport stage (layer width x svh, focus REEL_FOCUS) puts it, which is where it
// was at first view before (the toolbar is shown on load, so dvh was svh then), and it stays there whatever the
// toolbar does. Where that fit would leave the bottom of the layer uncovered (a tall, narrow, height-limited
// viewport), the scale grows by the minimum that covers it, keeping the focus point where the stage's fit put it.
// On desktop there is no dynamic toolbar (lvh = svh = dvh) and the placement is coverRect() itself, operation for
// operation.

import type { CoverRect } from "./filmBase.ts";

/**
 * The picture's height before the width term: the stage's height `svh`, grown where the stage's fit would not reach
 * the bottom of the `lvh`-tall layer. With focus y = fy, the frame's y-fraction fy sits at svh·fy on the stage; a
 * frame of height h placed there spans (svh − h)·fy … (svh − h)·fy + h, which reaches lvh when
 * h ≥ svh + (lvh − svh) / (1 − fy). Exactly `svh` when lvh ≤ svh (desktop), so the placement is coverRect's own.
 */
export function stageHeight(lvh: number, svh: number, fy: number): number {
  if (!(lvh > svh) || !(fy < 1)) return svh;
  return svh + (lvh - svh) / (1 - fy);
}

/**
 * The picture's rectangle in a layer `width` x `lvh` (CSS px of the fixed film layers) for a frame of `aspect`
 * (width / height; the image's natural ratio where known), with the stage `svh` tall at the layer's top and the
 * reel's `focus` (x, y in 0–1). With svh ≥ lvh (desktop) it is filmBase coverRect(width, lvh, aspect, focus) exactly.
 * A missing stage (svh ≤ 0) is the layer itself.
 */
export function placement(
  width: number,
  lvh: number,
  svh: number,
  aspect: number,
  focus: readonly [number, number],
): CoverRect {
  const stage = svh > 0 && svh < lvh ? svh : lvh;
  const w = Math.max(width, stageHeight(lvh, stage, focus[1]) * aspect);
  const h = w / aspect;
  return { left: (width - w) * focus[0], top: (stage - h) * focus[1], width: w, height: h };
}

/**
 * The same placement on the canvas backing store (device px for draw()): the layer is `backingW` x `backingH`
 * backing px for `layerH` CSS px of height, the stage `svh` CSS px. With svh ≥ layerH (desktop) the stage is the
 * whole backing height, so this is coverRect(backingW, backingH, aspect, focus), the call draw() made before.
 */
export function backingPlacement(
  backingW: number,
  backingH: number,
  layerH: number,
  svh: number,
  aspect: number,
  focus: readonly [number, number],
): CoverRect {
  const stage = svh > 0 && layerH > 0 && svh < layerH ? svh * (backingH / layerH) : backingH;
  return placement(backingW, backingH, stage, aspect, focus);
}

/** Frame point (x, y in frame fractions) on the layer, in the layer's px: where the canvas paints it. */
export function placementPoint(
  width: number,
  lvh: number,
  svh: number,
  aspect: number,
  focus: readonly [number, number],
  [x, y]: readonly [number, number],
): [number, number] {
  const r = placement(width, lvh, svh, aspect, focus);
  return [r.left + r.width * x, r.top + r.height * y];
}

// The CSS side. The layers' heights and the stage's are CSS variables with a fallback, so a test can simulate the
// toolbar's states (`--film-lvh`, `--film-svh` on :root); nothing sets them in production.

/** The large viewport's height in CSS (the fixed film layers' height). */
export const LVH = "var(--film-lvh, 100lvh)";
/** The small viewport's height in CSS (the stage: the svh probe, sections, the clock). */
export const SVH = "var(--film-svh, 100svh)";

/**
 * Height classes (Tailwind; whole literals so the scanner sees them): the fixed film layers are as tall as the large
 * viewport, the stage probe as the small one; where the browser has no lvh/svh, 100vh.
 */
export const LAYER_HEIGHT_CLASS = "h-screen supports-[height:100lvh]:h-[var(--film-lvh,100lvh)]";
export const STAGE_HEIGHT_CLASS = "h-screen supports-[height:100svh]:h-[var(--film-svh,100svh)]";

const num = (v: number) => String(+v.toFixed(5));

/** stageHeight() in CSS: the picture's height before the width term. */
export function stageHeightCss(focus: readonly [number, number]): string {
  return `(${SVH} + (${LVH} - ${SVH}) / ${num(1 - focus[1])})`;
}

/**
 * CSS variables for elements that place the picture with the browser's own cover fit (`object-fit: cover` or
 * `background-size: cover` at REEL_OBJECT_POSITION) instead of px from placement():
 *   --film-stage-h    stageHeight(): a box this tall …
 *   --film-stage-top  … whose top is this far above the layer's top, cover-fitted at the focus, puts the picture
 *                     exactly where placement() does (the hero poster): its height is max(width / aspect, stage-h)
 *                     and its top (stage-h − h)·fy + stage-top = (svh − h)·fy.
 *   --film-stage-pad  lvh − svh: as padding-bottom with `background-origin: content-box`, a layer's cover fit is the
 *                     stage's (the hold keys before the backdrop has set their px; exact unless the scale grows).
 * All three are the plain stage (svh, 0, 0) where lvh = svh.
 */
export function stageVars(focus: readonly [number, number]): Record<string, string> {
  const fy = focus[1];
  return {
    "--film-stage-h": `calc${stageHeightCss(focus)}`,
    "--film-stage-top": `calc((${SVH} - ${LVH}) * ${num(fy)} / ${num(1 - fy)})`,
    "--film-stage-pad": `calc(${LVH} - ${SVH})`,
  };
}

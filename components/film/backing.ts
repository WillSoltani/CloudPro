// Pure (no React, no DOM): the canvas backing-store size and the page-load flag that restores the old rule.

/** Device pixel ratio above this adds fill, not detail: the film's frames are far below 3x a phone's CSS box. */
export const MAX_DPR = 2;

/**
 * Canvas backing store for a box of boxW x boxH CSS px: device pixels, the pixel ratio capped at MAX_DPR, and
 * never wider than `maxW`, the widest frame tier in use (a Retina 2880 px canvas painting 1920 px frames only
 * upsamples them and costs 2.25x the fill). The aspect of the box is kept (both sides use one scale, each
 * rounded), and a box with no area gives 0 x 0. Ported from the memory-palace sister project (scrub.ts).
 */
export function backingSize(boxW: number, boxH: number, dpr: number, maxW: number): { w: number; h: number } {
  if (!(boxW > 0) || !(boxH > 0)) return { w: 0, h: 0 };
  const cap = maxW > 0 ? maxW / boxW : Infinity;
  const scale = Math.min(dpr > 0 ? Math.min(dpr, MAX_DPR) : 1, cap);
  return { w: Math.round(boxW * scale), h: Math.round(boxH * scale) };
}

/**
 * The widest cap for this page load, which only ever grows: `inUse` is the widest frame tier of the segments that
 * have joined (0 while none has) and `prev` the cap used so far. Before any segment has joined, `reelMax` (the widest
 * width any manifest in the reel offers for this orientation) stands in, so the first paint is never undersized.
 * A retier to a smaller tier lowers `inUse` but never the cap.
 */
export function growCap(prev: number, inUse: number, reelMax: number): number {
  return Math.max(prev, inUse > 0 ? inUse : reelMax);
}

/** `?backing=full` in the URL restores the old size rule (round(CSS size x capped DPR), no width cap) for this page load. */
export function wantsFullBacking(search: string): boolean {
  return new URLSearchParams(search).get("backing") === "full";
}

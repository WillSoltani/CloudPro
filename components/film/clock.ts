// The reel clock's arithmetic (pure: no React, no DOM), split out of FilmBackdrop so the per-scroll path reads only
// window.scrollY. The layout it needs (each segment's document top and height, the viewport, svh, the page height)
// is measured when it can change (a viewport change, a content resize, load, fonts, a registry change) and cached;
// per scroll event, rawClock() turns the cached geometry and scrollY into the clock. The numbers are the ones the
// old per-scroll measure() computed from getBoundingClientRect() (tested: clock.test.ts), since a segment's
// viewport top is its document top − scrollY and every other quantity is a difference of tops.
//
// The clock (FilmBackdrop's doc, part five §2a): for each segment whose top has reached the viewport top, y = −top,
// m = its camera move in px (a chapter's moveVh·svh; a legacy segment's section height − viewport), q = D − m with
// D the distance to the next segment's top (or to the end of the page), μ = m / (m + q) and
// u = y < m ? μ·y/m : μ + (1 − μ)·(y − m)/q (clamped 0–1); c is the max of i + u.

/** One registered segment's layout, in document px (top = getBoundingClientRect().top + scrollY at measure time). */
export type SegmentBox = {
  /** Position in the reel. */
  index: number;
  top: number;
  height: number;
  /** A chapter's camera move in svh (FilmChapter); undefined for a legacy segment (move = height − viewport). */
  moveVh?: number;
  /** A chapter's read pin in svh. */
  readVh?: number;
};

/** What the clock needs besides the segments: the root's clientHeight, the stage (svh probe) and the page height. */
export type ClockGeometry = { viewport: number; svh: number; scrollHeight: number };

/** A segment's clock unit, derived from the cached geometry (FilmBackdrop's Segment fields of the same names). */
export type SegmentMetrics = {
  /** The camera move m in px. */
  range: number;
  /** q = D − m in px. */
  after: number;
  /** μ = m / (m + q). */
  mu: number;
  /** The read pin in px (0 without one). */
  read: number;
  /** The next segment starts where this one ends. */
  adjacent: boolean;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The metrics of `boxes` (sorted by index), independent of the scroll position. */
export function segmentMetrics(boxes: readonly SegmentBox[], g: ClockGeometry): SegmentMetrics[] {
  // Scroll from the document's top to the end of the page, for the last segment's D.
  const end = g.scrollHeight - g.viewport;
  return boxes.map((b, k) => {
    const next = boxes[k + 1];
    const range = Math.max(0, b.moveVh !== undefined ? b.moveVh * g.svh : b.height - g.viewport);
    const distance = next ? next.top - b.top : end - b.top;
    const after = Math.max(0, distance - range);
    return {
      range,
      after,
      mu: range + after > 0 ? range / (range + after) : 1,
      read: b.readVh ? Math.min(after, b.readVh * g.svh) : 0,
      adjacent: !!next && Math.abs(next.top - (b.top + b.height)) < 1,
    };
  });
}

/** u: a segment's share of its clock unit at y px past its top. */
export function uOf(m: Pick<SegmentMetrics, "range" | "after" | "mu">, y: number): number {
  if (y <= 0) return 0;
  if (m.range > 0 && y < m.range) return (m.mu * y) / m.range;
  if (m.after <= 0) return 1;
  return clamp01(m.mu + ((1 - m.mu) * (y - m.range)) / m.after);
}

/** The raw clock c at `scrollY` from the cached boxes and their metrics (same order). */
export function rawClock(boxes: readonly SegmentBox[], metrics: readonly SegmentMetrics[], scrollY: number): number {
  let c = 0;
  for (let k = 0; k < boxes.length; k++) {
    const top = boxes[k].top - scrollY;
    if (top > 0) continue; // not started
    c = Math.max(c, boxes[k].index + uOf(metrics[k], -top));
  }
  return c;
}

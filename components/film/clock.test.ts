// Tests for components/film/clock.ts (pure) and components/film/viewport.ts's comparison. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rawClock, segmentMetrics, type SegmentBox } from "./clock";
import { viewportChanged } from "./viewport";

type Rect = { top: number; bottom: number; height: number };

/**
 * FilmBackdrop's measure() before the cache, verbatim in its arithmetic: viewport rects read on every scroll event.
 * Returns the raw clock and the per-segment fields it wrote.
 */
function oldMeasure(boxes: readonly SegmentBox[], viewport: number, svh: number, scrollHeight: number, scrollY: number) {
  const rects: Rect[] = boxes.map((b) => ({ top: b.top - scrollY, bottom: b.top - scrollY + b.height, height: b.height }));
  const toEnd = scrollHeight - viewport - scrollY;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const out: { range: number; after: number; mu: number; read: number; adjacent: boolean }[] = [];
  let c = 0;
  boxes.forEach((b, k) => {
    const rect = rects[k];
    const next = rects[k + 1];
    const move = Math.max(0, b.moveVh !== undefined ? b.moveVh * svh : rect.height - viewport);
    const distance = next ? next.top - rect.top : toEnd - rect.top;
    const s = { range: move, after: Math.max(0, distance - move), mu: 0, read: 0, adjacent: false };
    s.mu = s.range + s.after > 0 ? s.range / (s.range + s.after) : 1;
    s.read = b.readVh ? Math.min(s.after, b.readVh * svh) : 0;
    s.adjacent = !!next && Math.abs(next.top - rect.bottom) < 1;
    out.push(s);
    if (rect.top > 0) return;
    const y = -rect.top;
    let u: number;
    if (y <= 0) u = 0;
    else if (s.range > 0 && y < s.range) u = (s.mu * y) / s.range;
    else if (s.after <= 0) u = 1;
    else u = clamp01(s.mu + ((1 - s.mu) * (y - s.range)) / s.after);
    c = Math.max(c, b.index + u);
  });
  return { c, out };
}

/** A homepage-like reel: a legacy hero, chapters (one joined over the hero), a hold panel, a legacy exit. */
function reel(svh: number): { boxes: SegmentBox[]; scrollHeight: number } {
  const boxes: SegmentBox[] = [];
  let top = 0;
  const legacy = (index: number, vh: number, gap = 0) => {
    boxes.push({ index, top, height: vh * svh });
    top += vh * svh + gap;
  };
  const chapter = (index: number, moveVh: number, readVh: number, body: number, join = false, gap = 0) => {
    if (join) top -= svh;
    const height = svh + (moveVh + readVh) * svh + body;
    boxes.push({ index, top, height, moveVh, readVh });
    top += height + gap;
  };
  legacy(0, 3.2);
  chapter(1, 2.4, 0.6, 913.5, true);
  chapter(2, 1.75, 0.5, 0, false, 640);
  chapter(3, 2.1, 0.75, 1288);
  chapter(4, 1.2, 0.4, 0, false, 77.25);
  chapter(5, 2.6, 0.5, 402);
  chapter(6, 1.9, 0.5, 0);
  legacy(7, 2.5);
  // Layout positions are whole 1/64 px (LayoutUnit), as getBoundingClientRect() reports them.
  const lu = (v: number) => Math.round(v * 64) / 64;
  return { boxes: boxes.map((b) => ({ ...b, top: lu(b.top), height: lu(b.height) })), scrollHeight: lu(top + 517) };
}

describe("rawClock + segmentMetrics", () => {
  it("compute the numbers the per-scroll measure() computed, at every scroll position", () => {
    for (const [viewport, svh] of [
      [900, 900],
      [800, 800],
      [664, 664],
      [740, 740],
      [390, 390],
    ] as const) {
      const { boxes, scrollHeight } = reel(svh);
      const metrics = segmentMetrics(boxes, { viewport, svh, scrollHeight });
      const max = scrollHeight - viewport;
      // Whole px, 1/64 px (layout units) and the fractional offsets a phone at DPR 3 scrolls by.
      const ys: number[] = [];
      for (let y = 0; y <= max; y += 37) ys.push(y);
      for (let y = 0; y <= max; y += 211.015625) ys.push(y);
      for (let y = 0; y <= max; y += 97 + 1 / 3) ys.push(y);
      for (const b of boxes) ys.push(b.top, b.top - 1, b.top + 1, b.top + (b.moveVh ?? 0) * svh, max);
      for (const y of ys) {
        const old = oldMeasure(boxes, viewport, svh, scrollHeight, y);
        const c = rawClock(boxes, metrics, y);
        // Bit for bit wherever the scroll offset is a whole layout unit; within rounding at a DPR-3 third of a px.
        const exact = Number.isInteger(y * 64);
        const same = (a: number, b: number, what: string) =>
          exact ? assert.equal(a, b, what) : assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
        same(c, old.c, `${viewport}: clock at ${y}`);
        old.out.forEach((o, k) => {
          for (const key of ["range", "after", "mu", "read"] as const) same(metrics[k][key], o[key], `${key} ${k} at ${y}`);
          assert.equal(metrics[k].adjacent, o.adjacent, `adjacent ${k}`);
        });
      }
    }
  });

  it("is 0 above the reel and runs to the last segment's end at the bottom of the page", () => {
    const { boxes, scrollHeight } = reel(800);
    const metrics = segmentMetrics(boxes, { viewport: 800, svh: 800, scrollHeight });
    assert.equal(rawClock(boxes, metrics, 0), 0);
    assert.equal(rawClock(boxes, metrics, scrollHeight - 800), boxes.length);
    assert.equal(rawClock([], [], 500), 0);
  });
});

describe("viewportChanged", () => {
  const v = { width: 390, lvh: 754, svh: 664 };
  it("notifies on the first reading and on a width, large-viewport or stage change", () => {
    assert.equal(viewportChanged(null, v), true);
    assert.equal(viewportChanged(v, { ...v, width: 391 }), true);
    assert.equal(viewportChanged(v, { ...v, lvh: 800 }), true);
    assert.equal(viewportChanged(v, { ...v, svh: 700 }), true);
  });
  it("does not notify for an unchanged reading (a toolbar move changes only the dynamic height)", () => {
    assert.equal(viewportChanged(v, { ...v }), false);
  });
});

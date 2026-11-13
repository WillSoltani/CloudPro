// Tests for components/film/backing.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backingSize, growCap, wantsFullBacking } from "./backing";

/** The size rule FilmBackdrop used before the cap: round(CSS size x DPR capped at 2), at least 1. */
const old = (w: number, h: number, dpr: number) => ({
  w: Math.max(1, Math.round(w * Math.min(dpr || 1, 2))),
  h: Math.max(1, Math.round(h * Math.min(dpr || 1, 2))),
});

describe("backingSize", () => {
  it("caps the DPR at 2 and the width at maxW, rounded", () => {
    assert.deepEqual(backingSize(1440, 900, 2, 1920), { w: 1920, h: 1200 });
    assert.deepEqual(backingSize(1440, 900, 3, 1920), { w: 1920, h: 1200 });
    assert.deepEqual(backingSize(390, 844, 3, 1920), { w: 780, h: 1688 });
    assert.deepEqual(backingSize(390, 844, 3, 432), { w: 432, h: 935 });
    assert.deepEqual(backingSize(390, 844, 3, 499), { w: 499, h: 1080 });
    assert.deepEqual(backingSize(390, 844, 1, 432), { w: 390, h: 844 });
    assert.deepEqual(backingSize(1280, 720, 1, 1920), { w: 1280, h: 720 });
  });

  it("is the old rule wherever the cap does not bite", () => {
    for (const [w, h, d] of [[1440, 900, 1], [1440, 900, 1.25], [1309.09, 818.18, 1.1], [390, 844, 2], [320, 568, 3]] as const) {
      assert.deepEqual(backingSize(w, h, d, 1920), old(w, h, d));
    }
  });

  it("keeps the aspect of the box within one pixel", () => {
    for (const [w, h] of [[1440, 900], [1366, 768], [390, 844], [844, 390], [1309.09, 818.18]] as const) {
      for (const maxW of [432, 499, 768, 1280, 1920]) {
        const r = backingSize(w, h, 2, maxW);
        assert.ok(Math.abs(r.h - (r.w * h) / w) <= 1, `${w}x${h} cap ${maxW}: ${r.w}x${r.h}`);
        assert.ok(r.w <= Math.min(maxW, Math.round(w * 2)) + 1, `${w}x${h} cap ${maxW}: width ${r.w}`);
      }
    }
  });

  it("is zero-safe", () => {
    assert.deepEqual(backingSize(0, 844, 2, 1920), { w: 0, h: 0 });
    assert.deepEqual(backingSize(390, 0, 2, 1920), { w: 0, h: 0 });
    assert.deepEqual(backingSize(NaN, 844, 2, 1920), { w: 0, h: 0 });
    assert.deepEqual(backingSize(390, 844, 0, 1920), { w: 390, h: 844 });
    assert.deepEqual(backingSize(390, 844, NaN, 1920), { w: 390, h: 844 });
    assert.deepEqual(backingSize(390, 844, 2, 0), { w: 780, h: 1688 }); // no cap known: the old rule
  });

  it("sizes the large-viewport layer: one store whatever the toolbar does", () => {
    // The canvas box is the layer (width x lvh, placement.ts), not the dynamic viewport: a phone gets one store for
    // the 390 x 754 layer, and the picture is placed on the 664 px stage inside it.
    const layer = backingSize(390, 754, 3, 432);
    assert.deepEqual(layer, { w: 432, h: 835 });
    assert.ok(Math.abs(layer.h - (layer.w * 754) / 390) <= 1);
    assert.deepEqual(backingSize(360, 640, 2, 720), { w: 720, h: 1280 });
    assert.deepEqual(backingSize(844, 390, 2, 1280), { w: 1280, h: 591 });
  });
});

describe("growCap", () => {
  it("uses the widest width the reel offers until a segment has joined", () => {
    assert.equal(growCap(0, 0, 1920), 1920);
  });
  it("follows the widest tier in use once segments have joined", () => {
    assert.equal(growCap(1920, 1280, 1920), 1920); // never below an earlier cap
    assert.equal(growCap(0, 1280, 1920), 1280);
  });
  it("only grows: a smaller tier after a retier does not shrink it", () => {
    let cap = growCap(0, 0, 1920);
    cap = growCap(cap, 768, 1920);
    assert.equal(cap, 1920);
    cap = growCap(0, 1280, 1920);
    cap = growCap(cap, 768, 1920);
    assert.equal(cap, 1280);
    cap = growCap(cap, 1920, 1920);
    assert.equal(cap, 1920);
  });
});

describe("wantsFullBacking", () => {
  it("reads ?backing=full only", () => {
    assert.equal(wantsFullBacking("?backing=full"), true);
    assert.equal(wantsFullBacking("?hud=1&backing=full"), true);
    assert.equal(wantsFullBacking(""), false);
    assert.equal(wantsFullBacking("?backing=capped"), false);
    assert.equal(wantsFullBacking("?backing="), false);
  });
});

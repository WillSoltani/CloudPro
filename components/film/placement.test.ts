// Tests for components/film/placement.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverRect } from "./filmBase";
import { backingPlacement, placement, placementPoint, stageHeight, stageVars } from "./placement";

const FOCUS = [0.5, 0.45] as const;
const ASPECTS = { landscape: 1920 / 1080, portrait: 1080 / 2340 } as const;

/** Phone shapes: [width, small-viewport stage, large-viewport layer]. */
const PHONES = [
  [390, 664, 754],
  [360, 560, 640],
  [320, 460, 528],
  [844, 340, 390],
  [390, 844, 844],
  [430, 739, 832],
] as const;
/** Desktop shapes: no dynamic toolbar, lvh = svh. */
const DESKTOPS = [
  [1440, 900],
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
  [1024, 768],
  [1366, 768],
] as const;

const close = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b} (tol ${tol})`);

const covers = (r: { left: number; top: number; width: number; height: number }, w: number, h: number, what: string) => {
  assert.ok(r.left <= 1e-9, `${what}: left ${r.left}`);
  assert.ok(r.top <= 1e-9, `${what}: top ${r.top}`);
  assert.ok(r.left + r.width >= w - 1e-9, `${what}: right ${r.left + r.width} < ${w}`);
  assert.ok(r.top + r.height >= h - 1e-9, `${what}: bottom ${r.top + r.height} < ${h}`);
};

describe("placement", () => {
  it("is coverRect itself where lvh = svh (desktop), bit for bit", () => {
    for (const aspect of Object.values(ASPECTS)) {
      for (const [w, h] of [...DESKTOPS, [390, 844], [1309.09, 818.18]] as const) {
        assert.deepEqual(placement(w, h, h, aspect, FOCUS), coverRect(w, h, aspect, FOCUS), `${w}x${h}`);
        // A stage taller than the layer (rounding) or a missing one is the layer too.
        assert.deepEqual(placement(w, h, h + 1, aspect, FOCUS), coverRect(w, h, aspect, FOCUS));
        assert.deepEqual(placement(w, h, 0, aspect, FOCUS), coverRect(w, h, aspect, FOCUS));
      }
    }
  });

  it("puts the picture where the stage's cover fit put it at first view (dvh = svh) when that covers the layer", () => {
    for (const aspect of Object.values(ASPECTS)) {
      for (const [w, svh, lvh] of PHONES) {
        const first = coverRect(w, svh, aspect, FOCUS);
        if (first.top + first.height < lvh) continue; // needs the scale-up (below)
        assert.deepEqual(placement(w, lvh, svh, aspect, FOCUS), first, `${w}x${svh} in ${lvh}`);
      }
    }
    // The shapes the phone layer is built for are width-limited on the portrait camera: no scale-up at all.
    for (const [w, svh, lvh] of PHONES) {
      assert.deepEqual(placement(w, lvh, svh, ASPECTS.portrait, FOCUS), coverRect(w, svh, ASPECTS.portrait, FOCUS));
    }
  });

  it("does not depend on the dynamic viewport: the toolbar moving changes none of its inputs", () => {
    // Before: the canvas was dvh tall and the picture moved by 0.45 x the toolbar's travel. Now the inputs are the
    // layer width, the large and the small viewport, none of which a toolbar move changes.
    for (const [w, svh, lvh] of PHONES) {
      const at = placement(w, lvh, svh, ASPECTS.portrait, FOCUS);
      for (let dvh = svh; dvh <= lvh; dvh += 7) {
        const before = coverRect(w, dvh, ASPECTS.portrait, FOCUS);
        if (dvh !== svh && before.height === at.height) assert.notEqual(before.top, at.top, "the old fit moved");
        assert.deepEqual(placement(w, lvh, svh, ASPECTS.portrait, FOCUS), at);
      }
    }
  });

  it("covers the whole large-viewport layer for phone and desktop shapes, both cameras", () => {
    for (const [name, aspect] of Object.entries(ASPECTS)) {
      for (const [w, svh, lvh] of PHONES) covers(placement(w, lvh, svh, aspect, FOCUS), w, lvh, `${name} ${w}x${svh}/${lvh}`);
      for (const [w, h] of DESKTOPS) covers(placement(w, h, h, aspect, FOCUS), w, h, `${name} ${w}x${h}`);
    }
  });

  it("grows the scale by the minimum that covers a tall, narrow layer, keeping the focus point on the stage", () => {
    // A height-limited fit: a 300 px wide phone with a 700 px stage in an 800 px layer, portrait camera (and an iPad
    // in landscape on the landscape camera, 1180 x 740 in 820).
    for (const [w, svh, lvh, aspect] of [
      [300, 700, 800, ASPECTS.portrait],
      [344, 760, 882, ASPECTS.portrait],
      [1180, 740, 820, ASPECTS.landscape],
    ] as const) {
      const first = coverRect(w, svh, aspect, FOCUS);
      assert.ok(first.top + first.height < lvh, "the stage's fit alone would leave a strip at the bottom");
      const r = placement(w, lvh, svh, aspect, FOCUS);
      covers(r, w, lvh, `${w}x${svh}/${lvh}`);
      close(r.top + r.height, lvh, 1e-9, "the bottom edge, exactly (the minimum scale)");
      close(r.height, stageHeight(lvh, svh, FOCUS[1]), 1e-9, "stageHeight");
      assert.ok(r.height > first.height);
      const [fx, fy] = placementPoint(w, lvh, svh, aspect, FOCUS, FOCUS);
      close(fx, w * FOCUS[0], 1e-9, "focus x");
      close(fy, svh * FOCUS[1], 1e-9, "focus y");
    }
  });

  it("keeps the focus point at the same place on the stage for every shape", () => {
    for (const aspect of Object.values(ASPECTS)) {
      for (const [w, svh, lvh] of [...PHONES, ...DESKTOPS.map(([w, h]) => [w, h, h] as const)]) {
        const [x, y] = placementPoint(w, lvh, svh, aspect, FOCUS, FOCUS);
        close(x, w * FOCUS[0], 1e-9, `${w}x${svh}/${lvh} x`);
        close(y, svh * FOCUS[1], 1e-9, `${w}x${svh}/${lvh} y`);
      }
    }
  });

  it("on the backing store is the CSS placement scaled, and coverRect of the backing size on desktop", () => {
    for (const aspect of Object.values(ASPECTS)) {
      for (const [w, h] of DESKTOPS) {
        for (const [bw, bh] of [[w, h], [w * 2, h * 2], [1920, Math.round((1920 * h) / w)]]) {
          assert.deepEqual(backingPlacement(bw, bh, h, h, aspect, FOCUS), coverRect(bw, bh, aspect, FOCUS));
        }
      }
      for (const [w, svh, lvh] of PHONES) {
        const css = placement(w, lvh, svh, aspect, FOCUS);
        for (const k of [1, 2, 1.1076923]) {
          const bw = w * k;
          const bh = lvh * k;
          const b = backingPlacement(bw, bh, lvh, svh, aspect, FOCUS);
          for (const key of ["left", "top", "width", "height"] as const) close(b[key], css[key] * k, 1e-9 * bw, `${w}x${svh}/${lvh} ${key} x${k}`);
        }
      }
    }
  });
});

/** Evaluates the stage variables' CSS for a layer: svh and lvh in px (the variables' fallbacks are the real units). */
function evalCss(expr: string, vars: Record<string, string>, svh: number, lvh: number): number {
  let s = expr;
  for (let i = 0; i < 10 && s.includes("var("); i++) {
    s = s.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name: string, fallback?: string) => {
      if (name in vars) return `(${vars[name]})`;
      assert.ok(fallback, `unknown variable ${name}`);
      return fallback;
    });
  }
  s = s.replace(/100svh/g, String(svh)).replace(/100lvh/g, String(lvh)).replace(/calc\(/g, "(");
  assert.match(s, /^[\d\s.+\-*/()]+$/, `unexpected token in ${s}`);
  return Function(`return ${s};`)() as number;
}

describe("stageVars", () => {
  it("a box stage-h tall at stage-top, cover-fitted at the focus, is the placement (the hero poster)", () => {
    const vars = stageVars(FOCUS);
    for (const aspect of Object.values(ASPECTS)) {
      for (const [w, svh, lvh] of [...PHONES, [300, 700, 800], [1180, 740, 820], ...DESKTOPS.map(([w, h]) => [w, h, h] as const)]) {
        const boxH = evalCss("var(--film-stage-h)", vars, svh, lvh);
        const boxTop = evalCss("var(--film-stage-top)", vars, svh, lvh);
        const fit = coverRect(w, boxH, aspect, FOCUS);
        const r = placement(w, lvh, svh, aspect, FOCUS);
        const what = `${w}x${svh}/${lvh}`;
        close(fit.width, r.width, 1e-6, `${what} width`);
        close(fit.height, r.height, 1e-6, `${what} height`);
        close(fit.left, r.left, 1e-6, `${what} left`);
        close(fit.top + boxTop, r.top, 1e-6, `${what} top`);
        if (svh === lvh) {
          assert.equal(boxTop, 0);
          assert.equal(boxH, svh);
        }
      }
    }
  });

  it("stage-pad as a content-box padding gives the stage's own cover fit (the keys before the backdrop runs)", () => {
    const vars = stageVars(FOCUS);
    for (const [w, svh, lvh] of PHONES) {
      const pad = evalCss("var(--film-stage-pad)", vars, svh, lvh);
      close(pad, lvh - svh, 1e-9, "pad");
      const fit = coverRect(w, lvh - pad, ASPECTS.portrait, FOCUS);
      assert.deepEqual(fit, placement(w, lvh, svh, ASPECTS.portrait, FOCUS));
    }
  });
});

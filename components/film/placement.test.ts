// Tests for components/film/placement.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverRect } from "./filmBase";
import { backingPlacement, placement, placementPoint, STAGE_BOX_CLASS, stageBox, stageHeight, stageVars } from "./placement";

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
  s = s
    .replace(/100svh/g, String(svh))
    .replace(/100lvh/g, String(lvh))
    .replace(/100vh/g, String(lvh))
    .replace(/(\d)px/g, "$1")
    .replace(/calc\(/g, "(");
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
});

/**
 * The hold-key layer's geometry as CSS, read from STAGE_BOX_CLASS (the literal FilmBackdrop renders), with or
 * without lvh support: its top, height and bottom padding as CSS lengths, and whether the background is positioned in
 * the content box (`bg-origin-content`) rather than the padding box. Base utilities first, the `supports-[…]` variant
 * on top of them, as Tailwind orders them.
 */
function keyLayerCss(lvhSupported: boolean): { top: string; height: string; padBottom: string; content: boolean } {
  const css = { top: "", height: "", padBottom: "0px", content: false };
  const tokens = STAGE_BOX_CLASS.split(/\s+/).filter(Boolean);
  const variant = "supports-[height:100lvh]:";
  const value = (v: string) => (v.startsWith("(") ? `var${v}` : v.startsWith("[") ? v.slice(1, -1).replace(/_/g, " ") : v);
  const apply = (t: string) => {
    let m: RegExpMatchArray | null;
    if (t === "inset-0" || t === "top-0" || t === "inset-y-0") css.top = "0px";
    else if ((m = t.match(/^top-([([].*[)\]])$/))) css.top = value(m[1]);
    else if (t === "h-screen") css.height = "100vh";
    else if ((m = t.match(/^h-([([].*[)\]])$/))) css.height = value(m[1]);
    else if ((m = t.match(/^pb-([([].*[)\]])$/))) css.padBottom = value(m[1]);
    else if (t === "bg-origin-content") css.content = true;
    else assert.fail(`STAGE_BOX_CLASS: a token this test does not model: ${t}`);
  };
  for (const t of tokens) if (!t.startsWith("supports-")) apply(t);
  if (lvhSupported) for (const t of tokens) if (t.startsWith(variant)) apply(t.slice(variant.length));
  assert.ok(css.top && css.height, `STAGE_BOX_CLASS sets no top or height: ${STAGE_BOX_CLASS}`);
  return css;
}

/**
 * Viewports for the key layers: [width, svh, lvh]. Phones with the portrait camera (the reviewer's table: iPhones that
 * do not grow, Android 20:9 shapes that do), and landscape shapes (a desktop, an iPad that grows).
 */
const KEY_VIEWPORTS = [
  [390, 664, 844, "portrait"],
  [390, 664, 754, "portrait"],
  [430, 739, 832, "portrait"],
  [360, 560, 640, "portrait"],
  [411, 802, 858, "portrait"],
  [411, 826, 882, "portrait"],
  [360, 684, 740, "portrait"],
  [1440, 900, 900, "landscape"],
  [1180, 740, 820, "landscape"],
  [1366, 768, 768, "landscape"],
] as const;

describe("the hold-key layers' box", () => {
  it("cover-fitted at the focus, the box the CSS gives puts the picture where placement() does, grow included", () => {
    const vars = stageVars(FOCUS);
    const css = keyLayerCss(true);
    for (const [w, svh, lvh, camera] of KEY_VIEWPORTS) {
      for (const aspect of [ASPECTS[camera], camera === "portrait" ? ASPECTS.landscape : ASPECTS.portrait]) {
        const what = `${w}x${svh} in ${lvh}, aspect ${aspect.toFixed(4)}`;
        const top = evalCss(css.top, vars, svh, lvh);
        const height = evalCss(css.height, vars, svh, lvh);
        const pad = evalCss(css.padBottom, vars, svh, lvh);
        // background-size: cover in the positioning area, background-position at the focus (REEL_OBJECT_POSITION).
        const fit = coverRect(w, css.content ? height - pad : height, aspect, FOCUS);
        const r = placement(w, lvh, svh, aspect, FOCUS);
        close(fit.width, r.width, 0.5, `${what}: width`);
        close(fit.height, r.height, 0.5, `${what}: height`);
        close(fit.left, r.left, 0.5, `${what}: left`);
        close(top + fit.top, r.top, 0.5, `${what}: top`);
        // The backdrop's px (layoutKey, the breath origin) are relative to the same box: stageBox() is the CSS box.
        const js = stageBox(lvh, svh, FOCUS[1]);
        close(js.top, top, 1e-6, `${what}: stageBox top`);
        close(js.height, height, 1e-6, `${what}: stageBox height`);
        // The box ends at the bottom of the large viewport, like the canvas.
        close(top + height, lvh, 1e-6, `${what}: bottom edge`);
      }
    }
  });

  it("is the layer itself (top 0, full height) where lvh = svh, and without lvh support", () => {
    const vars = stageVars(FOCUS);
    const css = keyLayerCss(true);
    for (const [w, h] of [...DESKTOPS, [390, 844], [844, 390]] as const) {
      assert.equal(evalCss(css.top, vars, h, h), 0, `${w}x${h} top`);
      assert.equal(evalCss(css.height, vars, h, h), h, `${w}x${h} height`);
      assert.deepEqual(stageBox(h, h, FOCUS[1]), { top: 0, height: h });
    }
    const old = keyLayerCss(false);
    assert.deepEqual([old.top, old.height, old.padBottom], ["0px", "100vh", "0px"], "the fallback box");
  });
});

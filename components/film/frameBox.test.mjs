// Tests for components/film/frameBox.ts (pure; the CSS it writes is evaluated here numerically and checked
// against filmBase coverRect, the canvas's own fit). Run from the repo root:
//   node --experimental-strip-types --test components/film/frameBox.test.mjs
// (A .mjs file is outside tsconfig's include, so tsc never sees the `.ts` import specifiers.)
import test from "node:test";
import assert from "node:assert/strict";
import { FILM_ASPECT, columnTrackList, framePoint, frameVars, fx, fy } from "./frameBox.ts";
import { coverRect } from "./filmBase.ts";

const FOCUS = [0.5, 0.45];
const close = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b} (tol ${tol})`);

/** Evaluate a CSS length expression built from the frame variables, in px, for a vw × vh box. */
function evalCss(expr, vars, vw, vh) {
  let s = expr;
  for (let i = 0; i < 10 && s.includes("var("); i++) {
    s = s.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      assert.ok(name in vars, `unknown variable ${name}`);
      return `(${vars[name]})`;
    });
  }
  s = s
    .replace(/100cqw/g, String(vw))
    .replace(/100dvh/g, String(vh))
    .replace(/(\d+(?:\.\d+)?)px/g, "$1")
    .replace(/calc\(/g, "(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(");
  assert.match(s, /^[\d\s.+\-*/(),Mathmaxin]+$/, `unexpected token in ${s}`);
  return Function(`return ${s};`)();
}

const VIEWPORTS = [
  [1440, 900],
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
  [1024, 768],
  [390, 844],
  [375, 812],
];

test("frame variables reproduce coverRect for both cameras", () => {
  for (const [orientation, aspect] of Object.entries(FILM_ASPECT)) {
    const vars = { ...frameVars(FOCUS), "--fa": String(aspect) };
    for (const [vw, vh] of VIEWPORTS) {
      const r = coverRect(vw, vh, aspect, FOCUS);
      const what = `${orientation} ${vw}x${vh}`;
      close(evalCss("var(--fw)", vars, vw, vh), r.width, 0.01, `${what} fw`);
      close(evalCss("var(--fh)", vars, vw, vh), r.height, 0.02, `${what} fh`);
      close(evalCss("var(--fx0)", vars, vw, vh), r.left, 0.01, `${what} fx0`);
      close(evalCss("var(--fy0)", vars, vw, vh), r.top, 0.02, `${what} fy0`);
      for (const p of [
        [0, 0],
        [0.13, 0.17],
        [0.785, 0.8],
        [1, 1],
      ]) {
        const [x, y] = framePoint(vw, vh, aspect, FOCUS, p);
        close(evalCss(fx(p[0]), vars, vw, vh), x, 0.02, `${what} fx(${p[0]})`);
        close(evalCss(fy(p[1]), vars, vw, vh), y, 0.03, `${what} fy(${p[1]})`);
        close(x, r.left + r.width * p[0], 1e-9, `${what} framePoint x`);
        close(y, r.top + r.height * p[1], 1e-9, `${what} framePoint y`);
      }
    }
  }
});

test("column tracks centre each column on its anchor, ≥ 24 px inside the viewport", () => {
  const anchors = [0.206, 0.402, 0.598, 0.794];
  const width = 0.17;
  const aspect = FILM_ASPECT.landscape;
  const vars = { ...frameVars(FOCUS), "--fa": String(aspect) };
  for (const [vw, vh] of [
    [1440, 900],
    [1280, 800],
    [1920, 1080],
    [2560, 1440],
    [1024, 768],
  ]) {
    const tracks = columnTrackList(anchors, width);
    assert.equal(tracks.length, anchors.length * 2);
    let x = 0;
    anchors.forEach((a, k) => {
      x += evalCss(tracks[2 * k], vars, vw, vh);
      const w = evalCss(tracks[2 * k + 1], vars, vw, vh);
      const [ax] = framePoint(vw, vh, aspect, FOCUS, [a, 0]);
      close(x + w / 2, ax, 0.05, `${vw}x${vh} column ${k} centre`);
      assert.ok(x >= 24 - 0.05 && x + w <= vw - 24 + 0.05, `${vw}x${vh} column ${k} edge: ${x}..${x + w}`);
      x += w;
    });
  }
});

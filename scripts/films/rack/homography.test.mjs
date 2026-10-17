// Tests for components/film/homography.ts (pure maths, no DOM). Run from the repo root:
//   node --experimental-strip-types --test scripts/films/rack/homography.test.mjs
// It lives here, not beside the module, because tsc --noEmit (which includes every **/*.ts) rejects a
// `./homography.ts` import (TS5097) and Node's type stripping cannot resolve an extensionless one.
import test from "node:test";
import assert from "node:assert/strict";
import {
  coverRect,
  matrix3dFor,
  projectCorners,
  squareToQuad,
} from "../../../components/film/homography.ts";

const close = (actual, expected, tol, what) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: got ${actual}, expected ${expected} (tol ${tol})`,
  );

/** The 16 numbers inside "matrix3d(...)", column-major as CSS reads them. */
function parse(css) {
  const m = /^matrix3d\((.*)\)$/.exec(css);
  assert.ok(m, `not a matrix3d string: ${css}`);
  const v = m[1].split(",").map(Number);
  assert.equal(v.length, 16);
  assert.ok(v.every(Number.isFinite), css);
  return v;
}

/** What the browser does to an element point (x, y, z = 0): multiply, then divide by w. */
function apply(css, x, y) {
  const m = parse(css);
  const w = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
}

function elementCorners(w0, h0) {
  return [
    [0, 0],
    [w0, 0],
    [w0, h0],
    [0, h0],
  ];
}

function assertCornersLand(css, w0, h0, quad, tol = 1e-6) {
  elementCorners(w0, h0).forEach(([x, y], i) => {
    const [px, py] = apply(css, x, y);
    close(px, quad[i][0], tol, `corner ${i} x`);
    close(py, quad[i][1], tol, `corner ${i} y`);
  });
}

const IDENTITY = "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)";

test("identity: a quad equal to the element's own rectangle gives the identity matrix", () => {
  const css = matrix3dFor(squareToQuad(elementCorners(800, 450)), 800, 450);
  assert.equal(css, IDENTITY);
});

test("plain scale: the rectangle at 2x, and the unit square", () => {
  assert.equal(
    matrix3dFor(squareToQuad(elementCorners(1600, 900)), 800, 450),
    "matrix3d(2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)",
  );
  // Unit square -> scale(1 / w0, 1 / h0).
  const m = parse(matrix3dFor(squareToQuad(elementCorners(1, 1)), 800, 450));
  close(m[0], 1 / 800, 1e-14, "sx"); // 12 significant digits in the string
  close(m[5], 1 / 450, 1e-14, "sy");
  assert.deepEqual([m[1], m[3], m[4], m[7], m[12], m[13]], [0, 0, 0, 0, 0, 0]);
});

test("pure translation", () => {
  const quad = elementCorners(800, 450).map(([x, y]) => [x + 40, y - 25]);
  assert.equal(
    matrix3dFor(squareToQuad(quad), 800, 450),
    "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, -25, 0, 1)",
  );
});

test("a parallelogram is affine: no perspective terms, corners and centre land", () => {
  const quad = [
    [10, 20],
    [110, 40],
    [130, 140],
    [30, 120],
  ];
  const hom = squareToQuad(quad);
  assert.equal(hom.g, 0);
  assert.equal(hom.h, 0);
  const css = matrix3dFor(hom, 640, 360);
  const m = parse(css);
  assert.equal(m[3], 0);
  assert.equal(m[7], 0);
  assertCornersLand(css, 640, 360, quad);
  const [cx, cy] = apply(css, 320, 180);
  close(cx, 70, 1e-9, "centre x");
  close(cy, 80, 1e-9, "centre y");
});

test("a known perspective quad: the four corners come back to 1e-6", () => {
  const quad = [
    [412.5, 168.25],
    [1018.75, 205.5],
    [1004.125, 702.875],
    [398.0, 655.5],
  ];
  const css = matrix3dFor(squareToQuad(quad), 1600, 900);
  assertCornersLand(css, 1600, 900, quad);
  const m = parse(css);
  assert.notEqual(m[3], 0, "a non-parallelogram needs a perspective term");
  // z passes through untouched.
  assert.deepEqual([m[2], m[6], m[8], m[9], m[10], m[11], m[14]], [0, 0, 0, 0, 1, 0, 0]);
  // Projective maps keep lines: the element's centre lands where the quad's diagonals cross.
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const den = (x2 - x0) * (y3 - y1) - (y2 - y0) * (x3 - x1);
  const t = ((x1 - x0) * (y3 - y1) - (y1 - y0) * (x3 - x1)) / den;
  const [cx, cy] = apply(css, 800, 450);
  close(cx, x0 + t * (x2 - x0), 1e-6, "centre x");
  close(cy, y0 + t * (y2 - y0), 1e-6, "centre y");
});

test("a strong trapezoid (far edge half as wide as the near edge)", () => {
  const quad = [
    [300, 100],
    [700, 100],
    [1000, 500],
    [0, 500],
  ];
  const css = matrix3dFor(squareToQuad(quad), 2048, 1152);
  assertCornersLand(css, 2048, 1152, quad);
  // The vertical mid-line of the element stays vertical at x = 500 for a symmetric trapezoid.
  const [mx] = apply(css, 1024, 300);
  close(mx, 500, 1e-6, "mid-line x");
});

test("a degenerate quad (collinear corners) stays finite and never throws", () => {
  const hom = squareToQuad([
    [0, 0],
    [10, 0],
    [20, 0],
    [30, 0],
  ]);
  assert.ok(Object.values(hom).every(Number.isFinite));
  const css = matrix3dFor(hom, 100, 100);
  assert.ok(css === "none" || /^matrix3d\(/.test(css));
  assert.ok(!/NaN|Infinity/.test(css));
  assert.equal(matrix3dFor(hom, 0, 100), "none");
  assert.equal(matrix3dFor({ ...hom, a: Number.NaN }, 100, 100), "none");
});

test("squareToQuad and projectCorners reject the wrong number of values", () => {
  assert.throws(() => squareToQuad([[0, 0]]), RangeError);
  assert.throws(() => projectCorners([0, 0, 1, 0], coverRect(100, 100, 1, [0.5, 0.5])), RangeError);
});

// Hand-computed from the draw() formula in FilmBackdrop.tsx (cover fit: w = max(cw, ch * aspect),
// h = w / aspect, offset (cw - w) * fx, (ch - h) * fy), with aspect 1.7778 (the manifests' rounding).
test("coverRect, 1440 x 900 at focus [0.5, 0.45]", () => {
  // w = max(1440, 900 * 1.7778 = 1600.02) = 1600.02; h = 900; left = -160.02 * 0.5; top = 0 * 0.45
  const r = coverRect(1440, 900, 1.7778, [0.5, 0.45]);
  close(r.width, 1600.02, 1e-9, "width");
  close(r.height, 900, 1e-9, "height");
  close(r.left, -80.01, 1e-9, "left");
  close(r.top, 0, 1e-9, "top");
});

test("coverRect, 390 x 844 phone at focus [0.5, 0.45]", () => {
  // w = max(390, 844 * 1.7778 = 1500.4632); h = 844; left = (390 - 1500.4632) * 0.5; top = 0
  const r = coverRect(390, 844, 1.7778, [0.5, 0.45]);
  close(r.width, 1500.4632, 1e-9, "width");
  close(r.height, 844, 1e-9, "height");
  close(r.left, -555.2316, 1e-9, "left");
  close(r.top, 0, 1e-9, "top");
});

test("coverRect, width-bound 2560 x 900 uses the vertical focus", () => {
  // w = 2560; h = 2560 / 1.7778 = 1439.98200022...; left = 0; top = (900 - h) * 0.45 = -242.9919001...
  const r = coverRect(2560, 900, 1.7778, [0.5, 0.45]);
  close(r.width, 2560, 1e-9, "width");
  close(r.height, 1439.982000225, 1e-9, "height");
  close(r.left, 0, 1e-9, "left");
  close(r.top, -242.9919001012, 1e-9, "top");
});

test("coverRect, off-centre horizontal focus", () => {
  // 1440 x 900, focus [0.2, 0.8]: left = (1440 - 1600.02) * 0.2 = -32.004; top = 0 * 0.8
  const r = coverRect(1440, 900, 1.7778, [0.2, 0.8]);
  close(r.left, -32.004, 1e-9, "left");
  close(r.top, 0, 1e-9, "top");
});

test("coverRect equals draw()'s scale-and-offset for the natural image size, on CSS and DPR-sized canvases", () => {
  const iw = 1920;
  const ih = 1080;
  const sizes = [[1440, 900], [390, 844], [2560, 900], [768, 1024], [1920, 1080], [3440, 1440], [900, 900]];
  const focuses = [[0.5, 0.45], [0.5, 0.5], [0.2, 0.8]];
  for (const [vw, vh] of sizes) {
    for (const dpr of [1, 2, 1.5]) {
      for (const [fx, fy] of focuses) {
        const cw = vw * dpr;
        const ch = vh * dpr;
        // draw(): scale = max(cw / iw, ch / ih); w = iw * scale; h = ih * scale; drawImage(img, (cw - w) * fx, (ch - h) * fy, w, h)
        const scale = Math.max(cw / iw, ch / ih);
        const w = iw * scale;
        const h = ih * scale;
        const r = coverRect(cw, ch, iw / ih, [fx, fy]);
        const tag = `${vw}x${vh}@${dpr} focus ${fx},${fy}`;
        close(r.width, w, 1e-9, `${tag} width`);
        close(r.height, h, 1e-9, `${tag} height`);
        close(r.left, (cw - w) * fx, 1e-9, `${tag} left`);
        close(r.top, (ch - h) * fy, 1e-9, `${tag} top`);
        // The same layout in CSS px, scaled up by the DPR, is the canvas layout.
        const css = coverRect(vw, vh, iw / ih, [fx, fy]);
        close(css.left * dpr, r.left, 1e-9, `${tag} css left`);
        close(css.top * dpr, r.top, 1e-9, `${tag} css top`);
        close(css.width * dpr, r.width, 1e-9, `${tag} css width`);
      }
    }
  }
});

test("projectCorners maps frame fractions through the cover rect", () => {
  const rect = coverRect(1440, 900, 1.7778, [0.5, 0.45]);
  const out = projectCorners([0, 0, 1, 0, 1, 1, 0, 1], rect);
  const want = [[-80.01, 0], [1520.01, 0], [1520.01, 900], [-80.01, 900]];
  out.forEach(([x, y], i) => {
    close(x, want[i][0], 1e-9, `corner ${i} x`);
    close(y, want[i][1], 1e-9, `corner ${i} y`);
  });
  const [[x, y]] = projectCorners([0.25, 0.5, 0, 0, 0, 0, 0, 0], rect);
  close(x, -80.01 + 0.25 * 1600.02, 1e-9, "quarter x");
  close(y, 450, 1e-9, "half y");
});

test("end to end: frame-fraction corners -> px -> matrix3d lands on those px at desktop and phone sizes", () => {
  const frac = [0.31, 0.22, 0.69, 0.25, 0.66, 0.71, 0.34, 0.68];
  for (const [vw, vh] of [[1440, 900], [390, 844], [2560, 1440]]) {
    const rect = coverRect(vw, vh, 1920 / 1080, [0.5, 0.45]);
    const px = projectCorners(frac, rect);
    const css = matrix3dFor(squareToQuad(px), 1280, 720);
    assertCornersLand(css, 1280, 720, px);
  }
});

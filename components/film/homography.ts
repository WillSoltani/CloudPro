// Pure maths for pinning an HTML plate to a quad that the film's renderer exports per frame.
// No React and no DOM, so node can run the tests on this file as it stands (erasable TypeScript only: no
// enums, namespaces or parameter properties):
//   node --experimental-strip-types --test scripts/films/rack/homography.test.mjs
//
//   rect    = coverRect(vw, vh, aspect, REEL_FOCUS)       where the canvas paints the frame, in CSS px
//   corners = projectCorners(plate.corners[frame], rect)  the plate's four corners in CSS px
//   css     = matrix3dFor(squareToQuad(corners), w0, h0)  for an element of size w0 x h0, transform-origin 0 0

// coverRect lives in filmBase.ts (FilmBackdrop's draw() and the key layers use it too); re-exported here so
// the plate maths and its tests name one function. The `.ts` extension is what Node's type stripping needs
// to resolve the file; tsc rejects it without `allowImportingTsExtensions` (TS5097), which this one line
// waives rather than changing tsconfig. Bundlers resolve it either way. Types still flow through it.
// @ts-expect-error TS5097: Node's type stripping resolves only the full file name.
import { coverRect, type CoverRect } from "./filmBase.ts";

export { coverRect };
export type { CoverRect };

/**
 * Projective map of the unit square onto a quad:
 * (u, v) -> ((a*u + b*v + c) / w, (d*u + e*v + f) / w) with w = g*u + h*v + 1.
 */
export interface Homography {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
  readonly g: number;
  readonly h: number;
}

/**
 * Heckbert's square-to-quad: the unit square's corners (0,0), (1,0), (1,1), (0,1) map to p[0..3]
 * (clockwise on screen when y points down). A parallelogram is exactly affine (g = h = 0). A degenerate quad,
 * where three corners are collinear, has no projective map; it falls back to the affine map through
 * p[0], p[1], p[3] so every coefficient stays finite (the plate is hidden at that frame anyway).
 */
export function squareToQuad(p: readonly (readonly [number, number])[]): Homography {
  if (p.length !== 4) throw new RangeError(`squareToQuad needs 4 corners, got ${p.length}`);
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  const scale = Math.max(1, ...p.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
  const den = dx1 * dy2 - dx2 * dy1;
  const parallelogram = Math.abs(dx3) <= 1e-9 * scale && Math.abs(dy3) <= 1e-9 * scale;
  if (parallelogram || Math.abs(den) <= 1e-12 * scale * scale) {
    return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  }
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

/** Shortest decimal for a coefficient, rounded to 12 significant digits (CSS takes `1e-7`). */
const num = (v: number): string => String(+v.toPrecision(12));

/**
 * The CSS `matrix3d(...)` that carries an element of intrinsic size w0 x h0 (px, `transform-origin: 0 0`)
 * onto the quad: element point (x, y) is (u, v) = (x / w0, y / h0) in the homography. The 16 values are
 * column-major, z passes through. Returns "none" for a non-finite coefficient or a size <= 0, which are
 * invalid CSS otherwise.
 */
export function matrix3dFor(h: Homography, w0: number, h0: number): string {
  if (!(w0 > 0 && h0 > 0)) return "none";
  const m = [
    h.a / w0, h.d / w0, 0, h.g / w0,
    h.b / h0, h.e / h0, 0, h.h / h0,
    0, 0, 1, 0,
    h.c, h.f, 0, 1,
  ];
  return m.every(Number.isFinite) ? `matrix3d(${m.map(num).join(", ")})` : "none";
}

/**
 * Maps 8 numbers (x0, y0, ... x3, y3) given as fractions of the frame, top-left origin, through the rect that
 * coverRect() returned, to the four corners in CSS px.
 */
export function projectCorners(
  normalised: readonly number[],
  rect: CoverRect,
): [number, number][] {
  if (normalised.length !== 8) {
    throw new RangeError(`projectCorners needs 8 numbers, got ${normalised.length}`);
  }
  const out: [number, number][] = [];
  for (let i = 0; i < 8; i += 2) {
    out.push([rect.left + normalised[i] * rect.width, rect.top + normalised[i + 1] * rect.height]);
  }
  return out;
}

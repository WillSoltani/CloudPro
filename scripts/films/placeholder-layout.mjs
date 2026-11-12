/**
 * placeholder-layout.mjs - how a placeholder frame carries its own identity in its pixels.
 *
 * scripts/films/placeholder.mjs draws it, e2e/film-frames.ts reads it back from the film canvas, so a spec
 * can tell which film and which frame is painted without trusting the page's own `data-frame` hook.
 *
 * A row of 18 square-ish cells, white = 1, black = 0, centred on the frame point (0.5, 0.45):
 *   cell 0       guard, always white
 *   cells 1-4    the film id, most significant bit first (the film's position in the sorted list of
 *                public/films/*, 16 films at most)
 *   cells 5-16   the 0-based frame index, most significant bit first (frames 0-4095)
 *   cell 17      guard, always black
 * (0.5, 0.45) is components/film/FilmBackdrop.tsx REEL_FOCUS: the cover fit keeps that frame point at the
 * same fraction of the canvas whatever the viewport, so the row is never cropped away and its place on the
 * canvas is known without knowing the crop. Sizes are fractions of m = min(frame width, frame height), so
 * the landscape tiers and the portrait ones carry the same drawing, scaled.
 *
 * Below the row the same frame number is drawn as four seven-segment digits (1-based, the way the file is
 * named), so a person scrubbing the page can read it. A thin bar along the bottom edge grows with the
 * frame's share of the film.
 */

export const LAYOUT_VERSION = 1;

/** The focus point of the reel (FilmBackdrop REEL_FOCUS): where the row is centred, as frame fractions. */
export const FOCUS = Object.freeze([0.5, 0.45]);

export const CELLS = 18;
export const FILM_BITS = 4;
export const INDEX_BITS = 12;
export const MAX_FILMS = 1 << FILM_BITS;
export const MAX_FRAMES = 1 << INDEX_BITS;

/** Cell size as a fraction of m = min(frame width, frame height). */
export const CELL_W = 0.04;
export const CELL_H = 0.05;
/** Luma of a set and of an unset cell. */
export const ON = 240;
export const OFF = 16;

/** The 18 cell values (0 or 1) of a frame. */
export function encodeCells(filmId, index) {
  if (!Number.isInteger(filmId) || filmId < 0 || filmId >= MAX_FILMS) throw new RangeError(`film id ${filmId} outside 0-${MAX_FILMS - 1}`);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_FRAMES) throw new RangeError(`frame index ${index} outside 0-${MAX_FRAMES - 1}`);
  const cells = [1];
  for (let b = FILM_BITS - 1; b >= 0; b--) cells.push((filmId >> b) & 1);
  for (let b = INDEX_BITS - 1; b >= 0; b--) cells.push((index >> b) & 1);
  cells.push(0);
  return cells;
}

/** Inverse of encodeCells from 18 luma samples (0-255); null when the guards are wrong (not a placeholder frame). */
export function decodeLumas(lumas) {
  if (lumas.length !== CELLS) return null;
  const cells = lumas.map((l) => (l > 127 ? 1 : 0));
  if (cells[0] !== 1 || cells[CELLS - 1] !== 0) return null;
  let filmId = 0;
  for (let i = 0; i < FILM_BITS; i++) filmId = (filmId << 1) | cells[1 + i];
  let index = 0;
  for (let i = 0; i < INDEX_BITS; i++) index = (index << 1) | cells[1 + FILM_BITS + i];
  return { filmId, index };
}

/**
 * Centres of the 18 cells in frame pixels for a frame of `w` x `h`: [{x, y}], left to right.
 * The row's centre is the focus point; the cell half-extents are returned as `halfW` / `halfH`.
 */
export function cellCentres(w, h) {
  const m = Math.min(w, h);
  const cw = m * CELL_W;
  const ch = m * CELL_H;
  const cx = w * FOCUS[0];
  const cy = h * FOCUS[1];
  const left = cx - (CELLS * cw) / 2;
  return {
    halfW: cw / 2,
    halfH: ch / 2,
    centres: Array.from({ length: CELLS }, (_, i) => ({ x: left + (i + 0.5) * cw, y: cy })),
  };
}

// Seven-segment digits: which of a, b, c, d, e, f, g are lit.
const SEGMENTS = {
  0: "abcdef",
  1: "bc",
  2: "abdeg",
  3: "abcdg",
  4: "bcfg",
  5: "acdfg",
  6: "acdefg",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
};

/** SVG rects (strings) for `number` as four seven-segment digits, centred at x `cx`, top at y `top`, `dh` tall. */
export function digitRects(number, cx, top, dh, fill) {
  const dw = dh * 0.55;
  const gap = dh * 0.3;
  const t = Math.max(2, Math.round(dh * 0.14));
  const text = String(Math.max(0, Math.min(9999, number))).padStart(4, "0");
  const total = 4 * dw + 3 * gap;
  const rects = [];
  const rect = (x, y, w, h) => rects.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${fill}"/>`);
  for (let d = 0; d < 4; d++) {
    const x = cx - total / 2 + d * (dw + gap);
    const half = dh / 2;
    const seg = {
      a: [x + t, top, dw - 2 * t, t],
      b: [x + dw - t, top + t, t, half - t * 1.5],
      c: [x + dw - t, top + half + t * 0.5, t, half - t * 1.5],
      d: [x + t, top + dh - t, dw - 2 * t, t],
      e: [x, top + half + t * 0.5, t, half - t * 1.5],
      f: [x, top + t, t, half - t * 1.5],
      g: [x + t, top + half - t / 2, dw - 2 * t, t],
    };
    for (const s of SEGMENTS[text[d]]) rect(...seg[s]);
  }
  return rects.join("");
}

/** One frame as SVG: `w` x `h` px, film `filmId`, 0-based `index` of `count` frames. */
export function frameSvg(w, h, filmId, index, count) {
  const m = Math.min(w, h);
  const cw = m * CELL_W;
  const ch = m * CELL_H;
  const cx = w * FOCUS[0];
  const cy = h * FOCUS[1];
  const left = cx - (CELLS * cw) / 2;
  const t = count > 1 ? index / (count - 1) : 0;
  // A slow drift of the background with the film's progress and a different tint per film, so a
  // scrub is visible to the eye and neighbouring films differ.
  const hue = (filmId * 47) % 360;
  const bg = `hsl(${hue} 30% ${14 + Math.round(t * 16)}%)`;
  const cells = encodeCells(filmId, index)
    .map((bit, i) => {
      const x = Math.round(left + i * cw);
      const x2 = Math.round(left + (i + 1) * cw);
      const luma = bit ? ON : OFF;
      return `<rect x="${x}" y="${Math.round(cy - ch / 2)}" width="${x2 - x}" height="${Math.round(ch)}" fill="rgb(${luma},${luma},${luma})"/>`;
    })
    .join("");
  const digits = digitRects(index + 1, cx, cy + ch * 0.75, m * 0.1, "rgb(235,235,235)");
  const barH = Math.max(2, Math.round(h * 0.008));
  const bar = `<rect x="0" y="${h - barH}" width="${Math.round(w * t)}" height="${barH}" fill="rgb(200,200,200)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><rect width="${w}" height="${h}" fill="${bg}"/>${cells}${digits}${bar}</svg>`;
}

// Tones over the film (part five §2c): the night-coloured washes that keep text legible on the picture.
// Pure and server-safe: the feather maths, the halo, the phone block tone, the body tone, the closing band
// and the side and column tones the chapters use. No borders, no box-shadows, no blur: a tone is only ever
// a feathered gradient of the page's night.

/** --color-night #070b16 as an "r g b" triplet for `rgb(… / a)`. */
export const NIGHT = "7 11 22";

/**
 * The feather, as (px from the edge, share of the way from the edge's alpha to the panel's). Eased
 * and long, so a bright band of the held frame dims gradually instead of being cut along a line.
 */
export const FEATHER: readonly (readonly [number, number])[] = [
  [0, 0],
  [35, 0.25],
  [70, 0.55],
  [105, 0.8],
  [140, 0.95],
  [160, 1],
];

/** One edge of a panel in `color` (an "r g b" triplet): alpha `from` at the edge easing to `to`, written top-down. */
export function edge(from: number, to: number, side: "top" | "bottom", color = NIGHT): string[] {
  return FEATHER.map(([px, k]) => {
    const a = +(from + (to - from) * k).toFixed(4);
    return `rgb(${color} / ${a}) ${side === "top" ? `${px}px` : `calc(100% - ${px}px)`}`;
  });
}

/**
 * The halo behind a small-text block (a lede, an item's meta and description; never the h2, never the
 * plate's flight path): a radial night wash, strongest under the text and gone well before its box edge,
 * so it reads as shade on the picture rather than a panel. Painted by `[data-halo]::before` in
 * app/globals.css from `--halo`, so it fades with the block's own Reveal.
 */
export const HALO_ALPHA = 0.58;
export const HALO = `radial-gradient(closest-side, rgb(${NIGHT} / ${HALO_ALPHA}), rgb(${NIGHT} / ${+(HALO_ALPHA * 0.62).toFixed(3)}) 55%, rgb(${NIGHT} / 0) 100%)`;

/**
 * A soft box halo for a small-text block over bright fog on small frames (part five §2c "a halo arrives with
 * each small-text block"; framed layouts under 880 px of frame, app/globals.css `[data-halo="box"]`): night
 * `alpha` across the block, reaching `pad` px past each side ([top, right, bottom, left]) and easing to clear
 * over that pad, as a product of a horizontal and a vertical ramp, so it follows the block wherever its text
 * wraps and its edges stay as soft as the side tone's. `fall` sets the horizontal profile: "even" (clear at
 * both ends) or "left" (in over the left pad, flat to 45 %, clear by 95 %: a column whose right end already
 * sits on the side tone's fall, which keeps the tower side to itself). `tightFall` gives the short laptop
 * windows (`wide-tight`) their own horizontal profile: "wide" (in over the left pad, flat to 70 %, clear at
 * the block's right edge: there the column's line ends sit over the skyline just left of the tower). Returns
 * the custom properties for the block's style.
 */
export function boxHalo(
  alpha: number,
  pad: readonly [number, number, number, number],
  fall: "even" | "left" = "even",
  tightFall?: "wide",
): Partial<Record<"--box-inset" | "--box-bg" | "--box-bg-t" | "--box-mask", string>> {
  const [top, right, bottom, left] = pad;
  const a = (k: number) => `rgb(${NIGHT} / ${+(alpha * k).toFixed(3)})`;
  const bg =
    fall === "left"
      ? `linear-gradient(to right, ${a(0)} 0, ${a(1)} ${left}px, ${a(1)} 45%, ${a(0.5)} 70%, ${a(0)} 95%)`
      : `linear-gradient(to right, ${a(0)} 0, ${a(1)} ${left}px, ${a(1)} calc(100% - ${right}px), ${a(0)} 100%)`;
  return {
    "--box-inset": `${-top}px ${-right}px ${-bottom}px ${-left}px`,
    "--box-bg": bg,
    ...(tightFall === "wide"
      ? { "--box-bg-t": `linear-gradient(to right, ${a(0)} 0, ${a(1)} ${left}px, ${a(1)} 70%, ${a(0.5)} 85%, ${a(0)} 100%)` }
      : {}),
    "--box-mask": `linear-gradient(to bottom, rgb(0 0 0 / 0) 0, rgb(0 0 0 / 1) ${top}px, rgb(0 0 0 / 1) calc(100% - ${bottom}px), rgb(0 0 0 / 0) 100%)`,
  };
}

/**
 * The phone block tone (stacked compositions): clear above the block, easing over the feather (scaled to
 * BLOCK_FEATHER_PX, so the machine just above the block stays lit) to `alpha` a few px above `top` (a CSS
 * length: the block's top) and flat below it to the end of the composition.
 */
export const BLOCK_ALPHA = 0.85;
const BLOCK_FEATHER_PX = 112;
const BLOCK_LEAD_PX = 8;
export function blockTone(top: string, alpha = BLOCK_ALPHA): string {
  const span = FEATHER[FEATHER.length - 1][0];
  const stops = FEATHER.map(([px, k]) => {
    const at = BLOCK_LEAD_PX + BLOCK_FEATHER_PX - (px * BLOCK_FEATHER_PX) / span;
    return `rgb(${NIGHT} / ${+(alpha * k).toFixed(4)}) calc(${top} - ${+at.toFixed(2)}px)`;
  });
  return `linear-gradient(to bottom, rgb(${NIGHT} / 0) 0, ${stops.join(", ")}, rgb(${NIGHT} / ${alpha}) 100%)`;
}

/**
 * The body tone (a chapter's flow content after its composition: About's DeliveryStrip): a light centre
 * tone — night 0.42 at the frame's edges rising to 0.8 across the 76 rem content column — so the held
 * frame still reads at the sides; phones get the flat block tone. Its top eases in over 160 px (BODY_MASK,
 * applied where the framed layout is, app/globals.css), so the body arrives as shade, not a panel edge.
 */
export const BODY_ALPHA = 0.8;
export function bodyTone(alpha = BODY_ALPHA, edge = 0.42): string {
  return `linear-gradient(to right, rgb(${NIGHT} / ${edge}) 0, rgb(${NIGHT} / ${alpha}) calc(50% - 38rem), rgb(${NIGHT} / ${alpha}) calc(50% + 38rem), rgb(${NIGHT} / ${edge}) 100%)`;
}
export const BODY_MASK = `linear-gradient(to bottom, ${[...edge(0, 1, "top", "0 0 0"), ...edge(0, 1, "bottom", "0 0 0").reverse()].join(", ")})`;
/** Phones: the body continues the block tone above it, so only its bottom eases out. */
export const BODY_MASK_BOTTOM = `linear-gradient(to bottom, rgb(0 0 0 / 1) 0, ${edge(0, 1, "bottom", "0 0 0").reverse().join(", ")})`;

/**
 * The closing band (the footer at the bottom of the last chapter, over tower-K4): night `alpha` across the
 * bottom BAND_FULL_PX (the footer's line sits there), easing to clear above over BAND_FEATHER, clear from
 * 136 px up — so the lamp's row (≈ 0.15 of the height above the bottom) stays at ≤ 0.15 alpha.
 */
const BAND_FULL_PX = 80;
const BAND_FEATHER: readonly (readonly [number, number])[] = [
  [0, 0],
  [12, 0.05],
  [24, 0.15],
  [34, 0.35],
  [44, 0.7],
  [56, 1],
];
export const CLOSING_ALPHA = 0.88;
export function closingBand(alpha = CLOSING_ALPHA): string {
  const clearAt = BAND_FULL_PX + BAND_FEATHER[BAND_FEATHER.length - 1][0];
  const feather = [...BAND_FEATHER]
    .reverse()
    .map(([px, k]) => `rgb(${NIGHT} / ${+(alpha * k).toFixed(4)}) ${clearAt - px}px`);
  return `linear-gradient(to top, rgb(${NIGHT} / ${alpha}) 0, ${feather.join(", ")})`;
}

/**
 * The side tone's fall across the frame (frame x, share of its alpha): flat to x 0.29, then a long shallow
 * ramp under the right part of the text column (0.9 → 0.53 of night over x 0.29–0.42, ≈ 0.002 per px at
 * 1440×900) and on to clear at the tower's axis (x 0.50), so it reads as shade with no edge: on average
 * ≈ 0.003 transmission per px across the whole fall. The column's lines end at x ≈ 0.42 and the lamp's glow
 * starts at ≈ 0.49, which is what sets the outer slope (≈ 0.005 per px at most); the lamp itself (0.50,
 * 0.35) is unshaded.
 */
const SIDE_FALL: readonly (readonly [number, number])[] = [
  [0.2875, 1],
  [0.3125, 0.978],
  [0.3438, 0.911],
  [0.375, 0.8],
  [0.4, 0.689],
  [0.4188, 0.589],
  [0.4375, 0.456],
  [0.4563, 0.3],
  [0.4719, 0.156],
  [0.4844, 0.056],
  [0.4938, 0.011],
  [0.5, 0],
];

/**
 * A side tone for a text column on the left of a frame whose subject stands just right of it (Experience's
 * Work column beside the CN Tower): night `alpha` from the layer's left edge, then SIDE_FALL. `from` / `to`
 * are the layer's frame-x span (its left and right edges), so the fall stays on the frame at every viewport;
 * its top and bottom ease in and out through sideToneMask().
 */
export function sideTone(alpha: number, from: number, to: number): string {
  const at = (x: number) => `${+(((x - from) / (to - from)) * 100).toFixed(2)}%`;
  const stops = SIDE_FALL.map(([x, k]) => `rgb(${NIGHT} / ${+(alpha * k).toFixed(3)}) ${at(x)}`);
  return `linear-gradient(to right, rgb(${NIGHT} / ${alpha}) 0, ${stops.join(", ")})`;
}

/**
 * The side tone's vertical mask over a layer spanning frame y `from`–`to`: in by frame y 0.054 (under the
 * header), full to y 0.505 (the column's last line ends at ≈ 0.535), then one even fade to clear at `to`
 * (Experience: 0.70, the lake), ≈ 0.005 per px at 1440×900 instead of a band edge over the skyline.
 */
export function sideToneMask(from: number, to: number): string {
  const at = (y: number) => `${+(((y - from) / (to - from)) * 100).toFixed(2)}%`;
  return `linear-gradient(to bottom, rgb(0 0 0 / 0) 0, rgb(0 0 0 / 1) ${at(0.054)}, rgb(0 0 0 / 1) ${at(0.505)}, rgb(0 0 0 / 0) 100%)`;
}

/**
 * A column tone for text over a bright part of a frame (the tower's fog behind Experience's Work column):
 * an elliptical night wash, `alpha` at its centre fading to clear at its box edge. Like a halo, but sized to
 * a whole column; it arrives with the column's first block.
 */
export function columnTone(alpha = 0.78, flat = false): string {
  const a = (k: number) => `rgb(${NIGHT} / ${+(alpha * k).toFixed(3)})`;
  // `flat`: a broad core (full alpha to half the radius) for a column whose text fills its box.
  return flat
    ? `radial-gradient(closest-side, ${a(1)}, ${a(1)} 50%, ${a(0.75)} 72%, ${a(0.3)} 88%, rgb(${NIGHT} / 0) 100%)`
    : `radial-gradient(closest-side, ${a(1)}, ${a(0.9)} 45%, ${a(0.55)} 70%, ${a(0.18)} 88%, rgb(${NIGHT} / 0) 100%)`;
}

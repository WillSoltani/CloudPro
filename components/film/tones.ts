// Tones over the film (part five §2c): the night-coloured washes that keep text legible on the picture.
// Pure and server-safe: the feather maths, the halo, the phone block tone, the body tone, the closing band
// and the side and column tones the chapters use. No borders, no box-shadows, no blur: a tone is only ever
// a feathered gradient of the page's night.

/** --color-night #070b16 as an "r g b" triplet for `rgb(… / a)`: the page and the tower's navy sky. */
export const NIGHT = "7 11 22";
/** The rack's tones: a neutral near-black, so the washes over the grey hardware never read blue. */
export const RACK_NIGHT = "9 10 12";
/** The tones' colour for a reel film: RACK_NIGHT on the rack (rack-*), NIGHT on the tower. */
export const toneOf = (film: string) => (film.startsWith("rack-") ? RACK_NIGHT : NIGHT);

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
export function halo(color = NIGHT): string {
  return `radial-gradient(closest-side, rgb(${color} / ${HALO_ALPHA}), rgb(${color} / ${+(HALO_ALPHA * 0.62).toFixed(3)}) 55%, rgb(${color} / 0) 100%)`;
}
export const HALO = halo();

/**
 * A soft box halo for a small-text block over bright sky (part five §2c "a halo arrives with each small-text
 * block"; Contact's paragraph on the short phones, app/globals.css `[data-halo]` with `--halo-*-s`): night
 * `alpha` across the block, reaching `pad` px past each side ([top, right, bottom, left]) and easing to clear
 * over that pad, as a product of a horizontal and a vertical ramp, so it follows the block wherever its text
 * wraps. Returns the custom properties for the block's style.
 */
export function boxHalo(
  alpha: number,
  pad: readonly [number, number, number, number],
): Record<"--box-inset" | "--box-bg" | "--box-mask", string> {
  const [top, right, bottom, left] = pad;
  const a = (k: number) => `rgb(${NIGHT} / ${+(alpha * k).toFixed(3)})`;
  return {
    "--box-inset": `${-top}px ${-right}px ${-bottom}px ${-left}px`,
    "--box-bg": `linear-gradient(to right, ${a(0)} 0, ${a(1)} ${left}px, ${a(1)} calc(100% - ${right}px), ${a(0)} 100%)`,
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
export function blockTone(top: string, alpha = BLOCK_ALPHA, color = NIGHT): string {
  const span = FEATHER[FEATHER.length - 1][0];
  const stops = FEATHER.map(([px, k]) => {
    const at = BLOCK_LEAD_PX + BLOCK_FEATHER_PX - (px * BLOCK_FEATHER_PX) / span;
    return `rgb(${color} / ${+(alpha * k).toFixed(4)}) calc(${top} - ${+at.toFixed(2)}px)`;
  });
  return `linear-gradient(to bottom, rgb(${color} / 0) 0, ${stops.join(", ")}, rgb(${color} / ${alpha}) 100%)`;
}

/**
 * The body tone (a chapter's flow content after its composition: About's DeliveryStrip): a light centre
 * tone — night 0.42 at the frame's edges rising to 0.8 across the 76 rem content column — so the held
 * frame still reads at the sides; phones get the flat block tone. Its top eases in over 160 px (BODY_MASK,
 * applied where the framed layout is, app/globals.css), so the body arrives as shade, not a panel edge.
 */
export const BODY_ALPHA = 0.8;
export function bodyTone(alpha = BODY_ALPHA, edge = 0.42, color = NIGHT): string {
  return `linear-gradient(to right, rgb(${color} / ${edge}) 0, rgb(${color} / ${alpha}) calc(50% - 38rem), rgb(${color} / ${alpha}) calc(50% + 38rem), rgb(${color} / ${edge}) 100%)`;
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

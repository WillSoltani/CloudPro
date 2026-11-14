// The hero badge's look (BeaconCaptions Intro), as class strings Tailwind scans. Pure.
//
// Stage 8. The badge sat over the moving film with `backdrop-blur-sm`, which makes the compositor re-blur the film behind
// it on every frame, and an endless `animate-ping` dot, which keeps the compositor busy even at rest. Now:
//   - on touch screens (pointer: coarse) no blur; a night wash over the amber tint instead (BADGE_COARSE_WASH), so the
//     text stays readable over whatever the film shows there. Desktop keeps the blur.
//   - the dot's ping runs PING_CYCLES times and stops (fill-mode forwards: its last keyframe is transparent).
//   - `?badge=blur` brings back the old look (the blur everywhere, the endless ping) for one page load (the owner's
//     comparison switch, read after mount so the server HTML and hydration are the same either way).

/** Night (#070b16) over the pill's amber tint on touch screens, as an alpha. */
export const BADGE_COARSE_WASH = 0.45;
/** The ping's cycles (one second each) before it stops. */
export const PING_CYCLES = 3;

/** The pill, in every look. */
export const BADGE_BASE =
  "inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-lamp/40 bg-lamp/10 px-3.5 py-1.5 text-[11px] leading-snug text-slate-200 sm:text-xs";

/**
 * The old look: the blur, and on short phones (phone-short: the badge text measured 4.48:1 on the slate-400 proxy at 320×568)
 * a 20 % night wash.
 */
export const BADGE_OLD = "backdrop-blur-sm phone-short:bg-[linear-gradient(rgb(7_11_22/0.2),rgb(7_11_22/0.2))]";

/**
 * The default: the old look where the primary pointer is not coarse (desktop), and on touch screens no blur and the
 * BADGE_COARSE_WASH night wash (it replaces the short phones' 20 % one there).
 */
export const BADGE_CALM =
  "backdrop-blur-sm pointer-coarse:backdrop-blur-none not-pointer-coarse:phone-short:bg-[linear-gradient(rgb(7_11_22/0.2),rgb(7_11_22/0.2))] pointer-coarse:bg-[linear-gradient(rgb(7_11_22/0.45),rgb(7_11_22/0.45))]";

/**
 * The dot's ping: the old endless one, and the default's PING_CYCLES. (`animate-ping` stays in this file so Tailwind emits
 * the `ping` keyframes the arbitrary animation names.)
 */
export const PING_OLD = "motion-safe:animate-ping";
export const PING_CALM = "motion-safe:animate-[ping_1s_cubic-bezier(0,0,0.2,1)_3_forwards]";

/** The class strings for the page load: `blur` is `?badge=blur`. */
export function badgeLook(blur: boolean): { pill: string; ping: string; look: "blur" | "calm" } {
  return blur
    ? { pill: `${BADGE_BASE} ${BADGE_OLD}`, ping: PING_OLD, look: "blur" }
    : { pill: `${BADGE_BASE} ${BADGE_CALM}`, ping: PING_CALM, look: "calm" };
}

/** True when the query string asks for the old look. */
export function badgeBlurRequested(search: string): boolean {
  return new URLSearchParams(search).get("badge") === "blur";
}

// WCAG contrast of the badge's text over the composited fill, for the checks in badgeLook.test.ts.
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb: readonly number[]) => 0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!);
/** Contrast ratio between two sRGB colours (0..255 channels). */
export function contrast(a: readonly number[], b: readonly number[]): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** `top` over `bottom` at `alpha`. */
export function over(top: readonly number[], bottom: readonly number[], alpha: number): number[] {
  return bottom.map((v, i) => v * (1 - alpha) + top[i]! * alpha);
}

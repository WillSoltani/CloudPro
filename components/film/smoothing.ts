/**
 * How the film's clock is smoothed, by input (components/film/FilmBackdrop.tsx). Pure, so it is unit-tested
 * (smoothing.test.ts).
 *
 * A wheel, the keyboard and the scroll bar move the page in steps: the reel clock jumps 10 to 30 frames at a time and
 * a spring (WHEEL_SPRING, the page's art-directed feel) turns those steps into a glide, at about 171 ms of steady lag.
 * A finger is already continuous and the browser supplies the momentum after it lifts, so a spring that slow is only
 * lag between the finger and the picture: touch gets the same spring run faster, TOUCH_LAG_MS of steady lag (enough to
 * hide frame-to-frame jitter, not enough to feel like lag). `?smooth=<ms>` replaces the touch value for one page load.
 *
 * Around the spring, the follower (createFollower) keeps the shown clock honest: never past the raw clock, never a
 * step against the direction of travel, an immediate turn on a reversal. It holds for any smoothing.
 */

/** The input that moved the page last. Momentum after a finger lifts is still "touch". */
export type ScrollInput = "wheel" | "keys" | "touch";

export type SpringParams = { stiffness: number; damping: number; mass: number; restDelta: number };

/** Today's spring, for the wheel, the keys and the scroll bar. Critically damped: smooths wheel steps without a slow tail. */
export const WHEEL_SPRING: Readonly<SpringParams> = { stiffness: 140, damping: 24, mass: 1, restDelta: 0.0005 };

/** Steady lag of the touch smoothing, in ms (a FEEL value: `?smooth=<ms>` tries others on a real phone). */
export const TOUCH_LAG_MS = 35;

/** The largest `?smooth=` value accepted, in ms. */
export const MAX_SMOOTH_MS = 300;

/**
 * A spring's steady lag behind a clock moving at constant speed, in ms: damping / stiffness (for any mass). WHEEL_SPRING:
 * 24 / 140 s, about 171 ms.
 */
export function springLagMs(s: SpringParams): number {
  return (1000 * s.damping) / s.stiffness;
}

/**
 * WHEEL_SPRING run faster, so its steady lag is `ms`: the same damping ratio and rest threshold, time scaled by
 * f = ms / springLagMs(WHEEL_SPRING) (stiffness / f², damping / f). Null for 0: no smoothing at all.
 */
export function springForLag(ms: number): SpringParams | null {
  if (!(ms > 0)) return null;
  const f = ms / springLagMs(WHEEL_SPRING);
  return {
    stiffness: WHEEL_SPRING.stiffness / (f * f),
    damping: WHEEL_SPRING.damping / f,
    mass: WHEEL_SPRING.mass,
    restDelta: WHEEL_SPRING.restDelta,
  };
}

/** The smoothing in effect: its steady lag in ms and the spring that gives it (null: the shown clock is the raw clock). */
export type Smoothing = { input: ScrollInput; lagMs: number; spring: SpringParams | null };

/** The smoothing for an input: WHEEL_SPRING itself for the wheel and the keys, a TOUCH_LAG_MS spring (or `touchLagMs`) for touch. */
export function smoothingFor(input: ScrollInput, touchLagMs: number = TOUCH_LAG_MS): Smoothing {
  if (input !== "touch") return { input, lagMs: springLagMs(WHEEL_SPRING), spring: { ...WHEEL_SPRING } };
  const spring = springForLag(touchLagMs);
  return { input, lagMs: spring ? touchLagMs : 0, spring };
}

/** `?smooth=<ms>`: whole milliseconds 0 to MAX_SMOOTH_MS replace the touch lag; anything else is null (the default stands). */
export function smoothParam(search: string): number | null {
  const raw = new URLSearchParams(search).get("smooth");
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
  const ms = Number(raw);
  return ms <= MAX_SMOOTH_MS ? ms : null;
}

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Spacebar", "Home", "End"]);

/**
 * The input an event says the viewer is using, or null when it says nothing: touchstart / touchmove and a touch or pen
 * pointer are "touch"; a wheel is "wheel"; a key that scrolls the page is "keys"; a mouse press (the scroll bar, a click)
 * is "wheel" (today's spring). Everything else (a scroll itself, a touchend, momentum) keeps the input it had.
 */
export function inputOf(type: string, detail?: { pointerType?: string; key?: string }): ScrollInput | null {
  switch (type) {
    case "touchstart":
    case "touchmove":
      return "touch";
    case "wheel":
      return "wheel";
    case "keydown":
      return detail?.key !== undefined && SCROLL_KEYS.has(detail.key) ? "keys" : null;
    case "pointerdown":
      if (detail?.pointerType === "touch" || detail?.pointerType === "pen") return "touch";
      if (detail?.pointerType === "mouse") return "wheel";
      return null;
    default:
      return null;
  }
}

/**
 * The shown clock's rules around the spring (FilmBackdrop's steer and follow), as state the engine drives:
 *
 * - `steer(delta)` on every raw clock change: records the direction of travel; on a reversal it returns the shown
 *   clock, where the engine re-seeds the spring at rest (its momentum points the old way), so the picture turns at
 *   once. NaN otherwise.
 * - `scrolled(scrollY)` on every tick: the viewer's input reaches the scroll handler a frame late, so the direction is
 *   taken straight from scrollY as well and the tick in between already holds instead of running on the old way.
 * - `quiet(springAt)` once the raw clock has been still QUIET_MS: there is no direction of travel any more; if the
 *   spring ran on while the picture was held against a reversal, it returns the shown clock to carry on from (the
 *   engine jumps the spring there and sets it to the raw clock), else NaN.
 * - `follow(c, raw)` on every tick with the spring's value c and the raw clock: the shown clock follows the spring but
 *   never passes the raw clock and never steps against the direction of travel (without one, toward the raw clock
 *   from either side). A spring carrying velocity into a stop would otherwise overshoot and slide back a frame or two.
 */
export type Follower = {
  readonly shown: number;
  readonly direction: number;
  steer(delta: number): number;
  scrolled(scrollY: number): void;
  quiet(springAt: number): number;
  follow(c: number, raw: number): number;
  /** Show `c` as it is (the first tick, reduced motion). */
  land(c: number): number;
};

export function createFollower(): Follower {
  let shown = Number.NaN;
  let rawDir = 0;
  let lastDir = 0;
  let seenY = Number.NaN;
  return {
    get shown() {
      return shown;
    },
    get direction() {
      return rawDir;
    },
    steer(delta) {
      if (Math.abs(delta) < 1e-6) return Number.NaN;
      const dir = Math.sign(delta);
      const reversed = lastDir !== 0 && dir !== lastDir && Number.isFinite(shown);
      rawDir = lastDir = dir;
      return reversed ? shown : Number.NaN;
    },
    scrolled(scrollY) {
      if (Number.isFinite(seenY) && Math.abs(scrollY - seenY) >= 0.5) rawDir = Math.sign(scrollY - seenY);
      seenY = scrollY;
    },
    quiet(springAt) {
      rawDir = 0;
      return Number.isFinite(shown) && Math.abs(springAt - shown) > 1e-6 ? shown : Number.NaN;
    },
    follow(c, raw) {
      if (!Number.isFinite(shown)) return (shown = c);
      const dir = rawDir || (raw >= shown ? 1 : -1);
      shown = dir > 0 ? Math.max(shown, Math.min(c, raw)) : Math.min(shown, Math.max(c, raw));
      return shown;
    },
    land(c) {
      return (shown = c);
    },
  };
}

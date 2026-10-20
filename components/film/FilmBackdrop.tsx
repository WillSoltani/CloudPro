"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motionValue, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import {
  frameUrl,
  pickFilmOrientation,
  useReducedMotionSafe,
  type FilmEntry,
  type FilmManifest,
  type HoldKeys,
} from "@/components/film/filmCore";
import { coverRect, manifestFor } from "@/components/film/filmBase";
import { HOLD_REVEALS_KEY, HOLD_STORAGE_KEY } from "@/components/film/reel";
import { REEL_CHROME_EVENT, type ReelChrome } from "@/components/film/useReelChrome";

/**
 * One crop point for the whole reel (x, y in 0–1): segments share boundary frames, so a per-film focus
 * would make the shared frame jump on wide viewports. The key layers and the poster use the same point.
 */
export const REEL_FOCUS: readonly [number, number] = [0.5, 0.45];
/** `object-position` / `background-position` matching REEL_FOCUS, for layers that must line up with the canvas. */
export const REEL_OBJECT_POSITION = `${REEL_FOCUS[0] * 100}% ${REEL_FOCUS[1] * 100}%`;

// Critically damped: smooths wheel steps without a slow tail.
const SPRING = { stiffness: 140, damping: 24, mass: 1, restDelta: 0.0005 } as const;
// Coarse-to-fine: every 16th frame first, so a segment scrubs long before it has fully loaded.
const STRIDES = [16, 8, 4, 2, 1];
// A segment starts loading once it is within ~1.5 viewports.
const NEAR = "150% 0px";
// Hold keys: segment i's end key fades in over the last KEY_IN_PX of its scroll (the hero keeps its
// 6 %) and out over the first KEY_OUT_PX of segment i+1, converted per segment to its scroll range,
// unless segment i sets its own `keyIn` (a long fade onto a key that is not its last frame) or segment
// i+1 its own `dissolveIn` (a longer crossfade where the subject changes).
const HERO_KEY_IN = 0.06;
const KEY_IN_PX = 160;
const KEY_OUT_PX = 120;
// Tier ceiling for coarse pointers, by pixel count so it means the same for every aspect: the 1280-wide
// landscape tier (1280 × 720) with room for the portrait tier that matches it (720 × 1560, 1.22× the
// pixels), never the 1920 landscape or 1080 portrait tiers.
const COARSE_MAX_PIXELS = 1280 * 720 * 1.25;
// A frame within this many of the target may lift the poster (and counts as "landed").
const LANDED = 8;
// The canvas fades in over this on its first paint when nothing covers it.
const FIRST_PAINT_MS = 250;
// After load, measures keep landing instead of scrubbing for this long (the browser restores scroll).
const SETTLE_MS = 500;
// Until the visitor engages (scrolls, or arrives on a hash or a restored position), the active segment
// fetches only its stride-ENGAGE_STRIDE skeleton (plus 0, M and last) and the next segment its 0, M and
// last: an idle phone no longer downloads two films before the first scroll.
const ENGAGE_STRIDE = 4;
// A slow network (navigator.connection's effectiveType, or the timed first hero frames where there is none):
// the smallest tier, and at most this many requests in flight.
const SLOW_INFLIGHT = 3;
// Without navigator.connection: the first this-many hero frames are timed; a median above SLOW_FRAME_MS
// moves every segment not yet started to the smallest tier (at the next segment boundary).
const TIMED_FRAMES = 8;
const SLOW_FRAME_MS = 400;
// A tier may be up to this much narrower than the need (a 390 px phone at DPR 3 needs 438.75 px: 432 is 1.6 % short).
const TIER_SLACK = 0.02;
// The raw clock has no direction of travel once it has been still this long (the follower below).
const QUIET_MS = 150;

export type SegmentRegistration = {
  /** Position in the reel (the backdrop's `reel` order). */
  index: number;
  film: FilmManifest;
  /** The segment's tall <section>: its scroll position drives the reel. */
  el: HTMLElement;
  /** Stills shown per segment under prefers-reduced-motion. */
  reducedSteps: number;
  /** Set by the backdrop to the move's progress p (0→1, smoothed); the segment provides it to its overlays. */
  progress: MotionValue<number>;
  /**
   * Set by the backdrop to the smoothed film frame as a float: p·M in the move, M + g(τ)·T in the tail
   * (0 before the segment, its last value after it). Chapters key their reveals to it.
   */
  frame?: MotionValue<number>;
  /** Set by the backdrop to the smoothed tail fraction τ (0 in the move, 0→1 from camera rest to the next segment). */
  tau?: MotionValue<number>;
  /** Set by the backdrop on every measure: τ at the end of the read pin (read / q; 0 without one). */
  tauRead?: MotionValue<number>;
  /**
   * The camera move in viewport heights (svh) for a chapter (FilmChapter), whose section is taller than
   * its move: the rest of its scroll (read pin, release, body) is its tail. Without it the move is the
   * legacy one, the section height minus the viewport (FilmSegment: the hero and the exit).
   */
  moveVh?: number;
  /** The read pin in viewport heights (chapters): the composition stays pinned this long after camera rest. */
  readVh?: number;
  /**
   * Rendered breathing-tail frames appended to the film (renderer §2e): frames `from` (= M, the hold
   * pose) … `from + frames` (rack-01…04: 48). Without them, and wherever they do not play (reduced motion,
   * Save-Data), the tail paints M under the hold key.
   */
  tail?: { from: number; frames: number };
  /**
   * The hold key's breath while the tail plays and no tail frames do (the stand-in push): the key layer
   * scales by 1 + scale·sin²(π·g(τ)) about `origin` (frame fractions), identity at τ 0 and 1.
   */
  breath?: { scale: number; origin: readonly [number, number] };
  /**
   * The nav section this segment carries (`data-reel-section`), active from move frame `activeFrom` (the
   * unit's amber frame); "" clears it (the hero, the epilogue). Undefined: the previous segment's carries on.
   */
  section?: string;
  activeFrom?: number;
  /**
   * Fraction (0–0.5) of this segment's scroll range over which the previous hold's key fades out as the
   * segment begins; default: min(0.5, KEY_OUT_PX / range), i.e. 120 px.
   */
  dissolveIn?: number;
  /**
   * Fraction (0.01–0.5) of this segment's scroll range over which ITS end key (the hold after it) fades in,
   * eased with smootherstep; default: linear over min(0.5, KEY_IN_PX / range), i.e. 160 px (hero: 6 %).
   * For a key that is not the segment's own last frame (the epilogue's dissolve onto tower-K4: 0.273).
   */
  keyIn?: number;
};

export type BackdropApi = {
  /** The reel's entries in scroll order; index i is segment i. */
  reel: readonly FilmEntry[];
  /** Segment index of an entry, or of either manifest of an entry (matched by name); −1 if absent. */
  indexOf(film: FilmEntry | FilmManifest): number;
  /**
   * The manifest segment `index` plays on this page load: its portrait film where the `wide` rule fails
   * and the entry has one, else landscape. Client only (effects, handlers): it picks the orientation.
   */
  manifestAt(index: number): FilmManifest | undefined;
  /** Called from a segment's effect; returns the unregister cleanup. */
  register(segment: SegmentRegistration): () => void;
  subscribeDrawn(onChange: () => void): () => void;
  /** True once the canvas has painted segment `index` within LANDED frames of its target. */
  hasDrawn(index: number): boolean;
  /**
   * The hero's SSR poster is up: the clock targets segment 0 and segment 0 has not landed yet. Elsewhere it is
   * down (About is joined −100svh over the hero's sticky stage, so a poster waiting for segment 0 would band
   * About after a reload or a deep link); back at the top before rack-00 has landed it covers the stale frame.
   * Changes are published through `subscribeDrawn`.
   */
  posterUp(): boolean;
  /**
   * The segment and frame actually on the canvas (−1 before the first paint and while a resize has
   * cleared it), set in draw() the moment they are painted. While coarse passes land, the painted frame
   * trails the target, so overlays that must sit on the picture (PerspectivePlate) follow these, not
   * the scroll. Subscribe with `.on("change", …)`; no React renders.
   */
  drawnSegment: MotionValue<number>;
  drawnFrame: MotionValue<number>;
};

const FilmBackdropContext = createContext<BackdropApi | null>(null);

export function useFilmBackdrop(): BackdropApi {
  const backdrop = useContext(FilmBackdropContext);
  if (!backdrop) throw new Error("<FilmSegment> must be rendered inside <FilmBackdrop>");
  return backdrop;
}

type Segment = {
  reg: SegmentRegistration;
  /** Frame width tier, fixed when the segment joins. */
  width: number;
  /** The camera move m in px (legacy: section height − viewport), refreshed on every measure. */
  range: number;
  /** Everything after the move until the next segment starts (or the page ends), q = D − m, in px. */
  after: number;
  /** μ = m / (m + q): the share of the segment's clock unit spent in the move. */
  mu: number;
  /** The read pin in px (chapters; 0 otherwise). */
  read: number;
  /** The next segment starts where this section ends (no hold panel or body between them). */
  adjacent: boolean;
  /** Request order: the target, last, 0, then strides 16/8/4/2/1 nearest-first (or the reduced stills). */
  order: number[];
  cursor: number;
  /** The frame `order` was ranked around. */
  rankedAt: number;
  /** Frames that appear in `order` (all of them, or the reduced-motion stills). */
  inOrder: Uint8Array;
  /** Per frame: 0 idle · 1 requested (a failed frame stays here: not retried) · 2 decoded. */
  status: Uint8Array;
  frames: (HTMLImageElement | undefined)[];
  /** In-flight requests; `release` frees the request's loader slot exactly once (see request). */
  pending: Map<number, { img: HTMLImageElement; release: () => void }>;
  loaded: number;
  /** Within NEAR of the viewport. */
  near: boolean;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const NO_KEYS: HoldKeys = { landscape: [], portrait: [] };
// With tail frames on, the boot key (a cold deep link into a hold) fades over this once the canvas has
// painted its segment (τ = 0 is the key's own bytes, so nothing visibly changes).
const BOOT_KEY_OUT_MS = 400;


/**
 * The tail's breath curve: g = 0 at τ 0, 0.5 at the end of the read pin (τ_read), 1 at τ 1, linear between
 * (breath out during the read pin, back during the release). Without a read pin it is τ itself.
 */
export function breathCurve(tau: number, tauRead: number): number {
  if (tau <= 0) return 0;
  if (tau >= 1) return 1;
  if (!(tauRead > 0 && tauRead < 1)) return tau;
  return tau < tauRead ? (0.5 * tau) / tauRead : 0.5 + (0.5 * (tau - tauRead)) / (1 - tauRead);
}

/**
 * The homepage's single film canvas: `position: fixed` behind the whole page, painting whichever
 * segment the scroll is in, and holding the previous segment's last frame behind the HTML sections
 * between segments, so the page never cuts to flat base.
 *
 * The reel clock `c` (part five §2a): for each registered segment whose top has reached the viewport
 * top, `y = −top`, `m` = its camera move in px (a chapter's `moveVh`·svh; a legacy segment's section
 * height − viewport), `q = D − m` with D the distance to the next segment's top (or to the end of the
 * page), `μ = m / (m + q)` and `u = y < m ? μ·y/m : μ + (1 − μ)·(y − m)/q` (clamped 0–1); `c` is the max
 * of `i + u`, spring-smoothed (unsmoothed under reduced motion). From the smoothed `c`: `seg = floor(c)`,
 * `p = min(1, u/μ)` (the move), `τ = (u − μ)/(1 − μ)` (the tail). Painted: `round(p·M)` in the move and
 * `M + round(g(τ)·T)` in the tail (g: breathCurve; T = 0 without tail frames or under reduced motion or
 * Save-Data, so the tail holds M on the key).
 * The legacy reel position `r = seg + p` (exactly `i + 1` through the hold after segment i) keeps
 * `data-reel`, the session hold and the key fades as they were. Hooks `data-clock` (c) and `data-tail` (τ).
 *
 * Chrome: from the raw (unsmoothed) clock, `<html data-reel-chrome>` is `film` in a move (and through a
 * legacy segment's tail when the next segment follows directly), `composed` through a chapter's read pin,
 * `body` otherwise; `data-reel-section` is the section of the last segment whose `activeFrom` frame has
 * passed. Both fire REEL_CHROME_EVENT (useReelChrome).
 *
 * Orientation: picked once per page load with the `wide` rule (filmCore pickFilmOrientation): wide plays
 * every entry's landscape film, anything else its portrait film where it has one; the hold keys follow
 * (`keys.portrait`). Tiers are chosen per manifest from its own widths and aspect.
 *
 * Cover fit: draw() and the key layers both place the picture with filmBase coverRect() at REEL_FOCUS,
 * the same call PerspectivePlate uses, so no overlay can drift from the canvas.
 *
 * Mount once, with no transformed/filtered ancestor (that would break `fixed`). Pass a stable reel.
 * Test hooks on the canvas: `data-segment` (film name), `data-frame`, `data-reel` (3 dp), `data-width`,
 * `data-clock` (c, 3 dp), `data-tail` (τ of the painted segment, 3 dp).
 */
export function FilmBackdrop({
  reel,
  keys = NO_KEYS,
  children,
}: {
  /** Ordered entries, manifests resolveFilm()-ed (components/film/reel.ts REEL); index i is segment i. Stable. */
  reel: readonly FilmEntry[];
  /**
   * The approved still for the hold after each segment, per orientation (`keys.landscape[i]` after
   * segment i; reel.ts HOLD_KEYS). Layered over the canvas, fixed like it, from the end of segment i
   * through the start of segment i+1, so a hold shows the key itself and the join into the next segment is
   * a crossfade (≈ 120 px, or the next segment's own `dissolveIn`). Where segment i's tail frames play, its
   * key is only the boot key (a cold load into that hold), released once the canvas has painted. Stable.
   */
  keys?: HoldKeys;
  children: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  // 100svh in px: a chapter's `moveVh` is in small-viewport units, like its spacer.
  const probeRef = useRef<HTMLDivElement>(null);
  // The registry: segments add themselves from their effects. A ref, never state, so registering
  // never re-renders the page.
  const registry = useRef(new Map<number, SegmentRegistration>());
  // Set while the backdrop runs, so a segment that registers late joins it.
  const resync = useRef<(() => void) | null>(null);
  const drawn = useRef(new Set<number>());
  const drawnListeners = useRef(new Set<() => void>());
  // The clock targets segment 0 (true until the first measure: the SSR poster's own state).
  const atHero = useRef(true);

  const [api] = useState<BackdropApi>(() => ({
    reel,
    // By name, not identity: a Fast Refresh of reel.ts re-creates the entries while this api (and the reel
    // it captured) lives on, so identity would orphan every segment until a full reload.
    indexOf: (film) => {
      const name = "landscape" in film ? film.landscape.name : film.name;
      return reel.findIndex((e) => e.landscape.name === name || e.portrait?.name === name);
    },
    manifestAt: (index) => (reel[index] ? manifestFor(reel[index], pickFilmOrientation()) : undefined),
    register: (segment) => {
      registry.current.set(segment.index, segment);
      resync.current?.();
      return () => {
        if (registry.current.get(segment.index) === segment) registry.current.delete(segment.index);
        resync.current?.();
      };
    },
    subscribeDrawn: (onChange) => {
      drawnListeners.current.add(onChange);
      return () => {
        drawnListeners.current.delete(onChange);
      };
    },
    hasDrawn: (index) => drawn.current.has(index),
    posterUp: () => atHero.current && !drawn.current.has(0),
    drawnSegment: motionValue(-1),
    drawnFrame: motionValue(-1),
  }));

  const reduced = useReducedMotionSafe();
  const scrolled = useMotionValue(0);
  const spring = useSpring(scrolled, SPRING);

  // app/globals.css keeps the homepage's initial #fragment jump instant until the page has loaded;
  // from then on, anchor links scroll smoothly again.
  useEffect(() => {
    const root = document.documentElement;
    const ready = () => {
      root.dataset.reelReady = "";
    };
    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });
    return () => {
      window.removeEventListener("load", ready);
      delete root.dataset.reelReady;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const registered = registry.current;
    const drawnSet = drawn.current;
    const listeners = drawnListeners.current;
    const position = reduced ? scrolled : spring;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string; rtt?: number; downlink?: number } }
    ).connection;
    const saveData = connection?.saveData === true;
    // A slow network by the browser's own class (2g, slow-2g, 3g). Not by downlink: Chrome's first estimate
    // reads 1.45–1.75 Mb/s on fast connections too (and never moves for localhost), so it sent desktops to
    // the smallest tier.
    // Slow: a 2g/3g class, or a 4g link that is both laggy and thin (Chrome reports rtt 0 and a low early
    // downlink estimate on fast links, so downlink alone must never decide).
    let slow =
      !!connection &&
      (["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? "") ||
        ((connection.rtt ?? 0) >= 100 && (connection.downlink ?? Infinity) < 2));
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let maxInflight = saveData || slow ? SLOW_INFLIGHT : 6;
    const n = reel.length;
    const portrait = pickFilmOrientation() === "portrait";
    const { drawnSegment: drawnSegmentMV, drawnFrame: drawnFrameMV } = api;

    // Hold-key layers (rendered below), indexed by segment. Each loads on approach (decoded first, then
    // set as the layer's background, sized and placed with coverRect); `keyReady[i]` once it is on the
    // layer. A layer whose orientation has no key stays empty.
    const keyLayers: (HTMLElement | undefined)[] = [];
    const keySrc: (string | undefined)[] = [];
    for (const el of keysRef.current?.querySelectorAll<HTMLElement>("[data-key]") ?? []) {
      const i = Number(el.dataset.key);
      keyLayers[i] = el;
      keySrc[i] = portrait ? (el.dataset.srcPortrait ?? el.dataset.src) : el.dataset.src;
    }
    // Natural aspect of each key once decoded (until then the layer's CSS cover fit, the same geometry).
    const keyAspect: number[] = [];
    const keyReady: boolean[] = [];
    const keyRequested: boolean[] = [];
    const keyShown: number[] = [];

    // The boot script in app/page.tsx may already show one key (a cold deep link into a hold). On a
    // restored position inside a breathing tail it shows the painted tail frame instead (`data-src`,
    // saved on pagehide below), which the boot layer then keeps, so the canvas takes over without a step.
    const boot = document.getElementById("reel-hold-boot");
    const bootHold = boot ? Number(boot.dataset.hold) : -1;
    const bootSrc = boot?.dataset.src;

    const segments = new Map<number, Segment>();
    const byEl = new Map<Element, Segment>();
    let cancelled = false;
    let raf = 0;
    let inflight = 0;
    let active = -1;
    let reelAt = 0;
    let clockAt = 0;
    let tailAt = 0;
    let targetSeg = 0;
    let targetFrame = 0;
    let drawnSeg = -1;
    let drawnFrame = -1;
    let painted = false;
    let measured = false;
    let settleUntil = document.readyState === "complete" ? performance.now() + SETTLE_MS : Infinity;
    // The idle gate (ENGAGE_STRIDE): open once the page has moved from the top (a scroll, a hash jump, a
    // restored position) or a boot key shows a hold. Never applied under reduced motion or Save-Data.
    // Save-Data visitors wait for the first scroll like everyone else (they get the smallest tier, not more bytes at idle).
    let engaged = reduced || bootHold >= 0 || window.scrollY !== 0;
    // Hero frame timings (ms), when there is no navigator.connection to ask.
    const heroTimes: number[] = [];
    let savedHold: string | null = null;
    let chromeKey = "";
    // With tail frames on, the boot key stays up until the canvas has landed on a frame once.
    let bootReleased = false;

    const onLoad = () => {
      settleUntil = performance.now() + SETTLE_MS;
    };
    if (settleUntil === Infinity) window.addEventListener("load", onLoad, { once: true });

    // M: the move's last frame (the hold pose), the film's last frame unless tail frames follow it.
    const moveEnd = (s: Segment) => {
      const last = s.reg.film.count - 1;
      const t = s.reg.tail;
      return t && t.from > 0 && t.from < last ? t.from : last;
    };
    // T: the tail frames this page load plays (none under reduced motion or Save-Data, or without any).
    const tailCount = (s: Segment) => {
      const t = s.reg.tail;
      if (!t || reduced || saveData) return 0;
      return Math.max(0, Math.min(t.frames, s.reg.film.count - 1 - moveEnd(s)));
    };
    const tailsOn = (i: number) => {
      const s = segments.get(i);
      return !!s && tailCount(s) > 0;
    };
    // τ at the end of the read pin, for the breath curve.
    const tauRead = (s: Segment) => (s.after > 0 ? s.read / s.after : 0);

    // Move progress → frame (0…M); under reduced motion the stills.
    const toIndex = (s: Segment, frac: number) => {
      const end = moveEnd(s);
      const steps = Math.max(2, s.reg.reducedSteps);
      const q = reduced ? Math.round(frac * (steps - 1)) / (steps - 1) : frac;
      return Math.min(end, Math.max(0, Math.round(q * end)));
    };

    // Frame tier, by pixel count so landscape (768/1280/1920) and portrait (432/720/1080) manifests are
    // judged alike: the smallest tier with the pixels the cover-fitted frame needs at (capped) device
    // resolution; coarse pointers top out at COARSE_MAX_PIXELS (the 1280 landscape tier or the 720
    // portrait tier), Save-Data takes the smallest.
    const tier = (film: FilmManifest) => {
      const sorted = [...film.widths].sort((a, b) => a - b);
      const pixels = (w: number) => (w * w) / film.aspect;
      const pool = saveData || slow
        ? [sorted[0]]
        : coarse
          ? sorted.filter((w) => pixels(w) <= COARSE_MAX_PIXELS)
          : sorted;
      if (!pool.length) pool.push(sorted[0]);
      const span = Math.max(canvas.clientWidth, canvas.clientHeight * film.aspect);
      const need = pixels(span * Math.min(dpr, 1.5) * 0.75 * (1 - TIER_SLACK));
      return pool.find((w) => pixels(w) >= need) ?? pool[pool.length - 1];
    };

    /** Widest gap tolerated between the painted frame and the target while something else is on screen. */
    const tolerance = (s: Segment) => Math.max(LANDED, Math.round(s.reg.film.count / 32));

    // Request order around `target`: the target itself, M, last and 0 (always resident), then each
    // coarse-to-fine pass nearest-first, so the frames that matter now arrive first. Tail frames (after M)
    // only while tails play, and only the even ones on coarse pointers.
    const rank = (s: Segment, target: number) => {
      const count = s.reg.film.count;
      const end = moveEnd(s);
      const tailOn = tailCount(s) > 0;
      const usable = (i: number) => i <= end || (tailOn && (!coarse || (i - end) % 2 === 0));
      const seen = new Uint8Array(count);
      const order: number[] = [];
      const push = (i: number) => {
        if (i >= 0 && i < count && !seen[i] && usable(i)) {
          seen[i] = 1;
          order.push(i);
        }
      };
      const nearest = (a: number, b: number) => Math.abs(a - target) - Math.abs(b - target);
      push(target);
      push(end);
      push(count - 1);
      push(0);
      if (reduced) {
        const steps = Math.max(2, s.reg.reducedSteps);
        const stills: number[] = [];
        for (let k = 0; k < steps; k++) stills.push(Math.round((k / (steps - 1)) * end));
        stills.sort(nearest).forEach(push);
      } else {
        for (const stride of STRIDES) {
          const pass: number[] = [];
          for (let i = 0; i < count; i += stride) pass.push(i);
          pass.sort(nearest).forEach(push);
        }
      }
      s.order = order;
      s.inOrder = seen;
      s.cursor = 0;
      s.rankedAt = target;
    };

    // Where a segment's frames are wanted from: the target while active, else the end the scroll
    // will enter it from.
    const entryFrame = (s: Segment) =>
      s.reg.index === active
        ? targetFrame
        : s.reg.index > active
          ? 0
          : tailCount(s) > 0
            ? s.reg.film.count - 1
            : moveEnd(s);

    const nearestLoaded = (s: Segment, i: number) => {
      for (let d = 0; d < s.reg.film.count; d++) {
        if (s.frames[i - d]) return i - d;
        if (s.frames[i + d]) return i + d;
      }
      return -1;
    };

    // A frame within `tol` of `i` may still arrive (queued or in flight), so it is worth waiting for.
    const nearerComing = (s: Segment, i: number, tol: number) => {
      const count = s.reg.film.count;
      for (let k = Math.max(0, i - tol); k <= Math.min(count - 1, i + tol); k++) {
        if (s.pending.has(k) || (s.status[k] === 0 && s.inOrder[k])) return true;
      }
      return false;
    };

    const markDrawn = (index: number) => {
      if (drawnSet.has(index)) return;
      drawnSet.add(index);
      for (const notify of listeners) notify();
    };

    // The hero's SSR poster is still up (see BackdropApi.posterUp).
    const posterUp = () => targetSeg === 0 && !drawnSet.has(0);
    // A hold key fully covers the canvas.
    const keyUp = () => keyShown.some((o, i) => o >= 0.999 && keyReady[i]);

    // Cover-fit (coverRect) at the reel's focus point on the DPR-sized canvas.
    const draw = () => {
      raf = 0;
      canvas.dataset.reel = reelAt.toFixed(3);
      canvas.dataset.clock = clockAt.toFixed(3);
      canvas.dataset.tail = tailAt.toFixed(3);
      const s = segments.get(targetSeg);
      if (!s) return;
      const i = nearestLoaded(s, targetFrame);
      if (i < 0 || (targetSeg === drawnSeg && i === drawnFrame)) return;
      const gap = Math.abs(i - targetFrame);
      const poster = posterUp();
      const covered = poster || keyUp() || drawnSeg >= 0;
      // While something is on screen (the poster, a key, the previous frame), never paint a frame far
      // from the target: wait for a nearer one rather than flash an unrelated moment of the film.
      const tol = poster ? LANDED : tolerance(s);
      if (covered && gap > tol && nearerComing(s, targetFrame, tol)) return;
      const img = s.frames[i]!;
      const rect = coverRect(canvas.width, canvas.height, img.naturalWidth / img.naturalHeight, REEL_FOCUS);
      ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
      drawnSeg = targetSeg;
      drawnFrame = i;
      // Overlays follow the painted frame (frame first: a listener on the segment then reads both).
      drawnFrameMV.set(i);
      drawnSegmentMV.set(targetSeg);
      canvas.dataset.segment = s.reg.film.name;
      canvas.dataset.frame = String(i);
      canvas.dataset.width = String(s.width);
      if (!painted) {
        painted = true;
        // Under the poster or a key the canvas can appear at once; on open page base it fades in.
        canvas.style.transition = covered ? "" : `opacity ${FIRST_PAINT_MS}ms ease-out`;
        canvas.style.opacity = "1";
      }
      if (gap <= LANDED) markDrawn(targetSeg);
      // Tails on: the boot key has done its job once the canvas has landed anywhere (its own segment, or
      // wherever the viewer went before it painted: a nav click, End, a flick on a slow network); it fades
      // out, and keyOpacity keeps it at 0 from then on.
      if (!bootReleased && bootHold >= 0 && tailsOn(bootHold) && gap <= LANDED) {
        bootReleased = true;
        const layer = keyLayers[bootHold];
        if (layer) {
          layer.style.transition = `opacity ${BOOT_KEY_OUT_MS}ms ease-out`;
          layer.style.opacity = "0";
          keyShown[bootHold] = 0;
        }
      }
    };

    const schedule = () => {
      if (!raf && !cancelled) raf = requestAnimationFrame(draw);
    };

    const request = (s: Segment, k: number) => {
      const img = new Image();
      img.decoding = "async";
      // CORS mode (the CDN sends `Access-Control-Allow-Origin: *`; same-origin is unaffected), so the
      // canvas stays readable (getImageData) with frames from CloudFront.
      img.crossOrigin = "anonymous";
      img.src = frameUrl(s.reg.film, s.width, k);
      s.status[k] = 1;
      // Frees this request's slot once. Called when decode() settles AND wherever the request is
      // cancelled (evict, dispose, teardown): in Chromium a decode() whose src was cleared mid-flight
      // never settles, so relying on it alone would leak the slot and eventually wedge the loader.
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        inflight--;
        pump();
      };
      s.pending.set(k, { img, release });
      inflight++;
      img
        .decode()
        .then(() => {
          if (cancelled || s.pending.get(k)?.img !== img) return; // evicted or torn down meanwhile
          s.frames[k] = img;
          s.status[k] = 2;
          s.reg.el.dataset.loaded = String(++s.loaded);
          if (s.reg.index === 0 && !connection) timeHeroFrame(img.src);
          if (s.reg.index === targetSeg) schedule();
        })
        .catch(() => {}) // a missing frame is covered by its neighbours
        .finally(() => {
          if (s.pending.get(k)?.img === img) s.pending.delete(k);
          release();
        });
    };

    // The active segment first, then its neighbours. Segments further away only fetch the two
    // frames that are always kept (0, M and last). Before the visitor engages, only the active segment's
    // skeleton and the next segment's 0, M and last (ENGAGE_STRIDE); engage() re-ranks for the rest.
    const nextJob = (): [Segment, number] | null => {
      const ranked = [...segments.values()].sort(
        (a, b) => Math.abs(a.reg.index - active) - Math.abs(b.reg.index - active),
      );
      for (const s of ranked) {
        if (!s.near) continue;
        const ahead = s.reg.index - active;
        if (!engaged && ahead !== 0 && ahead !== 1) continue;
        const far = Math.abs(ahead) > 1;
        const last = s.reg.film.count - 1;
        const end = moveEnd(s);
        while (s.cursor < s.order.length) {
          const k = s.order[s.cursor];
          const kept = k === 0 || k === end || k === last;
          const idleSkip = !engaged && !kept && (ahead !== 0 || k % ENGAGE_STRIDE !== 0);
          if (s.status[k] !== 0 || (far && !kept) || idleSkip) {
            s.cursor++;
            continue;
          }
          s.cursor++;
          return [s, k];
        }
      }
      return null;
    };

    // The visitor has engaged: lift the idle gate and rank every segment again (the gate skipped frames).
    const engage = () => {
      if (engaged) return;
      engaged = true;
      for (const t of segments.values()) rank(t, entryFrame(t));
      pump();
    };

    // No navigator.connection (Safari): time the first TIMED_FRAMES hero frames from resource timing. A slow
    // median moves the segments not yet started to the smallest tier at the next segment boundary (retier),
    // never mid-segment, so a segment's own frames, and its joins, stay one tier.
    const timeHeroFrame = (url: string) => {
      if (slow || heroTimes.length >= TIMED_FRAMES) return;
      const entry = performance.getEntriesByName(url).at(-1);
      if (!entry || !(entry.duration > 0)) return;
      heroTimes.push(entry.duration);
      if (heroTimes.length < TIMED_FRAMES) return;
      const sorted = [...heroTimes].sort((a, b) => a - b);
      const mid = sorted.length / 2;
      if ((sorted[mid - 1] + sorted[mid]) / 2 > SLOW_FRAME_MS) {
        slow = true;
        maxInflight = SLOW_INFLIGHT;
      }
    };
    const retier = (after: number) => {
      const released: (() => void)[] = [];
      for (const t of segments.values()) {
        if (t.reg.index <= after) continue;
        const width = tier(t.reg.film);
        if (width === t.width) continue;
        for (const req of t.pending.values()) {
          req.img.src = "";
          released.push(req.release);
        }
        t.pending.clear();
        t.frames = new Array(t.reg.film.count);
        t.status = new Uint8Array(t.reg.film.count);
        t.loaded = 0;
        t.width = width;
        t.reg.el.dataset.loaded = "0";
      }
      for (const release of released) release();
    };

    function pump() {
      while (!cancelled && inflight < maxInflight) {
        const job = nextJob();
        if (!job) return;
        request(job[0], job[1]);
      }
    }

    // Segments more than one index from the active one release their decoded frames except 0, M and
    // last (CDN frames are immutable, so coming back is a cache hit).
    const evict = () => {
      for (const s of segments.values()) {
        if (Math.abs(s.reg.index - active) <= 1) continue;
        const last = s.reg.film.count - 1;
        const end = moveEnd(s);
        let changed = false;
        for (const [k, req] of s.pending) {
          if (k === 0 || k === end || k === last) continue;
          s.pending.delete(k);
          s.status[k] = 0;
          req.img.src = "";
          req.release();
          changed = true;
        }
        for (let k = 1; k < last; k++) {
          if (!s.frames[k] || k === end) continue;
          s.frames[k] = undefined;
          s.status[k] = 0;
          s.loaded--;
          changed = true;
        }
        if (changed) s.reg.el.dataset.loaded = String(s.loaded);
      }
    };

    // Size and place a key layer's background exactly where draw() would paint a frame of its aspect.
    const layoutKey = (i: number) => {
      const layer = keyLayers[i];
      const aspect = keyAspect[i];
      if (!layer || !aspect) return;
      const r = coverRect(canvas.clientWidth, canvas.clientHeight, aspect, REEL_FOCUS);
      layer.style.backgroundSize = `${r.width}px ${r.height}px`;
      layer.style.backgroundPosition = `${r.left}px ${r.top}px`;
    };

    const loadKey = (i: number) => {
      const layer = keyLayers[i];
      // The boot layer keeps a saved tail frame only where the tail plays on this load too.
      const src = i === bootHold && bootSrc && !reduced && !saveData ? bootSrc : keySrc[i];
      if (!layer || !src || keyRequested[i]) return;
      keyRequested[i] = true;
      // No crossOrigin: the key is only ever a CSS background (never drawn to the canvas), and a CORS
      // decode cannot share the cache entry with the background fetch, so the flag would cost a second request.
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      const done = () => {
        if (cancelled) return;
        keyAspect[i] = img.naturalWidth / img.naturalHeight;
        layoutKey(i);
        layer.style.backgroundImage = `url("${src}")`;
        keyReady[i] = true;
        // The layer now carries the key itself. Two frames later, so the boot style's hold on a hash
        // target's read-pin items (app/page.tsx) outlasts the reveals' first clocked values.
        if (i === bootHold) requestAnimationFrame(() => requestAnimationFrame(() => boot?.remove()));
        schedule();
      };
      img.decode().then(done, () => {
        if (i === bootHold) boot?.remove();
      });
    };

    // A key loads once the segment it ends, or the one it hands over to, is near; with tail frames on
    // only the boot key ever loads (the tail itself is the hold).
    const loadKeys = () => {
      keyLayers.forEach((layer, i) => {
        if (!layer || (tailsOn(i) && i !== bootHold)) return;
        if (segments.get(i)?.near || segments.get(i + 1)?.near) loadKey(i);
      });
    };

    // Legacy key fades on the legacy reel position r = seg + p (exactly i + 1 through hold i).
    const keyOpacity = (i: number, r: number) => {
      if (tailsOn(i)) return i === bootHold && !bootReleased ? 1 : 0;
      const own = segments.get(i);
      const next = segments.get(i + 1);
      const keyIn = own?.reg.keyIn;
      const into =
        keyIn !== undefined
          ? Math.min(0.5, Math.max(0.01, keyIn))
          : i === 0
            ? HERO_KEY_IN
            : own?.range
              ? Math.min(0.5, KEY_IN_PX / own.range)
              : HERO_KEY_IN;
      const dissolve = next?.reg.dissolveIn;
      const out =
        next && next.range > 0
          ? dissolve !== undefined
            ? Math.min(0.5, Math.max(0.01, dissolve))
            : Math.min(0.5, KEY_OUT_PX / next.range)
          : 0.04;
      const t = r - (i + 1);
      if (t <= -into || t >= out) return 0;
      if (t >= 0) return 1 - t / out;
      return keyIn !== undefined ? smootherstep(1 + t / into) : 1 + t / into;
    };

    // The stand-in breath on key i while segment i's tail plays without tail frames (see `breath`).
    const keyScale = (i: number, ph: Phase) => {
      const s = segments.get(i);
      const b = s?.reg.breath;
      if (!s || !b || reduced || ph.seg !== i || !(ph.tau > 0) || tailsOn(i)) return 1;
      const k = Math.sin(Math.PI * breathCurve(ph.tau, tauRead(s)));
      return 1 + b.scale * k * k;
    };

    // u: a segment's share of its clock unit at scroll y (px past its top), see the clock above.
    const uOf = (s: Segment, y: number) => {
      if (y <= 0) return 0;
      if (s.range > 0 && y < s.range) return (s.mu * y) / s.range;
      if (s.after <= 0) return 1;
      return clamp01(s.mu + ((1 - s.mu) * (y - s.range)) / s.after);
    };

    // Measures every segment (m, q, μ, read pin, adjacency) and returns the raw clock c.
    const measure = () => {
      const root = document.documentElement;
      const viewport = root.clientHeight;
      const svh = probeRef.current?.offsetHeight || viewport;
      const list = [...segments.values()].sort((a, b) => a.reg.index - b.reg.index);
      const rects = list.map((s) => s.reg.el.getBoundingClientRect());
      // Scroll left from the viewport's top to the end of the page, for the last segment's D.
      const toEnd = root.scrollHeight - viewport - window.scrollY;
      let c = 0;
      list.forEach((s, k) => {
        const rect = rects[k];
        const next = rects[k + 1];
        const move = Math.max(
          0,
          s.reg.moveVh !== undefined ? s.reg.moveVh * svh : rect.height - viewport,
        );
        const distance = next ? next.top - rect.top : toEnd - rect.top;
        s.range = move;
        s.after = Math.max(0, distance - move);
        s.mu = move + s.after > 0 ? move / (move + s.after) : 1;
        s.read = s.reg.readVh ? Math.min(s.after, s.reg.readVh * svh) : 0;
        s.reg.tauRead?.set(s.after > 0 ? s.read / s.after : 0);
        s.adjacent = !!next && Math.abs(next.top - rect.bottom) < 1;
        if (rect.top > 0) return; // not started
        c = Math.max(c, s.reg.index + uOf(s, -rect.top));
      });
      return c;
    };

    // The clock split into segment, move progress, tail fraction and the legacy reel position.
    type Phase = { seg: number; s: Segment | undefined; p: number; tau: number; legacy: number };
    const phaseOf = (c: number): Phase => {
      const seg = c <= 0 ? 0 : Math.min(n - 1, Math.floor(c));
      const s = segments.get(seg);
      const u = clamp01(c - seg);
      const mu = s ? s.mu : 1;
      const p = mu > 0 ? Math.min(1, u / mu) : 1;
      const tau = mu < 1 && u > mu ? clamp01((u - mu) / (1 - mu)) : 0;
      return { seg, s, p, tau, legacy: seg + p };
    };

    // The hold the viewer is in (legacy r exactly i + 1 there), kept for a reload: see app/page.tsx.
    const saveHold = (r: number) => {
      const hold = r >= 1 && Number.isInteger(r) ? String(r - 1) : "";
      if (hold === savedHold) return;
      savedHold = hold;
      try {
        sessionStorage.setItem(HOLD_STORAGE_KEY, hold);
      } catch {
        // storage unavailable: a reload simply starts without the boot key
      }
    };

    // On leaving (a reload, a navigation away): the held chapter's read-pin and tail reveals as they are on
    // screen, keyed by their window attribute, and the painted frame when it is a breathing-tail frame (the
    // hold key is the hold pose, one breath away from it), so a reload there boots both in that state
    // (app/page.tsx's boot style) and the clock and canvas take over with the same values: nothing steps.
    const saveBoot = () => {
      try {
        const hold = savedHold ? Number(savedHold) : -1;
        const s = hold >= 0 ? segments.get(hold) : undefined;
        if (!s) {
          sessionStorage.removeItem(HOLD_REVEALS_KEY);
          return;
        }
        const o: Record<string, number> = {};
        const chapter = s.reg.el.closest("[data-chapter]");
        for (const el of chapter?.querySelectorAll<HTMLElement>("[data-reveal][data-pin],[data-reveal][data-tail]") ?? []) {
          const attr = el.dataset.pin !== undefined ? `data-pin="${el.dataset.pin}"` : `data-tail="${el.dataset.tail}"`;
          o[attr] = Math.round(Number(getComputedStyle(el).opacity) * 1000) / 1000;
        }
        const tailFrame = drawnSeg === hold && tailCount(s) > 0 && drawnFrame > moveEnd(s);
        const f = tailFrame ? frameUrl(s.reg.film, s.width, drawnFrame) : undefined;
        // The held key's push (the tower's breath), as [scale, origin x px, origin y px].
        const layer = keyLayers[hold];
        const scale = layer?.style.transform.startsWith("scale(") ? parseFloat(layer.style.transform.slice(6)) : 1;
        const origin = layer?.style.transformOrigin.split(" ").map(parseFloat) ?? [];
        const k = scale !== 1 && origin.length === 2 ? [scale, ...origin] : undefined;
        sessionStorage.setItem(HOLD_REVEALS_KEY, JSON.stringify({ h: hold, w: window.innerWidth, o, f, k }));
      } catch {
        // storage unavailable: a reload boots the held chapter's pin items hidden on the hold key
      }
    };

    // The nav section at a raw position: the last segment (from `seg` back) whose activeFrom has passed.
    const sectionAt = (seg: number, frame: number) => {
      for (let i = seg; i >= 0; i--) {
        const reg = segments.get(i)?.reg;
        if (!reg || reg.section === undefined) continue;
        if (i === seg && frame < (reg.activeFrom ?? 0)) continue;
        return reg.section;
      }
      return "";
    };

    // Chrome from the raw clock (DOM to DOM, no spring lag): see the component doc.
    const publishChrome = (ph: Phase) => {
      const s = ph.s;
      let chrome: ReelChrome = "body";
      let section = "";
      if (s) {
        if (ph.p < 1) chrome = "film";
        // `<=`: the last chapter's pin runs to the page's end, where it is still the composition.
        else if (s.reg.readVh !== undefined) chrome = ph.tau * s.after <= s.read + 0.5 ? "composed" : "body";
        else chrome = s.adjacent ? "film" : "body";
        section = sectionAt(ph.seg, ph.p * moveEnd(s));
      }
      const key = `${chrome}|${section}`;
      if (key === chromeKey) return;
      chromeKey = key;
      const root = document.documentElement;
      root.dataset.reelChrome = chrome;
      root.dataset.reelSection = section;
      window.dispatchEvent(new CustomEvent(REEL_CHROME_EVENT, { detail: { chrome, section } }));
    };

    const update = () => {
      if (!segments.size) return;
      if (!engaged && window.scrollY !== 0) engage();
      const c = measure();
      const leap = Math.abs(c - spring.get());
      steer(c - scrolled.get());
      scrolled.set(c);
      const raw = phaseOf(c);
      saveHold(raw.legacy);
      publishChrome(raw);
      // Land instead of scrubbing on the first measure, until just after load (the browser restores
      // scroll or jumps to a #fragment then), and on a leap of more than a segment in one event.
      if (!measured || performance.now() < settleUntil || leap > 1) spring.jump(c);
      measured = true;
    };

    // The clock the page shows follows the spring but never passes the raw clock and never steps against
    // the raw clock's direction of travel (rawDir; once the raw clock has been still for QUIET_MS, toward it
    // from either side). A spring carrying velocity into a stop (a wheel step, a touch fling ending) would
    // otherwise overshoot and slide back by a film frame or two. On a reversal the spring's momentum points
    // the old way: steer() re-seeds it at the shown clock, at rest, so the picture turns at once (holding
    // while the raw clock is still on the old side of it). A jump (spring.jump on a leap, the hash boot)
    // lands at once.
    let shownClock = Number.NaN;
    let rawDir = 0;
    let lastDir = 0;
    let quietTimer = 0;
    let seenY = Number.NaN;
    const steer = (delta: number) => {
      if (reduced || Math.abs(delta) < 1e-6) return;
      const dir = Math.sign(delta);
      if (lastDir && dir !== lastDir && Number.isFinite(shownClock)) spring.jump(shownClock);
      rawDir = lastDir = dir;
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => {
        rawDir = 0;
        // Held against a reversal while the spring ran on: carry on from the picture to the raw clock.
        if (Number.isFinite(shownClock) && Math.abs(spring.get() - shownClock) > 1e-6) {
          spring.jump(shownClock);
          spring.set(scrolled.get());
        }
      }, QUIET_MS);
    };
    const follow = (c: number) => {
      const raw = scrolled.get();
      // The viewer's input reaches the scroll handler a frame late: take its direction straight from scrollY,
      // so the tick in between already holds instead of running on the old way.
      const sy = window.scrollY;
      if (Number.isFinite(seenY) && Math.abs(sy - seenY) >= 0.5) rawDir = Math.sign(sy - seenY);
      seenY = sy;
      if (!Number.isFinite(shownClock) || reduced) return (shownClock = c);
      const dir = rawDir || (raw >= shownClock ? 1 : -1);
      shownClock =
        dir > 0 ? Math.max(shownClock, Math.min(c, raw)) : Math.min(shownClock, Math.max(c, raw));
      return shownClock;
    };

    const onReel = (spr: number) => {
      const c = follow(spr);
      const ph = phaseOf(c);
      const s = ph.s;
      clockAt = c;
      reelAt = ph.legacy;
      tailAt = ph.tau;
      targetSeg = ph.seg;
      if ((targetSeg === 0) !== atHero.current) {
        atHero.current = targetSeg === 0;
        for (const notify of listeners) notify();
      }
      // The smoothed frame as a float for the overlays; the painted target rounded.
      let frame = 0;
      if (s) {
        const end = moveEnd(s);
        const tail = tailCount(s);
        if (ph.tau > 0 && tail > 0) {
          frame = end + breathCurve(ph.tau, tauRead(s)) * tail;
          targetFrame = Math.round(frame);
        } else {
          targetFrame = toIndex(s, ph.p);
          frame = reduced ? targetFrame : ph.p * end;
        }
      } else {
        targetFrame = 0;
      }
      for (const t of segments.values()) {
        const i = t.reg.index;
        if (i < ph.seg) {
          t.reg.progress.set(1);
          t.reg.frame?.set(moveEnd(t) + tailCount(t));
          t.reg.tau?.set(1);
        } else if (i > ph.seg) {
          t.reg.progress.set(0);
          t.reg.frame?.set(0);
          t.reg.tau?.set(0);
        } else {
          t.reg.progress.set(ph.p);
          t.reg.frame?.set(frame);
          t.reg.tau?.set(ph.tau);
        }
      }
      keyLayers.forEach((layer, i) => {
        if (!layer) return;
        const scale = keyScale(i, ph);
        const transform = scale === 1 ? "" : `scale(${scale.toFixed(5)})`;
        if (layer.style.transform !== transform) {
          if (transform) {
            const b = segments.get(i)?.reg.breath;
            const r = coverRect(canvas.clientWidth, canvas.clientHeight, keyAspect[i] || 16 / 9, REEL_FOCUS);
            if (b) {
              layer.style.transformOrigin = `${r.left + r.width * b.origin[0]}px ${r.top + r.height * b.origin[1]}px`;
            }
          }
          layer.style.transform = transform;
        }
        const o = Math.round(keyOpacity(i, ph.legacy) * 1000) / 1000;
        if (keyShown[i] === o) return;
        keyShown[i] = o;
        layer.style.opacity = String(o);
      });
      if (ph.seg !== active) {
        active = ph.seg;
        if (slow) retier(active + 1);
        evict();
        for (const t of segments.values()) rank(t, entryFrame(t));
        pump();
      } else if (s && Math.abs(targetFrame - s.rankedAt) > 4 * tolerance(s)) {
        rank(s, targetFrame); // the target leapt: bring the frames around it forward
        pump();
      }
      // Paint in this tick (the spring's frame), not the next one: the picture never trails the clock by a frame.
      if (raf) cancelAnimationFrame(raf);
      draw();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = byEl.get(e.target);
          if (s) s.near = e.isIntersecting;
        }
        loadKeys();
        pump();
      },
      { rootMargin: NEAR },
    );

    const dispose = (s: Segment) => {
      io.unobserve(s.reg.el);
      byEl.delete(s.reg.el);
      const cancelledReqs = [...s.pending.values()];
      s.pending.clear();
      segments.delete(s.reg.index);
      for (const req of cancelledReqs) {
        req.img.src = "";
        req.release();
      }
    };

    // Reconcile with the registry (mount, a late segment, StrictMode's re-registration).
    const sync = () => {
      for (const s of [...segments.values()]) {
        const reg = registered.get(s.reg.index);
        if (
          !reg ||
          reg.el !== s.reg.el ||
          reg.film !== s.reg.film ||
          reg.reducedSteps !== s.reg.reducedSteps ||
          reg.tail?.from !== s.reg.tail?.from ||
          reg.tail?.frames !== s.reg.tail?.frames
        ) {
          dispose(s);
        } else {
          s.reg = reg;
        }
      }
      for (const reg of registered.values()) {
        if (segments.has(reg.index)) continue;
        const count = reg.film.count;
        const s: Segment = {
          reg,
          width: tier(reg.film),
          range: 0,
          after: 0,
          mu: 1,
          read: 0,
          adjacent: false,
          order: [],
          cursor: 0,
          rankedAt: 0,
          inOrder: new Uint8Array(count),
          status: new Uint8Array(count),
          frames: new Array(count),
          pending: new Map(),
          loaded: 0,
          near: false,
        };
        segments.set(reg.index, s);
        byEl.set(reg.el, s);
        io.observe(reg.el);
      }
      update();
      active = -1; // re-rank every segment around the (new) target
      onReel(position.get());
    };

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; // clears the bitmap…
        canvas.height = h;
        drawnSeg = -1;
        drawnFrame = -1;
        drawnSegmentMV.set(-1);
        drawnFrameMV.set(-1);
        draw(); // …so repaint before the browser presents it
      }
      keyLayers.forEach((_, i) => layoutKey(i));
      update();
    };

    // The boot key is the first thing this page needs on a deep link: before any frame request.
    if (bootHold >= 0) loadKey(bootHold);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    // Layout changes above a segment (fonts, the Projects filter) move it without a scroll event.
    const layout = new ResizeObserver(() => update());
    layout.observe(document.body);

    const unsubscribe = position.on("change", onReel);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pagehide", saveBoot);
    resync.current = sync;
    sync();
    resize();

    return () => {
      cancelled = true;
      resync.current = null;
      const root = document.documentElement;
      delete root.dataset.reelChrome;
      delete root.dataset.reelSection;
      unsubscribe();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pagehide", saveBoot);
      window.removeEventListener("load", onLoad);
      window.clearTimeout(quietTimer);
      io.disconnect();
      ro.disconnect();
      layout.disconnect();
      if (raf) cancelAnimationFrame(raf);
      for (const s of segments.values()) {
        for (const req of s.pending.values()) {
          req.img.src = "";
          req.release(); // pump() is a no-op once cancelled
        }
        s.pending.clear();
      }
    };
  }, [api, reel, keys, reduced, scrolled, spring]);

  return (
    <FilmBackdropContext.Provider value={api}>
      {/* h-dvh: the dynamic viewport, so it never leaves a strip of flat base when a phone's toolbar
          collapses. Transparent until its first paint (see draw). */}
      <div ref={probeRef} aria-hidden className="pointer-events-none invisible fixed top-0 left-0 h-svh w-0" />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 h-dvh w-full opacity-0"
      />
      {/* Hold keys: fixed like the canvas (a still inside a segment's stage would scroll away with it
          and tear against the canvas), same cover crop and focus, painted just above it. Background
          layers rather than <img>, so the boot style in app/page.tsx can show one before hydration
          without touching React-rendered attributes. */}
      <div ref={keysRef} aria-hidden className="contents">
        {Array.from({ length: Math.max(keys.landscape.length, keys.portrait.length) }, (_, i) => {
          const src = keys.landscape[i];
          const portraitSrc = keys.portrait[i];
          // The CSS cover fit (bg-cover at REEL_OBJECT_POSITION) is the boot script's pre-JS geometry;
          // the backdrop then sets the same box in px from coverRect once the key has decoded.
          return src || portraitSrc ? (
            <div
              key={`${i}:${src}:${portraitSrc}`}
              data-key={i}
              data-src={src}
              data-src-portrait={portraitSrc !== src ? portraitSrc : undefined}
              className="pointer-events-none fixed inset-0 -z-10 h-dvh w-full bg-cover bg-no-repeat opacity-0"
              style={{ backgroundPosition: REEL_OBJECT_POSITION }}
            />
          ) : null;
        })}
      </div>
      {children}
    </FilmBackdropContext.Provider>
  );
}

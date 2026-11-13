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
import {
  aimAt,
  countDraw,
  filmInstrument,
  loaderStatsFor,
  noteStaleStart,
  newEffectiveTarget,
  onTarget,
  recoverStale,
  tickStale,
} from "@/components/film/filmStats";
import { FilmHud } from "@/components/film/FilmHud";
import { backingSize, growCap, MAX_DPR, wantsFullBacking } from "@/components/film/backing";
import { createLegacyLoader } from "@/components/film/loader/legacy";
import { createBudgetLoader } from "@/components/film/loader/budget";
import { withLegacyFallback } from "@/components/film/loader/fallback";
import { budgetOverrideBytes } from "@/components/film/loader/budget-bytes";
import { readConnection, saveDataOn } from "@/components/film/loader/network";
import { loaderFromQuery, packsFromQuery, pageCaps, runnableLoader, type LoaderName } from "@/components/film/loader/select";
import type { FrameLoader, LoaderEnv, WantPlan } from "@/components/film/loader/types";

/**
 * The frame loader a page load runs unless `?loader=legacy|budget|budget-main` names another (components/film/loader/
 * select.ts). "budget": the budget loader, decoding in the film worker; it falls back to main-thread decodes on its own,
 * and to the legacy loader if those cannot decode the frames either (loader/fallback.ts); the page runs the legacy
 * loader from the start where it lacks fetch, Blob or createImageBitmap.
 */
const DEFAULT_LOADER: LoaderName = "budget";

/**
 * One crop point for the whole reel (x, y in 0–1): segments share boundary frames, so a per-film focus
 * would make the shared frame jump on wide viewports. The key layers and the poster use the same point.
 */
export const REEL_FOCUS: readonly [number, number] = [0.5, 0.45];
/** `object-position` / `background-position` matching REEL_FOCUS, for layers that must line up with the canvas. */
export const REEL_OBJECT_POSITION = `${REEL_FOCUS[0] * 100}% ${REEL_FOCUS[1] * 100}%`;

// Critically damped: smooths wheel steps without a slow tail.
const SPRING = { stiffness: 140, damping: 24, mass: 1, restDelta: 0.0005 } as const;
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

// The clock's view of a joined segment. Its frames (tier width, requests, decoded frames) are the loader's.
type Segment = {
  reg: SegmentRegistration;
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
 * Frames: this component owns the clock, the draw call, the hold keys, the chrome and the registration; which
 * frames exist in memory is the frame loader's (components/film/loader: the FrameLoader interface in types.ts,
 * the budget loader in budget.ts, the legacy loader in legacy.ts). It is picked in one place in the effect
 * (DEFAULT_LOADER, or `?loader=`).
 * Each segment joins it with the tier tier() picks from the canvas box (`data-width`, the backing cap and the
 * counters read the loader's width); every clock tick hands it what the clock wants (want: the active segment,
 * its target frame, the direction of travel, where the neighbours are entered); draw() paints `loader.nearest`
 * and waits while `loader.isComing` a nearer frame. The loader reports to `window.__filmStats` through a narrow
 * stats hook (filmStats `loaderStatsFor`), to `data-loaded` and to the backing cap (a retier's `onWidth`) through
 * callbacks, hears page visibility and online/offline, and knows nothing else of the page.
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
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // ?backing=full: the old canvas size rule for this page load (round(CSS size x dpr), no width cap), for an A/B on
    // a real phone. Read once here, never during render.
    const fullBacking = wantsFullBacking(window.location.search);
    const connection = readConnection(navigator);
    const saveData = saveDataOn(connection);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const n = reel.length;
    const portrait = pickFilmOrientation() === "portrait";
    const { drawnSegment: drawnSegmentMV, drawnFrame: drawnFrameMV } = api;
    // Measurement only (components/film/filmStats.ts, `window.__filmStats`): nothing below reads it back.
    const instrument = filmInstrument();
    const { stats, clock: staleClock } = instrument;
    // What the counters score against: the frames the canvas can show for the current target (filmStats aimAt,
    // with the loader's own `usable` rule), refreshed with the target in onReel.
    const effective = newEffectiveTarget();

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

    // The frame loader (components/film/loader): which frames exist in memory. Picked here, once per page load
    // (DEFAULT_LOADER, or `?loader=`; `?budget=<MB>` forces the budget loader's decoded-frame budget, for the lab; `?pack=0`
    // turns film packs off, so every film loads one file per frame). Its counters reach `window.__filmStats` through the
    // one adapter in filmStats.ts.
    const search = window.location.search;
    const loaderName = runnableLoader(loaderFromQuery(search, DEFAULT_LOADER), pageCaps());
    const loaderEnv: LoaderEnv = {
      stats: loaderStatsFor(instrument),
      connection,
      // The idle gate opens at once when the page has already moved from the top (a hash jump, a restored position),
      // a boot key shows a hold, or under reduced motion. Save-Data visitors wait for the first scroll like everyone
      // else (they get the smallest tier, not more bytes at idle).
      engaged: reduced || bootHold >= 0 || window.scrollY !== 0,
      tier: (film) => tier(film),
      onLoaded: (index, loaded) => {
        const s = segments.get(index);
        if (s) s.reg.el.dataset.loaded = String(loaded);
      },
      // A retier changed a segment's width: the backing cap follows the widths in use. After the loader's call has
      // returned (a retier runs inside want(), in the middle of a tick), and without a measure.
      onWidth: () => {
        queueMicrotask(() => {
          if (!cancelled) sizeBacking();
        });
      },
    };
    // The budget loader hands the page to the legacy loader if it cannot decode the frames on the main thread either.
    const loader: FrameLoader =
      loaderName === "legacy"
        ? createLegacyLoader(loaderEnv)
        : withLegacyFallback(
            loaderEnv,
            (onUnusable) =>
              createBudgetLoader(loaderEnv, {
                mainThread: loaderName === "budget-main",
                budgetBytes: budgetOverrideBytes(search) ?? undefined,
                packs: packsFromQuery(search),
                onUnusable,
              }),
            createLegacyLoader,
          );
    stats.mode = loader.mode;
    let cancelled = false;
    let raf = 0;
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

    // Stills shown per segment under reduced motion: frames still(s, 0) = 0 … still(s, steps − 1) = M.
    const stillSteps = (s: Segment) => Math.max(2, s.reg.reducedSteps);
    const still = (s: Segment, k: number) => Math.round((k / (stillSteps(s) - 1)) * moveEnd(s));

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
    // portrait tier), Save-Data and a slow network (the loader's isSlow) take the smallest.
    const tier = (film: FilmManifest) => {
      const sorted = [...film.widths].sort((a, b) => a - b);
      const pixels = (w: number) => (w * w) / film.aspect;
      const pool = saveData || loader.isSlow()
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

    // What the clock wants, handed to the loader on every tick (one object, updated in place). `entry`: where the
    // scroll will enter a segment other than the active one, 0 ahead of it, and behind it its last frame (M without
    // tail frames).
    const plan: WantPlan = {
      active: -1,
      frame: 0,
      direction: 0,
      entry: (i) => {
        const s = segments.get(i);
        if (!s || i > plan.active) return 0;
        return tailCount(s) > 0 ? s.reg.film.count - 1 : moveEnd(s);
      },
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
      const held = loader.nearest(targetSeg, targetFrame);
      if (!held || (targetSeg === drawnSeg && held.frame === drawnFrame)) return;
      const i = held.frame;
      const gap = Math.abs(i - targetFrame);
      const poster = posterUp();
      const covered = poster || keyUp() || drawnSeg >= 0;
      // While something is on screen (the poster, a key, the previous frame), never paint a frame far
      // from the target: wait for a nearer one rather than flash an unrelated moment of the film.
      const tol = poster ? LANDED : tolerance(s);
      if (covered && gap > tol && loader.isComing(targetSeg, targetFrame, tol)) {
        stats.held++;
        return;
      }
      const rect = coverRect(canvas.width, canvas.height, held.width / held.height, REEL_FOCUS);
      ctx.drawImage(held.image, rect.left, rect.top, rect.width, rect.height);
      drawnSeg = targetSeg;
      drawnFrame = i;
      countDraw(stats, i, effective);
      stats.paintedSeg = targetSeg;
      stats.paintedFilm = s.reg.film.name;
      stats.paintedFrame = i;
      const width = loader.width(targetSeg);
      stats.width = width;
      if (staleClock.since >= 0 && onTarget(effective, drawnSeg, i, targetSeg)) recoverStale(stats, staleClock, performance.now());
      // Overlays follow the painted frame (frame first: a listener on the segment then reads both).
      drawnFrameMV.set(i);
      drawnSegmentMV.set(targetSeg);
      canvas.dataset.segment = s.reg.film.name;
      canvas.dataset.frame = String(i);
      canvas.dataset.width = String(width);
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

    // A frame of the target segment has arrived: paint it at the next animation frame.
    loader.onArrive((index) => {
      if (index === targetSeg) schedule();
    });

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
      stats.measures++;
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
        const f = tailFrame ? frameUrl(s.reg.film, loader.width(hold), drawnFrame) : undefined;
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
      if (window.scrollY !== 0) loader.engage(); // the idle gate lifts once (idempotent)
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

    // The loader's `usable` for the target segment, for aimAt (one closure for the effect, not one per tick).
    const usableAtTarget = (i: number) => loader.usable(targetSeg, i);

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
      if (s) aimAt(effective, targetFrame, s.reg.film.count, usableAtTarget);
      else effective.lo = effective.hi = targetFrame;
      stats.targetSeg = targetSeg;
      stats.targetFrame = targetFrame;
      stats.effectiveFrame = effective.lo;
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
      plan.active = ph.seg;
      plan.frame = targetFrame;
      plan.direction = rawDir;
      loader.want(plan);
      // Paint in this tick (the spring's frame), not the next one: the picture never trails the clock by a frame.
      if (raf) cancelAnimationFrame(raf);
      draw();
      const stale = !onTarget(effective, drawnSeg, drawnFrame, targetSeg);
      // Where a stale stretch begins and what the loader was waiting for (once per stretch; filmStats staleMax*).
      if (stale && staleClock.since < 0) {
        const why = loader.waitReason?.(targetSeg, effective.lo) ?? "";
        noteStaleStart(staleClock, targetSeg, s?.reg.film.name ?? "", targetFrame, drawnSeg === targetSeg ? drawnFrame : -1, why);
      }
      tickStale(stats, staleClock, stale, performance.now());
    };

    const io = new IntersectionObserver(
      (entries) => {
        const changes: [number, boolean][] = [];
        for (const e of entries) {
          const s = byEl.get(e.target);
          if (!s) continue;
          s.near = e.isIntersecting;
          changes.push([s.reg.index, s.near]);
        }
        loadKeys(); // the keys' requests go out before the frames'
        loader.setNear(changes);
      },
      { rootMargin: NEAR },
    );

    const dispose = (s: Segment) => {
      io.unobserve(s.reg.el);
      byEl.delete(s.reg.el);
      segments.delete(s.reg.index);
      loader.leave(s.reg.index);
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
        const s: Segment = { reg, range: 0, after: 0, mu: 1, read: 0, adjacent: false, near: false };
        segments.set(reg.index, s);
        byEl.set(reg.el, s);
        loader.join(reg.index, reg.film, tier(reg.film), {
          moveEnd: moveEnd(s),
          tailFrames: tailCount(s),
          evenTailOnly: coarse,
          reducedStills: reduced ? Array.from({ length: stillSteps(s) }, (_, k) => still(s, k)) : null,
          tolerance: tolerance(s),
        });
        io.observe(reg.el);
      }
      update();
      loader.rerank(); // re-rank every segment around the (new) target
      onReel(position.get());
      resize(); // a segment that joined with a wider tier than any before it may enlarge the canvas (once)
    };

    // The canvas backing store never needs to be wider than the widest frame tier this page load uses (components/film/
    // backing.ts): a 2880 px canvas painting 1920 px frames only costs fill. `backingCap` only grows, so a retier to
    // a smaller tier (slow network) never shrinks it; before any segment has joined, the widest width the reel
    // offers for this orientation stands in, so the first paint is never undersized. tier() works from the CSS box
    // and dpr, not from the backing store, so this cannot feed back into the tier choice.
    const reelMaxWidth = reel.reduce((m, e) => Math.max(m, ...manifestFor(e, pickFilmOrientation()).widths), 0);
    let backingCap = 0;
    // The canvas backing store from the CSS box and the widths in use; the key layers follow the box.
    const sizeBacking = () => {
      let w: number;
      let h: number;
      if (fullBacking) {
        w = Math.round(canvas.clientWidth * dpr);
        h = Math.round(canvas.clientHeight * dpr);
      } else {
        let inUse = 0;
        for (const t of segments.values()) inUse = Math.max(inUse, loader.width(t.reg.index));
        backingCap = growCap(backingCap, inUse, reelMaxWidth);
        ({ w, h } = backingSize(canvas.clientWidth, canvas.clientHeight, dpr, backingCap));
      }
      w = Math.max(1, w);
      h = Math.max(1, h);
      stats.backingW = w;
      stats.backingH = h;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; // clears the bitmap…
        canvas.height = h;
        drawnSeg = -1;
        drawnFrame = -1;
        stats.canvasResizes++;
        stats.paintedSeg = -1;
        stats.paintedFilm = "";
        stats.paintedFrame = -1;
        stats.width = 0;
        drawnSegmentMV.set(-1);
        drawnFrameMV.set(-1);
        draw(); // …so repaint before the browser presents it
      }
      keyLayers.forEach((_, i) => layoutKey(i));
    };
    const resize = () => {
      sizeBacking();
      update();
    };

    // The loader may pause while the page is hidden and retry failed fetches when the network returns.
    const onVisibility = () => loader.visibility(document.visibilityState === "hidden");
    const onOnline = () => loader.network(true);
    const onOffline = () => loader.network(false);
    if (document.visibilityState === "hidden") loader.visibility(true);
    if (navigator.onLine === false) loader.network(false);

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
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    resync.current = sync;
    sync(); // ends with resize(): the canvas is sized once at load, after the segments have joined

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
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearTimeout(quietTimer);
      io.disconnect();
      ro.disconnect();
      layout.disconnect();
      if (raf) cancelAnimationFrame(raf);
      loader.dispose();
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
      {/* ?hud=1 only: the engine's counters (window.__filmStats). Renders nothing otherwise. */}
      <FilmHud />
    </FilmBackdropContext.Provider>
  );
}

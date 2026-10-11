"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { frameUrl, useReducedMotionSafe, type FilmManifest } from "@/components/film/filmCore";
import { HOLD_STORAGE_KEY } from "@/components/film/reel";

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
// 6 %) and out over the first KEY_OUT_PX of segment i+1, converted per segment to its scroll range.
const HERO_KEY_IN = 0.06;
const KEY_IN_PX = 160;
const KEY_OUT_PX = 120;
// A frame within this many of the target may lift the poster (and counts as "landed").
const LANDED = 8;
// The canvas fades in over this on its first paint when nothing covers it.
const FIRST_PAINT_MS = 250;
// After load, measures keep landing instead of scrubbing for this long (the browser restores scroll).
const SETTLE_MS = 500;

export type SegmentRegistration = {
  /** Position in the reel (the backdrop's `reel` order). */
  index: number;
  film: FilmManifest;
  /** The segment's tall <section>: its scroll position drives the reel. */
  el: HTMLElement;
  /** Stills shown per segment under prefers-reduced-motion. */
  reducedSteps: number;
  /** Set by the backdrop to clamp(r − index, 0, 1); the segment provides it to its overlays. */
  progress: MotionValue<number>;
};

type BackdropApi = {
  reel: readonly FilmManifest[];
  indexOf(film: FilmManifest): number;
  /** Called from a segment's effect; returns the unregister cleanup. */
  register(segment: SegmentRegistration): () => void;
  subscribeDrawn(onChange: () => void): () => void;
  /** True once the canvas has painted segment `index` within LANDED frames of its target (hides the hero's SSR poster). */
  hasDrawn(index: number): boolean;
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
  /** Scroll range in px (section height − viewport), refreshed on every measure. */
  range: number;
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
const NO_KEYS: readonly (string | undefined)[] = [];

/**
 * The homepage's single film canvas: `position: fixed` behind the whole page, painting whichever
 * segment the scroll is in, and holding the previous segment's last frame behind the HTML sections
 * between segments, so the page never cuts to flat base.
 *
 * Reel position `r`: per registered segment `p_i = clamp(−top_i / (h_i − viewport))`; `r` is the max
 * of `i + p_i` over the segments whose top has reached the viewport top (0 at the hero's start,
 * exactly `i + 1` during the hold after segment i), spring-smoothed (unsmoothed under reduced motion).
 * Painted: segment `ceil(r) − 1` (0 at r ≤ 0) at `frac = r − seg`, so a hold paints the last frame.
 *
 * Mount once, with no transformed/filtered ancestor (that would break `fixed`). Pass a stable reel.
 * Test hooks on the canvas: `data-segment` (film name), `data-frame`, `data-reel` (3 dp), `data-width`.
 */
export function FilmBackdrop({
  reel,
  keys = NO_KEYS,
  children,
}: {
  /** Ordered, resolveFilm()-ed manifests (components/film/reel.ts); index i is segment i. Stable. */
  reel: readonly FilmManifest[];
  /**
   * The approved still for the hold after each segment (`keys[i]` after segment i). Layered over the
   * canvas, fixed like it, from the end of segment i through the start of segment i+1, so a hold shows
   * the key itself and the join into the next segment is a crossfade. Stable.
   */
  keys?: readonly (string | undefined)[];
  children: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  // The registry: segments add themselves from their effects. A ref, never state, so registering
  // never re-renders the page.
  const registry = useRef(new Map<number, SegmentRegistration>());
  // Set while the backdrop runs, so a segment that registers late joins it.
  const resync = useRef<(() => void) | null>(null);
  const drawn = useRef(new Set<number>());
  const drawnListeners = useRef(new Set<() => void>());

  const [api] = useState<BackdropApi>(() => ({
    reel,
    indexOf: (film) => reel.findIndex((f) => f.name === film.name),
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
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const maxInflight = saveData ? 3 : 6;
    const [fx, fy] = REEL_FOCUS;
    const n = reel.length;

    // Hold-key layers (rendered below), indexed by segment. Each loads on approach (decoded first, then
    // set as the layer's background); `keyReady[i]` once it is on the layer.
    const keyLayers: (HTMLElement | undefined)[] = [];
    for (const el of keysRef.current?.querySelectorAll<HTMLElement>("[data-key]") ?? []) {
      keyLayers[Number(el.dataset.key)] = el;
    }
    const keyReady: boolean[] = [];
    const keyRequested: boolean[] = [];
    const keyShown: number[] = [];

    // The boot script in app/page.tsx may already show one key (a cold deep link into a hold).
    const boot = document.getElementById("reel-hold-boot");
    const bootHold = boot ? Number(boot.dataset.hold) : -1;

    const segments = new Map<number, Segment>();
    const byEl = new Map<Element, Segment>();
    let cancelled = false;
    let raf = 0;
    let inflight = 0;
    let active = -1;
    let reelAt = 0;
    let targetSeg = 0;
    let targetFrame = 0;
    let drawnSeg = -1;
    let drawnFrame = -1;
    let painted = false;
    let measured = false;
    let settleUntil = document.readyState === "complete" ? performance.now() + SETTLE_MS : Infinity;
    let savedHold: string | null = null;

    const onLoad = () => {
      settleUntil = performance.now() + SETTLE_MS;
    };
    if (settleUntil === Infinity) window.addEventListener("load", onLoad, { once: true });

    const toIndex = (s: Segment, frac: number) => {
      const count = s.reg.film.count;
      const steps = Math.max(2, s.reg.reducedSteps);
      const q = reduced ? Math.round(frac * (steps - 1)) / (steps - 1) : frac;
      return Math.min(count - 1, Math.max(0, Math.round(q * (count - 1))));
    };

    // Frame width: enough for the viewport at (capped) device resolution; phones top out at 1280.
    const tier = (film: FilmManifest) => {
      const sorted = [...film.widths].sort((a, b) => a - b);
      const ceiling = saveData ? sorted[0] : coarse ? 1280 : Infinity;
      const pool = sorted.filter((w) => w <= ceiling);
      if (!pool.length) pool.push(sorted[0]);
      const span = Math.max(canvas.clientWidth, canvas.clientHeight * film.aspect);
      const need = span * Math.min(dpr, 1.5) * 0.75;
      return pool.find((w) => w >= need) ?? pool[pool.length - 1];
    };

    /** Widest gap tolerated between the painted frame and the target while something else is on screen. */
    const tolerance = (s: Segment) => Math.max(LANDED, Math.round(s.reg.film.count / 32));

    // Request order around `target`: the target itself, last and 0 (always resident), then each
    // coarse-to-fine pass nearest-first, so the frames that matter now arrive first.
    const rank = (s: Segment, target: number) => {
      const count = s.reg.film.count;
      const seen = new Uint8Array(count);
      const order: number[] = [];
      const push = (i: number) => {
        if (i >= 0 && i < count && !seen[i]) {
          seen[i] = 1;
          order.push(i);
        }
      };
      const nearest = (a: number, b: number) => Math.abs(a - target) - Math.abs(b - target);
      push(target);
      push(count - 1);
      push(0);
      if (reduced) {
        const steps = Math.max(2, s.reg.reducedSteps);
        const stills: number[] = [];
        for (let k = 0; k < steps; k++) stills.push(Math.round((k / (steps - 1)) * (count - 1)));
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
      s.reg.index === active ? targetFrame : s.reg.index > active ? 0 : s.reg.film.count - 1;

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

    // The hero's SSR poster is still up (it shows until segment 0 has landed near its target).
    const posterUp = () => targetSeg === 0 && !drawnSet.has(0);
    // A hold key fully covers the canvas.
    const keyUp = () => keyShown.some((o, i) => o >= 0.999 && keyReady[i]);

    // Cover-fit at the reel's focus point on the DPR-sized canvas.
    const draw = () => {
      raf = 0;
      canvas.dataset.reel = reelAt.toFixed(3);
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
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (canvas.width - w) * fx, (canvas.height - h) * fy, w, h);
      drawnSeg = targetSeg;
      drawnFrame = i;
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
    };

    const schedule = () => {
      if (!raf && !cancelled) raf = requestAnimationFrame(draw);
    };

    const request = (s: Segment, k: number) => {
      const img = new Image();
      img.decoding = "async";
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
          if (s.reg.index === targetSeg) schedule();
        })
        .catch(() => {}) // a missing frame is covered by its neighbours
        .finally(() => {
          if (s.pending.get(k)?.img === img) s.pending.delete(k);
          release();
        });
    };

    // The active segment first, then its neighbours. Segments further away only fetch the two
    // frames that are always kept (0 and last).
    const nextJob = (): [Segment, number] | null => {
      const ranked = [...segments.values()].sort(
        (a, b) => Math.abs(a.reg.index - active) - Math.abs(b.reg.index - active),
      );
      for (const s of ranked) {
        if (!s.near) continue;
        const far = Math.abs(s.reg.index - active) > 1;
        const last = s.reg.film.count - 1;
        while (s.cursor < s.order.length) {
          const k = s.order[s.cursor];
          if (s.status[k] !== 0 || (far && k !== 0 && k !== last)) {
            s.cursor++;
            continue;
          }
          s.cursor++;
          return [s, k];
        }
      }
      return null;
    };

    function pump() {
      while (!cancelled && inflight < maxInflight) {
        const job = nextJob();
        if (!job) return;
        request(job[0], job[1]);
      }
    }

    // Segments more than one index from the active one release their decoded frames except 0 and
    // last (CDN frames are immutable, so coming back is a cache hit).
    const evict = () => {
      for (const s of segments.values()) {
        if (Math.abs(s.reg.index - active) <= 1) continue;
        const last = s.reg.film.count - 1;
        let changed = false;
        for (const [k, req] of s.pending) {
          if (k === 0 || k === last) continue;
          s.pending.delete(k);
          s.status[k] = 0;
          req.img.src = "";
          req.release();
          changed = true;
        }
        for (let k = 1; k < last; k++) {
          if (!s.frames[k]) continue;
          s.frames[k] = undefined;
          s.status[k] = 0;
          s.loaded--;
          changed = true;
        }
        if (changed) s.reg.el.dataset.loaded = String(s.loaded);
      }
    };

    const loadKey = (i: number) => {
      const layer = keyLayers[i];
      const src = layer?.dataset.src;
      if (!layer || !src || keyRequested[i]) return;
      keyRequested[i] = true;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      const done = () => {
        if (cancelled) return;
        layer.style.backgroundImage = `url("${src}")`;
        keyReady[i] = true;
        if (i === bootHold) boot?.remove(); // the layer now carries the key itself
        schedule();
      };
      img.decode().then(done, () => {
        if (i === bootHold) boot?.remove();
      });
    };

    // A key loads once the segment it ends, or the one it hands over to, is near.
    const loadKeys = () => {
      keyLayers.forEach((layer, i) => {
        if (layer && (segments.get(i)?.near || segments.get(i + 1)?.near)) loadKey(i);
      });
    };

    const keyOpacity = (i: number, r: number) => {
      const own = segments.get(i);
      const next = segments.get(i + 1);
      const into = i === 0 ? HERO_KEY_IN : own?.range ? Math.min(0.5, KEY_IN_PX / own.range) : HERO_KEY_IN;
      const out = next?.range ? Math.min(0.5, KEY_OUT_PX / next.range) : 0.04;
      const t = r - (i + 1);
      if (t <= -into || t >= out) return 0;
      return t < 0 ? 1 + t / into : 1 - t / out;
    };

    const measure = () => {
      const viewport = document.documentElement.clientHeight;
      let r = 0;
      for (const s of segments.values()) {
        const { top, height } = s.reg.el.getBoundingClientRect();
        s.range = height - viewport;
        if (top > 0) continue; // not started
        r = Math.max(r, s.reg.index + (s.range > 0 ? clamp01(-top / s.range) : 1));
      }
      return r;
    };

    // The hold the viewer is in (exactly i + 1 there), kept for a reload: see app/page.tsx.
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

    const update = () => {
      if (!segments.size) return;
      const r = measure();
      const leap = Math.abs(r - spring.get());
      scrolled.set(r);
      saveHold(r);
      // Land instead of scrubbing on the first measure, until just after load (the browser restores
      // scroll or jumps to a #fragment then), and on a leap of more than a segment in one event.
      if (!measured || performance.now() < settleUntil || leap > 1) spring.jump(r);
      measured = true;
    };

    const onReel = (r: number) => {
      reelAt = r;
      const seg = r <= 0 ? 0 : Math.min(n - 1, Math.ceil(r) - 1);
      const s = segments.get(seg);
      targetSeg = seg;
      targetFrame = s ? toIndex(s, clamp01(r - seg)) : 0;
      for (const t of segments.values()) t.reg.progress.set(clamp01(r - t.reg.index));
      keyLayers.forEach((layer, i) => {
        if (!layer) return;
        const o = Math.round(keyOpacity(i, r) * 1000) / 1000;
        if (keyShown[i] === o) return;
        keyShown[i] = o;
        layer.style.opacity = String(o);
      });
      if (seg !== active) {
        active = seg;
        evict();
        for (const t of segments.values()) rank(t, entryFrame(t));
        pump();
      } else if (s && Math.abs(targetFrame - s.rankedAt) > 4 * tolerance(s)) {
        rank(s, targetFrame); // the target leapt: bring the frames around it forward
        pump();
      }
      schedule();
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
        if (!reg || reg.el !== s.reg.el || reg.film !== s.reg.film || reg.reducedSteps !== s.reg.reducedSteps) {
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
        draw(); // …so repaint before the browser presents it
      }
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
    resync.current = sync;
    sync();
    resize();

    return () => {
      cancelled = true;
      resync.current = null;
      unsubscribe();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("load", onLoad);
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
  }, [reel, keys, reduced, scrolled, spring]);

  return (
    <FilmBackdropContext.Provider value={api}>
      {/* h-dvh: the dynamic viewport, so it never leaves a strip of flat base when a phone's toolbar
          collapses. Transparent until its first paint (see draw). */}
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
        {keys.map((src, i) =>
          src ? (
            <div
              key={`${i}:${src}`}
              data-key={i}
              data-src={src}
              className="pointer-events-none fixed inset-0 -z-10 h-dvh w-full bg-cover bg-no-repeat opacity-0"
              style={{ backgroundPosition: REEL_OBJECT_POSITION }}
            />
          ) : null,
        )}
      </div>
      {children}
    </FilmBackdropContext.Provider>
  );
}

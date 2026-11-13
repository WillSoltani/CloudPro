import type { FilmManifest } from "../filmCore";
import { frameUrl } from "../filmBase";
import { frameBytes } from "../filmStats";
import type { FrameLoader, HeldFrame, ImageLike, JoinOptions, LoaderEnv, WantPlan } from "./types";

/**
 * The legacy frame loader: the loader FilmBackdrop has always had, moved behind the FrameLoader seam (./types.ts) with
 * its logic unchanged. One request and one main-thread decode per frame, at most 6 in flight (3 on a slow network),
 * requested coarse-to-fine nearest-first around the target; segments more than one away from the active one keep only
 * frames 0, M and last; nothing limits how many decoded frames the active segment and its neighbours hold.
 */

// Coarse-to-fine: every 16th frame first, so a segment scrubs long before it has fully loaded.
const STRIDES = [16, 8, 4, 2, 1];
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

type Segment = {
  index: number;
  film: FilmManifest;
  /** Frame width tier, fixed when the segment joins (a slow-network retier may lower it before the segment starts). */
  width: number;
  opts: JoinOptions;
  /** Request order: the target, M, last, 0, then strides 16/8/4/2/1 nearest-first (or the reduced stills). */
  order: number[];
  cursor: number;
  /** The frame `order` was ranked around. */
  rankedAt: number;
  /** Frames that appear in `order` (all of them, or the reduced-motion stills). */
  inOrder: Uint8Array;
  /** Per frame: 0 idle · 1 requested (a failed frame stays here: not retried) · 2 decoded. */
  status: Uint8Array;
  frames: (ImageLike | undefined)[];
  /** In-flight requests; `release` frees the request's loader slot exactly once (see request). */
  pending: Map<number, { img: ImageLike; release: () => void }>;
  loaded: number;
  /** Within reach of the viewport (FilmBackdrop's IntersectionObserver). */
  near: boolean;
};

export function createLegacyLoader(env: LoaderEnv): FrameLoader {
  const stats = env.stats;
  const connection = env.connection;
  const ImageCtor: new () => ImageLike = env.Image ?? (Image as unknown as new () => ImageLike);
  const timing = env.timing ?? performance;
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
  let maxInflight = saveData || slow ? SLOW_INFLIGHT : 6;

  const segments = new Map<number, Segment>();
  const arrive = new Set<(index: number, frame: number) => void>();
  let cancelled = false;
  let inflight = 0;
  // The segment the clock is in (−1: none yet, or rerank() asked for a fresh plan), its target frame, and where the
  // scroll enters the others (null: no plan since rerank(); every segment is then entered at 0).
  let active = -1;
  let frame = 0;
  let entry: ((index: number) => number) | null = null;
  // The idle gate (ENGAGE_STRIDE): open once the page has moved from the top (a scroll, a hash jump, a
  // restored position) or a boot key shows a hold. Never applied under reduced motion or Save-Data.
  let engaged = env.engaged;
  // Hero frame timings (ms), when there is no navigator.connection to ask.
  const heroTimes: number[] = [];

  // Estimated decoded size of one of a segment's frames at its current tier.
  const bytesOf = (s: Segment) => frameBytes(s.width, s.film.aspect);
  // A segment lets go of every decoded frame it holds (retier, leave, dispose).
  const dropAll = (s: Segment) => {
    const bytes = bytesOf(s);
    for (let k = 0; k < s.frames.length; k++) if (s.frames[k]) stats.dropped(bytes);
  };

  // The frames this page load ever requests, so the only ones the canvas can show: the move (0…M); tail frames
  // (after M) only while tails play, and only the even ones on coarse pointers; under reduced motion only the
  // stills. rank() requests by it, and the counters score against it (filmStats aimAt), so a frame never loaded by
  // design is never counted as lag.
  const usable = (s: Segment, i: number) => {
    const end = s.opts.moveEnd;
    const stills = s.opts.reducedStills;
    if (stills) {
      for (const k of stills) if (k === i) return true;
      return false;
    }
    return i <= end || (s.opts.tailFrames > 0 && (!s.opts.evenTailOnly || (i - end) % 2 === 0));
  };

  // Request order around `target`: the target itself, M, last and 0 (always resident), then each
  // coarse-to-fine pass nearest-first, so the frames that matter now arrive first. Only usable frames.
  const rank = (s: Segment, target: number) => {
    const count = s.film.count;
    const end = s.opts.moveEnd;
    const seen = new Uint8Array(count);
    const order: number[] = [];
    const push = (i: number) => {
      if (i >= 0 && i < count && !seen[i] && usable(s, i)) {
        seen[i] = 1;
        order.push(i);
      }
    };
    const byDistance = (a: number, b: number) => Math.abs(a - target) - Math.abs(b - target);
    push(target);
    push(end);
    push(count - 1);
    push(0);
    if (s.opts.reducedStills) {
      [...s.opts.reducedStills].sort(byDistance).forEach(push);
    } else {
      for (const stride of STRIDES) {
        const pass: number[] = [];
        for (let i = 0; i < count; i += stride) pass.push(i);
        pass.sort(byDistance).forEach(push);
      }
    }
    s.order = order;
    s.inOrder = seen;
    s.cursor = 0;
    s.rankedAt = target;
  };

  // Where a segment's frames are wanted from: the target while active, else the end the scroll
  // will enter it from.
  const entryFrame = (s: Segment) => (s.index === active ? frame : entry ? entry(s.index) : 0);

  const nearestLoaded = (s: Segment, i: number) => {
    for (let d = 0; d < s.film.count; d++) {
      if (s.frames[i - d]) return i - d;
      if (s.frames[i + d]) return i + d;
    }
    return -1;
  };

  // A frame within `tol` of `i` may still arrive (queued or in flight), so it is worth waiting for.
  const nearerComing = (s: Segment, i: number, tol: number) => {
    const count = s.film.count;
    for (let k = Math.max(0, i - tol); k <= Math.min(count - 1, i + tol); k++) {
      if (s.pending.has(k) || (s.status[k] === 0 && s.inOrder[k])) return true;
    }
    return false;
  };

  const request = (s: Segment, k: number) => {
    const img = new ImageCtor();
    img.decoding = "async";
    // CORS mode (the CDN sends `Access-Control-Allow-Origin: *`; same-origin is unaffected), so the
    // canvas stays readable (getImageData) with frames from CloudFront.
    img.crossOrigin = "anonymous";
    img.src = frameUrl(s.film, s.width, k);
    s.status[k] = 1;
    // Frees this request's slot once. Called when decode() settles AND wherever the request is
    // cancelled (evict, leave, dispose): in Chromium a decode() whose src was cleared mid-flight
    // never settles, so relying on it alone would leak the slot and eventually wedge the loader.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inflight--;
      stats.released(inflight);
      pump();
    };
    s.pending.set(k, { img, release });
    inflight++;
    stats.requested(s.film.name, s.width, k, inflight);
    img
      .decode()
      .then(() => {
        if (cancelled || s.pending.get(k)?.img !== img) return; // evicted or torn down meanwhile
        s.frames[k] = img;
        s.status[k] = 2;
        stats.decoded(bytesOf(s));
        s.loaded++;
        env.onLoaded?.(s.index, s.loaded);
        if (s.index === 0 && !connection) timeHeroFrame(img.src);
        for (const cb of arrive) cb(s.index, k);
      })
      .catch(() => {
        // A missing frame is covered by its neighbours. Counted only for a live request (not one cancelled).
        if (!cancelled && s.pending.get(k)?.img === img && s.frames[k] !== img) stats.failed();
      })
      .finally(() => {
        if (s.pending.get(k)?.img === img) s.pending.delete(k);
        release();
      });
  };

  // The active segment first, then its neighbours. Segments further away only fetch the two
  // frames that are always kept (0, M and last). Before the visitor engages, only the active segment's
  // skeleton and the next segment's 0, M and last (ENGAGE_STRIDE); engage() re-ranks for the rest.
  const nextJob = (): [Segment, number] | null => {
    const ranked = [...segments.values()].sort((a, b) => Math.abs(a.index - active) - Math.abs(b.index - active));
    for (const s of ranked) {
      if (!s.near) continue;
      const ahead = s.index - active;
      if (!engaged && ahead !== 0 && ahead !== 1) continue;
      const far = Math.abs(ahead) > 1;
      const last = s.film.count - 1;
      const end = s.opts.moveEnd;
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

  // No navigator.connection (Safari): time the first TIMED_FRAMES hero frames from resource timing. A slow
  // median moves the segments not yet started to the smallest tier at the next segment boundary (retier),
  // never mid-segment, so a segment's own frames, and its joins, stay one tier.
  const timeHeroFrame = (url: string) => {
    if (slow || heroTimes.length >= TIMED_FRAMES) return;
    const timed = timing.getEntriesByName(url).at(-1);
    if (!timed || !(timed.duration > 0)) return;
    heroTimes.push(timed.duration);
    if (heroTimes.length < TIMED_FRAMES) return;
    const sorted = [...heroTimes].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    if ((sorted[mid - 1] + sorted[mid]) / 2 > SLOW_FRAME_MS) {
      slow = true;
      maxInflight = SLOW_INFLIGHT;
    }
  };
  // Every segment after `after` moves to the tier FilmBackdrop would pick now (env.tier); the cancelled requests free
  // their slots only once every segment has moved.
  const retier = (after: number) => {
    const released: (() => void)[] = [];
    for (const t of segments.values()) {
      if (t.index <= after) continue;
      const width = env.tier(t.film);
      if (width === t.width) continue;
      dropAll(t);
      for (const req of t.pending.values()) {
        req.img.src = "";
        released.push(req.release);
      }
      t.pending.clear();
      t.frames = new Array(t.film.count);
      t.status = new Uint8Array(t.film.count);
      t.loaded = 0;
      t.width = width;
      env.onLoaded?.(t.index, 0);
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
      if (Math.abs(s.index - active) <= 1) continue;
      const last = s.film.count - 1;
      const end = s.opts.moveEnd;
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
        stats.dropped(bytesOf(s));
        s.frames[k] = undefined;
        s.status[k] = 0;
        s.loaded--;
        changed = true;
      }
      if (changed) env.onLoaded?.(s.index, s.loaded);
    }
  };

  return {
    mode: "legacy",

    join(index, film, width, opts) {
      const count = film.count;
      segments.set(index, {
        index,
        film,
        width,
        opts,
        order: [],
        cursor: 0,
        rankedAt: 0,
        inOrder: new Uint8Array(count),
        status: new Uint8Array(count),
        frames: new Array(count),
        pending: new Map(),
        loaded: 0,
        near: false,
      });
    },

    leave(index) {
      const s = segments.get(index);
      if (!s) return;
      dropAll(s);
      const cancelledReqs = [...s.pending.values()];
      s.pending.clear();
      segments.delete(index);
      for (const req of cancelledReqs) {
        req.img.src = "";
        req.release();
      }
    },

    setNear(changes) {
      for (const [index, near] of changes) {
        const s = segments.get(index);
        if (s) s.near = near;
      }
      pump();
    },

    // The visitor has engaged: lift the idle gate and rank every segment again (the gate skipped frames).
    engage() {
      if (engaged) return;
      engaged = true;
      for (const t of segments.values()) rank(t, entryFrame(t));
      pump();
    },

    rerank() {
      active = -1;
      entry = null;
    },

    // `plan.direction` is not read: this loader ranks nearest-first around the target whichever way the visitor
    // travels (a loader that loads ahead in the direction of travel uses it).
    want(plan: WantPlan) {
      frame = plan.frame;
      entry = plan.entry;
      if (plan.active !== active) {
        active = plan.active;
        if (slow) retier(active + 1);
        evict();
        for (const t of segments.values()) rank(t, entryFrame(t));
        pump();
      } else {
        const s = segments.get(active);
        if (s && Math.abs(frame - s.rankedAt) > 4 * s.opts.tolerance) {
          rank(s, frame); // the target leapt: bring the frames around it forward
          pump();
        }
      }
    },

    nearest(index, at): HeldFrame | null {
      const s = segments.get(index);
      if (!s) return null;
      const i = nearestLoaded(s, at);
      if (i < 0) return null;
      const img = s.frames[i]!;
      // The browser's Image is an HTMLImageElement, a CanvasImageSource (ImageLike is the part this loader uses).
      return { frame: i, image: img as unknown as CanvasImageSource, width: img.naturalWidth, height: img.naturalHeight };
    },

    isComing(index, at, tolerance) {
      const s = segments.get(index);
      return !!s && nearerComing(s, at, tolerance);
    },

    usable(index, i) {
      const s = segments.get(index);
      return !!s && usable(s, i);
    },

    loaded: (index) => segments.get(index)?.loaded ?? 0,
    width: (index) => segments.get(index)?.width ?? 0,

    onArrive(cb) {
      arrive.add(cb);
      return () => {
        arrive.delete(cb);
      };
    },

    isSlow: () => slow,

    dispose() {
      cancelled = true;
      for (const s of segments.values()) {
        dropAll(s);
        for (const req of s.pending.values()) {
          req.img.src = "";
          req.release(); // pump() is a no-op once cancelled
        }
        s.pending.clear();
      }
    },
  };
}

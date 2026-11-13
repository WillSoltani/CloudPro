import type { FilmManifest } from "../filmCore";
import { frameUrl } from "../filmBase";
import { pickFrameBudgetBytes, tierFrameBytes } from "./budget-bytes";
import { createBudgetPlanner, jobFrame, jobSeg, NONE } from "./budget-plan";
import { createFrameStore, type BitmapLike, type FetchLike } from "./frame-worker";
import type { FromWorker, ToWorker } from "./frame-worker-protocol";
import { connectionSlow, heroTimesSlow, maxInflightFor, saveDataOn, SLOW_INFLIGHT, TIMED_FRAMES } from "./network";
import type { FrameLoader, HeldFrame, LoaderEnv } from "./types";

/**
 * The budget frame loader (stage 4 of the film plan; design in docs/film-lab-gate.md, "The budget loader").
 *
 * Three stores per segment and tier: the frames' compressed bytes, fetched once and kept (capped in total, the films
 * farthest from the active one dropped first); decoded frames (ImageBitmaps) inside a byte budget for this device; and
 * the plan (./budget-plan.ts), rebuilt on each clock tick, that says which frames to fetch and which to decode. A frame
 * that leaves the decoded store keeps its bytes, so scrolling back costs a decode, never a request.
 *
 * Fetches and decodes run in the film worker (./frame-worker.js: fetch, keep the bytes, createImageBitmap, transfer the
 * bitmap). If the worker cannot start, lacks createImageBitmap or fails, the loader moves to the same frame store on the
 * main thread (createFrameStore from the same ./frame-worker.js) and its name becomes "budget-main"; decoded frames already held stay, bytes the worker
 * held are fetched again. FilmBackdrop picks the legacy loader where the page itself lacks fetch, Blob or
 * createImageBitmap (./select.ts).
 *
 * Every bitmap that leaves the store is close()d and reported (`stats.dropped`); one that arrives after its segment has
 * left or changed tier, or after dispose, is closed and never kept (each job carries the planner's segment epoch).
 * `loaded(index)` is the number of decoded frames held for the segment (FilmBackdrop's `data-loaded`).
 *
 * `nearest()` returns one HeldFrame object reused between calls: read it at once, never keep it.
 */

export type WorkerLike = {
  postMessage(m: ToWorker): void;
  terminate(): void;
  onmessage: ((ev: { data: FromWorker }) => void) | null;
  onerror: ((ev: { preventDefault?(): void }) => void) | null;
  onmessageerror: ((ev: unknown) => void) | null;
};

export type BudgetOptions = {
  /** Decoded-frame budget in bytes (the `?budget=` override, or a test's figure); default pickFrameBudgetBytes(). */
  budgetBytes?: number;
  /** Decode on the main thread from the start ("budget-main"). */
  mainThread?: boolean;
  /** Injected for tests; defaults: the film worker, the page's fetch and createImageBitmap, performance.now, timers. */
  startWorker?: () => WorkerLike;
  fetch?: FetchLike;
  createImageBitmap?: (blob: Blob) => Promise<BitmapLike>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /** Absolute URL of a frame (the worker resolves URLs against its own script). Default: against the page's location. */
  resolveUrl?: (url: string) => string;
  /** The worker must answer `ready` within this, or the loader decodes on the main thread. */
  readyTimeoutMs?: number;
};

/** The film worker must say it is ready within this (ms). */
export const READY_TIMEOUT_MS = 10_000;

function startBrowserWorker(): WorkerLike {
  return new Worker(new URL("./frame-worker.js", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

type Rec = { film: FilmManifest; width: number; epoch: number; bytes: number; bitmaps: (BitmapLike | undefined)[] };
type FetchJob = { seg: number; frame: number; epoch: number };
type DecodeJob = { seg: number; frame: number; epoch: number; bytes: number };
type Source = { where: "worker" | "main"; post(m: ToWorker): void; close(): void };

export function createBudgetLoader(env: LoaderEnv, options: BudgetOptions = {}): FrameLoader {
  const stats = env.stats;
  const connection = env.connection;
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const resolveUrl =
    options.resolveUrl ?? ((url: string) => (typeof location !== "undefined" ? new URL(url, location.href).href : url));
  const pageFetch: FetchLike | undefined =
    options.fetch ?? (typeof fetch === "function" ? (url, init) => fetch(url, init) : undefined);
  const pageDecode =
    options.createImageBitmap ??
    (typeof createImageBitmap === "function" ? (blob: Blob) => createImageBitmap(blob) as Promise<BitmapLike> : undefined);

  const saveData = saveDataOn(connection);
  let slow = connectionSlow(connection);
  const heroTimes: number[] = [];
  const budgetBytes = options.budgetBytes ?? pickFrameBudgetBytes();

  const recs: (Rec | undefined)[] = [];
  const fetches = new Map<number, FetchJob>();
  const decodes = new Map<number, DecodeJob>();
  const arrive = new Set<(index: number, frame: number) => void>();
  const loadedDirty = new Set<number>();
  const dropKeys: string[] = [];
  let nextId = 1;
  let disposed = false;
  let mode = options.mainThread ? "budget-main" : "budget";
  let retryTimer: unknown = null;
  let retryAt = Infinity;
  let readyTimer: unknown = null;
  let worker: WorkerLike | null = null;

  const keyOf = (epoch: number, frame: number) => `${epoch}/${frame}`;

  const planner = createBudgetPlanner({
    budgetBytes,
    maxFetches: maxInflightFor(saveData, slow),
    engaged: env.engaged,
    // A decoded frame leaves the store (to make room, or its segment left or changed tier): close it, report it.
    onEvict: (seg, frame, bytes) => {
      const rec = recs[seg];
      const bm = rec?.bitmaps[frame];
      if (bm) {
        bm.close();
        rec!.bitmaps[frame] = undefined;
      }
      stats.dropped(bytes);
      loadedDirty.add(seg);
    },
    // Compressed bytes let go (the cap, bad bytes, leave, retier): the store deletes them (sent in one batch).
    onBytesDropped: (seg, frame) => {
      const rec = recs[seg];
      if (rec) dropKeys.push(keyOf(rec.epoch, frame));
    },
  });
  stats.budget?.(budgetBytes);

  // ------------------------------------------------------------------ the frame store: worker, or the main thread

  const mainSource = (): Source => {
    const store = createFrameStore({
      fetch: pageFetch,
      createImageBitmap: pageDecode,
      now,
      // Answers arrive in a later microtask, never inside the call that caused them, as from a worker.
      emit: (m) =>
        queueMicrotask(() => {
          if (source === me) onMessage(m);
          else if (m.t === "decoded" && m.ok) m.bitmap.close();
        }),
    });
    const me: Source = {
      where: "main",
      post: (m) => store.handle(m),
      close: () => store.handle({ t: "dispose" }),
    };
    return me;
  };

  const workerSource = (): Source | null => {
    try {
      const w = (options.startWorker ?? startBrowserWorker)();
      worker = w;
      w.onmessage = (ev) => {
        if (worker === w) onMessage(ev.data);
        else if (ev.data.t === "decoded" && ev.data.ok) ev.data.bitmap.close();
      };
      w.onerror = (ev) => {
        ev.preventDefault?.();
        if (worker === w) toMainThread();
      };
      w.onmessageerror = () => {
        if (worker === w) toMainThread();
      };
      readyTimer = setTimer(() => {
        readyTimer = null;
        if (worker === w) toMainThread();
      }, options.readyTimeoutMs ?? READY_TIMEOUT_MS);
      return {
        where: "worker",
        post: (m) => w.postMessage(m),
        close: () => w.terminate(),
      };
    } catch {
      worker = null;
      return null;
    }
  };

  let source: Source = (!options.mainThread && workerSource()) || mainSource();
  if (source.where === "main") mode = "budget-main";
  source.post({ t: "init", maxFetches: planner.maxFetches, maxDecodes: planner.maxDecodes });

  /**
   * The worker cannot run (it failed to start, lacks createImageBitmap, crashed or never answered): every job it had is
   * cancelled (no try is spent), the bytes it held are forgotten, and the same store runs on the main thread.
   */
  function toMainThread() {
    if (disposed || source.where === "main") return;
    const w = worker;
    worker = null;
    if (readyTimer !== null) clearTimer(readyTimer);
    readyTimer = null;
    try {
      w?.terminate();
    } catch {
      // already gone
    }
    for (const j of fetches.values()) planner.fetchCancelled(j.seg, j.frame, j.epoch);
    fetches.clear();
    stats.released(planner.fetchesInFlight);
    for (const j of decodes.values()) {
      planner.decodeCancelled(j.seg, j.frame, j.epoch);
      stats.dropped(j.bytes);
    }
    if (decodes.size) stats.decodeEnded?.(false, "worker", 0, planner.decodesInFlight);
    decodes.clear();
    source = mainSource();
    planner.forgetBytes();
    dropKeys.length = 0;
    stats.bytesHeld?.(0);
    mode = "budget-main";
    stats.mode?.(mode);
    source.post({ t: "init", maxFetches: planner.maxFetches, maxDecodes: planner.maxDecodes });
    pump();
  }

  // ------------------------------------------------------------------ answers from the store

  function onMessage(m: FromWorker) {
    if (disposed) {
      if (m.t === "decoded" && m.ok) m.bitmap.close();
      return;
    }
    switch (m.t) {
      case "ready":
        if (readyTimer !== null) clearTimer(readyTimer);
        readyTimer = null;
        if (!m.ok) return toMainThread();
        return;
      case "held":
        stats.bytesHeld?.(m.held);
        return;
      case "fetched": {
        const j = fetches.get(m.id);
        if (!j) return;
        fetches.delete(m.id);
        if (m.ok) {
          stats.bytesHeld?.(m.held);
          if (!planner.fetched(j.seg, j.frame, j.epoch, m.size)) dropKeys.push(keyOf(j.epoch, j.frame)); // its segment left
          else if (j.seg === 0) timeHeroFrame(m.ms);
        } else if (m.cancelled) {
          planner.fetchCancelled(j.seg, j.frame, j.epoch);
        } else if (planner.fetchFailed(j.seg, j.frame, j.epoch, now(), !m.retryable)) {
          stats.failed(); // given up: its neighbours cover it
        }
        stats.released(planner.fetchesInFlight);
        return pump();
      }
      case "decoded": {
        const j = decodes.get(m.id);
        if (!j) {
          if (m.ok) m.bitmap.close();
          return;
        }
        decodes.delete(m.id);
        if (m.ok) {
          const rec = recs[j.seg];
          if (rec && planner.decoded(j.seg, j.frame, j.epoch)) {
            rec.bitmaps[j.frame] = m.bitmap;
            stats.decodeEnded?.(true, source.where, m.ms, planner.decodesInFlight);
            loadedDirty.add(j.seg);
            pump();
            for (const cb of arrive) cb(j.seg, j.frame);
            return;
          }
          if (!rec) planner.decoded(j.seg, j.frame, j.epoch); // settles the orphaned reservation
          m.bitmap.close(); // its segment left or changed tier meanwhile
          stats.dropped(j.bytes);
          stats.decodeEnded?.(false, source.where, m.ms, planner.decodesInFlight);
        } else if (m.reason === "cancelled") {
          planner.decodeCancelled(j.seg, j.frame, j.epoch);
          stats.dropped(j.bytes);
          stats.decodeEnded?.(false, source.where, 0, planner.decodesInFlight);
        } else {
          const missing = planner.decodeFailed(j.seg, j.frame, j.epoch, now());
          stats.dropped(j.bytes);
          stats.decodeEnded?.(false, source.where, 0, planner.decodesInFlight);
          if (missing) stats.failed();
        }
        return pump();
      }
    }
  }

  // ------------------------------------------------------------------ starting work

  const startFetch = (job: number) => {
    const seg = jobSeg(job);
    const frame = jobFrame(job);
    const rec = recs[seg]!;
    const id = nextId++;
    fetches.set(id, { seg, frame, epoch: rec.epoch });
    source.post({ t: "fetch", id, key: keyOf(rec.epoch, frame), url: resolveUrl(frameUrl(rec.film, rec.width, frame)) });
    stats.requested(rec.film.name, rec.width, frame, planner.fetchesInFlight);
  };

  const startDecode = (job: number, redecode: boolean) => {
    const seg = jobSeg(job);
    const frame = jobFrame(job);
    const rec = recs[seg]!;
    const id = nextId++;
    decodes.set(id, { seg, frame, epoch: rec.epoch, bytes: rec.bytes });
    source.post({ t: "decode", id, key: keyOf(rec.epoch, frame) });
    stats.decodeStarted?.(rec.bytes, planner.decodesInFlight, redecode);
  };

  // Fetch, then decode, as far as the planner allows; then the batched drops, data-loaded, and the retry timer.
  function pump() {
    if (disposed) return;
    const t = now();
    let job: number;
    while ((job = planner.nextFetch(t)) !== NONE) startFetch(job);
    for (;;) {
      const before = planner.counters.redecodes;
      job = planner.nextDecode();
      if (job === NONE) break;
      startDecode(job, planner.counters.redecodes > before);
    }
    if (dropKeys.length) {
      source.post({ t: "drop", keys: dropKeys.splice(0) });
    }
    if (loadedDirty.size) {
      for (const i of loadedDirty) if (recs[i]) env.onLoaded?.(i, planner.loaded(i));
      loadedDirty.clear();
    }
    armRetry(planner.nextRetryAt(), t);
  }

  // One timer for the earliest failed frame due for another try.
  const armRetry = (at: number, t: number) => {
    if (!Number.isFinite(at) || at >= retryAt) return;
    if (retryTimer !== null) clearTimer(retryTimer);
    retryAt = at;
    retryTimer = setTimer(() => {
      retryTimer = null;
      retryAt = Infinity;
      pump();
    }, Math.max(0, at - t));
  };

  // Without navigator.connection (Safari): the first TIMED_FRAMES hero frames' fetch times, measured where the fetch
  // ran (the worker), decide whether the network is slow (network.ts heroTimesSlow), as the legacy loader does.
  const timeHeroFrame = (ms: number) => {
    if (connection || slow || heroTimes.length >= TIMED_FRAMES || !(ms > 0)) return;
    heroTimes.push(ms);
    if (heroTimesSlow(heroTimes)) {
      slow = true;
      planner.setMaxFetches(SLOW_INFLIGHT);
      source.post({ t: "limits", maxFetches: SLOW_INFLIGHT, maxDecodes: planner.maxDecodes });
    }
  };

  // Jobs of segment `index` in its life `epoch` that have not started in the store are cancelled there.
  const cancelJobs = (index: number, epoch: number) => {
    const ids: number[] = [];
    for (const [id, j] of fetches) if (j.seg === index && j.epoch === epoch) ids.push(id);
    for (const [id, j] of decodes) if (j.seg === index && j.epoch === epoch) ids.push(id);
    if (ids.length) source.post({ t: "cancel", ids });
  };

  const newRec = (index: number, film: FilmManifest, width: number): Rec => ({
    film,
    width,
    epoch: planner.epoch(index),
    bytes: tierFrameBytes(width, film.aspect),
    bitmaps: new Array(film.count),
  });

  // A slow network: every segment after `after` moves to the tier FilmBackdrop would pick now, as the legacy loader
  // does (at a segment boundary, never mid-segment). Its frames and bytes go; fetches in flight land stale.
  const retier = (after: number) => {
    for (let i = after + 1; i < recs.length; i++) {
      const rec = recs[i];
      if (!rec) continue;
      const width = env.tier(rec.film);
      if (width === rec.width) continue;
      cancelJobs(i, rec.epoch);
      planner.retier(i, width);
      recs[i] = newRec(i, rec.film, width);
      loadedDirty.delete(i);
      env.onLoaded?.(i, 0);
      env.onWidth?.(i, width);
    }
  };

  const held: HeldFrame = { frame: -1, image: null as unknown as CanvasImageSource, width: 0, height: 0 };
  let active = -1;

  return {
    get mode() {
      return mode;
    },

    join(index, film, width, opts) {
      const old = recs[index];
      if (old) cancelJobs(index, old.epoch);
      planner.join(index, film.count, width, film.aspect, opts);
      recs[index] = newRec(index, film, width);
    },

    leave(index) {
      const rec = recs[index];
      if (!rec) return;
      cancelJobs(index, rec.epoch);
      planner.leave(index);
      recs[index] = undefined;
      loadedDirty.delete(index);
      pump();
    },

    setNear(changes) {
      for (const [index, near] of changes) planner.setNear(index, near);
      pump();
    },

    engage() {
      if (planner.engaged) return;
      planner.engage();
      pump();
    },

    rerank() {
      active = -1;
      planner.rerank();
    },

    // The WantPlan is FilmBackdrop's one object, reused between ticks: its fields are read here and nothing is kept.
    want(plan) {
      if (plan.active !== active) {
        active = plan.active;
        if (slow) retier(active + 1);
      }
      planner.want(plan.active, plan.frame, plan.direction, plan.entry);
      pump();
    },

    nearest(index, at) {
      const f = planner.nearestDecoded(index, at);
      if (f < 0) return null;
      const bm = recs[index]?.bitmaps[f];
      if (!bm) return null;
      held.frame = f;
      held.image = bm as unknown as CanvasImageSource;
      held.width = bm.width;
      held.height = bm.height;
      return held;
    },

    isComing: (index, at, tolerance) => planner.isComing(index, at, tolerance),
    usable: (index, i) => planner.usable(index, i),
    loaded: (index) => planner.loaded(index),
    width: (index) => planner.width(index),

    onArrive(cb) {
      arrive.add(cb);
      return () => {
        arrive.delete(cb);
      };
    },

    isSlow: () => slow,

    // Hidden: nothing new starts (what is running finishes). Shown: carry on.
    visibility(hidden) {
      planner.setPaused(hidden);
      if (!hidden) pump();
    },

    // Offline: no fetch starts. Back online: frames given up or waiting for a retry get fresh tries.
    network(online) {
      planner.setOffline(!online);
      if (online) {
        planner.forgive();
        pump();
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (retryTimer !== null) clearTimer(retryTimer);
      if (readyTimer !== null) clearTimer(readyTimer);
      retryTimer = readyTimer = null;
      // Decodes in flight: their reservations go now; whatever lands later is closed (onMessage).
      for (const j of decodes.values()) stats.dropped(j.bytes);
      if (decodes.size) stats.decodeEnded?.(false, source.where, 0, 0);
      decodes.clear();
      fetches.clear();
      stats.released(0);
      // Every decoded frame is closed and reported (onEvict).
      for (let i = 0; i < recs.length; i++) if (recs[i]) planner.leave(i);
      recs.length = 0;
      dropKeys.length = 0;
      loadedDirty.clear();
      arrive.clear();
      source.close();
      worker = null;
      stats.bytesHeld?.(0);
    },
  };
}

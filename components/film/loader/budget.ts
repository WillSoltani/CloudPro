import type { FilmManifest } from "../filmCore";
import { frameUrl, packFor, packUrl } from "../filmBase";
import { rehostUrl } from "./select";
import { pickFrameBudgetBytes, tierFrameBytes } from "./budget-bytes";
import {
  createBudgetPlanner,
  jobFrame,
  jobSeg,
  NONE,
  PACK_FORGET,
  PACK_OPEN,
  PACK_STOP,
  PACK_TO,
  READ_CANCELLED,
  READ_FINAL,
  READ_OK,
  READ_RETRY,
  WAIT_REASONS,
} from "./budget-plan";
import { createFrameStore, type BitmapLike, type FetchLike } from "./frame-worker";
import type { FromWorker, ToWorker } from "./frame-worker-protocol";
import {
  connectionSlow,
  heroTimesSlow,
  maxInflightFor,
  packTimesSlow,
  saveDataOn,
  SLOW_INFLIGHT,
  TIMED_FRAMES,
} from "./network";
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
 * held are fetched again. The same move happens when the worker's createImageBitmap keeps rejecting the frames
 * (DECODE_FALLBACK_ERRORS); if main-thread decodes reject them too, `onUnusable` hands the page to the legacy loader
 * (./fallback.ts). FilmBackdrop picks the legacy loader from the start where the page itself lacks fetch, Blob or
 * createImageBitmap (./select.ts).
 *
 * Every bitmap that leaves the store is close()d and reported (`stats.dropped`); one that arrives after its segment has
 * left or changed tier, or after dispose, is closed and never kept (each job carries the planner's segment epoch).
 * `loaded(index)` is the number of decoded frames held for the segment (FilmBackdrop's `data-loaded`).
 *
 * `nearest()` returns one HeldFrame object reused between calls: read it at once, never keep it.
 *
 * PACKS (stage 7). A segment whose manifest names a pack for its tier (filmBase packUrl) reads its frames from that one
 * file instead of one file per frame, unless the page asked `?pack=0` (`packs: false`) or plays reduced-motion stills
 * (five frames do not need the film). The planner says which pack reads run and over which bytes (budget-plan.ts
 * `nextPackOp`); the store runs them (frame-worker.js) and puts each frame it cuts out under the same key a fetch of it
 * would have used, so the planner, the decodes and the cap see a frame's bytes arrive either way. A pack that 404s,
 * fails its header check or fails PACK_TRIES times is given up: that film's missing frames are then fetched as files,
 * and the frames the pack delivered stay. Counters: `stats.packRequested`, `packBytes`, `packFilms`, `framesArrived`.
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
  /** Read films from their packs where the manifest names one (default true; `?pack=0` turns it off). */
  packs?: boolean;
  /** LAB ONLY (`?packorigin=`, select.ts packOriginFromQuery): read packs from this origin, frames from where they are. */
  packOrigin?: string;
  /**
   * Main-thread decodes cannot decode the frames either (DECODE_FALLBACK_ERRORS frames failed in a row): this loader
   * cannot show the film here. Called once; the caller disposes it and runs the legacy loader (./fallback.ts).
   */
  onUnusable?: () => void;
};

/** The film worker must say it is ready within this (ms). */
export const READY_TIMEOUT_MS = 10_000;
/**
 * This many different frames failing to decode with no decode working in between means the decoder cannot decode
 * them (an engine whose createImageBitmap rejects WebP, or rejects under memory pressure), not that the frames are bad:
 * the worker's decodes move to the main thread, and main-thread decodes to the legacy loader (`onUnusable`).
 */
export const DECODE_FALLBACK_ERRORS = 3;

function startBrowserWorker(): WorkerLike {
  return new Worker(new URL("./frame-worker.js", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

type Rec = { film: FilmManifest; width: number; epoch: number; bytes: number; bitmaps: (BitmapLike | undefined)[] };
type FetchJob = { seg: number; frame: number; epoch: number };
type PackJob = { seg: number; epoch: number; heroTimed: boolean };
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
  const packsOn = options.packs !== false;

  const recs: (Rec | undefined)[] = [];
  const fetches = new Map<number, FetchJob>();
  const packReads = new Map<number, PackJob>();
  let heroPackFrames = 0;
  let heroPackTimed = false;
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
  let unusable = false;

  const keyOf = (epoch: number, frame: number) => `${epoch}/${frame}`;

  const planner = createBudgetPlanner({
    budgetBytes,
    maxFetches: maxInflightFor(saveData, slow),
    maxPackReads: saveData || slow ? 1 : 2,
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
   * The worker cannot run (it failed to start, lacks createImageBitmap, crashed, never answered, or its
   * createImageBitmap rejects the frames): every job it had is
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
    // Its pack reads went with it (the planner forgets every pack's layout below: each is read again from byte 0).
    packReads.clear();
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

  // The store's last answer (the specs' diagnostic only: debugState).
  let lastAnswerAt = -1;
  let lastAnswer = "";

  function onMessage(m: FromWorker) {
    lastAnswerAt = now();
    lastAnswer = m.t;
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
          else {
            stats.framesArrived?.(false, 1);
            if (j.seg === 0) timeHeroFrame(m.ms);
          }
        } else if (m.cancelled) {
          planner.fetchCancelled(j.seg, j.frame, j.epoch);
        } else if (planner.fetchFailed(j.seg, j.frame, j.epoch, now(), !m.retryable)) {
          stats.failed(); // given up: its neighbours cover it
        }
        stats.released(planner.fetchesInFlight);
        return pump();
      }
      case "pack-header": {
        const r = packReads.get(m.id);
        if (!r) return;
        const err = planner.packLayout(r.seg, r.epoch, m.count, m.header, m.skeletonEnd, m.bytes, m.slotFrame, m.slotOffset);
        if (err) packGivenUp();
        return pump();
      }
      case "pack-frames": {
        const r = packReads.get(m.id);
        stats.bytesHeld?.(m.held);
        stats.packBytes?.(m.got, m.repeated);
        if (!r) return;
        let took = 0;
        for (let k = 0; k < m.frames.length; k++) {
          if (planner.packFrame(r.seg, r.epoch, m.frames[k], m.sizes[k])) took++;
          // Its segment left or changed tier: the store lets these bytes go. (A frame held or being fetched as a file
          // already keeps the one entry under its key.)
          else if (planner.epoch(r.seg) !== r.epoch) dropKeys.push(keyOf(r.epoch, m.frames[k]));
        }
        if (took) stats.framesArrived?.(true, took);
        planner.packProgress(r.seg, r.epoch, m.id, m.pos);
        if (r.heroTimed) timeHeroPack(m.ms, took);
        return pump();
      }
      case "pack-done": {
        const r = packReads.get(m.id);
        stats.bytesHeld?.(m.held);
        if (m.got) stats.packBytes?.(m.got, m.repeated);
        if (!r) return;
        packReads.delete(m.id);
        const outcome = m.ok ? READ_OK : m.cancelled ? READ_CANCELLED : m.failure === "final" ? READ_FINAL : READ_RETRY;
        if (planner.packEnded(r.seg, r.epoch, m.id, outcome, m.pos, now(), !!m.rangeless, m.reason ?? "")) packGivenUp();
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
          // "missing": the store lost the bytes (fetch them again); "error": the decoder rejected them.
          const missing = planner.decodeFailed(j.seg, j.frame, j.epoch, now(), m.reason === "missing");
          stats.dropped(j.bytes);
          stats.decodeEnded?.(false, source.where, 0, planner.decodesInFlight);
          if (missing) stats.failed();
          if (planner.decodeErrorStreak >= DECODE_FALLBACK_ERRORS) {
            if (source.where === "worker") return toMainThread();
            if (!unusable && options.onUnusable) {
              unusable = true;
              return options.onUnusable();
            }
          }
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

  // What the planner says about pack reads: open, move the end of, stop, or forget a pack.
  const packOps = (t: number) => {
    const op = planner.packOp;
    for (let kind: number; (kind = planner.nextPackOp(t)) !== NONE; ) {
      const rec = recs[op.seg];
      if (kind === PACK_OPEN) {
        if (!rec) continue;
        const heroTimed = op.seg === 0 && !connection && !slow && !heroPackTimed;
        heroPackTimed ||= heroTimed;
        packReads.set(op.id, { seg: op.seg, epoch: rec.epoch, heroTimed });
        source.post({
          t: "pack",
          id: op.id,
          url: op.url,
          prefix: `${rec.epoch}/`,
          from: op.from,
          to: op.to,
          hold: op.hold,
          est: op.est,
          type: `image/${rec.film.ext}`,
        });
        stats.packRequested?.(rec.film.name, rec.width);
      } else if (kind === PACK_TO) {
        source.post({ t: "pack-to", id: op.id, to: op.to });
      } else if (kind === PACK_STOP) {
        source.post({ t: "pack-stop", id: op.id });
      } else if (kind === PACK_FORGET) {
        source.post({ t: "pack-forget", url: op.url });
      }
    }
  };

  // Gauges of the films reading packs and of those whose pack was given up.
  const packGauges = () => {
    let using = 0;
    let fallback = 0;
    for (let i = 0; i < recs.length; i++) {
      const p = recs[i] ? planner.pack(i) : null;
      if (!p) continue;
      if (p.failed) fallback++;
      else using++;
    }
    stats.packFilms?.(using, fallback);
  };
  const packGivenUp = () => {
    stats.failed();
    packGauges();
  };

  // Fetch, then decode, as far as the planner allows; then the batched drops, data-loaded, and the retry timer.
  function pump() {
    if (disposed) return;
    const t = now();
    let job: number;
    while ((job = planner.nextFetch(t)) !== NONE) startFetch(job);
    packOps(t);
    for (;;) {
      const before = planner.counters.redecodes;
      job = planner.nextDecode(t);
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
      planner.setMaxPackReads(1);
      source.post({ t: "limits", maxFetches: SLOW_INFLIGHT, maxDecodes: planner.maxDecodes });
    }
  };

  // Where the hero's frames come from its pack: the first read's pace decides the same way (network.ts packTimesSlow).
  const timeHeroPack = (ms: number, frames: number) => {
    if (connection || slow || heroPackFrames >= TIMED_FRAMES) return;
    heroPackFrames += frames;
    if (heroPackFrames < TIMED_FRAMES || !packTimesSlow(ms, heroPackFrames)) return;
    slow = true;
    planner.setMaxFetches(SLOW_INFLIGHT);
    planner.setMaxPackReads(1);
    source.post({ t: "limits", maxFetches: SLOW_INFLIGHT, maxDecodes: planner.maxDecodes });
  };

  // Jobs of segment `index` in its life `epoch` that have not started in the store are cancelled there; its pack read
  // stops (frames still on their way land stale and are dropped).
  const cancelJobs = (index: number, epoch: number) => {
    const ids: number[] = [];
    for (const [id, j] of fetches) if (j.seg === index && j.epoch === epoch) ids.push(id);
    for (const [id, j] of decodes) if (j.seg === index && j.epoch === epoch) ids.push(id);
    if (ids.length) source.post({ t: "cancel", ids });
    for (const [id, r] of packReads) if (r.seg === index && r.epoch === epoch) source.post({ t: "pack-stop", id });
  };

  // The pack segment `index` reads at `width`, if any (not with `?pack=0`, not for reduced-motion stills).
  const choosePack = (index: number, film: FilmManifest, width: number, stills: boolean) => {
    const url = packsOn && !stills ? packUrl(film, width) : null;
    planner.setPack(index, url ? (options.packOrigin ? rehostUrl(resolveUrl(url), options.packOrigin) : resolveUrl(url)) : null, url ? packFor(film, width) : null);
    packGauges();
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
      choosePack(i, rec.film, width, !!stillsOf[i]);
      loadedDirty.delete(i);
      env.onLoaded?.(i, 0);
      env.onWidth?.(i, width);
    }
  };

  const held: HeldFrame = { frame: -1, image: null as unknown as CanvasImageSource, width: 0, height: 0 };
  let active = -1;
  /** Segments playing reduced-motion stills (no pack for them). */
  const stillsOf: boolean[] = [];

  return {
    get mode() {
      return mode;
    },

    join(index, film, width, opts) {
      const old = recs[index];
      if (old) cancelJobs(index, old.epoch);
      planner.join(index, film.count, width, film.aspect, opts);
      recs[index] = newRec(index, film, width);
      stillsOf[index] = !!opts.reducedStills;
      choosePack(index, film, width, stillsOf[index]);
    },

    leave(index) {
      const rec = recs[index];
      if (!rec) return;
      cancelJobs(index, rec.epoch);
      planner.leave(index);
      recs[index] = undefined;
      loadedDirty.delete(index);
      packGauges();
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
    waitReason: (index, at) => {
      const why = WAIT_REASONS[planner.waitReason(index, at)];
      const p = planner.pack(index);
      if (!p) return why;
      if (p.failed) return `${why} (pack given up: ${p.failReason})`;
      const read = p.readId && p.known ? `, read at frame ${p.slotFrame![Math.min(p.slotAt(p.readPos), p.count - 1)]}` : "";
      return `${why} (pack ${p.known ? "known" : "header not yet read"}${read})`;
    },
    // Read-only, for the specs' diagnostic: the plan's state is copied before waitReason may rebuild the pack plan.
    debugState(index, at) {
      const plan = planner.debugState();
      const t = now();
      return {
        mode,
        msSinceAnswer: lastAnswerAt < 0 ? -1 : Math.round(t - lastAnswerAt),
        lastAnswer,
        jobs: { fetches: fetches.size, decodes: decodes.size, packReads: [...packReads.keys()].join(",") },
        retryInMs: Number.isFinite(retryAt) ? Math.round(retryAt - t) : null,
        frame: {
          at,
          why: WAIT_REASONS[planner.waitReason(index, at, false)],
          wanted: planner.isWanted(index, at),
          nearestDecoded: planner.nearestDecoded(index, at),
          // Frames at-8 … at+8: D decoded, d decoding, B bytes held, F fetching, x given up, . nothing; ^ not wanted.
          around: Array.from({ length: 17 }, (_, k) => {
            const i = at - 8 + k;
            if (!planner.usable(index, i)) return " ";
            const c = planner.isDecoded(index, i)
              ? "D"
              : planner.isDecoding(index, i)
                ? "d"
                : planner.hasBytes(index, i)
                  ? "B"
                  : planner.isMissing(index, i)
                    ? "x"
                    : WAIT_REASONS[planner.waitReason(index, i, false)] === "file fetch running"
                      ? "F"
                      : ".";
            return planner.isWanted(index, i) ? c : `${c}^`;
          }).join(""),
        },
        plan,
      };
    },
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
      for (const id of packReads.keys()) source.post({ t: "pack-stop", id });
      packReads.clear();
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

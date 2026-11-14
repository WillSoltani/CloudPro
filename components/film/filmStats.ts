import type { LoaderStats } from "./loader/types";

/**
 * The film engine's counters (components/film/FilmBackdrop.tsx), published as `window.__filmStats` on the
 * home page (production builds too) and shown by the `?hud=1` overlay (FilmHud). The lab gate
 * (docs/film-lab-gate.md) calls `window.__filmStatsReset()` before a scroll pass and reads the object after it.
 *
 * One plain object for the whole page load, updated in place where the engine already does the work: no
 * allocation per tick. Counters only grow until a reset; gauges (framesAlive, decodedMB, inflight, the current
 * values) always describe now and survive a reset. Everything here but `filmInstrument` is pure, so it is
 * unit-tested (filmStats.test.ts). A loader reports through the `LoaderStats` hook (components/film/loader/types.ts);
 * `loaderStatsFor` is the one adapter from those calls to this object.
 */
export type FilmStats = {
  /**
   * The frame loader that fills the canvas now (components/film/loader): "legacy" is legacy.ts, "budget" the budget
   * loader decoding in a worker, "budget-main" the same decoding on the main thread. May change during a page load.
   */
  mode: string;
  /** Network requests for frames started (legacy: an <img> given a frame URL; budget: a fetch of a frame's bytes). */
  requests: number;
  /**
   * Requests for a frame (same film, width and index) already requested earlier in this page load (budget: whose bytes
   * had been fetched before; 0 while the bytes are kept).
   */
  refetches: number;
  /** Frames that finished decoding and joined their segment (a request evicted or torn down meanwhile is not counted). */
  decodes: number;
  /** Decodes of a frame decoded before on this page load, from bytes kept since (budget loaders; 0 for legacy). */
  redecodes: number;
  /** Decodes that ran in a worker / on the main thread with createImageBitmap (budget loaders; 0 for legacy). */
  workerDecodes: number;
  mainThreadDecodes: number;
  /** Summed and mean time of those decodes, in ms (budget loaders; 0 for legacy). */
  decodeMsTotal: number;
  decodeMsMean: number;
  /** Decodes running now, and the most at once (budget loaders; 0 for legacy, whose decodes are its requests). */
  decodeInFlight: number;
  decodeInFlightPeak: number;
  /** Frames that failed to load or decode (a request cancelled by evict, dispose or teardown is not counted). */
  failures: number;
  /** Highest number of requests in flight at once. */
  inflightPeak: number;
  /** Requests in flight now (gauge). */
  inflight: number;
  /** Decoded frames held now, across all segments (gauge); for a budget loader including decodes that have reserved their bytes. */
  framesAlive: number;
  framesAlivePeak: number;
  /** Bytes of the frames held now, estimated as width × round(width / aspect) × 4 per frame (gauge). */
  decodedBytes: number;
  /** decodedBytes in MB (10^6 bytes), now and at its peak. */
  decodedMB: number;
  decodedMBPeak: number;
  /** The decoded-frame budget of this page load in MB (10^6 bytes; budget loaders; 0 for legacy, which has none). */
  budgetMB: number;
  /** Compressed frame bytes held in MB, now and at its peak (budget loaders; 0 for legacy, which keeps none). */
  bytesHeldMB: number;
  bytesHeldMBPeak: number;
  /** Canvas paints. */
  draws: number;
  /**
   * Paints of the effective target: the target frame itself, or, where the engine never loads that frame by
   * design (an odd breathing-tail frame on a coarse pointer, a frame between the reduced-motion stills), the
   * usable frame nearest to it (either one on a tie). See `aimAt`.
   */
  exactDraws: number;
  /** Paints of any other frame (draws = exactDraws + fallbackDraws). */
  fallbackDraws: number;
  /** Sum over fallback paints of their distance to the effective target (`missBy`). */
  fallbackDistance: number;
  /** Clock ticks processed (each call of the engine's onReel). */
  ticks: number;
  /** Ticks after which the canvas did not show the effective target of the target segment. */
  staleTicks: number;
  /** Total time spent stale, in ms. */
  staleMs: number;
  /** Longest continuous stale stretch, in ms: from its first stale tick to the moment the canvas shows the effective target again. */
  staleMsMax: number;
  /** Times draw() declined to paint because a frame nearer the target was still coming. */
  held: number;
  /** Canvas backing-store reallocations: only a resize that really changes canvas.width or canvas.height counts. */
  canvasResizes: number;
  /** Calls of the engine's measure() (each a batch of layout reads). */
  measures: number;
  /** The segment and frame the clock wants now (the raw target, before `aimAt`). */
  targetSeg: number;
  targetFrame: number;
  /**
   * The frame the engine can show for that target: targetFrame when the engine loads it, else the nearest frame
   * it does load (the lower of two at the same distance, the one draw() prefers). The canvas is on target when its
   * frame is as far from targetFrame as this one is.
   */
  effectiveFrame: number;
  /** The segment, its film's name and the frame on the canvas now (−1 / "" before a paint and after a resize clears it). */
  paintedSeg: number;
  paintedFilm: string;
  paintedFrame: number;
  /** Tier width of the painted frame (0 before a paint). */
  width: number;
  /** Canvas backing store now, in device px (gauges; 0 before the first sizing). See components/film/backing.ts. */
  backingW: number;
  backingH: number;
  /**
   * The input that moved the page last ("wheel", "keys", "touch"; components/film/smoothing.ts) and the steady lag of
   * the smoothing it gets, in ms (0: none, as under reduced motion). Gauges.
   */
  input: string;
  smoothMs: number;
  /**
   * The raw (unsmoothed) clock at the last scroll event, its segment and the frame it would paint (gauges). The shown
   * clock is the canvas's `data-clock`, its segment and frame targetSeg and targetFrame: the gap between the two is
   * the smoothing's lag.
   */
  rawClock: number;
  rawSeg: number;
  rawFrame: number;
  /**
   * Pack reads started (stage 7: one request each, a streaming GET or a Range read of a film's pack). `requests` keeps
   * meaning one-file-per-frame requests, so the film's data requests are `packRequests + requests`.
   */
  packRequests: number;
  /** Pack body bytes received, in MB (10^6), and of them the bytes received a second time (already held, or read again after a drop). */
  packBytesMB: number;
  packBytesRepeatedMB: number;
  /** Segments reading their frames from a pack now, and segments whose pack was given up (they load frame by frame) (gauges). */
  packFilms: number;
  packFallbackFilms: number;
  /** Frames whose bytes came from a pack / as one file each. */
  framesFromPacks: number;
  framesFromFiles: number;
  /**
   * Where the longest stale stretch (`staleMsMax`) began: the target segment, film and frame, the frame painted then,
   * ms since the last reset, and what the loader was waiting for (FrameLoader.waitReason; "" without one).
   */
  staleMaxSeg: number;
  staleMaxFilm: string;
  staleMaxFrame: number;
  staleMaxPainted: number;
  staleMaxAtMs: number;
  staleMaxWhy: string;
};

/**
 * The stale-stretch clock: when the open stretch began (−1: none open) and when the previous tick ran (−1: none yet);
 * where the open stretch began (`noteStaleStart`) and when the counters were last reset.
 */
export type StaleClock = {
  since: number;
  last: number;
  seg: number;
  film: string;
  frame: number;
  painted: number;
  why: string;
  resetAt: number;
};

/**
 * The frames that count as on target for the current target frame: `lo` ≤ `hi`, equal when the target itself is
 * usable or only one usable frame is nearest. Filled in place by `aimAt` (no allocation per tick).
 */
export type EffectiveTarget = { lo: number; hi: number };

export function newFilmStats(mode = "legacy"): FilmStats {
  return {
    mode,
    requests: 0,
    refetches: 0,
    decodes: 0,
    redecodes: 0,
    workerDecodes: 0,
    mainThreadDecodes: 0,
    decodeMsTotal: 0,
    decodeMsMean: 0,
    decodeInFlight: 0,
    decodeInFlightPeak: 0,
    failures: 0,
    inflightPeak: 0,
    inflight: 0,
    framesAlive: 0,
    framesAlivePeak: 0,
    decodedBytes: 0,
    decodedMB: 0,
    decodedMBPeak: 0,
    budgetMB: 0,
    bytesHeldMB: 0,
    bytesHeldMBPeak: 0,
    draws: 0,
    exactDraws: 0,
    fallbackDraws: 0,
    fallbackDistance: 0,
    ticks: 0,
    staleTicks: 0,
    staleMs: 0,
    staleMsMax: 0,
    held: 0,
    canvasResizes: 0,
    measures: 0,
    targetSeg: 0,
    targetFrame: 0,
    effectiveFrame: 0,
    paintedSeg: -1,
    paintedFilm: "",
    paintedFrame: -1,
    width: 0,
    backingW: 0,
    backingH: 0,
    input: "wheel",
    smoothMs: 0,
    rawClock: 0,
    rawSeg: 0,
    rawFrame: 0,
    packRequests: 0,
    packBytesMB: 0,
    packBytesRepeatedMB: 0,
    packFilms: 0,
    packFallbackFilms: 0,
    framesFromPacks: 0,
    framesFromFiles: 0,
    staleMaxSeg: -1,
    staleMaxFilm: "",
    staleMaxFrame: -1,
    staleMaxPainted: -1,
    staleMaxAtMs: 0,
    staleMaxWhy: "",
  };
}

export function newStaleClock(): StaleClock {
  return { since: -1, last: -1, seg: -1, film: "", frame: -1, painted: -1, why: "", resetAt: 0 };
}

/**
 * A stale stretch is about to open (call before `tickStale` on a stale tick while none is open): remember where, so the
 * counters can say where the longest one began. `why` is read only here, once per stretch.
 */
export function noteStaleStart(clock: StaleClock, seg: number, film: string, frame: number, painted: number, why: string): void {
  clock.seg = seg;
  clock.film = film;
  clock.frame = frame;
  clock.painted = painted;
  clock.why = why;
}

/** The open stretch is the longest so far: copy where it began. */
function recordStaleMax(s: FilmStats, clock: StaleClock): void {
  s.staleMaxSeg = clock.seg;
  s.staleMaxFilm = clock.film;
  s.staleMaxFrame = clock.frame;
  s.staleMaxPainted = clock.painted;
  s.staleMaxAtMs = Math.round(clock.since - clock.resetAt);
  s.staleMaxWhy = clock.why;
}

export function newEffectiveTarget(): EffectiveTarget {
  return { lo: 0, hi: 0 };
}

/**
 * Aim the counters at what the engine can show for `target` in a film of `count` frames. `usable` is the engine's
 * own rule for the frames it ever requests (FilmBackdrop `usable`), so a frame it never loads by design is never
 * scored as lag: when `target` is usable it is the effective target; otherwise the usable frames nearest to it
 * are (both, at the same distance on either side). With no usable frame at all the raw target stands.
 */
export function aimAt(eff: EffectiveTarget, target: number, count: number, usable: (i: number) => boolean): void {
  for (let d = 0; d < count; d++) {
    const below = target - d >= 0 && target - d < count && usable(target - d);
    const above = d > 0 && target + d >= 0 && target + d < count && usable(target + d);
    if (below || above) {
      eff.lo = below ? target - d : target + d;
      eff.hi = above ? target + d : target - d;
      return;
    }
  }
  eff.lo = target;
  eff.hi = target;
}

/** Distance from the painted frame to the nearest effective target (0: on target; Infinity: nothing painted). */
export function missBy(eff: EffectiveTarget, painted: number): number {
  if (painted < 0) return Infinity;
  return Math.min(Math.abs(painted - eff.lo), Math.abs(painted - eff.hi));
}

/** The canvas shows the effective target of the target segment. */
export function onTarget(eff: EffectiveTarget, paintedSeg: number, paintedFrame: number, targetSeg: number): boolean {
  return paintedSeg === targetSeg && missBy(eff, paintedFrame) === 0;
}

/**
 * Zero the counters before a measured pass. Gauges keep their values and the peaks restart from them; an open
 * stale stretch restarts at `now`, so nothing before the reset is counted.
 */
export function resetFilmStats(s: FilmStats, clock: StaleClock, now: number): void {
  s.requests = 0;
  s.refetches = 0;
  s.decodes = 0;
  s.redecodes = 0;
  s.workerDecodes = 0;
  s.mainThreadDecodes = 0;
  s.decodeMsTotal = 0;
  s.decodeMsMean = 0;
  s.failures = 0;
  s.inflightPeak = s.inflight;
  s.decodeInFlightPeak = s.decodeInFlight;
  s.framesAlivePeak = s.framesAlive;
  s.decodedMBPeak = s.decodedMB;
  s.bytesHeldMBPeak = s.bytesHeldMB;
  s.draws = 0;
  s.exactDraws = 0;
  s.fallbackDraws = 0;
  s.fallbackDistance = 0;
  s.ticks = 0;
  s.staleTicks = 0;
  s.staleMs = 0;
  s.staleMsMax = 0;
  s.held = 0;
  s.canvasResizes = 0;
  s.measures = 0;
  s.packRequests = 0;
  s.packBytesMB = 0;
  s.packBytesRepeatedMB = 0;
  s.framesFromPacks = 0;
  s.framesFromFiles = 0;
  s.staleMaxSeg = -1;
  s.staleMaxFilm = "";
  s.staleMaxFrame = -1;
  s.staleMaxPainted = -1;
  s.staleMaxAtMs = 0;
  s.staleMaxWhy = "";
  clock.resetAt = now;
  if (clock.since >= 0) {
    clock.since = now;
    clock.last = now;
  }
}

/** Estimated decoded size of one frame: width × round(width / aspect) × 4 bytes (RGBA). */
export function frameBytes(width: number, aspect: number): number {
  return width * Math.round(width / aspect) * 4;
}

/** A decoded frame of `bytes` joins a segment. */
export function holdFrame(s: FilmStats, bytes: number): void {
  s.framesAlive++;
  s.decodedBytes += bytes;
  s.decodedMB = s.decodedBytes / 1e6;
  if (s.framesAlive > s.framesAlivePeak) s.framesAlivePeak = s.framesAlive;
  if (s.decodedMB > s.decodedMBPeak) s.decodedMBPeak = s.decodedMB;
}

/** A held frame of `bytes` is released (evict, retier, dispose, teardown). */
export function dropFrame(s: FilmStats, bytes: number): void {
  s.framesAlive--;
  s.decodedBytes -= bytes;
  s.decodedMB = s.decodedBytes / 1e6;
}

/** A request starts; `inflight` is the engine's count after it. */
export function countRequest(s: FilmStats, repeated: boolean, inflight: number): void {
  s.requests++;
  if (repeated) s.refetches++;
  s.inflight = inflight;
  if (inflight > s.inflightPeak) s.inflightPeak = inflight;
}

/** A decode starts (budget loaders): `inflight` decodes run after it; `redecode` when the frame was decoded before. */
export function countDecodeStart(s: FilmStats, redecode: boolean, inflight: number): void {
  if (redecode) s.redecodes++;
  s.decodeInFlight = inflight;
  if (inflight > s.decodeInFlightPeak) s.decodeInFlightPeak = inflight;
}

/** A decode settles (budget loaders): `ok` counts it as a decode run `where`, taking `ms`. */
export function countDecodeEnd(s: FilmStats, ok: boolean, where: "worker" | "main", ms: number, inflight: number): void {
  s.decodeInFlight = inflight;
  if (!ok) return;
  s.decodes++;
  if (where === "worker") s.workerDecodes++;
  else s.mainThreadDecodes++;
  s.decodeMsTotal += ms;
  const timed = s.workerDecodes + s.mainThreadDecodes;
  s.decodeMsMean = timed > 0 ? s.decodeMsTotal / timed : 0;
}

/** The compressed frame bytes held now (budget loaders). */
export function holdBytes(s: FilmStats, bytes: number): void {
  s.bytesHeldMB = bytes / 1e6;
  if (s.bytesHeldMB > s.bytesHeldMBPeak) s.bytesHeldMBPeak = s.bytesHeldMB;
}

/** A canvas paint of frame `painted` while the effective target is `eff` (see aimAt). */
export function countDraw(s: FilmStats, painted: number, eff: EffectiveTarget): void {
  s.draws++;
  const miss = missBy(eff, painted);
  if (miss === 0) {
    s.exactDraws++;
  } else {
    s.fallbackDraws++;
    s.fallbackDistance += miss;
  }
}

/**
 * One clock tick, after the tick's draw(): `stale` when the canvas does not show the effective target of the
 * target segment (`!onTarget`). The time since the previous tick counts as stale when that tick left the canvas stale; a stretch runs
 * from its first stale tick until a tick (or recoverStale) finds the target on the canvas.
 */
export function tickStale(s: FilmStats, clock: StaleClock, stale: boolean, now: number): void {
  s.ticks++;
  if (clock.since >= 0 && clock.last >= 0) s.staleMs += now - clock.last;
  if (stale) {
    s.staleTicks++;
    if (clock.since < 0) clock.since = now;
  }
  if (clock.since >= 0 && now - clock.since > s.staleMsMax) {
    s.staleMsMax = now - clock.since;
    recordStaleMax(s, clock);
  }
  if (!stale) clock.since = -1;
  clock.last = now;
}

/**
 * The canvas has just painted the effective target outside a tick (a frame arrived while the clock was at rest): the open
 * stretch ends now rather than at the next tick, which may be long after the viewer stopped scrolling.
 */
export function recoverStale(s: FilmStats, clock: StaleClock, now: number): void {
  if (clock.since < 0) return;
  if (clock.last >= 0) s.staleMs += now - clock.last;
  if (now - clock.since > s.staleMsMax) {
    s.staleMsMax = now - clock.since;
    recordStaleMax(s, clock);
  }
  clock.since = -1;
  clock.last = now;
}

declare global {
  interface Window {
    __filmStats?: FilmStats;
    __filmStatsReset?: () => void;
    /**
     * The engine's and the loader's state around the current target, read by the film specs only when the film did not
     * come to rest (e2e/film-frames.ts settle). Read-only; set by FilmBackdrop while its effect runs.
     */
    __filmWhy?: () => Record<string, unknown>;
  }
}

export type Instrument = {
  stats: FilmStats;
  clock: StaleClock;
  /** `film/width/index` of every frame requested in this page load (refetches). */
  requested: Set<string>;
};
let instrument: Instrument | null = null;

/**
 * The adapter from a frame loader's `LoaderStats` calls (components/film/loader/types.ts) to the page's counters, so
 * `window.__filmStats` keeps one meaning whichever loader runs. A refetch is a request for a film, width and frame
 * already requested in this page load. Pure apart from writing `inst` (unit-tested with a fresh instrument).
 */
export function loaderStatsFor(inst: Instrument): LoaderStats {
  const { stats, requested } = inst;
  return {
    requested: (film, width, frame, inflight) => {
      const key = `${film}/${width}/${frame}`;
      const repeated = requested.has(key);
      if (!repeated) requested.add(key);
      countRequest(stats, repeated, inflight);
    },
    released: (inflight) => {
      stats.inflight = inflight;
    },
    decoded: (bytes) => {
      stats.decodes++;
      holdFrame(stats, bytes);
    },
    dropped: (bytes) => dropFrame(stats, bytes),
    failed: () => {
      stats.failures++;
    },
    decodeStarted: (bytes, inflight, redecode) => {
      holdFrame(stats, bytes);
      countDecodeStart(stats, redecode, inflight);
    },
    decodeEnded: (ok, where, ms, inflight) => countDecodeEnd(stats, ok, where, ms, inflight),
    bytesHeld: (bytes) => holdBytes(stats, bytes),
    budget: (bytes) => {
      stats.budgetMB = bytes / 1e6;
    },
    mode: (mode) => {
      stats.mode = mode;
    },
    packRequested: () => {
      stats.packRequests++;
    },
    packBytes: (bytes, repeated) => {
      stats.packBytesMB += bytes / 1e6;
      stats.packBytesRepeatedMB += repeated / 1e6;
    },
    packFilms: (using, fallback) => {
      stats.packFilms = using;
      stats.packFallbackFilms = fallback;
    },
    framesArrived: (fromPack, n) => {
      if (fromPack) stats.framesFromPacks += n;
      else stats.framesFromFiles += n;
    },
  };
}

/** A fresh instrument that is not published on `window` (tests). */
export function newInstrument(mode = "legacy"): Instrument {
  return { stats: newFilmStats(mode), clock: newStaleClock(), requested: new Set() };
}

/**
 * The page's one instrument, created on first use and published on `window`. Client only: call it from an
 * effect, never during render. It outlives the engine's effect (a re-run, a client navigation), as the page
 * load does.
 */
export function filmInstrument(): Instrument {
  if (!instrument) {
    const inst = newInstrument();
    instrument = inst;
    window.__filmStats = inst.stats;
    window.__filmStatsReset = () => resetFilmStats(inst.stats, inst.clock, performance.now());
  }
  return instrument;
}

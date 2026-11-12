/**
 * The film engine's counters (components/film/FilmBackdrop.tsx), published as `window.__filmStats` on the
 * home page (production builds too) and shown by the `?hud=1` overlay (FilmHud). The lab gate
 * (docs/film-lab-gate.md) calls `window.__filmStatsReset()` before a scroll pass and reads the object after it.
 *
 * One plain object for the whole page load, updated in place where the engine already does the work: no
 * allocation per tick. Counters only grow until a reset; gauges (framesAlive, decodedMB, inflight, the current
 * values) always describe now and survive a reset. Everything here but `filmInstrument` is pure, so it is
 * unit-tested (filmStats.test.ts).
 */
export type FilmStats = {
  /** The loader that fills the canvas: "legacy" is FilmBackdrop's own; later loaders set their own name. */
  mode: string;
  /** Frame requests started (an <img> given a frame URL). */
  requests: number;
  /** Requests for a frame (same film, width and index) already requested earlier in this page load. */
  refetches: number;
  /** Frames that finished decoding and joined their segment (a request evicted or torn down meanwhile is not counted). */
  decodes: number;
  /** Frames that failed to load or decode (a request cancelled by evict, dispose or teardown is not counted). */
  failures: number;
  /** Highest number of requests in flight at once. */
  inflightPeak: number;
  /** Requests in flight now (gauge). */
  inflight: number;
  /** Decoded frames held now, across all segments (gauge). */
  framesAlive: number;
  framesAlivePeak: number;
  /** Bytes of the frames held now, estimated as width × round(width / aspect) × 4 per frame (gauge). */
  decodedBytes: number;
  /** decodedBytes in MB (10^6 bytes), now and at its peak. */
  decodedMB: number;
  decodedMBPeak: number;
  /** Canvas paints. */
  draws: number;
  /** Paints of exactly the target frame. */
  exactDraws: number;
  /** Paints of a neighbour of the target frame (draws = exactDraws + fallbackDraws). */
  fallbackDraws: number;
  /** Sum over fallback paints of |painted − target|. */
  fallbackDistance: number;
  /** Clock ticks processed (each call of the engine's onReel). */
  ticks: number;
  /** Ticks after which the canvas did not show the target frame of the target segment. */
  staleTicks: number;
  /** Total time spent stale, in ms. */
  staleMs: number;
  /** Longest continuous stale stretch, in ms: from its first stale tick to the moment the canvas shows the target again. */
  staleMsMax: number;
  /** Times draw() declined to paint because a frame nearer the target was still coming. */
  held: number;
  /** Canvas backing-store reallocations (a resize that changes canvas.width or canvas.height). */
  canvasResizes: number;
  /** Calls of the engine's measure() (each a batch of layout reads). */
  measures: number;
  /** The segment and frame the clock wants now. */
  targetSeg: number;
  targetFrame: number;
  /** The segment, its film's name and the frame on the canvas now (−1 / "" before a paint and after a resize clears it). */
  paintedSeg: number;
  paintedFilm: string;
  paintedFrame: number;
  /** Tier width of the painted frame (0 before a paint). */
  width: number;
};

/** The stale-stretch clock: when the open stretch began (−1: none open) and when the previous tick ran (−1: none yet). */
export type StaleClock = { since: number; last: number };

export function newFilmStats(mode = "legacy"): FilmStats {
  return {
    mode,
    requests: 0,
    refetches: 0,
    decodes: 0,
    failures: 0,
    inflightPeak: 0,
    inflight: 0,
    framesAlive: 0,
    framesAlivePeak: 0,
    decodedBytes: 0,
    decodedMB: 0,
    decodedMBPeak: 0,
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
    paintedSeg: -1,
    paintedFilm: "",
    paintedFrame: -1,
    width: 0,
  };
}

export function newStaleClock(): StaleClock {
  return { since: -1, last: -1 };
}

/**
 * Zero the counters before a measured pass. Gauges keep their values and the peaks restart from them; an open
 * stale stretch restarts at `now`, so nothing before the reset is counted.
 */
export function resetFilmStats(s: FilmStats, clock: StaleClock, now: number): void {
  s.requests = 0;
  s.refetches = 0;
  s.decodes = 0;
  s.failures = 0;
  s.inflightPeak = s.inflight;
  s.framesAlivePeak = s.framesAlive;
  s.decodedMBPeak = s.decodedMB;
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

/** A canvas paint of frame `painted` while the target is `target`. */
export function countDraw(s: FilmStats, painted: number, target: number): void {
  s.draws++;
  if (painted === target) {
    s.exactDraws++;
  } else {
    s.fallbackDraws++;
    s.fallbackDistance += Math.abs(painted - target);
  }
}

/**
 * One clock tick, after the tick's draw(): `stale` when the canvas does not show the target frame of the target
 * segment. The time since the previous tick counts as stale when that tick left the canvas stale; a stretch runs
 * from its first stale tick until a tick (or recoverStale) finds the target on the canvas.
 */
export function tickStale(s: FilmStats, clock: StaleClock, stale: boolean, now: number): void {
  s.ticks++;
  if (clock.since >= 0 && clock.last >= 0) s.staleMs += now - clock.last;
  if (stale) {
    s.staleTicks++;
    if (clock.since < 0) clock.since = now;
  }
  if (clock.since >= 0 && now - clock.since > s.staleMsMax) s.staleMsMax = now - clock.since;
  if (!stale) clock.since = -1;
  clock.last = now;
}

/**
 * The canvas has just painted the target outside a tick (a frame arrived while the clock was at rest): the open
 * stretch ends now rather than at the next tick, which may be long after the viewer stopped scrolling.
 */
export function recoverStale(s: FilmStats, clock: StaleClock, now: number): void {
  if (clock.since < 0) return;
  if (clock.last >= 0) s.staleMs += now - clock.last;
  if (now - clock.since > s.staleMsMax) s.staleMsMax = now - clock.since;
  clock.since = -1;
  clock.last = now;
}

declare global {
  interface Window {
    __filmStats?: FilmStats;
    __filmStatsReset?: () => void;
  }
}

type Instrument = {
  stats: FilmStats;
  clock: StaleClock;
  /** `film/width/index` of every frame requested in this page load (refetches). */
  requested: Set<string>;
};
let instrument: Instrument | null = null;

/**
 * The page's one instrument, created on first use and published on `window`. Client only: call it from an
 * effect, never during render. It outlives the engine's effect (a re-run, a client navigation), as the page
 * load does.
 */
export function filmInstrument(): Instrument {
  if (!instrument) {
    const inst: Instrument = { stats: newFilmStats(), clock: newStaleClock(), requested: new Set() };
    instrument = inst;
    window.__filmStats = inst.stats;
    window.__filmStatsReset = () => resetFilmStats(inst.stats, inst.clock, performance.now());
  }
  return instrument;
}

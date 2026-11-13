/**
 * The network class, shared by every frame loader (legacy.ts and the budget loader) and by FilmBackdrop: Save-Data,
 * a slow connection by navigator.connection, and, where the browser has no navigator.connection (Safari), a slow
 * network judged from the time the first hero frames took. Pure, apart from `readConnection`.
 *
 * What "slow" means for the film: every segment not yet started moves to the smallest tier (at the next segment
 * boundary, never mid-segment) and fewer requests are in flight.
 */

/** navigator.connection, where the browser has one (Chromium). */
export type ConnectionInfo = { saveData?: boolean; effectiveType?: string; rtt?: number; downlink?: number };

/** Requests in flight at once on a fast network. */
export const FAST_INFLIGHT = 6;
/** Requests in flight at once on a slow network or with Save-Data on. */
export const SLOW_INFLIGHT = 3;
/** Without navigator.connection: the first this-many hero frames are timed… */
export const TIMED_FRAMES = 8;
/** …and a median above this (ms) makes the network slow. */
export const SLOW_FRAME_MS = 400;

/** The page's navigator.connection, or undefined where the browser has none. Client only. */
export function readConnection(nav: Navigator): ConnectionInfo | undefined {
  return (nav as Navigator & { connection?: ConnectionInfo }).connection;
}

/** The visitor asked for less data (Save-Data): the smallest tier, no breathing tails, fewer requests. */
export function saveDataOn(connection: ConnectionInfo | undefined): boolean {
  return connection?.saveData === true;
}

/**
 * A slow network by the browser's own class (2g, slow-2g, 3g), or a 4g link that is both laggy and thin. Not by
 * downlink alone: Chrome's first estimate reads 1.45–1.75 Mb/s on fast connections too (and never moves for
 * localhost), and it reports rtt 0 on fast links, so downlink alone must never decide. False without a connection
 * object (then the hero frames are timed: `heroTimesSlow`).
 */
export function connectionSlow(connection: ConnectionInfo | undefined): boolean {
  return (
    !!connection &&
    (["slow-2g", "2g", "3g"].includes(connection.effectiveType ?? "") ||
      ((connection.rtt ?? 0) >= 100 && (connection.downlink ?? Infinity) < 2))
  );
}

/** Requests in flight at once for this network class. */
export function maxInflightFor(saveData: boolean, slow: boolean): number {
  return saveData || slow ? SLOW_INFLIGHT : FAST_INFLIGHT;
}

/**
 * The timed hero frames (ms each, in arrival order) say the network is slow: TIMED_FRAMES of them have been timed
 * and their median is above SLOW_FRAME_MS. False with fewer samples. Does not sort `times` in place.
 */
export function heroTimesSlow(times: readonly number[]): boolean {
  if (times.length < TIMED_FRAMES) return false;
  const sorted = times.slice(0, TIMED_FRAMES).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return (sorted[mid - 1] + sorted[mid]) / 2 > SLOW_FRAME_MS;
}

/**
 * Where frames come from a pack (no per-frame fetch to time): the hero pack's first read delivered `frames` frames in
 * `ms` since its request started. Slow when that is slower than per-frame fetches taking SLOW_FRAME_MS each, FAST_INFLIGHT
 * at a time (TIMED_FRAMES frames or more needed; fewer: undecided, false).
 */
export function packTimesSlow(ms: number, frames: number): boolean {
  if (frames < TIMED_FRAMES || !(ms > 0)) return false;
  return ms / Math.ceil(frames / FAST_INFLIGHT) > SLOW_FRAME_MS;
}

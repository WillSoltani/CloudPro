import type { JoinOptions } from "./types";

/**
 * The frames a segment ever shows on this page load, and so the only ones any loader may fetch or decode: the move
 * (0 … M); tail frames (after M) only while tails play, and only the even ones on coarse pointers; under reduced
 * motion only the stills. One rule for every loader (legacy.ts, the budget planner) and for the counters (filmStats
 * `aimAt`, through `FrameLoader.usable`), so a frame never loaded by design is never counted as lag.
 *
 * Pure. `i` is not range-checked: callers keep it within 0 … count − 1.
 */
export function isUsable(opts: JoinOptions, i: number): boolean {
  const end = opts.moveEnd;
  const stills = opts.reducedStills;
  if (stills) {
    for (const k of stills) if (k === i) return true;
    return false;
  }
  return i <= end || (opts.tailFrames > 0 && (!opts.evenTailOnly || (i - end) % 2 === 0));
}

import type { JoinOptions } from "./types";
import { isUsable } from "./usable";
import { bytesCapFor, bytesDropOrder, maxDecodesFor, tierFrameBytes, wantedBytesOf } from "./budget-bytes";
import {
  B_DEAD,
  B_FETCHING,
  B_HELD,
  B_NONE,
  DIRECTION_FRAMES,
  holdSlotsOf,
  LEVEL_ALL,
  LEVEL_HOLD,
  LEVEL_NONE,
  LEVEL_SKELETON,
  PACK_RETRY_MS,
  PACK_TRIES,
  PackState,
  REACH_SLOTS,
  BEHIND_FRAMES,
  type PackHintSizes,
} from "./pack-plan";

/**
 * The budget loader's planner: which frames' compressed bytes to fetch, in what order; which frames to decode, within
 * a byte budget; which decoded frames to let go. Synchronous and pure in the sense that matters here: no DOM, no
 * fetch, no worker, no timers, no clock of its own (the caller passes `now`). The loader (fetches, the worker,
 * ImageBitmaps, the counters) is built on top of it; the planner only keeps per-frame states in typed arrays and
 * answers "what next".
 *
 * THE MODEL (docs: the stage-4 plan, design points A to D)
 * - Three stores per segment (one film at one tier): compressed bytes (fetched once and kept, capped in total at
 *   `bytesCapBytes`, the farthest films' bytes dropped first), decoded frames (inside `budgetBytes`), and the plan.
 *   A frame that leaves the decoded store keeps its bytes: coming back costs a decode, never a request.
 * - The wanted set, rebuilt by `want()` on each clock tick (only when its inputs changed): the target (its nearest
 *   usable frame or frames), the always-kept frames (the active segment's 0, M and last, and the entry frame of each
 *   neighbour), a window of usable frames around the target sized from the budget (`HEADROOM` of it), AHEAD_SHARE of
 *   it ahead in the direction of travel (half and half at rest), and, with what remains, the head of the next segment
 *   in the direction of travel from its entry frame outward. Decode order: target, the window's coarse frames
 *   (index % COARSE === 0) nearest first (behind weighs more when moving), the kept frames, the window's other frames,
 *   the next head coarse then fine.
 * - Decodes happen only for wanted frames whose bytes are held, at most `maxDecodes` at once; a decode reserves its
 *   decoded size when it starts. Making room evicts only frames outside the wanted set, other segments' first
 *   (farthest segment first), then the active segment's farthest from the target. So decoded + reserved never passes
 *   the budget, a near frame is never pushed out by a far one, and an always-kept frame is never evicted.
 * - The fetch order (bytes only), rebuilt when the active segment changes, the target leaps (more than 4 x the
 *   segment's tolerance from where it was ranked), the direction of travel flips, the visitor engages, a segment
 *   becomes near or not, or a segment joins, leaves or retiers: the active segment's target, M, last and 0, then its
 *   usable frames coarse to fine (strides 16, 8, 4, 2, 1) ahead first in the direction of travel (nearest first at
 *   rest) down to stride 4, then the head of the neighbour ahead (its entry, 0, M, last and every 4th frame over
 *   NEXT_HEAD_FRAMES from the entry), then the active segment's strides 2 and 1, then the neighbour ahead and the
 *   neighbour behind (entry, 0, M, last, then coarse to fine outward from the entry); segments farther away fetch only
 *   0, M and last. Before the visitor engages (the idle gate) only the active
 *   segment's stride-4 skeleton with 0, M and last, and segment active + 1's 0, M and last. Only near segments fetch.
 *   The current target is always tried first. A started fetch is never aborted; at most `maxFetches` at once. A
 *   failed fetch is retried after RETRY_BASE_MS, then twice that; after FETCH_TRIES tries the frame is missing (its
 *   neighbours cover it) until `forgive()` (the network came back).
 *
 * HOW A LOADER DRIVES IT
 * - Setup: `createBudgetPlanner({ budgetBytes, maxFetches, engaged, onEvict, onBytesDropped })`; `join` each segment
 *   (count, tier width, aspect, JoinOptions); `setNear` from the IntersectionObserver; `engage()` once the visitor
 *   scrolls; `setMaxFetches` when the network turns out slow; `retier(index, width)` for a slow-network retier.
 * - Per clock tick: `want(active, frame, direction, entry)` (the WantPlan's fields; the planner calls `entry` for the
 *   two neighbours during the call and keeps nothing), then pump.
 * - Pump (after a tick and after every arrival or failure): `while ((job = nextFetch(now)) !== NONE)` start a fetch
 *   of `jobSeg(job)`, `jobFrame(job)` and remember `epoch(seg)` with it; `while ((job = nextDecode(now)) !== NONE)` start
 *   a decode from the held bytes, remembering the epoch. `nextDecode` may evict: it calls `onEvict(seg, frame, bytes)`
 *   synchronously for each frame let go (close its ImageBitmap, report `dropped`).
 * - Per arrival: `fetched(seg, frame, epoch, size)` (false: the segment left or retiered, discard the bytes);
 *   `decoded(seg, frame, epoch)` (false: close the bitmap, it is stale); then notify the canvas and pump.
 * - Per failure: `fetchFailed` / `decodeFailed` (true when the frame is now missing for good: report it once); when
 *   `nextRetryAt()` is finite, set one timer to pump then. A failed decode keeps the bytes and is retried the same
 *   way (no fetch try spent); `decodeErrorStreak` counts the frames that failed since the last decode that worked,
 *   so the loader can tell a decoder that cannot decode at all and move to another (`forgetBytes` starts it afresh).
 * - The cap: `fetched` may drop other segments' bytes and calls `onBytesDropped(seg, frame, size)` for each (the
 *   store, or the worker, deletes them).
 * - Reads for draw(): `nearestDecoded`, `isComing`, `loaded`, `width`, `usable`.
 * - Page state: `setPaused(true)` while the document is hidden (nothing starts), `setOffline(true)` while offline (no
 *   fetch starts), `forgive()` when the network returns (missing frames get fresh tries).
 */

export const NONE = -1;
/** Fetch passes over a segment's usable frames, coarse to fine. */
export const STRIDES: readonly number[] = [16, 8, 4, 2, 1];
/** The idle gate: before the visitor engages, the active segment fetches only every ENGAGE_STRIDE-th frame. */
export const ENGAGE_STRIDE = 4;
/**
 * The head of the film ahead fetched right after the active film's coarse passes (strides 16, 8, 4): its entry, 0, M and
 * last, then every ENGAGE_STRIDE-th frame over this many frames from the entry. Crossing into it then finds its first
 * frames even when the active film's fine passes are still running (measured on the slow phone, 2026-11-13: the longest
 * stale stretch began where one film hands over to the next, the next film's first frames still queued).
 */
export const NEXT_HEAD_FRAMES = 32;
/** The wanted window decodes every COARSE-th frame (by index) before the frames between them. */
export const COARSE = 4;
/** Share of the window ahead of the target in the direction of travel (at rest: 0.5). */
export const AHEAD_SHARE = 0.7;
/** A failed fetch is retried after this, then twice this; FETCH_TRIES tries in all. */
export const RETRY_BASE_MS = 400;
export const FETCH_TRIES = 3;

const FRAME_BITS = 65536;
/** A job: segment and frame in one number (frames < 65536). */
export const packJob = (seg: number, frame: number) => seg * FRAME_BITS + frame;
export const jobSeg = (job: number) => Math.floor(job / FRAME_BITS);
export const jobFrame = (job: number) => job % FRAME_BITS;

// Compressed bytes of a frame: B_NONE, B_FETCHING, B_HELD, B_DEAD (./pack-plan.ts, shared with the pack plan).
// Decoded frame.
const D_NONE = 0;
const D_DECODING = 1;
const D_HELD = 2;

export type PlannerConfig = {
  /** Decoded-frame budget, bytes (budget-bytes.ts pickFrameBudgetBytes, or the `?budget=` override). */
  budgetBytes: number;
  /** Compressed bytes kept at most; default bytesCapFor(budgetBytes). */
  bytesCapBytes?: number;
  /** Fetches in flight at most (network.ts maxInflightFor). */
  maxFetches: number;
  /** Decodes at once at most; default maxDecodesFor(budgetBytes). */
  maxDecodes?: number;
  /** The visitor has engaged already (the idle gate is open). */
  engaged: boolean;
  /** A decoded frame leaves the store (eviction, leave, retier): close its ImageBitmap. */
  onEvict?(seg: number, frame: number, bytes: number): void;
  /** Compressed bytes are let go (the cap, bad bytes, leave, retier): delete them. */
  onBytesDropped?(seg: number, frame: number, size: number): void;
  /** Pack reads open at once at most (stage 7; default 2, 1 on a slow network or with Save-Data). */
  maxPackReads?: number;
};

/** What `nextPackOp` asks the loader to do (outputs in `packOp`). */
export const PACK_OPEN = 1;
export const PACK_TO = 2;
export const PACK_STOP = 3;
export const PACK_FORGET = 4;
/** How a pack read ended (`packEnded`). */
export const READ_OK = 0;
export const READ_CANCELLED = 1;
export const READ_RETRY = 2;
export const READ_FINAL = 3;
/** `to` of a read while the layout is unknown (./frame-worker-protocol.ts PACK_TO_*). */
const TO_SKELETON = -1;
const TO_HOLD = -2;
const TO_END = -3;

/**
 * Why a frame is not on the canvas yet (`waitReason`, the stale-stretch locator in the counters): from "decoded" (not
 * waiting) to "not planned" (nothing will bring it).
 */
export const WAIT_REASONS = [
  "decoded",
  "decoding",
  "bytes held, decode not started",
  "file fetch running",
  "file fetch queued",
  "pack read open",
  "pack read queued",
  "not planned",
  "given up",
  "segment not joined",
] as const;

/** What the planner has done since it was created (tests, and the loader's counters). */
export type PlannerCounters = {
  /** Fetches started, and those of a frame whose bytes had been fetched before (after a cap drop). */
  fetches: number;
  refetches: number;
  /** Decodes started, and those of a frame decoded before (from kept bytes). */
  decodes: number;
  redecodes: number;
  /** Decoded frames let go to make room. */
  evictions: number;
  /** Frames whose compressed bytes were dropped under the cap. */
  bytesDropped: number;
  /** Frames given up as missing (FETCH_TRIES tries spent). */
  missing: number;
  /** Pack reads opened; frames whose bytes came from a pack; packs given up (their films load frame by frame). */
  packReads: number;
  packFrames: number;
  packFailures: number;
};

class Seg {
  readonly usableMask: Uint8Array;
  readonly bytes: Uint8Array;
  readonly size: Uint32Array;
  readonly tries: Uint8Array;
  /** Fetch retries while the bytes are not held; decode retries while they are (fetched() clears it). */
  readonly retryAt: Float64Array;
  /** Decodes of the bytes held that failed (not fetch tries: the bytes arrived). */
  readonly decodeTries: Uint8Array;
  readonly dec: Uint8Array;
  readonly fetchedEver: Uint8Array;
  readonly decodedEver: Uint8Array;
  readonly wantStamp: Uint32Array;
  readonly orderStamp: Uint32Array;
  readonly frameBytes: number;
  readonly moveEnd: number;
  readonly last: number;
  decodedCount = 0;
  near = false;
  /** The film's pack at this tier (stage 7), or null: frames are fetched one file each. */
  pack: PackState | null = null;
  constructor(
    readonly index: number,
    readonly count: number,
    readonly width: number,
    readonly aspect: number,
    readonly opts: JoinOptions,
    readonly epoch: number,
  ) {
    this.usableMask = new Uint8Array(count);
    for (let i = 0; i < count; i++) this.usableMask[i] = isUsable(opts, i) ? 1 : 0;
    this.bytes = new Uint8Array(count);
    this.size = new Uint32Array(count);
    this.tries = new Uint8Array(count);
    this.retryAt = new Float64Array(count);
    this.decodeTries = new Uint8Array(count);
    this.dec = new Uint8Array(count);
    this.fetchedEver = new Uint8Array(count);
    this.decodedEver = new Uint8Array(count);
    this.wantStamp = new Uint32Array(count);
    this.orderStamp = new Uint32Array(count);
    this.frameBytes = tierFrameBytes(width, aspect);
    this.moveEnd = Math.min(count - 1, Math.max(0, opts.moveEnd));
    this.last = count - 1;
  }
  usable(i: number): boolean {
    return i >= 0 && i < this.count && this.usableMask[i] === 1;
  }
  /** Nearest usable frame to `i`, the lower on a tie (−1: none). */
  snap(i: number): number {
    const c = Math.min(this.count - 1, Math.max(0, i));
    for (let d = 0; d < this.count; d++) {
      if (this.usable(c - d)) return c - d;
      if (this.usable(c + d)) return c + d;
    }
    return -1;
  }
}

export type BudgetPlanner = ReturnType<typeof createBudgetPlanner>;

export function createBudgetPlanner(config: PlannerConfig) {
  const budgetBytes = config.budgetBytes;
  const wantedBytes = wantedBytesOf(budgetBytes);
  const bytesCapBytes = config.bytesCapBytes ?? bytesCapFor(budgetBytes);
  let maxFetches = config.maxFetches;
  const maxDecodes = config.maxDecodes ?? maxDecodesFor(budgetBytes);
  let engaged = config.engaged;

  const segs: (Seg | undefined)[] = [];
  let epochs = 0;
  const counters: PlannerCounters = {
    fetches: 0,
    refetches: 0,
    decodes: 0,
    redecodes: 0,
    evictions: 0,
    bytesDropped: 0,
    missing: 0,
    packReads: 0,
    packFrames: 0,
    packFailures: 0,
  };

  let used = 0; // decoded bytes held
  let reserved = 0; // decoded bytes reserved by decodes in flight
  let bytesHeld = 0; // compressed bytes held
  let fetchesInFlight = 0;
  let decodesInFlight = 0;
  let paused = false;
  let offline = false;
  /** Frames whose decode failed (each counted once) since the last decode that worked. */
  let decodeErrorStreak = 0;
  /** Reservations of decodes whose segment left or retiered meanwhile, by `epoch/frame`. */
  const orphans = new Map<string, number>();

  // The plan: the last want() inputs. active −1: none yet (or rerank()).
  let active = -1;
  let target = 0;
  let targetLo = -1;
  let targetHi = -1;
  let dir = 0;
  /** Entry frame (snapped usable) of each segment for the current plan; −1: not a neighbour. */
  let entryOf: Int32Array = new Int32Array(16).fill(-1);
  let wantDirty = true;

  // The wanted set: stamp generation and the decode order.
  let wantGen = 0;
  let wantList: Int32Array = new Int32Array(64);
  let wantLen = 0;
  // Scratch for building it (reused).
  let bufA: Int32Array = new Int32Array(64);
  let bufB: Int32Array = new Int32Array(64);
  let bufN: Int32Array = new Int32Array(64);
  const keep = new Int32Array(8);

  // The fetch order.
  let orderGen = 0;
  let order: Int32Array = new Int32Array(64);
  let orderLen = 0;
  let cursor = 0;
  let orderDirty = true;
  let rankedAt = 0;
  let rankedDir = 0;
  let retryWake = Infinity;
  const dropScratch = new Int32Array(64);
  const segIndices: number[] = [];

  // The pack plan (stage 7): which pack reads run, from where to where.
  let maxPackReads = Math.max(1, config.maxPackReads ?? 2);
  let packDirty = true;
  /** Segments with a pack (failed or not): 0 means the pack plan never runs. */
  let packSegs = 0;
  /** The direction the pack plan reads ahead in, with hysteresis (DIRECTION_FRAMES), and where it was last confirmed. */
  let packDir = 1;
  let anchorSeg = -1;
  let anchorFrame = 0;
  /** The target leapt (a jump inside a segment, or more than one segment): the active film's read may re-aim. */
  let packJumped = false;
  let readSeq = 0;
  // The plan's work list (segment, level), in priority order, and the two reads it ranks.
  const itemSeg = new Int32Array(64);
  const itemLevel = new Uint8Array(64);
  let itemLen = 0;
  const rankSeg = new Int32Array(2).fill(-1);
  /** What `nextPackOp` asks for (reused). `to` < 0: symbolic, the layout being unknown. */
  const packOp = { seg: -1, id: 0, from: 0, to: 0, hold: 0, est: -1, url: "" };

  const grow = (a: Int32Array, need: number): Int32Array => {
    if (a.length >= need) return a;
    let n = a.length;
    while (n < need) n *= 2;
    const b = new Int32Array(n);
    b.set(a);
    return b;
  };
  const totalFrames = () => {
    let n = 0;
    for (const s of segs) if (s) n += s.count;
    return n;
  };
  const seg = (i: number) => (i >= 0 ? segs[i] : undefined);
  const wanted = (s: Seg, i: number) => s.wantStamp[i] === wantGen && wantGen > 0;

  // ---------------------------------------------------------------- the wanted set

  const stampWant = (s: Seg, i: number): boolean => {
    if (i < 0 || i >= s.count || !s.usableMask[i] || s.wantStamp[i] === wantGen) return false;
    s.wantStamp[i] = wantGen;
    return true;
  };
  const pushWant = (s: Seg, i: number) => {
    wantList[wantLen++] = packJob(s.index, i);
  };

  /**
   * Walk usable frames of `s` from `from` (exclusive) in direction `step`, collecting up to `n` not yet wanted into
   * `buf` (stamped as wanted); returns how many.
   */
  const collect = (s: Seg, from: number, step: number, n: number, buf: Int32Array, at: number): number => {
    let got = 0;
    for (let i = from + step; got < n && i >= 0 && i < s.count; i += step) {
      if (stampWant(s, i)) buf[at + got++] = i;
    }
    return got;
  };

  /** Emit window frames (ahead `a`, behind `b`, each nearest first) merged by weighted distance; coarse or fine ones. */
  const emitMerged = (s: Seg, aLen: number, bLen: number, share: number, coarse: boolean) => {
    let ia = 0;
    let ib = 0;
    const wa = 1 / share;
    const wb = 1 / (1 - share);
    while (ia < aLen || ib < bLen) {
      while (ia < aLen && (bufA[ia] % COARSE === 0) !== coarse) ia++;
      while (ib < bLen && (bufB[ib] % COARSE === 0) !== coarse) ib++;
      if (ia >= aLen && ib >= bLen) break;
      let takeA: boolean;
      if (ia >= aLen) takeA = false;
      else if (ib >= bLen) takeA = true;
      else {
        const ca = Math.abs(bufA[ia] - target) * wa;
        const cb = Math.abs(bufB[ib] - target) * wb;
        // A tie goes ahead when moving; at rest to the lower frame (behind, as the window leans down the page).
        takeA = ca < cb || (ca === cb && dir !== 0);
      }
      if (takeA) pushWant(s, bufA[ia++]);
      else pushWant(s, bufB[ib++]);
    }
  };

  let kept = 0;
  /** Adds an always-kept frame (if usable and not yet wanted); returns the bytes it costs. */
  const keepFrame = (t: Seg | undefined, i: number): number => {
    if (!t || i < 0 || !stampWant(t, i)) return 0;
    keep[kept++] = packJob(t.index, i);
    return t.frameBytes;
  };

  const buildWanted = () => {
    wantDirty = false;
    wantGen++;
    wantLen = 0;
    const s = seg(active);
    if (!s) return;
    wantList = grow(wantList, totalFrames() + 8);
    bufA = grow(bufA, s.count);
    bufB = grow(bufB, s.count);
    let room = wantedBytes;

    // The target: its nearest usable frame, both on a tie.
    if (targetLo >= 0 && stampWant(s, targetLo)) {
      pushWant(s, targetLo);
      room -= s.frameBytes;
    }
    if (targetHi >= 0 && stampWant(s, targetHi)) {
      pushWant(s, targetHi);
      room -= s.frameBytes;
    }
    // The always-kept frames (pushed after the window's coarse pass).
    kept = 0;
    room -= keepFrame(s, s.moveEnd);
    room -= keepFrame(s, s.last);
    room -= keepFrame(s, 0);
    room -= keepFrame(seg(active - 1), active >= 1 ? entryOf[active - 1] : -1);
    room -= keepFrame(seg(active + 1), entryOf[active + 1] ?? -1);

    // The window: n frames beyond the target, `share` of them ahead.
    const aheadDir = dir === 0 ? 1 : dir;
    const share = dir === 0 ? 0.5 : AHEAD_SHARE;
    const n = Math.max(0, Math.floor(room / s.frameBytes));
    const nAhead = Math.round(n * share);
    let bLen = collect(s, target, -aheadDir, n - nAhead, bufB, 0);
    const aLen = collect(s, target, aheadDir, n - bLen, bufA, 0);
    room -= (aLen + bLen) * s.frameBytes;
    // What the window could not use ahead (the segment ends) goes to the next segment's head; without one, behind.
    const next = seg(active + aheadDir);
    if (!next && n - aLen - bLen > 0) {
      const more = collect(s, bLen ? bufB[bLen - 1] : target, -aheadDir, n - aLen - bLen, bufB, bLen);
      bLen += more;
      room -= more * s.frameBytes;
    }

    emitMerged(s, aLen, bLen, share, true);
    for (let k = 0; k < kept; k++) wantList[wantLen++] = keep[k];
    emitMerged(s, aLen, bLen, share, false);

    // The next segment's head, from its entry frame outward, coarse first, with what remains.
    if (next && room >= next.frameBytes) {
      bufN = grow(bufN, next.count);
      const entry = entryOf[next.index] >= 0 ? entryOf[next.index] : aheadDir > 0 ? 0 : next.last;
      let nLen = 0;
      // The entry frame itself is kept (already wanted): the head continues from it.
      if (stampWant(next, entry)) bufN[nLen++] = entry;
      nLen += collect(next, entry, aheadDir, Math.floor(room / next.frameBytes) - nLen, bufN, nLen);
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < nLen; k++) if ((bufN[k] % COARSE === 0) === (pass === 0)) pushWant(next, bufN[k]);
      }
    }
  };

  // ---------------------------------------------------------------- the fetch order

  /** The segment's frames come from its pack (it has one that has not been given up). */
  const packed = (s: Seg) => s.pack !== null && !s.pack.failed;

  const pushOrder = (s: Seg, i: number) => {
    if (i < 0 || i >= s.count || !s.usableMask[i] || s.orderStamp[i] === orderGen || packed(s)) return;
    s.orderStamp[i] = orderGen;
    order[orderLen++] = packJob(s.index, i);
  };

  /** One stride pass over `s` around `from`: ahead first in `lean` (±1), or nearest first (lower on a tie) at 0. */
  const stridePass = (s: Seg, from: number, lean: number, stride: number) => {
    const up = Math.ceil(from / stride) * stride; // first multiple ≥ from
    const down = up - stride; // first multiple < from
    if (lean !== 0) {
      const aStart = lean > 0 ? up : from % stride === 0 ? from : down;
      for (let i = aStart; i >= 0 && i < s.count; i += lean * stride) pushOrder(s, i);
      for (let i = lean > 0 ? down : aStart + stride; i >= 0 && i < s.count; i -= lean * stride) pushOrder(s, i);
      return;
    }
    let u = up;
    let d = down;
    while (u < s.count || d >= 0) {
      const du = u < s.count ? u - from : Infinity;
      const dd = d >= 0 ? from - d : Infinity;
      if (dd <= du) {
        pushOrder(s, d);
        d -= stride;
      } else {
        pushOrder(s, u);
        u += stride;
      }
    }
  };

  const fetchSegment = (s: Seg, from: number, lean: number, minStride: number) => {
    for (const stride of STRIDES) {
      if (stride < minStride) break;
      stridePass(s, from, lean, stride);
    }
  };

  const buildOrder = () => {
    orderDirty = false;
    orderGen++;
    orderLen = 0;
    cursor = 0;
    rankedAt = target;
    if (dir !== 0) rankedDir = dir;
    const s = seg(active);
    if (!s) return;
    order = grow(order, totalFrames() + 8);
    const aheadDir = dir === 0 ? 1 : dir;
    if (s.near) {
      pushOrder(s, targetLo);
      pushOrder(s, targetHi);
      pushOrder(s, s.moveEnd);
      pushOrder(s, s.last);
      pushOrder(s, 0);
      fetchSegment(s, target, dir, ENGAGE_STRIDE);
    }
    if (engaged) {
      // The head of the film ahead, then the active film's fine passes (strides 2 and 1).
      const nb = seg(active + aheadDir);
      if (nb?.near) {
        const entry = entryOf[nb.index] >= 0 ? entryOf[nb.index] : aheadDir > 0 ? 0 : nb.last;
        pushOrder(nb, entry);
        pushOrder(nb, 0);
        pushOrder(nb, nb.moveEnd);
        pushOrder(nb, nb.last);
        for (let k = ENGAGE_STRIDE; k <= NEXT_HEAD_FRAMES; k += ENGAGE_STRIDE) pushOrder(nb, entry + aheadDir * k);
      }
      if (s.near) fetchSegment(s, target, dir, 1);
    }
    if (!engaged) {
      const nx = seg(active + 1);
      if (nx?.near) {
        pushOrder(nx, 0);
        pushOrder(nx, nx.moveEnd);
        pushOrder(nx, nx.last);
      }
      return;
    }
    for (const side of [aheadDir, -aheadDir]) {
      const nb = seg(active + side);
      if (!nb?.near) continue;
      const entry = entryOf[nb.index] >= 0 ? entryOf[nb.index] : side > 0 ? 0 : nb.last;
      pushOrder(nb, entry);
      pushOrder(nb, 0);
      pushOrder(nb, nb.moveEnd);
      pushOrder(nb, nb.last);
      fetchSegment(nb, entry, side, 1);
    }
    // Farther segments: 0, M and last only, nearest first, ahead first.
    for (let d = 2; d < segs.length; d++) {
      for (const side of [aheadDir, -aheadDir]) {
        const far = seg(active + side * d);
        if (!far?.near) continue;
        pushOrder(far, 0);
        pushOrder(far, far.moveEnd);
        pushOrder(far, far.last);
      }
    }
  };

  const startFetch = (t: Seg, i: number) => {
    t.bytes[i] = B_FETCHING;
    fetchesInFlight++;
    counters.fetches++;
    if (t.fetchedEver[i]) counters.refetches++;
    return packJob(t.index, i);
  };
  /** A failed frame's retry is due (else the wake-up time is noted). */
  const due = (t: Seg, i: number, now: number) => {
    if (t.retryAt[i] <= now) return true;
    if (t.retryAt[i] < retryWake) retryWake = t.retryAt[i];
    return false;
  };
  /** The target frame `i` of the active segment is to be fetched before the order (the idle gate still applies). */
  const targetFirst = (s: Seg, i: number, now: number) =>
    i >= 0 &&
    !packed(s) &&
    s.bytes[i] === B_NONE &&
    (engaged || i % ENGAGE_STRIDE === 0 || i === 0 || i === s.moveEnd || i === s.last) &&
    due(s, i, now);

  // ---------------------------------------------------------------- eviction and the caps

  const evict = (s: Seg, i: number) => {
    s.dec[i] = D_NONE;
    s.decodedCount--;
    used -= s.frameBytes;
    config.onEvict?.(s.index, i, s.frameBytes);
  };

  /** The decoded frame to let go first: outside the wanted set, other segments' (farthest first), then the active one's farthest from the target. */
  const pickVictim = (): number => {
    let best = NONE;
    let bestScore = -1;
    for (const s of segs) {
      if (!s || s.decodedCount === 0) continue;
      const other = s.index !== active;
      const ref = other ? (s.index > active ? 0 : s.last) : target;
      const base = other ? 1e9 + Math.abs(s.index - active) * 1e6 : 0;
      for (let i = 0; i < s.count; i++) {
        if (s.dec[i] !== D_HELD || wanted(s, i)) continue;
        const score = base + Math.abs(i - ref);
        if (score > bestScore) {
          bestScore = score;
          best = packJob(s.index, i);
        }
      }
    }
    return best;
  };

  /** Make room for `bytes` more: evict outside the wanted set until decoded + reserved + bytes fits. */
  const reserve = (bytes: number): boolean => {
    while (used + reserved + bytes > budgetBytes) {
      const v = pickVictim();
      if (v === NONE) break;
      evict(segs[jobSeg(v)]!, jobFrame(v));
      counters.evictions++;
    }
    return used + reserved + bytes <= budgetBytes;
  };

  const dropBytes = (s: Seg, i: number) => {
    if (s.bytes[i] !== B_HELD) return;
    const size = s.size[i];
    bytesHeld -= size;
    s.size[i] = 0;
    s.bytes[i] = B_NONE;
    config.onBytesDropped?.(s.index, i, size);
  };

  /**
   * Over the compressed cap: the farthest segments give up their bytes first. Never the active segment's or its
   * neighbours' (their frames are in the fetch order: dropping them would fetch them again), never any segment's
   * 0, M and last (fetched for every near segment), never bytes a decode is reading.
   */
  const enforceCap = () => {
    if (bytesHeld <= bytesCapBytes) return;
    segIndices.length = 0;
    for (const s of segs) if (s) segIndices.push(s.index);
    const n = bytesDropOrder(segIndices, active, dir, dropScratch);
    for (let k = 0; k < n && bytesHeld > bytesCapBytes; k++) {
      const s = segs[dropScratch[k]]!;
      if (Math.abs(s.index - active) <= 1 && active >= 0) continue;
      // From the end farthest from the active segment.
      const fromEnd = s.index > active;
      for (let j = 0; j < s.count && bytesHeld > bytesCapBytes; j++) {
        const i = fromEnd ? s.last - j : j;
        if (i === 0 || i === s.moveEnd || i === s.last || s.dec[i] === D_DECODING) continue;
        if (s.bytes[i] !== B_HELD) continue;
        dropBytes(s, i);
        counters.bytesDropped++;
      }
    }
  };

  // ---------------------------------------------------------------- segments

  const release = (s: Seg) => {
    for (let i = 0; i < s.count; i++) {
      if (s.dec[i] === D_HELD) evict(s, i);
      else if (s.dec[i] === D_DECODING) {
        // The decode lands later and is closed; its reservation stands until then.
        orphans.set(`${s.epoch}/${i}`, s.frameBytes);
      }
      dropBytes(s, i);
    }
  };

  const ensureEntrySize = (index: number) => {
    if (entryOf.length > index + 1) return;
    let n = entryOf.length;
    while (n <= index + 1) n *= 2;
    const e = new Int32Array(n).fill(-1);
    e.set(entryOf);
    entryOf = e;
  };

  const setEntry = (k: number, entry: (index: number) => number) => {
    const t = seg(k);
    if (!t) return;
    const e = t.snap(entry(k));
    if (entryOf[k] !== e) {
      entryOf[k] = e;
      wantDirty = true;
    }
  };

  const dirty = () => {
    orderDirty = true;
    wantDirty = true;
  };

  const settleOrphan = (s: Seg | undefined, frame: number, epoch: number): boolean => {
    if (s && s.epoch === epoch) return false;
    // Epochs are unique for the planner's life, so epoch and frame name the reservation.
    const key = `${epoch}/${frame}`;
    const bytes = orphans.get(key);
    if (bytes !== undefined) {
      reserved -= bytes;
      orphans.delete(key);
    }
    return true;
  };


  // ---------------------------------------------------------------- the pack plan (stage 7)

  /** A segment's pack when it may be read now: it has one, not given up, and the segment is near. */
  const readablePack = (s: Seg | undefined): PackState | null => (s && s.near && s.pack && !s.pack.failed ? s.pack : null);

  /** End byte of `level` (layout known). */
  const levelEnd = (p: PackState, level: number) =>
    level === LEVEL_HOLD ? p.holdEnd : level === LEVEL_SKELETON ? p.skeletonEnd : p.usableEnd;

  /** Every frame up to `level` has its bytes (layout known; unknown: not done). */
  const levelDone = (s: Seg, p: PackState, level: number) => p.known && p.firstMissingSlot(0, levelEnd(p, level), s.bytes) < 0;

  const addItem = (s: Seg | undefined, level: number) => {
    const p = readablePack(s);
    if (!p || levelDone(s!, p, level) || itemLen >= itemSeg.length) return;
    if (p.goal < level) p.goal = level;
    itemSeg[itemLen] = s!.index;
    itemLevel[itemLen] = level;
    itemLen++;
  };

  /** The level a frame of `s` belongs to in its pack: the hold frames, the skeleton, or the rest (same rule as packOrder). */
  const frameLevel = (s: Seg, i: number) =>
    i === 0 || i === s.moveEnd || i === s.last ? LEVEL_HOLD : i < s.moveEnd && i % 4 === 0 ? LEVEL_SKELETON : LEVEL_ALL;

  /** Where the rest of `s` is read from: the target in the active segment, else the end the visitor enters it from. */
  const restFrom = (s: Seg): number => {
    const p = s.pack!;
    if (s.index === active) return p.restStart(target, dir !== 0 && packDir < 0 ? -1 : 1, s.bytes, s.usableMask);
    return s.index > active ? p.restStart(0, 1, s.bytes, s.usableMask) : p.restStart(s.last, -1, s.bytes, s.usableMask);
  };

  /** The byte range the read of `s` should cover for `level` (into p.wantFrom / p.wantTo); false: nothing to read. */
  const rangeFor = (s: Seg, p: PackState, level: number): boolean => {
    if (!p.known) {
      p.wantFrom = 0;
      p.wantTo = level === LEVEL_HOLD ? TO_HOLD : level === LEVEL_SKELETON ? TO_SKELETON : TO_END;
      return true;
    }
    const end = levelEnd(p, level);
    if (p.rangeless) {
      // The server sends the whole file from byte 0 whatever is asked: one read from 0, as far as the level goes.
      p.wantFrom = 0;
      p.wantTo = end;
      return true;
    }
    // The hold frames and the skeleton first (they are the start of the file), then the rest from where it is needed.
    let slot = p.firstMissingSlot(0, level === LEVEL_ALL ? p.skeletonEnd : end, s.bytes);
    if (slot < 0 && level === LEVEL_ALL) {
      const f = restFrom(s);
      slot = f >= 0 ? p.frameSlot![f] : -1;
    }
    if (slot < 0) return false;
    p.wantFrom = p.slotOff![slot];
    p.wantTo = p.stopFor(slot, end, s.bytes);
    return true;
  };

  /**
   * The work list and the two reads it ranks (design E). Before the visitor engages: the active film through its
   * skeleton only (the idle gate; the per-frame gate fetches the same frames). Once engaged: the active film's skeleton,
   * the skeleton of the film ahead in the direction of travel, the active film to its end, the film ahead to its end,
   * the skeleton of the film behind, the hold frames of farther near films, and last the film behind to its end. With
   * one read at a time (a slow network, Save-Data) the active film is read to its end before any other.
   * Read 1 takes the first item's film and runs on through that film's later items as long as no other film's
   * full read comes between; read 2 (when two may run) takes the first hold or skeleton item of another film.
   */
  const buildPackPlan = () => {
    packDirty = false;
    itemLen = 0;
    rankSeg[0] = rankSeg[1] = -1;
    for (const t of segs) {
      const p = t?.pack;
      if (!p) continue;
      p.goal = LEVEL_NONE;
      p.rank = -1;
      p.level = LEVEL_NONE;
    }
    const a = seg(active);
    if (!a) return;
    if (!engaged) {
      addItem(a, LEVEL_SKELETON);
    } else {
      const ahead = seg(active + packDir);
      const behind = seg(active - packDir);
      if (maxPackReads <= 1) {
        addItem(a, LEVEL_SKELETON);
        addItem(a, LEVEL_ALL);
        addItem(ahead, LEVEL_SKELETON);
        addItem(ahead, LEVEL_ALL);
      } else {
        addItem(a, LEVEL_SKELETON);
        addItem(ahead, LEVEL_SKELETON);
        addItem(a, LEVEL_ALL);
        addItem(ahead, LEVEL_ALL);
      }
      addItem(behind, LEVEL_SKELETON);
      for (let d = 2; d < segs.length; d++) {
        addItem(seg(active + packDir * d), LEVEL_HOLD);
        addItem(seg(active - packDir * d), LEVEL_HOLD);
      }
      addItem(behind, LEVEL_ALL);
    }
    if (!itemLen) return;
    // Read 1.
    const r1 = itemSeg[0];
    let l1 = itemLevel[0];
    for (let k = 1; k < itemLen; k++) {
      if (itemSeg[k] === r1) l1 = Math.max(l1, itemLevel[k]);
      else if (itemLevel[k] === LEVEL_ALL || maxPackReads <= 1) break;
    }
    rankSeg[0] = r1;
    // Read 2: hold and skeleton reads of other films only, so full reads run one at a time, in order.
    let r2 = -1;
    let l2 = LEVEL_NONE;
    if (maxPackReads >= 2) {
      for (let k = 1; k < itemLen; k++) {
        const sk = itemSeg[k];
        if (sk === r1 || itemLevel[k] === LEVEL_ALL) continue;
        if (r2 < 0) r2 = sk;
        if (sk === r2) l2 = Math.max(l2, itemLevel[k]);
      }
    }
    rankSeg[1] = r2;
    for (let r = 0; r < 2; r++) {
      const t = seg(rankSeg[r]);
      if (!t) continue;
      const p = t.pack!;
      p.rank = r;
      p.level = r === 0 ? l1 : l2;
      if (!rangeFor(t, p, p.level)) {
        p.rank = -1;
        rankSeg[r] = -1;
      }
    }
  };

  /** The open read of `s` serves the plan as it is (else it stops, and a read opens where the plan wants it). */
  const keepRead = (s: Seg, p: PackState): boolean => {
    if (p.rank < 0) return false;
    if (!p.known || p.rangeless) return true;
    const cur = p.slotAt(p.readPos);
    // Where the plan wants the read now: its start, moved past what has arrived since the plan was made (the read's
    // own frames among it).
    const start = p.firstMissingSlot(p.slotAt(p.wantFrom), p.bytes + 1, s.bytes);
    if (start < 0) {
      packDirty = true; // nothing left from there: the plan moves on at the next call
      return true;
    }
    if (cur === start) {
      if (s.index === active && p.level === LEVEL_ALL && p.readPos >= p.skeletonEnd) packJumped = false;
      return true;
    }
    // A read a few slots short of where it should start, with nothing held between, reaches it anyway.
    if (cur < start && start - cur <= REACH_SLOTS && !p.heldBetween(cur, start, s.bytes)) return true;
    if (s.index !== active || p.level !== LEVEL_ALL || p.readPos < p.skeletonEnd) return false;
    // The active film's rest: re-aimed only when the visitor goes up, has leapt, or has stopped. Moving forward the
    // read keeps going in order (re-aiming would cost a request and win frames the visitor passes at once).
    if (dir > 0 && packDir > 0 && !packJumped) return true;
    // Going up, a read below the target serves the frames the visitor is about to reach: it runs until passed.
    if (packDir < 0 && dir < 0 && !packJumped) {
      const cf = p.slotFrame![Math.min(cur, p.count - 1)];
      return cf <= target && cf >= target - BEHIND_FRAMES - REACH_SLOTS;
    }
    return false;
  };

  /**
   * The pack plan's part of a clock tick (before `active`, `target` and `dir` take the new values): the direction it
   * reads ahead in (flipped only after DIRECTION_FRAMES of travel against it), leaps, and whether the plan is rebuilt.
   * Allocation-free.
   */
  const wantPacks = (act: number, f: number, d: number, s: Seg | undefined) => {
    if (act !== active) {
      packDirty = true;
      if (active >= 0 && Math.abs(act - active) > 1) packJumped = true;
    } else if (s && Math.abs(f - target) > 4 * s.opts.tolerance) {
      packDirty = true;
      packJumped = true;
    }
    if (d !== dir) packDirty = true;
    if (d !== 0) {
      if (d === packDir || anchorSeg < 0) {
        anchorSeg = act;
        anchorFrame = f;
        if (packDir !== d) {
          packDir = d;
          packDirty = true;
        }
      } else {
        const travel = act === anchorSeg ? f - anchorFrame : (act - anchorSeg) * 65536;
        if (Math.sign(travel) === d && Math.abs(travel) >= DIRECTION_FRAMES) {
          packDir = d;
          anchorSeg = act;
          anchorFrame = f;
          packDirty = true;
        }
      }
    }
    // Going up, the active film's read has fallen below the target: see whether it should re-aim.
    const p = s?.pack;
    if (p && p.readId && p.known && d < 0 && !packDirty) {
      const cf = p.slotFrame![Math.min(p.slotAt(p.readPos), p.count - 1)];
      if (cf > f) packDirty = true;
    }
  };

  /**
   * Before the layout is known, the end a bounded read asks for, from the manifest's hints (the request's closed range;
   * the read itself stops where the header says): the skeleton's end, or the hold frames' end at twice the mean frame.
   * −1: to the end of the file (or no hints).
   */
  const estimateEnd = (s: Seg, p: PackState): number => {
    const h = p.hint;
    if (p.known || p.rangeless || !(h.bytes > 0) || p.wantTo === TO_END) return -1;
    if (p.wantTo === TO_SKELETON) return h.skeletonEnd;
    const mean = (h.bytes - h.header) / Math.max(1, s.count);
    return Math.min(h.bytes, Math.max(h.header + 1, Math.ceil(h.header + p.holdSlots * 2 * mean)));
  };

  /** Give the pack of `s` up: its film loads frame by frame from now on (frames it delivered stay). */
  const failPack = (s: Seg, reason: string) => {
    const p = s.pack;
    if (!p || p.failed) return;
    p.failed = true;
    p.failReason = reason;
    p.forgetPending = true;
    counters.packFailures++;
    packDirty = true;
    // Its missing frames join the per-frame fetch order now (not at the next leap or segment change).
    orderDirty = true;
    if (active >= 0) buildOrder();
  };

  return {
    budgetBytes,
    wantedBytes,
    bytesCapBytes,
    maxDecodes,
    counters,

    get maxFetches() {
      return maxFetches;
    },
    get usedBytes() {
      return used;
    },
    get reservedBytes() {
      return reserved;
    },
    get bytesHeld() {
      return bytesHeld;
    },
    get fetchesInFlight() {
      return fetchesInFlight;
    },
    get decodesInFlight() {
      return decodesInFlight;
    },
    /**
     * Distinct frames whose decode failed since the last decode that worked (a frame's retries are not counted again):
     * the loader's sign that the decoder itself cannot decode these frames (budget.ts DECODE_FALLBACK_ERRORS).
     */
    get decodeErrorStreak() {
      return decodeErrorStreak;
    },

    /** Segment `index` joins: `count` frames of `aspect` at tier `width`, used as `opts` says. */
    join(index: number, count: number, width: number, aspect: number, opts: JoinOptions) {
      const old = segs[index];
      if (old) release(old);
      const s = new Seg(index, count, width, aspect, opts, ++epochs);
      if (old) s.near = old.near;
      segs[index] = s;
      ensureEntrySize(index);
      dirty();
      packDirty = true;
    },

    /** Segment `index` leaves: its decoded frames and bytes go (onEvict, onBytesDropped); fetches in flight land stale. */
    leave(index: number) {
      const s = segs[index];
      if (!s) return;
      release(s);
      if (s.pack) packSegs--;
      segs[index] = undefined;
      dirty();
      packDirty = true;
    },

    /** Segment `index` moves to tier `width` (a slow-network retier): like leave and join at the new width. */
    retier(index: number, width: number) {
      const s = segs[index];
      if (!s || s.width === width) return;
      release(s);
      const t = new Seg(index, s.count, width, s.aspect, s.opts, ++epochs);
      t.near = s.near;
      if (s.pack) packSegs--;
      segs[index] = t;
      dirty();
      packDirty = true;
    },

    setNear(index: number, near: boolean) {
      const s = segs[index];
      if (!s || s.near === near) return;
      s.near = near;
      orderDirty = true;
      packDirty = true;
      if (active >= 0) buildOrder();
    },

    /** The visitor has engaged: the idle gate opens (idempotent). */
    engage() {
      if (engaged) return;
      engaged = true;
      orderDirty = true;
      packDirty = true;
      if (active >= 0) buildOrder();
    },

    get engaged() {
      return engaged;
    },

    setMaxFetches(n: number) {
      maxFetches = n;
    },

    /** Pack reads open at once at most (1 on a slow network or with Save-Data). */
    setMaxPackReads(n: number) {
      maxPackReads = Math.max(1, n);
      packDirty = true;
    },

    get maxPackReads() {
      return maxPackReads;
    },

    /** The document is hidden: nothing starts until it is shown. */
    setPaused(p: boolean) {
      paused = p;
    },

    /** The browser is offline: no fetch starts. */
    setOffline(off: boolean) {
      offline = off;
    },

    /** The network came back: every frame given up or waiting for a retry gets fresh tries. */
    forgive() {
      for (const s of segs) {
        if (!s) continue;
        for (let i = 0; i < s.count; i++) {
          if (s.bytes[i] === B_DEAD) s.bytes[i] = B_NONE;
          s.tries[i] = 0;
          s.decodeTries[i] = 0;
          s.retryAt[i] = 0;
        }
        // A pack waiting out a retry tries again now (one given up stays given up: its frames come as files).
        if (s.pack) {
          s.pack.tries = 0;
          s.pack.retryAt = 0;
        }
      }
      retryWake = Infinity;
      orderDirty = true;
      packDirty = true;
      if (active >= 0) buildOrder();
    },

    /** Forget the plan: the next want() rebuilds the wanted set and the fetch order. */
    rerank() {
      active = -1;
      dirty();
      packDirty = true;
    },

    /**
     * One clock tick: segment `act` wants frame `frame`, travelling `direction` (1 down, −1 up, 0 at rest); `entry(i)`
     * is where the scroll enters segment i (called for the two neighbours during this call only).
     */
    want(act: number, frame: number, direction: number, entry: (index: number) => number) {
      const s = seg(act);
      const d = direction > 0 ? 1 : direction < 0 ? -1 : 0;
      const f = s ? Math.min(s.count - 1, Math.max(0, frame)) : frame;
      if (packSegs > 0) wantPacks(act, f, d, s);
      if (act !== active) dirty();
      else if (d !== 0 && d !== rankedDir) orderDirty = true;
      else if (s && Math.abs(f - rankedAt) > 4 * s.opts.tolerance) orderDirty = true;
      if (act !== active || f !== target || d !== dir) wantDirty = true;
      // Neighbours' entry frames (snapped to usable).
      setEntry(act - 1, entry);
      setEntry(act + 1, entry);
      if (active >= 0 && act !== active) {
        // Entries of segments that are no longer neighbours.
        for (const k of [active - 1, active, active + 1]) if (k >= 0 && Math.abs(k - act) > 1 && k < entryOf.length) entryOf[k] = -1;
      }
      if (act >= 0 && act < entryOf.length) entryOf[act] = -1;
      active = act;
      target = f;
      dir = d;
      if (s) {
        let lo = s.snap(f);
        let hi = lo;
        if (lo >= 0 && lo !== f) {
          // Two usable frames at the same distance on either side: both are the target.
          const dist = Math.abs(lo - f);
          if (lo < f && s.usable(f + dist)) hi = f + dist;
          else if (lo > f && s.usable(f - dist)) {
            hi = lo;
            lo = f - dist;
          }
        }
        targetLo = lo;
        targetHi = hi;
      } else {
        targetLo = targetHi = -1;
      }
      if (wantDirty) buildWanted();
      if (orderDirty) buildOrder();
    },

    /**
     * The next fetch to start (a job: jobSeg / jobFrame), or NONE. Marks it fetching. Tries the current target first,
     * then the fetch order. `now` decides which failed frames are due for a retry.
     */
    nextFetch(now: number): number {
      if (paused || offline || fetchesInFlight >= maxFetches) return NONE;
      const s = seg(active);
      if (s?.near) {
        if (targetFirst(s, targetLo, now)) return startFetch(s, targetLo);
        if (targetFirst(s, targetHi, now)) return startFetch(s, targetHi);
      }
      for (let k = cursor; k < orderLen; k++) {
        const job = order[k];
        const t = segs[jobSeg(job)];
        const i = jobFrame(job);
        if (!t || t.bytes[i] !== B_NONE) {
          if (k === cursor) cursor++;
          continue;
        }
        if (!due(t, i, now)) continue;
        if (k === cursor) cursor++;
        return startFetch(t, i);
      }
      return NONE;
    },

    /** The earliest time a failed frame is due for a retry (Infinity: none waiting). Reset by reading. */
    nextRetryAt(): number {
      const t = retryWake;
      retryWake = Infinity;
      return t;
    },

    /** A fetch landed with `size` compressed bytes. False: its segment left or retiered (discard the bytes). */
    fetched(segIndex: number, frame: number, epoch: number, size: number): boolean {
      fetchesInFlight--;
      const s = segs[segIndex];
      if (!s || s.epoch !== epoch) return false;
      s.bytes[frame] = B_HELD;
      s.size[frame] = size;
      s.fetchedEver[frame] = 1;
      s.retryAt[frame] = 0;
      bytesHeld += size;
      enforceCap();
      return true;
    },

    /**
     * A fetch failed. True when the frame is now missing (tries spent): report it once. `final`: the server answered
     * that the frame cannot be had (a 404), so no try is left.
     */
    fetchFailed(segIndex: number, frame: number, epoch: number, now: number, final = false): boolean {
      fetchesInFlight--;
      const s = segs[segIndex];
      if (!s || s.epoch !== epoch) return false;
      if (final) s.tries[frame] = FETCH_TRIES - 1;
      const tries = ++s.tries[frame];
      if (tries >= FETCH_TRIES) {
        s.bytes[frame] = B_DEAD;
        counters.missing++;
        return true;
      }
      s.bytes[frame] = B_NONE;
      s.retryAt[frame] = now + RETRY_BASE_MS * 2 ** (tries - 1);
      if (s.retryAt[frame] < retryWake) retryWake = s.retryAt[frame];
      // The scan passed it when the fetch started: start again from the top of the order, or the retry never comes.
      cursor = 0;
      return false;
    },

    /**
     * The next decode to start (a job), or NONE: the first wanted frame whose bytes are held and that is neither
     * decoded nor decoding, if its decoded size fits (evicting outside the wanted set; onEvict is called for each).
     * `now` decides which failed decodes are due for a retry.
     */
    nextDecode(now: number): number {
      if (paused || decodesInFlight >= maxDecodes) return NONE;
      for (let k = 0; k < wantLen; k++) {
        const job = wantList[k];
        const s = segs[jobSeg(job)];
        const i = jobFrame(job);
        if (!s || s.dec[i] !== D_NONE || s.bytes[i] !== B_HELD) continue;
        if (s.decodeTries[i] > 0 && !due(s, i, now)) continue;
        if (!reserve(s.frameBytes)) return NONE;
        s.dec[i] = D_DECODING;
        reserved += s.frameBytes;
        decodesInFlight++;
        counters.decodes++;
        if (s.decodedEver[i]) counters.redecodes++;
        return job;
      }
      return NONE;
    },

    /** A decode landed. False: its segment left or retiered meanwhile (close the bitmap). */
    decoded(segIndex: number, frame: number, epoch: number): boolean {
      decodesInFlight--;
      const s = segs[segIndex];
      if (settleOrphan(s, frame, epoch)) return false;
      s!.dec[frame] = D_HELD;
      s!.decodedEver[frame] = 1;
      s!.decodeTries[frame] = 0;
      decodeErrorStreak = 0;
      s!.decodedCount++;
      reserved -= s!.frameBytes;
      used += s!.frameBytes;
      return true;
    },

    /**
     * A decode failed. True when the frame is now missing: report it once.
     * - The decoder rejected the bytes (`bytesLost` false): no fetch try is spent and the bytes are kept; the decode is
     *   retried after RETRY_BASE_MS, then twice that, and after FETCH_TRIES failed decodes the bytes go and the frame
     *   is missing (its neighbours cover it), as a frame the legacy loader cannot decode. The frame's first failure
     *   adds to `decodeErrorStreak`.
     * - The store no longer had the bytes (`bytesLost`): they are fetched again, and that counts as a fetch try.
     */
    decodeFailed(segIndex: number, frame: number, epoch: number, now: number, bytesLost = false): boolean {
      decodesInFlight--;
      const s = segs[segIndex];
      if (settleOrphan(s, frame, epoch)) return false;
      s!.dec[frame] = D_NONE;
      reserved -= s!.frameBytes;
      if (!bytesLost) {
        const n = ++s!.decodeTries[frame];
        if (n === 1) decodeErrorStreak++;
        if (n >= FETCH_TRIES) {
          dropBytes(s!, frame);
          s!.bytes[frame] = B_DEAD;
          counters.missing++;
          return true;
        }
        s!.retryAt[frame] = now + RETRY_BASE_MS * 2 ** (n - 1);
        if (s!.retryAt[frame] < retryWake) retryWake = s!.retryAt[frame];
        return false;
      }
      dropBytes(s!, frame);
      const tries = ++s!.tries[frame];
      if (tries >= FETCH_TRIES) {
        s!.bytes[frame] = B_DEAD;
        counters.missing++;
        return true;
      }
      s!.retryAt[frame] = now + RETRY_BASE_MS * 2 ** (tries - 1);
      if (s!.retryAt[frame] < retryWake) retryWake = s!.retryAt[frame];
      // The fetch order may have passed it: the scan starts again from the top of the order.
      orderDirty = true;
      cursor = 0;
      return false;
    },

    /**
     * A fetch was cancelled before it produced anything (the decoding worker stopped): its slot is freed and the frame
     * is fetched again later. Not a try.
     */
    fetchCancelled(segIndex: number, frame: number, epoch: number) {
      fetchesInFlight--;
      const s = segs[segIndex];
      if (!s || s.epoch !== epoch) return;
      if (s.bytes[frame] === B_FETCHING) s.bytes[frame] = B_NONE;
      cursor = 0;
    },

    /** A decode was cancelled before it produced a frame (the decoding worker stopped): its reservation is released. Not a try. */
    decodeCancelled(segIndex: number, frame: number, epoch: number) {
      decodesInFlight--;
      const s = segs[segIndex];
      if (settleOrphan(s, frame, epoch)) return;
      s!.dec[frame] = D_NONE;
      reserved -= s!.frameBytes;
    },

    /**
     * Every compressed byte held is gone (the worker that held them stopped): each frame's bytes are dropped
     * (onBytesDropped) and will be fetched again. Call after cancelling the decodes in flight. Decoded frames stay.
     */
    forgetBytes() {
      for (const s of segs) {
        if (!s) continue;
        for (let i = 0; i < s.count; i++) {
          if (s.dec[i] !== D_DECODING) dropBytes(s, i);
          // Another decoder from now on: past decode failures say nothing about it (a frame given up for them is
          // fetched again).
          if (s.decodeTries[i] > 0) {
            s.decodeTries[i] = 0;
            if (s.bytes[i] === B_DEAD) s.bytes[i] = B_NONE;
            if (s.bytes[i] === B_NONE) s.retryAt[i] = 0;
          }
        }
      }
      decodeErrorStreak = 0;
      cursor = 0;
      // The store that read the packs is gone with its bytes and reads: each pack is read again from byte 0.
      for (const s of segs) s?.pack?.forgetLayout();
      packDirty = true;
    },


    // ------------------------------------------------------------ packs (stage 7)

    /**
     * Segment `index` (joined) reads its frames from the pack at `url` (hints: the manifest's sizes), or, with null,
     * one file per frame. Call after `join` and after `retier` (a new tier, a new pack).
     */
    setPack(index: number, url: string | null, hint: PackHintSizes | null = null) {
      const s = segs[index];
      if (!s) return;
      if (s.pack) packSegs--;
      s.pack = url ? new PackState(url, hint ?? { bytes: 0, header: 0, skeletonEnd: 0 }, holdSlotsOf(s.count, s.moveEnd)) : null;
      if (s.pack) packSegs++;
      dirty();
      packDirty = true;
    },

    /** The pack op outputs (`nextPackOp`): the segment, the read id, the byte range, the hold slots, the pack URL. */
    packOp,

    /**
     * The next thing to do about pack reads (PACK_OPEN, PACK_TO, PACK_STOP, PACK_FORGET) with its details in `packOp`,
     * or NONE. Call until NONE after every change (a pump). Stops and moves come first, then the reads to open (at most
     * `maxPackReads` open; none while hidden or offline; a pack waiting out a retry waits).
     */
    nextPackOp(now: number): number {
      if (packSegs === 0) return NONE;
      if (packDirty && active >= 0) buildPackPlan();
      for (const s of segs) {
        const p = s?.pack;
        if (!p) continue;
        if (p.readId) {
          const stop = p.failed || !keepRead(s!, p);
          // A read that reached its end finishes by itself in the store (its `pack-done` is on its way).
          if (stop && !p.failed && p.known && p.readTo >= 0 && p.readPos >= p.readTo) continue;
          if (stop || p.wantTo !== p.readTo) {
            packOp.seg = s!.index;
            packOp.id = p.readId;
            packOp.url = p.url;
            if (stop) {
              p.readId = 0;
              return PACK_STOP;
            }
            p.readTo = packOp.to = p.wantTo;
            return PACK_TO;
          }
        } else if (p.forgetPending) {
          p.forgetPending = false;
          packOp.seg = s!.index;
          packOp.url = p.url;
          return PACK_FORGET;
        }
      }
      if (paused || offline) return NONE;
      let open = 0;
      for (const s of segs) if (s?.pack?.readId) open++;
      for (let r = 0; r < 2 && open < maxPackReads; r++) {
        const s = seg(rankSeg[r]);
        const p = s?.pack;
        if (!s || !p || p.readId || p.rank !== r || p.failed) continue;
        if (p.retryAt > now) {
          if (p.retryAt < retryWake) retryWake = p.retryAt;
          continue;
        }
        p.readId = ++readSeq;
        p.readPos = p.wantFrom;
        p.readTo = p.wantTo;
        p.reads++;
        counters.packReads++;
        if (s.index === active && p.known && p.wantFrom >= p.skeletonEnd) packJumped = false;
        packOp.seg = s.index;
        packOp.id = p.readId;
        packOp.from = p.wantFrom;
        packOp.to = p.wantTo;
        packOp.hold = p.holdSlots;
        packOp.est = estimateEnd(s, p);
        packOp.url = p.url;
        return PACK_OPEN;
      }
      return NONE;
    },

    /**
     * The pack's own header arrived for segment `index` in its life `epoch`. Null when it is taken (or stale), else why
     * the pack does not fit the film (it is given up: report it once).
     */
    packLayout(
      index: number,
      epoch: number,
      count: number,
      header: number,
      skeletonEnd: number,
      bytes: number,
      slotFrame: ArrayLike<number>,
      slotOffset: ArrayLike<number>,
    ): string | null {
      const s = segs[index];
      const p = s?.pack;
      if (!s || s.epoch !== epoch || !p || p.failed || p.known) return null;
      const err = p.setLayout(count, header, skeletonEnd, bytes, slotFrame, slotOffset, s.usableMask);
      if (err) failPack(s, err);
      packDirty = true;
      return err;
    },

    /**
     * Frame `frame` of segment `index` (life `epoch`) arrived from its pack with `size` bytes. False when it is not taken
     * (the segment left or changed tier, or the frame's bytes are held or being fetched as a file already).
     */
    packFrame(index: number, epoch: number, frame: number, size: number): boolean {
      const s = segs[index];
      if (!s || s.epoch !== epoch || frame < 0 || frame >= s.count) return false;
      const b = s.bytes[frame];
      if (b !== B_NONE && b !== B_DEAD) return false;
      s.bytes[frame] = B_HELD;
      s.size[frame] = size;
      s.fetchedEver[frame] = 1;
      s.retryAt[frame] = 0;
      s.tries[frame] = 0;
      bytesHeld += size;
      counters.packFrames++;
      if (s.pack) {
        s.pack.frames++;
        s.pack.tries = 0;
      }
      enforceCap();
      return true;
    },

    /** Read `id` of segment `index` has reached byte `pos`. */
    packProgress(index: number, epoch: number, id: number, pos: number) {
      const s = segs[index];
      const p = s?.pack;
      if (!s || s.epoch !== epoch || !p || p.readId !== id) return;
      // Through the skeleton: the read may go on to where the rest is wanted, or re-aim.
      if (p.known && p.readPos < p.skeletonEnd && pos >= p.skeletonEnd) packDirty = true;
      p.readPos = pos;
    },

    /**
     * Read `id` of segment `index` ended (READ_OK, READ_CANCELLED, READ_RETRY, READ_FINAL) at byte `pos`; `rangeless`
     * when the server ignored Range. True when the pack is given up now (report it once): a final failure, or the
     * PACK_TRIES-th failed read in a row without a frame. A failed read is tried again after PACK_RETRY_MS, then twice that.
     */
    packEnded(index: number, epoch: number, id: number, outcome: number, pos: number, now: number, rangeless = false, reason = ""): boolean {
      const s = segs[index];
      const p = s?.pack;
      if (!s || s.epoch !== epoch || !p) return false;
      if (rangeless) p.rangeless = true;
      if (p.readId === id) {
        p.readId = 0;
        p.readPos = pos;
      }
      packDirty = true;
      if (outcome === READ_OK || outcome === READ_CANCELLED || p.failed) return false;
      if (outcome === READ_FINAL) {
        failPack(s, reason || "final failure");
        return true;
      }
      if (++p.tries >= PACK_TRIES) {
        failPack(s, `${reason || "failed"}, ${p.tries} times`);
        return true;
      }
      p.retryAt = now + PACK_RETRY_MS * 2 ** (p.tries - 1);
      if (p.retryAt < retryWake) retryWake = p.retryAt;
      return false;
    },

    /** Give the pack of segment `index` up now (the loader found it unusable). True when it was in use. */
    failPack(index: number, reason: string): boolean {
      const s = segs[index];
      if (!s?.pack || s.pack.failed) return false;
      failPack(s, reason);
      return true;
    },

    /** The pack of segment `index` (tests, the HUD, the counters): null when it reads frame by frame from the start. */
    pack: (index: number): PackState | null => segs[index]?.pack ?? null,

    /** Pack reads open now. */
    get packReadsOpen() {
      let n = 0;
      for (const s of segs) if (s?.pack?.readId) n++;
      return n;
    },

    /**
     * Why frame `i` of segment `index` is not on the canvas yet, as an index into WAIT_REASONS (the counters' stale
     * locator; not for the hot path).
     */
    waitReason(index: number, i: number): number {
      const s = segs[index];
      if (!s) return 9;
      if (i < 0 || i >= s.count) return 7;
      if (s.dec[i] === D_HELD) return 0;
      if (s.dec[i] === D_DECODING) return 1;
      const b = s.bytes[i];
      if (b === B_HELD) return 2;
      if (b === B_FETCHING) return 3;
      if (b === B_DEAD) return 8;
      const p = packed(s) ? s.pack! : null;
      if (p) {
        if (packDirty && active >= 0) buildPackPlan();
        if (p.goal >= frameLevel(s, i)) return p.readId ? 5 : 6;
        return 7;
      }
      return s.orderStamp[i] === orderGen ? 4 : 7;
    },

    /** The epoch of segment `index` (changes on join and retier): pass it back with the job's arrival. */
    epoch: (index: number) => segs[index]?.epoch ?? 0,

    // ------------------------------------------------------------ reads

    loaded: (index: number) => segs[index]?.decodedCount ?? 0,
    width: (index: number) => segs[index]?.width ?? 0,
    usable: (index: number, i: number) => !!segs[index]?.usable(i),
    isWanted: (index: number, i: number) => {
      const s = segs[index];
      return !!s && i >= 0 && i < s.count && wanted(s, i);
    },
    hasBytes: (index: number, i: number) => segs[index]?.bytes[i] === B_HELD,
    isDecoded: (index: number, i: number) => segs[index]?.dec[i] === D_HELD,
    isDecoding: (index: number, i: number) => segs[index]?.dec[i] === D_DECODING,
    isMissing: (index: number, i: number) => segs[index]?.bytes[i] === B_DEAD,

    /** The decoded frame nearest to `at` (lower first on a tie), or −1. */
    nearestDecoded(index: number, at: number): number {
      const s = segs[index];
      if (!s) return -1;
      for (let d = 0; d < s.count; d++) {
        const lo = at - d;
        const hi = at + d;
        if (lo >= 0 && lo < s.count && s.dec[lo] === D_HELD) return lo;
        if (hi >= 0 && hi < s.count && s.dec[hi] === D_HELD) return hi;
      }
      return -1;
    },

    /** A frame within `tol` of `at` may still be decoded (decoding, or wanted with its bytes held, coming or queued). */
    isComing(index: number, at: number, tol: number): boolean {
      const s = segs[index];
      if (!s) return false;
      const p = packed(s) ? s.pack! : null;
      if (p && packDirty && active >= 0) buildPackPlan();
      for (let k = Math.max(0, at - tol); k <= Math.min(s.count - 1, at + tol); k++) {
        if (s.dec[k] === D_DECODING) return true;
        if (s.dec[k] !== D_NONE || !wanted(s, k)) continue;
        const b = s.bytes[k];
        if (b === B_HELD || b === B_FETCHING) return true;
        // From a pack: coming while a read of its level is open or queued.
        if (b === B_NONE && (p ? p.goal >= frameLevel(s, k) : s.orderStamp[k] === orderGen)) return true;
      }
      return false;
    },

    /** The wanted set in decode order (a copy; tests and the HUD only). */
    wantedJobs(): number[] {
      return Array.from(wantList.subarray(0, wantLen));
    },

    /** The fetch order (a copy; tests only). */
    fetchOrder(): number[] {
      return Array.from(order.subarray(0, orderLen));
    },

    /** Decoded bytes of the wanted set (tests). */
    wantedSetBytes(): number {
      let b = 0;
      for (let k = 0; k < wantLen; k++) b += segs[jobSeg(wantList[k])]?.frameBytes ?? 0;
      return b;
    },
  };
}

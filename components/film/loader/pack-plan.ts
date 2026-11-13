/**
 * Film packs on the page side (stage 7): what the budget planner (./budget-plan.ts) knows of one segment's pack, and the
 * pure byte arithmetic it plans pack reads with. A pack (./pack-format.mjs) holds every frame of one film at one tier:
 * a header and a table, then the hold frames (0, M, last), the skeleton (every 4th frame of the move), the rest of the
 * move in frame order and the tail. The page learns the layout from the pack's own header (the worker parses it and
 * sends the table, `PackState.setLayout`); until then it plans with symbolic ends (the skeleton end, the hold frames'
 * end, the file's end) that the worker resolves.
 *
 * Frame bytes states are the planner's (`B_*`, one byte per frame in `Seg.bytes`): a frame of a pack segment is B_NONE
 * until its bytes arrive from a pack read, then B_HELD, exactly as a fetched frame. No allocation after setLayout.
 */

// Compressed bytes of a frame (budget-plan.ts `Seg.bytes`).
export const B_NONE = 0;
export const B_FETCHING = 1;
export const B_HELD = 2;
export const B_DEAD = 3;

/** How far a pack read goes: the hold frames, the skeleton, everything the page load can show. */
export const LEVEL_NONE = 0;
export const LEVEL_HOLD = 1;
export const LEVEL_SKELETON = 2;
export const LEVEL_ALL = 3;

/** A read at most this many slots short of where it should start, with nothing held between, is left to reach it. */
export const REACH_SLOTS = 16;
/** Scrolling up, a re-aimed read starts this many frames below the highest missing frame at or below the target. */
export const BEHIND_FRAMES = 64;
/** A pack is given up (its film loads frame by frame) after this many failed reads in a row without a frame. */
export const PACK_TRIES = 3;
/** A failed pack read is tried again after this, then twice this. */
export const PACK_RETRY_MS = 400;
/** The direction the pack plan reads ahead in flips only after this many frames of travel against it. */
export const DIRECTION_FRAMES = 8;

/** What the manifest says about a pack (FilmManifest `packs[width]`): hints only, the header is what counts. */
export type PackHintSizes = { bytes: number; header: number; skeletonEnd: number };

export class PackState {
  /** Given up: the film loads frame by frame from now on (`failReason` says why); the store is still to be told. */
  failed = false;
  failReason = "";
  forgetPending = false;
  /** Failed reads in a row with no frame delivered; the next try is not before `retryAt`. */
  tries = 0;
  retryAt = 0;
  /** The server answered a Range request with the whole file: every read of this pack starts at byte 0. */
  rangeless = false;

  // The layout, from the pack's own header (null / 0 until the worker has parsed it).
  count = 0;
  header = 0;
  skeletonEnd = 0;
  bytes = 0;
  /** Frame index per file slot; slot start offsets (one more entry: the file's end); slot per frame (−1: none). */
  slotFrame: Int32Array | null = null;
  slotOff: Uint32Array | null = null;
  frameSlot: Int32Array | null = null;
  /** End of the hold frames (the first `holdSlots` slots); end of the last slot the page load can show. */
  holdEnd = 0;
  usableEnd = 0;

  // The open read (readId 0: none).
  readId = 0;
  readPos = 0;
  readTo = 0;
  /** Reads opened and frames delivered by them (counters for the HUD and the tests). */
  reads = 0;
  frames = 0;

  // The plan's view of this pack (rebuilt by the planner): its place, where the read should start and end, the level
  // it reads to now, the level queued in all (isComing), and whether its open read should stop.
  rank = -1;
  wantFrom = 0;
  wantTo = 0;
  level = LEVEL_NONE;
  goal = LEVEL_NONE;

  constructor(
    readonly url: string,
    readonly hint: PackHintSizes,
    /** Distinct frames among 0, M and last: the hold slots at the start of the file. */
    readonly holdSlots: number,
  ) {}

  get known(): boolean {
    return this.slotOff !== null;
  }

  /**
   * The pack's own header arrived. Null when it fits this film (`count` frames; `usable[i]` the frames this page load
   * shows), else why not (the pack is then given up).
   */
  setLayout(
    count: number,
    header: number,
    skeletonEnd: number,
    bytes: number,
    slotFrame: ArrayLike<number>,
    slotOffset: ArrayLike<number>,
    usable: Uint8Array,
  ): string | null {
    if (count !== usable.length) return `pack has ${count} frames, the film ${usable.length}`;
    if (slotFrame.length !== count || slotOffset.length !== count) return "pack table length disagrees with its frame count";
    const sf = new Int32Array(count);
    const so = new Uint32Array(count + 1);
    const fs = new Int32Array(count).fill(-1);
    for (let s = 0; s < count; s++) {
      const f = slotFrame[s];
      if (f < 0 || f >= count || fs[f] !== -1) return `pack table lists frame ${f} twice or out of range`;
      sf[s] = f;
      so[s] = slotOffset[s];
      fs[f] = s;
    }
    so[count] = bytes;
    this.count = count;
    this.header = header;
    this.skeletonEnd = skeletonEnd;
    this.bytes = bytes;
    this.slotFrame = sf;
    this.slotOff = so;
    this.frameSlot = fs;
    this.holdEnd = so[Math.min(count, Math.max(1, this.holdSlots))];
    let end = header;
    for (let s = 0; s < count; s++) if (usable[sf[s]]) end = so[s + 1];
    this.usableEnd = end;
    return null;
  }

  /** Forget the layout and the open read (the store that read it is gone: the next read starts at byte 0). */
  forgetLayout() {
    this.slotFrame = this.slotOff = this.frameSlot = null;
    this.count = this.header = this.skeletonEnd = this.bytes = this.holdEnd = this.usableEnd = 0;
    this.readId = 0;
    this.rangeless = false;
  }

  /** The slot holding byte `pos` (0 for a byte of the header; `count` past the end). Layout known. */
  slotAt(pos: number): number {
    const so = this.slotOff!;
    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (so[mid + 1] <= pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** The first slot from `from` starting below byte `to` whose frame's bytes are missing (B_NONE), or −1. */
  firstMissingSlot(from: number, to: number, state: Uint8Array): number {
    const so = this.slotOff!;
    const sf = this.slotFrame!;
    for (let s = Math.max(0, from); s < this.count && so[s] < to; s++) if (state[sf[s]] === B_NONE) return s;
    return -1;
  }

  /** Where a read starting in slot `slot` must stop: the first held slot after it, or `to`. */
  stopFor(slot: number, to: number, state: Uint8Array): number {
    const so = this.slotOff!;
    const sf = this.slotFrame!;
    for (let s = slot + 1; s < this.count && so[s] < to; s++) if (state[sf[s]] !== B_NONE) return so[s];
    return to;
  }

  /** Slots between `a` (inclusive) and `b` (exclusive) whose bytes are held: a read from `a` would stop before `b`. */
  heldBetween(a: number, b: number, state: Uint8Array): boolean {
    const sf = this.slotFrame!;
    for (let s = Math.max(0, a); s < b && s < this.count; s++) if (state[sf[s]] !== B_NONE) return true;
    return false;
  }

  /** A frame of the rest of the film (after the skeleton in the file). */
  isRest(f: number): boolean {
    return this.slotOff![this.frameSlot![f]] >= this.skeletonEnd;
  }

  /**
   * The frame a read of the rest of the film should start at, for a visitor at `at` travelling `dir`: forward (or at
   * rest), the first missing frame at or after `at` (else the first missing one before it); backward, a run below the
   * highest missing frame at or below `at`, from BEHIND_FRAMES below it (else the first missing one above). Only
   * frames this page load shows (`usable`) and whose bytes are missing count. −1: nothing missing.
   */
  restStart(at: number, dir: number, state: Uint8Array, usable: Uint8Array): number {
    const n = this.count;
    const a = Math.min(n - 1, Math.max(0, at));
    if (dir < 0) {
      let top = -1;
      for (let f = a; f >= 0; f--) {
        if (this.missingRest(f, state, usable)) {
          top = f;
          break;
        }
      }
      if (top >= 0) {
        for (let f = Math.max(0, top - BEHIND_FRAMES); f <= top; f++) if (this.missingRest(f, state, usable)) return f;
      }
      for (let f = a + 1; f < n; f++) if (this.missingRest(f, state, usable)) return f;
      return -1;
    }
    for (let f = a; f < n; f++) if (this.missingRest(f, state, usable)) return f;
    for (let f = 0; f < a; f++) if (this.missingRest(f, state, usable)) return f;
    return -1;
  }

  private missingRest(f: number, state: Uint8Array, usable: Uint8Array): boolean {
    return usable[f] === 1 && state[f] === B_NONE && this.slotOff![this.frameSlot![f]] >= this.skeletonEnd;
  }
}

/** Distinct frames among 0, M and the last frame of a film of `count` frames. */
export function holdSlotsOf(count: number, moveEnd: number): number {
  const last = count - 1;
  const m = Math.min(last, Math.max(0, moveEnd));
  return 1 + (m !== 0 ? 1 : 0) + (last !== m && last !== 0 ? 1 : 0);
}

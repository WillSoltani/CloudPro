/**
 * The film pack format, CFPK layout v1, ported from the sister project's pack-format.ts / pack-store.ts: ONE file per
 * film directory and width holding all its frames' files byte for byte, read with one streaming GET (and Range
 * requests to continue). Types: ./pack-format.d.mts. Built by scripts/films/pack.mjs (scripts/films/pack-lib.mjs) and
 * by the placeholder generator; read by the frame store (./frame-worker.js).
 *
 * WHY THIS FILE IS PLAIN .mjs WITH NO IMPORTS: one copy of the format logic for every reader and writer.
 * - The Node scripts import it as it is (an .mjs is an ES module for Node: no package "type" needed, no warning).
 * - The page and the film worker import it statically. Measured on 2026-11-13 (Next 16.1.6, production build): with
 *   `import { PackBytes } from "./pack-format.mjs"` in ./frame-worker.js, Turbopack compiles the worker and this file
 *   into one worker chunk (the page starts a `blob:` worker that loads it), the worker ran (`mode` "budget") and saw
 *   the import, 0 console errors; the page's chunk carries it too, for the main-thread store. The raw copy of
 *   frame-worker.js that the build also emits to /_next/static/media is not what the browser runs.
 *
 * Layout (little-endian u32 fields):
 *
 *   0   magic "CFPK"
 *   4   layout version (1)
 *   8   frame count N
 *   12  header length H = 24 + 12·N (frame bytes start here)
 *   16  skeleton end: the byte offset where the skeleton (hold frames and the coarse frames of the move) ends
 *   20  total length of the file
 *   24  N table entries in FILE order: frame index (0-based), byte offset (absolute), byte length
 *   H   the frames' file bytes in file order, contiguous, no padding
 *
 * The reader takes count, offsets and lengths from the pack itself and assumes nothing about the order; the manifest's
 * `packs` hints (bytes, header, skeletonEnd) are for planning and caps only (placeholder packs differ from them).
 *
 * File order (packOrder): the hold frames 0, M (the move's end) and the last frame; then the skeleton, every
 * SKELETON_STRIDE-th frame of the move (4, 8, … below M, nearest to frame 0 first); then the rest of the move in frame
 * order; then the tail frames after M (even offsets from M first, as coarse pointers play only those). A read from byte
 * 0 thus yields the hold frames, then a scrub-able skeleton, then full detail.
 */

export const PACK_MAGIC = "CFPK";
export const PACK_LAYOUT_VERSION = 1;
export const PACK_FIXED_BYTES = 24;
export const PACK_ENTRY_BYTES = 12;
/** Every SKELETON_STRIDE-th frame of the move is in the skeleton. */
export const SKELETON_STRIDE = 4;
/** A sanity cap on the frame count a header may claim before its table is allocated (films have a few hundred). */
export const PACK_MAX_FRAMES = 65536;
/** What a pack file may be called in a manifest (`packs[width].file`): a bare name, no path. */
export const PACK_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.bin$/;

/**
 * Frame indices in file order for a film of `count` frames whose move ends at `moveEnd` (M; frames after it are the
 * breathing tail), with the size of each section: hold, skeleton, rest of the move, tail.
 */
export function packOrder(count, moveEnd) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`pack: frame count ${count}`);
  const M = Math.min(count - 1, Math.max(0, Math.round(Number(moveEnd) || 0)));
  const last = count - 1;
  const seen = new Uint8Array(count);
  const order = [];
  const take = (i) => {
    if (!seen[i]) {
      seen[i] = 1;
      order.push(i);
    }
  };
  take(0);
  take(M);
  take(last);
  const hold = order.length;
  for (let i = SKELETON_STRIDE; i < M; i += SKELETON_STRIDE) take(i);
  const skeleton = order.length - hold;
  for (let i = 1; i < M; i++) take(i);
  const rest = order.length - hold - skeleton;
  for (let i = M + 2; i < last; i += 2) take(i);
  for (let i = M + 1; i < last; i += 2) take(i);
  const tail = order.length - hold - skeleton - rest;
  return { order, moveEnd: M, hold, skeleton, rest, tail };
}

/**
 * Build a pack from frame files' bytes (`frames[i]` = frame i). Deterministic: the same frames and move end give the
 * same bytes. Returns the file (`data`), its length (`bytes`), the header length, the skeleton end, the order and the
 * byte range [start, end) of each part.
 */
export function buildPack(frames, moveEnd) {
  const n = frames.length;
  if (n === 0) throw new Error("pack: no frames");
  const o = packOrder(n, moveEnd);
  const header = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * n;
  let total = header;
  for (const f of frames) total += f.length;
  if (total > 0xffffffff) throw new Error("pack: larger than 4 GiB");
  const data = new Uint8Array(total);
  const dv = new DataView(data.buffer);
  for (let k = 0; k < 4; k++) data[k] = PACK_MAGIC.charCodeAt(k);
  dv.setUint32(4, PACK_LAYOUT_VERSION, true);
  dv.setUint32(8, n, true);
  dv.setUint32(12, header, true);
  dv.setUint32(20, total, true);
  const ends = [];
  let at = header;
  o.order.forEach((index, slot) => {
    const f = frames[index];
    const e = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * slot;
    dv.setUint32(e, index, true);
    dv.setUint32(e + 4, at, true);
    dv.setUint32(e + 8, f.length, true);
    data.set(f, at);
    at += f.length;
    ends.push(at);
  });
  const endAfter = (slots) => (slots > 0 ? ends[slots - 1] : header);
  const a = o.hold;
  const b = a + o.skeleton;
  const c = b + o.rest;
  const skeletonEnd = endAfter(b);
  dv.setUint32(16, skeletonEnd, true);
  return {
    data,
    bytes: total,
    header,
    skeletonEnd,
    order: o.order,
    moveEnd: o.moveEnd,
    parts: {
      fixed: [0, PACK_FIXED_BYTES],
      table: [PACK_FIXED_BYTES, header],
      hold: [header, endAfter(a)],
      skeleton: [endAfter(a), skeletonEnd],
      rest: [skeletonEnd, endAfter(c)],
      tail: [endAfter(c), total],
    },
    counts: { hold: o.hold, skeleton: o.skeleton, rest: o.rest, tail: o.tail },
  };
}

/** The fixed 24 bytes: the header length they announce, null while fewer have arrived, or why they are not a pack. */
export function readPackFixed(bytes) {
  if (bytes.length < PACK_FIXED_BYTES) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== PACK_MAGIC) return { error: `pack: bad magic "${magic}"` };
  const version = dv.getUint32(4, true);
  if (version !== PACK_LAYOUT_VERSION) return { error: `pack: layout version ${version}, this reader reads ${PACK_LAYOUT_VERSION}` };
  const count = dv.getUint32(8, true);
  if (count < 1 || count > PACK_MAX_FRAMES) return { error: `pack: frame count ${count} outside 1-${PACK_MAX_FRAMES}` };
  const header = dv.getUint32(12, true);
  if (header !== PACK_FIXED_BYTES + PACK_ENTRY_BYTES * count) return { error: "pack: header length disagrees with the frame count" };
  return { version, count, header, skeletonEnd: dv.getUint32(16, true), bytes: dv.getUint32(20, true) };
}

/**
 * Parse a pack header (fixed part and table) from the first bytes of a pack. Null while `bytes` is too short to hold
 * the whole header; `{ error }` when it is not a pack this reader understands or is not self-consistent (every frame
 * listed once and in range, slices contiguous from the header to the total length, skeleton end inside the file).
 */
export function parsePackHeader(bytes) {
  const f = readPackFixed(bytes);
  if (!f || "error" in f) return f;
  if (bytes.length < f.header) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const slots = [];
  const slotOf = new Int32Array(f.count).fill(-1);
  let at = f.header;
  for (let s = 0; s < f.count; s++) {
    const e = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * s;
    const index = dv.getUint32(e, true);
    const offset = dv.getUint32(e + 4, true);
    const length = dv.getUint32(e + 8, true);
    if (index >= f.count || slotOf[index] !== -1) return { error: `pack: frame ${index} out of range or listed twice` };
    if (offset !== at) return { error: `pack: frame ${index} is not contiguous (offset ${offset}, expected ${at})` };
    if (length === 0) return { error: `pack: frame ${index} is empty` };
    if (offset + length > f.bytes) return { error: `pack: frame ${index} ends at ${offset + length}, past the file's ${f.bytes} bytes` };
    slotOf[index] = s;
    slots.push({ index, offset, length });
    at = offset + length;
  }
  if (at !== f.bytes) return { error: `pack: frames end at ${at}, header says ${f.bytes}` };
  if (f.skeletonEnd < f.header || f.skeletonEnd > f.bytes) return { error: "pack: skeleton end outside the file" };
  return { version: f.version, count: f.count, header: f.header, skeletonEnd: f.skeletonEnd, bytes: f.bytes, slots, slotOf };
}

/** The byte where frame `index` is complete, or -1 when the pack has no such frame. */
export function frameEnd(h, index) {
  const s = index >= 0 && index < h.slotOf.length ? h.slotOf[index] : -1;
  return s >= 0 ? h.slots[s].offset + h.slots[s].length : -1;
}

/** Null when a pack's header agrees with its manifest hint (`packs[width]`), else what differs (a report, not a failure). */
export function packHintProblem(h, hint) {
  if (!hint) return null;
  if (hint.bytes !== undefined && h.bytes !== hint.bytes) return `pack is ${h.bytes} bytes, the manifest says ${hint.bytes}`;
  if (hint.header !== undefined && h.header !== hint.header) return `pack header is ${h.header} bytes, the manifest says ${hint.header}`;
  if (hint.skeletonEnd !== undefined && h.skeletonEnd !== hint.skeletonEnd) {
    return `pack skeleton ends at ${h.skeletonEnd}, the manifest says ${hint.skeletonEnd}`;
  }
  return null;
}

/**
 * PackBytes: the bytes held for ONE pack and the incremental frame cutter. Bytes arrive in chunks of any size at any
 * absolute offset (a streaming GET from 0, a Range response from the byte reached); the header is parsed as soon as it
 * is complete (its length is known once the fixed 24 bytes are in); every frame whose bytes are all held is complete.
 *
 * Bookkeeping is per frame slot (file order): the bytes held of a slot are a PREFIX of it (a read always starts at the
 * first byte not held and reads forward), so a read stopped mid-frame continues at that frame's first missing byte and
 * nothing is read twice. Bytes written over a held range are counted (`repeatedBytes`, e.g. a server that ignored Range
 * and sent the file from byte 0) and ignored; bytes that would leave a hole or lie past the end are dropped
 * (`gapBytes`, a planner bug if ever non-zero). A bad header makes the store fail for good (`error`).
 */
export class PackBytes {
  constructor() {
    this.header = null;
    this.error = null;
    this.heldBytes = 0;
    this.repeatedBytes = 0;
    this.gapBytes = 0;
    this._head = new Uint8Array(PACK_FIXED_BYTES);
    this._headFilled = 0;
    this._bufs = [];
    this._filled = new Int32Array(0);
  }

  /** Bytes of the header held (a prefix). */
  get headerFilled() {
    return this._headFilled;
  }

  /** Bytes held of file slot `slot` (a prefix of it). */
  slotFilled(slot) {
    return this._filled[slot] ?? 0;
  }

  /** The frame's bytes are all held. */
  held(index) {
    const h = this.header;
    if (!h || index < 0 || index >= h.count) return false;
    const s = h.slotOf[index];
    return s >= 0 && this._filled[s] === h.slots[s].length;
  }

  /** A complete frame's bytes (a view, not a copy), else null. */
  frame(index) {
    if (!this.held(index)) return null;
    return this._bufs[this.header.slotOf[index]] ?? null;
  }

  /** Complete frame indices, in file order. */
  heldFrames() {
    const h = this.header;
    if (!h) return [];
    const out = [];
    for (let s = 0; s < h.slots.length; s++) if (this._filled[s] === h.slots[s].length) out.push(h.slots[s].index);
    return out;
  }

  /** Bytes [pos, pos + chunk.length) of the pack arrived. Returns the frames this write completed (and the error, if any). */
  write(pos, chunk) {
    const completed = [];
    if (this.error) return { completed, error: this.error };
    let at = pos;
    let data = chunk;
    // The header region (also once parsed: a read from byte 0 again counts its header bytes as repeated).
    while (data.length && at < this._head.length) {
      const H = this._head.length;
      const n = Math.min(data.length, H - at);
      this._headFilled = this._writePrefix(this._head, this._headFilled, at, data.subarray(0, n));
      at += n;
      data = data.subarray(n);
      if (this.header || this._headFilled < H) break;
      if (H === PACK_FIXED_BYTES) {
        const f = readPackFixed(this._head);
        if (f && "error" in f) return this._fail(completed, f.error);
        if (f && f.header > H) {
          const head = new Uint8Array(f.header);
          head.set(this._head);
          this._head = head;
          continue;
        }
      }
      const h = parsePackHeader(this._head);
      if (!h) return this._fail(completed, "pack: header incomplete at its full length");
      if ("error" in h) return this._fail(completed, h.error);
      this.header = h;
      this._bufs = new Array(h.slots.length).fill(null);
      this._filled = new Int32Array(h.slots.length);
    }
    if (!data.length) return { completed };
    const h = this.header;
    if (!h) {
      // Bytes past the part of the header known so far: there is nowhere to put them yet.
      this.gapBytes += data.length;
      return { completed };
    }
    for (let si = this._slotEndingAfter(at); si < h.slots.length && data.length; si++) {
      const s = h.slots[si];
      const rel = at - s.offset;
      const n = Math.min(data.length, s.length - rel);
      if (n <= 0) continue;
      const before = this._filled[si];
      let buf = this._bufs[si];
      if (!buf) buf = this._bufs[si] = new Uint8Array(s.length);
      this._filled[si] = this._writePrefix(buf, before, rel, data.subarray(0, n));
      if (this._filled[si] === 0) this._bufs[si] = null;
      if (before < s.length && this._filled[si] === s.length) completed.push(s.index);
      at += n;
      data = data.subarray(n);
    }
    if (data.length) this.gapBytes += data.length; // past the end of the file
    return { completed };
  }

  /**
   * The first byte in [from, to) not held, or -1 when all are. Before the header is known, the first header byte not
   * held (frame positions are unknown until then). `to` defaults to the end of the file.
   */
  firstMissing(from = 0, to = this.header ? this.header.bytes : Infinity) {
    const h = this.header;
    if (!h) {
      const m = Math.max(from, this._headFilled);
      return m < to ? m : -1;
    }
    if (from < h.header) from = h.header;
    if (from >= to) return -1;
    for (let si = this._slotEndingAfter(from); si < h.slots.length; si++) {
      const s = h.slots[si];
      if (s.offset >= to) break;
      const m = Math.max(from, s.offset + this._filled[si]);
      if (m < s.offset + s.length) return m < to ? m : -1;
    }
    return -1;
  }

  /** The first held byte at or after `from` (below `to`), else `to`: where a read from `from` should stop. */
  nextHeld(from, to) {
    if (from < this._head.length && from < this._headFilled) return from;
    const h = this.header;
    if (!h) return to;
    for (let si = this._slotEndingAfter(Math.max(from, h.header)); si < h.slots.length; si++) {
      const s = h.slots[si];
      if (s.offset >= to) break;
      const f = this._filled[si];
      if (f > 0 && s.offset + f > from) return Math.min(to, Math.max(from, s.offset));
    }
    return to;
  }

  /** Let one frame's bytes go (complete or partial). Returns the bytes freed. */
  dropFrame(index) {
    const h = this.header;
    if (!h || index < 0 || index >= h.count) return 0;
    const s = h.slotOf[index];
    return s >= 0 ? this.dropSlot(s) : 0;
  }

  /** Let the bytes of file slot `slot` go. Returns the bytes freed. */
  dropSlot(slot) {
    const f = this._filled[slot] ?? 0;
    if (!f) return 0;
    this._filled[slot] = 0;
    this._bufs[slot] = null;
    this.heldBytes -= f;
    return f;
  }

  _fail(completed, error) {
    this.error = error;
    return { completed, error };
  }

  /** The first slot that ends after byte `pos` (slots are in offset order). */
  _slotEndingAfter(pos) {
    const slots = this.header.slots;
    let lo = 0;
    let hi = slots.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const s = slots[mid];
      if (s.offset + s.length <= pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Write `data` at `rel` into a prefix-filled buffer; returns the new fill. */
  _writePrefix(buf, filled, rel, data) {
    const end = rel + data.length;
    const overlap = Math.max(0, Math.min(end, filled) - rel);
    this.repeatedBytes += overlap;
    if (end <= filled) return filled;
    if (rel > filled) {
      this.gapBytes += data.length;
      return filled;
    }
    buf.set(data.subarray(filled - rel), filled);
    this.heldBytes += end - filled;
    return end;
  }
}

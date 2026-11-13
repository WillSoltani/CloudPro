// Tests for the film pack format (./pack-format.mjs): the writer and the reader round trip, the header checks, the frame
// order of design B (hold frames, skeleton, rest of the move, tail) and the streaming cutter fed in arbitrary chunks.
// Ported and adapted from the sister project's pack-format.test.ts. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PACK_ENTRY_BYTES,
  PACK_FIXED_BYTES,
  PackBytes,
  buildPack,
  frameEnd,
  packHintProblem,
  packOrder,
  parsePackHeader,
  readPackFixed,
  type PackHeader,
} from "./pack-format.mjs";

/** Frames with distinct sizes and contents (byte i of frame k = (k * 31 + i) & 255). */
function frames(n: number, size = (k: number) => 40 + ((k * 37) % 90)): Uint8Array[] {
  return Array.from({ length: n }, (_, k) => Uint8Array.from({ length: size(k) }, (_, i) => (k * 31 + i) & 255));
}

/** Deterministic PRNG so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function header(buf: Uint8Array): PackHeader {
  const h = parsePackHeader(buf);
  assert.ok(h && !("error" in h), h && "error" in h ? h.error : "header incomplete");
  return h;
}

/** Feed `buf[from, to)` to the store in chunks ending at the given cut points; the frames completed, in order. */
function feed(store: PackBytes, buf: Uint8Array, cuts: number[], from = 0, to = buf.length) {
  const done: number[] = [];
  let at = from;
  for (const c of [...cuts.filter((c) => c > from && c < to).sort((a, b) => a - b), to]) {
    if (c <= at) continue;
    const r = store.write(at, buf.subarray(at, c));
    assert.equal(r.error, undefined, r.error);
    done.push(...r.completed);
    at = c;
  }
  return done;
}

function assertAllFrames(store: PackBytes, f: Uint8Array[]) {
  for (let i = 0; i < f.length; i++) {
    const got = store.frame(i);
    assert.ok(got, `frame ${i} complete`);
    assert.deepEqual(Buffer.from(got), Buffer.from(f[i]!), `frame ${i} bytes`);
  }
}

/** Overwrite one u32 of a copy of `buf`. */
function patched(buf: Uint8Array, at: number, value: number) {
  const out = buf.slice();
  new DataView(out.buffer).setUint32(at, value, true);
  return out;
}

describe("packOrder (design B)", () => {
  it("a film with a tail: 0, M, last; every 4th frame of the move; the rest of the move; even tail offsets first", () => {
    // rack-01's shape, scaled down: move 0…12 (M = 12), tail 13…18 (last = 18).
    const o = packOrder(19, 12);
    assert.deepEqual(o.order, [0, 12, 18, 4, 8, 1, 2, 3, 5, 6, 7, 9, 10, 11, 14, 16, 13, 15, 17]);
    assert.deepEqual([o.hold, o.skeleton, o.rest, o.tail], [3, 2, 9, 5]);
    // Every frame exactly once.
    assert.deepEqual([...o.order].sort((a, b) => a - b), Array.from({ length: 19 }, (_, i) => i));
  });

  it("a film without a tail (M = last): 0 and M, then the skeleton, then the rest", () => {
    const o = packOrder(11, 10);
    assert.deepEqual(o.order, [0, 10, 4, 8, 1, 2, 3, 5, 6, 7, 9]);
    assert.deepEqual([o.hold, o.skeleton, o.rest, o.tail], [2, 2, 7, 0]);
  });

  it("the real shapes: rack-01 (169 frames, M 120) and tower-04-p (145 frames, M 144)", () => {
    const r = packOrder(169, 120);
    assert.deepEqual(r.order.slice(0, 5), [0, 120, 168, 4, 8]);
    assert.equal(r.hold + r.skeleton, 3 + 29); // 4 … 116
    assert.equal(r.tail, 47); // 121 … 167 (168 is a hold frame)
    assert.deepEqual(r.order.slice(-47, -47 + 3), [122, 124, 126]);
    assert.equal(r.order[r.order.length - 1], 167);
    const t = packOrder(145, 144);
    assert.deepEqual([t.hold, t.skeleton, t.rest, t.tail], [2, 35, 108, 0]);
  });

  it("tiny films and an out-of-range move end are handled", () => {
    assert.deepEqual(packOrder(1, 0).order, [0]);
    assert.deepEqual(packOrder(2, 1).order, [0, 1]);
    assert.deepEqual(packOrder(3, 99).order, [0, 2, 1], "M clamped to the last frame");
    assert.deepEqual(packOrder(3, -4).order, [0, 2, 1], "M clamped to 0: the rest are tail frames");
    assert.throws(() => packOrder(0, 0));
  });
});

describe("buildPack and parsePackHeader", () => {
  it("round trip: header, table and slices; the skeleton ends after the last skeleton frame; deterministic", () => {
    const f = frames(19);
    const p = buildPack(f, 12);
    const h = header(p.data.subarray(0, p.header));
    assert.equal(h.count, 19);
    assert.equal(h.header, PACK_FIXED_BYTES + PACK_ENTRY_BYTES * 19);
    assert.equal(h.bytes, p.data.length);
    assert.equal(h.skeletonEnd, p.skeletonEnd);
    assert.deepEqual(h.slots.map((s) => s.index), p.order);
    let at = h.header;
    for (const s of h.slots) {
      assert.equal(s.offset, at);
      assert.deepEqual(Buffer.from(p.data.subarray(s.offset, s.offset + s.length)), Buffer.from(f[s.index]!));
      at += s.length;
    }
    // Hold (0, 12, 18) and skeleton (4, 8): the skeleton ends where frame 8's slice ends.
    assert.equal(p.skeletonEnd, frameEnd(h, 8));
    assert.deepEqual(p.parts.hold, [h.header, frameEnd(h, 18)]);
    assert.deepEqual(p.parts.skeleton, [frameEnd(h, 18), frameEnd(h, 8)]);
    assert.deepEqual(p.parts.rest, [frameEnd(h, 8), frameEnd(h, 11)]);
    assert.deepEqual(p.parts.tail, [frameEnd(h, 11), p.bytes]);
    assert.equal(frameEnd(h, 99), -1);
    assert.deepEqual(Buffer.from(buildPack(frames(19), 12).data), Buffer.from(p.data), "same frames, same bytes");
    assert.equal(packHintProblem(h, { bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd }), null);
    assert.match(packHintProblem(h, { bytes: p.bytes + 1 }) ?? "", /bytes/);
    assert.equal(packHintProblem(h, undefined), null);
  });

  it("truncated input is 'not yet' (null), never an error", () => {
    const p = buildPack(frames(10), 9);
    assert.equal(parsePackHeader(p.data.subarray(0, 0)), null);
    assert.equal(parsePackHeader(p.data.subarray(0, PACK_FIXED_BYTES - 1)), null);
    assert.equal(parsePackHeader(p.data.subarray(0, p.header - 1)), null, "table incomplete");
    const fixed = readPackFixed(p.data.subarray(0, PACK_FIXED_BYTES));
    assert.ok(fixed && !("error" in fixed));
    assert.equal(fixed.header, p.header);
  });

  it("wrong magic, wrong version, a header length that disagrees, an absurd count", () => {
    const p = buildPack(frames(10), 9);
    const bad = p.data.slice(0, p.header);
    bad[0] = 0x58;
    assert.match((parsePackHeader(bad) as { error: string }).error, /magic/);
    assert.match((parsePackHeader(patched(p.data, 4, 2)) as { error: string }).error, /version 2/);
    assert.match((parsePackHeader(patched(p.data, 12, p.header + 12)) as { error: string }).error, /header length/);
    assert.match((parsePackHeader(patched(p.data, 8, 0)) as { error: string }).error, /frame count 0/);
    assert.match((parsePackHeader(patched(p.data, 8, 2 ** 31)) as { error: string }).error, /frame count/);
  });

  it("offsets and indices out of range: a gap, an overlap, a frame past the end, a frame twice, a bad total or skeleton end", () => {
    const p = buildPack(frames(10), 9);
    const e = (slot: number, field: 0 | 1 | 2) => PACK_FIXED_BYTES + PACK_ENTRY_BYTES * slot + 4 * field;
    const h = header(p.data);
    const err = (b: Uint8Array) => (parsePackHeader(b) as { error: string }).error;
    assert.match(err(patched(p.data, e(1, 1), h.slots[1]!.offset + 1)), /not contiguous/);
    assert.match(err(patched(p.data, e(0, 1), h.header - 1)), /not contiguous/);
    assert.match(err(patched(p.data, e(9, 2), p.bytes)), /past the file/);
    assert.match(err(patched(p.data, e(3, 0), h.slots[2]!.index)), /listed twice/);
    assert.match(err(patched(p.data, e(3, 0), 10)), /out of range/);
    assert.match(err(patched(p.data, e(4, 2), 0)), /empty/);
    assert.match(err(patched(p.data, 20, p.bytes + 5)), /frames end at/);
    assert.match(err(patched(p.data, 16, p.bytes + 1)), /skeleton end/);
    assert.match(err(patched(p.data, 16, 3)), /skeleton end/);
  });

  it("no frames, no pack", () => {
    assert.throws(() => buildPack([], 0), /no frames/);
  });
});

describe("PackBytes: cutting frames from a stream", () => {
  it("rebuilds every frame from the pack split one byte at a time, in file order", () => {
    const f = frames(19);
    const p = buildPack(f, 12);
    const store = new PackBytes();
    const done = feed(store, p.data, Array.from({ length: p.data.length }, (_, i) => i));
    assert.deepEqual(done, p.order, "frames complete in file order");
    assertAllFrames(store, f);
    assert.equal(store.heldBytes, p.bytes);
    assert.equal(store.repeatedBytes, 0);
    assert.equal(store.gapBytes, 0);
    assert.equal(store.firstMissing(), -1);
  });

  it("rebuilds every frame across random and adversarial chunk boundaries", () => {
    const f = frames(41);
    const p = buildPack(f, 30);
    const h = header(p.data);
    const edges = h.slots.flatMap((s) => [s.offset - 1, s.offset, s.offset + 1, s.offset + s.length - 1]);
    const cutsList: number[][] = [
      [1, 3, 4, 23, 24, 25, p.header - 1, p.header, p.header + 1],
      edges,
      [p.skeletonEnd - 1, p.skeletonEnd, p.skeletonEnd + 1],
      [],
    ];
    const r = rng(7);
    for (let k = 0; k < 40; k++) cutsList.push(Array.from({ length: 1 + Math.floor(r() * 60) }, () => Math.floor(r() * p.data.length)));
    for (const cuts of cutsList) {
      const store = new PackBytes();
      feed(store, p.data, cuts);
      assertAllFrames(store, f);
      assert.equal(store.repeatedBytes, 0);
      assert.equal(store.gapBytes, 0);
    }
  });

  it("the skeleton is complete exactly when the bytes up to skeletonEnd have arrived", () => {
    const f = frames(19);
    const p = buildPack(f, 12);
    const store = new PackBytes();
    feed(store, p.data, [7, 50, 200], 0, p.skeletonEnd);
    assert.deepEqual(store.heldFrames(), [0, 12, 18, 4, 8]);
    assert.equal(store.firstMissing(), p.skeletonEnd);
  });

  it("a read stopped mid-frame continues at the first byte not held; nothing is read twice", () => {
    const f = frames(23);
    const p = buildPack(f, 22);
    const store = new PackBytes();
    const r = rng(11);
    let at = 0;
    while (at < p.data.length) {
      const stop = Math.min(p.data.length, at + 1 + Math.floor(r() * 300));
      feed(store, p.data, [at + Math.floor((stop - at) / 2)], at, stop);
      const next = store.firstMissing();
      assert.equal(next === -1 ? p.data.length : next, stop, "continue point = first byte not held");
      if (next === -1) break;
      at = next;
    }
    assertAllFrames(store, f);
    assert.equal(store.repeatedBytes, 0);
  });

  it("bytes written over a held range (a server that ignored Range) are counted as repeated and leave frames intact", () => {
    const f = frames(8);
    const p = buildPack(f, 7);
    const store = new PackBytes();
    feed(store, p.data, [100, 200], 0, 400);
    const r = store.write(0, p.data);
    assert.equal(r.error, undefined);
    assert.equal(store.repeatedBytes, 400);
    assertAllFrames(store, f);
    assert.equal(store.heldBytes, p.data.length);
  });

  it("bytes that would leave a hole are dropped and counted, never stored", () => {
    const f = frames(8);
    const p = buildPack(f, 7);
    const store = new PackBytes();
    store.write(10, p.data.subarray(10, 30));
    assert.equal(store.gapBytes, 20);
    assert.equal(store.header, null);
    feed(store, p.data, [], 0, p.data.length);
    assertAllFrames(store, f);
    // Past the end of the file.
    store.write(p.data.length, new Uint8Array(5));
    assert.equal(store.gapBytes, 25);
  });

  it("a bad header fails the store for good", () => {
    const p = buildPack(frames(8), 7);
    const bad = p.data.slice();
    bad[1] = 0;
    const store = new PackBytes();
    const r = store.write(0, bad.subarray(0, 10));
    assert.equal(r.error, undefined, "not known yet");
    assert.match(store.write(10, bad.subarray(10, 40)).error ?? "", /magic/);
    assert.match(store.write(40, bad.subarray(40)).error ?? "", /magic/);
    assert.equal(store.frame(0), null);
    const late = new PackBytes();
    assert.match(late.write(0, patched(p.data, 20, p.bytes + 1)).error ?? "", /frames end at/);
  });

  it("dropping a frame frees its bytes; held(), firstMissing() and nextHeld() follow", () => {
    const f = frames(12);
    const p = buildPack(f, 11);
    const store = new PackBytes();
    feed(store, p.data, [], 0, p.data.length);
    const h = store.header!;
    const s5 = h.slots[h.slotOf[5]!]!;
    assert.equal(store.dropFrame(5), s5.length);
    assert.ok(!store.held(5));
    assert.equal(store.heldBytes, p.bytes - s5.length);
    assert.equal(store.firstMissing(), s5.offset);
    assert.equal(store.nextHeld(s5.offset, p.bytes), s5.offset + s5.length);
    store.write(s5.offset, p.data.subarray(s5.offset, s5.offset + s5.length));
    assert.ok(store.held(5));
    assert.equal(store.repeatedBytes, 0);
    assert.equal(store.dropFrame(99), 0);
  });
});

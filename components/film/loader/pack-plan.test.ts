// Tests for the pack plan's byte arithmetic (components/film/loader/pack-plan.ts) on a real pack layout, and the pack rule
// for a slow network (network.ts packTimesSlow). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packTimesSlow, SLOW_FRAME_MS } from "./network";
import { buildPack, parsePackHeader, type PackHeader } from "./pack-format.mjs";
import { B_HELD, B_NONE, BEHIND_FRAMES, holdSlotsOf, PackState } from "./pack-plan";

/** A pack of `count` frames of 10 bytes each, its layout given to a PackState as the worker would. */
function layoutOf(count: number, moveEnd = count - 1, usable?: Uint8Array) {
  const frames = Array.from({ length: count }, () => new Uint8Array(10));
  const built = buildPack(frames, moveEnd);
  const h = parsePackHeader(built.data) as PackHeader;
  const p = new PackState("/films/x/432/pack-00000000.bin", { bytes: built.bytes, header: built.header, skeletonEnd: built.skeletonEnd }, holdSlotsOf(count, moveEnd));
  const u = usable ?? new Uint8Array(count).fill(1);
  const err = p.setLayout(h.count, h.header, h.skeletonEnd, h.bytes, Int32Array.from(h.slots, (s) => s.index), Uint32Array.from(h.slots, (s) => s.offset), u);
  return { p, built, err, state: new Uint8Array(count), usable: u };
}

describe("PackState: layout and byte ranges", () => {
  it("takes the pack's own header: hold end, skeleton end, the end of the frames this page load shows", () => {
    const { p, built, err } = layoutOf(65);
    assert.equal(err, null);
    assert.equal(p.holdEnd, built.parts.hold[1]);
    assert.equal(p.skeletonEnd, built.skeletonEnd);
    assert.equal(p.usableEnd, built.bytes);
    // Tail frames after M = 40 that a coarse pointer never shows (odd offsets) lie at the end of the file: not read.
    const usable = new Uint8Array(65).map((_, i) => (i <= 40 || (i - 40) % 2 === 0 ? 1 : 0));
    const t = layoutOf(65, 40, usable);
    assert.ok(t.p.usableEnd < t.built.bytes);
    assert.equal(t.p.usableEnd, t.built.parts.tail[0] + 11 * 10, "the even tail frames 42 … 62 (11 of them; 64, the last, is a hold frame) and no odd one");
  });

  it("refuses a pack whose frame count is not the film's", () => {
    const frames = Array.from({ length: 30 }, () => new Uint8Array(10));
    const h = parsePackHeader(buildPack(frames, 29).data) as PackHeader;
    const p = new PackState("u", { bytes: 0, header: 0, skeletonEnd: 0 }, 2);
    const err = p.setLayout(h.count, h.header, h.skeletonEnd, h.bytes, h.slots.map((s) => s.index), h.slots.map((s) => s.offset), new Uint8Array(31).fill(1));
    assert.match(err ?? "", /30 frames, the film 31/);
    assert.equal(p.known, false);
  });

  it("first missing slot, where a read must stop, slot of a byte", () => {
    const { p, state } = layoutOf(65);
    assert.equal(p.firstMissingSlot(0, p.skeletonEnd, state), 0);
    state[0] = B_HELD;
    state[64] = B_HELD;
    assert.equal(p.firstMissingSlot(0, p.skeletonEnd, state), 2, "after the hold frames 0 and 64");
    state[20] = B_HELD; // a skeleton frame further on
    assert.equal(p.stopFor(2, p.bytes, state), p.slotOff![p.frameSlot![20]]);
    assert.equal(p.slotAt(p.slotOff![5]), 5);
    assert.equal(p.slotAt(p.slotOff![5] + 3), 5);
    assert.equal(p.slotAt(0), 0, "a header byte");
    assert.ok(p.heldBetween(2, p.frameSlot![20] + 1, state));
    assert.ok(!p.heldBetween(2, p.frameSlot![20], state));
  });

  it("the rest is read from the target going down, from below it going up", () => {
    const { p, state, usable } = layoutOf(200);
    for (let i = 0; i < 200; i++) if (!p.isRest(i)) state[i] = B_HELD; // hold and skeleton in
    assert.equal(p.restStart(50, 1, state, usable), 50 % 4 === 0 ? 51 : 50);
    assert.equal(p.restStart(150, -1, state, usable), 150 - BEHIND_FRAMES - ((150 - BEHIND_FRAMES) % 4 === 0 ? -1 : 0));
    // Everything at and after the target held: wrap to the first missing frame before it.
    for (let i = 50; i < 200; i++) state[i] = B_HELD;
    assert.equal(p.restStart(50, 1, state, usable), 1);
    for (let i = 0; i < 200; i++) state[i] = B_HELD;
    assert.equal(p.restStart(50, 1, state, usable), -1);
    state[7] = B_NONE;
    assert.equal(p.restStart(120, -1, state, usable), 7);
  });

  it("forgets its layout and open read when the store that read it is gone", () => {
    const { p } = layoutOf(33);
    p.readId = 4;
    p.rangeless = true;
    p.forgetLayout();
    assert.equal(p.known, false);
    assert.equal(p.readId, 0);
    assert.equal(p.rangeless, false);
  });

  it("hold slots: distinct frames among 0, M and last", () => {
    assert.equal(holdSlotsOf(145, 144), 2);
    assert.equal(holdSlotsOf(169, 120), 3);
    assert.equal(holdSlotsOf(1, 0), 1);
  });
});

describe("packTimesSlow", () => {
  it("is undecided under 8 frames, slow when 8 frames took longer than two rounds of 400 ms per-frame fetches", () => {
    assert.equal(packTimesSlow(5000, 7), false);
    assert.equal(packTimesSlow(2 * SLOW_FRAME_MS, 8), false);
    assert.equal(packTimesSlow(2 * SLOW_FRAME_MS + 1, 8), true);
    assert.equal(packTimesSlow(0, 20), false);
  });
});

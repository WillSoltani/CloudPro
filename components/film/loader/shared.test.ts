// Tests for the rules every frame loader shares: the usable frames (usable.ts) and the network class (network.ts).
// Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectionSlow,
  FAST_INFLIGHT,
  heroTimesSlow,
  maxInflightFor,
  saveDataOn,
  SLOW_FRAME_MS,
  SLOW_INFLIGHT,
  TIMED_FRAMES,
} from "./network";
import type { JoinOptions } from "./types";
import { isUsable } from "./usable";

const opts = (extra: Partial<JoinOptions> = {}): JoinOptions => ({
  moveEnd: 40,
  tailFrames: 0,
  evenTailOnly: false,
  reducedStills: null,
  tolerance: 8,
  ...extra,
});

describe("isUsable", () => {
  it("the move is always usable; tail frames only while tails play", () => {
    const o = opts();
    assert.ok([0, 20, 40].every((i) => isUsable(o, i)));
    assert.equal(isUsable(o, 41), false, "no tail frames this load");
    const tails = opts({ tailFrames: 8 });
    assert.ok([41, 42, 47, 48].every((i) => isUsable(tails, i)));
  });

  it("on coarse pointers only the even tail frames (counted from M)", () => {
    const o = opts({ tailFrames: 8, evenTailOnly: true });
    assert.deepEqual([41, 42, 43, 44, 48].map((i) => isUsable(o, i)), [false, true, false, true, true]);
    assert.equal(isUsable(o, 39), true, "the move is unaffected");
    const oddM = opts({ moveEnd: 41, tailFrames: 8, evenTailOnly: true });
    assert.deepEqual([42, 43, 45].map((i) => isUsable(oddM, i)), [false, true, true]);
  });

  it("under reduced motion only the stills", () => {
    const o = opts({ reducedStills: [0, 10, 20, 30, 40], tailFrames: 0 });
    assert.deepEqual([0, 5, 10, 40, 41].map((i) => isUsable(o, i)), [true, false, true, true, false]);
  });
});

describe("the network class", () => {
  it("slow by the connection's class, or a laggy and thin link; never by downlink alone", () => {
    assert.equal(connectionSlow(undefined), false);
    for (const t of ["slow-2g", "2g", "3g"]) assert.equal(connectionSlow({ effectiveType: t }), true, t);
    assert.equal(connectionSlow({ effectiveType: "4g" }), false);
    assert.equal(connectionSlow({ effectiveType: "4g", rtt: 0, downlink: 1.5 }), false, "Chrome's early estimate on a fast link");
    assert.equal(connectionSlow({ effectiveType: "4g", rtt: 150, downlink: 1.5 }), true);
    assert.equal(connectionSlow({ effectiveType: "4g", rtt: 150 }), false);
  });

  it("Save-Data and the in-flight limit", () => {
    assert.equal(saveDataOn(undefined), false);
    assert.equal(saveDataOn({ saveData: true }), true);
    assert.equal(maxInflightFor(false, false), FAST_INFLIGHT);
    assert.equal(maxInflightFor(true, false), SLOW_INFLIGHT);
    assert.equal(maxInflightFor(false, true), SLOW_INFLIGHT);
    assert.deepEqual([FAST_INFLIGHT, SLOW_INFLIGHT], [6, 3]);
  });

  it("the timed hero frames: 8 of them, median above 400 ms", () => {
    assert.deepEqual([TIMED_FRAMES, SLOW_FRAME_MS], [8, 400]);
    const slow = [900, 900, 900, 900, 900, 900, 900];
    assert.equal(heroTimesSlow(slow), false, "seven are not enough");
    assert.equal(heroTimesSlow([...slow, 900]), true);
    assert.equal(heroTimesSlow([100, 100, 100, 100, 900, 900, 900, 900]), true, "median (100 + 900) / 2 = 500");
    assert.equal(heroTimesSlow([100, 100, 100, 100, 100, 700, 900, 900]), false, "median 100");
    assert.equal(heroTimesSlow([400, 400, 400, 400, 400, 400, 400, 400]), false, "at 400 it is not slow");
    const times = [5, 4, 3, 2, 1, 900, 900, 900];
    heroTimesSlow(times);
    assert.deepEqual(times, [5, 4, 3, 2, 1, 900, 900, 900], "the samples are not sorted in place");
  });
});

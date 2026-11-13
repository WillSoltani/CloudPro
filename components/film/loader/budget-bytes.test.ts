// Tests for the budget loader's byte arithmetic (components/film/loader/budget-bytes.ts). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budgetOverrideBytes,
  bytesCapFor,
  bytesDropOrder,
  decodedBytes,
  framesPerBudget,
  maxDecodesFor,
  MB,
  pickFrameBudgetBytes,
  smallBudget,
  tierFrameBytes,
  wantedBytesOf,
} from "./budget-bytes";

describe("budget bytes: pickFrameBudgetBytes (the sister project's rule, unchanged)", () => {
  it("with deviceMemory: min(512, max(96, memory x 48)) MB", () => {
    const at = (deviceMemory: number) => pickFrameBudgetBytes({ deviceMemory, innerWidth: 390, innerHeight: 844 }) / MB;
    assert.equal(at(0.5), 96);
    assert.equal(at(1), 96);
    assert.equal(at(2), 96);
    assert.equal(at(3), 144);
    assert.equal(at(4), 192);
    assert.equal(at(8), 384);
    assert.equal(at(16), 512);
  });

  it("without it: 160 MB narrow or portrait, 384 MB otherwise; 160 MB without a window", () => {
    assert.equal(pickFrameBudgetBytes({ innerWidth: 390, innerHeight: 844 }) / MB, 160);
    assert.equal(pickFrameBudgetBytes({ innerWidth: 1000, innerHeight: 700 }) / MB, 160);
    assert.equal(pickFrameBudgetBytes({ innerWidth: 1100, innerHeight: 1400 }) / MB, 160, "portrait tablet");
    assert.equal(pickFrameBudgetBytes({ innerWidth: 1440, innerHeight: 900 }) / MB, 384);
    assert.equal(pickFrameBudgetBytes({ deviceMemory: 0, innerWidth: 1440, innerHeight: 900 }) / MB, 384, "0 is no answer");
    assert.equal(pickFrameBudgetBytes() / MB, 160, "node has no window");
  });
});

describe("budget bytes: the ?budget= override", () => {
  it("reads a number of MB, clamped to 8 … 4096; anything else is no override", () => {
    assert.equal(budgetOverrideBytes("?budget=160"), 160 * MB);
    assert.equal(budgetOverrideBytes("?hud=1&budget=96.5"), Math.round(96.5 * MB));
    assert.equal(budgetOverrideBytes("?budget=2"), 8 * MB);
    assert.equal(budgetOverrideBytes("?budget=99999"), 4096 * MB);
    for (const q of ["", "?budget=", "?budget=abc", "?budget=-5", "?budget=0", "?loader=budget"]) {
      assert.equal(budgetOverrideBytes(q), null, q);
    }
  });
});

describe("budget bytes: sizes and caps", () => {
  it("a decoded frame is width x height x 4; a tier's height is round(width / aspect)", () => {
    assert.equal(decodedBytes(432, 936), 432 * 936 * 4);
    assert.equal(tierFrameBytes(1920, 16 / 9), 1920 * 1080 * 4);
    assert.equal(tierFrameBytes(499, 499 / 1080), 499 * 1080 * 4);
  });

  it("the wanted set may use 80% of the budget", () => {
    assert.equal(wantedBytesOf(100), 80);
    const f = framesPerBudget(160 * MB, decodedBytes(432, 936));
    assert.deepEqual(f, { frames: 103, wanted: 82 });
    assert.deepEqual(framesPerBudget(10, 100), { frames: 0, wanted: 1 }, "at least one frame is wanted");
  });

  it("small budgets (under 256 MB) keep 48 MB of bytes and decode 2 at once; others 160 MB and 3", () => {
    assert.equal(smallBudget(160 * MB), true);
    assert.equal(smallBudget(256 * MB), false);
    assert.equal(bytesCapFor(96 * MB), 48 * MB);
    assert.equal(bytesCapFor(160 * MB), 48 * MB);
    assert.equal(bytesCapFor(384 * MB), 160 * MB);
    assert.equal(maxDecodesFor(160 * MB), 2);
    assert.equal(maxDecodesFor(512 * MB), 3);
  });

  it("drop order: farthest from the active segment first, the one behind the direction of travel first on a tie", () => {
    const out = new Int32Array(16);
    const order = (active: number, dir: number) => Array.from(out.subarray(0, bytesDropOrder([0, 1, 2, 3, 4, 5, 6], active, dir, out)));
    assert.deepEqual(order(3, 1), [0, 6, 1, 5, 2, 4]);
    assert.deepEqual(order(3, -1), [6, 0, 5, 1, 4, 2]);
    assert.deepEqual(order(3, 0), [0, 6, 1, 5, 2, 4], "at rest the segments above go first");
    assert.deepEqual(order(0, 1), [6, 5, 4, 3, 2, 1]);
  });
});

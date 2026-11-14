// Tests for components/film/textCache.ts. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFirstReportSkip, createTextCache } from "./textCache";

function harness(ids: string[]) {
  const measured: string[] = [];
  const pending = new Map<number, () => void>();
  let next = 1;
  const cache = createTextCache<string>({
    ids,
    measure: (id) => {
      measured.push(id);
      return `${id}#${measured.length}`;
    },
    schedule: (fn) => {
      pending.set(next, fn);
      return next++;
    },
    cancel: (h) => void pending.delete(h),
  });
  /** Runs the one pending idle slice, if any. */
  const idle = () => {
    const [h, fn] = [...pending][0] ?? [];
    if (h === undefined || !fn) return false;
    pending.delete(h);
    fn();
    return true;
  };
  return { cache, measured, pending, idle };
}

describe("createTextCache", () => {
  it("measures nothing until asked or started, then one chapter per idle slice, in page order", () => {
    const h = harness(["a", "b", "c"]);
    assert.deepEqual(h.measured, []);
    h.cache.start();
    assert.deepEqual(h.measured, []);
    assert.equal(h.pending.size, 1);
    h.idle();
    assert.deepEqual(h.measured, ["a"]);
    h.idle();
    h.idle();
    assert.deepEqual(h.measured, ["a", "b", "c"]);
    assert.equal(h.pending.size, 0, "no slice is left once every chapter is measured");
    assert.equal(h.idle(), false);
    assert.equal(h.cache.size(), 3);
  });

  it("ensure measures a chapter once and then answers from the cache", () => {
    const h = harness(["a", "b"]);
    assert.equal(h.cache.peek("b"), undefined);
    const first = h.cache.ensure("b");
    assert.equal(h.cache.ensure("b"), first);
    assert.deepEqual(h.measured, ["b"]);
    h.cache.start();
    h.idle();
    h.idle();
    h.idle();
    assert.deepEqual(h.measured, ["b", "a"], "the idle slices skip what ensure measured");
  });

  it("invalidate forgets everything, measures the current chapter now and the rest when idle", () => {
    const h = harness(["a", "b", "c"]);
    h.cache.start();
    while (h.idle());
    h.measured.length = 0;
    h.cache.invalidate("b");
    assert.deepEqual(h.measured, ["b"]);
    assert.equal(h.cache.peek("a"), undefined);
    assert.equal(h.pending.size, 1);
    while (h.idle());
    assert.deepEqual(h.measured, ["b", "a", "c"]);
  });

  it("invalidate replaces the pending slice instead of stacking a second one", () => {
    const h = harness(["a", "b"]);
    h.cache.start();
    h.cache.invalidate();
    h.cache.invalidate();
    assert.equal(h.pending.size, 1);
  });

  it("invalidate with an id that is not a chapter measures nothing now", () => {
    const h = harness(["a"]);
    h.cache.invalidate("nope");
    assert.deepEqual(h.measured, []);
  });

  it("stop cancels the slice and later invalidations and slices do nothing", () => {
    const h = harness(["a", "b"]);
    h.cache.start();
    h.cache.stop();
    assert.equal(h.pending.size, 0);
    h.cache.invalidate("a");
    assert.deepEqual(h.measured, []);
    assert.equal(h.pending.size, 0);
  });

  it("a slice that was already running when stop came measures nothing", () => {
    const h = harness(["a", "b"]);
    h.cache.start();
    const [[, fn]] = [...h.pending];
    h.cache.stop();
    fn();
    assert.deepEqual(h.measured, []);
  });
});

describe("createFirstReportSkip", () => {
  it("the first report of each element is not a change; a second one is", () => {
    const changed = createFirstReportSkip();
    const a = {};
    const b = {};
    assert.equal(changed([a, b]), false);
    assert.equal(changed([a]), true);
    assert.equal(changed([b]), true);
  });
  it("an element first seen later is not a change either", () => {
    const changed = createFirstReportSkip();
    const a = {};
    const b = {};
    assert.equal(changed([a]), false);
    assert.equal(changed([b]), false);
    assert.equal(changed([a, b]), true);
  });
});

// Tests for the budget loader's planner (components/film/loader/budget-plan.ts), driven by a small fake loader: fetches
// and decodes are "in flight" until the test lands them. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MB, tierFrameBytes } from "./budget-bytes";
import { COARSE, createBudgetPlanner, FETCH_TRIES, jobFrame, jobSeg, NONE, RETRY_BASE_MS, type PlannerConfig } from "./budget-plan";
import type { JoinOptions } from "./types";

// Portrait phone tier: 432 x 936.
const W = 432;
const ASPECT = 432 / 936;
const FRAME = tierFrameBytes(W, ASPECT);
const SIZE = 7_000; // compressed bytes of one frame

type Spec = { count: number; extra?: Partial<JoinOptions> };

const opts = (count: number, extra: Partial<JoinOptions> = {}): JoinOptions => ({
  moveEnd: count - 1,
  tailFrames: 0,
  evenTailOnly: false,
  reducedStills: null,
  tolerance: Math.max(8, Math.round(count / 32)),
  ...extra,
});

const key = (job: number) => `${jobSeg(job)}#${jobFrame(job)}`;

/**
 * A fake loader around the planner. `frames` is the budget in frames of FRAME bytes. Every pump asserts the budget:
 * decoded + reserved never above it, the wanted set within its share. Evictions are checked against the wanted set and
 * the always-kept frames.
 */
function harness(frames: number, specs: Spec[], cfg: Partial<PlannerConfig> = {}) {
  const network: string[] = [];
  const decodes: string[] = [];
  const evicted: string[] = [];
  const dropped: string[] = [];
  const held = new Set<string>();
  let fetching: { job: number; epoch: number }[] = [];
  let decoding: { job: number; epoch: number }[] = [];
  let now = 0;
  let active = 0;
  let frame = 0;
  let dir = 0;
  // leave / retier let go of wanted frames by design: the eviction guard is off while they run.
  let releasing = false;
  const last = (i: number) => specs[i].count - 1;
  const moveEnd = (i: number) => specs[i].extra?.moveEnd ?? last(i);
  // FilmBackdrop's entry rule: 0 ahead; behind, the last frame with tails, else M.
  const entry = (i: number) => (i > active ? 0 : (specs[i].extra?.tailFrames ?? 0) > 0 ? last(i) : moveEnd(i));
  const keptNow = () => {
    const k = new Set([`${active}#0`, `${active}#${moveEnd(active)}`, `${active}#${last(active)}`]);
    for (const n of [active - 1, active + 1]) if (specs[n]) k.add(`${n}#${entry(n)}`);
    return k;
  };
  const p = createBudgetPlanner({
    budgetBytes: frames * FRAME,
    maxFetches: 6,
    engaged: true,
    ...cfg,
    onEvict: (s, f, bytes) => {
      const k = `${s}#${f}`;
      assert.equal(bytes, FRAME);
      if (!releasing) {
        assert.ok(!p.isWanted(s, f), `evicted wanted frame ${k}`);
        assert.ok(!keptNow().has(k) || !p.usable(s, f), `evicted always-kept frame ${k}`);
      }
      held.delete(k);
      evicted.push(k);
    },
    onBytesDropped: (s, f) => {
      dropped.push(`${s}#${f}`);
    },
  });
  specs.forEach((s, i) => p.join(i, s.count, W, ASPECT, opts(s.count, s.extra)));
  specs.forEach((_, i) => p.setNear(i, true));

  const check = () => {
    assert.ok(p.usedBytes + p.reservedBytes <= p.budgetBytes, `decoded ${p.usedBytes} + reserved ${p.reservedBytes} > ${p.budgetBytes}`);
    assert.ok(p.wantedSetBytes() <= p.wantedBytes, `wanted ${p.wantedSetBytes()} > ${p.wantedBytes}`);
    assert.ok(p.fetchesInFlight <= p.maxFetches);
    assert.ok(p.decodesInFlight <= p.maxDecodes);
  };
  const pump = () => {
    let j: number;
    while ((j = p.nextFetch(now)) !== NONE) {
      fetching.push({ job: j, epoch: p.epoch(jobSeg(j)) });
      network.push(key(j));
    }
    while ((j = p.nextDecode(now)) !== NONE) {
      const k = key(j);
      assert.ok(!held.has(k), `decoded ${k} while it is held`);
      decoding.push({ job: j, epoch: p.epoch(jobSeg(j)) });
      decodes.push(k);
      check();
    }
    check();
  };
  /** Lands up to `nf` fetches and `nd` decodes in flight (oldest first), then pumps. */
  const land = (nf = Infinity, nd = Infinity) => {
    const f = fetching.slice(0, nf);
    fetching = fetching.slice(f.length);
    for (const x of f) p.fetched(jobSeg(x.job), jobFrame(x.job), x.epoch, SIZE);
    const d = decoding.slice(0, nd);
    decoding = decoding.slice(d.length);
    for (const x of d) if (p.decoded(jobSeg(x.job), jobFrame(x.job), x.epoch)) held.add(key(x.job));
    pump();
  };
  const settle = () => {
    for (let r = 0; r < 10_000 && (fetching.length || decoding.length); r++) land();
  };
  const want = (a: number, f: number, d: number) => {
    active = a;
    frame = f;
    dir = d;
    p.want(a, f, d, entry);
    pump();
  };
  /** Wanted frames of segment `s` (in decode order). */
  const wantedOf = (s: number) => p.wantedJobs().filter((j) => jobSeg(j) === s).map(jobFrame);
  return {
    p,
    network,
    decodes,
    evicted,
    dropped,
    held,
    want,
    land,
    settle,
    pump,
    wantedOf,
    fetching: () => fetching,
    decoding: () => decoding,
    setNow: (t: number) => {
      now = t;
    },
    state: () => ({ active, frame, dir }),
    release: (fn: () => void) => {
      releasing = true;
      fn();
      releasing = false;
    },
  };
}

describe("budget planner: the budget", () => {
  it("is never exceeded, reserved decodes included, on forward, backward and jumping scrubs", () => {
    const h = harness(20, [{ count: 241 }, { count: 241 }, { count: 241 }]);
    const path: [number, number][] = [];
    for (let f = 0; f <= 240; f += 2) path.push([0, f]);
    for (let f = 0; f <= 240; f += 3) path.push([1, f]);
    for (let f = 240; f >= 0; f -= 2) path.push([1, f]);
    for (const [s, f] of [[2, 200], [0, 3], [1, 150], [2, 77], [0, 239], [1, 0], [2, 120]] as const) path.push([s, f]);
    let prev = 0;
    for (const [s, f] of path) {
      const pos = s * 1000 + f;
      h.want(s, f, Math.sign(pos - prev));
      prev = pos;
      // Land a little at a time so decodes are often in flight (reserved) while others start.
      h.land(2, 1);
      h.land(1, 1);
    }
    h.settle();
    assert.ok(h.p.usedBytes <= h.p.budgetBytes);
    assert.equal(h.p.reservedBytes, 0);
  });

  it("a decode reserves its bytes when it starts, and they become decoded bytes when it lands", () => {
    const h = harness(20, [{ count: 64 }]);
    h.want(0, 10, 1);
    h.land(Infinity, 0); // bytes arrive, decodes start
    assert.equal(h.decoding().length, h.p.maxDecodes);
    assert.equal(h.p.reservedBytes, h.p.maxDecodes * FRAME);
    assert.equal(h.p.usedBytes, 0);
    h.land(0, 1);
    assert.equal(h.p.usedBytes, FRAME);
    assert.equal(h.decodes[0], "0#10", "the target decodes first");
  });

  it("near frames survive the arrival of far ones (the next segment's head)", () => {
    const h = harness(20, [{ count: 241 }, { count: 241 }]);
    h.want(0, 100, 1);
    h.settle();
    const near = h.wantedOf(0);
    for (const i of near) assert.ok(h.p.isDecoded(0, i), `frame ${i} decoded`);
    // Close to the end: the next segment's head joins the wanted set and arrives; only frames that left it may go.
    for (let f = 101; f <= 235; f++) {
      h.want(0, f, 1);
      h.land();
    }
    h.settle();
    assert.ok(h.wantedOf(1).length > 0, "the next head is wanted near the end");
    for (const j of h.p.wantedJobs()) assert.ok(h.p.isDecoded(jobSeg(j), jobFrame(j)), `${key(j)} decoded`);
    for (const f of [234, 235, 236, 237]) assert.ok(h.p.isDecoded(0, f), `near frame ${f} held`);
    assert.ok(h.evicted.length > 0, "something was evicted (the guard ran)");
  });

  it("never evicts the always-kept frames, however hard the window pushes", () => {
    // A small budget (10 frames: 8 wanted) and three segments: the kept frames take most of it.
    const h = harness(10, [{ count: 120 }, { count: 120 }, { count: 120 }]);
    // The harness's onEvict guard fails the test the moment a wanted or always-kept frame is evicted.
    for (let f = 0; f <= 119; f++) {
      h.want(1, f, 1);
      h.land(3, 1);
    }
    h.settle();
    assert.ok(h.evicted.length > 50, `evictions ${h.evicted.length}: the window pushed`);
    for (const k of ["1#0", "1#119", "0#119", "2#0"]) {
      const [s, f] = k.split("#").map(Number);
      assert.ok(h.p.isWanted(s, f), `${k} is kept`);
      assert.ok(h.p.isDecoded(s, f), `${k} is held`);
    }
  });
});

describe("budget planner: the wanted set", () => {
  it("leans ahead in the direction of travel and is symmetric at rest", () => {
    const h = harness(40, [{ count: 241 }]);
    const n = h.p.wantedBytes / FRAME;
    h.want(0, 120, 1);
    let w = h.wantedOf(0);
    assert.equal(w[0], 120, "the target first");
    assert.equal(w.length, Math.floor(n));
    const ahead = (xs: number[]) => xs.filter((i) => i > 120 && i < 200).length;
    const behind = (xs: number[]) => xs.filter((i) => i < 120 && i > 40).length;
    assert.ok(ahead(w) > 2 * behind(w), `down: ahead ${ahead(w)} behind ${behind(w)}`);
    h.want(0, 120, -1);
    w = h.wantedOf(0);
    assert.ok(behind(w) > 2 * ahead(w), `up: ahead ${ahead(w)} behind ${behind(w)}`);
    h.want(0, 120, 0);
    w = h.wantedOf(0);
    assert.ok(Math.abs(ahead(w) - behind(w)) <= 1, `rest: ahead ${ahead(w)} behind ${behind(w)}`);
    // At the start of a film the behind share moves ahead: a run from 0.
    h.want(0, 0, 1);
    const run = h.wantedOf(0).filter((i) => i !== 240);
    assert.deepEqual([...run].sort((a, b) => a - b), Array.from({ length: run.length }, (_, i) => i));
  });

  it("orders decodes coarse first: the target, every 4th frame nearest first, the kept frames, then the rest", () => {
    const h = harness(40, [{ count: 241 }, { count: 241 }]);
    h.want(0, 101, 1);
    const w = h.p.wantedJobs().map((j) => [jobSeg(j), jobFrame(j)] as const);
    assert.deepEqual(w[0], [0, 101]);
    const firstFine = w.findIndex(([s, i], k) => k > 0 && s === 0 && i % COARSE !== 0 && i !== 240);
    const coarse = w.slice(1, firstFine).filter(([s, i]) => s === 0 && i !== 240 && i !== 0);
    assert.ok(coarse.length >= 5);
    assert.ok(coarse.every(([, i]) => i % COARSE === 0), `coarse pass: ${coarse.map(([, i]) => i)}`);
    // Nearest first by weighted distance (ahead d / 0.7, behind d / 0.3): 100 (3.3), 104 (4.3), 108 (10), 112 (15.7), 96 (16.7).
    assert.deepEqual(coarse.slice(0, 5).map(([, i]) => i), [100, 104, 108, 112, 96]);
    // The kept frames follow the coarse pass, before any in-between frame.
    const kept = w.findIndex(([s, i]) => s === 0 && i === 240);
    assert.ok(kept > 0 && kept < firstFine, "M / last before the fine pass");
    assert.ok(w.some(([s, i]) => s === 1 && i === 0), "the next segment's entry frame is kept");
  });

  it("a direction flip re-plans without dropping what is still wanted", () => {
    const h = harness(30, [{ count: 241 }]);
    h.want(0, 120, 1);
    h.settle();
    const before = new Set(h.wantedOf(0));
    const evictedBefore = h.evicted.length;
    h.want(0, 120, -1);
    const after = h.wantedOf(0);
    const kept = after.filter((i) => before.has(i));
    assert.ok(kept.length > 0);
    // The order re-plans: the fetch order now leans down the frame numbers.
    const order = h.p.fetchOrder().map(jobFrame);
    const firstStride16 = order.slice(4, 8);
    assert.ok(firstStride16.every((i) => i <= 120), `up: ${firstStride16}`);
    h.settle();
    for (const i of kept) assert.ok(h.p.isDecoded(0, i), `still-wanted frame ${i} was dropped`);
    for (const e of h.evicted.slice(evictedBefore)) assert.ok(!after.includes(Number(e.split("#")[1])));
  });

  it("never fetches or decodes an unusable frame: odd tail frames on a coarse pointer, non-stills under reduced motion", () => {
    const tail: Spec = { count: 241, extra: { moveEnd: 192, tailFrames: 48, evenTailOnly: true } };
    const h = harness(30, [tail, { count: 121 }]);
    for (let f = 0; f <= 240; f++) {
      h.want(0, f, 1);
      h.land();
    }
    for (let f = 0; f <= 120; f++) {
      h.want(1, f, 1);
      h.land();
    }
    for (let f = 240; f >= 150; f--) {
      h.want(0, f, -1);
      h.land();
    }
    h.settle();
    const odd = (k: string) => k.startsWith("0#") && Number(k.slice(2)) > 192 && (Number(k.slice(2)) - 192) % 2 === 1;
    assert.equal(h.network.filter(odd).length, 0, "an odd tail frame was fetched");
    assert.equal(h.decodes.filter(odd).length, 0, "an odd tail frame was decoded");
    assert.ok(h.network.includes("0#194") && h.network.includes("0#240"));

    const stills = [0, 30, 60, 90, 120];
    const r = harness(30, [{ count: 121, extra: { reducedStills: stills } }, { count: 121, extra: { reducedStills: stills } }]);
    for (const f of [0, 30, 60, 90, 120]) {
      r.want(0, f, 1);
      r.land();
    }
    r.want(1, 60, 1);
    r.settle();
    const frames = (xs: string[]) => new Set(xs.map((k) => Number(k.split("#")[1])));
    for (const f of frames(r.network)) assert.ok(stills.includes(f), `fetched non-still ${f}`);
    for (const f of frames(r.decodes)) assert.ok(stills.includes(f), `decoded non-still ${f}`);
  });
});

describe("budget planner: bytes are fetched once", () => {
  it("a steady one-way scrub through a film and into the next asks once per frame and never decodes a held frame", () => {
    const h = harness(20, [{ count: 241 }, { count: 241 }, { count: 241 }]);
    for (let f = 0; f <= 240; f++) {
      h.want(0, f, 1);
      h.land();
      h.land();
    }
    for (let f = 0; f <= 240; f++) {
      h.want(1, f, 1);
      h.land();
      h.land();
    }
    h.settle();
    assert.equal(new Set(h.network).size, h.network.length, "a frame's bytes asked for twice");
    assert.equal(h.p.counters.refetches, 0);
    assert.equal(h.network.filter((k) => k.startsWith("0#")).length, 241, "every frame of film 0 once");
    assert.equal(h.network.filter((k) => k.startsWith("1#")).length, 241, "every frame of film 1 once");
    assert.ok(h.p.isDecoded(1, 240));
  });

  it("coming back re-decodes from kept bytes and fetches nothing", () => {
    const h = harness(20, [{ count: 241 }, { count: 241 }]);
    for (let f = 0; f <= 240; f++) {
      h.want(0, f, 1);
      h.land();
    }
    for (let f = 0; f <= 240; f++) {
      h.want(1, f, 1);
      h.land();
    }
    h.settle();
    const fetched = h.network.length;
    const redecodes = h.p.counters.redecodes;
    for (let f = 240; f >= 0; f--) {
      h.want(1, f, -1);
      h.land();
    }
    for (let f = 240; f >= 0; f--) {
      h.want(0, f, -1);
      h.land();
    }
    h.settle();
    assert.equal(h.network.length, fetched, "the way back made a request");
    assert.equal(h.p.counters.refetches, 0);
    assert.ok(h.p.counters.redecodes > redecodes + 100, `redecodes ${h.p.counters.redecodes}`);
    assert.ok(h.p.isDecoded(0, 0));
  });

  it("a started fetch is never aborted: its bytes are kept when the target leaps away, and serve the way back", () => {
    const h = harness(20, [{ count: 241 }]);
    h.want(0, 100, 1);
    const first = h.fetching().map((x) => key(x.job));
    assert.equal(first.length, 6);
    assert.equal(first[0], "0#100");
    h.want(0, 10, 1); // a leap: the queue is re-ordered, the six in flight go on
    assert.equal(h.fetching().length, 6);
    h.land(Infinity, 0);
    for (const k of first) assert.ok(h.p.hasBytes(0, Number(k.slice(2))), `${k} bytes kept`);
    assert.equal(h.network[6], "0#10", "the new target comes next");
    h.settle();
    h.want(0, 100, 1);
    h.settle();
    assert.equal(h.network.filter((k) => k === "0#100").length, 1);
  });
});

describe("budget planner: the fetch order", () => {
  it("target, M, last, 0, then strides 16, 8, 4 ahead first; the head of the neighbour ahead; strides 2, 1; the neighbour ahead, then the one behind; far ones only 0, M, last", () => {
    const h = harness(20, [{ count: 65 }, { count: 65 }, { count: 65 }, { count: 65 }], { maxFetches: 0 });
    h.want(1, 20, 1);
    const o = h.p.fetchOrder().map(key);
    assert.deepEqual(o.slice(0, 4), ["1#20", "1#64", "1#0", "1#32"]);
    // Stride 16, ahead first (down: 32, 48, 64 done), then behind: 16, 0 done.
    assert.deepEqual(o.slice(3, 6), ["1#32", "1#48", "1#16"]);
    const firstOf = (s: number) => o.findIndex((k) => k.startsWith(`${s}#`));
    const lastOf = (s: number) => o.length - 1 - [...o].reverse().findIndex((k) => k.startsWith(`${s}#`));
    // The active film's coarse passes (every 4th frame), then the head of the film ahead (its entry 0, M = last = 64,
    // then every 4th frame up to NEXT_HEAD_FRAMES), then the active film's fine passes, then the rest of the film ahead.
    const fine = o.findIndex((k) => k.startsWith("1#") && Number(k.slice(2)) % 4 !== 0);
    assert.ok(o.slice(0, firstOf(2)).every((k) => k.startsWith("1#") && Number(k.slice(2)) % 4 === 0), "coarse passes first");
    assert.deepEqual(o.slice(firstOf(2), fine), ["2#0", "2#64", "2#4", "2#8", "2#12", "2#16", "2#20", "2#24", "2#28", "2#32"]);
    const restOf2 = o.findIndex((k, i) => i > fine && k.startsWith("2#"));
    assert.ok(lastOf(1) < restOf2 && lastOf(2) < firstOf(0), "active, then the rest of ahead (2), then behind (0)");
    assert.equal(o.filter((k) => k.startsWith("1#")).length, 65);
    assert.equal(o.filter((k) => k.startsWith("2#")).length, 65);
    assert.deepEqual(o.filter((k) => k.startsWith("3#")).sort(), ["3#0", "3#64"]);
    // Going up: the neighbour behind the old direction (0) is now ahead, entered at its end.
    h.want(1, 20, -1);
    const up = h.p.fetchOrder().map(key);
    const firstUp = up.findIndex((k) => !k.startsWith("1#"));
    assert.equal(up[firstUp], "0#64");
  });

  it("near the end of a film, the next film's first frames are fetched before the active film's fine passes", () => {
    // A slow network: 3 fetches at a time, each landing a while later; the visitor runs down a long film to its end.
    const h = harness(40, [{ count: 289 }, { count: 145 }], { maxFetches: 3 });
    let crossedWith = -1;
    for (let f = 0; f <= 288; f += 6) {
      h.want(0, f, 1);
      // Two rounds of fetches land per step: the network is slower than the scroll.
      h.land();
      h.land();
      if (crossedWith < 0 && f >= 280) crossedWith = h.network.filter((k) => k.startsWith("1#")).length;
    }
    const order = h.network;
    const got = new Set(order);
    assert.ok(got.has("1#0"), "the next film's entry frame arrived before the scroll crossed into it");
    assert.ok(["1#4", "1#8", "1#12"].every((k) => got.has(k)), `its head too: ${order.filter((k) => k.startsWith("1#")).slice(0, 12)}`);
    assert.ok(crossedWith >= 4);
    // The active film's odd frames were still missing then: the head did not wait for them.
    assert.ok([...Array(289).keys()].some((i) => i % 2 === 1 && !got.has(`0#${i}`)));
  });

  it("the idle gate: before the visitor engages, the active skeleton and the next segment's 0, M and last only", () => {
    const h = harness(40, [{ count: 40 }, { count: 40 }, { count: 40 }], { engaged: false });
    h.want(0, 0, 0);
    h.settle();
    const a = h.network.filter((k) => k.startsWith("0#")).map((k) => Number(k.slice(2)));
    assert.ok(a.every((k) => k % 4 === 0 || k === 39), `a: ${a}`);
    assert.equal(a.length, 11);
    assert.deepEqual(h.network.filter((k) => k.startsWith("1#")).sort(), ["1#0", "1#39"]);
    assert.equal(h.network.filter((k) => k.startsWith("2#")).length, 0);
    h.p.engage();
    h.pump();
    h.settle();
    assert.equal(new Set(h.network.filter((k) => k.startsWith("0#"))).size, 40);
    assert.equal(new Set(h.network.filter((k) => k.startsWith("1#"))).size, 40);
  });

  it("requests nothing for a segment that is not near; at most maxFetches in flight", () => {
    const h = harness(20, [{ count: 64 }], { maxFetches: 3 });
    h.p.setNear(0, false);
    h.want(0, 0, 1);
    assert.equal(h.network.length, 0);
    h.p.setNear(0, true);
    h.pump();
    assert.equal(h.fetching().length, 3);
    h.settle();
    assert.equal(h.network.length, 64);
  });

  it("a failed fetch is retried with backoff, given up after 3 tries, and forgiven when the network returns", () => {
    const h = harness(20, [{ count: 16 }]);
    h.want(0, 5, 1);
    const j = h.fetching()[0];
    assert.equal(key(j.job), "0#5");
    // Fail it: the slot frees, frame 5 waits RETRY_BASE_MS.
    h.fetching().shift();
    assert.equal(h.p.fetchFailed(0, 5, j.epoch, 0), false);
    h.settle();
    assert.equal(h.network.filter((k) => k === "0#5").length, 1);
    assert.equal(h.p.nextRetryAt(), RETRY_BASE_MS);
    let t = 0;
    for (let tryNo = 2; tryNo <= FETCH_TRIES; tryNo++) {
      t += RETRY_BASE_MS * 2 ** (tryNo - 2);
      h.setNow(t);
      h.want(0, 5, 1);
      h.pump();
      const again = h.fetching().find((x) => key(x.job) === "0#5")!;
      assert.ok(again, `try ${tryNo}`);
      h.fetching().splice(h.fetching().indexOf(again), 1);
      assert.equal(h.p.fetchFailed(0, 5, again.epoch, t), tryNo === FETCH_TRIES);
    }
    h.setNow(t + 60_000);
    h.pump();
    assert.ok(h.p.isMissing(0, 5));
    assert.equal(h.p.nearestDecoded(0, 5), 4, "a neighbour covers it (lower first)");
    assert.equal(h.p.isComing(0, 5, 0), false);
    h.p.setOffline(true);
    h.p.forgive();
    h.pump();
    assert.equal(h.fetching().length, 0, "nothing starts while offline");
    h.p.setOffline(false);
    h.pump();
    h.settle();
    assert.ok(h.p.hasBytes(0, 5));
  });

  it("a failed fetch of a frame other than the target is retried too, and stops being 'coming' once given up", () => {
    const h = harness(80, [{ count: 64 }]);
    h.want(0, 20, 1);
    // The 6th fetch started (the order passed it): fail it, then let everything else land.
    const failed = h.fetching()[5];
    const f = jobFrame(failed.job);
    assert.notEqual(f, 20);
    h.fetching().splice(5, 1);
    assert.equal(h.p.fetchFailed(0, f, failed.epoch, 0), false);
    let t = 0;
    for (let tryNo = 2; tryNo <= FETCH_TRIES; tryNo++) {
      h.settle();
      t += 60_000;
      h.setNow(t);
      h.pump(); // the retry timer fires: no want(), no re-plan
      const again = h.fetching().find((x) => jobFrame(x.job) === f);
      assert.ok(again, `frame ${f} fetched again (try ${tryNo})`);
      h.fetching().splice(h.fetching().indexOf(again), 1);
      assert.equal(h.p.fetchFailed(0, f, again.epoch, t), tryNo === FETCH_TRIES);
    }
    h.settle();
    assert.equal(h.network.filter((k) => k === `0#${f}`).length, FETCH_TRIES);
    assert.ok(h.p.isMissing(0, f));
    assert.equal(h.p.isComing(0, f, 0), false, "a frame given up is not waited for");
  });

  it("a failed decode keeps its bytes and spends no fetch try; the streak counts frames, and a decode that works ends it", () => {
    const h = harness(20, [{ count: 16 }]);
    h.want(0, 5, 1);
    h.land(Infinity, 0); // bytes only
    const first = h.decoding().splice(0, 2);
    for (const d of first) assert.equal(h.p.decodeFailed(0, jobFrame(d.job), d.epoch, 0), false);
    assert.equal(h.p.decodeErrorStreak, 2);
    for (const d of first) assert.ok(h.p.hasBytes(0, jobFrame(d.job)), "bytes kept");
    h.pump();
    h.land(0, 1);
    assert.equal(h.p.decodeErrorStreak, 0, "a decode that works ends the streak");
    h.settle();
    assert.ok(!h.p.isDecoded(0, jobFrame(first[0].job)), "not retried before its backoff");
    h.setNow(RETRY_BASE_MS);
    h.pump();
    const again = h.decoding().find((d) => d.job === first[0].job)!;
    assert.ok(again, "decode retried after the backoff");
    h.decoding().splice(h.decoding().indexOf(again), 1);
    h.p.decodeFailed(0, jobFrame(again.job), again.epoch, RETRY_BASE_MS);
    assert.equal(h.p.decodeErrorStreak, 0, "the same frame failing again is not another frame");
    h.setNow(10 * RETRY_BASE_MS);
    h.pump();
    h.settle();
    assert.ok(h.p.isDecoded(0, jobFrame(first[0].job)), "its third try worked");
    assert.equal(h.p.counters.refetches, 0);
    assert.equal(h.network.filter((k) => k === key(first[0].job)).length, 1, "never fetched again");
    h.p.forgetBytes();
    assert.equal(h.p.decodeErrorStreak, 0);
  });

  it("starts nothing while paused (the document is hidden)", () => {
    const h = harness(20, [{ count: 16 }]);
    h.p.setPaused(true);
    h.want(0, 5, 1);
    assert.equal(h.network.length, 0);
    h.p.setPaused(false);
    h.pump();
    assert.ok(h.network.length > 0);
  });
});

describe("budget planner: the compressed-byte cap", () => {
  it("drops the farthest film's bytes first, never the active segment's or its neighbours', never 0, M and last", () => {
    // Five films of 41 frames; a cap of 120 frames' bytes: the active film and both neighbours (123 frames) fit only
    // when films farther away give theirs up.
    const specs = Array.from({ length: 5 }, () => ({ count: 41 }));
    const h = harness(40, specs, { bytesCapBytes: 130 * SIZE });
    for (const a of [0, 1, 2, 3, 4]) {
      for (let f = 0; f <= 40; f += 2) {
        h.want(a, f, 1);
        h.land();
      }
      h.settle();
    }
    assert.ok(h.dropped.length > 0, "the cap bound");
    assert.ok(h.p.bytesHeld <= 130 * SIZE);
    // At the end the active film is 4: the first drops after it became active came from film 0, the farthest.
    const segOf = (k: string) => Number(k.split("#")[0]);
    assert.equal(segOf(h.dropped[0]), 0, `first drop ${h.dropped[0]}`);
    for (const k of h.dropped) {
      const f = Number(k.split("#")[1]);
      assert.ok(f !== 0 && f !== 40, `dropped kept bytes ${k}`);
    }
    for (let f = 0; f <= 40; f++) assert.ok(h.p.hasBytes(4, f) || !h.p.usable(4, f), `active film 4 lost frame ${f}`);
  });
});

describe("budget planner: leave, retier and arrivals", () => {
  it("a decode or fetch that lands after its segment left is stale: the bitmap is closed, the reservation released", () => {
    const h = harness(20, [{ count: 32 }, { count: 32 }]);
    h.want(0, 4, 1);
    h.land(Infinity, 0);
    assert.ok(h.decoding().length > 0);
    const reserved = h.p.reservedBytes;
    assert.ok(reserved > 0);
    h.release(() => h.p.leave(0));
    assert.equal(h.p.loaded(0), 0);
    assert.equal(h.p.width(0), 0);
    const d = h.decoding().shift()!;
    assert.equal(h.p.decoded(jobSeg(d.job), jobFrame(d.job), d.epoch), false);
    assert.equal(h.p.reservedBytes, reserved - FRAME);
    h.p.join(0, 32, W, ASPECT, opts(32));
    h.p.setNear(0, true);
    h.p.rerank();
    h.want(0, 4, 1);
    h.settle();
    assert.equal(h.p.reservedBytes, 0, "every orphaned reservation released");
    assert.ok(h.p.isDecoded(0, 4));
  });

  it("retier moves a segment to another width: its old bytes and frames go, it fetches at the new one", () => {
    const h = harness(20, [{ count: 32 }, { count: 32 }]);
    h.want(0, 0, 1);
    h.settle();
    assert.ok(h.p.loaded(1) > 0);
    const before = h.network.length;
    h.release(() => h.p.retier(1, 299));
    assert.equal(h.p.width(1), 299);
    assert.equal(h.p.loaded(1), 0);
    assert.ok(h.dropped.some((k) => k.startsWith("1#")));
    h.want(0, 1, 1);
    h.settle();
    assert.ok(h.network.slice(before).some((k) => k.startsWith("1#")), "segment 1 fetched again at its new tier");
  });

  it("isComing: a wanted frame with bytes held, fetching or queued; not one never fetched", () => {
    const h = harness(20, [{ count: 64 }], { engaged: false });
    h.want(0, 0, 0);
    assert.equal(h.p.isComing(0, 0, 0), true, "fetching");
    assert.equal(h.p.isComing(0, 4, 0), true, "queued (skeleton)");
    assert.equal(h.p.isComing(0, 5, 0), false, "not in the order before engage");
    h.settle();
    assert.equal(h.p.isComing(0, 4, 0), false, "decoded");
    assert.equal(h.p.nearestDecoded(0, 5), 4);
    assert.equal(h.p.nearestDecoded(0, 6), 4, "lower first on a tie");
  });
});

describe("budget planner: frames per budget", () => {
  it("prints the real tiers at 96, 160, 384 and 512 MB", () => {
    const tiers: [number, number][] = [
      [432, 936],
      [499, 1080],
      [720, 1560],
      [768, 432],
      [1280, 720],
      [1920, 1080],
    ];
    const budgets = [96, 160, 384, 512];
    const rows: string[] = [`tier        frame MB   ${budgets.map((b) => `${b} MB (all/wanted)`.padStart(20)).join("")}`];
    for (const [w, ht] of tiers) {
      const fb = tierFrameBytes(w, w / ht);
      assert.equal(fb, w * ht * 4);
      const cells = budgets.map((b) => {
        const p = createBudgetPlanner({ budgetBytes: b * MB, maxFetches: 6, engaged: true });
        p.join(0, 2000, w, w / ht, opts(2000));
        p.want(0, 1000, 0, () => 0);
        const all = Math.floor((b * MB) / fb);
        return `${all} / ${p.wantedJobs().length}`.padStart(20);
      });
      rows.push(`${`${w}x${ht}`.padEnd(12)}${(fb / MB).toFixed(2).padStart(8)}   ${cells.join("")}`);
    }
    console.log(`\n${rows.join("\n")}\n`);
    // Spot checks: a phone at 160 MB holds 103 frames of 432 x 936 (82 wanted); a laptop at 384 MB 48 of 1920 x 1080.
    assert.equal(Math.floor((160 * MB) / tierFrameBytes(432, 432 / 936)), 103);
    assert.equal(Math.floor((384 * MB) / tierFrameBytes(1920, 1920 / 1080)), 48);
  });
});

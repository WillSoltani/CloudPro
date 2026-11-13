// Tests for components/film/loader/legacy.ts against the FrameLoader interface, with a fake Image (decodes settle when
// the test says so) and fake resource timing. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FilmManifest } from "../filmCore";
import { createLegacyLoader } from "./legacy";
import type { FrameLoader, JoinOptions, LoaderEnv, WantPlan } from "./types";

type Req = { film: string; width: number; frame: number };

/** A stand-in for the browser's Image: decode() settles when the test calls finish() or fail(). */
function fakeImages() {
  const made: FakeImage[] = [];
  class FakeImage {
    decoding = "";
    crossOrigin: string | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    settled = false;
    private url = "";
    private resolve!: () => void;
    private reject!: (e: Error) => void;
    private promise = new Promise<void>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
    constructor() {
      made.push(this);
    }
    get src() {
      return this.url;
    }
    set src(v: string) {
      this.url = v;
    }
    decode() {
      return this.promise;
    }
    finish() {
      this.settled = true;
      this.naturalWidth = 16;
      this.naturalHeight = 9;
      this.resolve();
    }
    fail() {
      this.settled = true;
      this.reject(new Error("decode"));
    }
  }
  return { FakeImage, made };
}

const film = (name: string, count: number): FilmManifest => ({
  name,
  count,
  fps: 24,
  widths: [768, 1280],
  aspect: 16 / 9,
  pad: 4,
  ext: "webp",
  base: `/films/${name}`,
  poster: "",
});

const opts = (count: number, extra: Partial<JoinOptions> = {}): JoinOptions => ({
  moveEnd: count - 1,
  tailFrames: 0,
  evenTailOnly: false,
  reducedStills: null,
  tolerance: Math.max(8, Math.round(count / 32)),
  ...extra,
});

const flush = () => new Promise<void>((r) => setImmediate(r));

function setup(env: Partial<LoaderEnv> = {}) {
  const { FakeImage, made } = fakeImages();
  const requests: Req[] = [];
  const counts = { decoded: 0, dropped: 0, failed: 0, alive: 0, inflight: 0, inflightPeak: 0 };
  const loader = createLegacyLoader({
    stats: {
      requested: (f, width, frame, inflight) => {
        requests.push({ film: f, width, frame });
        counts.inflight = inflight;
        counts.inflightPeak = Math.max(counts.inflightPeak, inflight);
      },
      released: (inflight) => {
        counts.inflight = inflight;
      },
      decoded: () => {
        counts.decoded++;
        counts.alive++;
      },
      dropped: () => {
        counts.dropped++;
        counts.alive--;
      },
      failed: () => {
        counts.failed++;
      },
    },
    connection: { effectiveType: "4g" },
    engaged: true,
    tier: () => 768,
    Image: FakeImage,
    ...env,
  });
  /** Settles every live decode (not one whose request was cancelled) until nothing new is requested. */
  const drain = async (rounds = 1000) => {
    for (let r = 0; r < rounds; r++) {
      const open = made.filter((m) => !m.settled && m.src !== "");
      if (!open.length) return;
      for (const m of open) m.finish();
      await flush();
    }
  };
  /** Settles the first `n` live decodes in request order. */
  const settleFirst = async (n: number) => {
    for (const m of made.filter((x) => !x.settled && x.src !== "").slice(0, n)) m.finish();
    await flush();
  };
  return { loader, requests, counts, made, drain, settleFirst };
}

const plan = (active: number, frame: number, entry: (i: number) => number = () => 0): WantPlan => ({
  active,
  frame,
  direction: 1,
  entry,
});

const framesOf = (reqs: Req[], name: string) => reqs.filter((r) => r.film === name).map((r) => r.frame);

function joinAll(loader: FrameLoader, specs: { name: string; count: number; extra?: Partial<JoinOptions> }[], width = 768) {
  specs.forEach((s, i) => loader.join(i, film(s.name, s.count), width, opts(s.count, s.extra)));
  loader.setNear(specs.map((_, i) => [i, true] as const));
}

describe("legacy loader: request order", () => {
  it("asks for the target, M, last and 0, then each stride nearest-first, 6 at a time", async () => {
    const { loader, requests, drain, settleFirst } = setup();
    joinAll(loader, [{ name: "a", count: 64 }]);
    assert.deepEqual(requests, [], "nothing before the first want");
    loader.want(plan(0, 20));
    assert.deepEqual(framesOf(requests, "a"), [20, 63, 0, 16, 32, 48]);
    // One slot frees: the next frame of the stride-8 pass nearest to 20.
    await settleFirst(1);
    assert.deepEqual(framesOf(requests, "a").slice(6), [24]);
    await drain();
    const all = framesOf(requests, "a");
    assert.deepEqual(all.slice(0, 10), [20, 63, 0, 16, 32, 48, 24, 8, 40, 56]);
    assert.equal(all.length, 64, "every frame once");
    assert.equal(new Set(all).size, 64);
    assert.equal(loader.loaded(0), 64);
    assert.equal(loader.width(0), 768);
  });

  it("puts M before last when tail frames follow the move", () => {
    const { loader, requests } = setup();
    joinAll(loader, [{ name: "a", count: 48, extra: { moveEnd: 40, tailFrames: 7 } }]);
    loader.want(plan(0, 10));
    assert.deepEqual(framesOf(requests, "a").slice(0, 4), [10, 40, 47, 0]);
  });

  it("serves the active segment first, then its neighbours; a far segment only 0, M and last", async () => {
    const { loader, requests, drain } = setup();
    joinAll(loader, [
      { name: "a", count: 32 },
      { name: "b", count: 32 },
      { name: "c", count: 32 },
    ]);
    loader.want(plan(0, 0));
    await drain();
    const order = requests.map((r) => r.film);
    assert.equal(order.lastIndexOf("a") < order.indexOf("b"), true, "all of a before any of b");
    assert.equal(framesOf(requests, "b").length, 32);
    assert.deepEqual(framesOf(requests, "c").sort((x, y) => x - y), [0, 31]);
  });

  it("never asks for a frame that is not usable (odd tail frames on a coarse pointer, reduced-motion stills)", async () => {
    const coarse = setup();
    joinAll(coarse.loader, [{ name: "a", count: 48, extra: { moveEnd: 40, tailFrames: 7, evenTailOnly: true } }]);
    coarse.loader.want(plan(0, 0));
    await coarse.drain();
    const asked = framesOf(coarse.requests, "a");
    assert.deepEqual(asked.filter((k) => k > 40).sort((x, y) => x - y), [42, 44, 46]);
    assert.equal(coarse.loader.usable(0, 43), false);
    assert.equal(coarse.loader.usable(0, 44), true);

    const reduced = setup();
    joinAll(reduced.loader, [{ name: "a", count: 48, extra: { reducedStills: [0, 12, 24, 35, 47] } }]);
    reduced.loader.want(plan(0, 24));
    await reduced.drain();
    assert.deepEqual(framesOf(reduced.requests, "a"), [24, 47, 0, 35, 12]);
    assert.equal(reduced.loader.usable(0, 13), false);
    assert.equal(reduced.loader.usable(1, 0), false, "a segment that has not joined has no usable frame");
  });

  it("re-ranks around the target when it leaps more than 4 x the tolerance", async () => {
    const { loader, requests, settleFirst } = setup();
    joinAll(loader, [{ name: "a", count: 320 }]);
    loader.want(plan(0, 0));
    loader.want(plan(0, 30)); // 30 <= 4 x 10: no re-rank
    await settleFirst(1);
    assert.notEqual(framesOf(requests, "a").at(-1), 30);
    loader.want(plan(0, 200)); // a leap: the target comes next
    await settleFirst(1);
    assert.equal(framesOf(requests, "a").at(-1), 200);
  });
});

describe("legacy loader: the idle gate", () => {
  it("before engage: the active segment's stride-4 skeleton, the next one's 0, M and last, nothing further", async () => {
    const { loader, requests, drain } = setup({ engaged: false });
    joinAll(loader, [
      { name: "a", count: 40 },
      { name: "b", count: 40 },
      { name: "c", count: 40 },
    ]);
    loader.want(plan(0, 0));
    await drain();
    const a = framesOf(requests, "a");
    assert.ok(a.every((k) => k % 4 === 0 || k === 39), `a: ${a}`);
    assert.equal(a.length, 11); // 0, 4 … 36 and 39
    assert.deepEqual(framesOf(requests, "b").sort((x, y) => x - y), [0, 39]);
    assert.deepEqual(framesOf(requests, "c"), []);

    loader.engage();
    await drain();
    assert.equal(new Set(framesOf(requests, "a")).size, 40);
    assert.equal(new Set(framesOf(requests, "b")).size, 40);
    assert.deepEqual(framesOf(requests, "c").sort((x, y) => x - y), [0, 39]);
    const n = requests.length;
    loader.engage(); // idempotent
    await drain();
    assert.equal(requests.length, n);
  });

  it("requests nothing for a segment that is not near", async () => {
    const { loader, requests, drain } = setup();
    loader.join(0, film("a", 16), 768, opts(16));
    loader.want(plan(0, 0));
    await drain();
    assert.deepEqual(requests, []);
    loader.setNear([[0, true]]);
    await drain();
    assert.equal(requests.length, 16);
  });
});

describe("legacy loader: eviction", () => {
  it("segments more than one from the active one keep only 0, M and last", async () => {
    const { loader, requests, counts, drain } = setup();
    joinAll(loader, [
      { name: "a", count: 48, extra: { moveEnd: 40, tailFrames: 7 } },
      { name: "b", count: 32 },
      { name: "c", count: 32 },
      { name: "d", count: 32 },
    ]);
    loader.want(plan(0, 0));
    await drain();
    assert.equal(loader.loaded(0), 48);
    // Moving on to segment 2: a (index 0) is now two away.
    loader.want(plan(2, 0, (i) => (i > 2 ? 0 : i === 0 ? 47 : 31)));
    assert.equal(loader.loaded(0), 3);
    assert.equal(counts.alive, 3 + loader.loaded(1) + loader.loaded(2) + loader.loaded(3));
    for (const [k, want] of [[0, 0], [40, 40], [47, 47], [20, 0], [43, 40], [44, 47]] as const) {
      assert.equal(loader.nearest(0, k)?.frame, want, `nearest(0, ${k})`);
    }
    await drain();
    // Coming back to a: its frames are asked for again (the browser's cache answers them).
    const before = framesOf(requests, "a").length;
    loader.want(plan(0, 20));
    await drain();
    assert.equal(framesOf(requests, "a").length - before, 45);
    assert.equal(loader.loaded(0), 48);
  });

  it("cancels in-flight requests of an evicted segment except 0, M and last, and frees their slots", async () => {
    const { loader, requests, counts, made } = setup();
    joinAll(loader, [
      { name: "a", count: 64 },
      { name: "b", count: 64 },
      { name: "c", count: 64 },
    ]);
    loader.want(plan(0, 30)); // 6 of a in flight: 30, 63, 0, 32, 16, 48
    assert.deepEqual(framesOf(requests, "a"), [30, 63, 0, 32, 16, 48]);
    loader.want(plan(2, 0));
    // a's 30, 32, 16 and 48 were cancelled (src cleared), 63 and 0 are still in flight.
    const cancelled = made.filter((m) => m.src === "").length;
    assert.equal(cancelled, 4);
    assert.equal(counts.inflight, 6, "the four freed slots went to c at once");
    assert.equal(framesOf(requests, "c").length, 4);
  });
});

describe("legacy loader: no double request", () => {
  it("re-ranks, engage and repeated setNear never ask twice for a frame it holds or has in flight", async () => {
    const { loader, requests, drain, settleFirst } = setup({ engaged: false });
    joinAll(loader, [
      { name: "a", count: 96 },
      { name: "b", count: 96 },
    ]);
    loader.want(plan(0, 0));
    await settleFirst(3);
    loader.want(plan(0, 90));
    loader.setNear([[0, true], [1, true]]);
    await settleFirst(2);
    loader.engage();
    loader.want(plan(0, 50));
    loader.want(plan(1, 0, () => 95));
    loader.setNear([[1, true]]);
    await drain();
    for (const name of ["a", "b"]) {
      const asked = framesOf(requests, name);
      assert.equal(new Set(asked).size, asked.length, `${name} asked twice for a frame`);
      assert.equal(asked.length, 96);
    }
  });

  it("a failed frame is counted once and never asked for again", async () => {
    const { loader, requests, counts, made, drain } = setup();
    joinAll(loader, [{ name: "a", count: 16 }]);
    loader.want(plan(0, 5));
    made[0].fail();
    await flush();
    await drain();
    loader.want(plan(0, 5));
    loader.engage();
    await drain();
    assert.equal(counts.failed, 1);
    assert.equal(framesOf(requests, "a").filter((k) => k === 5).length, 1);
    assert.equal(loader.nearest(0, 5)?.frame, 4, "a neighbour covers it (lower first)");
    assert.equal(loader.isComing(0, 5, 2), false);
  });
});

describe("legacy loader: slow network and retier", () => {
  // No navigator.connection: the first 8 hero frames are timed from resource timing.
  const slowTiming = { getEntriesByName: () => [{ duration: 900 }] };

  it("a slow median moves only the segments two or more ahead, at the next segment boundary", async () => {
    const widthNow = { value: 1280 };
    const { loader, requests, settleFirst, drain } = setup({
      connection: undefined,
      timing: slowTiming,
      tier: () => widthNow.value,
    });
    joinAll(
      loader,
      [
        { name: "a", count: 32 },
        { name: "b", count: 32 },
        { name: "c", count: 32 },
        { name: "d", count: 32 },
      ],
      1280,
    );
    loader.want(plan(0, 0));
    assert.equal(loader.isSlow(), false);
    await settleFirst(6);
    assert.equal(loader.isSlow(), false, "six timed frames are not enough");
    await settleFirst(2); // eight hero frames have decoded: median 900 ms
    assert.equal(loader.isSlow(), true);
    widthNow.value = 768; // FilmBackdrop's tier() now picks the smallest
    loader.want(plan(0, 3)); // same segment: no retier mid-segment
    assert.deepEqual([0, 1, 2, 3].map((i) => loader.width(i)), [1280, 1280, 1280, 1280]);
    loader.want(plan(1, 0, (i) => (i > 1 ? 0 : 31))); // boundary: segments after 2 move
    assert.deepEqual([0, 1, 2, 3].map((i) => loader.width(i)), [1280, 1280, 1280, 768]);
    assert.equal(loader.loaded(3), 0);
    await drain();
    const d = requests.filter((r) => r.film === "d");
    assert.ok(d.length > 0);
    assert.ok(d.every((r) => r.width === 768), "d's frames at the new tier");
    assert.ok(requests.filter((r) => r.film === "c").every((r) => r.width === 1280), "c keeps its tier");
  });

  it("keeps 3 in flight on a slow connection class", () => {
    const { loader, requests } = setup({ connection: { effectiveType: "3g" } });
    joinAll(loader, [{ name: "a", count: 64 }]);
    loader.want(plan(0, 0));
    assert.equal(loader.isSlow(), true);
    assert.equal(requests.length, 3);
  });

  it("does not retier on a fast network", async () => {
    let asked = 0;
    const { loader } = setup({ tier: () => (asked++, 768) });
    joinAll(loader, [{ name: "a", count: 16 }, { name: "b", count: 16 }, { name: "c", count: 16 }, { name: "d", count: 16 }], 1280);
    loader.want(plan(0, 0));
    loader.want(plan(1, 0));
    assert.equal(asked, 0);
    assert.equal(loader.width(3), 1280);
  });
});

describe("legacy loader: arrivals, leave and dispose", () => {
  it("reports each decoded frame, and nothing after leave or dispose", async () => {
    const { loader, made, counts, drain } = setup();
    const arrived: [number, number][] = [];
    const off = loader.onArrive((i, f) => arrived.push([i, f]));
    joinAll(loader, [{ name: "a", count: 16 }, { name: "b", count: 16 }]);
    loader.want(plan(0, 4));
    made[0].finish();
    await flush();
    assert.deepEqual(arrived[0], [0, 4]);
    assert.equal(loader.isComing(0, 4, 0), false);
    assert.equal(loader.isComing(0, 9, 1), true, "frame 8 is in flight, 9 and 10 queued");
    const held = loader.nearest(0, 4)!;
    assert.deepEqual([held.frame, held.width, held.height], [4, 16, 9]);

    loader.leave(0);
    assert.equal(loader.loaded(0), 0);
    assert.equal(loader.width(0), 0);
    assert.equal(loader.nearest(0, 4), null);
    await drain();
    assert.ok(arrived.every(([i], k) => k === 0 || i === 1), "nothing of a after it left");
    off();
    const n = arrived.length;
    loader.dispose();
    assert.equal(counts.alive, 0, "every held frame was dropped");
    assert.equal(counts.inflight, 0);
    assert.equal(arrived.length, n);
  });
});

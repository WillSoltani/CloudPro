// Tests for the budget loader (components/film/loader/budget.ts) against the FrameLoader interface, with a fake worker
// (the real frame store, ./frame-worker.js, behind asynchronous messages), a fake fetch and a fake createImageBitmap
// whose decodes can be held, and a manual clock and timers. The counters go through the page's adapter (filmStats
// loaderStatsFor), so the totals checked here are the ones window.__filmStats shows. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FilmManifest } from "../filmCore";
import { frameBytes, loaderStatsFor, newInstrument } from "../filmStats";
import { createBudgetLoader, type BudgetOptions, type WorkerLike } from "./budget";
import { RETRY_BASE_MS } from "./budget-plan";
import { createFrameStore, type BitmapLike, type FetchLike } from "./frame-worker";
import type { FromWorker, ToWorker } from "./frame-worker-protocol";
import { loaderFromQuery, runnableLoader } from "./select";
import type { FrameLoader, JoinOptions, LoaderEnv, WantPlan } from "./types";

const W = 768;
const ASPECT = 16 / 9;
const FRAME = frameBytes(W, ASPECT);

const film = (name: string, count: number): FilmManifest => ({
  name,
  count,
  fps: 24,
  widths: [768, 1280],
  aspect: ASPECT,
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

const flush = async (rounds = 30) => {
  for (let r = 0; r < rounds; r++) await new Promise<void>((res) => setImmediate(res));
};

class FakeBitmap implements BitmapLike {
  closed = false;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly url: string,
  ) {}
  close() {
    this.closed = true;
  }
}

type WorkerMode = "ok" | "lacks" | "throws" | "none";

type SetupOptions = {
  worker?: WorkerMode;
  budgetFrames?: number;
  env?: Partial<LoaderEnv>;
  /** Answer for a fetch: a status, "error" (network error), or undefined for 200. */
  answer?: (url: string, attempt: number) => number | "error" | undefined;
};

function setup(o: SetupOptions = {}) {
  let clock = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let timerIds = 1;
  const fetched: string[] = [];
  const attempts = new Map<string, number>();
  const bitmaps: FakeBitmap[] = [];
  let holdDecodes = false;
  const heldDecodes: (() => void)[] = [];
  const workers: FakeWorker[] = [];
  const decodeSites: ("worker" | "main")[] = [];

  const fakeFetch: FetchLike = async (url) => {
    fetched.push(url);
    const n = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, n);
    const a = o.answer?.(url, n);
    if (a === "error") throw new Error("network");
    const status = a ?? 200;
    return { ok: status < 300, status, blob: async () => new Blob([url]) };
  };
  // A blob's text is its frame's URL, so the fake bitmap knows which frame it is.
  const decodeIn = (site: "worker" | "main") => async (blob: Blob) => {
    decodeSites.push(site);
    const url = await blob.text();
    if (holdDecodes) await new Promise<void>((res) => heldDecodes.push(res));
    const bm = new FakeBitmap(W, Math.round(W / ASPECT), url);
    bitmaps.push(bm);
    return bm;
  };

  class FakeWorker implements WorkerLike {
    onmessage: ((ev: { data: FromWorker }) => void) | null = null;
    onerror: ((ev: { preventDefault?(): void }) => void) | null = null;
    onmessageerror: ((ev: unknown) => void) | null = null;
    terminated = false;
    posted: ToWorker[] = [];
    store = createFrameStore({
      fetch: fakeFetch,
      createImageBitmap: o.worker === "lacks" ? undefined : decodeIn("worker"),
      now: () => clock,
      emit: (m) => {
        queueMicrotask(() => {
          if (!this.terminated) this.onmessage?.({ data: m });
          else if (m.t === "decoded" && m.ok) m.bitmap.close();
        });
      },
    });
    constructor() {
      workers.push(this);
    }
    postMessage(m: ToWorker) {
      if (this.terminated) return;
      this.posted.push(m);
      queueMicrotask(() => {
        if (!this.terminated) this.store.handle(m);
      });
    }
    terminate() {
      this.terminated = true;
    }
    crash() {
      this.onerror?.({});
    }
  }

  const inst = newInstrument("budget");
  const loaded = new Map<number, number>();
  const widths: [number, number][] = [];
  const env: LoaderEnv = {
    stats: loaderStatsFor(inst),
    connection: { effectiveType: "4g" },
    engaged: true,
    tier: () => W,
    onLoaded: (i, n) => loaded.set(i, n),
    onWidth: (i, w) => widths.push([i, w]),
    ...o.env,
  };
  const budget: BudgetOptions = {
    budgetBytes: (o.budgetFrames ?? 40) * FRAME,
    mainThread: o.worker === "none",
    startWorker: () => {
      if (o.worker === "throws") throw new Error("no worker here");
      return new FakeWorker();
    },
    fetch: fakeFetch,
    createImageBitmap: decodeIn("main"),
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = timerIds++;
      timers.push({ at: clock + ms, fn, id });
      return id;
    },
    clearTimer: (id) => {
      const k = timers.findIndex((t) => t.id === id);
      if (k >= 0) timers.splice(k, 1);
    },
    resolveUrl: (u) => u,
  };
  const loader = createBudgetLoader(env, budget);
  const advance = async (ms: number) => {
    clock += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= clock).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers.splice(timers.indexOf(due), 1);
      due.fn();
      await flush();
    }
  };
  const releaseDecodes = async () => {
    holdDecodes = false;
    for (const r of heldDecodes.splice(0)) r();
    await flush();
  };
  return {
    loader,
    stats: inst.stats,
    fetched,
    bitmaps,
    workers,
    loaded,
    widths,
    decodeSites,
    advance,
    releaseDecodes,
    holdDecodes: () => {
      holdDecodes = true;
    },
    heldDecodes,
  };
}

const plan = (active: number, frame: number, direction = 1, counts: number[] = []): WantPlan => {
  const p: WantPlan = {
    active,
    frame,
    direction,
    entry: (i) => (i > p.active ? 0 : (counts[i] ?? 1) - 1),
  };
  return p;
};

function joinAll(loader: FrameLoader, counts: number[], width = W) {
  counts.forEach((c, i) => loader.join(i, film(`f${i}`, c), width, opts(c)));
  loader.setNear(counts.map((_, i) => [i, true] as const));
}

const urlsOf = (urls: string[], name: string) => urls.filter((u) => u.startsWith(`/films/${name}/`));
const repeated = (urls: string[]) => urls.length - new Set(urls).size;

describe("budget loader: bytes kept, frames decoded in the worker", () => {
  it("fetches each frame once, decodes in the worker, stays inside the budget, and comes back without a request", async () => {
    const counts = [64, 64, 64];
    const t = setup({ budgetFrames: 40 });
    joinAll(t.loader, counts);
    assert.equal(t.loader.mode, "budget");
    // Down the reel, 4 frames a tick.
    for (let s = 0; s < counts.length; s++) {
      for (let f = 0; f < counts[s]; f += 4) {
        t.loader.want(plan(s, f, 1, counts));
        await flush(4);
      }
    }
    await flush();
    assert.equal(repeated(t.fetched), 0, "no frame fetched twice");
    assert.equal(t.stats.refetches, 0);
    assert.equal(t.stats.failures, 0);
    assert.ok(t.stats.workerDecodes > 0);
    assert.equal(t.stats.mainThreadDecodes, 0);
    assert.ok(t.decodeSites.every((s) => s === "worker"));
    assert.ok(t.stats.framesAlivePeak <= 40, `frames alive peak ${t.stats.framesAlivePeak}`);
    assert.ok(t.stats.decodedMBPeak <= t.stats.budgetMB + 1e-9, `decoded ${t.stats.decodedMBPeak} MB > budget ${t.stats.budgetMB} MB`);
    assert.equal(t.stats.budgetMB, (40 * FRAME) / 1e6);
    assert.ok(t.stats.bytesHeldMB > 0);
    // Every frame of the last two segments is held as bytes by now; the first one's too (fetched while active).
    assert.equal(new Set(t.fetched).size, 3 * 64);

    // Back up: decodes from kept bytes only.
    const before = { requests: t.stats.requests, redecodes: t.stats.redecodes };
    for (let s = counts.length - 1; s >= 0; s--) {
      for (let f = counts[s] - 1; f >= 0; f -= 4) {
        t.loader.want(plan(s, f, -1, counts));
        await flush(4);
      }
    }
    await flush();
    assert.equal(t.stats.requests - before.requests, 0, "no request on the way back");
    assert.ok(t.stats.redecodes > before.redecodes, "frames decoded again from kept bytes");
    assert.ok(t.stats.decodedMBPeak <= t.stats.budgetMB + 1e-9);
    // The canvas gets the frame it asks for, with its size.
    const held = t.loader.nearest(0, 0);
    assert.ok(held && held.frame === 0 && held.width === W && held.height === Math.round(W / ASPECT));
    // Every bitmap that left the store was closed; the ones held are open.
    const open = t.bitmaps.filter((b) => !b.closed).length;
    assert.equal(open, t.stats.framesAlive);
    assert.equal(t.loader.loaded(0) + t.loader.loaded(1) + t.loader.loaded(2), t.stats.framesAlive);
  });

  it("asks for frames ahead in the direction of travel first", async () => {
    const t = setup({ budgetFrames: 40 });
    joinAll(t.loader, [128]);
    t.loader.want(plan(0, 64, -1));
    const first = urlsOf(t.workers[0].posted.filter((m) => m.t === "fetch").map((m) => (m as { url: string }).url), "f0")
      .map((u) => Number(u.slice(-9, -5)) - 1)
      .slice(0, 8);
    // The target, M (= last) and 0, then the stride-16 pass upward first.
    assert.deepEqual(first.slice(0, 3), [64, 127, 0]);
    assert.ok(first.slice(3).every((f) => f < 64), `moving up, the coarse pass starts below the target: ${first}`);
  });

  it("closes a bitmap that arrives after its segment left, and never shows it", async () => {
    const t = setup();
    joinAll(t.loader, [32]);
    t.holdDecodes();
    t.loader.want(plan(0, 0));
    await flush();
    assert.ok(t.heldDecodes.length > 0, "decodes are running");
    assert.ok(t.stats.framesAlive > 0, "a running decode holds its reservation");
    t.loader.leave(0);
    await t.releaseDecodes();
    assert.ok(t.bitmaps.length > 0);
    assert.ok(t.bitmaps.every((b) => b.closed), "every late bitmap closed");
    assert.equal(t.loader.nearest(0, 0), null);
    assert.equal(t.loader.loaded(0), 0);
    assert.equal(t.stats.framesAlive, 0);
    assert.equal(t.stats.decodedBytes, 0);
  });

  it("retiers the segments not yet started on a slow network, closing the old tier's frames and late arrivals", async () => {
    let tierNow = 1280;
    const counts = [32, 32, 32, 32];
    const t = setup({ env: { connection: { effectiveType: "3g" }, tier: () => tierNow } });
    joinAll(t.loader, counts, 1280);
    assert.equal(t.loader.isSlow(), true);
    // Active 2: segment 3 is its neighbour (its entry frame is kept and decoded).
    t.loader.want(plan(2, 0, 1, counts));
    await flush();
    assert.ok(t.loader.loaded(3) > 0);
    t.holdDecodes();
    t.loader.want(plan(2, 8, 1, counts));
    await flush();
    const old = t.bitmaps.filter((b) => b.url.startsWith("/films/f3/"));
    // Back to segment 1: segment 3 (after 1 + 1) moves to the tier tier() picks now.
    tierNow = 768;
    t.loader.want(plan(1, 31, -1, counts));
    assert.deepEqual(t.widths, [[3, 768]]);
    assert.equal(t.loader.width(3), 768);
    assert.equal(t.loader.loaded(3), 0);
    assert.equal(t.loaded.get(3), 0);
    await t.releaseDecodes();
    assert.ok(old.length > 0 && old.every((b) => b.closed), "the old tier's frames are closed");
    assert.ok(t.bitmaps.filter((b) => b.url.startsWith("/films/f3/1280/")).every((b) => b.closed), "late arrivals closed");
    t.loader.want(plan(2, 0, 1, counts));
    await flush();
    assert.ok(urlsOf(t.fetched, "f3").some((u) => u.includes("/768/")), "segment 3 fetched at its new tier");
    const open = t.bitmaps.filter((b) => !b.closed).length;
    assert.equal(open, t.stats.framesAlive);
  });

  it("dispose closes every bitmap, stops every request, and returns the gauges to zero", async () => {
    const t = setup();
    joinAll(t.loader, [64, 64]);
    t.loader.want(plan(0, 10));
    await flush();
    t.holdDecodes();
    t.loader.want(plan(0, 40));
    await flush();
    assert.ok(t.stats.framesAlive > 0 && t.stats.bytesHeldMB > 0);
    t.loader.dispose();
    assert.equal(t.workers[0].terminated, true);
    await t.releaseDecodes();
    const asked = t.fetched.length;
    await t.advance(10_000);
    t.loader.want(plan(0, 50));
    await flush();
    assert.equal(t.fetched.length, asked, "nothing requested after dispose");
    assert.ok(t.bitmaps.every((b) => b.closed), "every bitmap closed");
    assert.equal(t.stats.framesAlive, 0);
    assert.equal(t.stats.decodedBytes, 0);
    assert.equal(t.stats.inflight, 0);
    assert.equal(t.stats.decodeInFlight, 0);
    assert.equal(t.stats.bytesHeldMB, 0);
  });
});

describe("budget loader: failures, page state", () => {
  it("retries a failed fetch with backoff, then gives the frame up; a 404 is given up at once", async () => {
    const t = setup({
      answer: (url, n) => (url.endsWith("f_0011.webp") ? (n < 3 ? 500 : undefined) : url.endsWith("f_0021.webp") ? 404 : undefined),
    });
    joinAll(t.loader, [32]);
    t.loader.want(plan(0, 10));
    await flush();
    assert.equal(t.fetched.filter((u) => u.endsWith("f_0011.webp")).length, 1);
    await t.advance(RETRY_BASE_MS);
    assert.equal(t.fetched.filter((u) => u.endsWith("f_0011.webp")).length, 2);
    await t.advance(2 * RETRY_BASE_MS);
    assert.equal(t.fetched.filter((u) => u.endsWith("f_0011.webp")).length, 3, "third try");
    t.loader.want(plan(0, 10));
    await flush();
    assert.equal(t.loader.nearest(0, 10)?.frame, 10, "the third try landed");
    assert.equal(t.fetched.filter((u) => u.endsWith("f_0021.webp")).length, 1, "a 404 is not retried");
    assert.equal(t.stats.failures, 1);
    t.loader.want(plan(0, 20));
    await flush();
    assert.notEqual(t.loader.nearest(0, 20)?.frame, 20, "covered by a neighbour");
    assert.equal(Math.abs(t.loader.nearest(0, 20)!.frame - 20), 1);
  });

  it("pauses while the page is hidden and carries on when it is shown", async () => {
    const t = setup();
    joinAll(t.loader, [32]);
    t.loader.visibility(true);
    t.loader.want(plan(0, 0));
    await flush();
    assert.equal(t.fetched.length, 0, "nothing starts while hidden");
    t.loader.visibility(false);
    await flush();
    assert.ok(t.fetched.length > 0);
    assert.ok(t.loader.loaded(0) > 0);
  });

  it("offline: nothing is fetched; failed frames get fresh tries when the network returns", async () => {
    let down = true;
    const t = setup({ answer: () => (down ? "error" : undefined) });
    joinAll(t.loader, [16]);
    t.loader.want(plan(0, 0));
    await flush();
    for (let k = 0; k < 10; k++) await t.advance(2 * RETRY_BASE_MS);
    assert.ok(t.stats.failures > 0, "frames given up while the network was down");
    t.loader.network(false);
    const asked = t.fetched.length;
    for (let k = 0; k < 10; k++) await t.advance(2 * RETRY_BASE_MS);
    assert.equal(t.fetched.length, asked, "no fetch while offline");
    down = false;
    t.loader.network(true);
    await flush();
    t.loader.want(plan(0, 0));
    await flush();
    assert.equal(t.loader.loaded(0), 16, "every frame decoded once the network is back");
  });
});

describe("budget loader: main-thread fallback", () => {
  it("decodes on the main thread when the worker lacks createImageBitmap", async () => {
    const t = setup({ worker: "lacks" });
    joinAll(t.loader, [32]);
    t.loader.want(plan(0, 0));
    await flush();
    assert.equal(t.loader.mode, "budget-main");
    assert.equal(t.stats.mode, "budget-main");
    assert.equal(t.workers[0].terminated, true);
    assert.ok(t.stats.mainThreadDecodes > 0);
    assert.equal(t.stats.workerDecodes, 0);
    assert.equal(t.stats.failures, 0);
    assert.equal(t.loader.loaded(0) > 0, true);
  });

  it("decodes on the main thread when the worker cannot be created, or when asked to", async () => {
    for (const worker of ["throws", "none"] as const) {
      const t = setup({ worker });
      joinAll(t.loader, [16]);
      assert.equal(t.loader.mode, "budget-main", worker);
      t.loader.want(plan(0, 0));
      await flush();
      assert.equal(t.loader.loaded(0), 16, worker);
      assert.ok(t.decodeSites.every((s) => s === "main"));
    }
  });

  it("moves to the main thread when the worker crashes: frames held stay, its jobs are cancelled without a failure", async () => {
    const t = setup();
    joinAll(t.loader, [64]);
    t.loader.want(plan(0, 0));
    await flush();
    const held = t.loader.loaded(0);
    assert.ok(held > 0);
    t.holdDecodes();
    t.loader.want(plan(0, 40));
    await flush();
    t.workers[0].crash();
    assert.equal(t.loader.mode, "budget-main");
    assert.equal(t.stats.mode, "budget-main");
    await t.releaseDecodes();
    await flush();
    t.loader.want(plan(0, 40));
    await flush();
    assert.equal(t.stats.failures, 0);
    assert.ok(t.loader.loaded(0) >= held);
    assert.equal(t.loader.nearest(0, 40)?.frame, 40);
    assert.ok(t.stats.mainThreadDecodes > 0);
    // Bitmaps decoded by the dead worker after the crash are closed; the counters still add up.
    assert.equal(t.bitmaps.filter((b) => !b.closed).length, t.stats.framesAlive);
  });

  it("the ready watchdog moves a silent worker to the main thread", async () => {
    const t = setup();
    // A worker that never answers.
    t.workers[0].store.handle = () => {};
    joinAll(t.loader, [16]);
    t.loader.want(plan(0, 0));
    await flush();
    assert.equal(t.loader.loaded(0), 0);
    await t.advance(10_000);
    assert.equal(t.loader.mode, "budget-main");
    t.loader.want(plan(0, 0));
    await flush();
    assert.equal(t.loader.loaded(0), 16);
  });
});

describe("loader selection", () => {
  const all = { fetch: true, blob: true, createImageBitmap: true, worker: true };
  it("?loader= picks a loader, anything else the default", () => {
    assert.equal(loaderFromQuery("?loader=legacy", "budget"), "legacy");
    assert.equal(loaderFromQuery("?loader=budget-main&hud=1", "budget"), "budget-main");
    assert.equal(loaderFromQuery("?loader=nope", "budget"), "budget");
    assert.equal(loaderFromQuery("", "legacy"), "legacy");
  });
  it("falls back to what the page can run", () => {
    assert.equal(runnableLoader("budget", all), "budget");
    assert.equal(runnableLoader("budget", { ...all, worker: false }), "budget-main");
    assert.equal(runnableLoader("budget", { ...all, createImageBitmap: false }), "legacy");
    assert.equal(runnableLoader("budget-main", { ...all, fetch: false }), "legacy");
    assert.equal(runnableLoader("legacy", all), "legacy");
  });
});

// Tests for film packs in the budget loader (stage 7): the store's pack reads (components/film/loader/frame-worker.js)
// behind a fake worker, against a fake server that streams each pack in arbitrary chunks, answers Range requests (or
// ignores them), and can 404, truncate, corrupt or fail; the planner's pack plan (budget-plan.ts nextPackOp) through the
// FrameLoader interface; the fallbacks to one file per frame; the counters through the page's adapter. Frame bytes are
// the frame's URL as text, in a pack and as a file alike, so a decoded frame names itself whichever way it came.
// Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FilmManifest } from "../filmCore";
import { frameUrl } from "../filmBase";
import { frameBytes, loaderStatsFor, newInstrument } from "../filmStats";
import { createBudgetLoader, type BudgetOptions, type WorkerLike } from "./budget";
import { createFrameStore, type BitmapLike, type FetchLike, type ResponseLike } from "./frame-worker";
import type { FromWorker, ToWorker } from "./frame-worker-protocol";
import { buildPack } from "./pack-format.mjs";
import type { FrameLoader, JoinOptions, LoaderEnv, WantPlan } from "./types";

const W = 768;
const ASPECT = 16 / 9;
const FRAME = frameBytes(W, ASPECT);
const enc = new TextEncoder();

const flush = async (rounds = 40) => {
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

type Film = { manifest: FilmManifest; pack: Uint8Array; url: string; skeletonEnd: number; header: number; order: number[] };

/** A film of `count` frames whose pack holds each frame's URL as its bytes (padded so frames differ in size). */
function makeFilm(name: string, count: number, moveEnd = count - 1): Film {
  const base = `/films/${name}`;
  const m0: FilmManifest = { name, count, fps: 24, widths: [W], aspect: ASPECT, pad: 4, ext: "webp", base, poster: "" };
  const frames = Array.from({ length: count }, (_, i) => enc.encode(frameUrl(m0, W, i)));
  const built = buildPack(frames, moveEnd);
  const file = `pack-${(count * 7919 + name.length).toString(16).padStart(8, "0").slice(-8)}.bin`;
  const manifest: FilmManifest = {
    ...m0,
    packs: { [String(W)]: { file, bytes: built.bytes, header: built.header, skeletonEnd: built.skeletonEnd } },
  };
  return { manifest, pack: built.data, url: `${base}/${W}/${file}`, skeletonEnd: built.skeletonEnd, header: built.header, order: built.order };
}

const opts = (count: number, extra: Partial<JoinOptions> = {}): JoinOptions => ({
  moveEnd: count - 1,
  tailFrames: 0,
  evenTailOnly: false,
  reducedStills: null,
  tolerance: Math.max(8, Math.round(count / 32)),
  ...extra,
});

type Request = { url: string; range: string | null; status: number; start: number };

type ServerOptions = {
  /** Body chunk sizes (bytes); default random 1 to 600. */
  chunk?: () => number;
  /** The server ignores Range: every pack answer is the whole file, 200. */
  ignoreRange?: boolean;
  /** No Content-Range header on a 206 (not exposed by CORS). */
  hideContentRange?: boolean;
  /** Override an answer: a status, "error" (network error) or "garbage" (200 with bytes that are not a pack). */
  answer?: (url: string, attempt: number) => number | "error" | "garbage" | undefined;
  /** Cut a pack body after this many bytes of the response (a truncated body), per attempt. */
  truncate?: (url: string, attempt: number) => number | undefined;
};

function setup(films: Film[], o: { server?: ServerOptions; env?: Partial<LoaderEnv>; budget?: Partial<BudgetOptions>; budgetFrames?: number } = {}) {
  const srv = o.server ?? {};
  let clock = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let timerIds = 1;
  const requests: Request[] = [];
  const fileFetches: string[] = [];
  const attempts = new Map<string, number>();
  const bitmaps: FakeBitmap[] = [];
  const packs = new Map(films.map((f) => [f.url, f.pack]));
  /** While set, pack bodies deliver nothing until `release()`. */
  let hold = false;
  const waiting: (() => void)[] = [];
  let rnd = 12345;
  const random = () => {
    rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
    return rnd / 0x7fffffff;
  };

  const streamOf = (data: Uint8Array, signal?: AbortSignal | null) => {
    let at = 0;
    return new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        await new Promise<void>((res) => setImmediate(res));
        while (hold) await new Promise<void>((res) => waiting.push(res));
        if (signal?.aborted) {
          ctrl.error(new DOMException("aborted", "AbortError"));
          return;
        }
        if (at >= data.length) {
          ctrl.close();
          return;
        }
        const n = Math.max(1, Math.min(data.length - at, srv.chunk ? srv.chunk() : 1 + Math.floor(random() * 600)));
        ctrl.enqueue(data.slice(at, at + n));
        at += n;
      },
    });
  };

  const fakeFetch: FetchLike = async (url, init) => {
    const n = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, n);
    const pack = packs.get(url);
    if (!pack) {
      fileFetches.push(url);
      return { ok: true, status: 200, blob: async () => new Blob([url]) };
    }
    const range = (init.headers as Record<string, string> | undefined)?.Range ?? null;
    const a = srv.answer?.(url, n);
    if (a === "error") {
      requests.push({ url, range, status: 0, start: -1 });
      throw new Error("network");
    }
    if (typeof a === "number") {
      requests.push({ url, range, status: a, start: -1 });
      return { ok: a < 300, status: a, blob: async () => new Blob([]), headers: new Headers(), body: streamOf(new Uint8Array(0)) };
    }
    let data = a === "garbage" ? enc.encode("<html>not a pack, a page that says so at length ".repeat(20)) : pack;
    let status = 200;
    let start = 0;
    const m = range && /^bytes=(\d+)-(\d*)$/.exec(range);
    const headers = new Headers({ "content-length": String(data.length) });
    if (m && !srv.ignoreRange && a !== "garbage") {
      start = Number(m[1]);
      status = 206;
      const total = data.length;
      const last = m[2] ? Math.min(total - 1, Number(m[2])) : total - 1;
      data = data.subarray(start, last + 1);
      headers.set("content-length", String(data.length));
      if (!srv.hideContentRange) headers.set("content-range", `bytes ${start}-${last}/${total}`);
    }
    const cut = srv.truncate?.(url, n);
    if (cut !== undefined && cut < data.length) data = data.subarray(0, cut);
    requests.push({ url, range, status, start });
    const res: ResponseLike = { ok: true, status, blob: async () => new Blob([data as BlobPart]), headers, body: streamOf(data, init.signal) };
    return res;
  };
  const decode = async (blob: Blob) => {
    const url = await blob.text();
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
      createImageBitmap: decode,
      now: () => clock,
      emit: (m) => {
        if (process.env.PACK_DEBUG && m.t.startsWith("pack")) console.log("<-", JSON.stringify(m, (k, v) => (k === "slotFrame" || k === "slotOffset" ? undefined : v)));
        queueMicrotask(() => {
          if (!this.terminated) this.onmessage?.({ data: m });
          else if (m.t === "decoded" && m.ok) m.bitmap.close();
        });
      },
    });
    postMessage(m: ToWorker) {
      if (this.terminated) return;
      this.posted.push(m);
      if (process.env.PACK_DEBUG) console.log("->", JSON.stringify(m));
      queueMicrotask(() => {
        if (!this.terminated) this.store.handle(m);
      });
    }
    terminate() {
      this.terminated = true;
    }
  }
  const workers: FakeWorker[] = [];

  const inst = newInstrument("budget");
  const env: LoaderEnv = {
    stats: loaderStatsFor(inst),
    connection: { effectiveType: "4g" },
    engaged: true,
    tier: () => W,
    ...o.env,
  };
  const loader = createBudgetLoader(env, {
    budgetBytes: (o.budgetFrames ?? 40) * FRAME,
    startWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    fetch: fakeFetch,
    createImageBitmap: decode,
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
    ...o.budget,
  });
  films.forEach((f, i) => loader.join(i, f.manifest, W, opts(f.manifest.count)));
  loader.setNear(films.map((_, i) => [i, true] as const));

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
  return {
    loader,
    stats: inst.stats,
    requests,
    fileFetches,
    bitmaps,
    workers,
    advance,
    hold: () => {
      hold = true;
    },
    release: async () => {
      hold = false;
      for (const r of waiting.splice(0)) r();
      await flush();
    },
    /** Frames of segment `seg` whose bytes the store holds (decoded or not), from the worker's own store view. */
    packMessages: () => workers[0].posted.filter((m) => m.t === "pack") as Extract<ToWorker, { t: "pack" }>[],
  };
}

const plan = (active: number, frame: number, direction: number, counts: number[]): WantPlan => {
  const p: WantPlan = { active, frame, direction, entry: (i) => (i > p.active ? 0 : counts[i] - 1) };
  return p;
};

/** Walk the reel down (or up) `step` frames a tick, letting `rounds` event-loop turns pass between ticks. */
async function walk(loader: FrameLoader, counts: number[], dir: 1 | -1, step = 4, rounds = 6) {
  const segs = counts.map((_, i) => i);
  if (dir < 0) segs.reverse();
  for (const s of segs) {
    const frames: number[] = [];
    for (let f = 0; f < counts[s]; f += step) frames.push(f);
    if (dir < 0) frames.reverse();
    for (const f of frames) {
      loader.want(plan(s, f, dir, counts));
      await flush(rounds);
    }
  }
}

const decodedUrls = (bitmaps: FakeBitmap[]) => bitmaps.map((b) => b.url);
const packRequests = (t: { requests: Request[] }) => t.requests.length;

describe("film packs: lab pack origin", () => {
  it("packOrigin moves the pack's URL to the local origin and leaves the frame files where they are", async () => {
    const f = makeFilm("o0", 33);
    const t = setup([f], {
      budget: { packOrigin: "http://127.0.0.1:3008", resolveUrl: (u) => new URL(u, "https://cdn.example").href },
    });
    t.loader.want(plan(0, 0, 0, [33]));
    await flush(20);
    const msgs = t.packMessages();
    assert.ok(msgs.length >= 1);
    assert.equal(msgs[0].url, `http://127.0.0.1:3008${f.url}`);
  });
});

describe("film packs: reading", () => {
  it("delivers the hold frames and the skeleton before the rest, in arbitrary chunks", async () => {
    const f = makeFilm("p0", 97);
    const t = setup([f], { server: { chunk: () => 7 } });
    const seen: number[] = [];
    // Record arrivals in the order the planner learns of them.
    t.loader.want(plan(0, 0, 0, [97]));
    for (let k = 0; k < 400 && seen.length < 97; k++) {
      await flush(2);
      for (let i = 0; i < 97; i++) if (!seen.includes(i) && t.loader.waitReason!(0, i) !== "not planned" && /bytes held|decod/.test(t.loader.waitReason!(0, i))) seen.push(i);
    }
    assert.equal(t.stats.framesFromPacks, 97);
    assert.equal(t.stats.framesFromFiles, 0);
    assert.equal(t.fileFetches.length, 0, "no frame file fetched");
    const skeleton = f.order.slice(0, 2 + 23); // hold 0 and 96 (= M = last), skeleton 4 … 92
    const firstRest = seen.findIndex((i) => i % 4 !== 0);
    assert.ok(firstRest > 0);
    for (const s of skeleton) assert.ok(seen.indexOf(s) >= 0 && seen.indexOf(s) < firstRest, `skeleton frame ${s} before the rest (${seen.slice(0, 30)})`);
    assert.equal(packRequests(t), 1, "one request for the whole film");
    assert.equal(t.requests[0].range, null, "a read from byte 0 to the end is a plain GET");
  });

  it("before the first scroll reads the hero through its skeleton only, no more film bytes than the per-frame idle gate", async () => {
    const counts = [97, 81];
    const films = counts.map((c, i) => makeFilm(`i${i}`, c));
    const t = setup(films, { env: { engaged: false } });
    t.loader.want(plan(0, 0, 0, counts));
    await flush(200);
    assert.equal(packRequests(t), 1, "one bounded read of the hero pack");
    assert.equal(t.requests[0].url, films[0].url);
    // Every hold and skeleton frame is in; nothing of the rest of the move.
    for (let i = 0; i < 97; i += 4) assert.match(t.loader.waitReason!(0, i), /decod|bytes held/, `skeleton frame ${i}`);
    assert.equal(t.stats.framesFromPacks, 2 + 23);
    const packBytes = t.stats.packBytesMB * 1e6;
    assert.ok(packBytes >= films[0].skeletonEnd && packBytes < films[0].skeletonEnd + 2048, `read ${packBytes} B, skeleton ends at ${films[0].skeletonEnd}`);
    // The per-frame idle gate on the same page: its frames' bytes.
    const u = setup(films, { env: { engaged: false }, budget: { packs: false } });
    u.loader.want(plan(0, 0, 0, counts));
    await flush(200);
    const perFrameBytes = u.fileFetches.reduce((n, url) => n + enc.encode(url).length, 0);
    const skeletonFrameBytes = films[0].skeletonEnd - films[0].header;
    assert.ok(skeletonFrameBytes <= perFrameBytes, `pack frames ${skeletonFrameBytes} B, per-frame gate ${perFrameBytes} B`);
    // Engaging continues the same pack with a Range read from where it stopped.
    t.loader.engage();
    t.loader.want(plan(0, 4, 1, counts));
    await flush(400);
    assert.equal(t.requests[0].range, `bytes=0-${films[0].skeletonEnd - 1}`, "the idle read asks for the skeleton's bytes only");
    const cont = t.requests.find((r) => r.url === films[0].url && r.start > 0);
    assert.ok(cont, "a Range read continues the hero pack");
    assert.ok(cont!.start >= films[0].skeletonEnd, `continued at ${cont!.start}, after the skeleton (${films[0].skeletonEnd})`);
    assert.equal(t.stats.packBytesRepeatedMB, 0);
  });

  it("stops a read on a leap to another film and continues it later from the byte reached, never reading a byte twice", async () => {
    const counts = [121, 121, 121, 121];
    const films = counts.map((c, i) => makeFilm(`l${i}`, c));
    const t = setup(films, { server: { chunk: () => 50 } });
    t.loader.want(plan(0, 0, 1, counts));
    await flush(30);
    // Leap to the last film mid-read.
    t.loader.want(plan(3, 60, 1, counts));
    await flush(10);
    const stops = t.workers[0].posted.filter((m) => m.t === "pack-stop").length;
    assert.ok(stops >= 1, "the first film's read stopped");
    await flush(600);
    assert.ok(t.loader.nearest(3, 60), "the leap's film plays");
    // Back to the first film: its read continues where it stopped.
    t.loader.want(plan(0, 30, -1, counts));
    await flush(800);
    const first = t.requests.filter((r) => r.url === films[0].url);
    assert.ok(first.length >= 2, "the first film was read again from where it stopped");
    assert.ok(first.slice(1).every((r) => r.status === 206 && r.start > 0), `continued with Range reads: ${JSON.stringify(first)}`);
    assert.equal(t.stats.packBytesRepeatedMB, 0, "no byte read twice");
    assert.equal(t.fileFetches.length, 0);
  });

  it("a 200 answer to a Range request: the bytes held are skipped, counted as read twice, and the pack is read from 0", async () => {
    const counts = [97, 97];
    const films = counts.map((c, i) => makeFilm(`r${i}`, c));
    const t = setup(films, { server: { ignoreRange: true, chunk: () => 40 }, env: { engaged: false } });
    t.loader.want(plan(0, 0, 0, counts));
    await flush(300);
    const skel = t.stats.packBytesMB * 1e6;
    assert.ok(skel > 0);
    t.loader.engage();
    t.loader.want(plan(0, 2, 1, counts));
    await flush(1500);
    // Every frame of the hero arrived exactly once; the second answer was the whole file.
    assert.equal(t.loader.waitReason!(0, 95).includes("not planned"), false);
    const hero = t.requests.filter((r) => r.url === films[0].url);
    assert.equal(hero[1].range !== null, true, "the continuation asked for a range");
    assert.equal(hero[1].status, 200, "and got the whole file");
    // Each film's skeleton was held when its Range read came back whole: those bytes, and no others, came twice.
    const repeated = t.stats.packBytesRepeatedMB * 1e6;
    // (both films' skeletons were read before their first Range read: up to a 40-byte chunk past the skeleton's end each)
    assert.ok(repeated >= skel - 1 && repeated <= films[0].skeletonEnd + films[1].skeletonEnd + 80, `repeated ${repeated} B, the hero's skeleton ${skel} B`);
    // Once a pack's server is known to ignore Range, its reads start at byte 0.
    const after = t.requests.filter((r) => r.url === films[0].url).slice(2);
    assert.ok(after.every((r) => r.start <= 0), JSON.stringify(after));
    assert.equal(t.stats.framesFromPacks, 97 * 2);
    assert.equal(t.fileFetches.length, 0);
    assert.equal(new Set(decodedUrls(t.bitmaps)).size, decodedUrls(t.bitmaps).length > 0 ? new Set(decodedUrls(t.bitmaps)).size : 0);
  });

  it("a 206 without a readable Content-Range is taken when its byte count matches", async () => {
    const counts = [97];
    const films = counts.map((c, i) => makeFilm(`h${i}`, c));
    const t = setup(films, { server: { hideContentRange: true }, env: { engaged: false } });
    t.loader.want(plan(0, 0, 0, counts));
    await flush(300);
    t.loader.engage();
    t.loader.want(plan(0, 2, 1, counts));
    await flush(800);
    assert.equal(t.stats.framesFromPacks, 97);
    assert.equal(t.stats.packFallbackFilms, 0);
    assert.ok(t.requests.some((r) => r.status === 206));
  });

  it("a truncated body: what arrived is kept and the read continues from the byte reached", async () => {
    const counts = [97];
    const films = counts.map((c, i) => makeFilm(`t${i}`, c));
    const t = setup(films, { server: { truncate: (_u, n) => (n === 1 ? 900 : undefined), chunk: () => 64 } });
    t.loader.want(plan(0, 0, 1, counts));
    await flush(200);
    await t.advance(500); // the retry after 400 ms
    await flush(400);
    assert.equal(t.stats.framesFromPacks, 97);
    assert.equal(t.requests.length, 2);
    assert.ok(t.requests[1].start > 0 && t.requests[1].start <= 900, `continued at ${t.requests[1].start}`);
    assert.equal(t.stats.packBytesRepeatedMB, 0);
    assert.equal(t.stats.packFallbackFilms, 0);
  });
});

describe("film packs: fallbacks", () => {
  it("a 404 pack: that film loads frame by frame, once each, and the others keep their packs", async () => {
    const counts = [65, 65];
    const films = counts.map((c, i) => makeFilm(`n${i}`, c));
    const t = setup(films, { server: { answer: (u) => (u === films[0].url ? 404 : undefined) } });
    await walk(t.loader, counts, 1);
    await flush(400);
    assert.equal(t.stats.packFallbackFilms, 1);
    assert.equal(t.stats.packFilms, 1);
    assert.equal(t.requests.filter((r) => r.url === films[0].url).length, 1, "a 404 is not retried");
    const files = t.fileFetches;
    assert.equal(files.length, new Set(files).size, "no frame file fetched twice");
    assert.ok(files.every((u) => u.startsWith("/films/n0/")), "only the failed film's frames come as files");
    assert.equal(files.length, 65);
    assert.ok(t.stats.framesFromPacks >= 3, "the other film reads its pack");
    assert.ok(t.loader.nearest(0, 64));
  });

  it("a pack that is not a pack (wrong header): given up at once, its film loads frame by frame", async () => {
    const counts = [65];
    const films = counts.map((c, i) => makeFilm(`g${i}`, c));
    const t = setup(films, { server: { answer: (u) => (u === films[0].url ? "garbage" : undefined) } });
    await walk(t.loader, counts, 1);
    await flush(400);
    assert.equal(t.stats.packFallbackFilms, 1);
    assert.equal(t.requests.length, 1);
    assert.equal(t.fileFetches.length, 65);
    assert.equal(new Set(t.fileFetches).size, 65);
  });

  it("a pack that fails mid-film keeps the frames it delivered and fetches only the missing ones as files", async () => {
    const counts = [97];
    const films = counts.map((c, i) => makeFilm(`m${i}`, c));
    // The first answer stops after 1,500 bytes; every later one is a 500.
    const t = setup(films, {
      server: { truncate: (_u, n) => (n === 1 ? 1500 : undefined), answer: (_u, n) => (n > 1 ? 500 : undefined), chunk: () => 100 },
    });
    t.loader.want(plan(0, 0, 1, counts));
    await flush(200);
    const fromPack = t.stats.framesFromPacks;
    assert.ok(fromPack > 0 && fromPack < 97, `${fromPack} frames from the pack before it failed`);
    for (let k = 0; k < 5; k++) await t.advance(2000);
    await flush(400);
    assert.equal(t.stats.packFallbackFilms, 1, "given up after three failures");
    assert.equal(t.requests.length, 3);
    assert.equal(t.stats.framesFromFiles, 97 - fromPack, "only the missing frames come as files");
    assert.equal(new Set(t.fileFetches).size, t.fileFetches.length);
    assert.equal(t.stats.refetches, 0);
    // isComing: frames of a film whose pack is given up and whose file fetch is given up too are not coming.
    t.loader.want(plan(0, 50, 0, counts));
    assert.ok(t.loader.nearest(0, 50));
  });

  it("isComing: true for a frame a queued pack read will bring, false once the pack and the frame's file are given up", async () => {
    const counts = [97];
    const films = counts.map((c, i) => makeFilm(`c${i}`, c));
    const t = setup(films, { server: { answer: () => 503 } });
    t.hold();
    t.loader.want(plan(0, 0, 1, counts));
    assert.equal(t.loader.isComing(0, 10, 2), true, "queued in the pack plan");
    await t.release();
    // Pack: three 503s → given up; then the frames' files: 503 three times each → given up too.
    for (let k = 0; k < 12; k++) await t.advance(2000);
    await flush(200);
    assert.equal(t.stats.packFallbackFilms, 1);
    assert.equal(t.loader.isComing(0, 10, 2), false);
  });

  it("?pack=0 (packs: false): one file per frame, no pack request", async () => {
    const counts = [33, 33];
    const films = counts.map((c, i) => makeFilm(`z${i}`, c));
    const t = setup(films, { budget: { packs: false } });
    await walk(t.loader, counts, 1);
    await flush(200);
    assert.equal(t.requests.length, 0);
    assert.equal(t.stats.packRequests, 0);
    assert.equal(t.stats.packFilms, 0);
    assert.equal(t.fileFetches.length, 66);
  });

  it("reduced-motion stills: no pack (five frames do not need the film)", async () => {
    const f = makeFilm("s0", 97);
    const t = setup([], {});
    t.loader.join(0, f.manifest, W, opts(97, { reducedStills: [0, 24, 48, 72, 96] }));
    t.loader.setNear([[0, true]]);
    t.loader.want(plan(0, 0, 1, [97]));
    await flush(200);
    assert.equal(t.requests.length, 0);
    assert.equal(t.fileFetches.length, 5);
  });
});

describe("film packs: the plan", () => {
  it("a full pass down and back: a few requests per film, none on the way back, nothing fetched twice", async () => {
    const counts = [97, 81, 121, 65];
    const films = counts.map((c, i) => makeFilm(`w${i}`, c));
    const t = setup(films, { budgetFrames: 40 });
    await walk(t.loader, counts, 1, 3, 12);
    await flush(1000);
    const down = packRequests(t);
    assert.ok(down <= counts.length * 3, `${down} pack requests for ${counts.length} films`);
    assert.equal(t.stats.framesFromPacks, counts.reduce((a, b) => a + b, 0));
    assert.equal(t.fileFetches.length, 0);
    assert.equal(t.stats.packBytesRepeatedMB, 0);
    const before = packRequests(t);
    await walk(t.loader, counts, -1, 3, 12);
    await flush(400);
    assert.equal(packRequests(t) - before, 0, "no request on the way back");
    assert.ok(t.stats.redecodes > 0);
    assert.ok(t.stats.decodedMBPeak <= t.stats.budgetMB + 1e-9);
  });

  it("on the first scroll the hero's rest is read at once, beside the next film's skeleton", async () => {
    const counts = [97, 97];
    const films = counts.map((c, i) => makeFilm(`e${i}`, c));
    const t = setup(films, { env: { engaged: false }, server: { chunk: () => 30 } });
    t.loader.want(plan(0, 0, 0, counts));
    await flush(300);
    assert.equal(t.packMessages().length, 1);
    t.loader.engage();
    t.loader.want(plan(0, 1, 1, counts));
    await flush(1);
    const opened = t.packMessages().slice(1);
    assert.ok(opened.some((m) => m.url === films[0].url && m.from >= films[0].skeletonEnd), "the hero's rest");
    assert.ok(opened.some((m) => m.url === films[1].url && m.from === 0), "the next film's skeleton");
    assert.equal(t.loader.waitReason!(0, 1), "pack read open (pack known, read at frame 1)");
  });

  it("at most two reads at once; the second only reads holds and skeletons", async () => {
    const counts = [97, 97, 97];
    const films = counts.map((c, i) => makeFilm(`q${i}`, c));
    const t = setup(films, { server: { chunk: () => 30 } });
    let maxOpen = 0;
    const open = new Set<number>();
    const orig = t.workers[0].postMessage.bind(t.workers[0]);
    t.workers[0].postMessage = (m: ToWorker) => {
      if (m.t === "pack") open.add(m.id);
      orig(m);
    };
    const w = t.workers[0];
    const prevOnMessage = w.onmessage!;
    w.onmessage = (ev) => {
      if (ev.data.t === "pack-done") open.delete(ev.data.id);
      prevOnMessage(ev);
    };
    for (let f = 0; f < 97; f += 2) {
      t.loader.want(plan(0, f, 1, counts));
      await flush(3);
      maxOpen = Math.max(maxOpen, open.size);
    }
    assert.ok(maxOpen <= 2, `${maxOpen} reads open at once`);
    // The neighbour ahead got its skeleton read while the active film read on.
    assert.ok(t.requests.some((r) => r.url === films[1].url));
  });

  it("Save-Data: one read at a time, the active film to its end before any other", async () => {
    const counts = [97, 97];
    const films = counts.map((c, i) => makeFilm(`d${i}`, c));
    const t = setup(films, { env: { connection: { saveData: true } }, server: { chunk: () => 25 } });
    let maxOpen = 0;
    const open = new Set<number>();
    const w = t.workers[0];
    const post = w.postMessage.bind(w);
    w.postMessage = (m: ToWorker) => {
      if (m.t === "pack") open.add(m.id);
      post(m);
    };
    const onm = w.onmessage!;
    w.onmessage = (ev) => {
      if (ev.data.t === "pack-done") open.delete(ev.data.id);
      onm(ev);
    };
    t.loader.want(plan(0, 0, 1, counts));
    for (let k = 0; k < 200; k++) {
      await flush(2);
      maxOpen = Math.max(maxOpen, open.size);
      if (t.requests.some((r) => r.url === films[1].url)) break;
    }
    assert.equal(maxOpen, 1);
    // When the second film's read starts, the first is complete.
    for (let i = 0; i < 97; i++) assert.notEqual(t.loader.waitReason!(0, i), "pack read open", `frame ${i}`);
    assert.ok(t.stats.framesFromPacks >= 97);
  });

  it("a slow network (by navigator.connection): one read at a time", async () => {
    const counts = [97, 97];
    const films = counts.map((c, i) => makeFilm(`v${i}`, c));
    const t = setup(films, { env: { connection: { effectiveType: "3g" } } });
    t.loader.want(plan(0, 0, 1, counts));
    let maxOpen = 0;
    for (let k = 0; k < 60; k++) {
      await flush(2);
      const opened = t.workers[0].posted.filter((m) => m.t === "pack").length;
      const done = t.requests.length;
      maxOpen = Math.max(maxOpen, opened - Math.max(0, done - 1));
    }
    assert.ok(t.loader.isSlow());
    assert.ok(t.workers[0].posted.filter((m) => m.t === "pack").length >= 1);
    assert.ok(maxOpen <= 1, `${maxOpen}`);
  });

  it("a direction flip re-plans: the film ahead changes, the read that no longer matters stops", async () => {
    const counts = [97, 97, 97];
    const films = counts.map((c, i) => makeFilm(`f${i}`, c));
    const t = setup(films, { server: { chunk: () => 20 } });
    t.loader.want(plan(1, 48, 1, counts));
    await flush(40);
    assert.ok(t.packMessages().some((m) => m.url === films[2].url), "going down, the film below is read");
    // Up, far enough to flip (more than DIRECTION_FRAMES of travel).
    for (let f = 46; f >= 30; f -= 2) {
      t.loader.want(plan(1, f, -1, counts));
      await flush(4);
    }
    await flush(40);
    assert.ok(t.packMessages().some((m) => m.url === films[0].url), "going up, the film above is read");
  });
});

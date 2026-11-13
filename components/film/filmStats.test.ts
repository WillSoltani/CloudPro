import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aimAt,
  countDraw,
  countRequest,
  dropFrame,
  frameBytes,
  holdFrame,
  missBy,
  newEffectiveTarget,
  newFilmStats,
  newStaleClock,
  loaderStatsFor,
  newInstrument,
  noteStaleStart,
  onTarget,
  recoverStale,
  resetFilmStats,
  tickStale,
} from "./filmStats";

describe("tickStale", () => {
  it("counts nothing stale while every tick shows the target", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    for (const t of [0, 16, 32, 48]) tickStale(s, c, false, t);
    assert.equal(s.ticks, 4);
    assert.equal(s.staleTicks, 0);
    assert.equal(s.staleMs, 0);
    assert.equal(s.staleMsMax, 0);
  });

  it("measures a stretch from its first stale tick to the tick that shows the target", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, false, 0);
    tickStale(s, c, true, 10); // stretch opens at 10
    tickStale(s, c, true, 26);
    tickStale(s, c, true, 42);
    tickStale(s, c, false, 58); // shows the target again: 48 ms
    tickStale(s, c, false, 74);
    assert.equal(s.ticks, 6);
    assert.equal(s.staleTicks, 3);
    assert.equal(s.staleMs, 48);
    assert.equal(s.staleMsMax, 48);
    assert.equal(c.since, -1);
  });

  it("keeps the longest stretch and the total over several", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 0);
    tickStale(s, c, false, 30); // 30
    tickStale(s, c, true, 40);
    tickStale(s, c, true, 60);
    tickStale(s, c, false, 110); // 70
    tickStale(s, c, true, 120);
    tickStale(s, c, false, 130); // 10
    assert.equal(s.staleTicks, 4);
    assert.equal(s.staleMs, 110);
    assert.equal(s.staleMsMax, 70);
  });

  it("reports an open stretch in staleMsMax before it ends", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 100);
    tickStale(s, c, true, 400);
    assert.equal(s.staleMsMax, 300);
    assert.equal(s.staleMs, 300);
    assert.equal(c.since, 100);
  });

  it("counts a single stale tick that recovers on the next as the gap between them", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 5);
    tickStale(s, c, false, 21);
    assert.equal(s.staleMs, 16);
    assert.equal(s.staleMsMax, 16);
  });
});

describe("the longest stale stretch's place (noteStaleStart)", () => {
  it("records where the longest stretch began and what the loader waited for, and keeps it over shorter ones", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    resetFilmStats(s, c, 1000);
    tickStale(s, c, false, 1000);
    noteStaleStart(c, 3, "rack-03-p", 40, 38, "pack read open");
    tickStale(s, c, true, 1010);
    tickStale(s, c, true, 1100);
    tickStale(s, c, false, 1200); // 190 ms
    noteStaleStart(c, 5, "rack-05-p", 2, -1, "file fetch queued");
    tickStale(s, c, true, 1300);
    recoverStale(s, c, 1350); // 50 ms: shorter, the first stays
    assert.equal(s.staleMsMax, 190);
    assert.deepEqual(
      [s.staleMaxSeg, s.staleMaxFilm, s.staleMaxFrame, s.staleMaxPainted, s.staleMaxAtMs, s.staleMaxWhy],
      [3, "rack-03-p", 40, 38, 10, "pack read open"],
    );
    noteStaleStart(c, 5, "rack-05-p", 2, -1, "file fetch queued");
    tickStale(s, c, true, 1400);
    recoverStale(s, c, 1700); // 300 ms: the new longest
    assert.deepEqual([s.staleMaxSeg, s.staleMaxFrame, s.staleMaxPainted, s.staleMaxAtMs, s.staleMaxWhy], [5, 2, -1, 400, "file fetch queued"]);
    resetFilmStats(s, c, 2000);
    assert.deepEqual([s.staleMaxSeg, s.staleMaxFilm, s.staleMaxWhy, s.staleMaxAtMs], [-1, "", "", 0]);
  });
});

describe("pack counters (loaderStatsFor)", () => {
  it("counts pack reads, bytes, films and where frames came from; a reset zeroes the counters and keeps the gauges", () => {
    const inst = newInstrument("budget");
    const st = loaderStatsFor(inst);
    st.packRequested!("rack-00", 432);
    st.packRequested!("rack-01", 432);
    st.packBytes!(500_000, 0);
    st.packBytes!(250_000, 50_000);
    st.packFilms!(7, 1);
    st.framesArrived!(true, 40);
    st.framesArrived!(false, 3);
    const s = inst.stats;
    assert.deepEqual(
      [s.packRequests, s.packBytesMB, s.packBytesRepeatedMB, s.packFilms, s.packFallbackFilms, s.framesFromPacks, s.framesFromFiles],
      [2, 0.75, 0.05, 7, 1, 40, 3],
    );
    resetFilmStats(s, inst.clock, 0);
    assert.deepEqual([s.packRequests, s.packBytesMB, s.packBytesRepeatedMB, s.framesFromPacks, s.framesFromFiles], [0, 0, 0, 0, 0]);
    assert.deepEqual([s.packFilms, s.packFallbackFilms], [7, 1]);
  });
});

describe("recoverStale", () => {
  it("ends an open stretch at the paint, not at the next tick", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 0);
    tickStale(s, c, true, 16);
    recoverStale(s, c, 40); // the frame arrived with the clock at rest
    tickStale(s, c, false, 5000); // the viewer scrolls again much later
    assert.equal(s.staleMs, 40);
    assert.equal(s.staleMsMax, 40);
    assert.equal(s.ticks, 3);
    assert.equal(s.staleTicks, 2);
  });

  it("does nothing without an open stretch", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, false, 0);
    recoverStale(s, c, 50);
    assert.equal(s.staleMs, 0);
    assert.equal(s.staleMsMax, 0);
    assert.equal(c.last, 0);
  });

  it("agrees with a tick at the same moment (draw inside a tick)", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 0);
    recoverStale(s, c, 16);
    tickStale(s, c, false, 16);
    assert.equal(s.staleMs, 16);
    assert.equal(s.staleMsMax, 16);
  });
});

describe("resetFilmStats", () => {
  it("zeroes the counters and keeps the gauges", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    countRequest(s, false, 1);
    countRequest(s, true, 2);
    holdFrame(s, frameBytes(768, 16 / 9));
    holdFrame(s, frameBytes(768, 16 / 9));
    dropFrame(s, frameBytes(768, 16 / 9));
    countDraw(s, 4, { lo: 6, hi: 6 });
    tickStale(s, c, false, 0);
    s.held = 3;
    s.canvasResizes = 1;
    s.measures = 9;
    s.targetFrame = 6;
    s.paintedFrame = 4;
    s.backingW = 1920;
    s.backingH = 1200;
    resetFilmStats(s, c, 100);
    for (const k of [
      "requests", "refetches", "decodes", "failures", "draws", "exactDraws", "fallbackDraws", "fallbackDistance",
      "ticks", "staleTicks", "staleMs", "staleMsMax", "held", "canvasResizes", "measures",
    ] as const) {
      assert.equal(s[k], 0, k);
    }
    assert.equal(s.framesAlive, 1);
    assert.equal(s.framesAlivePeak, 1);
    assert.equal(s.decodedMBPeak, s.decodedMB);
    assert.equal(s.inflight, 2);
    assert.equal(s.inflightPeak, 2);
    assert.equal(s.targetFrame, 6);
    assert.equal(s.paintedFrame, 4);
    assert.equal(s.backingW, 1920);
    assert.equal(s.backingH, 1200);
    assert.equal(s.mode, "legacy");
  });

  it("restarts an open stale stretch at the reset", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    tickStale(s, c, true, 0);
    tickStale(s, c, true, 500);
    resetFilmStats(s, c, 1000);
    tickStale(s, c, true, 1020);
    tickStale(s, c, false, 1050);
    assert.equal(s.staleMs, 50);
    assert.equal(s.staleMsMax, 50);
  });
});

describe("frame gauges and draws", () => {
  it("estimates a frame's decoded size from the tier width and the aspect", () => {
    assert.equal(frameBytes(1280, 16 / 9), 1280 * 720 * 4);
    assert.equal(frameBytes(432, 9 / 19.5), 432 * 936 * 4);
  });

  it("tracks frames alive, bytes and their peaks exactly", () => {
    const s = newFilmStats();
    const b = frameBytes(768, 16 / 9);
    for (let i = 0; i < 5; i++) holdFrame(s, b);
    for (let i = 0; i < 3; i++) dropFrame(s, b);
    holdFrame(s, b);
    assert.equal(s.framesAlive, 3);
    assert.equal(s.framesAlivePeak, 5);
    assert.equal(s.decodedBytes, 3 * b);
    assert.equal(s.decodedMB, (3 * b) / 1e6);
    assert.equal(s.decodedMBPeak, (5 * b) / 1e6);
    for (let i = 0; i < 3; i++) dropFrame(s, b);
    assert.equal(s.framesAlive, 0);
    assert.equal(s.decodedBytes, 0);
  });

  it("splits draws into exact and fallback paints", () => {
    const s = newFilmStats();
    const eff = { lo: 10, hi: 10 };
    countDraw(s, 10, eff);
    countDraw(s, 8, eff);
    countDraw(s, 13, eff);
    assert.equal(s.draws, 3);
    assert.equal(s.exactDraws, 1);
    assert.equal(s.fallbackDraws, 2);
    assert.equal(s.fallbackDistance, 5);
    assert.equal(s.exactDraws + s.fallbackDraws, s.draws);
  });

  it("counts requests, refetches and the in-flight peak", () => {
    const s = newFilmStats();
    countRequest(s, false, 1);
    countRequest(s, false, 2);
    countRequest(s, true, 3);
    s.inflight = 0;
    countRequest(s, false, 1);
    assert.equal(s.requests, 4);
    assert.equal(s.refetches, 1);
    assert.equal(s.inflightPeak, 3);
    assert.equal(s.inflight, 1);
  });
});

// The engine's rule (FilmBackdrop `usable`) for a film of 61 frames whose move ends at M = 40 and whose 20 tail
// frames play: on a coarse pointer only the even tail frames (42, 44, …) are ever requested.
const COUNT = 61;
const M = 40;
const coarseTail = (i: number) => i <= M || (i - M) % 2 === 0;
const fineTail = () => true;
// Reduced motion, 5 stills over the move: 0, 10, 20, 30, 40.
const stills = (i: number) => [0, 10, 20, 30, 40].includes(i);

describe("effective target (aimAt, missBy, onTarget)", () => {
  it("is the target itself when the engine loads it", () => {
    const eff = newEffectiveTarget();
    aimAt(eff, 43, COUNT, fineTail);
    assert.deepEqual(eff, { lo: 43, hi: 43 });
    aimAt(eff, 42, COUNT, coarseTail);
    assert.deepEqual(eff, { lo: 42, hi: 42 });
    aimAt(eff, 17, COUNT, coarseTail); // in the move every frame is usable
    assert.deepEqual(eff, { lo: 17, hi: 17 });
    const s = newFilmStats();
    countDraw(s, 42, eff); // 17 is wanted: 42 is a plain fallback
    assert.equal(s.fallbackDraws, 1);
    assert.equal(s.fallbackDistance, 25);
  });

  it("counts an even neighbour of an odd tail frame on a coarse pointer as exact, on either side", () => {
    const eff = newEffectiveTarget();
    aimAt(eff, 43, COUNT, coarseTail);
    assert.deepEqual(eff, { lo: 42, hi: 44 });
    const s = newFilmStats();
    countDraw(s, 42, eff);
    countDraw(s, 44, eff);
    assert.equal(s.draws, 2);
    assert.equal(s.exactDraws, 2);
    assert.equal(s.fallbackDraws, 0);
    assert.equal(s.fallbackDistance, 0);
    assert.equal(onTarget(eff, 3, 42, 3), true);
    assert.equal(onTarget(eff, 3, 44, 3), true);
    assert.equal(onTarget(eff, 2, 42, 3), false); // another segment's frame
    assert.equal(onTarget(eff, -1, -1, 3), false); // the canvas was cleared by a resize
    // The last frame of an odd tail has only its lower neighbour.
    aimAt(eff, 59, 60, coarseTail);
    assert.deepEqual(eff, { lo: 58, hi: 58 });
  });

  it("measures a fallback paint from the nearest effective frame, not from the raw target", () => {
    const eff = newEffectiveTarget();
    aimAt(eff, 43, COUNT, coarseTail);
    const s = newFilmStats();
    countDraw(s, 46, eff); // 3 from 43, 2 from 44
    countDraw(s, 40, eff); // 3 from 43, 2 from 42
    assert.equal(s.exactDraws, 0);
    assert.equal(s.fallbackDraws, 2);
    assert.equal(s.fallbackDistance, 4);
    assert.equal(missBy(eff, 46), 2);
    assert.equal(onTarget(eff, 0, 46, 0), false);
  });

  it("aims at a reduced-motion still, and a frame between stills at its nearest still", () => {
    const eff = newEffectiveTarget();
    aimAt(eff, 20, 41, stills);
    assert.deepEqual(eff, { lo: 20, hi: 20 });
    const s = newFilmStats();
    countDraw(s, 20, eff);
    countDraw(s, 10, eff);
    assert.equal(s.exactDraws, 1);
    assert.equal(s.fallbackDistance, 10);
    aimAt(eff, 13, 41, stills); // nearer 10 than 20
    assert.deepEqual(eff, { lo: 10, hi: 10 });
    assert.equal(missBy(eff, 10), 0);
    assert.equal(missBy(eff, 20), 10);
    aimAt(eff, 15, 41, stills); // halfway: either still
    assert.deepEqual(eff, { lo: 10, hi: 20 });
    assert.equal(missBy(eff, 20), 0);
  });

  it("keeps the raw target when nothing is usable", () => {
    const eff = newEffectiveTarget();
    aimAt(eff, 7, 10, () => false);
    assert.deepEqual(eff, { lo: 7, hi: 7 });
  });

  it("opens no stale stretch through a tail on a coarse pointer while the nearest usable frame shows", () => {
    const s = newFilmStats();
    const c = newStaleClock();
    const eff = newEffectiveTarget();
    // The clock walks the tail one frame a tick; the canvas shows the even frame at or just below the target
    // (what draw() paints with every even frame loaded): odd targets are never painted.
    let t = 0;
    for (let target = M; target <= M + 20; target++) {
      aimAt(eff, target, COUNT, coarseTail);
      const painted = target - ((target - M) % 2);
      countDraw(s, painted, eff);
      tickStale(s, c, !onTarget(eff, 4, painted, 4), (t += 16));
    }
    assert.equal(s.ticks, 21);
    assert.equal(s.staleTicks, 0);
    assert.equal(s.staleMs, 0);
    assert.equal(s.staleMsMax, 0);
    assert.equal(s.exactDraws, 21);
    assert.equal(s.fallbackDistance, 0);
    // The same pass scored against the raw target (the old rule) would have been stale on every odd tick.
    const old = newFilmStats();
    const oc = newStaleClock();
    t = 0;
    for (let target = M; target <= M + 20; target++) {
      tickStale(old, oc, target - ((target - M) % 2) !== target, (t += 16));
    }
    assert.equal(old.staleTicks, 10);
    assert.ok(old.staleMsMax > 0);
  });
});

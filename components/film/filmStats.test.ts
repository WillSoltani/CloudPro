import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countDraw,
  countRequest,
  dropFrame,
  frameBytes,
  holdFrame,
  newFilmStats,
  newStaleClock,
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
    countDraw(s, 4, 6);
    tickStale(s, c, false, 0);
    s.held = 3;
    s.canvasResizes = 1;
    s.measures = 9;
    s.targetFrame = 6;
    s.paintedFrame = 4;
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
    countDraw(s, 10, 10);
    countDraw(s, 8, 10);
    countDraw(s, 13, 10);
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

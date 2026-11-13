// Tests for loaderStatsFor (components/film/filmStats.ts): a loader's LoaderStats calls reach the page's counters
// with one meaning whichever loader runs. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loaderStatsFor, newInstrument, resetFilmStats } from "./filmStats";

describe("loaderStatsFor: the legacy way (a frame is held once it has decoded)", () => {
  it("counts requests, refetches, decodes, drops and failures as before the seam", () => {
    const inst = newInstrument();
    const ls = loaderStatsFor(inst);
    const s = inst.stats;
    ls.requested("a", 768, 3, 1);
    ls.requested("a", 768, 4, 2);
    ls.requested("a", 1280, 3, 3);
    ls.requested("a", 768, 3, 3);
    assert.deepEqual([s.requests, s.refetches, s.inflight, s.inflightPeak], [4, 1, 3, 3]);
    ls.released(2);
    assert.equal(s.inflight, 2);
    ls.decoded(1000);
    ls.decoded(1000);
    ls.dropped(1000);
    ls.failed();
    assert.deepEqual([s.decodes, s.framesAlive, s.framesAlivePeak, s.decodedBytes, s.failures], [2, 1, 2, 1000, 1]);
    // The budget loader's counters stay 0.
    assert.deepEqual(
      [s.redecodes, s.workerDecodes, s.mainThreadDecodes, s.decodeMsMean, s.decodeInFlightPeak, s.budgetMB, s.bytesHeldMB, s.bytesHeldMBPeak],
      [0, 0, 0, 0, 0, 0, 0, 0],
    );
    assert.equal(s.mode, "legacy");
  });
});

describe("loaderStatsFor: the budget way (a decode reserves its bytes when it starts)", () => {
  it("a reserved decode counts as held; a failed one is dropped; decodes split by where they ran", () => {
    const inst = newInstrument("budget");
    const ls = loaderStatsFor(inst);
    const s = inst.stats;
    ls.budget!(160e6);
    assert.equal(s.budgetMB, 160);
    ls.decodeStarted!(2e6, 1, false);
    ls.decodeStarted!(2e6, 2, true);
    assert.deepEqual([s.framesAlive, s.decodedMB, s.decodeInFlight, s.decodeInFlightPeak, s.redecodes, s.decodes], [2, 4, 2, 2, 1, 0]);
    ls.decodeEnded!(true, "worker", 10, 1);
    ls.decodeEnded!(false, "worker", 0, 0);
    ls.dropped(2e6); // the failed decode's reservation
    ls.failed();
    assert.deepEqual([s.decodes, s.workerDecodes, s.mainThreadDecodes, s.framesAlive, s.decodeInFlight, s.failures], [1, 1, 0, 1, 0, 1]);
    ls.decodeStarted!(2e6, 1, false);
    ls.decodeEnded!(true, "main", 20, 0);
    assert.deepEqual([s.decodes, s.mainThreadDecodes, s.decodeMsTotal, s.decodeMsMean], [2, 1, 30, 15]);
    ls.bytesHeld!(5e6);
    ls.bytesHeld!(3e6);
    assert.deepEqual([s.bytesHeldMB, s.bytesHeldMBPeak], [3, 5]);
    ls.mode!("budget-main");
    assert.equal(s.mode, "budget-main");
  });

  it("a reset zeroes the new counters and restarts the new peaks from the gauges", () => {
    const inst = newInstrument("budget");
    const ls = loaderStatsFor(inst);
    const s = inst.stats;
    ls.budget!(384e6);
    ls.decodeStarted!(1e6, 1, true);
    ls.decodeStarted!(1e6, 2, false);
    ls.decodeEnded!(true, "worker", 8, 1);
    ls.bytesHeld!(9e6);
    ls.bytesHeld!(4e6);
    resetFilmStats(s, inst.clock, 0);
    assert.deepEqual(
      [s.redecodes, s.decodes, s.workerDecodes, s.mainThreadDecodes, s.decodeMsTotal, s.decodeMsMean],
      [0, 0, 0, 0, 0, 0],
    );
    assert.deepEqual([s.decodeInFlight, s.decodeInFlightPeak], [1, 1]);
    assert.deepEqual([s.bytesHeldMB, s.bytesHeldMBPeak], [4, 4]);
    assert.deepEqual([s.framesAlive, s.framesAlivePeak, s.budgetMB], [2, 2, 384]);
  });
});

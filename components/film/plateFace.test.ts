// Tests for components/film/plateFace.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFaceWriter,
  createRestHint,
  flightQuad,
  HIDDEN,
  HINT_REST_MS,
  liftFrameOf,
  mayBeReleased,
  rideTransform,
  trackRow,
  type HintHost,
} from "./plateFace";

describe("trackRow and liftFrameOf", () => {
  it("reads row k at frame k when the track is as long as the film (the exports), clamped", () => {
    assert.equal(trackRow(0, 145, 145), 0);
    assert.equal(trackRow(66, 145, 145), 66);
    assert.equal(trackRow(200, 145, 145), 144);
    assert.equal(liftFrameOf(66, 145, 145), 66);
    assert.equal(liftFrameOf(-1, 145, 145), -1);
  });
  it("maps a shorter track proportionally, both ways", () => {
    assert.equal(trackRow(0, 73, 145), 0);
    assert.equal(trackRow(144, 73, 145), 72);
    assert.equal(trackRow(72, 73, 145), 36);
    assert.equal(liftFrameOf(36, 73, 145), 72);
    assert.equal(liftFrameOf(72, 73, 145), 144);
  });
});

describe("mayBeReleased", () => {
  it("looks at the pin only from camera rest on (or without a raw frame or an end)", () => {
    assert.equal(mayBeReleased(10, 144), false);
    assert.equal(mayBeReleased(143.99, 144), false);
    assert.equal(mayBeReleased(144, 144), true);
    assert.equal(mayBeReleased(undefined, 144), true);
    assert.equal(mayBeReleased(10, undefined), true);
  });
});

describe("flightQuad", () => {
  const from: [number, number][] = [
    [100, 200],
    [400, 210],
    [395, 260],
    [102, 250],
  ];
  const box = { left: 40, top: 120, right: 340, bottom: 170 };
  it("starts on the lift quad and lands on the box, corner for corner", () => {
    assert.deepEqual(flightQuad(from, box, 0), from);
    assert.deepEqual(flightQuad(from, box, 1), [
      [40, 120],
      [340, 120],
      [340, 170],
      [40, 170],
    ]);
  });
  it("is the formula the plate used with the layer's origin subtracted (the layer sits at 0, 0)", () => {
    const s = 0.37;
    const origin = { left: 0, top: 0 };
    const to = [
      [box.left - origin.left, box.top - origin.top],
      [box.right - origin.left, box.top - origin.top],
      [box.right - origin.left, box.bottom - origin.top],
      [box.left - origin.left, box.bottom - origin.top],
    ];
    const old = from.map(([x, y], i) => [x + (to[i][0] - x) * s, y + (to[i][1] - y) * s]);
    assert.deepEqual(flightQuad(from, box, s), old);
  });
});

describe("rideTransform", () => {
  const track: [number, number][] = [
    [0.2, 0.5],
    [0.22, 0.52],
    [0.25, 0.5],
  ];
  it("interpolates the track at the smoothed frame, less the rest, through the frame's size", () => {
    assert.equal(rideTransform(track, 0.5, [0.25, 0.5], { width: 1000, height: 500 }), "translate3d(-40.00px, 5.00px, 0)");
    assert.equal(rideTransform(track, 2, [0.25, 0.5], { width: 1000, height: 500 }), "translate3d(0.00px, 0.00px, 0)");
    assert.equal(rideTransform(track, 9, [0.25, 0.5], { width: 1000, height: 500 }), "translate3d(0.00px, 0.00px, 0)");
    assert.equal(rideTransform(track, -3, [0.25, 0.5], { width: 1000, height: 500 }), "translate3d(-50.00px, 0.00px, 0)");
  });
});

/** A fake clock and timer for the hint. */
function fakeHintHost() {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const changes: boolean[] = [];
  const host: HintHost = {
    set: (on) => changes.push(on),
    now: () => now,
    later: (fn, ms) => {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clear: (h) => {
      timers.delete(h as number);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  };
  return { host, advance, changes, timers };
}

describe("createRestHint", () => {
  it("goes on at the first move, stays while moves keep coming, goes HINT_REST_MS after the last", () => {
    const f = fakeHintHost();
    const hint = createRestHint(f.host);
    hint.moved();
    assert.deepEqual(f.changes, [true]);
    // 60 moves, one per 16 ms frame: one timer at a time, the hint stays on.
    for (let k = 0; k < 60; k++) {
      f.advance(16);
      hint.moved();
      assert.ok(f.timers.size <= 1);
    }
    assert.deepEqual(f.changes, [true]);
    f.advance(HINT_REST_MS - 1);
    assert.equal(hint.on, true);
    f.advance(1);
    assert.equal(hint.on, false);
    assert.deepEqual(f.changes, [true, false]);
    assert.equal(f.timers.size, 0);
  });
  it("goes at once when the plate hides, and on again at the next move", () => {
    const f = fakeHintHost();
    const hint = createRestHint(f.host);
    hint.moved();
    hint.off();
    hint.off();
    assert.deepEqual(f.changes, [true, false]);
    assert.equal(f.timers.size, 0);
    hint.moved();
    assert.deepEqual(f.changes, [true, false, true]);
  });
});

/** An element stand-in that counts every assignment (style properties and data attributes alike). */
function fakeElements() {
  const writes: string[] = [];
  const counting = <T extends object>(label: string, target: T): T =>
    new Proxy(target, {
      set(t, k, v) {
        writes.push(`${label}.${String(k)}=${String(v)}`);
        (t as Record<string | symbol, unknown>)[k] = v;
        return true;
      },
      deleteProperty(t, k) {
        writes.push(`delete ${label}.${String(k)}`);
        delete (t as Record<string | symbol, unknown>)[k];
        return true;
      },
    });
  const plate = { style: counting("style", { transform: "", opacity: "0", visibility: "hidden" }) };
  const layer = { dataset: counting<Record<string, string | undefined>>("data", { plateFrame: "-1" }) };
  const hints: string[] = [];
  const hint = { moved: () => hints.push("moved"), off: () => hints.push("off") };
  return { plate, layer, writes, hints, hint };
}

describe("createFaceWriter", () => {
  const shown = (transform: string, opacity: string, row: number, flight: string | null = null) =>
    ({ shown: true, transform, opacity, row, flight }) as const;

  it("writes everything once, then only what changed", () => {
    const e = fakeElements();
    const write = createFaceWriter(e.layer, e.plate, e.hint);
    write(shown("matrix3d(1)", "1", 30));
    assert.deepEqual(e.writes, ["style.transform=matrix3d(1)", "style.opacity=1", "style.visibility=visible", "data.plateFrame=30", "delete data.plateFlight"]);
    e.writes.length = 0;
    write(shown("matrix3d(1)", "1", 30));
    assert.deepEqual(e.writes, [], "the same face writes nothing");
    write(shown("matrix3d(2)", "1", 31));
    assert.deepEqual(e.writes, ["style.transform=matrix3d(2)", "data.plateFrame=31"]);
    assert.deepEqual(e.hints, ["moved", "moved"]);
  });

  it("hides once, keeps the transform, and leaves the flight value unless told", () => {
    const e = fakeElements();
    const write = createFaceWriter(e.layer, e.plate, e.hint);
    write(shown("matrix3d(1)", "0.5", 70, "0.400"));
    e.writes.length = 0;
    write(HIDDEN);
    assert.deepEqual(e.writes, ["style.opacity=0", "style.visibility=hidden", "data.plateFrame=-1"]);
    assert.equal(e.layer.dataset.plateFlight, "0.400");
    e.writes.length = 0;
    write(HIDDEN);
    write({ shown: false });
    assert.deepEqual(e.writes, []);
    assert.deepEqual(e.hints.slice(-3), ["off", "off", "off"]);
    write({ shown: false, flight: null });
    assert.deepEqual(e.writes, ["delete data.plateFlight"]);
    assert.equal(e.layer.dataset.plateFlight, undefined);
  });

  it("does not call an opacity or a row change a move", () => {
    const e = fakeElements();
    const write = createFaceWriter(e.layer, e.plate, e.hint);
    write(shown("m", "0.2", 26));
    write(shown("m", "0.6", 27));
    assert.deepEqual(e.hints, ["moved"]);
  });
});

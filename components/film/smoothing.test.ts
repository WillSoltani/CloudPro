// Tests for components/film/smoothing.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFollower,
  inputOf,
  MAX_SMOOTH_MS,
  smoothingFor,
  smoothParam,
  springForLag,
  springLagMs,
  TOUCH_LAG_MS,
  WHEEL_SPRING,
  type SpringParams,
} from "./smoothing";

const ratio = (s: SpringParams) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

describe("smoothingFor", () => {
  it("keeps today's spring for the wheel and the keys", () => {
    for (const input of ["wheel", "keys"] as const) {
      const s = smoothingFor(input);
      assert.deepEqual(s.spring, { stiffness: 140, damping: 24, mass: 1, restDelta: 0.0005 });
      assert.equal(s.input, input);
      assert.ok(Math.abs(s.lagMs - 171.43) < 0.01);
      // The touch override never reaches them.
      assert.deepEqual(smoothingFor(input, 0).spring, s.spring);
    }
  });

  it("gives touch the same spring run at TOUCH_LAG_MS", () => {
    assert.equal(TOUCH_LAG_MS, 35);
    const s = smoothingFor("touch");
    assert.equal(s.lagMs, 35);
    assert.ok(s.spring);
    assert.ok(Math.abs(springLagMs(s.spring) - 35) < 1e-9);
    assert.ok(Math.abs(ratio(s.spring) - ratio(WHEEL_SPRING)) < 1e-12, "same damping ratio");
    assert.ok(ratio(s.spring) >= 1, "not underdamped");
    assert.equal(s.spring.restDelta, WHEEL_SPRING.restDelta);
  });

  it("takes the touch lag it is given; 0 is no smoothing", () => {
    assert.equal(smoothingFor("touch", 90).lagMs, 90);
    assert.ok(Math.abs(springLagMs(smoothingFor("touch", 90).spring!) - 90) < 1e-9);
    assert.deepEqual(smoothingFor("touch", 0), { input: "touch", lagMs: 0, spring: null });
    assert.equal(springForLag(0), null);
    assert.equal(springForLag(-5), null);
    const same = springForLag(springLagMs(WHEEL_SPRING))!;
    for (const k of ["stiffness", "damping", "mass", "restDelta"] as const) assert.ok(Math.abs(same[k] - WHEEL_SPRING[k]) < 1e-9, k);
  });
});

describe("smoothParam", () => {
  it("reads whole milliseconds 0 to MAX_SMOOTH_MS", () => {
    assert.equal(MAX_SMOOTH_MS, 300);
    assert.equal(smoothParam("?smooth=0"), 0);
    assert.equal(smoothParam("?smooth=35"), 35);
    assert.equal(smoothParam("?hud=1&smooth=300"), 300);
    assert.equal(smoothParam(""), null);
    assert.equal(smoothParam("?smooth="), null);
    assert.equal(smoothParam("?smooth=301"), null);
    assert.equal(smoothParam("?smooth=-1"), null);
    assert.equal(smoothParam("?smooth=2.5"), null);
    assert.equal(smoothParam("?smooth=abc"), null);
    assert.equal(smoothParam("?smooth=0035"), null);
  });
});

describe("inputOf", () => {
  it("classifies the events the page listens to", () => {
    assert.equal(inputOf("touchstart"), "touch");
    assert.equal(inputOf("touchmove"), "touch");
    assert.equal(inputOf("pointerdown", { pointerType: "touch" }), "touch");
    assert.equal(inputOf("pointerdown", { pointerType: "pen" }), "touch");
    assert.equal(inputOf("pointerdown", { pointerType: "mouse" }), "wheel");
    assert.equal(inputOf("pointerdown", {}), null);
    assert.equal(inputOf("wheel"), "wheel");
    for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"]) assert.equal(inputOf("keydown", { key }), "keys");
    assert.equal(inputOf("keydown", { key: "a" }), null);
    assert.equal(inputOf("keydown"), null);
    // Momentum after the finger lifts keeps the input it had.
    assert.equal(inputOf("touchend"), null);
    assert.equal(inputOf("scroll"), null);
  });
});

/**
 * The engine around the spring, on a fake clock: frame k lasts `frameMs(k)` ms (60 Hz unless given; a loaded machine
 * gives 33, 50, 100 ms frames or an uneven mix). On a frame where the raw clock moved, the scroll event (FilmBackdrop
 * update: steer, then the spring's new target), then the spring advances one frame and the tick shows follow(spring). The
 * spring is integrated numerically (x'' = (k·(target − x) − d·x') / m, 0.25 ms steps); a jump sets the value and zeroes
 * the velocity, as framer-motion's MotionValue.jump does. scrollY is the raw clock × 1000.
 */
function simulate(params: SpringParams | null, rawAt: (tMs: number) => number, endMs: number, frameMs: (k: number) => number = () => 1000 / 60) {
  const f = createFollower();
  let x = rawAt(0);
  let v = 0;
  let target = x;
  let raw = x;
  let lastChange = 0;
  let quietDone = true;
  const ticks: { t: number; raw: number; spring: number; shown: number; dir: number }[] = [];
  f.follow(x, raw);
  for (let k = 0, dt = frameMs(0), t = dt; t <= endMs; k++, dt = frameMs(k), t += dt) {
    const next = rawAt(t);
    if (next !== raw) {
      const seed = f.steer(next - raw);
      if (Number.isFinite(seed)) {
        x = seed;
        v = 0;
      }
      raw = next;
      target = raw;
      if (!params) {
        x = raw;
        v = 0;
      }
      lastChange = t;
      quietDone = false;
    } else if (!quietDone && t - lastChange >= 150) {
      quietDone = true;
      const from = f.quiet(x);
      if (Number.isFinite(from)) {
        x = from;
        v = 0;
        target = raw;
      }
    }
    if (params) {
      for (let s = 0; s < dt; s += 0.25) {
        const a = (params.stiffness * (target - x) - params.damping * v) / params.mass;
        v += a * 0.00025;
        x += v * 0.00025;
      }
    }
    f.scrolled(raw * 1000);
    const shown = f.follow(x, raw);
    ticks.push({ t, raw, spring: x, shown, dir: f.direction });
  }
  return ticks;
}

const PARAMS = [
  { name: "wheel", params: smoothingFor("wheel").spring },
  { name: "touch", params: smoothingFor("touch").spring },
  { name: "touch ?smooth=0", params: smoothingFor("touch", 0).spring },
] as const;

/** Forward travel: the shown clock never passes the raw clock and never steps back. */
function assertForward(ticks: ReturnType<typeof simulate>) {
  let prev = -Infinity;
  for (const k of ticks) {
    assert.ok(k.shown <= k.raw + 1e-12, `past the raw clock at ${k.t.toFixed(0)} ms: ${k.shown} > ${k.raw}`);
    assert.ok(k.shown >= prev - 1e-12, `stepped back at ${k.t.toFixed(0)} ms`);
    prev = k.shown;
  }
}

// Wheel notches: +0.04 every 50 ms for 10 notches, then still. The spring carries velocity into the stop.
const notches = (t: number) => 0.04 * Math.min(10, Math.floor(t / 50));
// A finger at 0.9 clock units/s for 600 ms, then a fling's momentum decaying (5 % per frame).
const fling = (t: number) => {
  const v = 0.9 / 1000;
  if (t <= 600) return v * t;
  const frames = (t - 600) / (1000 / 60);
  return v * 600 + (v * (1000 / 60) * (1 - Math.pow(0.95, frames))) / 0.05;
};
// Forward at 0.8 units/s for 500 ms, then straight back at the same speed.
const reversal = (t: number) => (t <= 500 ? 0.0008 * t : Math.max(0, 0.4 - 0.0008 * (t - 500)));

for (const { name, params } of PARAMS) {
  describe(`follow rules with the ${name} smoothing`, () => {
    it("never passes the raw clock nor steps back through wheel notches, and lands on it", () => {
      const ticks = simulate(params, notches, 2000);
      assertForward(ticks);
      assert.ok(Math.abs(ticks[ticks.length - 1].shown - 0.4) < 1e-3);
    });

    it("never passes the raw clock nor steps back through a finger and its fling, and lands on it", () => {
      const ticks = simulate(params, fling, 3000);
      assertForward(ticks);
      assert.ok(Math.abs(ticks[ticks.length - 1].shown - ticks[ticks.length - 1].raw) < 1e-3);
    });

    it("turns at once on a reversal and never steps against the direction of travel", () => {
      const ticks = simulate(params, reversal, 1600);
      const turn = ticks.findIndex((k) => k.dir < 0);
      assert.ok(turn > 0, "the reversal is seen");
      // Before it: forward rules.
      assertForward(ticks.slice(0, turn));
      // From the reversal on: never forward again (it holds while the raw clock is still ahead of it), and when it
      // moves back it never passes the raw clock.
      for (let i = turn; i < ticks.length; i++) {
        assert.ok(ticks[i].shown <= ticks[i - 1].shown + 1e-12, `stepped forward after the reversal at ${ticks[i].t.toFixed(0)} ms`);
        if (ticks[i].shown < ticks[i - 1].shown) {
          assert.ok(ticks[i].shown >= ticks[i].raw - 1e-12, `past the raw clock going back at ${ticks[i].t.toFixed(0)} ms`);
        }
      }
      // The picture stops at once (above) and moves back once the raw clock has passed it, within the smoothing's own
      // lag: the spring, re-seeded at rest on the picture, first runs on toward the raw clock still ahead of it.
      const held = ticks[turn - 1].shown;
      const behind = ticks.findIndex((k, i) => i >= turn && k.raw < held);
      const back = ticks.findIndex((k, i) => i >= turn && k.shown < held);
      assert.ok(behind >= turn && back >= behind, "moves back only once the raw clock is behind the picture");
      const lag = params ? springLagMs(params) : 0;
      assert.ok(ticks[back].t - ticks[behind].t <= lag + 1000 / 60, `held ${(ticks[back].t - ticks[behind].t).toFixed(0)} ms after the raw clock passed`);
      assert.ok(Math.abs(ticks[ticks.length - 1].shown - ticks[ticks.length - 1].raw) < 1e-3, "lands on the raw clock");
    });
  });
}

describe("steady lag", () => {
  it("is the smoothing's lag for a clock moving at constant speed", () => {
    for (const { params, lag } of [
      { params: smoothingFor("wheel").spring!, lag: 171.43 },
      { params: smoothingFor("touch").spring!, lag: 35 },
    ]) {
      const speed = 0.5 / 1000; // units per ms
      const ticks = simulate(params, (t) => speed * t, 2000);
      const k = ticks[ticks.length - 1];
      const lagMs = (k.raw - k.shown) / speed;
      // The raw clock moves once per frame, so the spring's target trails the ramp by half a frame on average.
      assert.ok(Math.abs(lagMs - lag) < 1000 / 60, `${lagMs.toFixed(1)} ms, want about ${lag}`);
    }
  });

  it("touch trails the same finger by about a fifth of the wheel's lag", () => {
    const gap = (p: SpringParams) => {
      const ticks = simulate(p, fling, 600);
      return ticks.reduce((sum, k) => sum + (k.raw - k.shown), 0) / ticks.length;
    };
    const ratioGap = gap(smoothingFor("touch").spring!) / gap(smoothingFor("wheel").spring!);
    assert.ok(ratioGap < 0.35, String(ratioGap));
  });
});

// Frame schedules of a slow or loaded machine (ms per animation frame): steady 30, 20 and 10 Hz, and an uneven mix of
// 8 to 120 ms frames from a fixed seed. The browser spec (e2e/film-feel.spec.ts) no longer asserts timings; these do.
const SCHEDULES: { name: string; frameMs: (k: number) => number }[] = [
  { name: "60 Hz", frameMs: () => 1000 / 60 },
  { name: "30 Hz", frameMs: () => 1000 / 30 },
  { name: "50 ms frames", frameMs: () => 50 },
  { name: "100 ms frames", frameMs: () => 100 },
  {
    name: "uneven 8 to 120 ms frames",
    frameMs: (k) => {
      // A fixed sequence (an LCG on the frame index): the same "random" frames on every run.
      const r = ((k * 1103515245 + 12345) >>> 0) % 1000;
      return 8 + (112 * r) / 999;
    },
  },
];

describe("the feel on any frame schedule (a fake clock)", () => {
  for (const { name, frameMs } of SCHEDULES) {
    it(`${name}: the same finger trails less under touch than under the wheel's spring`, () => {
      // The browser spec's comparison: one scripted finger (0.9 units/s, then the fling), the mean gap per tick.
      const gap = (p: SpringParams) => {
        const ticks = simulate(p, fling, 900, frameMs);
        assert.ok(ticks.length > 0);
        return ticks.reduce((sum, k) => sum + (k.raw - k.shown), 0) / ticks.length;
      };
      const touch = gap(smoothingFor("touch").spring!);
      const wheel = gap(smoothingFor("wheel").spring!);
      assert.ok(touch < wheel, `touch ${touch} vs wheel ${wheel}`);
      assert.ok(touch / wheel < 0.6, `ratio ${touch / wheel}`);
    });

    for (const { name: smoothing, params } of PARAMS) {
      it(`${name}, ${smoothing}: never past the raw clock nor a step back, through notches and a fling, and lands`, () => {
        for (const [rawAt, end] of [
          [notches, 3000],
          [fling, 4000],
        ] as const) {
          const ticks = simulate(params, rawAt, end, frameMs);
          assertForward(ticks);
          const last = ticks[ticks.length - 1];
          assert.ok(Math.abs(last.shown - last.raw) < 1e-3, `lands: ${last.shown} vs ${last.raw}`);
        }
      });
    }
  }
});

describe("createFollower", () => {
  it("shows the first value as it is and lands on demand", () => {
    const f = createFollower();
    assert.ok(Number.isNaN(f.shown));
    assert.equal(f.follow(0.3, 0.5), 0.3);
    assert.equal(f.land(0.9), 0.9);
    assert.equal(f.shown, 0.9);
  });

  it("asks for a re-seed at the shown clock only on a reversal", () => {
    const f = createFollower();
    f.follow(0, 0);
    assert.ok(Number.isNaN(f.steer(0.1)));
    f.follow(0.05, 0.1);
    assert.ok(Number.isNaN(f.steer(0.1)));
    assert.equal(f.steer(-0.02), 0.05);
    assert.equal(f.direction, -1);
    assert.ok(Number.isNaN(f.steer(1e-9)), "no movement, no change");
    assert.equal(f.direction, -1);
  });

  it("takes the direction from scrollY a tick before the scroll event", () => {
    const f = createFollower();
    f.follow(0.2, 0.3);
    f.steer(0.1);
    f.scrolled(300);
    f.scrolled(280); // the viewer turned; the scroll event has not run yet
    assert.equal(f.direction, -1);
    // The spring still runs forward: the picture holds.
    assert.equal(f.follow(0.25, 0.3), 0.2);
  });

  it("goes quiet: no direction, and a carry-on point only when the spring ran away from the picture", () => {
    const f = createFollower();
    f.follow(0.2, 0.2);
    f.steer(0.1);
    assert.ok(Number.isNaN(f.quiet(0.2)));
    assert.equal(f.direction, 0);
    assert.equal(f.quiet(0.26), 0.2);
    // Without a direction it moves toward the raw clock from either side.
    assert.equal(f.follow(0.1, 0.1), 0.1);
    assert.equal(f.follow(0.15, 0.3), 0.15);
  });
});

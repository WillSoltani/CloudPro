import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, openHome, readFilmStats, settle, settleNote } from "./film-frames";

// The feel of the scrub (components/film/smoothing.ts): how far the shown clock (the canvas's `data-clock`, the frame
// stats.targetFrame) trails the raw clock (stats.rawClock / rawFrame, set on every scroll event) while the page moves,
// for a touch-style scroll (a touchstart, then scripted scrollTo steps every animation frame at a steady speed, then
// a momentum decay, as a fling does) and a wheel scroll (real wheel events). Each run reports the mean and the largest
// gap while the page moves, in milliseconds of scroll time (how long ago the raw clock was where the picture is now)
// and in film frames, and how long the picture takes to land after the scroll stops. Timings depend on the machine, so
// the spec asserts only what does not: the input and the smoothing the counters report, the rules (never past the raw
// clock, never a step back while scrolling forward, landing on the raw clock), and a tick count for scrolls that are
// driven frame by frame (so the count does not depend on how long a frame takes). It prints the numbers (FEEL lines).
// The timing claims (touch trails the same finger less than the wheel's spring; the rules at 60 Hz, 30 Hz, 50 and
// 100 ms frames and an uneven mix) are unit tests on a fake clock: components/film/smoothing.test.ts.

test.beforeAll(() => assertPlaceholdersPresent());

type Raw = { t: number; raw: number };
type Shown = { t: number; shown: number; raw: number; rawSeg: number; rawFrame: number; seg: number; frame: number };
type Feel = {
  input: string;
  smoothMs: number;
  samples: number;
  meanMs: number;
  maxMs: number;
  meanFrames: number;
  maxFrames: number;
  landMs: number;
  overshoot: number;
  backStep: number;
};

/** Records every raw clock change (scroll events, after the engine's own listener) and every shown clock tick. */
async function record(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-clock]")!;
    const w = window as unknown as { __feel: { raws: Raw[]; shows: Shown[]; stop: () => void } };
    const raws: Raw[] = [];
    const shows: Shown[] = [];
    const onScroll = () => raws.push({ t: performance.now(), raw: window.__filmStats!.rawClock });
    window.addEventListener("scroll", onScroll, { passive: true });
    const mo = new MutationObserver(() => {
      const s = window.__filmStats!;
      shows.push({
        t: performance.now(),
        shown: Number(canvas.dataset.clock),
        raw: s.rawClock,
        rawSeg: s.rawSeg,
        rawFrame: s.rawFrame,
        seg: s.targetSeg,
        frame: s.targetFrame,
      });
    });
    mo.observe(canvas, { attributes: true, attributeFilter: ["data-clock"] });
    w.__feel = {
      raws,
      shows,
      stop: () => {
        window.removeEventListener("scroll", onScroll);
        mo.disconnect();
      },
    };
  });
}

async function collect(page: Page): Promise<{ raws: Raw[]; shows: Shown[] }> {
  return page.evaluate(() => {
    const w = window as unknown as { __feel: { raws: Raw[]; shows: Shown[]; stop: () => void } };
    w.__feel.stop();
    return { raws: w.__feel.raws, shows: w.__feel.shows };
  });
}

/** The gap figures for a forward scroll, from the recorded clocks (`data-clock` has 3 decimals: 0.0005 of slack). */
function analyse(raws: Raw[], shows: Shown[], input: string, smoothMs: number): Feel {
  const eps = 0.0006;
  const moving = raws.filter((r, k) => k === 0 || r.raw !== raws[k - 1].raw);
  const t0 = moving[0]?.t ?? 0;
  const tEnd = moving[moving.length - 1]?.t ?? 0;
  const final = moving[moving.length - 1]?.raw ?? 0;
  // When the raw clock first reached x (interpolated between scroll events).
  const reached = (x: number): number => {
    for (let k = 0; k < moving.length; k++) {
      if (moving[k].raw + 1e-9 < x) continue;
      if (k === 0) return moving[0].t;
      const a = moving[k - 1];
      const b = moving[k];
      return a.t + ((x - a.raw) / (b.raw - a.raw)) * (b.t - a.t);
    }
    return Number.NaN;
  };
  const during = shows.filter((s) => s.t >= t0 && s.t <= tEnd);
  const ms: number[] = [];
  const frames: number[] = [];
  let overshoot = 0;
  let backStep = 0;
  let prev = Number.NaN;
  for (const s of shows) {
    if (s.t < t0) continue;
    overshoot = Math.max(overshoot, s.shown - s.raw - eps);
    if (Number.isFinite(prev)) backStep = Math.max(backStep, prev - s.shown - eps);
    prev = s.shown;
  }
  for (const s of during) {
    const caught = s.shown >= s.raw - eps;
    const at = reached(s.shown);
    ms.push(caught || !Number.isFinite(at) ? 0 : Math.max(0, s.t - at));
    frames.push(s.rawSeg === s.seg ? Math.abs(s.rawFrame - s.frame) : Number.NaN);
  }
  const landed = shows.find((s) => s.t >= tEnd && Math.abs(s.shown - final) <= eps);
  const fr = frames.filter(Number.isFinite);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    input,
    smoothMs,
    samples: during.length,
    meanMs: mean(ms),
    maxMs: Math.max(0, ...ms),
    meanFrames: mean(fr),
    maxFrames: Math.max(0, ...fr),
    landMs: landed ? landed.t - tEnd : Number.NaN,
    overshoot: Math.max(0, overshoot),
    backStep: Math.max(0, backStep),
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const report = (f: Feel) =>
  `FEEL ${f.input} (smoothing ${r1(f.smoothMs)} ms): lag mean ${r1(f.meanMs)} ms / max ${r1(f.maxMs)} ms, ` +
  `frames mean ${r1(f.meanFrames)} / max ${f.maxFrames}, lands ${r1(f.landMs)} ms after the last scroll, ${f.samples} ticks`;

/** Home page at rest, after the load-time landing window (FilmBackdrop SETTLE_MS) has passed. */
async function ready(page: Page, query = ""): Promise<void> {
  await openHome(page, query);
  expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
  // FilmBackdrop's landing window: SETTLE_MS (500 ms) after the load event, or after the backdrop mounted (before the
  // settle above) when the page had loaded by then. Wait until both are past, on the page's own clock.
  const after = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    ({ after, ms }) => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return !!nav && nav.loadEventEnd > 0 && performance.now() > Math.max(after, nav.loadEventEnd) + ms;
    },
    { after, ms: 600 },
    { timeout: 60_000 },
  );
}

/**
 * A touch-style scroll, driven frame by frame (the same scroll on any machine): a touchstart, then a scrollTo every
 * animation frame of `speed` / 60 px for `frames` frames (a finger at `speed` px/s at 60 Hz), then a fling's decay
 * (5 % less per frame, no touch events) until it is under 20 px/s.
 */
async function touchScroll(page: Page, speed = 900, frames = 60): Promise<void> {
  await page.evaluate(
    async ({ speed, frames }) => {
      const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
      document.dispatchEvent(new Event("touchstart", { bubbles: true }));
      let y = window.scrollY;
      let v = speed;
      await frame();
      for (let k = 0; ; k++) {
        await frame();
        if (k < frames) {
          document.dispatchEvent(new Event("touchmove", { bubbles: true }));
        } else {
          // The finger has lifted: the browser's momentum, decaying (no touch events).
          v *= 0.95;
          if (v < 20) break;
        }
        y += v / 60;
        window.scrollTo({ top: Math.round(y), behavior: "instant" });
      }
    },
    { speed, frames },
  );
}

/** Waits `n` animation frames of the page. */
const frames = (page: Page, n: number) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

/** A wheel scroll: `steps` notches of `delta` px, `gapFrames` animation frames apart. */
async function wheelScroll(page: Page, steps = 12, delta = 100, gapFrames = 3): Promise<void> {
  await page.mouse.move(400, 400);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, delta);
    await frames(page, gapFrames);
  }
}

/** Until the shown clock has landed on the raw clock (the smoothing has finished; a condition, not a time). */
async function landed(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-clock]");
      return !!c && !!window.__filmStats && c.dataset.clock === window.__filmStats.rawClock.toFixed(3);
    },
    undefined,
    { timeout: 30_000 },
  );
}

async function measureFeel(page: Page, drive: () => Promise<void>): Promise<Feel> {
  await record(page);
  await drive();
  // The whole landing is recorded (overshoot and back-steps are checked through it).
  await landed(page);
  await frames(page, 2);
  const { raws, shows } = await collect(page);
  const s = (await readFilmStats(page))!;
  return analyse(raws, shows, s.input, s.smoothMs);
}

test("touch: the picture follows the finger closely, never past it and never back @feel", async ({ page }, info) => {
  test.setTimeout(120_000);
  await ready(page);
  const feel = await measureFeel(page, () => touchScroll(page));
  console.log(report(feel));
  await info.attach("feel-touch", { body: JSON.stringify(feel, null, 2), contentType: "application/json" });
  expect(feel.input).toBe("touch");
  expect(feel.smoothMs).toBe(35);
  // 60 frames of finger and about 75 of fling, each a scroll step: ticks while it moves, however long a frame takes.
  expect(feel.samples, "ticks while the page moves").toBeGreaterThan(20);
  expect(feel.overshoot, "the shown clock never passes the raw clock").toBe(0);
  expect(feel.backStep, "no step back while scrolling forward").toBe(0);
});

test("wheel: today's spring, never past the raw clock and never back @feel", async ({ page }, info) => {
  test.setTimeout(120_000);
  await ready(page);
  const feel = await measureFeel(page, () => wheelScroll(page));
  console.log(report(feel));
  await info.attach("feel-wheel", { body: JSON.stringify(feel, null, 2), contentType: "application/json" });
  expect(feel.input).toBe("wheel");
  expect(Math.round(feel.smoothMs)).toBe(171);
  // 12 notches 3 frames apart: the spring moves on every frame in between, however long a frame takes.
  expect(feel.samples, "ticks while the page moves").toBeGreaterThan(10);
  expect(feel.overshoot, "the shown clock never passes the raw clock").toBe(0);
  expect(feel.backStep, "no step back while scrolling forward").toBe(0);
});

test("the same scripted scroll under the wheel's spring and under touch: each input's smoothing, the same rules @feel", async ({ page }) => {
  test.setTimeout(120_000);
  // One page load: a wheel notch first sets the wheel input, then the scripted scroll runs under it (today's
  // smoothing for every input); a touchstart switches to touch for the second, identical scroll. Which one trails
  // less is a timing claim, unit-tested on a fake clock (components/film/smoothing.test.ts, "the feel on any frame
  // schedule"); here the figures are printed and the rules asserted for both.
  await ready(page);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 1);
  await landed(page);
  const asWheel = await measureFeel(page, () =>
    page.evaluate(async () => {
      const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
      let y = window.scrollY;
      await frame();
      for (let k = 0; k < 48; k++) {
        await frame();
        y += 900 / 60;
        window.scrollTo({ top: Math.round(y), behavior: "instant" });
      }
    }),
  );
  const asTouch = await measureFeel(page, () => touchScroll(page, 900, 48));
  console.log(`${report(asWheel).replace("FEEL wheel", "FEEL scripted-under-wheel")}`);
  console.log(`${report(asTouch).replace("FEEL touch", "FEEL scripted-under-touch")}`);
  expect(asWheel.input).toBe("wheel");
  expect(Math.round(asWheel.smoothMs)).toBe(171);
  expect(asTouch.input).toBe("touch");
  expect(asTouch.smoothMs).toBe(35);
  for (const [name, f] of [
    ["wheel", asWheel],
    ["touch", asTouch],
  ] as const) {
    expect(f.samples, `${name}: ticks while the page moves`).toBeGreaterThan(10);
    expect(f.overshoot, `${name}: the shown clock never passes the raw clock`).toBe(0);
    expect(f.backStep, `${name}: no step back while scrolling forward`).toBe(0);
  }
});

test("?smooth=<ms> sets the touch smoothing and the HUD names the input @feel", async ({ page }) => {
  await ready(page, "?smooth=90&hud=1");
  const hud = page.locator("[data-film-hud]");
  await expect(hud).toContainText("wheel 171 ms");
  await page.evaluate(() => document.dispatchEvent(new Event("touchstart", { bubbles: true })));
  await expect(hud).toContainText("touch 90 ms");
  expect((await readFilmStats(page))!.smoothMs).toBe(90);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 40);
  await expect(hud).toContainText("wheel 171 ms");
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("no smoothing for any input @feel", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => document.dispatchEvent(new Event("touchstart", { bubbles: true })));
    await expect.poll(async () => (await readFilmStats(page))!.input).toBe("touch");
    expect((await readFilmStats(page))!.smoothMs).toBe(0);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const c = document.querySelector<HTMLCanvasElement>("canvas[data-clock]")!;
          return Number(c.dataset.clock).toFixed(3) === window.__filmStats!.rawClock.toFixed(3);
        }),
      )
      .toBe(true);
  });
});

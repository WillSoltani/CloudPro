import { expect, test, type Page } from "@playwright/test";
import type { FilmStats } from "../components/film/filmStats";
import { assertPlaceholdersPresent, LOADERS, loaderQuery } from "./film-frames";

// The engine's counters (components/film/filmStats.ts): `window.__filmStats` exists on the home page of a
// production build, moves with a scroll, and its parts add up; `?hud=1` shows them and nothing else does. With both
// frame loaders (LOADERS).

test.beforeAll(() => assertPlaceholdersPresent());

const readStats = (page: Page) => page.evaluate(() => (window.__filmStats ? { ...window.__filmStats } : null));

async function scrollDown(page: Page) {
  await page.mouse.move(400, 400);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(60);
  }
}

for (const loader of LOADERS) test.describe(loader.name, () => {
test("window.__filmStats counts a one-way scroll @stats", async ({ page }) => {
  await page.goto(`/${loaderQuery(loader)}`, { waitUntil: "load" });
  await expect(page.locator("canvas[data-segment]")).toHaveAttribute("data-frame", /^\d+$/);
  await expect.poll(async () => (await readStats(page))?.mode).toBe(loader.mode);
  expect(await page.evaluate(() => typeof window.__filmStatsReset)).toBe("function");

  const before = (await readStats(page)) as FilmStats;
  await scrollDown(page);
  await expect.poll(async () => (await readStats(page))?.draws ?? 0).toBeGreaterThan(before.draws);
  // Let the spring settle so the counters stop moving between reads.
  await page.waitForTimeout(800);
  const s = (await readStats(page)) as FilmStats;

  expect(s.requests).toBeGreaterThan(0);
  expect(s.draws).toBeGreaterThan(0);
  expect(s.exactDraws + s.fallbackDraws).toBe(s.draws);
  expect(s.refetches).toBe(0);
  expect(s.framesAlive).toBeGreaterThanOrEqual(0);
  // A budget loader's decode holds its frame from the moment it starts (its bytes are reserved).
  expect(s.framesAlive).toBeLessThanOrEqual(s.decodes + s.decodeInFlight);
  expect(s.framesAlivePeak).toBeGreaterThanOrEqual(s.framesAlive);
  expect(s.decodedMBPeak).toBeGreaterThan(0);
  // A frame decoded again from kept bytes (a redecode) needs no request.
  expect(s.decodes - s.redecodes + s.failures).toBeLessThanOrEqual(s.requests);
  if (loader.name === "budget") {
    // Decoded in the film worker, inside the budget, from bytes kept since they were fetched.
    expect(s.workerDecodes).toBeGreaterThan(0);
    expect(s.mainThreadDecodes).toBe(0);
    expect(s.workerDecodes).toBe(s.decodes);
    expect(s.decodeMsMean).toBeGreaterThanOrEqual(0);
    expect(s.decodeInFlightPeak).toBeGreaterThan(0);
    expect(s.budgetMB).toBeGreaterThan(0);
    expect(s.decodedMBPeak).toBeLessThanOrEqual(s.budgetMB + 1e-6);
    expect(s.bytesHeldMB).toBeGreaterThan(0);
    expect(s.bytesHeldMBPeak).toBeGreaterThanOrEqual(s.bytesHeldMB);
  } else {
    for (const k of ["redecodes", "workerDecodes", "mainThreadDecodes", "decodeInFlightPeak", "budgetMB", "bytesHeldMB"] as const) expect(s[k], k).toBe(0);
  }
  expect(s.inflightPeak).toBeGreaterThan(0);
  expect(s.inflight).toBeGreaterThanOrEqual(0);
  expect(s.ticks).toBeGreaterThan(0);
  expect(s.staleTicks).toBeLessThanOrEqual(s.ticks);
  expect(s.staleMsMax).toBeLessThanOrEqual(s.staleMs + 1e-6);
  // A fine pointer without reduced motion loads every frame, so the effective target is the target itself.
  expect(s.effectiveFrame).toBe(s.targetFrame);
  expect(s.measures).toBeGreaterThan(0);
  expect(s.canvasResizes).toBeGreaterThan(0); // the first sizing of the backing store
  // The painted values are the ones the canvas hooks carry, both read in one synchronous step (a frame that lands
  // between two reads would repaint the canvas in between).
  const pair = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
    const st = window.__filmStats!;
    return {
      stats: { film: st.paintedFilm, frame: st.paintedFrame, width: st.width },
      hook: { film: c.dataset.segment, frame: Number(c.dataset.frame), width: Number(c.dataset.width) },
    };
  });
  expect(pair.stats).toEqual(pair.hook);

  // The reset zeroes the counters and keeps the gauges. The loader goes on in the background, so the gauge is
  // read in the same synchronous step as the reset, not from the earlier read.
  const { gaugeBefore, after } = await page.evaluate(() => {
    const gaugeBefore = window.__filmStats!.framesAlive;
    window.__filmStatsReset!();
    return { gaugeBefore, after: { ...window.__filmStats! } };
  });
  for (const k of ["requests", "refetches", "decodes", "redecodes", "workerDecodes", "mainThreadDecodes", "decodeMsTotal", "failures", "draws", "exactDraws", "fallbackDraws", "ticks", "staleTicks", "staleMs", "staleMsMax", "held", "canvasResizes", "measures"] as const) {
    expect(after[k], k).toBe(0);
  }
  expect(after.framesAlive).toBe(gaugeBefore);
  expect(after.framesAlivePeak).toBe(after.framesAlive);
});

test("the HUD shows only with ?hud=1 @stats", async ({ page }) => {
  await page.goto(`/${loaderQuery(loader)}`, { waitUntil: "load" });
  await expect(page.locator("canvas[data-segment]")).toHaveAttribute("data-frame", /^\d+$/);
  await page.waitForTimeout(600);
  await expect(page.locator("[data-film-hud]")).toHaveCount(0);

  await page.goto(`/${loaderQuery(loader, "hud=1")}`, { waitUntil: "load" });
  const hud = page.locator("[data-film-hud]");
  await expect(hud).toHaveCount(1);
  await expect(hud).toHaveAttribute("aria-hidden", "true");
  await expect(hud).toHaveCSS("pointer-events", "none");
  await expect(hud).toHaveCSS("position", "fixed");
  await expect(hud).toContainText("rack-00");
  await expect(hud).toContainText(/exact \d+%/);
  await expect(hud).toContainText(loader.mode);
  if (loader.name === "budget") await expect(hud).toContainText(/alive \d+ \(\d+\/\d+ MB\).*bytes [\d.]+ MB · redecode \d+/);
});
});

test("?loader=budget-main decodes on the main thread and ?budget= sets the budget @stats", async ({ page }) => {
  await page.goto("/?loader=budget-main&budget=160", { waitUntil: "load" });
  await expect(page.locator("canvas[data-segment]")).toHaveAttribute("data-frame", /^\d+$/);
  await expect.poll(async () => (await readStats(page))?.mode).toBe("budget-main");
  await scrollDown(page);
  await page.waitForTimeout(800);
  const s = (await readStats(page)) as FilmStats;
  expect(s.mainThreadDecodes).toBeGreaterThan(0);
  expect(s.workerDecodes).toBe(0);
  expect(s.budgetMB).toBeCloseTo((160 * 1024 * 1024) / 1e6, 3);
  expect(s.decodedMBPeak).toBeLessThanOrEqual(s.budgetMB + 1e-6);
  expect(s.refetches).toBe(0);
  expect(s.failures).toBe(0);
});

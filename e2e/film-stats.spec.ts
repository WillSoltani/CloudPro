import { expect, test, type Page } from "@playwright/test";
import type { FilmStats } from "../components/film/filmStats";
import { assertPlaceholdersPresent } from "./film-frames";

// The engine's counters (components/film/filmStats.ts): `window.__filmStats` exists on the home page of a
// production build, moves with a scroll, and its parts add up; `?hud=1` shows them and nothing else does.

test.beforeAll(() => assertPlaceholdersPresent());

const readStats = (page: Page) => page.evaluate(() => (window.__filmStats ? { ...window.__filmStats } : null));

async function scrollDown(page: Page) {
  await page.mouse.move(400, 400);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(60);
  }
}

test("window.__filmStats counts a one-way scroll @stats", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("canvas[data-segment]")).toHaveAttribute("data-frame", /^\d+$/);
  await expect.poll(async () => (await readStats(page))?.mode).toBe("legacy");
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
  expect(s.framesAlive).toBeLessThanOrEqual(s.decodes);
  expect(s.framesAlivePeak).toBeGreaterThanOrEqual(s.framesAlive);
  expect(s.decodedMBPeak).toBeGreaterThan(0);
  expect(s.decodes + s.failures).toBeLessThanOrEqual(s.requests);
  expect(s.inflightPeak).toBeGreaterThan(0);
  expect(s.inflight).toBeGreaterThanOrEqual(0);
  expect(s.ticks).toBeGreaterThan(0);
  expect(s.staleTicks).toBeLessThanOrEqual(s.ticks);
  expect(s.staleMsMax).toBeLessThanOrEqual(s.staleMs + 1e-6);
  expect(s.measures).toBeGreaterThan(0);
  expect(s.canvasResizes).toBeGreaterThan(0); // the first sizing of the backing store
  // The painted values are the ones the canvas hooks carry.
  const canvas = page.locator("canvas[data-segment]");
  expect(s.paintedFilm).toBe(await canvas.getAttribute("data-segment"));
  expect(s.paintedFrame).toBe(Number(await canvas.getAttribute("data-frame")));
  expect(s.width).toBe(Number(await canvas.getAttribute("data-width")));

  // The reset zeroes the counters and keeps the gauges.
  const after = await page.evaluate(() => {
    window.__filmStatsReset!();
    return { ...window.__filmStats! };
  });
  for (const k of ["requests", "refetches", "decodes", "failures", "draws", "exactDraws", "fallbackDraws", "ticks", "staleTicks", "staleMs", "staleMsMax", "held", "canvasResizes", "measures"] as const) {
    expect(after[k], k).toBe(0);
  }
  expect(after.framesAlive).toBe(s.framesAlive);
  expect(after.framesAlivePeak).toBe(after.framesAlive);
});

test("the HUD shows only with ?hud=1 @stats", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("canvas[data-segment]")).toHaveAttribute("data-frame", /^\d+$/);
  await page.waitForTimeout(600);
  await expect(page.locator("[data-film-hud]")).toHaveCount(0);

  await page.goto("/?hud=1", { waitUntil: "load" });
  const hud = page.locator("[data-film-hud]");
  await expect(hud).toHaveCount(1);
  await expect(hud).toHaveAttribute("aria-hidden", "true");
  await expect(hud).toHaveCSS("pointer-events", "none");
  await expect(hud).toHaveCSS("position", "fixed");
  await expect(hud).toContainText("rack-00");
  await expect(hud).toContainText(/exact \d+%/);
});

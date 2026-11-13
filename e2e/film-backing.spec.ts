import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, LOADERS, loaderQuery, openHome, PLACEHOLDER_RUN, readFilmStats, readPaintedFrame, settle, watchPage } from "./film-frames";

// The canvas backing store (components/film/backing.ts): never wider than the widest frame tier in use, the DPR
// capped at 2, the aspect of the box kept; ?backing=full restores the old size rule for the page load. The size is
// allocated once at load (canvasResizes counts real reallocations only), and the painted frame read back from the
// pixels is still the one `data-frame` names. No timing thresholds. With both frame loaders (LOADERS).

test.beforeAll(() => assertPlaceholdersPresent());

const VIEWPORTS = [
  { name: "1440x900 dpr 2", w: 1440, h: 900, dpr: 2, touch: false },
  { name: "390x844 dpr 3", w: 390, h: 844, dpr: 3, touch: true },
] as const;

/** Scrolls down a few viewports and returns every tier width the canvas painted at (data-width), the widest included. */
async function scrollAndSampleTiers(page: Page): Promise<number[]> {
  const seen = new Set<number>();
  const sample = async () => {
    const w = await page.evaluate(() => Number(document.querySelector<HTMLCanvasElement>("canvas[data-segment]")?.dataset.width ?? 0));
    if (w > 0) seen.add(w);
  };
  await sample();
  const step = Math.round(page.viewportSize()!.height / 2);
  for (let i = 1; i <= 8; i++) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), i * step);
    expect(await settle(page), `settles at ${i * step}`).toBe(true);
    await sample();
  }
  return [...seen];
}

const canvasBox = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
    return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, dpr: window.devicePixelRatio };
  });

for (const loader of LOADERS) for (const vp of VIEWPORTS) {
  test.describe(`${loader.name} ${vp.name}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });

    test("the backing store is capped at the widest tier in use and allocated once @backing", async ({ page, baseURL }) => {
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page, loaderQuery(loader));
      expect(await settle(page), "the first frame settles").toBe(true);

      const tiers = await scrollAndSampleTiers(page);
      const widest = Math.max(...tiers);
      const box = await canvasBox(page);
      const stats = (await readFilmStats(page))!;

      expect(box.dpr).toBe(vp.dpr);
      expect(box.cssW).toBe(vp.w);
      expect(box.w, `backing ${box.w}x${box.h} within the widest tier in use (${tiers.join(", ")})`).toBeLessThanOrEqual(widest);
      expect(box.w).toBeLessThanOrEqual(1920);
      // The same scale on both sides: the aspect of the CSS box within one pixel.
      expect(Math.abs(box.h - (box.w * box.cssH) / box.cssW)).toBeLessThanOrEqual(1);
      // Smaller than the old rule on a high-density screen, never smaller than the CSS box needs of the frames it shows.
      expect(box.w).toBeLessThan(Math.round(box.cssW * Math.min(box.dpr, 2)) + 1);
      if (vp.w === 1440) expect(box.w).toBeLessThan(2880);
      expect(box.w).toBeGreaterThanOrEqual(Math.min(box.cssW, widest));
      // The gauges say the same, and the canvas was allocated at load and then left alone.
      expect([stats.backingW, stats.backingH]).toEqual([box.w, box.h]);
      expect(stats.canvasResizes, "reallocations after load and a short scroll").toBeLessThanOrEqual(2);
      expect(stats.canvasResizes).toBeGreaterThan(0);
      expect(stats.mode, "the loader running").toBe(loader.mode);

      if (PLACEHOLDER_RUN) {
        const painted = await readPaintedFrame(page);
        expect(painted?.pixels, "the pixels name the frame").toEqual({ film: painted?.hook.segment, index: painted?.hook.frame });
      }
      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });

    test("?backing=full restores the old size rule for the page load @backing", async ({ page }) => {
      await openHome(page, loaderQuery(loader, "backing=full&hud=1"));
      expect(await settle(page), "the first frame settles").toBe(true);
      const box = await canvasBox(page);
      const dpr = Math.min(box.dpr, 2);
      expect([box.w, box.h]).toEqual([Math.round(box.cssW * dpr), Math.round(box.cssH * dpr)]);
      const stats = (await readFilmStats(page))!;
      expect([stats.backingW, stats.backingH]).toEqual([box.w, box.h]);
      expect(stats.canvasResizes).toBeLessThanOrEqual(2);
      // The HUD shows the backing size.
      await expect(page.locator("[data-film-hud]")).toContainText(`canvas ${box.w}x${box.h}`);
      if (PLACEHOLDER_RUN) {
        const painted = await readPaintedFrame(page);
        expect(painted?.pixels, "the pixels name the frame").toEqual({ film: painted?.hook.segment, index: painted?.hook.frame });
      }
    });
  });
}

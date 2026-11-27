import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, openHome, PLACEHOLDER_RUN, readFilmStats, readPaintedFrame, settle, settleNote, watchPage } from "./film-frames";

// The canvas backing store (components/film/backing.ts): never wider than the widest frame tier in use, the DPR
// capped at 2, the aspect of the box kept. The size is
// allocated once at load (canvasResizes counts real reallocations only), and the painted frame read back from the
// pixels is still the one `data-frame` names. No timing thresholds.

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
    expect(await settle(page), `settles at ${i * step}${settleNote(page)}`).toBe(true);
    await sample();
  }
  return [...seen];
}

const canvasBox = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
    return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, dpr: window.devicePixelRatio };
  });

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });

    test("the backing store is capped at the widest tier in use and allocated once @backing", async ({ page, baseURL }) => {
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page);
      expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);

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
      expect(stats.mode, "the loader running").toBe("budget");

      if (PLACEHOLDER_RUN) {
        const painted = await readPaintedFrame(page);
        expect(painted?.pixels, "the pixels name the frame").toEqual({ film: painted?.hook.segment, index: painted?.hook.frame });
      }
      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });
  });
}

// The frame size by device (FilmBackdrop tier()): a phone held upright takes the smallest size whatever its width;
// a tablet held upright and a phone held sideways keep the larger portrait size.
const SIZES = [
  { name: "430x932 dpr 3, a wide phone", w: 430, h: 932, dpr: 3, width: 432 },
  { name: "768x1024 dpr 2, a tablet", w: 768, h: 1024, dpr: 2, width: 720 },
  { name: "844x390 dpr 3, a phone held sideways", w: 844, h: 390, dpr: 3, width: 720 },
] as const;

for (const vp of SIZES) {
  test.describe(`${vp.name}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, hasTouch: true, isMobile: true });

    test(`the film is painted from the ${vp.width} wide frames @tier`, async ({ page }) => {
      await openHome(page);
      expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
      const width = await page.evaluate(() => Number(document.querySelector<HTMLCanvasElement>("canvas[data-segment]")?.dataset.width ?? 0));
      expect(width).toBe(vp.width);
    });
  });
}

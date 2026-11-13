import { expect, test } from "@playwright/test";
import { assertPlaceholdersPresent, horizontalOverflow, LOADERS, loaderQuery, maxScroll, openHome, PLACEHOLDER_RUN, readFilmStats, readPaintedFrame, settle, settleNote, watchPage } from "./film-frames";

// The page loads and the film canvas paints at the sizes the site has to hold, and the document never scrolls
// sideways (at the top, and at the end where the last chapter sits). With both frame loaders (LOADERS).

test.beforeAll(() => assertPlaceholdersPresent());

const SIZES = [
  { width: 390, height: 844, touch: true },
  { width: 360, height: 740, touch: true },
  { width: 320, height: 568, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 1440, height: 900, touch: false },
] as const;

for (const loader of LOADERS) for (const size of SIZES) {
  const name = `${loader.name} ${size.width}x${size.height}`;
  test.describe(name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: size.touch ? 2 : 1 });

    test(`loads, paints the film, has no horizontal scroll bar @viewports`, async ({ page, baseURL }) => {
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page, loaderQuery(loader));
      expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);

      const canvas = page.locator("canvas[data-segment]");
      await expect(canvas).toHaveAttribute("data-segment", /^(rack-00|rack-00-p)$/);
      const stats = (await readFilmStats(page))!;
      expect(stats.draws).toBeGreaterThan(0);
      expect(stats.mode, "the loader running").toBe(loader.mode);
      expect(stats.paintedFilm).toBe(await canvas.getAttribute("data-segment"));
      // The backing store is sized to the viewport (not the 300x150 default), at device pixels but never wider than the
      // frames it shows (components/film/backing.ts): a portrait film's widest tier is 432..1080 px.
      const box = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
      expect(box.w).toBeGreaterThanOrEqual(Math.min(size.width, stats.width));
      expect(Math.abs(box.h - (box.w * size.height) / size.width)).toBeLessThanOrEqual(1);
      if (PLACEHOLDER_RUN) {
        const painted = await readPaintedFrame(page);
        expect(painted?.pixels, "the pixels name the frame").toEqual({ film: painted?.hook.segment, index: painted?.hook.frame });
      }

      const top = await horizontalOverflow(page);
      expect(top.html).toBeLessThanOrEqual(0);
      expect(top.body).toBeLessThanOrEqual(0);

      // The end of the page (the last chapter and the footer), where a wide element would show up.
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      expect(await maxScroll(page)).toBeGreaterThan(size.height * 5);
      expect(await settle(page), `the last frame settles${settleNote(page)}`).toBe(true);
      const bottom = await horizontalOverflow(page);
      expect(bottom.html).toBeLessThanOrEqual(0);
      expect(bottom.body).toBeLessThanOrEqual(0);
      await expect(canvas).toHaveAttribute("data-segment", /^(tower-04|tower-04-p)$/);

      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });
  });
}

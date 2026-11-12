import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, filmNames, maxScroll, openHome, PLACEHOLDER_RUN, readFilmStats, readPaintedFrame, settle, watchPage } from "./film-frames";

// A full pass through the reel, deterministic: the page is scrolled in half-viewport steps and, at each step,
// the test waits for the film to come to rest (the canvas shows the frame the clock wants) before it looks.
// There is no threshold on time or speed, so the result does not depend on how fast the machine is. The
// loading-quality numbers (how fast frames arrive while the visitor keeps scrolling) are the gate script's
// job, scripts/films/scrub-quality.mjs.

test.beforeAll(() => assertPlaceholdersPresent());

const VIEWPORTS = [
  // Portrait phones take the "-p" films (components/film/filmBase.ts WIDE_QUERY fails below 64rem).
  { name: "390x844 touch", portrait: true, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: "1440x900", portrait: false, use: { viewport: { width: 1440, height: 900 } } },
] as const;

/** Scrolls from `from` to `to` in `step` px, calling `visit` after the film has settled at each stop. */
async function walk(page: Page, from: number, to: number, step: number, visit: (y: number) => Promise<void>) {
  const dir = to >= from ? 1 : -1;
  for (let y = from; dir > 0 ? y < to : y > to; y += dir * step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await visit(y);
  }
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), to);
  await visit(to);
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test("a one-way pass paints every film of the reel, frame for frame @reel", async ({ page, baseURL }, testInfo) => {
      test.setTimeout(240_000);
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page);
      expect(await settle(page), "the first frame settles").toBe(true);

      const expected = filmNames().filter((n) => n.endsWith("-p") === vp.portrait);
      expect(expected.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      const unsettled: number[] = [];
      const mismatches: string[] = [];
      const step = Math.round(page.viewportSize()!.height / 2);
      const end = await maxScroll(page);
      expect(end).toBeGreaterThan(step * 10);

      // ---- down
      await page.evaluate(() => window.__filmStatsReset!());
      await walk(page, 0, end, step, async (y) => {
        if (!(await settle(page))) {
          unsettled.push(y);
          return;
        }
        const painted = PLACEHOLDER_RUN ? await readPaintedFrame(page) : null;
        const hook = painted?.hook ?? (await page.evaluate(() => {
          const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
          return { segment: c.dataset.segment ?? "", frame: Number(c.dataset.frame), width: Number(c.dataset.width) };
        }));
        seen.add(hook.segment);
        if (painted) {
          // The pixels name the frame the hook names.
          if (!painted.pixels || painted.pixels.film !== hook.segment || painted.pixels.index !== hook.frame) {
            mismatches.push(`y=${y}: hook ${hook.segment}#${hook.frame}, pixels ${painted.pixels ? `${painted.pixels.film}#${painted.pixels.index}` : "unreadable"}`);
          }
        }
      });
      const down = (await readFilmStats(page))!;
      testInfo.annotations.push({ type: "down", description: `requests ${down.requests}, refetches ${down.refetches}, frames alive peak ${down.framesAlivePeak}` });

      expect(unsettled, "scroll positions where the film did not come to rest").toEqual([]);
      expect(mismatches, "painted frame read from the canvas pixels differs from data-frame").toEqual([]);
      expect([...seen].sort(), "films painted").toEqual(expected);
      expect(down.refetches, "frames requested twice on the way down").toBe(0);
      expect(down.failures, "frames that failed").toBe(0);

      // ---- back up: recorded, not asserted yet (a later stage makes the way back free).
      await page.evaluate(() => window.__filmStatsReset!());
      await walk(page, end, 0, step, async () => {
        await settle(page);
      });
      const up = (await readFilmStats(page))!;
      const back = `${vp.name}: on the way back ${up.requests} requests, ${up.refetches} refetches, ${up.decodes} decodes`;
      testInfo.annotations.push({ type: "back", description: back });
      console.log(back);

      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });
  });
}

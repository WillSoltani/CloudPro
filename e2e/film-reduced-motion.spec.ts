import { expect, test } from "@playwright/test";
import { assertPlaceholdersPresent, LOADERS, loaderQuery, maxScroll, openHome, PLACEHOLDER_RUN, readFilmStats, readPaintedFrame, settle, settleNote, watchPage } from "./film-frames";

// Reduced motion: the film shows stills (FilmBackdrop toIndex: a few frames per segment, 5 for the hero and the
// bridge-style segments, 3 for a chapter) instead of scrubbing, and the page still scrolls to its end. With both frame
// loaders (LOADERS).

test.beforeAll(() => assertPlaceholdersPresent());

test.use({ contextOptions: { reducedMotion: "reduce" }, viewport: { width: 1440, height: 900 } });

for (const loader of LOADERS) test(`${loader.name}: with reduced motion the canvas paints stills and the page scrolls to the end @reduced-motion`, async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  await openHome(page, loaderQuery(loader));
  expect((await readFilmStats(page))!.mode, "the loader running").toBe(loader.mode);
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect(await settle(page), `the first still settles${settleNote(page)}`).toBe(true);

  const perFilm = new Map<string, Set<number>>();
  const mismatches: string[] = [];
  const step = 450;
  const end = await maxScroll(page);
  expect(end).toBeGreaterThan(step * 10);
  for (let y = 0; ; y = Math.min(end, y + step)) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    expect(await settle(page), `settles at y=${y}${settleNote(page)}`).toBe(true);
    // The hook and the pixels in one read (readPaintedFrame), so they describe the same paint.
    const px = PLACEHOLDER_RUN ? await readPaintedFrame(page) : null;
    const painted = px?.hook ?? (await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
      return { segment: c.dataset.segment ?? "", frame: Number(c.dataset.frame) };
    }));
    if (!perFilm.has(painted.segment)) perFilm.set(painted.segment, new Set());
    perFilm.get(painted.segment)!.add(painted.frame);
    if (px && (!px.pixels || px.pixels.film !== painted.segment || px.pixels.index !== painted.frame)) mismatches.push(`y=${y}: ${painted.segment}#${painted.frame}`);
    if (y >= end) break;
  }

  // The page scrolled all the way, and the document is where it should be.
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(end - 2);
  expect(mismatches, "pixels differ from data-frame").toEqual([]);
  // Stills: every film paints a handful of distinct frames (5 at most), and together more than one.
  for (const [film, frames] of perFilm) expect(frames.size, `${film} distinct frames`).toBeLessThanOrEqual(5);
  expect(perFilm.size, "films painted").toBeGreaterThan(1);
  expect([...perFilm.values()].some((f) => f.size > 1), "some film changes still").toBe(true);

  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  expect(watch.consoleErrors, "console errors").toEqual([]);
});

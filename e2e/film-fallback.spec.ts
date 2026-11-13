import { expect, test } from "@playwright/test";
import { assertPlaceholdersPresent, filmNames, maxScroll, openHome, paintedNow, readFilmStats, settle, settleNote, unsettledAt, walkPage, watchPage } from "./film-frames";

// The loader's fallbacks (components/film/loader/select.ts, budget.ts), on placeholder frames, with the page's own
// capabilities taken away by an init script before any script of the page runs:
//  - no Worker: the budget loader decodes on the main thread (mode "budget-main");
//  - no Worker and no createImageBitmap: the legacy loader (mode "legacy");
//  - the worker failing at start (a script that does not run): the budget loader switches to main-thread decodes at run time;
//  - createImageBitmap rejecting every frame: the page hands over to the legacy loader at run time.
// In each the film plays down the page frame for frame (pixels equal data-frame) with no console errors.

test.beforeAll(() => assertPlaceholdersPresent());

test.use({ viewport: { width: 1440, height: 900 } });

/** Scrolls down the page a viewport at a time; every stop must settle and its pixels must name the frame the hook names. */
async function playDown(page: import("@playwright/test").Page) {
  const films = new Set<string>();
  const unsettled: string[] = [];
  const mismatches: string[] = [];
  const step = page.viewportSize()!.height;
  const end = await maxScroll(page);
  expect(end).toBeGreaterThan(step * 10);
  await walkPage(page, 0, end, step, async (y) => {
    if (!(await settle(page))) {
      unsettled.push(unsettledAt(page, y));
      return;
    }
    const p = await paintedNow(page);
    films.add(p.segment);
    if (!p.pixelsAgree) mismatches.push(`y=${y}: ${p.segment}#${p.frame}`);
  });
  expect(unsettled, "scroll positions where the film did not come to rest").toEqual([]);
  expect(mismatches, "pixels differ from data-frame").toEqual([]);
  expect([...films].sort(), "films painted").toEqual(filmNames().filter((n) => !n.endsWith("-p")));
}

test("without Worker the film plays on the main thread, mode budget-main @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true, writable: true });
  });
  await openHome(page);
  expect(await page.evaluate(() => typeof window.Worker)).toBe("undefined");
  expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
  expect((await readFilmStats(page))!.mode).toBe("budget-main");
  await playDown(page);
  const s = (await readFilmStats(page))!;
  expect(s.mode).toBe("budget-main");
  expect(s.mainThreadDecodes, "main-thread decodes").toBeGreaterThan(0);
  expect(s.workerDecodes, "worker decodes").toBe(0);
  expect(s.decodedMBPeak, "decoded MB peak within the budget").toBeLessThanOrEqual(s.budgetMB + 1e-6);
  expect(s.refetches, "refetches").toBe(0);
  expect(s.failures, "failures").toBe(0);
  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  expect(watch.consoleErrors, "console errors").toEqual([]);
});

test("without Worker and createImageBitmap the film plays with the legacy loader @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true, writable: true });
    Object.defineProperty(window, "createImageBitmap", { value: undefined, configurable: true, writable: true });
  });
  await openHome(page);
  expect(await page.evaluate(() => [typeof window.Worker, typeof window.createImageBitmap])).toEqual(["undefined", "undefined"]);
  expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
  expect((await readFilmStats(page))!.mode).toBe("legacy");
  await playDown(page);
  const s = (await readFilmStats(page))!;
  expect(s.mode).toBe("legacy");
  expect(s.decodes, "decodes").toBeGreaterThan(0);
  expect(s.budgetMB, "legacy has no budget").toBe(0);
  expect(s.failures, "failures").toBe(0);
  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  expect(watch.consoleErrors, "console errors").toEqual([]);
});

test("when the worker script does not run the film plays on the main thread @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  // The build bundles the worker into hashed chunks that a blob worker imports, so there is no stable URL to refuse. The
  // page's Worker is replaced by one that runs a script with a syntax error: the worker raises an error event at start.
  await page.addInitScript(() => {
    const Real = window.Worker;
    const broken = URL.createObjectURL(new Blob(["throw new Error('film-test-broken-worker');"], { type: "text/javascript" }));
    (window as unknown as { __workersStarted: number }).__workersStarted = 0;
    window.Worker = function (_url: string | URL, options?: WorkerOptions) {
      (window as unknown as { __workersStarted: number }).__workersStarted++;
      return new Real(broken, options);
    } as unknown as typeof Worker;
  });
  await openHome(page);
  await expect.poll(async () => (await readFilmStats(page))?.mode, { timeout: 30_000 }).toBe("budget-main");
  expect(await page.evaluate(() => (window as unknown as { __workersStarted: number }).__workersStarted), "workers started").toBeGreaterThan(0);
  expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
  await playDown(page);
  const s = (await readFilmStats(page))!;
  expect(s.mode).toBe("budget-main");
  expect(s.mainThreadDecodes, "main-thread decodes").toBeGreaterThan(0);
  expect(s.workerDecodes, "worker decodes").toBe(0);
  expect(s.failures, "failures").toBe(0);
  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  // The browser logs the broken worker script's error (the marker in its message); nothing else may be an error.
  expect(watch.consoleErrors.filter((e) => !e.includes("film-test-broken-worker")), "console errors").toEqual([]);
});

test("when createImageBitmap rejects every frame the page hands over to the legacy loader at run time @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  // No Worker (so the budget loader decodes on the main thread from the start) and a createImageBitmap that exists but
  // rejects, as an engine that cannot decode these frames: after a few frames the page must move to the legacy loader.
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true, writable: true });
    (window as unknown as { __bitmapCalls: number }).__bitmapCalls = 0;
    Object.defineProperty(window, "createImageBitmap", {
      value: () => {
        (window as unknown as { __bitmapCalls: number }).__bitmapCalls++;
        return Promise.reject(new DOMException("film-test cannot decode", "InvalidStateError"));
      },
      configurable: true,
      writable: true,
    });
  });
  await openHome(page);
  await expect.poll(async () => (await readFilmStats(page))?.mode, { timeout: 30_000 }).toBe("legacy");
  expect(await page.evaluate(() => (window as unknown as { __bitmapCalls: number }).__bitmapCalls), "decodes tried first").toBeGreaterThan(0);
  expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
  await playDown(page);
  const s = (await readFilmStats(page))!;
  expect(s.mode).toBe("legacy");
  expect(s.decodes, "decodes").toBeGreaterThan(0);
  expect(s.failures, "no frame given up").toBe(0);
  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  expect(watch.consoleErrors, "console errors").toEqual([]);
});

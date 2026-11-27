import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, filmNames, maxScroll, openHome, paintedNow, readFilmStats, settle, settleNote, unsettledAt, walkPage, watchPage } from "./film-frames";

// The loader's fallbacks (components/film/loader/select.ts, budget.ts), on placeholder frames, with the page's own
// capabilities taken away by an init script before any script of the page runs:
//  - no Worker: the budget loader decodes on the main thread (mode "budget-main");
//  - no Worker and no createImageBitmap: the loader is stopped from the start (mode "stopped"): no film data is
//    requested and the hero poster stays;
//  - the worker failing at start (a script that does not run): the budget loader switches to main-thread decodes at run time;
//  - createImageBitmap rejecting every frame: the packs are given up once for frame files, then the loader stops and
//    requests nothing more.
// Where the film plays it plays down the page frame for frame (pixels equal data-frame); no test logs a console error.

test.beforeAll(() => assertPlaceholdersPresent());

test.use({ viewport: { width: 1440, height: 900 } });

// Film data on the network: frame files and packs (as e2e/film-packs.spec.ts counts them), from the page and its
// worker. The hold keys are other images (/images/reel/), loaded whether or not the film runs.
const PACK_RE = /\/\d+\/pack-[0-9a-f]+\.bin$/i;
const FRAME_RE = /\/\d+\/f_\d+\.webp$/i;

function countFilmData(page: Page): { packs: number; frames: number } {
  const net = { packs: 0, frames: 0 };
  page.on("request", (req) => {
    const p = new URL(req.url()).pathname;
    if (PACK_RE.test(p)) net.packs++;
    else if (FRAME_RE.test(p)) net.frames++;
  });
  return net;
}

/** Loads the home page and waits for the film canvas and the counters, not for a paint (a stopped loader never paints). */
async function openUnpainted(page: Page) {
  await page.goto("/", { waitUntil: "load" });
  await page.locator("canvas[aria-hidden]").waitFor({ state: "attached" });
  await page.waitForFunction(() => !!window.__filmStats);
}

/** Scrolls the whole page down a viewport at a time without waiting for the film (nothing is coming). */
async function walkDown(page: Page) {
  const step = page.viewportSize()!.height;
  const end = await maxScroll(page);
  expect(end).toBeGreaterThan(step * 10);
  await walkPage(page, 0, end, step, () => page.waitForTimeout(150));
}

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

test("without Worker and createImageBitmap the loader stops at once: no film data is requested, the poster stays @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  const net = countFilmData(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined, configurable: true, writable: true });
    Object.defineProperty(window, "createImageBitmap", { value: undefined, configurable: true, writable: true });
  });
  await openUnpainted(page);
  expect(await page.evaluate(() => [typeof window.Worker, typeof window.createImageBitmap])).toEqual(["undefined", "undefined"]);
  await expect.poll(async () => (await readFilmStats(page))?.mode).toBe("stopped");
  // The hero poster stays up (no frame ever lands on the canvas, which stays transparent).
  const poster = page.locator('section[data-film-segment][data-index="0"] img');
  await expect(poster).toBeVisible();
  await expect(poster).toHaveCSS("opacity", "1");
  expect(await poster.evaluate((img: HTMLImageElement) => img.naturalWidth), "the poster loaded").toBeGreaterThan(0);
  await walkDown(page);
  const s = (await readFilmStats(page))!;
  expect(s.mode).toBe("stopped");
  expect([s.requests, s.packRequests], "film data requests (the page's count)").toEqual([0, 0]);
  expect(net, "film data requests (the network's count)").toEqual({ packs: 0, frames: 0 });
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("canvas[aria-hidden]")!).opacity), "canvas opacity").toBe("0");
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

test("when createImageBitmap rejects every frame the packs are given up once, then the loader stops and requests nothing more @fallback", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
  const net = countFilmData(page);
  // No Worker (so the budget loader decodes on the main thread from the start) and a createImageBitmap that exists but
  // rejects, as an engine that cannot decode these frames: the packs are given up for frame files, which fail too.
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
  const bitmapCalls = () => page.evaluate(() => (window as unknown as { __bitmapCalls: number }).__bitmapCalls);
  await openUnpainted(page);
  await expect.poll(async () => (await readFilmStats(page))?.mode, { timeout: 30_000 }).toBe("stopped");
  expect(await bitmapCalls(), "decodes tried first").toBeGreaterThan(0);
  // Request events can trail the page by a moment: let them land before the counts are taken.
  await page.waitForTimeout(500);
  const s = (await readFilmStats(page))!;
  // The one rescue came first: packs given up, and frame files requested (and rejected as well).
  expect(s.packFallbackFilms, "packs given up").toBeGreaterThan(0);
  expect(s.framesFromFiles, "frames that arrived as files").toBeGreaterThan(0);
  expect(net.frames, "frame files on the network").toBeGreaterThan(0);
  const before = { requests: s.requests + s.packRequests, net: net.frames + net.packs, bitmapCalls: await bitmapCalls() };
  await walkDown(page);
  const a = (await readFilmStats(page))!;
  expect(a.mode).toBe("stopped");
  expect({ requests: a.requests + a.packRequests, net: net.frames + net.packs, bitmapCalls: await bitmapCalls() }, "nothing more after the stop").toEqual(before);
  expect(watch.failed, "4xx/5xx answers").toEqual([]);
  expect(watch.consoleErrors, "console errors").toEqual([]);
});

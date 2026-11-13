import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, filmNames, maxScroll, openHome, paintedNow, readFilmStats, settle, walkPage, watchPage } from "./film-frames";

// Film packs (stage 7) on placeholder packs (`npm run film:placeholder` writes them under the names the manifests give):
//  - a full pass down and back at 390x844 touch and 1440x900 in pack mode: the film data requests it takes (pack reads
//    plus per-frame file requests, the page's own counts and the network's), recorded in the annotations; the way back
//    makes none; every stop shows the frame its hook names, read back from the canvas pixels;
//  - the fallbacks, by routing the pack requests: a pack that 404s and a pack whose bytes are not a pack (both: those
//    films load frame by frame, nothing fails, the film plays), and a server that ignores Range (a 200 with the whole
//    file for every pack request, the first one cut short so the page must continue: the film still plays from its
//    packs, the bytes held already are counted as read twice).

test.beforeAll(() => assertPlaceholdersPresent());

const PACK_RE = /\/\d+\/pack-[0-9a-f]+\.bin$/i;
const FRAME_RE = /\/\d+\/f_\d+\.webp$/i;
const PUBLIC = path.resolve(__dirname, "..", "public");

type Net = { packs: number; frames: number };

/** Counts film data requests on the network (pack and frame files), from the page and its worker. */
function countNet(page: Page): Net {
  const net = { packs: 0, frames: 0 };
  page.on("request", (req) => {
    const p = new URL(req.url()).pathname;
    if (PACK_RE.test(p)) net.packs++;
    else if (FRAME_RE.test(p)) net.frames++;
  });
  return net;
}

/** Walks from `from` to `to` in `step` px; every stop must settle and its pixels must name the frame its hook names. */
async function play(page: Page, from: number, to: number, step: number): Promise<Set<string>> {
  const films = new Set<string>();
  const unsettled: number[] = [];
  const mismatches: string[] = [];
  await walkPage(page, from, to, step, async (y) => {
    if (!(await settle(page))) {
      unsettled.push(y);
      return;
    }
    const p = await paintedNow(page);
    films.add(p.segment);
    if (!p.pixelsAgree) mismatches.push(`y=${y}: ${p.segment}#${p.frame}`);
  });
  expect(unsettled, "scroll positions where the film did not come to rest").toEqual([]);
  expect(mismatches, "pixels differ from data-frame").toEqual([]);
  return films;
}

const VIEWPORTS = [
  { name: "390x844 touch", portrait: true, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: "1440x900", portrait: false, use: { viewport: { width: 1440, height: 900 } } },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`packs ${vp.name}`, () => {
    test.use(vp.use);

    test("a pass down and back: film data requests, none on the way back @packs", async ({ page, baseURL }, testInfo) => {
      test.setTimeout(300_000);
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      const net = countNet(page);
      await openHome(page);
      expect(await settle(page)).toBe(true);
      const idle = (await readFilmStats(page))!;
      const idleNet = { ...net };
      expect(idle.mode).toBe("budget");
      // Before the first scroll: the hero pack only, one read.
      expect(idle.packRequests, "pack reads before the first scroll").toBe(1);
      expect(idle.requests, "frame files before the first scroll").toBe(0);

      const step = Math.round(page.viewportSize()!.height / 2);
      const end = await maxScroll(page);
      await page.evaluate(() => window.__filmStatsReset!());
      const films = await play(page, 0, end, step);
      const down = (await readFilmStats(page))!;
      const downNet = { packs: net.packs - idleNet.packs, frames: net.frames - idleNet.frames };
      expect([...films].sort(), "films painted").toEqual(filmNames().filter((n) => n.endsWith("-p") === vp.portrait));

      await page.evaluate(() => window.__filmStatsReset!());
      const backFrom = { ...net };
      await play(page, end, 0, step);
      const up = (await readFilmStats(page))!;
      const upNet = { packs: net.packs - backFrom.packs, frames: net.frames - backFrom.frames };

      const line = `packs ${vp.name}: before the first scroll ${idle.packRequests} pack + ${idle.requests} file requests (network ${idleNet.packs} + ${idleNet.frames}); down ${down.packRequests} pack + ${down.requests} file = ${down.packRequests + down.requests} film data requests (network ${downNet.packs} + ${downNet.frames}), ${down.packBytesMB.toFixed(2)} MB, ${down.framesFromPacks} frames from packs; back ${up.packRequests} + ${up.requests} (network ${upNet.packs} + ${upNet.frames}), repeated ${up.packBytesRepeatedMB} MB`;
      testInfo.annotations.push({ type: "film data requests", description: line });
      console.log(line);

      expect(down.packFilms, "films reading packs").toBeGreaterThan(0);
      expect(down.packFallbackFilms, "packs given up").toBe(0);
      expect(down.framesFromFiles, "frames fetched as files").toBe(0);
      expect(down.packRequests + down.requests, "film data requests down").toBeLessThanOrEqual(40);
      expect(up.packRequests + up.requests, "film data requests back").toBe(0);
      expect(upNet.packs + upNet.frames, "film data requests back, network").toBe(0);
      expect(down.packBytesRepeatedMB, "pack bytes read twice").toBe(0);
      expect(Math.max(down.decodedMBPeak, up.decodedMBPeak), "decoded frames within the budget").toBeLessThanOrEqual(down.budgetMB + 1e-6);
      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });
  });
}

test.describe("pack fallbacks", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Plays the whole page down; returns the counters at the end. */
  async function playDown(page: Page) {
    const end = await maxScroll(page);
    const films = await play(page, 0, end, page.viewportSize()!.height);
    expect([...films].sort(), "films painted").toEqual(filmNames().filter((n) => !n.endsWith("-p")));
    return (await readFilmStats(page))!;
  }

  /** Console errors other than the browser's own line about a pack answer the route made fail. */
  const otherErrors = (errors: string[]) => errors.filter((e) => !/Failed to load resource/.test(e));

  test("a pack that 404s: its film loads frame by frame @packs", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
    const net = countNet(page);
    await page.context().route(PACK_RE, (route) => route.fulfill({ status: 404, body: "not here" }));
    await openHome(page);
    expect(await settle(page)).toBe(true);
    const s = await playDown(page);
    expect(s.mode).toBe("budget");
    expect(s.packFallbackFilms, "films given up to frame files").toBeGreaterThanOrEqual(8);
    expect(s.packFilms, "films still reading packs").toBe(0);
    expect(s.framesFromFiles, "frames from files").toBeGreaterThan(0);
    expect(s.framesFromPacks).toBe(0);
    expect(s.refetches, "refetches").toBe(0);
    expect(net.packs, "a 404 is not retried: one pack request per film").toBe(s.packFallbackFilms);
    expect(watch.failed.every((f) => f.startsWith("404 ") && PACK_RE.test(f.slice(4))), `only the packs failed: ${watch.failed.join(", ")}`).toBe(true);
    expect(otherErrors(watch.consoleErrors), "console errors").toEqual([]);
  });

  test("a pack whose bytes are not a pack: given up, its film loads frame by frame @packs", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
    await page.context().route(PACK_RE, (route) =>
      route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from("<html>an error page, not a pack</html>".repeat(40)) }),
    );
    await openHome(page);
    expect(await settle(page)).toBe(true);
    const s = await playDown(page);
    expect(s.packFallbackFilms).toBeGreaterThanOrEqual(8);
    expect(s.framesFromPacks).toBe(0);
    expect(s.framesFromFiles).toBeGreaterThan(0);
    expect(s.refetches).toBe(0);
    expect(watch.failed, "4xx/5xx answers").toEqual([]);
    expect(watch.consoleErrors, "console errors").toEqual([]);
  });

  test("a server that ignores Range: the film plays from its packs, bytes held already counted as read twice @packs", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
    // Every answer is a 200 with the whole file, whatever Range asked for; the first answer for each pack is cut short
    // (2,000 bytes: the header and a few frames), so the page has to continue the pack, and its continuation (a
    // Range request from the byte reached) comes back whole. Placeholder packs are small enough to arrive in one piece
    // otherwise.
    let ranged = 0;
    const seen = new Set<string>();
    await page.context().route(PACK_RE, async (route) => {
      const url = route.request().url();
      const range = route.request().headers()["range"] ?? "";
      if (/^bytes=[1-9]/.test(range)) ranged++;
      const body = fs.readFileSync(path.join(PUBLIC, new URL(url).pathname));
      const first = !seen.has(url);
      seen.add(url);
      await route.fulfill({ status: 200, contentType: "application/octet-stream", body: first ? body.subarray(0, 2000) : body });
    });
    await openHome(page);
    expect(await settle(page)).toBe(true);
    const s = await playDown(page);
    expect(ranged, "Range requests from a later byte made (and answered 200)").toBeGreaterThan(0);
    expect(s.packFallbackFilms, "no pack given up").toBe(0);
    expect(s.framesFromFiles, "no frame file").toBe(0);
    expect(s.framesFromPacks).toBeGreaterThan(0);
    expect(s.packBytesRepeatedMB, "bytes held already, read again in a whole-file answer").toBeGreaterThan(0);
    expect(s.refetches).toBe(0);
    expect(watch.failed, "4xx/5xx answers").toEqual([]);
    expect(watch.consoleErrors, "console errors").toEqual([]);
  });
});

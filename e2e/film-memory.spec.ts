import { expect, test, type Page } from "@playwright/test";
import type { FilmStats } from "../components/film/filmStats";
import { assertPlaceholdersPresent, filmNames, maxScroll, openHome, paintedNow, readFilmStats, settle, settleNote, unsettledAt, walkPage, watchPage } from "./film-frames";

// The budget loader's memory rules (components/film/loader/budget.ts, docs/film-lab-gate.md "The budget loader"), on
// placeholder frames. A placeholder frame is a few hundred bytes on the wire but has the real tier's pixel size, so the
// decoded-frame budget is under real pressure while the compressed bytes are not.
//
// The page is walked down the whole reel and back up, twice, stopping at every viewport height until the film has come to
// rest (no timing thresholds), and the counters are read after every leg:
//  - decoded MB never exceeds the budget (the peak, and the gauge at the end of each leg);
//  - the compressed bytes kept stay inside their cap (48 MiB on a phone budget, 160 MiB otherwise);
//  - the way back makes no frame request and no refetch (the bytes are kept), and decodes again from them (redecodes > 0);
//  - with ?budget=96 the film still plays to the end, inside the smaller budget.

test.beforeAll(() => assertPlaceholdersPresent());

const MiB = 1024 * 1024;
const VIEWPORTS = [
  { name: "390x844 touch", portrait: true, use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: "1440x900", portrait: false, use: { viewport: { width: 1440, height: 900 } } },
] as const;

/** The compressed-byte cap that goes with a decoded budget (budget-bytes.ts bytesCapFor), in MB (10^6 bytes) like the counters. */
const bytesCapMB = (budgetMB: number) => ((budgetMB * 1e6 < 256 * MiB ? 48 : 160) * MiB) / 1e6;

type Leg = { name: string; stats: FilmStats; films: string[]; unsettled: string[]; mismatches: string[] };

/** One leg of the walk: counters reset first, read after; the films painted, where the film did not settle, where the pixels disagree with the hooks. */
async function leg(page: Page, name: string, from: number, to: number, step: number): Promise<Leg> {
  await page.evaluate(() => window.__filmStatsReset!());
  const films = new Set<string>();
  const unsettled: string[] = [];
  const mismatches: string[] = [];
  await walkPage(page, from, to, step, async (y) => {
    if (!(await settle(page))) {
      unsettled.push(unsettledAt(page, y));
      return;
    }
    const p = await paintedNow(page);
    films.add(p.segment);
    if (!p.pixelsAgree) mismatches.push(`y=${y}: ${p.segment}#${p.frame}`);
  });
  return { name, stats: (await readFilmStats(page))!, films: [...films].sort(), unsettled, mismatches };
}

for (const vp of VIEWPORTS) {
  test.describe(`memory ${vp.name}`, () => {
    test.use(vp.use);

    test("a walk down and back, twice, stays inside the budget and never fetches twice @memory", async ({ page, baseURL }, testInfo) => {
      test.setTimeout(600_000);
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page);
      expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
      expect((await readFilmStats(page))!.mode, "the loader running").toBe("budget");

      const expected = filmNames().filter((n) => n.endsWith("-p") === vp.portrait);
      const step = page.viewportSize()!.height;
      const end = await maxScroll(page);
      expect(end).toBeGreaterThan(step * 10);

      const legs: Leg[] = [];
      legs.push(await leg(page, "down 1", 0, end, step));
      legs.push(await leg(page, "up 1", end, 0, step));
      legs.push(await leg(page, "down 2", 0, end, step));
      legs.push(await leg(page, "up 2", end, 0, step));

      const report = legs.map((l) => `${l.name}: requests ${l.stats.requests}, refetches ${l.stats.refetches}, decodes ${l.stats.decodes} (redecodes ${l.stats.redecodes}), alive ${l.stats.framesAlive} (peak ${l.stats.framesAlivePeak}), decoded ${l.stats.decodedMB.toFixed(1)} MB (peak ${l.stats.decodedMBPeak.toFixed(1)} of ${l.stats.budgetMB.toFixed(1)}), bytes held peak ${l.stats.bytesHeldMBPeak.toFixed(2)} MB`);
      testInfo.annotations.push({ type: "memory", description: report.join(" | ") });
      console.log(`memory ${vp.name}\n  ${report.join("\n  ")}`);

      for (const l of legs) {
        const s = l.stats;
        expect(l.unsettled, `${l.name}: scroll positions where the film did not come to rest`).toEqual([]);
        expect(l.mismatches, `${l.name}: pixels differ from data-frame`).toEqual([]);
        expect(s.mode, `${l.name}: loader`).toBe("budget");
        expect(s.budgetMB, `${l.name}: budget`).toBeGreaterThan(0);
        expect(s.decodedMBPeak, `${l.name}: decoded MB peak within the budget`).toBeLessThanOrEqual(s.budgetMB + 1e-6);
        expect(s.decodedMB, `${l.name}: decoded MB held at the end within the budget`).toBeLessThanOrEqual(s.budgetMB + 1e-6);
        expect(s.framesAlive, `${l.name}: frames alive at the end`).toBeGreaterThan(0);
        expect(s.bytesHeldMBPeak, `${l.name}: compressed bytes within the cap`).toBeLessThanOrEqual(bytesCapMB(s.budgetMB) + 1e-6);
        expect(s.failures, `${l.name}: failures`).toBe(0);
        expect(s.refetches, `${l.name}: refetches`).toBe(0);
      }
      // Every film of the reel is painted on the way down.
      expect(legs[0].films, "films painted on the way down").toEqual(expected);
      // The way back: the bytes are kept, so no frame is requested, and what the budget let go is decoded again.
      for (const l of [legs[1], legs[3]]) {
        expect(l.stats.requests, `${l.name}: frame requests`).toBe(0);
        expect(l.stats.redecodes, `${l.name}: redecodes`).toBeGreaterThan(0);
        expect(l.stats.decodes, `${l.name}: decodes`).toBeGreaterThan(0);
        expect(l.films, `${l.name}: films painted`).toEqual(expected);
      }
      // The second way down is served from the bytes kept too.
      expect(legs[2].stats.requests, "down 2: frame requests").toBe(0);

      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });

    test("with ?budget=96 the film still plays to the end and holds the smaller budget @memory", async ({ page, baseURL }, testInfo) => {
      test.setTimeout(600_000);
      const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
      await openHome(page, "?budget=96");
      expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
      const first = (await readFilmStats(page))!;
      expect(first.mode).toBe("budget");
      expect(first.budgetMB).toBeCloseTo((96 * MiB) / 1e6, 3);

      const expected = filmNames().filter((n) => n.endsWith("-p") === vp.portrait);
      const step = page.viewportSize()!.height;
      const end = await maxScroll(page);
      const down = await leg(page, "down", 0, end, step);
      const up = await leg(page, "up", end, 0, step);
      const note = `budget 96 MiB: down alive peak ${down.stats.framesAlivePeak}, decoded peak ${down.stats.decodedMBPeak.toFixed(1)} of ${down.stats.budgetMB.toFixed(1)} MB; up: requests ${up.stats.requests}, refetches ${up.stats.refetches}, redecodes ${up.stats.redecodes}`;
      testInfo.annotations.push({ type: "budget-96", description: note });
      console.log(`${vp.name} ${note}`);

      for (const l of [down, up]) {
        expect(l.unsettled, `${l.name}: scroll positions where the film did not come to rest`).toEqual([]);
        expect(l.mismatches, `${l.name}: pixels differ from data-frame`).toEqual([]);
        expect(l.stats.budgetMB, `${l.name}: budget`).toBeCloseTo((96 * MiB) / 1e6, 3);
        expect(l.stats.decodedMBPeak, `${l.name}: decoded MB peak`).toBeLessThanOrEqual(l.stats.budgetMB + 1e-6);
        expect(l.stats.bytesHeldMBPeak, `${l.name}: compressed bytes within the cap`).toBeLessThanOrEqual(bytesCapMB(l.stats.budgetMB) + 1e-6);
        expect(l.stats.failures, `${l.name}: failures`).toBe(0);
        expect(l.stats.refetches, `${l.name}: refetches`).toBe(0);
        expect(l.films, `${l.name}: films painted`).toEqual(expected);
      }
      // It played to the end (every stop of the way down, the last one included, settled, and every film was painted),
      // and the way back is served from the bytes kept.
      expect(up.stats.requests, "up: frame requests").toBe(0);

      expect(watch.failed, "4xx/5xx answers").toEqual([]);
      expect(watch.consoleErrors, "console errors").toEqual([]);
    });
  });
}

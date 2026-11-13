import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, maxScroll, openHome, readFilmStats } from "./film-frames";
import {
  cssKeyPictures,
  GROW_TOOLBAR,
  moveToolbar,
  restAt,
  scrollScript,
  setToolbar,
  simulateToolbar,
  snapshot,
  TOOLBAR,
  watchCanvas,
  type Snap,
  type ToolbarMode,
} from "./film-toolbar-lib";

// The phone toolbar. On a phone the dynamic viewport (dvh, window.innerHeight) runs between the small viewport (toolbar
// shown) and the large one (toolbar hidden) while the page scrolls; the film must not notice (components/film/
// placement.ts: the fixed layers are as tall as the large viewport, the picture stays where the small viewport's cover
// fit puts it). Playwright has no dynamic toolbar, so it is simulated (e2e/film-toolbar-lib.ts, docs/film-lab-gate.md):
// 390x664 with `--film-lvh: 754px; --film-svh: 664px` on :root before the page scripts run, the toolbar moved between
// 664 and 754. Two ways of moving it, both run (and both on Chromium and WebKit):
//   "phone"   the window keeps its size, window.innerHeight and the root's clientHeight take the other height and
//             `resize` fires: the page is the same page, so the clock, the frame, the pixels and the plate must not
//             change at all, and nothing is measured again.
//   "resize"  the window itself is resized. The page's own svh/vh lengths follow the window here (they do not on a
//             phone), so the document is laid out again and a toggle changes the clock; the film's layers must still
//             not reallocate, move or drift apart.
// The checks are exact counters and pixel reads, no timing thresholds.
//
// The hold keys before the backdrop runs (a reload or a #section deep link into a hold: the boot style in app/page.tsx
// shows the key with the layer's own CSS) must already be where the backdrop then lays them out, also where the
// placement grows the scale (GROW_TOOLBAR); their box is the hero poster's (placement.ts STAGE_BOX_CLASS), and
// where lvh = svh it is the layer itself, top 0 and full height.

test.beforeAll(() => assertPlaceholdersPresent());

test.use({
  viewport: { width: TOOLBAR.width, height: TOOLBAR.shown },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

const MODES: ToolbarMode[] = ["phone", "resize"];
const CYCLES = 3;
const FOCUS_Y = 0.45; // REEL_FOCUS[1]: the marker row sits on this share of the stage (the small viewport)
const OBJECT_POSITION = "50% 45%"; // REEL_OBJECT_POSITION

/** Opens the home page with the simulated toolbar, shown, and waits for the first paint. */
async function open(page: Page, mode: ToolbarMode): Promise<void> {
  await simulateToolbar(page, mode);
  await openHome(page);
  await watchCanvas(page);
}

/** The canvas alone, as the browser composites it, over the clip the shown toolbar leaves (390 x 664). */
async function canvasShot(page: Page): Promise<Buffer> {
  const style = await page.addStyleTag({ content: "html *{visibility:hidden !important}canvas[data-segment]{visibility:visible !important}" });
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: TOOLBAR.width, height: TOOLBAR.shown }, animations: "disabled" });
  await style.evaluate((el) => (el as HTMLElement).remove());
  return shot;
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/** What must hold after any number of toolbar moves, whatever the mode: the layers did not change or drift. */
function expectLayersStill(base: Snap, s: Snap, label: string): void {
  // The canvas was not reallocated, redrawn at another size or re-laid out.
  expect(s.stats.canvasResizes, `${label}: canvas reallocations`).toBe(base.stats.canvasResizes);
  expect([s.canvasW, s.canvasH], `${label}: canvas backing store`).toEqual([base.canvasW, base.canvasH]);
  expect([s.stats.backingW, s.stats.backingH], `${label}: backing gauges`).toEqual([base.stats.backingW, base.stats.backingH]);
  expect(s.canvas, `${label}: canvas CSS box`).toEqual(base.canvas);
  expect(s.canvasRoCalls, `${label}: canvas ResizeObserver callbacks`).toBe(0);
  // The canvas is the large viewport, the layers share its box.
  expect(s.canvas.height, `${label}: canvas is as tall as the large viewport`).toBe(TOOLBAR.hidden);
  for (const p of s.plates) expect(p.layer, `${label}: plate layer ${p.index} box`).toEqual(s.canvas);
  // The picture: the marker row's rows sit on the stage's focus line (the small viewport, svh x 0.45), and did not move.
  expect(s.band, `${label}: a placeholder marker row is painted`).not.toBeNull();
  const mid = (s.band!.y0 + s.band!.y1) / 2;
  expect(close(mid, TOOLBAR.shown * FOCUS_Y, 1.5), `${label}: marker row centre ${mid.toFixed(2)} vs ${(TOOLBAR.shown * FOCUS_Y).toFixed(2)}`).toBe(true);
  expect(close(s.band!.y0, base.band!.y0, 0.5) && close(s.band!.y1, base.band!.y1, 0.5), `${label}: marker row rows ${s.band!.y0.toFixed(2)}..${s.band!.y1.toFixed(2)} vs ${base.band!.y0.toFixed(2)}..${base.band!.y1.toFixed(2)}`).toBe(true);
  // The key layers' boxes, the hero poster's box and the frame variables (the captions' frame) are fixed by the two
  // static heights: a toolbar move, which moves dvh and innerHeight (and in "resize" mode the window), moves none.
  expect(s.keys.map((k) => [k.i, k.box]), `${label}: key layer boxes`).toEqual(base.keys.map((k) => [k.i, k.box]));
  expect(s.poster, `${label}: a hero poster`).not.toBeNull();
  expect(s.poster, `${label}: hero poster box`).toEqual(base.poster);
  expect(s.frameVars, `${label}: a chapter composition`).not.toBeNull();
  expect(s.frameVars, `${label}: frame variables (--fx0 --fy0 --fw --fh)`).toEqual(base.frameVars);
  // A hold key that has laid its picture out lines up with the canvas's picture (same focus line) and keeps its box.
  for (const k of s.keys) {
    if (!k.pic) continue;
    const before = base.keys.find((b) => b.i === k.i)?.pic;
    if (before) expect(k.pic, `${label}: key ${k.i} picture box`).toEqual(before);
    const focusY = k.pic.top + k.pic.height * FOCUS_Y;
    expect(close(focusY, TOOLBAR.shown * FOCUS_Y, 1.5), `${label}: key ${k.i} focus line ${focusY.toFixed(2)}`).toBe(true);
  }
}

/** What must also hold when the page is the same page (phone mode): nothing but the toolbar changed. */
function expectSamePage(base: Snap, s: Snap, label: string): void {
  expect(s.scrollY, `${label}: scroll position`).toBe(base.scrollY);
  expect(s.clock, `${label}: clock`).toBe(base.clock);
  expect([s.segment, s.frame], `${label}: painted frame`).toEqual([base.segment, base.frame]);
  expect(s.hash, `${label}: canvas pixels`).toBe(base.hash);
  expect(s.band, `${label}: marker row`).toEqual(base.band);
  expect(s.stats.draws, `${label}: draws`).toBe(base.stats.draws);
  expect(s.keys, `${label}: key layers`).toEqual(base.keys);
  expect(s.plates, `${label}: plates`).toEqual(base.plates);
  // Nothing is measured again: the layout did not change, so neither did the geometry.
  expect(s.stats.measures - base.stats.measures, `${label}: layout measurements`).toBe(0);
}

const POSITIONS = [
  { name: "hero", at: async () => 0 },
  { name: "second film", at: async () => 2000 },
  { name: "last hold", at: async (page: Page) => (await maxScroll(page)) - 160 },
] as const;

for (const mode of MODES) {
  test.describe(`toolbar, ${mode}`, () => {
    for (const pos of POSITIONS) {
      test(`at rest: ${pos.name} @toolbar`, async ({ page }) => {
        await open(page, mode);
        await restAt(page, await pos.at(page));
        await watchCanvas(page);
        const base = await snapshot(page);
        if (pos.name === "second film") expect(base.plates.some((p) => p.plate), "a plate is showing here").toBe(true);
        if (pos.name === "last hold") expect(base.keys.some((k) => k.opacity > 0 && k.pic), "a hold key is showing here").toBe(true);
        const baseShot = await canvasShot(page);
        const stillAfter: Snap[] = [];

        for (let c = 1; c <= CYCLES; c++) {
          for (const to of ["hidden", "shown"] as const) {
            const label = `${pos.name} cycle ${c} ${to}`;
            await moveToolbar(page, to, mode);
            const s = await snapshot(page);
            expect(s.innerHeight, `${label}: the toolbar moved`).toBe(TOOLBAR[to]);
            expectLayersStill(base, s, label);
            if (mode === "phone") {
              expectSamePage(base, s, label);
              expect((await canvasShot(page)).equals(baseShot), `${label}: canvas screenshot`).toBe(true);
            } else {
              // The document is re-laid out by the window's own svh: at most a couple of measurements per move, and
              // when the page is back where it was (shown) the hero is pixel for pixel the same.
              expect(s.stats.measures - base.stats.measures, `${label}: layout measurements`).toBeLessThanOrEqual(2 * ((c - 1) * 2 + (to === "hidden" ? 1 : 2)));
              if (pos.name === "hero") {
                expect(s.hash, `${label}: canvas pixels`).toBe(base.hash);
                expect((await canvasShot(page)).equals(baseShot), `${label}: canvas screenshot`).toBe(true);
              }
            }
            if (to === "shown") stillAfter.push(s);
          }
        }
        expect(stillAfter.length).toBe(CYCLES);
      });
    }

    test(`during a scripted scroll @toolbar`, async ({ page, browser, baseURL }) => {
      test.setTimeout(180_000);
      await open(page, mode);
      await restAt(page, 1200);
      await watchCanvas(page);
      const base = await snapshot(page);

      // 400 animation frames of scrolling, 6 px each, with the toolbar moved six times meanwhile.
      const running = scrollScript(page, 2400, 6);
      for (const to of ["hidden", "shown", "hidden", "shown", "hidden", "shown"] as const) {
        await page.waitForTimeout(120);
        await setToolbar(page, to, mode);
      }
      const res = await running;
      await moveToolbar(page, "shown", mode);
      const end = await snapshot(page);
      const stats = (await readFilmStats(page))!;

      expect(end.stats.canvasResizes, "canvas reallocations during the scroll").toBe(base.stats.canvasResizes);
      expect([end.canvasW, end.canvasH], "canvas backing store").toEqual([base.canvasW, base.canvasH]);
      expect(end.canvas, "canvas CSS box").toEqual(base.canvas);
      expect(end.canvasRoCalls, "canvas ResizeObserver callbacks").toBe(0);
      expect(stats.canvasResizes).toBe(base.stats.canvasResizes);
      // The marker row is on the focus line wherever the scroll ended.
      const mid = (end.band!.y0 + end.band!.y1) / 2;
      expect(close(mid, TOOLBAR.shown * FOCUS_Y, 1.5), `marker row centre ${mid.toFixed(2)}`).toBe(true);
      for (const p of end.plates) expect(p.layer, `plate layer ${p.index} box`).toEqual(end.canvas);

      if (mode === "phone") {
        // The same page: measured at most a small constant number of times (0 in practice), never per toggle or
        // per scroll event.
        expect(end.stats.measures - base.stats.measures, "layout measurements over 400 scroll events and 6 toolbar moves").toBeLessThanOrEqual(1);
        // The clock for the same scroll position is the clock a page without toolbar moves has there.
        const ctx = await browser.newContext({ baseURL, viewport: { width: TOOLBAR.width, height: TOOLBAR.shown }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
        try {
          const control = await ctx.newPage();
          await open(control, mode);
          await restAt(control, 1200);
          const done = await scrollScript(control, 2400, 6);
          await moveToolbar(control, "shown", mode);
          const ref = await snapshot(control);
          expect(done.scrollY, "same scroll end").toBe(res.scrollY);
          const refRaw = (await readFilmStats(control))!.rawClock;
          expect(refRaw, "raw clock at the same scroll position (the same geometry)").toBe(stats.rawClock);
          expect(ref.clock, "clock at the same scroll position").toBe(end.clock);
          expect([ref.segment, ref.frame], "frame at the same scroll position").toEqual([end.segment, end.frame]);
        } finally {
          await ctx.close();
        }
      } else {
        // The window's own svh lengths move the layout: a few measurements per move, not one per scroll event.
        expect(end.stats.measures - base.stats.measures, "layout measurements over 400 scroll events and 6 toolbar moves").toBeLessThanOrEqual(24);
      }
    });
  });
}

const closeBox = (a: { left: number; top: number; width: number; height: number }, b: typeof a, tol: number) =>
  close(a.left, b.left, tol) && close(a.top, b.top, tol) && close(a.width, b.width, tol) && close(a.height, b.height, tol);
const fmt = (b: { left: number; top: number; width: number; height: number }) =>
  `${b.left.toFixed(2)},${b.top.toFixed(2)} ${b.width.toFixed(2)}x${b.height.toFixed(2)}`;

test.describe("hold keys where the placement grows the scale", () => {
  test.use({ viewport: { width: GROW_TOOLBAR.width, height: GROW_TOOLBAR.shown } });

  for (const how of ["a scroll into the last hold", "a #contact deep link"] as const) {
    test(`the key's CSS fit before the backdrop lays it out is the laid-out picture, ${how} @toolbar`, async ({ page }) => {
      await simulateToolbar(page, "phone", GROW_TOOLBAR);
      if (how === "a #contact deep link") {
        await openHome(page, "#contact");
        await restAt(page, await page.evaluate(() => window.scrollY));
      } else {
        await openHome(page);
        await restAt(page, (await maxScroll(page)) - 160);
      }
      const s = await snapshot(page);
      const css = await cssKeyPictures(page, OBJECT_POSITION);
      const laidOut = s.keys.filter((k) => k.pic);
      expect(laidOut.length, "a hold key has been laid out").toBeGreaterThan(0);
      for (const k of laidOut) {
        const c = css.find((x) => x.i === k.i);
        expect(c, `key ${k.i}: its image is on the layer`).toBeDefined();
        // No zoom step when the backdrop takes over: the CSS cover fit of the layer's box is the placement.
        expect(closeBox(c!.pic, k.pic!, 0.5), `key ${k.i}: CSS fit ${fmt(c!.pic)} vs laid out ${fmt(k.pic!)}`).toBe(true);
        // The grow case: the picture is taller than the small viewport's own cover fit would make it.
        expect(k.pic!.top + k.pic!.height, `key ${k.i}: the picture covers the large viewport`).toBeGreaterThanOrEqual(GROW_TOOLBAR.hidden - 0.5);
      }
      // The key layers' box is the hero poster's box (both: the stage's height grown as the placement grows it, its
      // bottom on the large viewport's).
      expect(s.poster).not.toBeNull();
      for (const k of s.keys) expect(closeBox(k.box, s.poster!, 0.01), `key ${k.i} box ${fmt(k.box)} vs poster ${fmt(s.poster!)}`).toBe(true);
      expect(s.keys[0].box.top + s.keys[0].box.height, "the key box ends at the large viewport's bottom (to a layout unit)").toBeCloseTo(GROW_TOOLBAR.hidden, 1);
    });
  }

  test("the breath's origin is the same frame point as without the grow, and a reload boots it there @toolbar", async ({ page, browser, baseURL }) => {
    test.setTimeout(120_000);
    // The held key's push (the stand-in breath) scales the layer about a frame point: in the layer's own box, which
    // starts above the viewport here, so the origin must be offset by the box's top.
    const breathAt = async (p: Page) => {
      const s = await snapshot(p);
      const b = await p.evaluate(() => {
        const el = [...document.querySelectorAll<HTMLElement>("[data-key]")].find((e) => e.style.transform.startsWith("scale("));
        return el ? { i: Number(el.dataset.key), origin: el.style.transformOrigin.split(" ").map(parseFloat), scale: el.style.transform } : null;
      });
      expect(b, "a hold key breathes at the last hold").not.toBeNull();
      const k = s.keys.find((x) => x.i === b!.i)!;
      expect(k.pic, `key ${k.i} is laid out`).not.toBeNull();
      // The origin as a frame fraction: (layer px − picture's top-left) / picture size.
      const frac = [(k.box.left + b!.origin[0] - k.pic!.left) / k.pic!.width, (k.box.top + b!.origin[1] - k.pic!.top) / k.pic!.height];
      return { ...b!, frac, box: k.box };
    };

    await simulateToolbar(page, "phone", GROW_TOOLBAR);
    // The boot style as app/page.tsx's script wrote it, captured before the backdrop removes it.
    await page.addInitScript(() => {
      new MutationObserver((_, mo) => {
        const st = document.getElementById("reel-hold-boot");
        if (!st) return;
        (window as unknown as { __bootCss: string }).__bootCss = st.textContent ?? "";
        mo.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await openHome(page);
    await restAt(page, (await maxScroll(page)) - 160);
    const grown = await breathAt(page);
    expect(grown.box.top, "the key box starts above the viewport here").toBeLessThan(0);

    // The same frame point where lvh = svh (no grow, box top 0).
    const ctx = await browser.newContext({ baseURL, viewport: { width: GROW_TOOLBAR.width, height: GROW_TOOLBAR.hidden }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    try {
      const plain = await ctx.newPage();
      await openHome(plain);
      await restAt(plain, (await maxScroll(plain)) - 160);
      const ref = await breathAt(plain);
      expect(ref.box.top).toBe(0);
      expect(ref.i).toBe(grown.i);
      for (const a of [0, 1]) expect(Math.abs(grown.frac[a] - ref.frac[a]), `breath origin frame fraction ${a}: ${grown.frac[a]} vs ${ref.frac[a]}`).toBeLessThan(1e-3);
    } finally {
      await ctx.close();
    }

    // A reload there: pagehide saves the push in the key box's px (`b`), the boot script applies exactly that, and the
    // backdrop takes over with the same origin.
    await page.reload({ waitUntil: "load" });
    const rec = await page.evaluate(() => JSON.parse(sessionStorage.getItem("reel-hold-reveals") ?? "null"));
    expect(rec?.h, "the saved hold").toBe(grown.i);
    expect(rec?.k, "no record in the former canvas-top px").toBeUndefined();
    expect(rec?.b?.length, "the saved push").toBe(3);
    expect(Math.abs(rec.b[1] - grown.origin[0]) < 0.01 && Math.abs(rec.b[2] - grown.origin[1]) < 0.01, `saved origin ${rec.b.slice(1)} vs ${grown.origin}`).toBe(true);
    await page.waitForFunction(() => typeof (window as unknown as { __bootCss?: string }).__bootCss === "string");
    const bootCss = await page.evaluate(() => (window as unknown as { __bootCss: string }).__bootCss);
    expect(bootCss, "the boot style applies the saved origin").toContain(`transform-origin:${rec.b[1]}px ${rec.b[2]}px`);
    await restAt(page, await page.evaluate(() => window.scrollY));
    const after = await breathAt(page);
    expect(Math.abs(after.origin[0] - rec.b[1]) < 0.5 && Math.abs(after.origin[1] - rec.b[2]) < 0.5, `backdrop origin ${after.origin} vs booted ${rec.b.slice(1)}`).toBe(true);
  });
});

for (const [name, viewport, mobile] of [
  ["desktop 1440x900", { width: 1440, height: 900 }, false],
  ["phone 390x844 without a toolbar", { width: 390, height: 844 }, true],
] as const) {
  test.describe(`hold keys where lvh = svh: ${name}`, () => {
    test.use({ viewport, hasTouch: mobile, isMobile: mobile });
    test(`the key layer is the layer itself, top 0 and full height @toolbar`, async ({ page }) => {
      await openHome(page);
      await restAt(page, (await maxScroll(page)) - 160);
      const s = await snapshot(page);
      expect(s.keys.length).toBeGreaterThan(0);
      for (const k of s.keys) {
        expect(k.box, `key ${k.i} box`).toEqual(s.canvas);
        expect([k.box.top, k.box.height], `key ${k.i} top and height`).toEqual([0, viewport.height]);
      }
      // A laid-out key's CSS fit and its px agree here as well.
      const css = await cssKeyPictures(page, OBJECT_POSITION);
      for (const k of s.keys.filter((x) => x.pic)) {
        const c = css.find((x) => x.i === k.i)!;
        expect(closeBox(c.pic, k.pic!, 0.5), `key ${k.i}: CSS fit ${fmt(c.pic)} vs laid out ${fmt(k.pic!)}`).toBe(true);
      }
    });
  });
}

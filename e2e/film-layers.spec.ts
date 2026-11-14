import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, openHome, settle, settleNote } from "./film-frames";

// The plates and the anchors, per animation frame (stage 8). A perspective plate (components/film/PerspectivePlate.tsx)
// and the RideAnchor columns are written straight to the DOM from the film's clock and the painted frame. This spec
// scrolls through the Certifications chapter, the one with both (its plate's track, its flight into the h2, the four
// cartridges' columns riding their anchors on desktop), one scroll step per animation frame, and counts per frame:
//   runs     how often the plate's and the anchors' work ran (components/film/overlayFrame.ts, `window.__filmOverlay`)
//   reads    layout reads (getBoundingClientRect, offset*, client*) on the elements that work reads
//   writes   style writes on the plate's elements and on the anchors' wrappers, and its data attributes
// It also checks, at every frame, that the plate shows the track row of the frame the canvas has painted (a plate one
// frame behind the picture is a visible defect), and that the plate carries its layer hint (will-change) only while
// it moves. Counts and the frame order only: nothing here depends on how fast the machine is.

test.beforeAll(() => assertPlaceholdersPresent());

const INDEX = 2; // REEL_INDEX.certifications
const CHAPTER = "certifications"; // its FilmChapter id (div[data-chapter], the anchor's id)
const FILM = "rack-02";
const ANCHOR = `#${CHAPTER}`;
const STEPS = 160; // animation frames for the scripted scroll through the move
const MID_ROW = 46; // a track row while the plate sits on the well (rack-02: rows 26..66 opaque)

const trackCount = (name: string): number =>
  (JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "components", "film", "plates", `${name}.json`), "utf8")) as { count: number }).count;

type Sample = {
  runs: number;
  rideRuns: number;
  reads: number;
  plateWrites: number;
  rideWrites: number;
  attrWrites: number;
  segment: string;
  frame: number;
  row: number;
  flight: boolean;
  visible: boolean;
  hint: string;
};

/** Before any page script: counters around the layout reads and the style writes on the plates' and anchors' elements. */
async function instrument(page: Page): Promise<void> {
  await page.addInitScript((chapter: string) => {
    const counts = { reads: 0, plateWrites: 0, rideWrites: 0, attrWrites: 0 };
    (window as unknown as { __layerCounts: typeof counts }).__layerCounts = counts;
    // The elements the plate and the anchors read, in this chapter only (the nav reads the hero section's height on
    // every scroll, NavbarClient: not theirs).
    const READ = "[data-perspective-plate],[data-plate],[data-plate-target],[data-compose],[data-film-segment],[data-anchor],[data-ride]";
    const readOn = (el: unknown) => el instanceof Element && el.matches(READ) && !!el.closest(`[data-chapter="${chapter}"]`);
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (readOn(this)) counts.reads++;
      return rect.call(this);
    };
    const getters: [object, string[]][] = [
      [HTMLElement.prototype, ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight"]],
      [Element.prototype, ["clientWidth", "clientHeight", "clientTop", "clientLeft"]],
    ];
    for (const [proto, props] of getters) {
      for (const prop of props) {
        const d = Object.getOwnPropertyDescriptor(proto, prop);
        if (!d?.get) continue;
        const get = d.get;
        Object.defineProperty(proto, prop, {
          ...d,
          get(this: Element) {
            if (readOn(this)) counts.reads++;
            return get.call(this);
          },
        });
      }
    }
    // Style writes: `el.style` on a plate's or an anchor's element hands out a counting proxy of the declaration (the
    // CSS properties are own properties of each declaration in Chromium, so there is no prototype setter to wrap).
    const kindOf = (el: Element) =>
      el.matches("[data-plate],[data-perspective-plate]") ? "plateWrites" : el.matches("[data-ride]") ? "rideWrites" : null;
    const proxies = new WeakMap<object, object>();
    let p: object | null = HTMLElement.prototype;
    while (p && !Object.getOwnPropertyDescriptor(p, "style")) p = Object.getPrototypeOf(p);
    const sd = p ? Object.getOwnPropertyDescriptor(p, "style") : undefined;
    if (p && sd?.get) {
      const get = sd.get;
      Object.defineProperty(p, "style", {
        ...sd,
        get(this: Element) {
          const s = get.call(this) as CSSStyleDeclaration;
          const kind = kindOf(this);
          if (!kind) return s;
          let px = proxies.get(s);
          if (!px) {
            px = new Proxy(s, {
              set(t, k, v) {
                counts[kind]++;
                (t as unknown as Record<string | symbol, unknown>)[k] = v;
                return true;
              },
              get(t, k) {
                const v = (t as unknown as Record<string | symbol, unknown>)[k];
                if (typeof v !== "function") return v;
                return (...args: unknown[]) => {
                  if (k === "setProperty" || k === "removeProperty") counts[kind]++;
                  return (v as (...a: unknown[]) => unknown).apply(t, args);
                };
              },
            });
            proxies.set(s, px);
          }
          return px;
        },
      });
    }
    // Data attributes on the plate layers (every assignment queues a record, changed or not).
    new MutationObserver((records) => {
      for (const r of records) if ((r.target as Element).matches?.("[data-perspective-plate]")) counts.attrWrites++;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-plate-frame", "data-plate-flight"] });
  }, CHAPTER);
}

/** The chapter's section top (document px) and its camera move m (px): the anchor sits at m + 89. */
const chapterGeometry = (page: Page) =>
  page.evaluate(
    ({ index, anchor }) => {
      const section = document.querySelector<HTMLElement>(`section[data-film-segment][data-index="${index}"]`)!;
      const a = document.querySelector<HTMLElement>(anchor)!;
      return { top: section.getBoundingClientRect().top + window.scrollY, move: a.offsetTop - 89 };
    },
    { index: INDEX, anchor: ANCHOR },
  );

/**
 * Scrolls from `from` to `to` in `steps` animation frames (one instant scroll per frame), then `tail` more frames
 * without scrolling, sampling once per animation frame: the counters' increase since the previous sample and the plate's
 * and the canvas's state, read in one rAF callback (between two callbacks the page's work, its microtasks included, has
 * run to completion).
 */
function scripted(page: Page, from: number, to: number, steps: number, tail: number): Promise<Sample[]> {
  return page.evaluate(
    ({ from, to, steps, tail, index }) =>
      new Promise<Sample[]>((resolve) => {
        type Counts = { reads: number; plateWrites: number; rideWrites: number; attrWrites: number };
        const w = window as unknown as { __layerCounts: Counts; __filmOverlay?: { runs: Record<string, number> } };
        const layer = document.querySelector<HTMLElement>(`[data-perspective-plate="${index}"]`)!;
        const plate = layer.querySelector<HTMLElement>("[data-plate]")!;
        const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
        const read = () => {
          const runs = w.__filmOverlay?.runs ?? {};
          let ride = 0;
          for (const [k, v] of Object.entries(runs)) if (k.startsWith("ride:")) ride += v;
          return { ...w.__layerCounts, runs: runs[`plate:${index}`] ?? 0, rideRuns: ride };
        };
        const out: Sample[] = [];
        let prev = read();
        let i = 0;
        const tick = () => {
          const now = read();
          out.push({
            runs: now.runs - prev.runs,
            rideRuns: now.rideRuns - prev.rideRuns,
            reads: now.reads - prev.reads,
            plateWrites: now.plateWrites - prev.plateWrites,
            rideWrites: now.rideWrites - prev.rideWrites,
            attrWrites: now.attrWrites - prev.attrWrites,
            segment: canvas.dataset.segment ?? "",
            frame: Number(canvas.dataset.frame ?? -1),
            row: Number(layer.dataset.plateFrame ?? -1),
            flight: layer.dataset.plateFlight !== undefined,
            visible: plate.style.visibility === "visible",
            hint: plate.style.willChange,
          });
          prev = now;
          if (i < steps) {
            i++;
            window.scrollTo({ top: Math.round(from + ((to - from) * i) / steps), behavior: "instant" });
          } else if (i++ >= steps + tail) {
            resolve(out);
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { from, to, steps, tail, index: INDEX },
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const max = (xs: number[]) => xs.reduce((a, b) => Math.max(a, b), 0);
const hist = (xs: number[]) => {
  const h: Record<number, number> = {};
  for (const x of xs) h[x] = (h[x] ?? 0) + 1;
  return h;
};

/** One line per counter: total, max per frame, and the per-frame histogram (frames → count), for the report. */
function summary(label: string, s: Sample[]): string {
  const keys = ["runs", "rideRuns", "reads", "plateWrites", "rideWrites", "attrWrites"] as const;
  return [
    `${label}: ${s.length} frames, plate visible on ${s.filter((x) => x.visible).length}, in flight on ${s.filter((x) => x.flight).length}`,
    ...keys.map((k) => `  ${k}: total ${sum(s.map((x) => x[k]))}, max/frame ${max(s.map((x) => x[k]))}, per frame ${JSON.stringify(hist(s.map((x) => x[k])))}`),
  ].join("\n");
}

/** Frames where the plate shows a track row that is not the painted frame's (track rows are one per film frame). */
function trailing(s: Sample[], count: number): Sample[] {
  return s.filter((x) => x.segment.startsWith(FILM) && x.visible && !x.flight && x.row >= 0 && x.row !== Math.min(x.frame, count - 1));
}

async function run(page: Page, label: string, camera: "landscape" | "portrait", framed: boolean): Promise<void> {
  const film = camera === "portrait" ? `${FILM}-p` : FILM;
  const count = trackCount(film);
  await instrument(page);
  await openHome(page);
  const g = await chapterGeometry(page);
  // Just before the chapter: the plate's track loads on approach (the painted segment within one of its own).
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), g.top - 4);
  expect(await settle(page), `${label}: settle before the chapter${settleNote(page)}`).toBe(true);
  await page.locator(`[data-perspective-plate="${INDEX}"] [data-plate]`).waitFor({ state: "attached" });

  // 1. Into the move, to a frame where the plate sits on the well, and rest there.
  const mid = Math.round(g.top + (g.move * MID_ROW) / (count - 1));
  const a = await scripted(page, g.top - 4, mid, Math.round(STEPS / 3), 4);
  expect(await settle(page), `${label}: settle on the well${settleNote(page)}`).toBe(true);
  // At rest the hint is gone (it is held for a moment after the last move).
  await expect
    .poll(() => page.evaluate((i) => document.querySelector<HTMLElement>(`[data-perspective-plate="${i}"] [data-plate]`)!.style.willChange, INDEX))
    .toBe("");
  const rest = await page.evaluate((i) => {
    const layer = document.querySelector<HTMLElement>(`[data-perspective-plate="${i}"]`)!;
    return { row: Number(layer.dataset.plateFrame), visible: layer.querySelector<HTMLElement>("[data-plate]")!.style.visibility === "visible" };
  }, INDEX);
  expect(rest.visible, `${label}: the plate shows on the well at rest`).toBe(true);
  expect(rest.row, `${label}: the plate rests on a track row`).toBeGreaterThan(0);

  // 2. On through the lift and the flight to camera rest and into the read pin.
  const b = await scripted(page, mid, g.top + g.move + 120, STEPS, 40);
  expect(await settle(page), `${label}: settle at the end${settleNote(page)}`).toBe(true);
  const samples = [...a, ...b];
  const report = summary(label, samples);
  console.log(report);
  test.info().annotations.push({ type: "counts", description: report });

  // The scroll covered the plate's track and its flight.
  expect(samples.filter((x) => x.visible && !x.flight).length, `${label}: frames on the track`).toBeGreaterThan(10);
  expect(samples.filter((x) => x.flight).length, `${label}: frames in flight`).toBeGreaterThan(3);
  // The order: at every frame the plate shows the row of the frame the canvas painted (never the one before).
  const late = trailing(samples, count);
  expect(late.map((x) => `canvas ${x.segment}#${x.frame} plate row ${x.row}`), `${label}: plate rows that are not the painted frame's`).toEqual([]);
  // One application per animation frame. A frame can carry two when the canvas paints twice in it (a frame arriving
  // in the backdrop's own animation frame callback and the clock's tick after it): each paint gets its plate.
  expect(max(samples.map((x) => x.runs)), `${label}: plate runs per frame`).toBeLessThanOrEqual(2);
  expect(samples.filter((x) => x.runs > 1).length, `${label}: frames with two plate runs`).toBeLessThanOrEqual(Math.ceil(samples.length / 10));
  // Reads: the section's top (the raw frame), and in flight the composition's top and the h2's box; never the layer's.
  expect(max(samples.map((x) => x.reads)), `${label}: layout reads per frame`).toBeLessThanOrEqual(3 * max(samples.map((x) => x.runs)));
  // On the track only the section's top, once per run (the anchor's offset is read once, then cached).
  const trackReads = samples.filter((x) => x.visible && !x.flight && x.reads > x.runs);
  expect(trackReads.length, `${label}: track frames with more than one read per run`).toBeLessThanOrEqual(1);
  // Writes: only what changed, so at most transform, opacity, visibility and the hint per run, and no data attribute
  // written without a change (the row moves at most once per run).
  expect(max(samples.map((x) => x.plateWrites)), `${label}: plate style writes per frame`).toBeLessThanOrEqual(4 * max(samples.map((x) => x.runs)));
  // The hint: on while it moves, never on a hidden plate.
  expect(samples.some((x) => x.visible && x.hint === "transform"), `${label}: will-change while the plate moves`).toBe(true);
  expect(samples.filter((x) => !x.visible && x.hint !== "").length, `${label}: will-change on a hidden plate`).toBe(0);
  if (framed) {
    // The four cartridges' columns ride their anchors: one write each per frame at most.
    expect(max(samples.map((x) => x.rideWrites)), `${label}: anchor writes per frame`).toBeLessThanOrEqual(4);
    expect(sum(samples.map((x) => x.rideWrites)), `${label}: anchors moved`).toBeGreaterThan(0);
  } else {
    // Stacked (phones): the anchors never ride, so nothing is written to them at all.
    expect(sum(samples.map((x) => x.rideWrites)), `${label}: anchor writes on a stacked composition`).toBe(0);
  }
}

test.describe("plates and anchors, desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("one plate application per frame, on the painted frame @layers", async ({ page }) => {
    await run(page, "desktop", "landscape", true);
  });
});

test.describe("plates and anchors, phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  test("one plate application per frame, on the painted frame @layers", async ({ page }) => {
    await run(page, "phone", "portrait", false);
  });
});

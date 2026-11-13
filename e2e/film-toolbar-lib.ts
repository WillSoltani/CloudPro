import type { Page } from "@playwright/test";
import { settle, unsettledAt } from "./film-frames";

/**
 * The toolbar simulation, shared by e2e/film-toolbar.spec.ts and the scratch scripts that run it on an older build.
 *
 * Playwright cannot emulate a phone's dynamic browser toolbar: in a test browser lvh = svh = dvh = the window height.
 * A phone with its toolbar shown has svh = dvh (say 664 px) and lvh = 754 px; hiding it makes dvh = 754 px while svh
 * and lvh stay put. So the simulation fixes the two static heights in the CSS variables the film layers read
 * (`--film-lvh`, `--film-svh` on :root, components/film/placement.ts: test-only, nothing sets them in production)
 * and moves the toolbar by resizing the window between the two heights (dvh and window.innerHeight follow the
 * window, as they do on a phone). On a build that does not read the variables (before stage 5) the window resize
 * alone is the whole simulation.
 */

export const TOOLBAR = {
  width: 390,
  /** The window height with the toolbar shown (dvh = svh). */
  shown: 664,
  /** The window height with the toolbar hidden (dvh = lvh). */
  hidden: 754,
} as const;

/**
 * How the toolbar is moved.
 *  - `"resize"`: the window itself is resized between the two heights. Everything that follows the window follows it,
 *    including the page's own `svh` and `vh` lengths (the chapters' spacers, the sticky stages), which on a phone do
 *    NOT move with the toolbar: so the page lays out again here, which a phone's does not. What the film's layers do
 *    is faithful (the layers read the two variables, the window's `dvh` and `innerHeight` move); the clock and the
 *    frames are not comparable across a toggle, because the document is a different height.
 *  - `"phone"`: the window keeps its size (so svh, lvh and the document stay put, as on a phone) and only what a
 *    toolbar changes in script moves: `window.innerHeight` and `document.documentElement.clientHeight` take the
 *    other height and a `resize` event fires. The page is then the same page, so the clock, the frame, the pixels and
 *    the plate are comparable across a toggle. (CSS `dvh` does not move in this mode; the film no longer uses it.)
 */
export type ToolbarMode = "resize" | "phone";

/**
 * Sets `--film-lvh` / `--film-svh` on :root before any page script runs (a constructed stylesheet: nothing the framework
 * does to <html> can drop it). In "phone" mode it also installs the two height getters `moveToolbar` drives.
 */
export async function simulateToolbar(page: Page, mode: ToolbarMode = "resize"): Promise<void> {
  await page.addInitScript(
    ({ lvh, svh, phone }) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`:root{--film-lvh:${lvh}px;--film-svh:${svh}px}`);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      if (!phone) return;
      const state: { h: number } = { h: svh };
      (window as unknown as { __toolbarSet: (h: number) => void }).__toolbarSet = (h: number) => {
        state.h = h;
        window.dispatchEvent(new Event("resize"));
      };
      Object.defineProperty(window, "innerHeight", { configurable: true, get: () => state.h });
      // The root's clientHeight is read as the viewport; any other element keeps the real one.
      const real = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!;
      Object.defineProperty(Element.prototype, "clientHeight", {
        configurable: true,
        get(this: Element) {
          return this === document.documentElement ? state.h : (real.get as () => number).call(this);
        },
      });
    },
    { lvh: TOOLBAR.hidden, svh: TOOLBAR.shown, phone: mode === "phone" },
  );
}

type Box = { left: number; top: number; width: number; height: number };

export type Snap = {
  scrollY: number;
  innerHeight: number;
  /** data-clock, the shown clock (3 dp), and the painted frame. */
  clock: string;
  segment: string;
  frame: string;
  stats: { canvasResizes: number; measures: number; draws: number; backingW: number; backingH: number };
  /** The canvas element's CSS box. */
  canvas: Box;
  canvasW: number;
  canvasH: number;
  /** FNV-1a of the canvas's pixels (the backing store, as painted). */
  hash: string;
  /** The placeholder marker row (the dark cells, CSS px from the layer's top-left): null when no placeholder is painted. */
  band: { x0: number; x1: number; y0: number; y1: number } | null;
  /** Every hold-key layer: its CSS box, computed opacity, and the picture box it declares (background size and position). */
  keys: { i: number; opacity: number; box: Box; pic: Box | null }[];
  /** The plate layers: the layer's CSS box, and the plate element's box on screen when it is showing. */
  plates: { index: string; layer: Box; frame: number; plate: Box | null }[];
  /** Canvas ResizeObserver callbacks since `watchCanvas` (the initial one excluded). */
  canvasRoCalls: number;
};

/** Counts the canvas's ResizeObserver callbacks from now on (the callback observe() fires at once is not counted). */
export async function watchCanvas(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
    const w = window as unknown as { __toolbarRo?: { calls: number; first: boolean } };
    const state = { calls: 0, first: true };
    const ro = new ResizeObserver(() => {
      if (state.first) state.first = false;
      else state.calls++;
    });
    ro.observe(canvas);
    w.__toolbarRo = state;
  });
}

/** Everything the toolbar simulation compares, in one synchronous read of the page. */
export function snapshot(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
    const cr = canvas.getBoundingClientRect();
    const s = window.__filmStats!;

    // FNV-1a over the canvas pixels, and the dark band (luma < 30) the placeholder's row of off cells makes.
    let hash = "";
    let band: Snap["band"] = null;
    const ctx = canvas.getContext("2d");
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = new Uint32Array(img.data.buffer);
      let h = 0x811c9dc5;
      for (let i = 0; i < px.length; i++) h = Math.imul(h ^ px[i], 0x01000193) >>> 0;
      hash = h.toString(16);
      const d = img.data;
      let x0 = Infinity;
      let x1 = -1;
      let y0 = Infinity;
      let y1 = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const k = (y * canvas.width + x) * 4;
          if (d[k + 3] > 0 && d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114 < 30) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 >= 0) {
        const kx = cr.width / canvas.width;
        const ky = cr.height / canvas.height;
        // Pixel edges: the band spans [y0, y1 + 1) backing px.
        band = { x0: x0 * kx, x1: (x1 + 1) * kx, y0: y0 * ky, y1: (y1 + 1) * ky };
      }
    }

    const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : NaN);
    const keys = [...document.querySelectorAll<HTMLElement>("[data-key]")].map((el) => {
      const cs = getComputedStyle(el);
      const [bw, bh] = cs.backgroundSize.split(" ").map(px);
      const [bx, by] = cs.backgroundPosition.split(" ").map(px);
      const pic = [bw, bh, bx, by].every(Number.isFinite) ? { left: bx, top: by, width: bw, height: bh } : null;
      return { i: Number(el.dataset.key), opacity: Number(cs.opacity), box: box(el.getBoundingClientRect()), pic };
    });
    const plates = [...document.querySelectorAll<HTMLElement>("[data-perspective-plate]")].map((el) => {
      const plate = el.querySelector<HTMLElement>("[data-plate]");
      const showing = !!plate && plate.style.visibility === "visible" && Number(plate.style.opacity) > 0;
      return {
        index: el.dataset.perspectivePlate ?? "",
        layer: box(el.getBoundingClientRect()),
        frame: Number(el.dataset.plateFrame),
        plate: showing ? box(plate!.getBoundingClientRect()) : null,
      };
    });
    const ro = (window as unknown as { __toolbarRo?: { calls: number } }).__toolbarRo;
    return {
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      clock: canvas.dataset.clock ?? "",
      segment: canvas.dataset.segment ?? "",
      frame: canvas.dataset.frame ?? "",
      stats: { canvasResizes: s.canvasResizes, measures: s.measures, draws: s.draws, backingW: s.backingW, backingH: s.backingH },
      canvas: box(cr),
      canvasW: canvas.width,
      canvasH: canvas.height,
      hash,
      band,
      keys,
      plates,
      canvasRoCalls: ro?.calls ?? 0,
    };
  });
}

/**
 * Waits for the film to come to rest (e2e/film-frames.ts settle) and throws when it does not, with settle()'s snapshot
 * (the scroll position, the target, what is painted, the engine's and the loader's state) in the message.
 */
async function settleOrThrow(page: Page, what: string): Promise<void> {
  if (await settle(page)) return;
  const y = await page.evaluate(() => window.scrollY);
  throw new Error(`the film did not come to rest ${what}: ${unsettledAt(page, y)}`);
}

/** Moves the simulated toolbar (see ToolbarMode) and lets the page react. */
export async function moveToolbar(page: Page, to: "shown" | "hidden", mode: ToolbarMode = "resize"): Promise<void> {
  await setToolbar(page, to, mode);
  // Two frames for the resize handlers and observers, then until the film is at rest again.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.waitForTimeout(150);
  await settleOrThrow(page, `after the toolbar moved (${to}, ${mode})`);
}

/** Moves the toolbar without waiting (to do it while the page is scrolling). */
export async function setToolbar(page: Page, to: "shown" | "hidden", mode: ToolbarMode = "resize"): Promise<void> {
  if (mode === "resize") await page.setViewportSize({ width: TOOLBAR.width, height: TOOLBAR[to] });
  else await page.evaluate((h) => (window as unknown as { __toolbarSet: (h: number) => void }).__toolbarSet(h), TOOLBAR[to]);
}

/** Scrolls to `y` and waits for the film to come to rest there. */
export async function restAt(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await settleOrThrow(page, `at scroll ${y}`);
}

/**
 * Scrolls down by `px` in steps of `step` per animation frame, from the current position, inside the page. Resolves
 * with the number of frames it took and where it ended. Start it without awaiting to move the toolbar meanwhile.
 */
export function scrollScript(page: Page, px: number, step: number): Promise<{ frames: number; scrollY: number }> {
  return page.evaluate(
    ({ px, step }) =>
      new Promise<{ frames: number; scrollY: number }>((resolve) => {
        const start = window.scrollY;
        let frames = 0;
        const tick = () => {
          frames++;
          const y = Math.min(start + px, window.scrollY + step);
          window.scrollTo({ top: y, behavior: "instant" });
          if (y >= start + px) resolve({ frames, scrollY: window.scrollY });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { px, step },
  );
}

/** How far the marker row moved between two snapshots, in CSS px (the largest edge difference); null if either has none. */
export function bandShift(a: Snap, b: Snap): number | null {
  if (!a.band || !b.band) return null;
  return Math.max(Math.abs(a.band.x0 - b.band.x0), Math.abs(a.band.x1 - b.band.x1), Math.abs(a.band.y0 - b.band.y0), Math.abs(a.band.y1 - b.band.y1));
}

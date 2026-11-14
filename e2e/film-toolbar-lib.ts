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

/** A phone shape for the simulation: the window width, the small (toolbar shown) and the large viewport height. */
export type ToolbarShape = { width: number; shown: number; hidden: number };

/**
 * A shape where placement() grows the scale on the portrait camera (the small viewport's cover fit would leave the
 * bottom of the large-viewport layer uncovered): an Android 20:9 phone drawn edge to edge, 411 x 826 in 882.
 */
export const GROW_TOOLBAR: ToolbarShape = { width: 411, shown: 826, hidden: 882 };

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
export async function simulateToolbar(page: Page, mode: ToolbarMode = "resize", shape: ToolbarShape = TOOLBAR): Promise<void> {
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
    { lvh: shape.hidden, svh: shape.shown, phone: mode === "phone" },
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
  /**
   * Every hold-key layer: its CSS box, computed opacity, and the picture it declares in px (background size and
   * position, as the backdrop's layoutKey sets them), in the layer's coordinates (CSS px from the viewport's top-left).
   */
  keys: { i: number; opacity: number; box: Box; pic: Box | null }[];
  /** The hero poster's box, relative to its sticky stage (FilmSegment POSTER); null without a poster. */
  poster: Box | null;
  /**
   * The frame variables of the first chapter composition (frameBox.ts frameVars: --fx0, --fy0, --fw, --fh), as a box
   * relative to the composition box, read through a probe element that uses them; null without a composition.
   */
  frameVars: Box | null;
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
    // A fixed layer's own box, untransformed (a key's breath scales it): its computed left, top, width and height.
    const layerBox = (cs: CSSStyleDeclaration): Box => ({
      left: parseFloat(cs.left),
      top: parseFloat(cs.top),
      width: parseFloat(cs.width),
      height: parseFloat(cs.height),
    });
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
      const r = layerBox(cs);
      const [bw, bh] = cs.backgroundSize.split(" ").map(px);
      const [bx, by] = cs.backgroundPosition.split(" ").map(px);
      // background-position is relative to the background's origin box (the padding box, or the content box).
      const content = cs.backgroundOrigin === "content-box";
      const ox = parseFloat(cs.borderLeftWidth) + (content ? parseFloat(cs.paddingLeft) : 0);
      const oy = parseFloat(cs.borderTopWidth) + (content ? parseFloat(cs.paddingTop) : 0);
      const pic = [bw, bh, bx, by].every(Number.isFinite) ? { left: r.left + ox + bx, top: r.top + oy + by, width: bw, height: bh } : null;
      return { i: Number(el.dataset.key), opacity: Number(cs.opacity), box: r, pic };
    });
    const posterEl = document.querySelector<HTMLElement>("section[data-film-segment][data-index='0'] img");
    const stageEl = posterEl?.closest("section[data-film-segment] > div");
    let poster: Box | null = null;
    if (posterEl && stageEl) {
      const p = posterEl.getBoundingClientRect();
      const st = stageEl.getBoundingClientRect();
      poster = { left: p.left - st.left, top: p.top - st.top, width: p.width, height: p.height };
    }
    const compose = document.querySelector<HTMLElement>("[data-compose]");
    let frameVars: Box | null = null;
    if (compose) {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:var(--fx0);top:var(--fy0);width:var(--fw);height:var(--fh);visibility:hidden;pointer-events:none";
      compose.appendChild(probe);
      const pr = probe.getBoundingClientRect();
      const cr2 = compose.getBoundingClientRect();
      frameVars = { left: pr.left - cr2.left, top: pr.top - cr2.top, width: pr.width, height: pr.height };
      probe.remove();
    }
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
      poster,
      frameVars,
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
  if (!(await settle(page))) {
    const y = await page.evaluate(() => window.scrollY);
    throw new Error(`the film did not come to rest ${what}: ${unsettledAt(page, y)}`);
  }
  // settle() rests on the painted frame and an unchanged 3-decimal clock; the smoothing's last thousandth of a clock
  // unit can still be under way then, for as long as the machine is slow. Wait for the shown clock to have landed on
  // the raw one (the spring ends on its target exactly), so two pages at one scroll position show the same clock.
  try {
    await page.waitForFunction(
      () => {
        const c = document.querySelector<HTMLCanvasElement>("canvas[data-clock]");
        return !!c && !!window.__filmStats && c.dataset.clock === window.__filmStats.rawClock.toFixed(3);
      },
      undefined,
      { timeout: 30_000 },
    );
  } catch {
    const now = await page.evaluate(() => ({
      y: window.scrollY,
      shown: document.querySelector<HTMLCanvasElement>("canvas[data-clock]")?.dataset.clock,
      raw: window.__filmStats?.rawClock,
    }));
    throw new Error(`the shown clock did not land on the raw clock ${what}: ${JSON.stringify(now)}`);
  }
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
export async function setToolbar(page: Page, to: "shown" | "hidden", mode: ToolbarMode = "resize", shape: ToolbarShape = TOOLBAR): Promise<void> {
  if (mode === "resize") await page.setViewportSize({ width: shape.width, height: shape[to] });
  else await page.evaluate((h) => (window as unknown as { __toolbarSet: (h: number) => void }).__toolbarSet(h), shape[to]);
}

/**
 * The picture each hold-key layer would show from its CSS alone, as before the backdrop has laid it out (the boot
 * style in app/page.tsx shows a key with nothing but the layer's own classes, `background-size: cover` and the
 * REEL_OBJECT_POSITION inline position): a copy of the layer with the backdrop's inline size, position and breath
 * removed, in the same parent (so the stage variables apply), its box and computed style read and the cover fit
 * computed for the key image's natural size. In the layer's coordinates (CSS px from the viewport's top-left). Only
 * keys whose image is on the layer (the backdrop has set `background-image`).
 */
export function cssKeyPictures(page: Page, objectPosition: string): Promise<{ i: number; box: Box; pic: Box }[]> {
  return page.evaluate(async (objectPosition) => {
    const out: { i: number; box: Box; pic: Box }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      const url = /^url\("?(.*?)"?\)$/.exec(el.style.backgroundImage)?.[1];
      if (!url) continue;
      const img = new Image();
      img.src = url;
      await img.decode();
      const copy = el.cloneNode(false) as HTMLElement;
      copy.removeAttribute("data-key");
      copy.style.backgroundSize = "";
      copy.style.transform = "";
      copy.style.transformOrigin = "";
      copy.style.backgroundPosition = objectPosition;
      el.parentElement!.appendChild(copy);
      // Read everything before the copy leaves the document (a detached element's computed style is empty).
      const cs = getComputedStyle(copy);
      const r = { left: parseFloat(cs.left), top: parseFloat(cs.top), width: parseFloat(cs.width), height: parseFloat(cs.height) };
      const content = cs.backgroundOrigin === "content-box";
      const bl = parseFloat(cs.borderLeftWidth);
      const bt = parseFloat(cs.borderTopWidth);
      const p = {
        Left: content ? parseFloat(cs.paddingLeft) : 0,
        Right: content ? parseFloat(cs.paddingRight) : 0,
        Top: content ? parseFloat(cs.paddingTop) : 0,
        Bottom: content ? parseFloat(cs.paddingBottom) : 0,
      };
      const pad = (k: keyof typeof p) => p[k];
      // The positioning area: the padding box (border-box minus borders), or the content box.
      const areaW = r.width - bl - parseFloat(cs.borderRightWidth) - pad("Left") - pad("Right");
      const areaH = r.height - bt - parseFloat(cs.borderBottomWidth) - pad("Top") - pad("Bottom");
      const position = cs.backgroundPosition;
      const size = cs.backgroundSize;
      const sizing = cs.boxSizing;
      copy.remove();
      if (sizing !== "border-box") throw new Error(`box-sizing ${sizing}: expected border-box`);
      if (size !== "cover") throw new Error(`background-size ${size}: expected cover`);
      const [px, py] = position.split(" ").map((v) => {
        if (!v.endsWith("%")) throw new Error(`background-position ${position}: expected percentages`);
        return parseFloat(v) / 100;
      });
      const scale = Math.max(areaW / img.naturalWidth, areaH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      out.push({
        i: Number(el.dataset.key),
        box: { left: r.left, top: r.top, width: r.width, height: r.height },
        pic: { left: r.left + bl + pad("Left") + (areaW - w) * px, top: r.top + bt + pad("Top") + (areaH - h) * py, width: w, height: h },
      });
    }
    return out;
  }, objectPosition);
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

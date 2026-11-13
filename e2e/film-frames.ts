import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { cellCentres, decodeLumas, FOCUS } from "../scripts/films/placeholder-layout.mjs";

/**
 * Helpers shared by the film specs. The film is a fixed canvas (components/film/FilmBackdrop.tsx) that
 * carries test hooks: `canvas[data-segment]` (film name), `data-frame` (0-based painted frame),
 * `data-width` (tier), `data-reel`, `data-clock`, `data-tail`.
 *
 * With placeholder frames (scripts/films/placeholder.mjs, FILM_FRAMES unset) every painted frame also
 * names itself in its pixels, so a spec can ask the canvas which film and frame it shows instead of
 * trusting the page's own hook: readPaintedFrame().
 */

export const FILMS_DIR = path.resolve(__dirname, "..", "public", "films");

/** True when this run serves the placeholder frames (the default); false for FILM_FRAMES=cdn. */
export const PLACEHOLDER_RUN = process.env.FILM_FRAMES !== "cdn";

/** Names of the films with a manifest, sorted: a film's position is the id its placeholder frames carry. */
export function filmNames(): string[] {
  return readdirSync(FILMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(FILMS_DIR, d.name, "manifest.json")))
    .map((d) => d.name)
    .sort();
}

export type Manifest = { name: string; count: number; widths: number[]; aspect: number; pad: number; ext: string };

export function readManifest(name: string): Manifest {
  return JSON.parse(readFileSync(path.join(FILMS_DIR, name, "manifest.json"), "utf8")) as Manifest;
}

/** Throws a plain message when a placeholder run has no placeholder frames to serve (the page would 404). */
export function assertPlaceholdersPresent(): void {
  if (!PLACEHOLDER_RUN) return;
  const missing = filmNames().filter((n) => !existsSync(path.join(FILMS_DIR, n, ".placeholder.json")));
  if (missing.length) {
    throw new Error(`No placeholder frames for ${missing.join(", ")} in public/films. Run \`npm run film:placeholder\` first (or FILM_FRAMES=cdn for the real frames).`);
  }
}

export type PaintedFrame = {
  /** What the canvas hooks say. */
  hook: { segment: string; frame: number; width: number };
  /** What the pixels say; null when the sampled cells are not a placeholder row (a real frame, or nothing drawn). */
  pixels: { film: string; index: number } | null;
};

/**
 * Where the 18 placeholder cells sit in a frame, for every film and tier the manifests declare, keyed
 * `<film>|<tier width>`. The page cannot import scripts/films/placeholder-layout.mjs, so the geometry is worked out here,
 * with the same cellCentres() the generator draws with, and handed to the page as data. A frame is `tier width` px
 * wide and `round(width / aspect)` px tall (the same rule the generator uses).
 */
type CellGeometry = { centres: { x: number; y: number }[]; halfW: number; halfH: number; fh: number };
let geometryCache: Record<string, CellGeometry> | null = null;
function cellGeometry(): Record<string, CellGeometry> {
  if (geometryCache) return geometryCache;
  const table: Record<string, CellGeometry> = {};
  for (const name of filmNames()) {
    const m = readManifest(name);
    for (const fw of m.widths) {
      const fh = Math.round(fw / m.aspect);
      table[`${name}|${fw}`] = { ...cellCentres(fw, fh), fh };
    }
  }
  return (geometryCache = table);
}

/**
 * The film and frame the canvas shows, from its hooks and (on placeholder frames) from its pixels.
 *
 * The hooks and the pixels are read in ONE page.evaluate, one synchronous block, so they describe the same paint:
 * the engine's draw() writes the pixels and the three data attributes in one synchronous block too (FilmBackdrop.tsx),
 * so nothing can paint between the two reads. (Two separate evaluates let a repaint, a nearer frame arriving, land
 * between them: the hook then named the old frame and the pixels the new one.) Only the sampling happens in the page;
 * the decoding is placeholder-layout.mjs decodeLumas().
 *
 * The placeholder row sits on the reel's focus point, which the cover fit maps to the same share of the canvas
 * whatever the crop; it is mapped through the same fit anyway (components/film/filmBase.ts coverRect), from the
 * frame's size (the painted tier's width, the manifest's aspect).
 */
export async function readPaintedFrame(page: Page): Promise<PaintedFrame | null> {
  const read = await page.evaluate(
    ({ geometry, focus }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]");
      if (!canvas || canvas.dataset.frame === undefined) return null;
      const hook = { segment: canvas.dataset.segment ?? "", frame: Number(canvas.dataset.frame), width: Number(canvas.dataset.width) };
      const ctx = canvas.getContext("2d");
      const g = geometry[`${hook.segment}|${hook.width}`];
      if (!ctx || !g) return { hook, lumas: null };
      // The cover fit on the canvas's device pixels.
      const fw = hook.width;
      const fh = g.fh;
      const scale = Math.max(canvas.width / fw, canvas.height / fh);
      const left = (canvas.width - fw * scale) * focus[0];
      const top = (canvas.height - fh * scale) * focus[1];
      const r = Math.max(1, Math.floor(Math.min(g.halfW, g.halfH) * scale * 0.5));
      const lumas = g.centres.map((c) => {
        const x = Math.round(left + c.x * scale);
        const y = Math.round(top + c.y * scale);
        if (x - r < 0 || y - r < 0 || x + r > canvas.width || y + r > canvas.height) return -1;
        const d = ctx.getImageData(x - r, y - r, 2 * r + 1, 2 * r + 1).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        return sum / (d.length / 4);
      });
      return { hook, lumas };
    },
    { geometry: cellGeometry(), focus: [...FOCUS] },
  );
  if (!read) return null;
  const decoded = read.lumas && read.lumas.every((l) => l >= 0) ? decodeLumas(read.lumas) : null;
  const names = filmNames();
  return {
    hook: read.hook,
    pixels: decoded && names[decoded.filmId] ? { film: names[decoded.filmId], index: decoded.index } : null,
  };
}

export type PageWatch = { consoleErrors: string[]; failed: string[] };

/**
 * Collects the console errors, uncaught page errors and the 4xx/5xx answers of this app's own origin (the page,
 * everything under /films, the committed hold keys under /images/reel and the framework files under /_next). A
 * request to another host (the film CDN on a FILM_FRAMES=cdn run) is not looked at: it is not this app's to fix.
 */
export function watchPage(page: Page, baseURL: string): PageWatch {
  const watch: PageWatch = { consoleErrors: [], failed: [] };
  const origin = new URL(baseURL).origin;
  page.on("console", (msg) => {
    if (msg.type() === "error") watch.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => watch.consoleErrors.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    const url = new URL(res.url());
    const mine = url.origin === origin && (url.pathname === "/" || url.pathname.startsWith("/films/") || url.pathname.startsWith("/images/reel/") || url.pathname.startsWith("/_next/"));
    if (mine && res.status() >= 400) watch.failed.push(`${res.status()} ${url.pathname}`);
  });
  return watch;
}

/** The engine's counters, a copy (null before the engine's effect has run). */
export const readFilmStats = (page: Page) => page.evaluate(() => (window.__filmStats ? { ...window.__filmStats } : null));

/**
 * The frame loaders the film specs run with (components/film/loader/select.ts): the default, the budget loader decoding
 * in the film worker (its `mode` must be "budget": the worker chunk was emitted by the build and runs in this browser),
 * and the legacy loader by `?loader=legacy`.
 */
export const LOADERS = [
  { name: "budget", param: "", mode: "budget" },
  { name: "legacy", param: "loader=legacy", mode: "legacy" },
] as const;
export type SpecLoader = (typeof LOADERS)[number];

/** A query string ("" or "?…") with the loader's parameter and `extra` ("a=1&b=2"). */
export function loaderQuery(loader: SpecLoader, extra = ""): string {
  const parts = [loader.param, extra].filter(Boolean);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Loads the home page and waits until the film canvas has painted a first frame and the counters exist. */
export async function openHome(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`, { waitUntil: "load" });
  await page.locator("canvas[data-segment]").waitFor({ state: "attached" });
  await page.waitForFunction(() => !!window.__filmStats && document.querySelector<HTMLCanvasElement>("canvas[data-segment]")?.dataset.frame !== undefined);
}

/**
 * Waits until the film has come to rest: the canvas shows the effective target (the target segment, and the target
 * frame or, where the engine never loads that frame by design, such as an odd breathing-tail frame on a phone, a
 * nearest frame it does load: `effectiveFrame`) and has stayed there, with the clock unchanged, for three looks
 * 60 ms apart. It also accepts any frame of the target segment once nothing is in flight and nothing has changed
 * for six looks (a frame that failed to load). Resolves false after `timeoutMs`
 * (the caller decides whether that is a failure). It reads the counters and the canvas hooks only; no threshold
 * on how fast anything is.
 */
export function settle(page: Page, timeoutMs = 20_000): Promise<boolean> {
  return page.evaluate(async (limit) => {
    const t0 = performance.now();
    let stable = 0;
    let last = "";
    while (performance.now() - t0 < limit) {
      await new Promise((r) => setTimeout(r, 60));
      const s = window.__filmStats;
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]");
      if (!s || !c) continue;
      const key = `${c.dataset.reel}|${c.dataset.segment}|${c.dataset.frame}|${s.targetSeg}|${s.targetFrame}`;
      const reach = Math.abs(s.effectiveFrame - s.targetFrame);
      const exact = s.paintedSeg === s.targetSeg && s.paintedFrame >= 0 && Math.abs(s.paintedFrame - s.targetFrame) === reach;
      const resting = exact || (s.inflight === 0 && s.paintedSeg === s.targetSeg);
      if (resting && key === last) {
        if (++stable >= (exact ? 3 : 6)) return true;
      } else {
        stable = 0;
      }
      last = key;
    }
    return false;
  }, timeoutMs);
}

/** The farthest the document scrolls (px). */
export const maxScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

/** The document scrolled sideways (it must not). */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));

/**
 * Scrolls from `from` to `to` in `step` px, calling `visit(y)` at each stop (the caller usually waits for the film to
 * settle there), and once more at `to` itself.
 */
export async function walkPage(page: Page, from: number, to: number, step: number, visit: (y: number) => Promise<void>): Promise<void> {
  const dir = to >= from ? 1 : -1;
  for (let y = from; dir > 0 ? y < to : y > to; y += dir * step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await visit(y);
  }
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), to);
  await visit(to);
}

/** The film and frame the canvas shows: the pixels' reading on placeholder frames, else the hooks'. */
export async function paintedNow(page: Page): Promise<{ segment: string; frame: number; width: number; pixelsAgree: boolean }> {
  const painted = PLACEHOLDER_RUN ? await readPaintedFrame(page) : null;
  const hook =
    painted?.hook ??
    (await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[data-segment]")!;
      return { segment: c.dataset.segment ?? "", frame: Number(c.dataset.frame), width: Number(c.dataset.width) };
    }));
  const pixelsAgree = !painted || (!!painted.pixels && painted.pixels.film === hook.segment && painted.pixels.index === hook.frame);
  return { ...hook, pixelsAgree };
}

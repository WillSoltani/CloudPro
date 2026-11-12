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
 * The film and frame the canvas shows, from its hooks and (on placeholder frames) from its pixels. The
 * placeholder row sits on the reel's focus point, which the cover fit maps to the same share of the canvas
 * whatever the crop; it is mapped through the same fit anyway, from the frame's size (the painted tier's
 * width, the manifest's aspect).
 */
export async function readPaintedFrame(page: Page): Promise<PaintedFrame | null> {
  const probe = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]");
    if (!canvas || canvas.dataset.frame === undefined) return null;
    return { segment: canvas.dataset.segment ?? "", frame: Number(canvas.dataset.frame), width: Number(canvas.dataset.width) };
  });
  if (!probe) return null;
  const manifest = readManifest(probe.segment);
  const fw = probe.width;
  const fh = Math.round(fw / manifest.aspect);
  const { centres, halfW, halfH } = cellCentres(fw, fh);
  const lumas = await page.evaluate(
    ({ centres, fw, fh, focus, halfW, halfH }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-segment]");
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return null;
      // The cover fit (components/film/filmBase.ts coverRect) on the canvas's device pixels.
      const scale = Math.max(canvas.width / fw, canvas.height / fh);
      const left = (canvas.width - fw * scale) * focus[0];
      const top = (canvas.height - fh * scale) * focus[1];
      const r = Math.max(1, Math.floor(Math.min(halfW, halfH) * scale * 0.5));
      return centres.map((c) => {
        const x = Math.round(left + c.x * scale);
        const y = Math.round(top + c.y * scale);
        if (x - r < 0 || y - r < 0 || x + r > canvas.width || y + r > canvas.height) return -1;
        const d = ctx.getImageData(x - r, y - r, 2 * r + 1, 2 * r + 1).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        return sum / (d.length / 4);
      });
    },
    { centres, fw, fh, focus: [...FOCUS], halfW, halfH },
  );
  const decoded = lumas && lumas.every((l) => l >= 0) ? decodeLumas(lumas) : null;
  const names = filmNames();
  return {
    hook: probe,
    pixels: decoded && names[decoded.filmId] ? { film: names[decoded.filmId], index: decoded.index } : null,
  };
}

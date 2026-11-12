#!/usr/bin/env node
/**
 * placeholder.mjs - tiny stand-in frames for every film in public/films, so the scroll film can be built and
 * measured without the real renders (they live on the film CDN and are not in the repository).
 *
 *   node scripts/films/placeholder.mjs                 write what is missing (a second run changes nothing)
 *   node scripts/films/placeholder.mjs rack-00 ...     only these films
 *   node scripts/films/placeholder.mjs --clean         remove what this script wrote
 *   --force                                            overwrite / remove a directory that holds real frames
 *   --out <dir>                                        another films directory (default public/films)
 *
 * For each film in <out>/<name>/manifest.json and each width in its `widths` it writes
 * <out>/<name>/<width>/f_NNNN.<ext> at the real pixel size (width x width / aspect), plus the poster the
 * manifest names. Frames are flat colour with a row of black and white cells and four seven-segment digits,
 * so each is a few hundred bytes and carries its film id and frame index in its pixels
 * (scripts/films/placeholder-layout.mjs; e2e/film-frames.ts reads it back from the canvas).
 *
 * Build the page with NEXT_PUBLIC_FILM_BASE=/films so every frame, poster and still is served from here
 * (playwright.config.ts does, unless FILM_FRAMES=cdn). The hold keys are /images/reel/*.webp, committed
 * stills outside the film base: there is nothing to write for them.
 *
 * Marker: each film directory gets .placeholder.json (what was written, a signature of the manifest and the
 * layout, and the hash of the first frame of each width). It tells placeholders from real frames:
 *   - a directory with frames or a poster and no marker, or whose first frames no longer match the marker
 *     (a real build wrote over them), holds real frames: the script stops and writes nothing, unless --force;
 *   - a directory whose marker matches and whose files are all there is left alone (no-op);
 *   - --clean removes the width directories, the poster and the marker of a directory it wrote, never the
 *     manifest, and refuses a directory of real frames unless --force.
 * Needs sharp, which is not a declared dependency (next carries it as an optional one, enough on a Mac). CI
 * runs `npm install --no-save sharp@0.34.5` before this; do the same on a machine without a working sharp.
 * Output is gitignored (/public/films/*\/* but manifest.json), so nothing here can be committed by accident.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LAYOUT_VERSION, MAX_FILMS, MAX_FRAMES, frameSvg } from "./placeholder-layout.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MARKER = ".placeholder.json";
/**
 * Lossless: flat colour and hard edges are a few hundred bytes that way (lossy cost 8 KB a frame, measured,
 * and blurred the cells), and the pixels read back exactly. Effort 4: effort 0 is larger in lossless mode.
 */
const WEBP = { lossless: true, effort: 4 };
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const optIdx = args.indexOf("--out");
const OUT = path.resolve(REPO, optIdx === -1 ? "public/films" : args[optIdx + 1] ?? "");
const wanted = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
const FORCE = flag("force");
const CLEAN = flag("clean");

const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");
const exists = (p) => fs.access(p).then(() => true, () => false);
const readJson = (p) => fs.readFile(p, "utf8").then(JSON.parse, () => null);

const dirs = (await fs.readdir(OUT, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const names = [];
for (const name of dirs) if (await exists(path.join(OUT, name, "manifest.json"))) names.push(name);
if (names.length > MAX_FILMS) {
  console.error(`placeholder.mjs: ${names.length} films, the layout carries ${MAX_FILMS}`);
  process.exit(1);
}
for (const w of wanted) {
  if (!names.includes(w)) {
    console.error(`placeholder.mjs: no film "${w}" in ${OUT}`);
    process.exit(1);
  }
}
const selected = wanted.length ? names.filter((n) => wanted.includes(n)) : names;

/** What the manifest says to write for one film. */
async function plan(name) {
  const m = await readJson(path.join(OUT, name, "manifest.json"));
  if (!m || !Array.isArray(m.widths) || !m.widths.length) throw new Error(`${name}: manifest has no widths`);
  if (m.ext !== "webp") throw new Error(`${name}: ext ${m.ext}, the generator writes webp`);
  if (!(m.count >= 1 && m.count <= MAX_FRAMES)) throw new Error(`${name}: count ${m.count} outside 1-${MAX_FRAMES}`);
  const filmId = names.indexOf(name);
  const poster = path.posix.basename(new URL(m.poster, "http://x/").pathname);
  const sizes = m.widths.map((w) => ({ width: w, height: Math.round(w / m.aspect) }));
  const file = (i) => `f_${String(i + 1).padStart(m.pad, "0")}.${m.ext}`;
  const signature = sha1(JSON.stringify({ LAYOUT_VERSION, WEBP, filmId, name, count: m.count, pad: m.pad, ext: m.ext, aspect: m.aspect, widths: m.widths, poster }));
  return { name, dir: path.join(OUT, name), m, filmId, poster, sizes, file, signature };
}

async function firstFrameHashes(p) {
  const out = {};
  for (const { width } of p.sizes) {
    try {
      out[width] = sha1(await fs.readFile(path.join(p.dir, String(width), p.file(0))));
    } catch {
      out[width] = null;
    }
  }
  return out;
}

/** "none": nothing generated is there; "ours": marker and first frames agree; "real": frames this script did not write. */
async function inspect(p) {
  const marker = await readJson(path.join(p.dir, MARKER));
  const entries = await fs.readdir(p.dir);
  const generated = entries.filter((e) => e !== "manifest.json" && e !== MARKER);
  if (!marker) return { kind: generated.length ? "real" : "none", marker: null, generated };
  const now = await firstFrameHashes(p);
  const same = Object.entries(marker.firstFrames ?? {}).every(([w, h]) => now[w] === h);
  return { kind: same ? "ours" : "real", marker, generated };
}

async function complete(p, marker) {
  if (marker.signature !== p.signature) return false;
  if (!(await exists(path.join(p.dir, p.poster)))) return false;
  for (const { width } of p.sizes) {
    const files = (await fs.readdir(path.join(p.dir, String(width))).catch(() => [])).filter((f) => f.startsWith("f_"));
    if (files.length !== p.m.count) return false;
  }
  return true;
}

async function removeGenerated(p) {
  for (const { width } of p.sizes) await fs.rm(path.join(p.dir, String(width)), { recursive: true, force: true });
  await fs.rm(path.join(p.dir, p.poster), { force: true });
  await fs.rm(path.join(p.dir, MARKER), { force: true });
}

async function pool(n, fn) {
  const jobs = Array.from({ length: n }, (_, i) => i);
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jobs.length) await fn(jobs.shift());
    }),
  );
}

let files = 0;
let bytes = 0;
let skipped = 0;
let refused = 0;

for (const name of selected) {
  const p = await plan(name);
  const found = await inspect(p);
  if (found.kind === "real" && !FORCE) {
    console.error(`placeholder.mjs: ${path.relative(REPO, p.dir)} holds real frames (${found.generated.slice(0, 4).join(", ")}); ${CLEAN ? "not removing" : "not overwriting"} them. Pass --force to ${CLEAN ? "remove" : "replace"} them.`);
    refused++;
    continue;
  }
  if (CLEAN) {
    if (found.kind === "none") continue;
    await removeGenerated(p);
    console.log(`${name}: removed`);
    continue;
  }
  if (found.kind === "ours" && (await complete(p, found.marker))) {
    skipped++;
    continue;
  }
  if (found.kind !== "none") await removeGenerated(p);

  let filmFiles = 0;
  let filmBytes = 0;
  for (const { width, height } of p.sizes) {
    const dir = path.join(p.dir, String(width));
    await fs.mkdir(dir, { recursive: true });
    await pool(p.m.count, async (i) => {
      const svg = Buffer.from(frameSvg(width, height, p.filmId, i, p.m.count));
      const info = await sharp(svg).webp(WEBP).toFile(path.join(dir, p.file(i)));
      filmFiles++;
      filmBytes += info.size;
    });
  }
  // The poster: the first frame of the widest tier.
  const widest = p.sizes.reduce((a, b) => (b.width > a.width ? b : a));
  await fs.copyFile(path.join(p.dir, String(widest.width), p.file(0)), path.join(p.dir, p.poster));
  filmFiles++;
  filmBytes += (await fs.stat(path.join(p.dir, p.poster))).size;
  await fs.writeFile(
    path.join(p.dir, MARKER),
    JSON.stringify({ generator: "scripts/films/placeholder.mjs", layout: LAYOUT_VERSION, signature: p.signature, filmId: p.filmId, frames: p.m.count, files: filmFiles, bytes: filmBytes, firstFrames: await firstFrameHashes(p) }, null, 2) + "\n",
  );
  files += filmFiles;
  bytes += filmBytes;
  console.log(`${name}: ${filmFiles} files, ${(filmBytes / 1024).toFixed(0)} KB`);
}

if (CLEAN) console.log(refused ? `placeholder.mjs: clean stopped on ${refused} directory(ies) of real frames` : "placeholder.mjs: clean done");
else console.log(`placeholder.mjs: wrote ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes} bytes); ${skipped} film(s) already up to date`);
if (refused) process.exit(1);

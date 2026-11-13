#!/usr/bin/env node
/**
 * pack.mjs - build, verify and check the film packs (stage 7): ONE file per film directory and width holding all its
 * frames' files byte for byte, read by the page with one streaming GET. Format and frame order:
 * components/film/loader/pack-format.mjs; logic: scripts/films/pack-lib.mjs; docs/film-lab-gate.md ("Packs").
 *
 *   npm run film:pack -- --from-cdn tower-04-p --width 432        build one pack from the CDN's frames
 *   npm run film:pack -- --from-cdn --all                          every film and width
 *   npm run film:pack -- --from-cdn rack-01 --write-manifest       ... and record it in the committed manifest
 *   npm run film:pack -- --verify tower-04-p                       re-check built packs against the CDN's frames
 *   npm run film:pack -- --check-cdn --all [--full]                is the pack the manifest names served right
 *
 * Options: films by name (or --all); --width <w>[,<w>…] (default: every width of the manifest); --out <dir> (default
 * films-src/packs, gitignored), laid out like the CDN: <out>/films/<name>/<width>/pack-<8 hex of sha256>.bin;
 * --films <dir> (the manifests, default public/films); --concurrency <n> (frame downloads in flight, default 8,
 * at most 12); --full (with --check-cdn: download each pack and check its hash).
 *
 * --from-cdn downloads the frames from the manifest's base (retries, checks the count and that each is WebP), builds
 * the pack, writes it, reads it back from disk and compares every frame's bytes with the downloaded file (and through
 * the runtime's streaming cutter), and prints its layout. --write-manifest then sets the manifest's `packs[width]`
 * (file, bytes, header, skeletonEnd), keeping the rest of the file byte for byte. Nothing here uploads anything:
 * uploading the packs is a separate, deliberate step. Exit 1 on any problem.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  REPO,
  buildFilmPack,
  checkCdnPack,
  describePack,
  fetchFrames,
  moveEndOf,
  packEntry,
  packFileName,
  packFilesIn,
  packOutPath,
  readTimeline,
  verifyPack,
  withPackEntry,
  writePackFile,
} from "./pack-lib.mjs";

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--width", "--out", "--films", "--concurrency", "--origin"]);
const opt = (name) => {
  const out = [];
  args.forEach((a, i) => {
    if (a === name && args[i + 1] !== undefined) out.push(args[i + 1]);
  });
  return out;
};
const flag = (name) => args.includes(name);
const named = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));

const modes = ["--from-cdn", "--verify", "--check-cdn"].filter(flag);
if (modes.length !== 1) {
  console.error("pack.mjs: give exactly one of --from-cdn, --verify, --check-cdn (see the header of scripts/films/pack.mjs)");
  process.exit(2);
}
const MODE = modes[0];
const FILMS = path.resolve(REPO, opt("--films")[0] ?? "public/films");
const OUT = path.resolve(REPO, opt("--out")[0] ?? "films-src/packs");
const WIDTHS = opt("--width").flatMap((w) => w.split(",")).map(Number).filter(Boolean);
const CONCURRENCY = Math.min(MAX_CONCURRENCY, Math.max(1, Number(opt("--concurrency")[0] ?? DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY));
const WRITE_MANIFEST = flag("--write-manifest");
const ORIGIN = opt("--origin")[0] ?? "https://soltani.org";

const exists = (p) => fs.access(p).then(() => true, () => false);
const all = [];
for (const d of (await fs.readdir(FILMS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  if (await exists(path.join(FILMS, d, "manifest.json"))) all.push(d);
}
if (!flag("--all") && !named.length) {
  console.error("pack.mjs: name the films, or --all");
  process.exit(2);
}
for (const n of named) {
  if (!all.includes(n)) {
    console.error(`pack.mjs: no film "${n}" in ${path.relative(REPO, FILMS) || FILMS}`);
    process.exit(2);
  }
}
const films = flag("--all") ? all : named;
const timeline = await readTimeline();

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
function printLayout(data, moveEnd) {
  for (const p of describePack(data, moveEnd)) {
    const list = p.list.length ? `  frames ${p.list.length <= 6 ? p.list.join(", ") : `${p.list.slice(0, 4).join(", ")}, … ${p.list[p.list.length - 1]}`}` : "";
    console.log(`    ${p.name.padEnd(17)} bytes ${String(p.start).padStart(8)} – ${String(p.end).padEnd(8)} ${String(p.bytes).padStart(8)} B (${kb(p.bytes)}), ${p.frames} frames${list}`);
  }
}

let problems = 0;
const fail = (line) => {
  problems++;
  console.log(`  FAIL ${line}`);
};

for (const name of films) {
  const mPath = path.join(FILMS, name, "manifest.json");
  const m = JSON.parse(await fs.readFile(mPath, "utf8"));
  const widths = WIDTHS.length ? WIDTHS.filter((w) => m.widths.includes(w)) : m.widths;
  if (!widths.length) {
    console.log(`${name}: none of the widths ${WIDTHS.join(", ")} (it has ${m.widths.join(", ")}), skipped`);
    continue;
  }
  const moveEnd = moveEndOf(m, timeline);
  for (const width of widths) {
    const label = `${name}/${width}`;
    try {
      if (MODE === "--check-cdn") {
        const r = await checkCdnPack(m, width, { origin: ORIGIN, full: flag("--full") });
        for (const p of r.problems) fail(p);
        console.log(`${label}: ${r.problems.length ? "FAILED" : "served right"} (${r.notes.join("; ")})`);
        continue;
      }
      const t0 = Date.now();
      const frames = await fetchFrames(m, width, { concurrency: CONCURRENCY });
      const source = frames.reduce((s, f) => s + f.length, 0);
      if (MODE === "--verify") {
        const dir = path.dirname(packOutPath(OUT, m, width, "x"));
        const listed = m.packs?.[String(width)]?.file;
        const files = await packFilesIn(dir);
        const file = listed && files.includes(listed) ? listed : files.length === 1 ? files[0] : null;
        if (!file) {
          fail(`${label}: no pack in ${dir} (${files.length ? files.join(", ") : "none"}${listed ? `; the manifest names ${listed}` : ""})`);
          continue;
        }
        const data = new Uint8Array(await fs.readFile(path.join(dir, file)));
        const p = verifyPack(data, frames, moveEnd, { file });
        for (const line of p) fail(`${label}: ${line}`);
        if (listed && listed !== file) fail(`${label}: the manifest names ${listed}, the directory holds ${file}`);
        console.log(`${label}: ${p.length ? "FAILED" : "verified"} ${file} (${data.length} B, ${frames.length} frames)`);
        continue;
      }
      // --from-cdn
      const built = buildFilmPack(frames, moveEnd);
      const dest = packOutPath(OUT, m, width, built.file);
      const removed = await writePackFile(dest, built.data);
      const back = new Uint8Array(await fs.readFile(dest));
      const p = verifyPack(back, frames, moveEnd, { file: path.basename(dest) });
      for (const line of p) fail(`${label}: ${line}`);
      if (p.length) {
        console.log(`${label}: FAILED verification, ${dest} left for inspection`);
        continue;
      }
      console.log(
        `${label}: ${built.file} ${built.bytes} B (frames ${source} B + header ${built.header} B), skeleton ends at ${built.skeletonEnd} ` +
          `(${((100 * built.skeletonEnd) / built.bytes).toFixed(0)} %), move end ${built.moveEnd}, verified byte for byte, ${((Date.now() - t0) / 1000).toFixed(1)} s` +
          (removed.length ? `; removed ${removed.join(", ")}` : ""),
      );
      console.log(`    -> ${dest}`);
      printLayout(back, moveEnd);
      if (packFileName(back) !== built.file) fail(`${label}: name and content disagree after writing`);
      if (WRITE_MANIFEST) {
        const text = await fs.readFile(mPath, "utf8");
        const next = withPackEntry(text, width, packEntry(built));
        if (next !== text) {
          await fs.writeFile(mPath, next);
          console.log(`    manifest: packs.${width} = ${built.file} (${path.relative(REPO, mPath)})`);
        }
        m.packs = JSON.parse(next).packs;
      }
    } catch (e) {
      fail(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
console.log(problems ? `pack.mjs: ${problems} problem(s)` : "pack.mjs: done");
process.exit(problems ? 1 : 0);

// Tests for the packs' manifest field (filmBase packFor / packUrl, resolveFilm under NEXT_PUBLIC_FILM_BASE) and for
// the builder's move end agreeing with the reel (scripts/films/pack-lib.mjs moveEndOf against reel.ts segmentOf and
// tailOf). NEXT_PUBLIC_FILM_BASE is read when filmBase loads, so it is set first and the modules are imported after
// (node:test runs each test file in its own process). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import type { FilmManifest } from "./filmCore";

process.env.NEXT_PUBLIC_FILM_BASE = "/films/";

type FilmBase = typeof import("./filmBase");
type Reel = typeof import("./reel");
let fb: FilmBase;
let reel: Reel;
let lib: { moveEndOf(m: { name: string; count: number }, t: unknown): number; readTimeline(): Promise<unknown> };

before(async () => {
  fb = await import("./filmBase");
  reel = await import("./reel");
  lib = await import("../../scripts/films/pack-lib.mjs");
});

const CDN = "https://cdn.example/films/tower-04-p";
const film = (packs?: unknown): FilmManifest =>
  ({
    name: "tower-04-p",
    count: 145,
    fps: 24,
    widths: [432, 499],
    aspect: 0.462,
    pad: 4,
    ext: "webp",
    base: CDN,
    poster: `${CDN}/poster.webp`,
    ...(packs === undefined ? {} : { packs }),
  }) as FilmManifest;
const ENTRY = { file: "pack-0123abcd.bin", bytes: 1_000_000, header: 1764, skeletonEnd: 300_000 };

describe("packFor / packUrl", () => {
  it("names the pack beside the frames when the manifest has an entry for the width", () => {
    const m = film({ "432": ENTRY });
    assert.deepEqual(fb.packFor(m, 432), ENTRY);
    assert.equal(fb.packUrl(m, 432), `${CDN}/432/pack-0123abcd.bin`);
    assert.equal(fb.packUrl(m, 432)!.replace(/pack-.*$/, ""), fb.frameUrl(m, 432, 0).replace(/f_.*$/, ""));
    assert.equal(fb.packUrl(m, 499), null, "no entry for this width: frame by frame");
    assert.equal(fb.packUrl(film(), 432), null, "no packs at all");
  });

  it("ignores a malformed entry (a path in the name, missing or impossible sizes)", () => {
    for (const bad of [
      { ...ENTRY, file: "../x/pack-0123abcd.bin" },
      { ...ENTRY, file: "https://evil.example/pack.bin" },
      { ...ENTRY, file: "pack.webp" },
      { ...ENTRY, bytes: 0 },
      { ...ENTRY, header: 1.5 },
      { ...ENTRY, skeletonEnd: ENTRY.bytes + 1 },
      { ...ENTRY, skeletonEnd: ENTRY.header - 1 },
      { file: ENTRY.file },
      "pack-0123abcd.bin",
      null,
    ]) {
      assert.equal(fb.packUrl(film({ "432": bad }), 432), null, JSON.stringify(bad));
    }
  });

  it("follows resolveFilm's base rewrite under NEXT_PUBLIC_FILM_BASE, like the frames and the poster", () => {
    const r = fb.resolveFilm(film({ "432": ENTRY }));
    assert.equal(r.base, "/films/tower-04-p");
    assert.equal(fb.packUrl(r, 432), "/films/tower-04-p/432/pack-0123abcd.bin");
    assert.equal(fb.frameUrl(r, 432, 0), "/films/tower-04-p/432/f_0001.webp");
  });
});

describe("the builder's move end agrees with the reel", () => {
  it("moveEndOf(manifest) = segmentOf(entry) for both cameras of every reel entry, and its tail follows M", async () => {
    const timeline = await lib.readTimeline();
    for (const e of reel.REEL) {
      for (const m of e.portrait ? [e.landscape, e.portrait] : [e.landscape]) {
        assert.equal(lib.moveEndOf(m, timeline), reel.segmentOf(e), m.name);
        const t = reel.tailOf(e);
        if (t && t.frames > 0) {
          assert.equal(t.from, reel.segmentOf(e), `${m.name}: tail starts at M`);
          assert.equal(m.count - 1, t.from + t.frames, `${m.name}: the tail runs to the last frame`);
        }
      }
    }
  });

  it("every committed manifest's packs entry, if any, is well formed", async () => {
    const dir = path.resolve(process.cwd(), "public/films");
    for (const name of await fs.readdir(dir)) {
      const m = JSON.parse(await fs.readFile(path.join(dir, name, "manifest.json"), "utf8").catch(() => "null"));
      if (!m?.packs) continue;
      for (const w of Object.keys(m.packs)) {
        assert.ok(m.widths.includes(Number(w)), `${name}: pack for width ${w} it does not have`);
        assert.ok(fb.packFor(m, Number(w)), `${name}/${w}: malformed packs entry`);
      }
    }
  });
});

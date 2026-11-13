// Tests for scripts/films/pack-lib.mjs (the pack builder's logic) on synthetic frames and a fake fetch: build and
// verify, the content-hash name, downloading frames (retries, wrong bodies), the manifest entry, the CDN check.
// Run: npm run test:film-unit
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PACK_NAME_PATTERN,
  buildFilmPack,
  checkCdnPack,
  describePack,
  fetchFrames,
  fetchRetry,
  isWebp,
  moveEndOf,
  packEntry,
  packFileName,
  packFilesIn,
  packOutPath,
  verifyPack,
  withPackEntry,
  writePackFile,
} from "./pack-lib.mjs";
import { parsePackHeader } from "../../components/film/loader/pack-format.mjs";

/** A synthetic WebP-looking frame: RIFF <size> WEBP then distinct bytes. */
function webp(k, size = 30 + ((k * 37) % 70)) {
  const b = new Uint8Array(size);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(b.buffer).setUint32(4, size - 8, true);
  b.set([0x57, 0x45, 0x42, 0x50], 8);
  for (let i = 12; i < size; i++) b[i] = (k * 31 + i) & 255;
  return b;
}
const frames = (n) => Array.from({ length: n }, (_, k) => webp(k));
const manifest = (over = {}) => ({
  name: "rack-01-p",
  count: 19,
  fps: 24,
  widths: [432, 720],
  aspect: 0.4615,
  pad: 4,
  ext: "webp",
  base: "https://cdn.example/films/rack-01-p",
  poster: "https://cdn.example/films/rack-01-p/poster.webp",
  ...over,
});
const noWait = async () => {};

/** The CDN's answer to a CORS preflight (OPTIONS), as CloudFront gave it on 2026-11-13. */
const CDN_PREFLIGHT = {
  status: 200,
  headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,HEAD,OPTIONS", "access-control-allow-headers": "*", "access-control-max-age": "3600" },
};

/** A fake fetch serving `files` (url → bytes), with optional per-url failures before success. */
function fakeFetch(files, { failures = {}, headers = () => ({}), preflight = CDN_PREFLIGHT } = {}) {
  const calls = [];
  const left = { ...failures };
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    if (left[url]) {
      const f = left[url].shift();
      if (!left[url].length) delete left[url];
      if (f === "throw") throw new TypeError("network down");
      return new Response(null, { status: f });
    }
    if (init.method === "OPTIONS") return new Response(null, preflight);
    const body = files.get(url);
    if (!body) return new Response("missing", { status: 404 });
    const h = { "content-type": "application/octet-stream", ...headers(url) };
    const range = new Headers(init.headers ?? {}).get("range");
    if (init.method === "HEAD") return new Response(null, { status: 200, headers: { ...h, "content-length": String(body.length) } });
    if (range) {
      const [, a, b] = /bytes=(\d+)-(\d*)/.exec(range);
      const start = Number(a);
      const end = b ? Number(b) : body.length - 1;
      return new Response(body.slice(start, end + 1), { status: 206, headers: { ...h, "content-range": `bytes ${start}-${end}/${body.length}` } });
    }
    return new Response(body, { status: 200, headers: h });
  };
  return { fn, calls };
}

test("moveEndOf: the timeline's segment for both cameras, else the last frame", () => {
  const timeline = { films: [{ name: "rack-01", segment: 120, frames: 121, tail: { frames: 48 } }] };
  assert.equal(moveEndOf({ name: "rack-01", count: 169 }, timeline), 120);
  assert.equal(moveEndOf({ name: "rack-01-p", count: 169 }, timeline), 120);
  assert.equal(moveEndOf({ name: "tower-04-p", count: 145 }, timeline), 144);
  assert.equal(moveEndOf({ name: "rack-01", count: 50 }, timeline), 49, "clamped to the film");
});

test("isWebp checks RIFF....WEBP", () => {
  assert.ok(isWebp(webp(1)));
  assert.ok(!isWebp(new TextEncoder().encode("<html>not found</html>")));
  assert.ok(!isWebp(new Uint8Array(4)));
});

test("buildFilmPack + verifyPack: verified; named by its content hash; deterministic", () => {
  const f = frames(19);
  const p = buildFilmPack(f, 12);
  assert.match(p.file, PACK_NAME_PATTERN);
  assert.equal(p.file, packFileName(p.data));
  assert.equal(buildFilmPack(frames(19), 12).file, p.file);
  assert.deepEqual(verifyPack(p.data, f, 12, { file: p.file, chunk: 7 }), []);
  assert.deepEqual(packEntry(p), { file: p.file, bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd });
  const parts = describePack(p.data, 12);
  assert.deepEqual(parts.map((x) => x.name), ["fixed header", "table", "hold frames", "skeleton", "rest of the move", "tail"]);
  assert.equal(parts.reduce((s, x) => s + x.bytes, 0), p.bytes, "the parts cover the file");
  assert.deepEqual(parts[2].list, [0, 12, 18]);
  assert.deepEqual(parts[3].list, [4, 8]);
  assert.deepEqual(parts[5].list, [14, 16, 13, 15, 17]);
  assert.deepEqual([parts[3].end, parts[5].end], [p.skeletonEnd, p.bytes]);
});

test("verifyPack catches a changed frame, a missing frame, another order, a wrong name, a truncated file", () => {
  const f = frames(19);
  const p = buildFilmPack(f, 12);
  const changed = f.map((x, i) => (i === 5 ? webp(99, x.length) : x));
  assert.ok(verifyPack(p.data, changed, 12).some((l) => /frame 5 differs/.test(l)));
  assert.ok(verifyPack(p.data, f.slice(0, 18), 12).some((l) => /holds 19 frames, the source 18/.test(l)));
  assert.ok(verifyPack(p.data, f, 18).some((l) => /order/.test(l)), "built for another move end");
  assert.ok(verifyPack(p.data, f, 12, { file: "pack-00000000.bin" }).some((l) => /content hash/.test(l)));
  assert.deepEqual(verifyPack(p.data.subarray(0, 30), f, 12), ["pack: shorter than its header"]);
  assert.ok(verifyPack(p.data.subarray(0, p.bytes - 3), f, 12).length > 0);
});

test("fetchFrames: every frame from the base, polite, retried, checked", async () => {
  const m = manifest();
  const f = frames(19);
  const files = new Map(f.map((b, i) => [`${m.base}/432/f_${String(i + 1).padStart(4, "0")}.webp`, b]));
  let inFlight = 0;
  let peak = 0;
  const { fn, calls } = fakeFetch(files, { failures: { [`${m.base}/432/f_0003.webp`]: [503, "throw"] } });
  const slow = async (url, init) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    try {
      return await fn(url, init);
    } finally {
      inFlight--;
    }
  };
  const got = await fetchFrames(m, 432, { fetchImpl: slow, concurrency: 50, wait: noWait });
  assert.equal(got.length, 19);
  got.forEach((b, i) => assert.deepEqual(b, f[i]));
  assert.ok(peak <= 12, `at most 12 in flight (peak ${peak})`);
  assert.equal(calls.length, 21, "frame 3 took three tries");
  await assert.rejects(fetchFrames(m, 999, { fetchImpl: fn }), /no width 999/);
  files.delete(`${m.base}/432/f_0007.webp`);
  await assert.rejects(fetchFrames(m, 432, { fetchImpl: fn, wait: noWait }), /f_0007\.webp: HTTP 404/);
  files.set(`${m.base}/432/f_0007.webp`, new TextEncoder().encode("<html>"));
  await assert.rejects(fetchFrames(m, 432, { fetchImpl: fn, wait: noWait }), /not a WebP/);
});

test("fetchRetry: a 404 is final, a 5xx and a network error are retried, then the last answer stands", async () => {
  const { fn, calls } = fakeFetch(new Map(), { failures: { "u": [500, 500, 500, 500] } });
  const res = await fetchRetry("u", {}, { fetchImpl: fn, wait: noWait });
  assert.equal(res.status, 500);
  assert.equal(calls.length, 4);
  const nf = await fetchRetry("v", {}, { fetchImpl: fn, wait: noWait });
  assert.equal(nf.status, 404);
  assert.equal(calls.length, 5);
});

test("packOutPath mirrors the CDN layout; writePackFile replaces an older pack", async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "cf-packs-"));
  const m = manifest();
  const a = buildFilmPack(frames(19), 12);
  const b = buildFilmPack(frames(18), 12);
  const pa = packOutPath(out, m, 432, a.file);
  assert.equal(pa, path.join(out, "films", "rack-01-p", "432", a.file));
  await writePackFile(pa, a.data);
  const removed = await writePackFile(packOutPath(out, m, 432, b.file), b.data);
  assert.deepEqual(removed, [a.file]);
  assert.deepEqual(await packFilesIn(path.dirname(pa)), [b.file]);
  await fs.rm(out, { recursive: true });
});

test("withPackEntry adds packs as the last member and keeps the rest of the manifest byte for byte", () => {
  const text = '{\n  "name": "x",\n  "aspect": 0.4620,\n  "kb": {\n    "432": 984\n  }\n}\n';
  const e432 = { file: "pack-0123abcd.bin", bytes: 10, header: 5, skeletonEnd: 7 };
  const e499 = { file: "pack-89abcdef.bin", bytes: 20, header: 5, skeletonEnd: 9 };
  const one = withPackEntry(text, 432, e432);
  assert.ok(one.startsWith('{\n  "name": "x",\n  "aspect": 0.4620,\n  "kb": {\n    "432": 984\n  },\n  "packs": {\n    "432": {\n'));
  assert.ok(one.endsWith("\n  }\n}\n"));
  assert.deepEqual(JSON.parse(one).packs, { 432: e432 });
  // Another width, inserted in width order; then the first replaced.
  const two = withPackEntry(withPackEntry(text, 499, e499), 432, e432);
  assert.deepEqual(Object.keys(JSON.parse(two).packs), ["432", "499"]);
  assert.ok(two.includes('"aspect": 0.4620'));
  const again = withPackEntry(two, 432, { ...e432, bytes: 11 });
  assert.equal(JSON.parse(again).packs["432"].bytes, 11);
  assert.equal(JSON.parse(again).packs["499"].file, e499.file);
  assert.equal(withPackEntry(two, 432, e432), two, "the same entry changes nothing");
});

test("checkCdnPack: a pack served right passes; a wrong size, a hidden Content-Range, a wrong type or a refused Range preflight is reported", async () => {
  const f = frames(19);
  const p = buildFilmPack(f, 12);
  const m = manifest({ packs: { 432: packEntry(p) } });
  const url = `${m.base}/432/${p.file}`;
  const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "Content-Range, Content-Length, ETag, Accept-Ranges", "cache-control": "public, max-age=31536000, immutable" };
  const ok = fakeFetch(new Map([[url, p.data]]), { headers: () => cors });
  const r = await checkCdnPack(m, 432, { fetchImpl: ok.fn, full: true, wait: noWait });
  assert.deepEqual(r.problems, []);
  assert.ok(ok.calls.every((c) => new Headers(c.init.headers ?? {}).get("origin")), "every request carries an Origin");
  const hidden = fakeFetch(new Map([[url, p.data]]), { headers: () => ({ ...cors, "access-control-expose-headers": "", "content-type": "binary/octet-stream" }) });
  const r2 = await checkCdnPack(m, 432, { fetchImpl: hidden.fn, wait: noWait });
  assert.ok(r2.problems.some((l) => /not exposed/.test(l)));
  assert.ok(r2.problems.some((l) => /content-type/.test(l)));
  const short = fakeFetch(new Map([[url, p.data.subarray(0, p.bytes - 1)]]), { headers: () => cors });
  const r3 = await checkCdnPack(m, 432, { fetchImpl: short.fn, wait: noWait });
  assert.ok(r3.problems.some((l) => /content-length/.test(l)));
  const none = await checkCdnPack(manifest(), 432, { fetchImpl: ok.fn });
  assert.match(none.problems[0], /names no pack/);
  // The CORS preflight a browser may send before a Range read: asked as a browser asks it, and its answer checked.
  const pre = ok.calls.find((c) => c.init.method === "OPTIONS");
  assert.ok(pre, "a preflight was sent");
  const ph = new Headers(pre.init.headers);
  assert.equal(ph.get("access-control-request-method"), "GET");
  assert.equal(ph.get("access-control-request-headers"), "range");
  const listed = fakeFetch(new Map([[url, p.data]]), {
    headers: () => cors,
    preflight: { status: 204, headers: { "access-control-allow-origin": "https://soltani.org", "access-control-allow-headers": "Range, If-None-Match" } },
  });
  assert.deepEqual((await checkCdnPack(m, 432, { fetchImpl: listed.fn, wait: noWait })).problems, [], "Range listed by name passes");
  const refused = fakeFetch(new Map([[url, p.data]]), { headers: () => cors, preflight: { status: 403 } });
  assert.ok((await checkCdnPack(m, 432, { fetchImpl: refused.fn, wait: noWait })).problems.some((l) => /preflight .*answered 403/.test(l)));
  const noRange = fakeFetch(new Map([[url, p.data]]), {
    headers: () => cors,
    preflight: { status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD", "access-control-allow-headers": "If-None-Match" } },
  });
  assert.ok((await checkCdnPack(m, 432, { fetchImpl: noRange.fn, wait: noWait })).problems.some((l) => /does not allow the Range header/.test(l)));
  const noCors = fakeFetch(new Map([[url, p.data]]), { headers: () => cors, preflight: { status: 200, headers: { "access-control-allow-headers": "*" } } });
  assert.ok((await checkCdnPack(m, 432, { fetchImpl: noCors.fn, wait: noWait })).problems.some((l) => /preflight access-control-allow-origin/.test(l)));
  // The header the check reads back parses.
  assert.ok(parsePackHeader(p.data.subarray(0, p.header)));
});

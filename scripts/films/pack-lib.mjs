/**
 * pack-lib.mjs - the film pack builder's logic (scripts/films/pack.mjs and the placeholder generator). The format
 * itself (layout, order, writer, reader) is components/film/loader/pack-format.mjs, the one copy the page and the film
 * worker read too; this file adds what only Node needs: the move's end from the timeline, the content-hash name,
 * downloading frames, byte-for-byte verification, the manifest's `packs` entry and the CDN check.
 *
 * Network functions take `fetchImpl` so the tests run on synthetic frames; nothing here uploads anything.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PackBytes, buildPack, packOrder, parsePackHeader, packHintProblem } from "../../components/film/loader/pack-format.mjs";

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The renderer's timeline (reel.ts reads the same file): each rack film's move end (`segment`) and tail. */
export const TIMELINE_FILE = path.join(REPO, "components/film/rack.timeline.json");
/** At most this many frame downloads in flight (the film CDN is shared with visitors: stay polite). */
export const MAX_CONCURRENCY = 12;
export const DEFAULT_CONCURRENCY = 8;
/** Attempts per request for a network error or a 408/429/5xx answer. */
export const ATTEMPTS = 4;
/** A pack's name in the CDN layout: the first 8 hex of the file's sha256 (the CDN caches it as immutable). */
export const PACK_NAME_PATTERN = /^pack-[0-9a-f]{8}\.bin$/;

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** pack-<8 hex of the sha256 of the file>.bin */
export function packFileName(data) {
  return `pack-${sha256(data).slice(0, 8)}.bin`;
}

export async function readTimeline(file = TIMELINE_FILE) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/**
 * The move's end M for a film directory, by reel.ts's rule (segmentOf): the timeline's `segment` for the film both
 * cameras share (the portrait directory `<film>-p` plays `<film>`'s timeline), else the manifest's last frame index
 * (the tower: no timeline entry, no tail). Frames after M are the breathing tail.
 */
export function moveEndOf(manifest, timeline) {
  const name = String(manifest.name).replace(/-p$/, "");
  const t = timeline?.films?.find((f) => f.name === name);
  const last = manifest.count - 1;
  return t && Number.isInteger(t.segment) ? Math.min(t.segment, last) : last;
}

/** RIFF....WEBP */
export function isWebp(bytes) {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

/** Frame `i` (0-based) of `width` relative to the film's base: `<width>/f_NNNN.<ext>` (filmBase frameUrl). */
export function frameRelPath(m, width, i) {
  return `${width}/f_${String(i + 1).padStart(m.pad, "0")}.${m.ext}`;
}

/** The pack's path in an output tree that mirrors the CDN: <out><base's path>/<width>/<file>. */
export function packOutPath(out, m, width, file) {
  const u = new URL(m.base);
  return path.join(out, ...u.pathname.split("/").filter(Boolean), String(width), file);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status) => status === 408 || status === 429 || status >= 500;

/** fetch with retries on a network error or a 408/429/5xx; any other answer is returned as it is. */
export async function fetchRetry(url, init, { fetchImpl = fetch, attempts = ATTEMPTS, wait = sleep } = {}) {
  let last;
  for (let k = 0; k < attempts; k++) {
    if (k) await wait(500 * 2 ** (k - 1));
    try {
      const res = await fetchImpl(url, init);
      if (!retryable(res.status) || k === attempts - 1) return res;
      last = new Error(`${url}: HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(`${url}: ${String(last)}`);
}

/**
 * Download every frame of `width` from the manifest's base, `concurrency` at a time (capped at MAX_CONCURRENCY).
 * Fails on a missing frame, a non-WebP body or a frame count other than the manifest's. Returns frame bytes in order.
 */
export async function fetchFrames(m, width, { fetchImpl = fetch, concurrency = DEFAULT_CONCURRENCY, wait, onFrame } = {}) {
  if (!m.widths.includes(width)) throw new Error(`${m.name}: no width ${width} (widths ${m.widths.join(", ")})`);
  if (m.ext !== "webp") throw new Error(`${m.name}: ext ${m.ext}, packs hold webp frames`);
  const n = m.count;
  const frames = new Array(n);
  let next = 0;
  const lanes = Math.max(1, Math.min(MAX_CONCURRENCY, concurrency, n));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < n) {
        const i = next++;
        const url = `${m.base}/${frameRelPath(m, width, i)}`;
        const res = await fetchRetry(url, {}, { fetchImpl, wait });
        if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!isWebp(bytes)) throw new Error(`${url}: not a WebP file (${bytes.length} bytes)`);
        frames[i] = bytes;
        onFrame?.(i);
      }
    }),
  );
  if (frames.length !== n || frames.some((f) => !f)) throw new Error(`${m.name}/${width}: ${frames.filter(Boolean).length} of ${n} frames`);
  return frames;
}

/** Build a film's pack at one width from its frames: the format's buildPack plus the content-hash name. */
export function buildFilmPack(frames, moveEnd) {
  const p = buildPack(frames, moveEnd);
  return { ...p, file: packFileName(p.data) };
}

/** The manifest's `packs[width]` entry for a built pack. */
export function packEntry(p) {
  return { file: p.file, bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd };
}

const equalBytes = (a, b) => a.length === b.length && Buffer.from(a.buffer, a.byteOffset, a.length).equals(Buffer.from(b.buffer, b.byteOffset, b.length));

/**
 * Prove a pack against its source frames, reading it back two ways: the table (every slice byte-identical to its
 * frame, the order design B gives for `moveEnd`, the skeleton end where that order's skeleton ends) and the runtime's
 * streaming cutter (PackBytes fed in `chunk`-byte pieces yields every frame). `file`, when given, must be the
 * content-hash name. Returns the problems found (empty = verified).
 */
export function verifyPack(data, frames, moveEnd, { file, chunk = 65536 } = {}) {
  const problems = [];
  const h = parsePackHeader(data);
  if (!h) return ["pack: shorter than its header"];
  if ("error" in h) return [h.error];
  if (h.count !== frames.length) problems.push(`pack holds ${h.count} frames, the source ${frames.length}`);
  if (h.bytes !== data.length) problems.push(`header says ${h.bytes} bytes, the file is ${data.length}`);
  const o = packOrder(frames.length, moveEnd);
  if (h.slots.length !== o.order.length || h.slots.some((s, i) => s.index !== o.order[i])) problems.push("file order is not hold, skeleton, rest, tail");
  const skeletonSlots = o.hold + o.skeleton;
  const want = skeletonSlots > 0 && h.slots[skeletonSlots - 1] ? h.slots[skeletonSlots - 1].offset + h.slots[skeletonSlots - 1].length : h.header;
  if (h.skeletonEnd !== want) problems.push(`skeleton ends at ${h.skeletonEnd}, the order says ${want}`);
  for (const s of h.slots) {
    const f = frames[s.index];
    if (!f) continue;
    if (!equalBytes(data.subarray(s.offset, s.offset + s.length), f)) problems.push(`frame ${s.index} differs from its source file`);
  }
  const store = new PackBytes();
  for (let at = 0; at < data.length; at += chunk) {
    const r = store.write(at, data.subarray(at, Math.min(data.length, at + chunk)));
    if (r.error) {
      problems.push(`streaming read: ${r.error}`);
      break;
    }
  }
  if (!store.error) {
    for (let i = 0; i < frames.length; i++) {
      const got = store.frame(i);
      if (!got || !equalBytes(got, frames[i])) {
        problems.push(`streaming read: frame ${i} ${got ? "differs" : "missing"}`);
        break;
      }
    }
    if (store.repeatedBytes || store.gapBytes) problems.push(`streaming read: ${store.repeatedBytes} repeated, ${store.gapBytes} gap bytes`);
  }
  if (file !== undefined && file !== packFileName(data)) problems.push(`named ${file}, its content hash names it ${packFileName(data)}`);
  return problems;
}

/**
 * The byte layout of a pack, from its own header and the order for `moveEnd`: each part's [start, end) and size,
 * frames per part. For reports.
 */
export function describePack(data, moveEnd) {
  const h = parsePackHeader(data);
  if (!h || "error" in h) throw new Error(h ? h.error : "pack: shorter than its header");
  const o = packOrder(h.count, moveEnd);
  const end = (slots) => (slots > 0 ? h.slots[slots - 1].offset + h.slots[slots - 1].length : h.header);
  const a = o.hold;
  const b = a + o.skeleton;
  const c = b + o.rest;
  const part = (name, start, stop, frames, list) => ({ name, start, end: stop, bytes: stop - start, frames, list });
  const idx = (from, to) => h.slots.slice(from, to).map((s) => s.index);
  return [
    part("fixed header", 0, 24, 0, []),
    part("table", 24, h.header, 0, []),
    part("hold frames", h.header, end(a), o.hold, idx(0, a)),
    part("skeleton", end(a), end(b), o.skeleton, idx(a, b)),
    part("rest of the move", end(b), end(c), o.rest, idx(b, c)),
    part("tail", end(c), h.bytes, o.tail, idx(c, h.count)),
  ];
}

/**
 * The manifest text with `packs[width] = entry` set (other widths kept, widths in ascending order). The rest of the
 * text is kept byte for byte (build-film.sh writes `"aspect": 0.4620`, which a JSON round trip would rewrite), with
 * `packs` as the last member.
 */
export function withPackEntry(text, width, entry) {
  const m = JSON.parse(text);
  const packs = { ...(m.packs ?? {}), [String(width)]: entry };
  const sorted = Object.fromEntries(Object.entries(packs).sort((x, y) => Number(x[0]) - Number(y[0])));
  const want = { ...m, packs: sorted };
  delete want.packs;
  want.packs = sorted;
  const body = text.replace(/\s+$/, "");
  const keys = Object.keys(m);
  let head;
  if (m.packs !== undefined && keys[keys.length - 1] === "packs") {
    const at = body.search(/,\s*"packs"\s*:\s*\{[\s\S]*\}\s*\}$/);
    head = at >= 0 ? body.slice(0, at) : null;
  } else if (m.packs === undefined) {
    head = body.slice(0, body.lastIndexOf("}")).replace(/\s+$/, "");
  } else head = null;
  if (head !== null) {
    const out = `${head},\n  "packs": ${JSON.stringify(sorted, null, 2).replace(/\n/g, "\n  ")}\n}\n`;
    try {
      if (JSON.stringify(JSON.parse(out)) === JSON.stringify(want)) return out;
    } catch {
      // fall through to a plain rewrite
    }
  }
  return JSON.stringify(want, null, 2) + "\n";
}

/** Write a pack into its directory (atomically) and remove any other pack-*.bin there (an older build). */
export async function writePackFile(dest, data) {
  const dir = path.dirname(dest);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, dest);
  const removed = [];
  for (const f of await fs.readdir(dir)) {
    if (f !== path.basename(dest) && /^pack-.*\.bin$/.test(f)) {
      await fs.rm(path.join(dir, f), { force: true });
      removed.push(f);
    }
  }
  return removed;
}

/** The pack files in a directory (pack-*.bin). */
export async function packFilesIn(dir) {
  return (await fs.readdir(dir).catch(() => [])).filter((f) => /^pack-.*\.bin$/.test(f)).sort();
}

/**
 * Check a pack the manifest names, as the page will read it from the CDN: a HEAD (status, size, content type, CORS),
 * a Range read of its header (206 with a readable Content-Range, the header parses, agrees with the manifest's entry
 * and frame count) and of its last bytes. `full` also downloads it whole and checks its content hash against its name.
 * Returns { problems, notes }.
 */
export async function checkCdnPack(m, width, { fetchImpl = fetch, origin = "https://soltani.org", full = false, wait } = {}) {
  const problems = [];
  const notes = [];
  const entry = m.packs?.[String(width)];
  if (!entry) return { problems: [`${m.name}/${width}: the manifest names no pack`], notes };
  const url = `${m.base}/${width}/${entry.file}`;
  const opts = { fetchImpl, wait };
  const head = await fetchRetry(url, { method: "HEAD", headers: { Origin: origin } }, opts);
  if (head.status !== 200) return { problems: [`${url}: HEAD ${head.status}`], notes };
  const len = Number(head.headers.get("content-length"));
  if (len !== entry.bytes) problems.push(`${url}: content-length ${head.headers.get("content-length")}, the manifest says ${entry.bytes}`);
  const type = head.headers.get("content-type") ?? "";
  if (type !== "application/octet-stream") problems.push(`${url}: content-type "${type}", expected application/octet-stream`);
  const acao = head.headers.get("access-control-allow-origin");
  if (acao !== "*" && acao !== origin) problems.push(`${url}: access-control-allow-origin "${acao}"`);
  notes.push(`cache-control: ${head.headers.get("cache-control") ?? "(none)"}`);
  if (!/immutable/.test(head.headers.get("cache-control") ?? "")) notes.push("not cached as immutable");

  const ranged = async (range) => {
    const res = await fetchRetry(url, { headers: { Origin: origin, Range: `bytes=${range}` } }, opts);
    const body = new Uint8Array(await res.arrayBuffer());
    return { res, body };
  };
  const first = await ranged(`0-${entry.header - 1}`);
  if (first.res.status !== 206) problems.push(`${url}: Range 0-${entry.header - 1} answered ${first.res.status}`);
  const cr = first.res.headers.get("content-range");
  if (cr !== `bytes 0-${entry.header - 1}/${entry.bytes}`) problems.push(`${url}: content-range "${cr}"`);
  const expose = (first.res.headers.get("access-control-expose-headers") ?? "").toLowerCase();
  if (!expose.split(/\s*,\s*/).includes("content-range")) problems.push(`${url}: content-range not exposed to the page (access-control-expose-headers "${expose}")`);
  if (first.body.length !== entry.header) problems.push(`${url}: header read gave ${first.body.length} bytes, expected ${entry.header}`);
  else {
    const h = parsePackHeader(first.body);
    if (!h || "error" in h) problems.push(`${url}: header does not parse (${h ? h.error : "short"})`);
    else {
      if (h.count !== m.count) problems.push(`${url}: holds ${h.count} frames, the manifest says ${m.count}`);
      const p = packHintProblem(h, entry);
      if (p) problems.push(`${url}: ${p}`);
    }
  }
  const tail = await ranged(`${entry.bytes - 16}-`);
  if (tail.res.status !== 206 || tail.body.length !== 16) problems.push(`${url}: Range ${entry.bytes - 16}- answered ${tail.res.status} with ${tail.body.length} bytes`);
  if (full) {
    const res = await fetchRetry(url, { headers: { Origin: origin } }, opts);
    const data = new Uint8Array(await res.arrayBuffer());
    if (packFileName(data) !== entry.file) problems.push(`${url}: content hash names it ${packFileName(data)}`);
  }
  return { problems, notes };
}

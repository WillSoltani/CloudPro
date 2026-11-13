#!/usr/bin/env node
// LAB ONLY: serves built packs from a local output tree (default films-src/packs under the repository root, the tree
// `npm run film:pack` writes by default) on 127.0.0.1, with the film CDN's behaviour for them: Access-Control-Allow-Origin: *,
// Access-Control-Expose-Headers (Content-Range, Content-Length, ETag, Accept-Ranges), Accept-Ranges, a 206 with a
// Content-Range on a Range request, a strong ETag, `immutable`, and a one hour preflight. Only
// /films/<name>/<width>/pack-<8 hex>.bin is served; everything else is 404.
//
// Use: start it, then open the page with `?packorigin=http://127.0.0.1:<port>` (honoured only on a localhost page, see
// components/film/loader/select.ts packOriginFromQuery): the frames stay on the CDN, the packs come from here. Never
// uploads anything and never listens on another address than 127.0.0.1.
//
//   node scripts/films/pack-serve.mjs [--root <dir>] [--port 3008] [--log <file>]
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The default --root: the builder's own default output tree (scripts/films/pack.mjs --out), films-src/packs under the repository root. */
export const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "films-src", "packs");

/** Answers one request for `data`: the CDN's headers, Range as 206, a 416 past the end. Pure of any server state. */
export function answer(method, headers, data, etag) {
  const out = {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Range, Content-Length, ETag, Accept-Ranges",
      "Timing-Allow-Origin": "*",
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      ETag: etag,
    },
    body: data,
  };
  if (headers["if-none-match"] === etag) return { ...out, status: 304, body: null };
  const m = /^bytes=(\d+)-(\d*)$/.exec(headers.range ?? "");
  if (m) {
    const start = Number(m[1]);
    const end = m[2] ? Math.min(data.length - 1, Number(m[2])) : data.length - 1;
    if (start >= data.length || end < start) {
      out.status = 416;
      out.headers["Content-Range"] = `bytes */${data.length}`;
      out.body = null;
      return out;
    }
    out.status = 206;
    out.headers["Content-Range"] = `bytes ${start}-${end}/${data.length}`;
    out.headers["Content-Length"] = String(end - start + 1);
    out.body = method === "HEAD" ? null : data.subarray(start, end + 1);
    return out;
  }
  out.headers["Content-Length"] = String(data.length);
  if (method === "HEAD") out.body = null;
  return out;
}

export function startPackServer({ root, port, log }) {
  const cache = new Map();
  const load = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    const abs = path.join(root, rel);
    const data = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
    const v = data && { data, etag: `"${crypto.createHash("sha256").update(data).digest("hex").slice(0, 16)}"` };
    cache.set(rel, v);
    return v;
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const rec = { t: Date.now(), m: req.method, p: url.pathname, r: req.headers.range ?? null, status: 0, bytes: 0 };
    res.on("close", () => {
      rec.aborted = !res.writableFinished;
      log?.write(JSON.stringify(rec) + "\n");
    });
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Range, Content-Length, ETag, Accept-Ranges" };
    if (req.method === "OPTIONS") {
      res.writeHead((rec.status = 204), {
        ...cors,
        "Access-Control-Allow-Headers": "Range",
        "Access-Control-Allow-Methods": "GET, HEAD",
        "Access-Control-Max-Age": "3600",
      });
      return res.end();
    }
    const m = /^\/films\/([\w-]+)\/(\d+)\/(pack-[0-9a-f]{8}\.bin)$/.exec(url.pathname);
    const file = m && (req.method === "GET" || req.method === "HEAD") ? load(`films/${m[1]}/${m[2]}/${m[3]}`) : null;
    if (!file) {
      res.writeHead((rec.status = 404), cors);
      return res.end();
    }
    const a = answer(req.method, req.headers, file.data, file.etag);
    rec.status = a.status;
    rec.bytes = a.body ? a.body.length : 0;
    res.writeHead(a.status, a.headers);
    res.end(a.body);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
  const root = path.resolve(opt("--root", DEFAULT_ROOT));
  const port = Number(opt("--port", "3008"));
  const logFile = opt("--log", null);
  await startPackServer({ root, port, log: logFile ? fs.createWriteStream(logFile, { flags: "a" }) : null });
  console.log(`pack server on 127.0.0.1:${port}, root ${root}`);
}

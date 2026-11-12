#!/usr/bin/env node
/**
 * scrub-quality.mjs - the film lab gate: how well the home page's scroll film keeps up with a steady scroll.
 *
 * It drives one steady, time-based scroll pass through the home page per device profile (and, with --back, the
 * same pass back up) and prints one table of what the visitor would get: how many frames were requested, how
 * often the canvas showed the exact frame the scroll wanted, how long it stayed behind, how much memory the
 * decoded frames took, how smooth the browser's own frames were. The film engine's counters
 * (window.__filmStats, components/film/filmStats.ts) are read after the pass; the network and the frame clock
 * are sampled here. Nothing in the page is changed and no thresholds are enforced unless --assert is given.
 *
 *   npm run film:quality -- [options]            (a production server must be running on --base)
 *
 *   --base <url>          page to measure (default http://127.0.0.1:3006)
 *   --profiles a,b,c      desktop, iphone, slowphone (default: all three)
 *   --speed <px/s>        scroll speed for every profile (default: 900 desktop, 600 iphone and slowphone)
 *   --back                after the pass down, wait, then scroll back up at the same speed; its numbers are
 *                         reported separately (the "back" rows)
 *   --cap <requests>      hard cap on requests per profile: every request past it is aborted
 *   --allow-remote        needed, together with --cap, to measure a base that is not localhost / 127.0.0.1
 *   --json <file>         also write the numbers as JSON
 *   --assert <file>       check the numbers against thresholds (see below); exit 1 when one is missed
 *   --headed              show the browser
 *
 * Profiles
 *   desktop    Chromium 1440x900, device pixel ratio 2, 900 px/s
 *   iphone     WebKit, Playwright device "iPhone 14", 600 px/s
 *   slowphone  Chromium 390x844 mobile, DPR 3, touch, CPU 4x slower, network 9 Mbit/s down / 1.5 up / 165 ms
 *              latency (CDP emulation), 600 px/s
 *
 * Thresholds (--assert file.json): { "<profile>|*": { "<path>": { "min": n, "max": n } } } where <path> is a
 * dot path into a profile's result in the JSON output, for example "pass.exactShare" or "back.requests"
 * ("*" applies to every profile). A missing value fails. None are enforced by default yet.
 *
 * What is measured, per leg ("load" = before the first scroll, "pass" = the pass down plus 3 s of tail, and with
 * --back one more second of rest before the return leg, "back" = the pass up plus 3 s of tail). A leg's network and
 * engine figures are closed at the same moment and the next leg starts from a reset of both. Network figures are
 * Playwright's request events (WebKit answers a repeat load from its memory cache without one, so "engine
 * requests", the page's own count of frames asked for, sits beside them); "film frames" are requests for <film>/<width>/f_NNNN.<ext>; MB is 10^6 bytes of
 * response bodies. Counter figures come from window.__filmStats, reset right before each pass:
 *   exact %          share of canvas paints that showed the effective target (the target frame, or where the
 *                    engine never loads it by design, e.g. an odd tail frame on a phone, the nearest frame it does)
 *   stale %          share of clock ticks after which the canvas did not show the effective target
 *   stale max ms     longest continuous stale stretch (time from its first stale tick until the target shows)
 *   mean dist        mean distance in frames from the painted frame to the effective target over ALL paints
 *                    (an exact paint counts 0)
 *   alive peak / MB  most decoded frames held at once / their estimated size (width x height x 4 bytes)
 *   settle ms        time from the scroll stopping until the canvas shows the effective target (null: over 10 s)
 *   meas/s           calls of the engine's measure() per second of scrolling (each is a batch of layout reads)
 *   frame ms         the browser's own requestAnimationFrame intervals during the scroll (median, p95, max)
 *   >33 ms           count of those intervals longer than 33.4 ms
 *
 * LOCAL ONLY by default. A page on any host but localhost / 127.0.0.1 / [::1] is refused unless both --cap and
 * --allow-remote are given. A locally served page loading frames from the film CDN is fine.
 */
import { chromium, webkit, devices } from "@playwright/test";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = require("@playwright/test/package.json").version;

// ---- options ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { base: "http://127.0.0.1:3006", profiles: null, speed: null, back: false, cap: 0, allowRemote: false, json: null, assert: null, headed: false };
  const need = (i, name) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) fail(`scrub-quality: ${name} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") o.base = need(i++, a);
    else if (a === "--profiles") o.profiles = need(i++, a).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--speed") o.speed = Number(need(i++, a));
    else if (a === "--back") o.back = true;
    else if (a === "--cap") o.cap = Number(need(i++, a));
    else if (a === "--allow-remote") o.allowRemote = true;
    else if (a === "--json") o.json = need(i++, a);
    else if (a === "--assert") o.assert = need(i++, a);
    else if (a === "--headed") o.headed = true;
    else if (a === "--help" || a === "-h") {
      console.log("see the comment at the top of scripts/films/scrub-quality.mjs");
      process.exit(0);
    } else fail(`scrub-quality: unknown option ${a}`);
  }
  if (o.speed !== null && !(o.speed > 0)) fail("scrub-quality: --speed must be a positive number");
  if (!Number.isFinite(o.cap) || o.cap < 0) fail("scrub-quality: --cap must be a number of requests");
  return o;
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

const opts = parseArgs(process.argv.slice(2));
const BASE = opts.base.replace(/\/+$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);
if (!isLocal && !(opts.allowRemote && opts.cap > 0)) {
  fail(
    `scrub-quality: refusing to measure ${BASE}: it is not localhost or 127.0.0.1.\n` +
      "  A scroll pass makes about a thousand requests. Measure a local production build, or pass BOTH\n" +
      "  --allow-remote and --cap <requests> (every request past the cap is aborted).",
  );
}

const PROFILES = {
  desktop: { engine: "chromium", context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, speed: 900, label: "Chromium" },
  iphone: { engine: "webkit", context: { ...devices["iPhone 14"] }, speed: 600, label: 'WebKit, device "iPhone 14"' },
  slowphone: {
    engine: "chromium",
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices["Pixel 7"].userAgent },
    speed: 600,
    // 9 Mbit/s down, 1.5 up, 165 ms latency, CPU 4x slower.
    throttle: { cpu: 4, latency: 165, down: 9e6 / 8, up: 1.5e6 / 8 },
    label: "Chromium mobile (touch), CPU 4x slower, 9 Mbit/s down, 1.5 up, 165 ms",
  },
};
const wanted = opts.profiles ?? Object.keys(PROFILES);
for (const p of wanted) if (!PROFILES[p]) fail(`scrub-quality: unknown profile "${p}" (desktop, iphone, slowphone)`);

const PRE_SCROLL_IDLE_MS = 5000; // the page at rest before the first scroll
const TAIL_MS = 3000; // after the film shows the target frame: late requests still count to the leg
const SETTLE_LIMIT_MS = 10_000;
const SCROLL_LIMIT_MS = 300_000;
const FRAME_RE = /\/\d+\/f_\d+\.(webp|avif|jpe?g|png)$/i;

// ---- in the page -----------------------------------------------------------------------------------------

/** Runs in the page: scroll steadily, then watch for the exact frame. The counters were reset by the caller just before (runLeg). */
async function pagePass({ dir, speed, limitMs, settleLimitMs }) {
  const root = document.documentElement;
  const maxY = () => root.scrollHeight - window.innerHeight;
  if (!window.__filmStats || !window.__filmStatsReset) throw new Error("window.__filmStats is missing: not the film home page, or a build without the counters");
  const startedAt = performance.now();
  let last = startedAt;
  let y = window.scrollY;
  const dts = [];
  let first = true;
  const endedAt = await new Promise((resolve) => {
    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (first) first = false; // the first interval spans the evaluate call, not a frame
      else dts.push(dt);
      y = Math.min(maxY(), Math.max(0, y + (dir * speed * dt) / 1000));
      window.scrollTo({ top: y, behavior: "instant" });
      const done = dir > 0 ? y >= maxY() - 1 : y <= 1;
      if (done || now - startedAt > limitMs) resolve({ now, complete: done });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const atEnd = { ...window.__filmStats };
  // The scroll has stopped: how long until the canvas shows the effective target (three frames in a row)? On target:
  // the painted frame is as far from the target as the effective frame is (filmStats onTarget).
  let streak = 0;
  let streakStart = 0;
  let settleMs = null;
  await new Promise((resolve) => {
    const look = (now) => {
      const s = window.__filmStats;
      const reach = Math.abs((s.effectiveFrame ?? s.targetFrame) - s.targetFrame);
      if (s.paintedSeg === s.targetSeg && s.paintedFrame >= 0 && Math.abs(s.paintedFrame - s.targetFrame) === reach) {
        if (streak++ === 0) streakStart = now;
        if (streak >= 3) {
          settleMs = streakStart - endedAt.now;
          return resolve();
        }
      } else streak = 0;
      if (now - endedAt.now > settleLimitMs) return resolve();
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  return { startedAt, endedAt: endedAt.now, complete: endedAt.complete, y: Math.round(y), dts, atEnd, settleMs: settleMs === null ? null : Math.max(0, Math.round(settleMs)) };
}

// ---- helpers ---------------------------------------------------------------------------------------------

const sorted = (a) => [...a].sort((x, y) => x - y);
const quantile = (a, p) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const round = (n, d = 1) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);
const pct = (part, whole) => (whole > 0 ? (100 * part) / whole : 0);

/** Network figures of one leg, filled while the leg runs. */
const newLeg = () => ({ requests: 0, aborted: 0, abortedFrames: 0, filmFrames: 0, bytes: 0, filmBytes: 0, netRefetches: 0, errors: [], failedResponses: 0 });

async function bodyBytes(req) {
  try {
    const sizes = await req.sizes();
    if (sizes.responseBodySize > 0) return sizes.responseBodySize;
  } catch {
    // fall through to the header
  }
  try {
    const res = await req.response();
    const len = res ? Number((await res.allHeaders())["content-length"] ?? 0) : 0;
    return Number.isFinite(len) ? len : 0;
  } catch {
    return 0;
  }
}

const launched = {};
async function browserFor(kind) {
  launched[kind] ??= await (kind === "webkit" ? webkit : chromium).launch({ headless: !opts.headed });
  return launched[kind];
}

// ---- one profile -----------------------------------------------------------------------------------------

async function measureProfile(name) {
  const prof = PROFILES[name];
  const speed = opts.speed ?? prof.speed;
  const browser = await browserFor(prof.engine);
  const ctx = await browser.newContext(prof.context);
  // "between" collects the few events that fall between closing one leg and opening the next; it is not reported.
  const legs = { load: newLeg(), pass: newLeg(), back: newLeg(), between: newLeg() };
  let phase = "load";
  const seenFrames = new Set();
  const legOf = new WeakMap();
  const sizeJobs = [];
  let requestsSeen = 0;
  let capped = false;

  if (opts.cap > 0) {
    await ctx.route("**/*", (route) => {
      if (++requestsSeen > opts.cap) {
        capped = true;
        legs[phase].aborted++;
        if (FRAME_RE.test(new URL(route.request().url()).pathname)) legs[phase].abortedFrames++;
        return route.abort();
      }
      return route.continue();
    });
  }
  await ctx.addInitScript(() => {
    window.__lab = { long: [], longSupported: false };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lab.long.push([e.startTime, e.duration]);
      }).observe({ type: "longtask", buffered: true });
      window.__lab.longSupported = true;
    } catch {
      // WebKit has no long task entries.
    }
  });
  const page = await ctx.newPage();

  page.on("request", (req) => {
    const leg = legs[phase];
    legOf.set(req, leg);
    leg.requests++;
    const path = new URL(req.url()).pathname;
    if (FRAME_RE.test(path)) {
      leg.filmFrames++;
      const key = req.url();
      if (seenFrames.has(key)) leg.netRefetches++;
      seenFrames.add(key);
    }
  });
  page.on("requestfinished", (req) => {
    const leg = legOf.get(req);
    if (!leg) return;
    const isFrame = FRAME_RE.test(new URL(req.url()).pathname);
    sizeJobs.push(
      bodyBytes(req).then((b) => {
        leg.bytes += b;
        if (isFrame) leg.filmBytes += b;
      }),
    );
  });
  page.on("response", (res) => {
    if (res.status() >= 400) legs[phase].failedResponses++;
  });
  page.on("console", (m) => {
    if (m.type() === "error") legs[phase].errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => legs[phase].errors.push(`pageerror: ${String(e).slice(0, 200)}`));

  if (prof.throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: prof.throttle.latency, downloadThroughput: prof.throttle.down, uploadThroughput: prof.throttle.up });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: prof.throttle.cpu });
  }

  const response = await page.goto(BASE + "/", { waitUntil: "load", timeout: 180_000 });
  const status = response?.status() ?? 0;
  await page.waitForFunction(() => !!window.__filmStats && document.querySelector("canvas[data-segment]")?.dataset.frame !== undefined, null, { timeout: 120_000 });
  await page.waitForTimeout(PRE_SCROLL_IDLE_MS);
  const before = await page.evaluate(() => ({
    stats: { ...window.__filmStats },
    height: document.documentElement.scrollHeight,
    viewport: [window.innerWidth, window.innerHeight],
    dpr: window.devicePixelRatio,
    film: document.querySelector("canvas[data-segment]")?.dataset.segment ?? "",
    longSupported: window.__lab.longSupported,
  }));

  /**
   * One leg: reset the engine counters and open the leg's network bucket at the same moment, scroll, wait out the tail
   * (plus `restMs`, a rest before the next leg, which belongs to this leg), then close the network bucket and read the
   * engine counters together, so both describe the same window. The next leg starts from a reset of both.
   */
  async function runLeg(leg, dir, restMs = 0) {
    await page.evaluate(() => {
      if (!window.__filmStats || !window.__filmStatsReset) throw new Error("window.__filmStats is missing: not the film home page, or a build without the counters");
      window.__filmStatsReset();
    });
    phase = leg;
    const pass = await page.evaluate(pagePass, { dir, speed, limitMs: SCROLL_LIMIT_MS, settleLimitMs: SETTLE_LIMIT_MS });
    await page.waitForTimeout(TAIL_MS + restMs);
    phase = "between";
    const after = await page.evaluate(() => ({ stats: { ...window.__filmStats }, long: window.__lab.long.slice(), now: performance.now() }));
    return { pass, after };
  }

  const raw = {};
  raw.pass = await runLeg("pass", 1, opts.back ? 1000 : 0);
  if (opts.back) raw.back = await runLeg("back", -1);
  phase = "done";
  await Promise.all(sizeJobs);
  await ctx.close();

  function leg(key, r) {
    const { pass, after } = r;
    const s = after.stats;
    const n = legs[key];
    const seconds = (pass.endedAt - pass.startedAt) / 1000;
    const long = before.longSupported ? after.long.filter(([t]) => t >= pass.startedAt && t <= after.now) : null;
    const draws = s.draws;
    return {
      complete: pass.complete,
      seconds: round(seconds, 1),
      requests: n.requests - n.aborted,
      aborted: n.aborted,
      filmFrames: n.filmFrames - n.abortedFrames,
      mb: round(n.bytes / 1e6, 2),
      filmMB: round(n.filmBytes / 1e6, 2),
      engineRequests: s.requests,
      refetches: s.refetches,
      netRefetches: n.netRefetches,
      exactShare: round(pct(s.exactDraws, draws), 1),
      staleShare: round(pct(s.staleTicks, s.ticks), 1),
      staleMsMax: Math.round(s.staleMsMax),
      meanFallbackDistance: round(draws ? s.fallbackDistance / draws : 0, 2),
      meanDistancePerFallback: round(s.fallbackDraws ? s.fallbackDistance / s.fallbackDraws : 0, 2),
      framesAlivePeak: s.framesAlivePeak,
      decodedMBPeak: round(s.decodedMBPeak, 1),
      inflightPeak: s.inflightPeak,
      canvasResizes: s.canvasResizes,
      measuresPerSec: round(pass.atEnd.measures / Math.max(seconds, 0.001), 1),
      frameMs: { median: round(quantile(pass.dts, 0.5), 1), p95: round(quantile(pass.dts, 0.95), 1), max: round(pass.dts.length ? Math.max(...pass.dts) : null, 1) },
      framesOver33: pass.dts.filter((d) => d > 33.4).length,
      longTasks: long ? { count: long.length, totalMs: Math.round(long.reduce((a, [, d]) => a + d, 0)), maxMs: Math.round(long.length ? Math.max(...long.map(([, d]) => d)) : 0) } : null,
      consoleErrors: n.errors.length,
      failedResponses: n.failedResponses,
      settleMs: pass.settleMs,
      // the counters behind the shares
      draws,
      exactDraws: s.exactDraws,
      fallbackDraws: s.fallbackDraws,
      ticks: s.ticks,
      staleTicks: s.staleTicks,
      staleMs: Math.round(s.staleMs),
      held: s.held,
      decodes: s.decodes,
      failures: s.failures,
      mode: s.mode,
      errorSamples: n.errors.slice(0, 3),
    };
  }

  const loadLeg = legs.load;
  const result = {
    name,
    label: prof.label,
    speed,
    status,
    capped,
    mode: before.stats.mode,
    film: before.film,
    viewport: before.viewport,
    dpr: before.dpr,
    documentHeight: before.height,
    longTasksSupported: before.longSupported,
    load: {
      requests: loadLeg.requests,
      filmFrames: loadLeg.filmFrames,
      mb: round(loadLeg.bytes / 1e6, 2),
      filmMB: round(loadLeg.filmBytes / 1e6, 2),
      engineRequests: before.stats.requests,
      decodes: before.stats.decodes,
      consoleErrors: loadLeg.errors.length,
    },
    pass: leg("pass", raw.pass),
    ...(raw.back ? { back: leg("back", raw.back) } : {}),
  };
  return result;
}

// ---- table -----------------------------------------------------------------------------------------------

const f = (n, suffix = "") => (n === null || n === undefined ? "n/a" : `${n}${suffix}`);

function rowsFor(results) {
  const rows = [];
  const add = (label, get) => rows.push([label, ...results.map((r) => String(get(r)))]);
  add("scroll speed px/s", (r) => r.speed);
  add("load: requests (all)", (r) => r.load.requests);
  add("load: film frames", (r) => r.load.filmFrames);
  add("load: MB", (r) => r.load.mb);
  add("load: engine requests", (r) => r.load.engineRequests);
  const leg = (key, tag) => {
    const has = (r) => r[key];
    const get = (fn) => (r) => (has(r) ? fn(r[key]) : "-");
    add(`${tag}: seconds scrolling`, get((l) => `${l.seconds}${l.complete ? "" : " (INCOMPLETE)"}`));
    add(`${tag}: requests (all)`, get((l) => l.requests));
    add(`${tag}: film frames`, get((l) => l.filmFrames));
    add(`${tag}: MB`, get((l) => l.mb));
    add(`${tag}: engine requests`, get((l) => l.engineRequests));
    add(`${tag}: refetches`, get((l) => l.refetches));
    add(`${tag}: exact draws %`, get((l) => l.exactShare));
    add(`${tag}: stale ticks %`, get((l) => l.staleShare));
    add(`${tag}: longest stale ms`, get((l) => l.staleMsMax));
    add(`${tag}: settle ms after stop`, get((l) => f(l.settleMs)));
    add(`${tag}: mean fallback dist`, get((l) => l.meanFallbackDistance));
    add(`${tag}: frames alive peak`, get((l) => l.framesAlivePeak));
    add(`${tag}: decoded MB peak`, get((l) => l.decodedMBPeak));
    add(`${tag}: in-flight peak`, get((l) => l.inflightPeak));
    add(`${tag}: canvas resizes`, get((l) => l.canvasResizes));
    add(`${tag}: measures/s`, get((l) => l.measuresPerSec));
    add(`${tag}: frame ms med/p95/max`, get((l) => `${f(l.frameMs.median)}/${f(l.frameMs.p95)}/${f(l.frameMs.max)}`));
    add(`${tag}: frames over 33 ms`, get((l) => l.framesOver33));
    add(`${tag}: long tasks (n, ms)`, get((l) => (l.longTasks ? `${l.longTasks.count}, ${l.longTasks.totalMs}` : "n/a")));
    add(`${tag}: console errors`, get((l) => l.consoleErrors));
  };
  leg("pass", "pass");
  if (results.some((r) => r.back)) leg("back", "back");
  return rows;
}

function printTable(results) {
  const head = ["", ...results.map((r) => r.name)];
  const rows = [head, ...rowsFor(results)];
  const widths = head.map((_, c) => Math.max(...rows.map((row) => row[c].length)));
  const line = (row) => row.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join("  ");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows.slice(1)) console.log(line(row));
}

// ---- thresholds ------------------------------------------------------------------------------------------

function pathValue(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

async function checkThresholds(file, results) {
  const spec = JSON.parse(await fs.readFile(file, "utf8"));
  const problems = [];
  for (const r of results) {
    for (const key of ["*", r.name]) {
      for (const [dotPath, limit] of Object.entries(spec[key] ?? {})) {
        const v = pathValue(r, dotPath);
        if (typeof v !== "number") problems.push(`${r.name}: ${dotPath} is ${v === undefined ? "missing" : String(v)}`);
        else if (limit.max !== undefined && v > limit.max) problems.push(`${r.name}: ${dotPath} ${v} > max ${limit.max}`);
        else if (limit.min !== undefined && v < limit.min) problems.push(`${r.name}: ${dotPath} ${v} < min ${limit.min}`);
      }
    }
  }
  return problems;
}

// ---- main ------------------------------------------------------------------------------------------------

const results = [];
let crashed = false;
try {
  for (const name of wanted) {
    process.stderr.write(`[film:quality] ${name} ...\n`);
    results.push(await measureProfile(name));
  }
} catch (e) {
  crashed = true;
  console.error(`scrub-quality: ${e?.stack ?? e}`);
} finally {
  for (const b of Object.values(launched)) await b.close().catch(() => {});
}

if (results.length) {
  console.log(`\nFilm lab gate: ${BASE}  ·  Playwright ${PLAYWRIGHT_VERSION}  ·  ${new Date().toISOString()}${opts.cap ? `  ·  request cap ${opts.cap}` : ""}`);
  for (const r of results) {
    const extra = [r.capped ? "CAPPED by --cap" : "", r.status !== 200 ? `HTTP ${r.status}` : "", r.mode !== "legacy" ? `mode ${r.mode}` : ""].filter(Boolean).join(", ");
    console.log(`  ${r.name}: ${r.label}; ${r.speed} px/s; viewport ${r.viewport.join("x")} @${r.dpr}x, document ${r.documentHeight} px, loader "${r.mode}"${extra ? `  [${extra}]` : ""}`);
  }
  console.log("");
  printTable(results);
  console.log("\nexact/stale/dist: from window.__filmStats after a reset right before the pass. Network: Playwright request events. MB = 10^6 bytes.");
}

let problems = [];
if (results.length && opts.assert) {
  problems = await checkThresholds(opts.assert, results);
  for (const p of problems) console.log(`ASSERT FAILED: ${p}`);
  if (!problems.length) console.log("All thresholds met.");
}
if (opts.json) {
  await fs.writeFile(opts.json, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, playwright: PLAYWRIGHT_VERSION, options: { back: opts.back, cap: opts.cap, speed: opts.speed }, profiles: Object.fromEntries(results.map((r) => [r.name, r])) }, null, 2) + "\n");
}
process.exit(crashed || problems.length || results.length !== wanted.length ? 1 : 0);

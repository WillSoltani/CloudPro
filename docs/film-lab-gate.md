# Film lab gate

A local and CI gate for the home page's scroll film, so every change to how the frames load is measured.
It does not change what a visitor sees. The manual QA it complements is `.claude/agents/scroll-qa.md`.

## Pieces

| What | Where |
| --- | --- |
| Placeholder frames (tiny, each carries its film id and frame index in its pixels) | `scripts/films/placeholder.mjs`, drawing in `scripts/films/placeholder-layout.mjs` |
| Playwright config (production build on `127.0.0.1:3006`, own build dir `.next-film`) | `playwright.config.ts` |
| Spec helpers (`readPaintedFrame` reads the film and frame back from the canvas, hooks and pixels in one `page.evaluate`) | `e2e/film-frames.ts` |
| Specs on placeholder frames | `e2e/film-smoke.spec.ts`, `film-stats.spec.ts`, `film-backing.spec.ts`, `film-reel.spec.ts`, `film-viewports.spec.ts`, `film-reduced-motion.spec.ts` |
| Scroll-pass measurement (the lab gate script) | `scripts/films/scrub-quality.mjs` (`npm run film:quality`) |
| Engine counters (`window.__filmStats`, `window.__filmStatsReset()`) and their pure helpers | `components/film/filmStats.ts`, unit tests `components/film/filmStats.test.ts` |
| `?hud=1` overlay with the counters | `components/film/FilmHud.tsx` (mounted by `FilmBackdrop`, renders nothing without the flag) |
| Counter spec | `e2e/film-stats.spec.ts` |
| Canvas backing size (`backingSize`, `growCap`, `?backing=full`) and its unit tests | `components/film/backing.ts`, `backing.test.ts`; spec `e2e/film-backing.spec.ts` |
| Frame loader interface and the legacy loader, its unit tests | `components/film/loader/types.ts`, `legacy.ts`, `legacy.test.ts` (see "The frame loader") |
| Rules every loader shares (usable frames, network class), their unit tests | `components/film/loader/usable.ts`, `network.ts`, `shared.test.ts` |
| The budget loader's pure planner and byte arithmetic (not wired yet), their unit tests | `components/film/loader/budget-plan.ts`, `budget-bytes.ts`, `budget-plan.test.ts`, `budget-bytes.test.ts` |
| CI job | `film` in `.github/workflows/ci.yml` ("Film specs (placeholder frames)") |

## Commands

```
npm run film:placeholder      # write the stand-ins under public/films (a second run does nothing)
npm run test:film             # Playwright, chromium, placeholder frames
npm run test:film-unit        # node:test, the counters' and the backing size's pure helpers, the legacy loader, the gate script's leg buckets
npm run test:film:safari      # PW_WEBKIT=1, webkit project
FILM_FRAMES=cdn npm run test:film   # build without NEXT_PUBLIC_FILM_BASE: real frames from the film CDN
node scripts/films/placeholder.mjs --clean   # remove what the generator wrote
```

`npm run film:quality -- <options>` runs `scripts/films/scrub-quality.mjs` against a server you started (see "Scroll-pass
gate" below and the "Lab gate" section of `docs/cinematic-homepage.md`, which also holds the targets).

## Placeholder frames

The generator needs `sharp`, which is deliberately not a declared dependency: declared, its Linux binaries would
install in production too and `next/image` would start using it. Next carries it as an optional dependency, which is
enough on a Mac. CI runs `npm install --no-save sharp@0.34.5` first; do the same on a machine where
`npm run film:placeholder` cannot load sharp.

- One file per frame and width at the real pixel size, lossless WebP, a few hundred bytes each.
  Every film in `public/films/*/manifest.json` is covered: frames, the poster the manifest names. The hold
  keys are `/images/reel/*.webp` (committed stills), so there is nothing to generate for them.
- A row of 18 cells centred on the reel's focus point `(0.5, 0.45)` (`FilmBackdrop` `REEL_FOCUS`): a white guard,
  the film id (4 bits, its place in the sorted list of films), the 0-based frame index (12 bits), a black guard.
  The cover fit keeps that point at the same share of the canvas at any crop, so the row is always on the canvas.
  Four seven-segment digits below it show the 1-based frame number for the eye.
- `public/films/<name>/.placeholder.json` marks a directory the script wrote (signature of the manifest and the
  layout, hash of the first frame per width). A directory with frames and no marker, or whose first frames no
  longer match it, holds real frames: the script stops and writes nothing unless `--force`. Everything but
  `manifest.json` under `public/films` is gitignored.
- The page is built with `NEXT_PUBLIC_FILM_BASE=/films`, so frames and posters are served from `public/films`.
  If the production server was started earlier in another mode (placeholders or `FILM_FRAMES=cdn`), stop it:
  locally `reuseExistingServer` keeps it.

## The frame loader

Which frames exist in memory is decided by a frame loader behind one interface, `FrameLoader` in
`components/film/loader/types.ts`; `FilmBackdrop` keeps the clock, the draw call, the hold keys, the chrome and the
registration. The one loader today is the legacy loader, `components/film/loader/legacy.ts` (`createLegacyLoader`: one
request and one main-thread decode per frame, 6 in flight, nearest-first ranking, eviction of segments more than one away
except frames 0, M and last), with unit tests in `components/film/loader/legacy.test.ts` (fake Image, run by
`npm run test:film-unit`). `FilmBackdrop` picks the loader in one place in its effect, `const loader = createLegacyLoader(...)`;
that is where another loader is selected (a later stage adds a `?loader=...` flag there). A loader reports through the
narrow `LoaderStats` hook (requests with refetches, decodes, failures, in flight, frames alive and their bytes; for a loader
that reserves decodes and keeps compressed bytes also decode start and end, bytes held, its budget and a change of name),
turned into `window.__filmStats` by the one adapter `loaderStatsFor` in `filmStats.ts`, so the counters keep the same
meaning whichever loader runs, and `mode` names it (`"legacy"`; it may change at run time). The interface also carries a
width-change signal (`onWidth`: a slow-network retier; the canvas backing cap follows it), page visibility and
online/offline (`visibility`, `network`; the legacy loader ignores both), and the rules no loader re-implements: the usable
frames (`isUsable`, `usable.ts`) and the network class (Save-Data, slow connection, the timed hero frames: `network.ts`).
`FilmBackdrop` reuses one `WantPlan` object between ticks; a loader never keeps a reference to it.

The budget loader (stage 4) is planned by `budget-plan.ts` (`createBudgetPlanner`: the wanted set within a decoded-byte
budget, the fetch order, eviction, the compressed-byte cap, retries; no DOM, fetch or worker; its header says how a loader
drives it) with the byte rules in `budget-bytes.ts` (`pickFrameBudgetBytes`, `?budget=<MB>`, frames per tier). It is not
wired into `FilmBackdrop` yet.

## Counters

`components/film/FilmBackdrop.tsx` keeps `window.__filmStats` (type `FilmStats` in `components/film/filmStats.ts`)
up to date where it already does the work; it only writes the object, never reads it back, so the film behaves
exactly as without it. `mode` is `"legacy"` for this loader. The budget loader's counters (redecodes, worker and
main-thread decodes with their mean ms, decodes in flight and their peak, compressed bytes held and their peak, the budget)
are 0 under the legacy loader. Counters (requests, refetches, decodes, failures,
draws split into exact and fallback paints with their summed distance, ticks, stale ticks, stale ms and the
longest stale stretch, held paints, canvas resizes, measures) grow until `window.__filmStatsReset()`; gauges
(in flight, frames alive, decoded MB, target, effective and painted segment and frame, tier width, canvas backing
width and height `backingW` / `backingH`) always describe
now, and a reset restarts the peaks from them. A refetch is a request for a film, width and index already
requested in this page load.

Draws and staleness are scored against the **effective target**, not the raw one. `targetFrame` is the frame the
clock wants; `effectiveFrame` is the frame the engine can show for it. They differ only where the engine never
loads the target frame by design: on a coarse pointer it requests only the even frames of a breathing tail, and
under reduced motion only the stills. The rule comes from the engine itself (the loader's `usable`, the
predicate its `rank()` requests by), applied by `aimAt` in `filmStats.ts`. A paint is exact, and the canvas is on
target, when the painted frame is the target or, for a target the engine never loads, a usable frame nearest to it
(an odd tail frame on a phone: either even neighbour). `effectiveFrame` names the lower one on such a tie, the one
draw() prefers; the rule is "as far from `targetFrame` as `effectiveFrame` is". `fallbackDistance` is the distance
to the nearest effective frame. Stale means the canvas does not show the effective target of the target segment
after a clock tick; a stretch ends at the tick, or the paint between ticks, that shows it again.

Open the home page with `?hud=1` to see two lines of them, refreshed four times a second. The first line reads
`f<painted>/<target>`, followed by `eff <effective>` when the two targets differ, the tier width and `canvas <w>x<h>`
(the backing store, see below).

## Canvas backing size

The canvas backing store is `backingSize(CSS width, CSS height, dpr, cap)` (`components/film/backing.ts`): device pixels with
the DPR capped at 2, never wider than `cap`, the aspect of the CSS box kept. `cap` is the widest frame tier in use on this
page load, the maximum `width` over the segments that have joined (each picks its tier when it joins). The cap only grows
during a page load: a later, wider tier may enlarge the canvas once, a slow-network retier to a smaller tier never shrinks
it. Before any segment has joined the widest width the reel offers for this orientation stands in, so the first paint is
never undersized; in practice the canvas is allocated once, at load, after the segments register (`canvasResizes` counts real
reallocations only, and the specs allow at most 2 after a load and a short scroll). `tier()`, `draw()`'s cover fit, the hold
keys and the overlays do not read the backing size.

A 1440x900 laptop at DPR 2 gets 1920x1200 instead of 2880x1800; a 390x844 phone gets 432x935 (a 432 wide portrait tier) instead
of 780x1688. For an A/B on a real phone open the page with **`?backing=full`**: that page load uses the old rule
(round(CSS size x DPR capped at 2), no width cap). The flag is read once, when the engine starts, and the HUD line shows which
size is in use.

## The specs

Where a spec compares the pixels with `data-frame`, both come from one `page.evaluate` (`readPaintedFrame`): `draw()` writes the pixels and the
hooks in one synchronous block, so one synchronous read sees one paint. Two evaluates let a repaint land between them.

All run on placeholder frames and have no timing thresholds: they scroll in half-viewport steps and wait for the film to come
to rest (the canvas shows the effective target, or any frame of the target segment once nothing is in flight and nothing
changes) before they look.

| Spec | What it checks |
| --- | --- |
| `film-smoke` | page 200, canvas paints, pixels name the frame, no 4xx/5xx, no console errors |
| `film-stats` | the counters exist, move with a scroll and add up; reset zeroes counters and keeps gauges; HUD only with `?hud=1` |
| `film-reel` | a full one-way pass at 390x844 (touch, portrait films) and 1440x900: every film of the reel is painted, the frame read back from the canvas pixels equals `data-frame`, refetches 0, no 4xx/5xx, no console errors; then back up, where the refetches are only recorded (printed and added to the test annotations), not asserted yet |
| `film-backing` | 1440x900 at DPR 2 and 390x844 at DPR 3: the canvas is at most the widest tier in use (and at most 1920), keeps the box aspect within a pixel, is allocated at most twice after load and a short scroll, the gauges equal the canvas size and the painted frame read from the pixels equals `data-frame`; with `?backing=full` it is the old size |
| `film-viewports` | 390x844, 360x740, 320x568, 844x390, 1440x900: the page loads, the canvas paints, the backing store is sized to the box (not the 300x150 default), no horizontal scroll bar at the top or at the end |
| `film-reduced-motion` | with reduced motion the canvas paints stills (5 frames per film at most) and the page scrolls to its end |

## Scroll-pass gate

`scripts/films/scrub-quality.mjs` measures how well the film keeps up with a steady scroll. It needs a production server on
`--base` (default `http://127.0.0.1:3006`) and refuses anything that is not localhost or 127.0.0.1 unless `--cap` and
`--allow-remote` are both given. It is not part of CI yet and enforces no thresholds unless `--assert` is given. Each leg's network and engine figures are closed together and reset together (with `--back`, the pass leg includes the 1 s rest
before the return leg). Columns, options,
the plan's targets and the same baseline: "Lab gate" in `docs/cinematic-homepage.md`.

```
npm run film:quality -- --profiles desktop,iphone,slowphone --back --json out.json
```

With `FILM_FRAMES=cdn` the Playwright build goes to `.next-film-cdn` (real frames from the film CDN), so it never overwrites the
placeholder build in `.next-film`.

## Baseline

**Baseline** (the numbers later stages are compared with). Date 2026-11-12, engine at commit `c01c36aa` (the gate adds counters
only), loader: legacy. Machine: Apple M1 laptop, macOS 26.5, Node 20.20.2, Playwright 1.62.1, Chromium 151.0.7922.34, WebKit 26.5.
Real frames from the film CDN, local production build (`NEXT_DIST_DIR=.next-film-cdn`, no `NEXT_PUBLIC_FILM_BASE`) on
127.0.0.1:3006, no other build or test running at the time. Three runs in a row of
`npm run film:quality -- --profiles desktop,iphone,slowphone --back --json <file>`; each cell is the **median of the three
runs** and, in brackets, the min to max when the runs differ (a single value: all three runs agreed). Network figures are
Playwright request events for the leg (the scroll plus 3 s, and with `--back` the pass leg also includes the 1 s rest before the
return leg); "film frames" are `f_NNNN.webp` requests; the return leg's "engine requests" are the page's own count.

What the lab cannot show: the CDN is close to this machine, only the slow-phone profile is throttled (CPU 4x, 9 Mbit/s), and real
phones differ, so the delivery shortfall seen live shows here as stale time and fallback paints, not as a wall.

| | desktop | iphone | slowphone |
| --- | ---: | ---: | ---: |
| before the first scroll: requests (all / film frames / MB) | 80 / 58 / 2.21 | 80 / 58 / 1.03 | 80 / 58 / 1.05 |
| pass down: requests (all / film frames / MB) | 1397 / 1384 / 26.4 | 1301 / 1288 / 7.41 | 1078 (1056 to 1081) / 1065 (1043 to 1068) / 6.6 (6.46 to 6.6) |
| refetches | 0 | 0 | 0 |
| exact draws % | 97.8 (97.2 to 98.6) | 100 | 72.4 (60.6 to 75.8) |
| stale ticks % | 2.2 (1.7 to 2.7) | 0.3 (0.2 to 0.3) | 33.1 (32.8 to 37.2) |
| longest stale stretch ms | 122 (100 to 207) | 35 (31 to 35) | 672 (536 to 929) |
| mean fallback distance (frames) | 0.02 (0.01 to 0.03) | 0 | 0.43 (0.41 to 0.58) |
| frames alive peak | 534 (534 to 564) | 611 | 346 (335 to 353) |
| decoded MB peak | 4429 (4429 to 4678) | 988 | 560 (542 to 571) |
| in-flight peak | 6 | 6 | 6 |
| canvas resizes | 0 | 0 | 0 |
| frames over 33 ms | 68 (40 to 79) | 1 (0 to 2) | 89 (60 to 102) |
| **return leg**: engine requests | 992 | 896 | 1020 (1018 to 1022) |
| return leg: refetches | 992 | 896 | 795 (777 to 800) |
| return leg: exact draws % | 100 | 100 | 100 |
| return leg: stale ticks % | 0 | 0 | 0 |
| return leg: longest stale stretch ms | 0 | 0 | 0 |
| return leg: decoded MB peak | 5068 | 988 | 947 |

Read it as a lab picture, not a verdict. Single runs differ by the machine's load and the CDN's edge cache (slowphone exact draws
60.6 to 75.8 %, longest stale stretch 536 to 929 ms), so compare a later stage against the median and range of several runs, not
one. WebKit answers a repeat load of a frame from its memory cache without a request event, so on the iphone return leg the
Playwright request count is 0 and the page's own "engine requests" (896) is the one to read. What the table shows: the unthrottled
profiles keep up (desktop 97.8 % exact, iphone 100 %), the slow phone does not (about a third of the ticks stale, longest stretch
672 ms); nothing caps memory (the decoded frames held are an estimate by width x height x 4: 4.4 to 5.1 GB on desktop, about 1 GB
on the iphone profile and 0.6 to 0.9 GB on the slow phone); a pass makes 1,000 to 1,400 requests; and the way back refetches
nearly every frame it asks for (an engine that evicts what the visitor just saw).

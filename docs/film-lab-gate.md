# Film lab gate

A local and CI gate for the home page's scroll film, so every change to how the frames load is measured.
It does not change what a visitor sees. The manual QA it complements is `.claude/agents/scroll-qa.md`.

## Pieces

| What | Where |
| --- | --- |
| Placeholder frames (tiny, each carries its film id and frame index in its pixels) | `scripts/films/placeholder.mjs`, drawing in `scripts/films/placeholder-layout.mjs` |
| Playwright config (production build on `127.0.0.1:3006`, own build dir `.next-film`) | `playwright.config.ts` |
| Spec helpers (`readPaintedFrame` reads the film and frame back from the canvas, hooks and pixels in one `page.evaluate`) | `e2e/film-frames.ts` |
| Specs on placeholder frames | `e2e/film-smoke.spec.ts`, `film-stats.spec.ts`, `film-backing.spec.ts`, `film-reel.spec.ts`, `film-viewports.spec.ts`, `film-reduced-motion.spec.ts`, `film-memory.spec.ts`, `film-fallback.spec.ts` |
| Scroll-pass measurement (the lab gate script) and the page URL it builds from `--query` | `scripts/films/scrub-quality.mjs` (`npm run film:quality`), `scripts/films/page-url.mjs` |
| Engine counters (`window.__filmStats`, `window.__filmStatsReset()`) and their pure helpers | `components/film/filmStats.ts`, unit tests `components/film/filmStats.test.ts` |
| `?hud=1` overlay with the counters | `components/film/FilmHud.tsx` (mounted by `FilmBackdrop`, renders nothing without the flag) |
| Counter spec | `e2e/film-stats.spec.ts` |
| Canvas backing size (`backingSize`, `growCap`, `?backing=full`) and its unit tests | `components/film/backing.ts`, `backing.test.ts`; spec `e2e/film-backing.spec.ts` |
| Frame loader interface and the legacy loader, its unit tests | `components/film/loader/types.ts`, `legacy.ts`, `legacy.test.ts` (see "The frame loader") |
| Rules every loader shares (usable frames, network class), their unit tests | `components/film/loader/usable.ts`, `network.ts`, `shared.test.ts` |
| The budget loader's pure planner and byte arithmetic, their unit tests | `components/film/loader/budget-plan.ts`, `budget-bytes.ts`, `budget-plan.test.ts`, `budget-bytes.test.ts` |
| The budget loader (the default), its film worker and frame store, the message protocol, the loader choice; unit tests with a fake worker and fetch | `components/film/loader/budget.ts`, `frame-worker.js` (+ `frame-worker.d.ts`), `frame-worker-protocol.ts`, `select.ts`; `budget.test.ts` |
| CI job | `film` in `.github/workflows/ci.yml` ("Film specs (placeholder frames)") |

## Commands

```
npm run film:placeholder      # write the stand-ins under public/films (a second run does nothing)
npm run test:film             # Playwright, chromium, placeholder frames
npm run test:film-unit        # node:test, the counters' and the backing size's pure helpers, both loaders and the planner, the gate script's leg buckets and page URL
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
registration. Two loaders implement it:

- the **budget loader** (the default), `components/film/loader/budget.ts`: see "The budget loader" below;
- the **legacy loader**, `components/film/loader/legacy.ts` (`createLegacyLoader`: one request and one main-thread decode
  per frame, 6 in flight, nearest-first ranking, eviction of segments more than one away except frames 0, M and last), with
  unit tests in `components/film/loader/legacy.test.ts` (fake Image). It is unchanged and stays selectable.

`FilmBackdrop` picks the loader once per page load, in its effect: the constant `DEFAULT_LOADER` (`"budget"`) unless the
URL says **`?loader=legacy`**, **`?loader=budget`** or **`?loader=budget-main`** (the budget loader decoding on the main
thread from the start). The page falls back on its own (`select.ts` `runnableLoader`): without `Worker` it runs
`budget-main`, without `fetch`, `Blob` or `createImageBitmap` the legacy loader. **`?budget=<MB>`** (MiB, 8 to 4096) forces the
budget loader's decoded-frame budget for the page load, so a desktop browser can run with a phone's figure. A loader reports through the
narrow `LoaderStats` hook (requests with refetches, decodes, failures, in flight, frames alive and their bytes; for a loader
that reserves decodes and keeps compressed bytes also decode start and end, bytes held, its budget and a change of name),
turned into `window.__filmStats` by the one adapter `loaderStatsFor` in `filmStats.ts`, so the counters keep the same
meaning whichever loader runs, and `mode` names it (`"legacy"`; it may change at run time). The interface also carries a
width-change signal (`onWidth`: a slow-network retier; the canvas backing cap follows it), page visibility and
online/offline (`visibility`, `network`; the legacy loader ignores both), and the rules no loader re-implements: the usable
frames (`isUsable`, `usable.ts`) and the network class (Save-Data, slow connection, the timed hero frames: `network.ts`).
`FilmBackdrop` reuses one `WantPlan` object between ticks; a loader never keeps a reference to it.

## The budget loader

`createBudgetLoader` (`components/film/loader/budget.ts`) keeps three stores per segment and tier:

1. **Compressed bytes**, fetched once and kept (capped at 48 MB on a small budget, 160 MB otherwise; the films farthest from
   the active one give theirs up first, never the active segment's or its neighbours', never any frame 0, M or last). A frame
   that leaves the decoded store keeps its bytes, so scrolling back costs a decode, never a request.
2. **Decoded frames** (ImageBitmaps) inside a byte budget: `pickFrameBudgetBytes` (with `navigator.deviceMemory`
   min(512, max(96, memory x 48)) MiB, else 160 MiB on a window narrower than 1024 px or portrait and 384 MiB otherwise), or
   `?budget=`. The wanted set uses 80 % of it; a decode reserves its frame's bytes (width x height x 4) when it starts.
3. **The plan**, `budget-plan.ts` (`createBudgetPlanner`; its header says how the loader drives it): rebuilt on each clock
   tick, it says which frames are wanted (the active segment's 0, M and last and each neighbour's entry frame; a window of
   usable frames around the target, most of it ahead in the direction of travel, coarse first; the head of the next segment
   with what remains), in what order bytes are fetched (target, M, last, 0, then strides 16/8/4/2/1 ahead first, then the
   neighbour ahead, then the one behind; farther segments 0, M and last), and which decoded frames to let go (outside the
   wanted set, farthest first). The idle gate, Save-Data, reduced motion, tails and the slow-network retier keep the legacy
   loader's rules (`usable.ts`, `network.ts`).

**Where the work runs.** Fetches and decodes run in the film worker, `components/film/loader/frame-worker.js`: it fetches a
frame's bytes (CORS, no credentials, so the canvas stays readable), keeps them, decodes them with `createImageBitmap` when asked
and transfers the bitmap; at most 6 fetches (3 on a slow network or with Save-Data) and 2 decodes (3 on a budget of 256 MiB or
more) at once, never aborting a fetch that has started. Without `navigator.connection` the worker times the first hero
frames' fetches and the page decides "slow" from them, as the legacy loader does from resource timing. The worker is **plain
JavaScript with no imports on purpose**: the same file also runs on the page when a worker cannot (below), and the loader's
authors found Next 16.1's production build copying it to `/_next/static/media/frame-worker.<hash>.js`. Measured in the 2026-11-13
build (Next 16.1.6): that copy is emitted, but the browser starts a `blob:` worker whose script `importScripts` hashed chunks
under `/_next/static/chunks/` that hold the compiled store, so no stable URL names the worker's code. The specs that need the
worker to fail therefore replace `window.Worker` (`e2e/film-fallback.spec.ts`) instead of refusing a URL. The same
file exports `createFrameStore`, which the page runs itself when a worker cannot: if the worker fails to start, lacks
`createImageBitmap`, errors or does not answer within 10 s, its jobs are cancelled (no try spent), the bytes it held are
forgotten and fetched again (they count as refetches), decoded frames stay, and `mode` becomes `"budget-main"`.

**Lifetimes.** Every job carries its segment's epoch (a new one on join and on a retier): a fetch or decode that lands after its
segment left or changed tier, or after `dispose`, is closed and never kept. Every ImageBitmap that leaves the store is
`close()`d and reported. A failed fetch is retried after 400 ms and 800 ms (3 tries), a 404 at once given up; a missing frame is
covered by its neighbours. Hidden page: nothing new starts. Offline: no fetch starts; back online, frames given up get fresh
tries.

**`data-loaded` under the budget loader means "decoded frames held"** for the segment, bounded by the budget: it rises and
falls as the window moves and never reaches the film's count on a phone. Checks that wait for `data-loaded === count` run with
`?loader=legacy`, or wait for the canvas to come to rest on the target instead (`e2e/film-frames.ts` `settle`).

## Counters

`components/film/FilmBackdrop.tsx` keeps `window.__filmStats` (type `FilmStats` in `components/film/filmStats.ts`)
up to date where it already does the work; it only writes the object, never reads it back, so the film behaves
exactly as without it. `mode` is the loader running now: `"budget"`, `"budget-main"` (it may switch to that at run time) or
`"legacy"`. Under the budget loader `requests` are network fetches of frame bytes, `refetches` fetches of a frame (film,
width, index) whose bytes were fetched before (0 while the bytes are kept), `decodes` frames decoded and kept, `redecodes`
decodes of a frame decoded before (from kept bytes, no request), and `framesAlive` / `decodedMB` count the ImageBitmaps held,
reserved decodes included, so `decodedMBPeak` never passes `budgetMB`. The budget loader's own counters (redecodes, worker and
main-thread decodes with their mean ms, decodes in flight and their peak, compressed bytes held and their peak, the budget)
are 0 under the legacy loader. `budgetMB` is in 10^6 bytes like every MB here, while the budget is set in MiB: a 160 MiB phone
budget reads 167.8. Counters (requests, refetches, decodes, failures,
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
changes) before they look. The reel, stats, backing, viewports and reduced-motion specs run once per loader (`LOADERS` in
`e2e/film-frames.ts`: the default, whose `mode` must be `"budget"`, so the worker was emitted by the build and runs in that
browser, and `?loader=legacy`), the frame read back from the canvas pixels compared with `data-frame` for both.

| Spec | What it checks |
| --- | --- |
| `film-smoke` | page 200, canvas paints, pixels name the frame, no 4xx/5xx, no console errors |
| `film-stats` | the counters exist, move with a scroll and add up; reset zeroes counters and keeps gauges; HUD only with `?hud=1` |
| `film-reel` | a full one-way pass at 390x844 (touch, portrait films) and 1440x900: every film of the reel is painted, the frame read back from the canvas pixels equals `data-frame`, refetches 0, no 4xx/5xx, no console errors; then back up: budget loader, refetches 0 and decoded MB within the budget; legacy, the refetches are only recorded (printed and added to the test annotations) |
| `film-backing` | 1440x900 at DPR 2 and 390x844 at DPR 3: the canvas is at most the widest tier in use (and at most 1920), keeps the box aspect within a pixel, is allocated at most twice after load and a short scroll, the gauges equal the canvas size and the painted frame read from the pixels equals `data-frame`; with `?backing=full` it is the old size |
| `film-viewports` | 390x844, 360x740, 320x568, 844x390, 1440x900: the page loads, the canvas paints, the backing store is sized to the box (not the 300x150 default), no horizontal scroll bar at the top or at the end |
| `film-reduced-motion` | with reduced motion the canvas paints stills (5 frames per film at most) and the page scrolls to its end |
| `film-memory` | budget loader, 390x844 touch and 1440x900: a walk down the whole page and back up, twice (a stop every viewport height, each settled). After every leg decoded MB peak and the decoded MB held are within `budgetMB`, the compressed bytes peak is within the cap for that budget (48 MiB on a phone budget, 160 MiB otherwise), nothing failed and nothing was fetched twice; the two legs up make 0 frame requests and decode again (redecodes > 0), and so does the second leg down (0 requests); every film is painted. With `?budget=96` the film plays to the end (down and up, every stop settled, pixels equal `data-frame`) inside the 96 MiB budget |
| `film-fallback` | with `Worker` removed by an init script the film plays frame for frame in mode `"budget-main"` (main-thread decodes, no worker decodes); with `Worker` and `createImageBitmap` removed it plays with the legacy loader (mode `"legacy"`); with a worker that throws at start the loader switches to `"budget-main"` at run time and the film plays on. Each walks the whole page down; no console errors (the broken worker's own error excepted) |

## Scroll-pass gate

`scripts/films/scrub-quality.mjs` measures how well the film keeps up with a steady scroll. It needs a production server on
`--base` (default `http://127.0.0.1:3006`) and refuses anything that is not localhost or 127.0.0.1 unless `--cap` and
`--allow-remote` are both given. It is not part of CI yet and enforces no thresholds unless `--assert` is given. Each leg's network and engine figures are closed together and reset together (with `--back`, the pass leg includes the 1 s rest
before the return leg). Columns, options,
the plan's targets and the same baseline: "Lab gate" in `docs/cinematic-homepage.md`.

```
npm run film:quality -- --profiles desktop,iphone,slowphone --back --json out.json
```

**Choosing the loader and the budget in the gate.** `--query "<a=b&c=d>"` is appended to the page URL (after `?`) for every profile,
and `--query-desktop`, `--query-iphone`, `--query-slowphone` set it for one profile (replacing `--query` for that profile). The
loader and budget flags are page parameters, so an A/B is two runs that differ only in the query:

```
npm run film:quality -- --back --query "loader=legacy" --json legacy.json
npm run film:quality -- --back --query "loader=budget" --query-iphone "loader=budget&budget=160" --query-slowphone "loader=budget&budget=160" --json budget.json
```

The lab browsers report a desktop-sized `navigator.deviceMemory` (headless Chromium, 512 MiB budget) and the iphone profile's
WebKit has none and a narrow window (160 MiB), so `budget=160` is how the slowphone profile gets a phone's figure. The table has, per
leg, the budget loader's counters beside the existing columns: redecodes, compressed bytes held (peak), the budget in MB,
decodes in flight (peak), decodes by worker / on the main thread, the mean decode time, and the loader running at the end of
the leg (`loader at end`; it can differ from the start if the worker failed). The same figures are in the JSON (`redecodes`,
`bytesHeldMBPeak`, `budgetMB`, `decodeInFlightPeak`, `workerDecodes`, `mainThreadDecodes`, `decodeMsMean`, `mode`), and
`query` is recorded per profile. The existing columns and their meaning are unchanged. A frame fetched by the budget loader is
a page-initiated `fetch` from the worker, so Playwright's request events for the Chromium profiles still see it; in WebKit each
`createImageBitmap(Blob)` also shows as a `blob:` request event, so read "film frames" and "engine requests" there, not
"requests (all)".

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

## Stage 4 on placeholder frames

The real-frame A/B (three alternating runs, verdict per line) is in "Stage 4: budget loader" under "Lab gate" in `docs/cinematic-homepage.md`.

The budget loader against the legacy one, one run each of
`npm run film:quality -- --profiles desktop,iphone,slowphone --back` on **placeholder frames** (`.next-film`, 127.0.0.1:3006),
2026-11-13, commit of the budget loader (legacy measured with `DEFAULT_LOADER` flipped locally, not committed). Placeholder
frames are a few hundred bytes, so this shows memory, request counts and the way back, not delivery on a real network; compare
with the real-frame baseline above only for those. Read cells as budget / legacy.

| | desktop | iphone | slowphone |
| --- | ---: | ---: | ---: |
| pass: film frame requests | 1384 / 1384 | 1288 / 1288 | 1183 / 1170 |
| pass: exact draws % | 100 / 99.9 | 100 / 100 | 86.4 / 85.1 |
| pass: stale ticks % | 0 / 0.8 | 0 / 0.1 | 27.4 / 28.6 |
| pass: longest stale ms | 0 / 49 | 0 / 22 | 550 / 549 |
| pass: frames alive peak | 64 / 611 | 103 / 611 | 332 / 394 |
| pass: decoded MB peak | 530.8 / 5067.9 | 166.6 / 987.5 | 536.9 / 637.3 |
| back: engine requests | 0 / 992 | 0 / 896 | 105 / 966 |
| back: refetches | 0 / 992 | 0 / 896 | 0 / 848 |
| back: exact draws % | 100 / 100 | 100 / 100 | 100 / 95.5 |
| back: longest stale ms | 0 / 0 | 0 / 0 | 0 / 635 |

Reading it:

- The budget each profile ran with: desktop and slowphone 536.9 MB (512 MiB: headless Chromium reports a large
  `navigator.deviceMemory`), iphone 167.8 MB (160 MiB: WebKit has no `deviceMemory` and the window is narrow). The slowphone
  profile therefore does not test the phone budget; open the page with `?budget=160` for that (the gate script has no way to
  pass a query yet).
- The slow phone's 105 requests on the way back are first fetches of frames the pass moved past before they came, not
  refetches.
- WebKit reports each `createImageBitmap(Blob)` as a `blob:` request event, so the gate's "requests (all)" column on the iphone
  profile counts about one extra event per decode under the budget loader (pass 2625, back 1243); the film-frame and engine
  columns are the network.
- Long tasks: the desktop return leg showed 0.3 to 2.7 s of long tasks in some runs with either loader (legacy 0 to 3.3 s
  over three runs, budget 0.35 to 2.7 s over three runs), with the page's own scripts a small share of a CPU profile; it is
  not specific to either loader and not investigated further here.

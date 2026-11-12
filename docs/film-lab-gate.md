# Film lab gate

A local and CI gate for the home page's scroll film, so every change to how the frames load is measured.
It does not change what a visitor sees. The manual QA it complements is `.claude/agents/scroll-qa.md`.

## Pieces

| What | Where |
| --- | --- |
| Placeholder frames (tiny, each carries its film id and frame index in its pixels) | `scripts/films/placeholder.mjs`, drawing in `scripts/films/placeholder-layout.mjs` |
| Playwright config (production build on `127.0.0.1:3006`, own build dir `.next-film`) | `playwright.config.ts` |
| Spec helpers (`readPaintedFrame` reads the film and frame back from the canvas, hooks and pixels in one `page.evaluate`) | `e2e/film-frames.ts` |
| Specs on placeholder frames | `e2e/film-smoke.spec.ts`, `film-stats.spec.ts`, `film-reel.spec.ts`, `film-viewports.spec.ts`, `film-reduced-motion.spec.ts` |
| Scroll-pass measurement (the lab gate script) | `scripts/films/scrub-quality.mjs` (`npm run film:quality`) |
| Engine counters (`window.__filmStats`, `window.__filmStatsReset()`) and their pure helpers | `components/film/filmStats.ts`, unit tests `components/film/filmStats.test.ts` |
| `?hud=1` overlay with the counters | `components/film/FilmHud.tsx` (mounted by `FilmBackdrop`, renders nothing without the flag) |
| Counter spec | `e2e/film-stats.spec.ts` |
| CI job | `film` in `.github/workflows/ci.yml` ("Film specs (placeholder frames)") |

## Commands

```
npm run film:placeholder      # write the stand-ins under public/films (a second run does nothing)
npm run test:film             # Playwright, chromium, placeholder frames
npm run test:film-unit        # node:test, the counters' pure helpers
npm run test:film:safari      # PW_WEBKIT=1, webkit project
FILM_FRAMES=cdn npm run test:film   # build without NEXT_PUBLIC_FILM_BASE: real frames from the film CDN
node scripts/films/placeholder.mjs --clean   # remove what the generator wrote
```

`npm run film:quality -- <options>` runs `scripts/films/scrub-quality.mjs` against a server you started (see "Scroll-pass
gate" below and the "Lab gate" section of `docs/cinematic-homepage.md`, which also holds the baseline and the targets).

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

## Counters

`components/film/FilmBackdrop.tsx` keeps `window.__filmStats` (type `FilmStats` in `components/film/filmStats.ts`)
up to date where it already does the work; it only writes the object, never reads it back, so the film behaves
exactly as without it. `mode` is `"legacy"` for this loader. Counters (requests, refetches, decodes, failures,
draws split into exact and fallback paints with their summed distance, ticks, stale ticks, stale ms and the
longest stale stretch, held paints, canvas resizes, measures) grow until `window.__filmStatsReset()`; gauges
(in flight, frames alive, decoded MB, target, effective and painted segment and frame, tier width) always describe
now, and a reset restarts the peaks from them. A refetch is a request for a film, width and index already
requested in this page load.

Draws and staleness are scored against the **effective target**, not the raw one. `targetFrame` is the frame the
clock wants; `effectiveFrame` is the frame the engine can show for it. They differ only where the engine never
loads the target frame by design: on a coarse pointer it requests only the even frames of a breathing tail, and
under reduced motion only the stills. The rule comes from the engine itself (`usable` in `FilmBackdrop`, the
predicate `rank()` requests by), applied by `aimAt` in `filmStats.ts`. A paint is exact, and the canvas is on
target, when the painted frame is the target or, for a target the engine never loads, a usable frame nearest to it
(an odd tail frame on a phone: either even neighbour). `effectiveFrame` names the lower one on such a tie, the one
draw() prefers; the rule is "as far from `targetFrame` as `effectiveFrame` is". `fallbackDistance` is the distance
to the nearest effective frame. Stale means the canvas does not show the effective target of the target segment
after a clock tick; a stretch ends at the tick, or the paint between ticks, that shows it again.

Open the home page with `?hud=1` to see two lines of them, refreshed four times a second. The first line reads
`f<painted>/<target>`, followed by `eff <effective>` when the two targets differ.

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
| `film-viewports` | 390x844, 360x740, 320x568, 844x390, 1440x900: the page loads, the canvas paints, no horizontal scroll bar at the top or at the end |
| `film-reduced-motion` | with reduced motion the canvas paints stills (5 frames per film at most) and the page scrolls to its end |

## Scroll-pass gate

`scripts/films/scrub-quality.mjs` measures how well the film keeps up with a steady scroll. It needs a production server on
`--base` (default `http://127.0.0.1:3006`) and refuses anything that is not localhost or 127.0.0.1 unless `--cap` and
`--allow-remote` are both given. It is not part of CI yet and enforces no thresholds unless `--assert` is given. Each leg's network and engine figures are closed together and reset together (with `--back`, the pass leg includes the 1 s rest
before the return leg). Columns, options,
the baseline and the plan's targets: "Lab gate" in `docs/cinematic-homepage.md`.

```
npm run film:quality -- --profiles desktop,iphone,slowphone --back --json out.json
```

With `FILM_FRAMES=cdn` the Playwright build goes to `.next-film-cdn` (real frames from the film CDN), so it never overwrites the
placeholder build in `.next-film`.

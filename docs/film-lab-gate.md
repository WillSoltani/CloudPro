# Film lab gate

A local and CI gate for the home page's scroll film, so every change to how the frames load is measured.
It does not change what a visitor sees. The manual QA it complements is `.claude/agents/scroll-qa.md`.

## Pieces

| What | Where |
| --- | --- |
| Placeholder frames (tiny, each carries its film id and frame index in its pixels) | `scripts/films/placeholder.mjs`, drawing in `scripts/films/placeholder-layout.mjs` |
| Playwright config (production build on `127.0.0.1:3006`, own build dir `.next-film`) | `playwright.config.ts` |
| Spec helpers (`readPaintedFrame` reads the film and frame back from the canvas) | `e2e/film-frames.ts` |
| First spec | `e2e/film-smoke.spec.ts` |
| CI job | `film` in `.github/workflows/ci.yml` ("Film specs (placeholder frames)") |

## Commands

```
npm run film:placeholder      # write the stand-ins under public/films (a second run does nothing)
npm run test:film             # Playwright, chromium, placeholder frames
npm run test:film:safari      # PW_WEBKIT=1, webkit project
FILM_FRAMES=cdn npm run test:film   # build without NEXT_PUBLIC_FILM_BASE: real frames from the film CDN
node scripts/films/placeholder.mjs --clean   # remove what the generator wrote
```

`npm run film:quality` runs `scripts/films/scrub-quality.mjs` (the scroll-pass measurement).

## Placeholder frames

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

## Not in the gate yet

The scroll-pass measurements (`scripts/films/scrub-quality.mjs`) and the film specs that judge loading and
memory come in later stages.

---
name: cinematic-scroll
description: Build pear.no-style cinematic scroll sections for soltani.org — an AI-generated film (Higgsfield MCP) cut into WebP frames with ffmpeg and scrubbed by scroll on a sticky canvas, plus dithered WebGL transitions and real-HTML captions. Use when planning, generating, building, wiring, debugging, or tuning a scroll film, frame sequence, or dither/halftone effect.
---

# Cinematic scroll films

## What the effect is
pear.no looks 3D but renders no 3D. One continuous AI-generated shot that morphs scene to scene is exported as ~500 numbered WebP frames; scroll position picks which frame a sticky full-screen `<canvas>` draws. A small WebGL shader adds the dithered "dust" dissolves and halftone clouds. All copy is HTML on top. Reuse the technique — never their imagery, layout copy, or wording.

## Toolkit
| Piece | Where |
|---|---|
| Image + video generation | Higgsfield MCP (`.mcp.json`; OAuth; spends credits) |
| Storyboard → keyframes → clips | `film-director` agent |
| Clips → frames + manifest | `scripts/films/build-film.sh` (ffmpeg + cwebp) |
| Stills / clip QA (metrics, contact sheets, phone crops, ledger) | `scripts/films/film-qa.py` (PIL + numpy + ffmpeg) |
| Frames → CDN | `scripts/films/sync-film.sh` + `CloudPortfolioFilms` stack (`infra/lib/films-stack.ts`) |
| Scroll player (one fixed canvas for the whole page) | `components/film/` — `FilmBackdrop`, `FilmSegment`, `HoldPanel`, `FilmCaption`, `useFilmProgress`; the reel order in `reel.ts` |
| Dither dissolve / halftone | `components/film/DitherVeil.tsx` |
| Browser QA | Playwright MCP + `scroll-qa` agent |
| Visual polish | `frontend-design` skill (plugin) |
| Creative brief + open decisions | `docs/cinematic-homepage.md` |

## Pipeline
1. **Brief** — read `docs/cinematic-homepage.md`; get Will's answers to its open decisions.
2. **Film** — delegate to `film-director`. It stops for approval at storyboard, anchor frame, and keyframe contact sheet; no video before that. Start with 3–4 scenes.
3. **Frames** — `scripts/films/build-film.sh <film> films-src/<film>/clips/*.mp4` → `public/films/<film>/` plus a size report.
4. **Wire** — add the manifest to `components/film/reel.ts` and render its `FilmSegment` inside the page's `FilmBackdrop` (API below). Keep the factual sections (About, Certifications, Skills, Projects, Experience, Contact) as HTML in `HoldPanel`s between segments.
5. **Polish** — typography, grid lines, progress rail, captions (frontend-design skill); transitions with `DitherVeil`.
6. **QA** — run `scroll-qa`, fix, repeat; then `npm run verify`.
7. **Ship** — frames live on S3 + CloudFront (`CloudPortfolioFilms` stack, `infra/lib/films-stack.ts`); `public/films/<film>/` is gitignored and only `manifest.json` is committed (CI guards this). After `build-film.sh` and local QA, run `scripts/films/sync-film.sh <film> --write-manifest`: it uploads the frames under `films/<film>/` with immutable caching (never `--delete`), verifies the CDN, and rewrites only the manifest's `base`/`poster` to the CloudFront URL — no rebuild. A re-cut gets a new film name (`<film>-v2`), never a reused path. Re-run `scroll-qa` against the CDN, then commit the manifest.

## Footage that scrubs well
- Chain clips with first/last-frame conditioning: clip i runs K(i-1) → K(i). The build script drops each duplicated boundary frame, so joins are invisible.
- Prompt the camera move and the transformation ("slow dolly forward; the curtain folds become tree bark"); keep lighting and palette fixed; pass K0 as a style reference for every still.
- Scrubbing exposes artifacts: slow continuous motion, no cuts, no shake, no on-screen text or logos, hands and faces small or still.
- 5–8 s clips at 24 fps ≈ 120–190 frames each; ~100 frames per viewport height of scroll feels right (the default `length`).
- Mobile, best to cheapest: a 9:16 chain passed as `portraitFilm` (2× credits) → `fit="auto"` (letterboxed film on portrait screens, captions in the bands) → crop-safe framing (subject inside the centre ~55% width) with `cover`.

## API
One `position: fixed` canvas paints every film on the page; the films are *segments* of one reel, and the
HTML between them sits on *hold panels* over the held last frame, so the page never cuts to flat base.
```tsx
// components/film/reel.ts — server-safe (app/page.tsx preloads REEL[0].poster from it)
export const REEL = [hero, chapter05].map(resolveFilm);

// components/HomeClient.tsx
import { FilmBackdrop } from "@/components/film/FilmBackdrop";
import { FilmSegment } from "@/components/film/FilmSegment";
import { HoldPanel } from "@/components/film/HoldPanel";
import { FilmCaption } from "@/components/film/FilmCaption";
import { useFilmProgress } from "@/components/film/filmProgress";

<FilmBackdrop reel={REEL} keys={["/images/reel/K4.webp", "/images/reel/K5.webp"]}>
  <FilmSegment film={REEL[0]} id="hero" aria-labelledby="hero-title" length={5} reducedSteps={5}>
    <FilmCaption from={0} to={0.22} persistent className="absolute left-12 top-1/3 max-w-md">
      <h1 id="hero-title" className="font-serif text-6xl">…</h1>
    </FilmCaption>
  </FilmSegment>
  <HoldPanel>
    <AboutSection />
  </HoldPanel>
  <FilmSegment film={REEL[1]} id="chapter-05" aria-label="Chapter 05" length={2} reducedSteps={2}>…</FilmSegment>
  <HoldPanel closing>
    <ContactSection />
  </HoldPanel>
</FilmBackdrop>
```
- `FilmBackdrop`: mount once per page, with no transformed/filtered ancestor (that breaks `fixed`). `reel` — the ordered, `resolveFilm()`-ed manifests (stable; index `i` is segment `i`); `keys?` — the approved still for the hold after each segment, layered over the canvas from the last ~160 px of scroll of segment `i` (the hero: its last 6 %) through the first ~120 px of segment `i + 1` (fixed background layers like the canvas; a still inside a segment's stage would scroll away with it and tear). One crop for the whole reel: cover-fit at `REEL_FOCUS = [0.5, 0.45]`.
  - Reel math: per segment `p_i = clamp(−top_i / (h_i − viewport))`; `r = max(i + p_i)` over segments whose top has reached the viewport top; one spring (140/24, restDelta 0.0005; jumps on the first measure, until 500 ms after load, and on leaps > 1 segment); painted segment `seg = r ≤ 0 ? 0 : min(n − 1, ceil(r) − 1)` at `frac = r − seg`, so a hold paints segment `i`'s last frame; each segment's progress is `clamp(r − i, 0, 1)`.
  - Loading: per segment once within 1.5 viewports, ranked around the target (the target, `last`, `0`, then strides 16/8/4/2/1 nearest-first; re-ranked when a segment becomes active or its target leaps); 6 in flight (3 under Save-Data), active segment first; tier 768/1280/1920 from viewport × DPR (coarse pointers capped at 1280, Save-Data → smallest). Segments more than one index from the active one release decoded frames except 0 and last. Reduced motion: `reducedSteps` stills per segment, no spring.
  - Painting: while the poster, a key or a previous frame is on screen, never a frame farther than max(8, count/32) from the target (8 under the poster); the poster lifts once a frame within 8 has painted; the canvas fades in over 250 ms on its first paint when nothing covers it.
- `FilmSegment`: `film` (a manifest from the reel — the same object), `length` (viewport heights of scroll, svh), `id`, `aria-label`/`aria-labelledby`, `reducedSteps?` (default 5), `children` (overlays in the sticky full-viewport stage; read progress with `useFilmProgress()`). Draws nothing itself. The hero (index 0) carries the SSR poster `<img fetchPriority="high">` (the first paint; not necessarily the LCP element) until a frame within 8 of its target is drawn.
- `HoldPanel`: wraps a run of HTML sections; flat night 85 % (`closing`: 88 % and no bottom feather, for the panel with the footer). Edges feather over 160 px with eased px stops (0/35/70/105/140/160 px → 0/25/55/80/95/100 %): top from the stage's bottom edge (clear on `wide`, solid night below it, where every stage ends on the phone scrim), bottom to clear; the panel adds padding so text stays on the flat tone. Keep sections' `id`s inside it (scroll-spy, anchors).
- `FilmCaption from/to` fades and drifts an HTML block across that window of its segment's progress (stays visible when it starts at 0 or ends at 1). `FilmScrims` gives the phone bottom band and the desktop left band (`leftIn`/`leftFade` windows; feathered at the stage's top and bottom).
- `ScrollFilm` (the old per-section sticky player) is gone: it was a re-export shim during the move and has been deleted. `FilmManifest`, `frameUrl`, `useReducedMotionSafe` live in `filmCore.ts`; `useFilmProgress` in `filmProgress.ts`; `FilmCaption` in `FilmCaption.tsx`.
- `DitherVeil`: `progress` MotionValue 0→1, `color`, optional `image` drawn as 1-bit halftone in `color` (with `progress` held at 1 via `useMotionValue(1)`), `cell` size in px. Falls back to a CSS fade without WebGL. (Not used on the homepage at the moment; kept as toolkit.)
- Test hooks: canvas `data-segment` `data-frame` `data-reel` `data-width`; segment `data-film` `data-count` `data-film-segment` `data-index` `data-loaded`; `[data-hold-panel]`; hold keys `[data-key]`. The homepage's initial `#fragment` jump is instant until `html[data-reel-ready]` (set on load), and an inline boot script in `app/page.tsx` (hash → hold via `HOLD_SECTIONS`, or the hold saved in sessionStorage on reload) adds `style#reel-hold-boot` so the held key is the first paint; the backdrop loads that key before any frame and removes the style.
- Chrome: `useFilmInView` gives `inView` (hero, for the navbar's brand hiding) and `overFilm` (any segment pinned under the chrome): the header stays transparent and ScrollToTop hidden over every segment.

## Budgets
- Poster ≤ 200 KB; LCP < 2.5 s (the poster need not be the LCP element: Chrome discounts it as low-entropy); first scrubbable pass ≤ 2 MB.
- Per film ≤ 25 MB at 1280w and ≤ 12 MB at 768w — if the script's report is over, rebuild with `QUALITY=60` or `FPS=20`, or trim clips.
- Whole reel (every segment at one tier, unique files after a full scroll) ≤ 25 MB at 1280w and ≤ 12 MB at 768w; hold keys ≤ 200 KB each.
- No text baked into frames: captions are HTML for SEO, accessibility, and sharpness.

## Pitfalls
- `build-film.sh` deletes and rewrites `public/films/<film>/` — never hand-edit frames there.
- Frames under `public/films/<film>/` are gitignored; only `manifest.json` is committed, and CI fails if anything else is tracked or a manifest `base` is not `https://`. Flip the base with `sync-film.sh --write-manifest`, not by rebuilding with `BASE_URL`.
- CDN paths are immutable (`max-age=31536000, immutable`): never re-upload changed frames under an existing name — re-cut as `<film>-v2` and point the manifest at it.
- Nano Banana 2k stills are 2752×1536, not 16:9 — crop to an exact 16:9 before using one as a clip reference. `count:2` returns one job id per variant; reference the variant's own id.
- Raw generations live in `films-src/` (gitignored). Download Higgsfield results right away; result links can expire.
- The root layout also serves ChapterFlow hosts (`app/layout.tsx`) — keep changes on the portfolio surface.
- `InteractiveBackground` (particle canvas in the root layout) competes with the film canvas; it is hidden on the homepage (`PortfolioBackground`).
- `PageShell` pads content with `pt-20` for the navbar; a full-bleed film should start at the top of the viewport.

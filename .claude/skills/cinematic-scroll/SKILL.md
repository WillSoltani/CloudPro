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
| Scroll player | `components/film/ScrollFilm.tsx` — `ScrollFilm`, `FilmCaption`, `useFilmProgress` |
| Dither dissolve / halftone | `components/film/DitherVeil.tsx` |
| Browser QA | Playwright MCP + `scroll-qa` agent |
| Visual polish | `frontend-design` skill (plugin) |
| Creative brief + open decisions | `docs/cinematic-homepage.md` |

## Pipeline
1. **Brief** — read `docs/cinematic-homepage.md`; get Will's answers to its open decisions.
2. **Film** — delegate to `film-director`. It stops for approval at storyboard, anchor frame, and keyframe contact sheet; no video before that. Start with 3–4 scenes.
3. **Frames** — `scripts/films/build-film.sh <film> films-src/<film>/clips/*.mp4` → `public/films/<film>/` plus a size report.
4. **Wire** — render `ScrollFilm` with the manifest (API below). Keep the factual sections (About, Certifications, Skills, Projects, Experience, Contact) as HTML after or between films.
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
```tsx
import hero from "@/public/films/hero/manifest.json";
import { useTransform } from "framer-motion";
import { ScrollFilm, FilmCaption, useFilmProgress } from "@/components/film/ScrollFilm";
import { DitherVeil } from "@/components/film/DitherVeil";

<ScrollFilm film={hero} focus={[0.6, 0.5]}>
  <FilmCaption from={0} to={0.22} className="absolute left-12 top-1/3 max-w-md">
    <h1 className="font-serif text-6xl">…</h1>
  </FilmCaption>
  <Veil />
</ScrollFilm>

function Veil() {
  const progress = useFilmProgress();
  const cover = useTransform(progress, [0.85, 1], [0, 1]);
  return <DitherVeil progress={cover} color="#2f5bb7" />;
}
```
- `ScrollFilm`: `film` (manifest — pass a stable object such as the JSON import), `portraitFilm?`, `length?` (viewport heights), `focus?` `[x, y]` crop point 0–1, `fit?` `"cover" | "contain" | "auto"`, `smooth?` (spring, default on), `reducedSteps?`, `className`, `children` (overlays inside the sticky stage).
- Loads coarse-to-fine (every 16th frame first) so it scrubs within ~1 s, starting ~1.5 viewports before it scrolls in; picks 768/1280/1920 from stage size × DPR (phones capped at 1280, Save-Data → smallest). Reduced motion shows `reducedSteps` stills instead of scrubbing.
- `FilmCaption from/to` fades and drifts an HTML block across that progress window (stays visible when it starts at 0 or ends at 1).
- `DitherVeil`: `progress` MotionValue 0→1, `color`, optional `image` drawn as 1-bit halftone in `color` (clouds: cream ink over a blue section, with `progress` held at 1 via `useMotionValue(1)`), `cell` size in px. Falls back to a CSS fade without WebGL.
- Test hooks: section `data-film` `data-count` `data-width`, stage `data-loaded`, canvas `data-frame`.

## Budgets
- Poster (LCP element) ≤ 200 KB; first scrubbable pass ≤ 2 MB.
- Per film ≤ 25 MB at 1280w and ≤ 12 MB at 768w — if the script's report is over, rebuild with `QUALITY=60` or `FPS=20`, or trim clips.
- No text baked into frames: captions are HTML for SEO, accessibility, and sharpness.

## Pitfalls
- `build-film.sh` deletes and rewrites `public/films/<film>/` — never hand-edit frames there.
- Frames under `public/films/<film>/` are gitignored; only `manifest.json` is committed, and CI fails if anything else is tracked or a manifest `base` is not `https://`. Flip the base with `sync-film.sh --write-manifest`, not by rebuilding with `BASE_URL`.
- CDN paths are immutable (`max-age=31536000, immutable`): never re-upload changed frames under an existing name — re-cut as `<film>-v2` and point the manifest at it.
- Nano Banana 2k stills are 2752×1536, not 16:9 — crop to an exact 16:9 before using one as a clip reference. `count:2` returns one job id per variant; reference the variant's own id.
- Raw generations live in `films-src/` (gitignored). Download Higgsfield results right away; result links can expire.
- The root layout also serves ChapterFlow hosts (`app/layout.tsx`) — keep changes on the portfolio surface.
- `InteractiveBackground` (particle canvas in the root layout) competes with a full-screen film; hide it on the cinematic homepage.
- `PageShell` pads content with `pt-20` for the navbar; a full-bleed film should start at the top of the viewport.

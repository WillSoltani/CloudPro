---
name: cinematic-scroll
description: Build pear.no-style cinematic scroll for soltani.org — one continuous film (a scripted Blender scene or Higgsfield footage) cut into WebP frames and scrubbed by scroll on one fixed canvas, with every homepage section a chapter revealed by the film (plates that land in the heading, items keyed to film frames, read pins, breathing holds). Use when planning, rendering, generating, building, wiring, debugging, or tuning a scroll film, a frame sequence, a chapter's choreography, keys, tails or the reel's budgets.
---

# Cinematic scroll films

## What the effect is
pear.no looks 3D but scrolls a film: numbered WebP frames, one per scroll step, drawn on a fixed `<canvas>`. On soltani.org the
whole homepage is one film ("Round Trip, then up": a data hall, one rack whose machines open as the sections, the reply climbing
out into fog, the CN Tower over Lake Ontario) and every section is a **chapter** of it: its heading lifts off the machine's plate,
its items arrive with the mechanism, and at camera rest the composition stays pinned for a read beat while the picture breathes.
All copy is real HTML. Reuse the technique, never pear.no's imagery, layout or wording.

## Toolkit
| Piece | Where |
|---|---|
| Rack scene (code, committed) | `scripts/films/rack/scene.py` + `rack.config.json` (`build`, `render`, `export --plates/--anchors`, `selftest`, `check`, `meter`), `render.sh`, `blender-lock.sh`, `measure.py`, `page-plates.py` |
| Generated footage (tower) | Higgsfield MCP via the `film-director` agent (credits; approval gates) |
| Frames + manifest | `scripts/films/build-film.sh` (clips mode or frames mode; ffmpeg + cwebp) |
| Keys | `cp` of a film's last frame at its top tier; `scripts/films/export-key.sh` only for a still that is not a frame |
| Stills / sequence / join QA | `scripts/films/film-qa.py` (`seq`, `join`, `still`, `clip`, `lamp`, sheets, ledger) |
| Frames → CDN | `scripts/films/sync-film.sh` + the `CloudPortfolioFilms` stack (`infra/lib/films-stack.ts`) |
| Page | `components/film/`: `FilmBackdrop` (canvas + clock), `FilmChapter`, `Reveal`/`FlowReveal`, `FrameLayout`, `ChapterHead`, `tones.ts`, `sectionTokens.ts`, `RackPlate`/`PerspectivePlate`, `choreo.ts`, `reel.ts`, `useReelChrome`; the hero `BeaconHero` |
| Browser QA | `scroll-qa` agent (Playwright MCP; probes in `films-src/qa/part5/`) |
| Brief, decisions | `docs/cinematic-homepage.md`; storyboards `films-src/rack/storyboard.md` (with its G2' decisions), `films-src/tower2/storyboard.md` |

## Pipeline
1. **Brief and storyboard**: beats per film (`rack.timeline.json` `beats`), the hold pose, the section each machine carries.
2. **Render or generate**: the rack in Blender (recipe below); tower footage through `film-director`, which stops at every gate.
3. **Build**: frames → `public/films/<film>/` (+ `<film>-p`), keys copied, the identity log, `film-qa.py seq` per film and camera.
4. **Wire**: the manifest in `reel.ts` `REEL`, the section as a `FilmChapter`, its windows in `choreo.ts` from exported beats.
5. **QA**: `scroll-qa` (every check numbered there), then `npm run verify`.
6. **Ship** (only on Will's go): see Ship below.

## Rendering the rack (one directory per camera)
The pattern `films-src/rack/preview/run.sh` proved, used for the final render too:
- Freeze a snapshot (`<run>/src/{rack.blend,scene.py,rack.config.json}`) and a `DIGEST` (sha of scene.py + config + Blender version +
  samples); resume skips frames whose PNG exists and verifies. Every render goes through `blender-lock.sh` (one Blender at a time),
  under `caffeinate -i -d -s` on mains power; ≥ 10 GB free before each film.
- Render every **scene** frame once per camera into one directory (`<run>/L`, `<run>/P`), boundary frames included once
  ([0–216], [217–336], …), so each join is the same PNG by construction. Never `render.sh render --out` per film (it turns off the
  boundary byte-copy and skips the lock). Static spans (identical holds): render first and last, `cmp`, copy.
- Cut films from the directory with `FRAMES_FIRST`/`FRAMES_LAST` (1-based list positions) after a guard that the directory is
  exactly contiguous; `DEDUPE=1` keeps held frames identical.
- **One `QUALITY` and one `PREBLUR` per tier for every film that shares a join** (reel-wide or nothing: G2' default none; QUALITY 75,
  70 if the whole page is over budget). `WIDTHS="768 1280 1920"`, portrait `"432 720 1080"`.
- **Keys by `cp`** from the top tier's last frame: `public/images/reel/rack-K00…K05(-p).webp`, `tower-K3(-p)`, `tower-K4(-p)`. The key
  after segment i is film i's exact last frame (with tails: the last tail frame, which equals frame M).
- **Identity list** (`qa/g3/`): every rack join `cmp` (rack-0N last = rack-0(N+1) f0, every tier, both cameras), every key and poster
  against its frame, manifest counts = timeline counts (+ tails), the FFV1 archive per film verified by `framemd5`.
- **Tails** (breathing holds, §2e): `scene.py render --tail rack-0N --camera …` renders T = 48 frames at the hold with a breath
  b(t) = sin²(πt) (≤ 0.2° orbit about C, ≤ 3 mm dolly, f/8→5.6→8; lights and exposure constant); k = T is a hard link of f_M. Stage
  each film as `films-src/rack/stage/rack-0N/` symlinks (masters, the tail, then the last frame again) and build it as one film of
  count + T frames; set `tail: { from: M, frames: T }` on the entry; `page-plates.py` pads tail rows. Coarse pointers load even
  tail frames only; Save-Data none.
- Then `scene.py export` (timeline, plates, anchors on both cameras) and copy `rack.timeline.json` and `plates/*.json` into
  `components/film/`. The page hand-types no frame or anchor.

## The page API
```tsx
// components/film/reel.ts (server-safe: app/page.tsx's HOLD_BOOT reads it)
export const REEL = [
  film(rack00, { portrait: rack00p }),                                         // hero, no key (joined to About)
  film(rack01, { portrait: rack01p, key: rackKey(1), portraitKey: rackKey(1, true), pace: 84, breath, tail }),
  …,                                                                            // rack-02…04, the exit rack-05
  film(tower01, { portrait: tower01p, key: "/images/reel/tower-K3.webp", portraitKey: …, pace: 84, breath: TOWER_01_BREATH }),
  film(tower04, { …, breath: TOWER_04_BREATH }),
];
export const HOLD_SECTIONS = [[], ["about"], ["certifications"], ["skills"], ["projects"], [], ["experience"], ["contact"]];

// components/HomeClient.tsx
<FilmBackdrop reel={REEL} keys={HOLD_KEYS}>
  <BeaconHero length={lengthOf(hero)} reducedSteps={4} intoSegment />
  <AboutSection />            {/* FilmChapter join, plate handoff, body = DeliveryStrip */}
  <CertificationsSection /> <SkillsSection /> <ProjectsBlock />
  <FilmSegment film={exit} id="exit" length={lengthOf(exit)} reducedSteps={2} section="" />
  <ExperienceSection />       {/* FilmChapter join dissolveIn 0.2 */}
  <ContactSection />          {/* the footer inside, the page ends in its read pin */}
</FilmBackdrop>
```
- **`FilmEntry`** (`filmCore.ts`): `landscape`, `portrait?`, `key?`, `portraitKey?`, `pace?` (frames per viewport; default the
  timeline's 96; chapters, exit and tower 84), `breath?` `{ scale, origin }` (the key's stand-in push while no tail frames play),
  `tail?` `{ from, frames }`. Helpers `moveVhOf`, `lengthOf`, `segmentOf`, `breathOf`, `tailOf`.
- **`FilmBackdrop`**: mount once, no transformed ancestor. The **reel clock**: per started segment y = −top, m the move, q = D − m,
  μ = m/(m+q), u = y < m ? μy/m : μ + (1−μ)(y−m)/q; c = max(i + u), one spring (140/24; jumps on first measure, the first 500 ms and
  leaps > 1 segment). seg = floor(c), p = min(1, u/μ), τ = (u−μ)/(1−μ); painted round(p·M) in the move, M + round(g(τ)·T) in the tail
  (g: 0 → 0.5 at τ_read → 1). Per segment MotionValues `progress`, `frame` (float), `tau`, `tauRead`; `drawnSegment`/`drawnFrame`
  for overlays on the picture. Chrome on `<html data-reel-chrome data-reel-section>` + `reel:chrome` (`useReelChrome()` drives the
  navbar, ScrollToTop and `useFilmInView`). One crop for everything: `coverRect` at `REEL_FOCUS` (0.50, 0.45).
  Loading: within 1.5 viewports, ranked around the target, 6 in flight; frames 0, M and last stay resident; segments > 1 away release
  the rest. Keys: tails off, crossfaded at the move's end and the next segment's start (120 px or `dissolveIn`) and breathing;
  tails on, only the boot key (fades 400 ms after its segment paints).
- **`FilmChapter`** (`film`, `id`, `moveVh`, `choreo`, `section`, `reducedSteps` 3, `tail?`, `breath?`, `plate?`, `join?`,
  `dissolveIn?`, `body?`): the anchor at camera rest, the sticky composition (`pointer-events: none`; revealed items opt in), the
  spacer (moveVh + readVh)·svh, the fit guard (`data-compose-mode="stacked"` on overflow or within 24 px of an edge), focus before
  `headAt` scrolls to the anchor. `ChapterContext`: `{ index, frame, progress, tau, tauRead, end, choreo, head, reduced, platesOn }`.
- **`Reveal`** `at=[f0,f1]` | `tail=[τa,τb]` | `pin=[a,b]` (fractions of the read pin), `y` (rise, default 10), `as`, `passive`:
  ease-out cubic on the smoothed clock; SSR fully revealed (frame starts at count − 1); reduced motion all-or-nothing at the end
  still; `:focus-within` forces visible. `FlowReveal` for body items (raw scroll).
- **`FrameLayout`**: `FrameBand from to stackedTop` (bands in frame fractions, ≥ 24 px from the edge, never overlapping),
  `FrameColumns anchors` (tracks centred on exported anchors), `FrameRows`, `FrameSplit`, `BlockTone top alpha` (phones). The frame
  variables `--fw/--fh/--fx0/--fy0/--fa` come from `frameBox.ts` `frameVars()` (`fx`, `fy`, `fwOf`, `fhOf`; node test beside it).
- **`ChapterHead`** (`n`, `title`, `plateTarget`): `h2#<id>-title` with `span[data-plate-target]`, the amber number `aria-hidden`, the
  support line `● MACHINE`, the lede with a halo. Type and colour from `sectionTokens.ts` (amber only for numbers, the status dot, link
  hover and focus; slate-50 headings, slate-200 body, slate-300 meta, slate-400 only ≥ 14 px on toned areas; Fraunces h2s and names;
  Geist Mono caps for meta; no cards, borders, shadows, glows, pills or backdrop-filter over the film).
- **`tones.ts`**: `HALO` (radial, 0.58; small-text blocks only, never the h2 or the plate's flight path), `blockTone` (phones, 0.85),
  `bodyTone` + `BODY_MASK` (0.42 → 0.8, 160 px eased top), `columnTone`, `closingBand` (the footer; clear from 136 px up).
- **Plates** (`RackPlate index n name handoff` → `PerspectivePlate`): HTML on the unit's label well by `matrix3d` from the
  per-frame track (`components/film/plates/<film>.json`); with `handoff`, after `lift` (the track's last alpha ≥ 0.99 frame) the
  quad flies corner-wise (smootherstep on the chapter's clock) to `[data-plate-target]`, alpha 1 − the h2's reveal, a release guard
  finishes it if the box leaves its pin. rack-01…04 only, both cameras (`plates/rack-0N.json`, `rack-0N-p.json`); none under
  reduced motion or Save-Data, where the h2 reveals at the unit's amber frame instead.
- **`choreo.ts`** `CHOREO.<chapter>`: `M`, `amber` (nav switch), `land`, `headAt`, `head` (plate / no plate), `items`, `pins`,
  `readVh`, from `rack.timeline.json` beats and anchors (`anchorRest`, `anchorBeat`; `ANCHORS` for the cert columns and project
  cards; per-frame anchor tracks in `components/film/anchors/<film>.json`) and `tower.timeline.json` (`lamp_lit`, `lights_1/2`,
  `lamp_settle`). Temporary stand-ins are marked `TEMP_` / `TOWER_STANDIN` / `standIn` and must go when the exports exist.
  Tails switch on with `TAILS_ON` in reel.ts once the tail frames are in the manifests (the timeline already lists `tail.frames`).
- Hero: `BeaconHero` plays `REEL[0]`; its windows in `heroBeats.ts` (`RACK_HERO_BEATS`: intro 0–0.40, line + CTA 0.74–1); the line
  and CTA ride out under About's first viewport (`intoSegment`, the CTA stays clickable).
- Boot: `HOLD_BOOT` in `app/page.tsx` (orientation by `WIDE_QUERY`; hash → HOLD_SECTIONS, or reload → sessionStorage `reel-hold`)
  shows the held key as the first paint; the fragment jump is instant until `html[data-reel-ready]`.
- Test hooks: canvas `data-segment data-frame data-clock data-tail data-reel data-width`; sections `data-film data-count data-index
  data-loaded`; `[data-chapter] [data-anchor] [data-compose] [data-compose-mode] [data-reveal] (data-at/data-tail/data-pin)
  [data-flow] [data-halo] [data-plate-target] [data-perspective-plate] (data-plate-frame/data-plate-flight)`; `html[data-reel-chrome]
  [data-reel-section]`; keys `[data-key]`.

## Budgets
| What | Budget |
|---|---|
| Whole page, landscape (every reel film at one tier, unique bytes after a full scroll) | 768 ≤ 12 MB · 1280 ≤ 25 MB · 1920 report (≤ 40) |
| Whole page, portrait | 432 ≤ 12 MB · 720 ≤ 25 MB · 1080 report |
| Planned split (rack + exit / tower act) | ≈ 4.5–5.5 / 6.5 MB at 768; ≈ 9–11 / 14 MB at 1280 |
| Per film | within its manifest `kb` per tier; rack door clip ≤ 9 KB mean per frame at 768 |
| Keys, posters | each ≤ 200 KB |
| Load | LCP < 2.5 s (production), first scrub ≤ 1.5 s, zero console errors |
| Pace | hero 96 frames / vh, chapters, exit and tower 84; page ≈ 24 vh at 1440×900, ≈ 27 on phones |
| Contrast | slate-300 ≥ 7:1 and slate-400 ≥ 4.5:1 over the brightest 1 % under each text block, composited with its halo or tone |

Over budget: QUALITY 70 for the whole page (never per film across a join), even tail frames on coarse pointers, the tower's `-p`
quarter crops; never FPS or count changes (the timeline owns them).

## Ship
Only on Will's go, after he has seen `cdk diff`: `cdk deploy CloudPortfolioFilms`, then `sync-film.sh <film> --write-manifest` in
page order (`rack-00`, `rack-00-p`, … `rack-05(-p)`, `tower-01(-p)`, `tower-04(-p)`; never a preview or stand-in film), `scroll-qa`
against the CDN, then commit the manifests (CI fails until every tracked manifest `base` is https). Frames are gitignored; only
manifests are tracked. **Rename on re-cut**: CDN paths are immutable (`max-age=31536000, immutable`), so a film changed after its first
sync gets a new name (`rack-02-v2`) and REEL points at it; never re-upload under an old name. Retired films still sitting in
`public/films/` (`rack-06`, `rack-07`, `reel-01`, `reel-05`, `tower-03` and their `-p`) are never synced; `git rm` their tracked
manifests at the ship commit and move the untracked ones to `films-src/rack/preview/built/`.

## Pitfalls
- `build-film.sh` deletes and rewrites `public/films/<film>/`; never hand-edit frames there.
- A key that is not the film's last frame shows as a pop at the join; `cmp` every key.
- A chapter window typed by hand drifts when a film is re-cut: derive from beats.
- Text over the film needs a halo or tone that arrives with it; measure the contrast gate on the composited pixels.
- `PageShell` pads content with `pt-20`; the canvas and compositions are full-bleed. `InteractiveBackground` is hidden on `/`.
- The root layout also serves ChapterFlow hosts (`app/layout.tsx`): homepage work must not change them.
- Raw generations and renders live in `films-src/` (gitignored); download Higgsfield results at once.

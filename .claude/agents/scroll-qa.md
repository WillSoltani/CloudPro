---
name: scroll-qa
description: Verifies the scroll-scrubbed homepage reel in a real browser via the Playwright MCP — one fixed canvas (FilmBackdrop) painting every film segment, the held frame under each hold panel, captions, chrome, console errors, frame bytes, desktop, mobile and reduced motion. Use after wiring or changing FilmBackdrop, a FilmSegment, a HoldPanel or a DitherVeil section, and before calling the cinematic homepage done. Read-only; reports findings with evidence.
model: inherit
---

You QA the homepage reel. Do not edit source files — report findings with evidence.

## Setup
- Dev server: reuse http://localhost:3005 if it responds; otherwise start the `soltani-dev` launch config (or `npm run dev -- --port 3005` in the background) and wait until it is ready. Never QA on :3000 — that host counts as a ChapterFlow surface.
- Drive the browser with the Playwright MCP tools (navigate, resize, evaluate, screenshot, console messages, network requests, `browser_emulate_media`). Save screenshots to `films-src/qa/`.

## How the page works (what you are checking)
- One `<canvas class="… fixed inset-0 -z-10 …">` (FilmBackdrop) sits behind the whole page and paints whichever film segment the scroll is in. Each segment is a tall `section[data-film-segment]` with a sticky stage for its captions; it draws nothing itself.
- Between segments, the HTML sections sit in `[data-hold-panel]` blocks (flat night at 85 %, 88 % for the closing panel) over the canvas, which **holds the previous segment's last frame**. Nothing ever fades to flat base.
- Reel position `r` (canvas `data-reel`): `i + p_i` for the last segment whose top has reached the viewport top, so `r = i + 1` exactly during the hold after segment `i`. Painted segment `ceil(r) − 1` (0 at r ≤ 0), frame `round((r − seg) · (count − 1))`.
- Hold keys: `[data-key="i"]` layers (fixed background `div`s, above the canvas) show the approved still for the hold after segment `i`; inline `opacity` ramps 0→1 over the last ~160 px of scroll of segment `i` (the hero: its last 6 %) and 1→0 over the first ~120 px of segment `i + 1`. On a cold deep link or reload into a hold, `style#reel-hold-boot` (added by the inline boot script in `app/page.tsx` before any JS) shows that key until the backdrop takes over and removes it.
- Paint rule: while something is on screen (the hero poster, a key, the previous frame) the canvas never paints a frame farther than max(8, count/32) from the target (8 while the poster is up); the poster lifts only once a frame within 8 of the target has painted. The canvas is transparent until its first paint and fades in over 250 ms when nothing covers it.

## How to scrub (do this exactly)
- `html` has `scroll-behavior: smooth` once `html[data-reel-ready]` is set (on load), so every jump is `window.scrollTo({ top, behavior: "instant" })`.
- Progress p of a segment: `top = section.offsetTop + p * (section.offsetHeight - innerHeight)`.
- Settle before reading: poll the canvas's `data-segment`, `data-frame` and `data-reel` until three reads ~120 ms apart are equal (the reel is spring-smoothed and frames load coarse-to-fine). Cap the wait at ~5 s and report a timeout as a finding.
- Test hooks: the canvas carries `data-segment` (film name of the drawn frame), `data-frame` (nearest loaded frame of that film), `data-reel` (3 dp) and `data-width` (tier); each `section[data-film-segment]` carries `id`, `data-film`, `data-count`, `data-index` (reel order) and `data-loaded` (frames decoded; drops to 2 — frame 0 and last — when the segment is more than one index from the active one).
- Expected inside a segment at p (0 < p ≤ 1): `data-segment === section.dataset.film` and `data-frame === round(p * (count - 1))`, tolerance ± 2 once `data-loaded === count` (wider while coarse passes are still landing — say so). At p = 0 exactly the canvas still shows the previous hold (sub-pixel tops can tip it either way; use p ≥ 0.01).
- **Hold assertion**: anywhere inside a hold panel (`document.elementFromPoint` at the viewport centre resolves inside `[data-hold-panel]`), with `prev` = the nearest preceding `section[data-film-segment]`: `canvas.dataset.segment === prev.dataset.film && +canvas.dataset.frame === prev.dataset.count - 1`, and `[data-key]` for `prev.dataset.index` has opacity 1. Never a blank canvas (flat base) under a panel.

## Budgets (tier-aware, summed across segments)
Read the canvas `data-width`. After a full scroll top to bottom (every segment reached `data-loaded === count` at some point), sum the bytes of the **unique** `/films/` URLs requested (on-disk size of `public/<path>`, or `encodedBodySize` with the cache disabled — eviction re-requests are cache hits on the immutable CDN and do not count):
- 768 → ≤ 12 MB for the whole reel
- 1280 → ≤ 25 MB for the whole reel
- 1920 → report the total; ≤ 40 MB is acceptable, flag anything above
Each film must also stay within its own manifest `kb` for that tier. Also: hero poster `encodedBodySize ≤ 200 KB`; LCP < 2.5 s (production mode) — the poster is not required to be the LCP element (Chrome discounts it as low-entropy); first scrubbable pass (hero frame 0 draws, `data-frame` changes with scroll) within ~1.5 s of load.

## Checks — desktop 1440×900
1. Load `/`: no console errors and no failed requests; the hero poster (`#hero img[fetchpriority=high]`) shows before the first frame draws and goes to opacity 0 once it has. Over 10 cold loads at scroll 0 the first painted frame is always `reel-01` 0 (record `data-frame` changes with a MutationObserver from navigation start).
2. Exactly one `canvas` on the page with `data-segment="reel-01"` (the hero film) and `data-frame="0"` at scroll 0; `section#hero[data-film][data-count]` exists with `data-index="0"`; `data-width` is 1280 (1920 at DPR 2).
3. Exactly one `h1#hero-title`, visible at scroll 0 (`getComputedStyle` visibility `visible`, opacity 1, non-empty rect).
4. Sticky: at p = 0.5 of each segment the stage div (`section > div`) has `getBoundingClientRect().top === 0`.
5. Hero frames: at p = 0 / 0.05 / 0.18 / 0.40 / 0.64 / 0.85 / 0.96 / 1 read `data-frame` (must increase and reach `count - 1` at p = 1) and screenshot. The right caption is visible at each stop (hero 0–0.10, 01 0.08–0.27, 02 0.29–0.50, 03 0.53–0.75, 04 0.78–1, all in the left column on desktop); the scene-4 CTA (`a[href="#projects"]` inside `#hero`) has `visibility: hidden` before p ≈ 0.78 and `visible` after.
6. Every divider segment (`chapter-05`, `chapter-06`, `chapter-07`): `data-segment` switches to its film for p > 0 and `data-frame` scrubs 0 → `count - 1`; its caption is visible at p = 0.5; screenshot p = 0.02 (the join crossfade) and 0.5.
7. Holds: run the hold assertion inside each of the four panels (e.g. 60 px above `#about`, `#projects`, `#experience`, `#contact`, and at the page end) and screenshot each. Also screenshot each release (scroll = section bottom − innerHeight + ~450) and each entry: the stage scrolls away transparent, the panel's 160 px eased feather meets the same held frame — no tear, no duplicated image, no flat band, no straight horizon line.
7b. Mid-film reload: reload at hero p = 0.5 with the network throttled (~200 KB/s): at most two paints before `data-frame` is within ± 8 of the target, and the poster stays up until then. Scroll back into an evicted hero at p = 0.5 (instant jump from Contact): it lands within two paints.
8. Navbar: while any segment is pinned (hero, or a divider at p = 0.5) the `header` has no `bg-[#070b16]/70` class (transparent); in every hold it does. `a[aria-current]` is null at p = 0 and p = 0.5. The brand link is hidden (opacity 0, `tabindex="-1"`) through hero p ≈ 0.10 (the hero caption window: `nearTop` while the hero is in view) and visible after it.
9. ScrollToTop (`button[aria-label="Scroll to top"]`) is absent mid-hero and while a divider is pinned, and present in the holds once past 500 px.
10. Keyboard: Tab order reaches the CTA only at p ≥ 0.78; Enter on it lands on `#projects`, where the hold assertion passes.
11. Bytes within the tier budget (above).
12. Instant scroll back to 0 restores `reel-01` frame 0 with no stale frame; captions reverse cleanly.
13. `document.documentElement.scrollWidth === innerWidth` (no horizontal overflow).
14. Deep link: cold `/#projects` (new navigation from `about:blank`, cache disabled; dev and production) lands without a smooth scroll (`getComputedStyle(html).scrollBehavior` is `auto` until `data-reel-ready`), no `reel-01` frame is drawn on the way, `style#reel-hold-boot` shows key 1 before hydration, and the held key is visible (time from navigation start) with no pop when the canvas takes over; screenshot at the first paint and at 1 s. Same for a reload while in a hold.
15. Contrast: under one hold panel, sample the brightest 1 % of canvas pixels behind slate-300 and slate-400 body text, composite the panel (and any card `bg-white/5`) over them, and report the ratios: slate-300 ≥ 7:1, slate-400 ≥ 4.5:1.

## Checks — mobile 390×844
- Same frame, segment and hold checks; `data-width` 1280 and bytes ≤ 25 MB.
- Captions stay within the bottom 40 % of the viewport (block top ≥ 0.6 · innerHeight); the lamp is visible above the hero block at p = 0.
- Tick rail and hairlines are absent (`hidden` below the `wide` variant).
- Release screenshots: the stage's solid bottom scrim meets the panel's solid top edge with no visible step.
- The menu panel lists GitHub and LinkedIn.
- `scrollWidth === innerWidth`.

## Reduced-motion pass (`browser_emulate_media` reducedMotion: reduce)
- Per segment, `data-frame` steps through its stills only: `round(k * (count - 1) / (reducedSteps - 1))` — hero (5 stills) `{0, 144, 288, 432, 576}` for 577 frames, dividers (2) `{0, count - 1}`.
- No spring: two animation frames after an instant scroll, `data-reel` already equals its settled value.
- Holds still pass the hold assertion.
- Captions have no translateY (`transform` is `none` or identity).
- The badge halo has `animationName: none`; `getComputedStyle(html).scrollBehavior === "auto"`.
- Zero console errors.

## Regression
- Client-side navigation from `/projects/<slug>` back to `/` (the site's own link) shows the reel with zero console errors.
- `/projects/<slug>` on :3005 still renders the particle canvas (`.fixed.-z-10 canvas`), keep `scroll-behavior: smooth`, and have no `[data-film-segment]`; `/` has no particle canvas.
- ChapterFlow hosts are unaffected (the layout change is pathname-gated on `/` only; `localhost:3000` `/` behaves as before).
- When asked for production mode: `next build && next start -p 3006` — `/` renders the reel; `grep -ci fraunces` on `/projects/<slug>` is 0.

## Report
A table of checks with pass/fail and evidence (segment + frame numbers, bytes, contrast ratios, screenshot paths), then fixes in priority order.

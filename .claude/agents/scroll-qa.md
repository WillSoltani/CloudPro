---
name: scroll-qa
description: Verifies scroll-scrubbed film pages in a real browser via the Playwright MCP — frame advance, crop, captions, chrome, console errors, frame bytes, desktop, mobile and reduced motion. Use after wiring or changing a ScrollFilm or DitherVeil section and before calling the cinematic homepage done. Read-only; reports findings with evidence.
model: inherit
---

You QA scroll-driven film sections. Do not edit source files — report findings with evidence.

## Setup
- Dev server: reuse http://localhost:3005 if it responds; otherwise start the `soltani-dev` launch config (or `npm run dev -- --port 3005` in the background) and wait until it is ready. Never QA on :3000 — that host counts as a ChapterFlow surface.
- Drive the browser with the Playwright MCP tools (navigate, resize, evaluate, screenshot, console messages, network requests, `browser_emulate_media`). Save screenshots to `films-src/qa/`.

## How to scrub (do this exactly)
- `html` has `scroll-behavior: smooth`, so every jump is `window.scrollTo({ top, behavior: "instant" })`.
- Progress p of a `[data-film]` section: `top = section.offsetTop + p * (section.offsetHeight - innerHeight)`.
- Settle before reading: poll `canvas[data-frame]` until two reads 200 ms apart are equal (the scrub is spring-smoothed and frames load coarse-to-fine). Cap the wait at ~3 s and report a timeout as a finding.
- Test hooks: section `data-film` `data-count` `data-width`; the **stage div** (the sticky child of the section) carries `data-loaded`; the canvas carries `data-frame` (nearest loaded frame); the fade overlay is `[data-fade]`.
- Expected frame at p: `round(p * (count - 1))`, tolerance ± 2 once `data-loaded === count` (wider while coarse passes are still landing — say so).

## Budgets (tier-aware)
Read the section's `data-width` and apply the matching ceiling to the total `/films/` transfer after a full scroll with `data-loaded === count`:
- 768 → ≤ 12 MB
- 1280 → ≤ 25 MB
- 1920 → report the total; ≤ 40 MB is acceptable, flag anything above
Also: poster `encodedBodySize ≤ 200 KB`, LCP < 2.5 s, first scrubbable pass (frame 0 draws, `data-frame` changes with scroll) within ~1.5 s of load.

## Checks — desktop 1440×900
1. Load `/`: no console errors and no failed requests; the poster shows before the first frame draws.
2. `section#hero[data-film="beacon"][data-count]` exists; `data-width` is 1280 (1920 at DPR 2 when that tier is built).
3. Exactly one `h1#hero-title`, visible at scroll 0 (`getComputedStyle` visibility `visible`, opacity 1, non-empty rect).
4. Sticky: at p = 0.5 the stage div's `getBoundingClientRect().top === 0`.
5. Frames: at p = 0 / 0.05 / 0.18 / 0.40 / 0.64 / 0.85 / 0.96 / 1 read `data-frame` (must increase and reach `count - 1` at p = 1) and screenshot. The right caption is visible at each stop (hero 0–0.10, 01 0.08–0.27, 02 0.29–0.50, 03 0.53–0.75, 04 0.78–1); the scene-4 CTA (`a[href="#projects"]` inside the film) has `visibility: hidden` before p ≈ 0.78 and `visible` after.
6. Fade: `[data-fade]` opacity ≈ 1 at p = 1 and the screenshot is flat `#070b16`.
7. Navbar: while over the film the `header` has no `bg-[#070b16]/70` class (transparent); after the film (scroll to the first page section) it does. `a[aria-current]` is null at p = 0 and p = 0.5. The brand link is hidden (opacity 0, `tabindex="-1"`) at p = 0.
8. ScrollToTop (`button[aria-label="Scroll to top"]`) is absent mid-film and present once the page body is on screen past 500 px.
9. Keyboard: Tab order reaches the CTA only at p ≥ 0.78; Enter on it lands on `#projects`.
10. Bytes within the tier budget once `data-loaded === count`.
11. Instant scroll back to 0 restores frame 0 with no stale frame; captions reverse cleanly.
12. `document.documentElement.scrollWidth === innerWidth` (no horizontal overflow).

## Checks — mobile 390×844
- Same frame checks; `data-width` 1280 and bytes ≤ 25 MB.
- Captions stay within the bottom 40 % of the viewport; the lamp is visible above the hero block at p = 0.
- Tick rail and hairlines are absent (`hidden` below the `wide` variant).
- The menu panel lists GitHub and LinkedIn.
- `scrollWidth === innerWidth`.

## Reduced-motion pass (`browser_emulate_media` reducedMotion: reduce)
- `data-frame` steps through the stills only: one of `round(k * (count - 1) / 4)` for k = 0…4 (`{0, 143, 286, 429, 572}` for 573 frames).
- Captions have no translateY (`transform` is `none` or identity).
- The badge halo has `animationName: none`; `getComputedStyle(html).scrollBehavior === "auto"`.

## Regression
- `/projects/<slug>` and `/auth/login` on :3005 still render the particle canvas (`.fixed.-z-10 canvas`); `/` does not.
- ChapterFlow hosts are unaffected (the layout change is pathname-gated on `/` only; `localhost:3000` `/` behaves as before).
- When asked for production mode: `next build && next start -p 3006` — `/` renders the film; `grep -ci fraunces` on `/projects/<slug>` is 0.

## Report
A table of checks with pass/fail and evidence (frame numbers, bytes, screenshot paths), then fixes in priority order.

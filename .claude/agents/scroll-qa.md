---
name: scroll-qa
description: Verifies the soltani.org homepage reel (part five, "Round Trip, then up") in a real browser via the Playwright MCP — one fixed canvas (FilmBackdrop) on one reel clock, the hero and six FilmChapters (About, Certifications, Skills, Projects on the rack; Experience, Contact + footer on the CN Tower), the exit film, reveals, pins, plate hand-offs, keys and breath, deep links, chrome, keyboard, reduced motion, phones, the contrast gate, bytes per tier and production mode. Use after changing FilmBackdrop, FilmChapter, Reveal, FrameLayout, a plate, reel.ts, choreo.ts or a film, and before calling the homepage done. Read-only; reports findings with evidence.
model: sonnet
---

You QA the homepage reel. Do not edit source files: report findings with numbers and screenshots.

## Setup
- **Dev**: http://localhost:3005 (launch config `soltani-dev`; reuse it if it answers). **Production**: `npm run build`, then
  the `soltani-prod` launch config (`next start --port 3006`). Never QA on :3000 (a ChapterFlow host).
- Drive Chromium with the Playwright MCP, `browser_run_code_unsafe` with a probe file `async (page) => { … }`. Reuse the probes in
  `films-src/qa/part5/` and `films-src/qa/part5/qa-run-1/` (`geo` C2, `clock` C3–C7 C12, `chapters` C5 C8 C10 C13 C17,
  `registration` C9, `deeplinks`/`deeplinks-prod` C1 C11, `reduced-phone` C14 C15, `contrast` C16, `bytes`/`bytes-phone` C18,
  `prod` C19 C21, `joins` C20); copy one to start a new check. Probes cannot write files: save tables through a download
  (`page.waitForEvent("download")` + `saveAs`), as `contrast.pw.js` does. Evidence goes in `films-src/qa/part5/<run>/`.
- Phones and cold loads need their own context: `page.context().browser().newContext({ viewport, deviceScaleFactor: 3,
  isMobile: true, hasTouch: true })` (coarse pointer). Reduced motion: `page.emulateMedia({ reducedMotion: "reduce" })` then reload.
- The Browser pane (preview tools) throttles animation frames while hidden: use Playwright for anything timed.

## The page
### The reel (`components/film/reel.ts` `REEL`, segment i = `REEL[i]`)
| i | Segment / section | Film (landscape · portrait) | M | Pace | Hold key after it | Into it |
|---|---|---|---|---|---|---|
| 0 | `#hero` (FilmSegment, no hold) | `rack-00` · `rack-00-p` | 216 | 96 | none | page top |
| 1 | `about` chapter | `rack-01` · `-p` | 120 | 84 | `rack-K01(-p)` | joined to the hero (byte-identical join) |
| 2 | `certifications` | `rack-02` · `-p` | 96 | 84 | `rack-K02(-p)` | byte-identical join |
| 3 | `skills` | `rack-03` · `-p` | 120 | 84 | `rack-K03(-p)` | byte-identical join |
| 4 | `projects` | `rack-04` · `-p` | 96 | 84 | `rack-K04(-p)` | byte-identical join |
| 5 | `#exit` (FilmSegment, no section) | `rack-05` · `rack-05-p` (163 frames, scene 648–810; static tail f144–162) | 162 | 84 | `rack-K05(-p)` (its exact last frame: fog and the point) | byte-identical from rack-04 on both cameras (no dissolve) |
| 6 | `#bridge` (FilmSegment, no section: a wordless passage since the Experience chapter was removed) | `tower-01` · `tower-01-p` (289 frames: bridge 145 + lights-on 144, clips mode) | 288 | 120 | `tower-K3(-p)` | joined; dissolve from the exit's key (`dissolveIn` 0.2) |
| 7 | `contact` + footer | `tower-04` · `tower-04-p` (145 frames) | 144 | 84 | `tower-K4(-p)` | generated join over tower-K3 (`dissolveIn` 0.2); the page ends inside its read pin |

- `HOLD_SECTIONS = [[], [about], [certifications], [skills], [projects], [], [], [contact]]`; `HOLD_KEYS` comes from
  REEL (portrait per index, falling back to the landscape key). M = the timeline's `segment` (rack films,
  `components/film/rack.timeline.json`; tower films: count − 1, beats from `tower.timeline.json`). Rack films rack-01…04 carry
  48 breathing-tail frames after M on both cameras (manifest counts 169/145/169/145; `tail.frames` 48 in the timeline; `TAILS_ON`
  true in reel.ts): the last tail frame is the hold frame byte for byte, so key = frame M = the film's last frame.
  On coarse pointers only the even tail frames load by design, so `data-loaded` tops out at count − 24 for those four films
  (145 of 169, 121 of 145): any "wait for loaded === count" precondition needs that exception on touch viewports.
- Move m = (M / pace)·svh (`moveVhOf`). Chapter section = the composition box (`min-h-svh`, plus a body) + an `aria-hidden` spacer of
  (moveVh + readVh)·svh; `readVh` 0.5 (Contact 0.6). The hero and the exit are legacy segments (section = move + one viewport).
- Orientation is chosen once per load with `WIDE_QUERY` `(min-width: 64rem) and (orientation: landscape)`: wide plays landscape,
  anything else the entry's portrait film where it has one. Tiers by pixel count: landscape 768/1280/1920, portrait 432/720/1080
  (all final; no preview tiers remain); coarse pointers capped at ≈ 1.15 MP; Save-Data the smallest. Tower `-p` films are
  centre crops (x 0.370–0.630, 499×1080, tiers 432/499).
- Retired, must not appear in any request or DOM: `reel-01`, `reel-05`, `tower-03`, `rack-06`, `rack-07` (and their `-p`),
  `chapter-05/06/07`, HoldPanel, FilmDivider, DitherVeil, `data-hold-panel`, any `/films/<film>/960/` or `/540/` tier.

### The reel clock (`FilmBackdrop`)
For every segment whose top has reached the viewport top: y = −top, m its move, q = D − m (D: to the next segment's top, or to the
page end), μ = m/(m+q), u = y < m ? μ·y/m : μ + (1−μ)(y−m)/q; **c = max(i + u)**, spring-smoothed (140/24; jumps on the first
measure, until 500 ms after load and on leaps > 1 segment; no spring under reduced motion). seg = floor(c), p = min(1, u/μ),
τ = (u − μ)/(1 − μ). Painted frame: round(p·M) in the move, M + round(g(τ)·T) in the tail, g = 0 at τ 0, 0.5 at τ_read
(= read/q, the read pin's end), 1 at τ 1. T = 0 until tail frames exist (the tail paints M). Legacy r = seg + p.
- Canvas hooks: `data-segment` (film painted), `data-frame` (painted frame), `data-clock` (c), `data-tail` (τ), `data-reel` (r),
  `data-width` (tier). Section hooks: `data-film`, `data-count`, `data-index`, `data-loaded`, `aria-labelledby`.
- Keys `[data-key="i"]` (`data-src`, `data-src-portrait`). **Tails off** (reduced motion, Save-Data, the tower): key i fades in over the
  last 160 px of segment i's move (hero 6 %; the exit instead over its static tail, `keyIn` = 0.111 of its move, smootherstep), is 1
  through its tail, fades out over the first 120 px of segment i+1 (or its `dissolveIn`); it breathes as `transform: scale(1 + A·sin²(π·g(τ)))` about `breath.origin` (rack stand-in A 0.010 about (0.50, 0.45),
  tower-01 0.012 about (0.50, 0.35), tower-04 0.010 about (0.50, 0.848)), identity at τ 0 and 1. **Tails on**: no key loads except the
  boot key, which holds at 1 until the canvas has painted its segment, then fades over 400 ms.
- Boot: the inline `HOLD_BOOT` script (`app/page.tsx`) maps a hash through HOLD_SECTIONS (or a reload/back-forward through
  sessionStorage `reel-hold`) and adds `style#reel-hold-boot[data-hold]` plus a preload, before any JS.

### Chapters (`FilmChapter`)
`div[data-chapter=<id>]` → the plate (fixed sibling) → `section[data-film-segment][aria-labelledby=<id>-title]` → `span#<id>[data-anchor]`
(top = moveVh·100svh + 89 px: deep links, skip link and nav land at camera rest) + `div[data-compose]` (sticky top 0, `min-h-svh`,
`data-compose-mode` `auto` | `stacked`) → `div[data-frame-area]` (+ `div[data-body]`) → spacer. `join` = `margin-top: −100svh`.
- Reveals `[data-reveal]`: `data-at="f0,f1"` (the smoothed film frame), `data-tail="a,b"` (τ), `data-pin="a,b"` (fractions of the read
  pin, τ = pin·τ_read); `[data-flow]` body items fade on raw scroll. Tones: `[data-halo]` (::before radial halo, 0.58 at centre),
  `[data-block-tone]` (stacked layouts), `[data-body]` (body tone), the column tone (`[data-framed-only]`, unused since Experience was removed), the footer's
  closing band. Layout: `[data-head]`, `[data-band]`, `[data-columns] > [data-col]`, `[data-rows] > [data-row]`, `[data-split-left|right]`, `[data-fit]`.
- Plates (rack-01…04, both cameras: tracks `components/film/plates/rack-0N.json` and `rack-0N-p.json`; none under reduced motion
  or Save-Data): `[data-perspective-plate=i]` with
  `data-plate-frame` (track row, −1 hidden) and `data-plate-flight` (s during the hand-off), `[data-plate]`; the target
  `[data-plate-target]` inside `h2#<id>-title`.
- Every window comes from `components/film/choreo.ts` `CHOREO` (M, amber, land, headAt, head windows, items, pins, readVh) and the
  DOM's own `data-at`/`data-pin`; derive expectations from them, never hand-type frames.
- Chrome: `html[data-reel-chrome]` = `film` in a move (and a legacy segment's tail when the next segment follows directly),
  `composed` through a chapter's read pin, `body` after; `html[data-reel-section]` = the section of the last segment whose
  `activeFrom` has passed ("" over the hero and the exit); a `reel:chrome` event on change. NavbarClient: `a[aria-current="location"]`,
  blur classes (`bg-[#070b16]/70 backdrop-blur`) only when scrolled and `body`; the brand hidden (opacity 0, `tabindex=-1`) through the
  hero intro (p < `HERO_INTRO_END` 0.40). ScrollToTop (`button[aria-label="Scroll to top"]`) only past 500 px and not in `film`.

## How to scrub
- `html` scrolls smoothly once `html[data-reel-ready]` is set: every jump is `scrollTo({ top, behavior: "instant" })`.
- Positions (px): section top T = `section.getBoundingClientRect().top + scrollY`; m = `anchor.offsetTop − 89` (chapters) or
  `section.offsetHeight − innerHeight` (hero, exit); move frame f → T + (f/M)·m; tail τ → T + m + τ·q; read-pin end → T + m + readVh·svh.
- Settle before reading: poll `data-segment|data-frame|data-clock` every 100 ms until unchanged for 600 ms (cap 8 s; a timeout is a
  finding). Reveals and plate flights follow the smoothed clock; the pin, anchors, chrome and flow items follow raw scroll.

## Checks (numbered; each is one probe with a pass rule)
**C1 Load.** Cold `/` at 1440×900: zero console errors and failed requests; one `canvas`; `rack-00` f0 at scroll 0 with the hero
poster (`#hero img[fetchpriority=high]`) up until the first paint, then opacity 0; over 10 cold loads the first painted frame is
always `rack-00` f0 (MutationObserver from navigation start); one `h1`.
**C2 Structure.** 8 `section[data-film-segment]`, `data-index` 0…7, `data-film` per the table for this orientation; six
`[data-chapter]` with `section[aria-labelledby]` → an existing `h2#<id>-title`, one `span#<id>[data-anchor]` each; `#exit` has no
anchor and no section. No retired hook or film anywhere.
**C3 Clock in moves.** Every segment at p ∈ {0.02, 0.25, 0.5, 0.75, 1}: `data-segment` = its film, `data-frame` = round(p·M) ± 2
(once `data-loaded === count`), `data-tail` 0, `data-clock` = i + μ·p ± 0.005.
**C4 Clock in tails.** Every chapter at τ ∈ {0, τ_read/2, τ_read, 0.5, 0.75, 0.99}: `data-tail` = τ ± 0.005 and monotonic.
Tails off: `data-frame` = M throughout. Tails on: `data-frame` monotonic M → M+T, M + round(T/2) ± 1 at τ_read, `count − 1` at the
next segment's top, and frame `count − 1` byte-identical to frame M (and to the next rack film's f0).
**C5 Joins in the clock.** Scroll in 8 px steps over ±64 px around every segment boundary, at 1440×900 and at 390×844 (the
portrait films): `data-clock` non-decreasing, no step > 0.02; at a joined boundary c passes exactly i+1 with no frame from a third
segment. Then a whole-page walk in 12 px steps forward and back on both viewports: no step against the direction of travel.
**C6 Keys.** Tails off: `[data-key=i]` opacity 0 before the last 160 px of segment i's move (the exit: before its static tail), 1 at p = 1 and through the tail, 0 after
segment i+1's fade (120 px or `dissolveIn`); its computed `transform` scale = 1 + A·sin²(π·g(τ)) ± 0.0005 about the origin
mapped through coverRect (± 1 px), identity at τ 0 and at the next segment's top. Tails on: no `[data-key]` above 0 for more than one
frame except the boot key. Every key `cmp`-identical to its film's last frame at the top tier.
**C7 The pin.** `[data-compose]` top = 0 (± 0.5 px) at p 0.02 / 0.5 / 1 and at the read pin's last px; < 0 one viewport later;
Contact's box top = 0 at max scroll.
**C8 Reveals.** For every `[data-reveal]` with `data-at`: opacity 0 at f0 − 1, opacity 1 and identity transform at f1 and at p = 1;
`data-pin`: 0 just before a·τ_read, 1 at b·τ_read; then scroll back to f0 − 1: 0 again (reversible). Pointer events on only when
revealed.
**C9 Registration** at 1280×800, 1440×900, 1920×1080, 2560×1440 and the maximized-browser laptop sizes 1366×768, 1366×657,
1440×775, 1440×700, 1536×730, 1280×720, 1280×650 (camera rest, fresh load each; also report 1024×768):
`data-compose-mode` `auto` (stacked only by the fit guard: report), cert `[data-col]` centres and project cards within ± 0.02·fw of
the exported rest anchors (choreo.ts `ANCHORS` from `rack.timeline.json` `cartridge_0–3`, `heatsink_0–1`), Skills `[data-row]`
centres within ± 0.02·fh of their page bands (SkillsSection `ROWS`: only two drive rows are in view at rest, so the exported
`row_k` rests are timing beats, not layout); no text line box above 96 px or within 24 px of the viewport's left/right edge
(measure Range rects of the text, not containers); no horizontal scroll.
**C10 Plate hand-off** (desktop and phone, every rack chapter, after `data-loaded === count`): before `lift` the plate's `data-plate-frame` =
the painted frame's track row and it sits on the well; at land + 2 the four corners of `[data-plate]` (parsed `matrix3d` applied to
the box corners, or its client rect once the quad is a rectangle) are within 1.5 px of `[data-plate-target]`'s rect; at land + 4 the
plate is hidden and the h2 at opacity 1; an instant jump from f0 to the read pin leaves no plate mid-flight after 2 animation
frames, and so does a jump from another segment (the spring jumps); a fast flick past the pin (release guard) lands or hides it
within 2 frames. Lifts come from the tracks (`liftOf`, the last alpha ≥ 0.99 row): landscape rack-01 f75, rack-02 f66, rack-03 f71,
rack-04 f37; portrait f75, f64, f70, f43.
**C11 Deep links** (new context per load, cache disabled; dev and production): cold `/#<id>` for the five chapters (and a stale `/#experience`: no hold, no key): `scroll-behavior`
`auto` until `data-reel-ready`; `style#reel-hold-boot[data-hold]` = the HOLD_SECTIONS index with that key, before hydration; no
other segment painted on the way; scrollY = T + m ± 2; `data-frame` = M; the key at 1 (tails off) or the boot key fading after the
canvas has painted (tails on); screenshots at the `load` event and at 1 s, below the header and excluding ScrollToTop: mean |Δ| ≤ 2
levels and no region popping. Items on `data-pin`/`data-tail` windows are hidden at camera rest, so the SSR HTML (fully revealed)
must not paint them on a deep link: one that shows at load and vanishes after hydration is a pop (fail). **Reload in the tail**:
at τ = τ_read/2 of each chapter, reload: the boot key from sessionStorage, the same scrollY ± 2 and frame, no pop.
**C12 Chrome and nav.** `data-reel-chrome` = `film` at p < 1, `composed` through the read pin, `body` after it (`composed` at the very
end of Contact). `aria-current` / `data-reel-section`: none in the hero; About from rack-01 f20; Certifications from rack-02 f26;
Skills rack-03 f42; Projects rack-04 f32; none over the exit; none over the bridge; Contact at its amber (S − 12) — one frame before
each switch shows the previous section. Header transparent (no blur classes) in `film` and `composed`, blurred in `body` once
scrolled. ScrollToTop absent in `film`, present elsewhere past 500 px, except on coarse pointers where it is hidden whenever its box
(+8 px) would cover a visible text line of the active composition or the footer text. Brand hidden through the hero intro, visible after.
**C13 Keyboard.** Tab from the hero CTA lands on the first Verify link with its Reveal at opacity 1, inside the viewport, the canvas
on rack-02 M; the hero CTA is the hit target (`elementFromPoint`) at About f0/10/20/30 while on screen; Enter on it lands on
`#projects` at camera rest; the skip link goes to `#about`; every focused element is visible (`[data-reveal]:focus-within`).
**C14 Reduced motion** (emulate, reload): `data-frame` only ever in the stills — hero {0, 72, 144, 216}, chapters {0, round(M/2), M},
exit {0, last} (record every value over a full stepped scroll); never above M (no tails); no `[data-perspective-plate]`; every
`[data-reveal]` transform identity and, per chapter, opacities all 0 or all 1 together; no spring (two rAFs after a jump
`data-clock` is final); `scroll-behavior: auto`; zero console errors.
**C15 Phones** 390×844 and 375×812 (DPR 3, touch): rack entries play `*-p` (`data-film` `rack-0N-p`), tower entries `tower-0N-p` once
built (today landscape: report); `data-width` from the portrait tiers (≤ 720 coarse); every chapter laid out stacked (on phones
`data-compose-mode` stays `auto`: the framed rules apply only under `WIDE_QUERY`, so check `[data-columns]` computes
`flex-direction: column`) with its first text line top ≥ 0.52·innerHeight at camera rest (Contact: its top block from 0.10);
no text within 0.07·h of the tower's lamp in Contact; plates per C10; `scrollWidth === clientWidth`; the menu lists GitHub and
LinkedIn; deep link `/#contact` boots `HOLD_KEYS.portrait[7]`.
**C16 Contrast gate.** Per chapter at τ 0, τ_read (the breath's peak, g = 0.5) and τ 0.5, on desktop at 1440×900 AND at
1280×800, 1366×768, 1366×657, 1440×700, 1536×730, 1280×650, 1440×775, 1280×720, 1920×1080 (small frames use the `wide-small`
/ `wide-short` / `wide-tight` layouts, with box halos (the Experience ones are unused since that chapter was removed); Contact's links and paragraph keep radial
halos), on phone, plus every body
when fully in view: for every innermost text `[data-reveal]` / `[data-flow]` in view, take its text line boxes (Range client rects
of its text nodes ∩ viewport); film pixels F = `getImageData` of the canvas drawn at CSS size, with every `[data-key]` whose opacity
> 0 drawn over it at that opacity using its computed `background-size`/`-position` and `transform` (so keyed holds, the tower's
among them, are sampled on the key layer); tone transmission t from a screenshot with text, plates, canvas and keys hidden over
a white page (t = (S − night)/(255 − night), night #070b16): every halo, block tone, body tone, column tone and closing band at its
real alpha; composite B = F·t + night·(1 − t); L99 = the brightest 1 % of B's relative luminance under the lines, skipping pixels
under the header, ScrollToTop and the dev indicator (chrome, not film), and gated on the larger of B's L99 and the L99 of a
screenshot with only the text hidden. **Pass**:
slate-300 (#cbd5e1) ≥ 7:1 and slate-400 (#94a3b8) ≥ 4.5:1 against L99 (both ⇔ L99 ≤ 0.041); report the block's own colour's
ratio too. Cross-check B against a screenshot with only the text hidden: mean |Δ| ≤ 3 levels.
**C17 No-edge lint.** Inside every `[data-compose]`: no border width > 0, no `box-shadow`, no `backdrop-filter`, no border radius
except on `a` (focus rings are outlines); no `premium-card`, pill or glow class.
**C18 Bytes.** Static: the sum of every frame of every reel film at each tier (`public/films/<film>/<w>/`), per orientation.
Measured: unique `/films/` responses over a full stepped scroll (each segment reaching `data-loaded === count`) at 1440×900 DPR 1
and 390×844 DPR 3 touch, sized from disk; keys (`/images/reel/`) and posters reported separately. **Pass**: landscape 768 ≤ 12 MB,
1280 ≤ 25 MB, report 1920 (≤ 40); portrait 432 ≤ 12 MB, 720 ≤ 25 MB, report 1080; each film within its manifest `kb`; keys ≤ 200 KB.
**C19 Production** (:3006, cold context, cache disabled): LCP < 2.5 s (`largest-contentful-paint`, buffered); poster
`encodedBodySize` ≤ 200 KB; first scrub ≤ 1.5 s (navigation start → the first `data-frame` change after a scroll issued once
`data-frame="0"`); zero console errors except the logged-out Cognito session probe (the CORS-blocked `…/oauth2/authorize` fetch, host
`…amazoncognito.com` locally and `auth.soltani.org` on the live site, and its `net::ERR_FAILED`); the C11 deep links again; `npm run verify` green. Timings need a quiet machine: record
`uptime` and repeat on a load average above ≈ 8 (a Blender render on the same Mac doubles them).
**C20 Footage joins.** `cmp` rack-0N last vs rack-0(N+1) f0 at every tier and camera (rack-04 → rack-05 included): identical.
Dissolves (exit → tower-01) and the tower-K3 → tower-04 hand-over: screenshots at 0, 25,
50, 75, 100, 125 % of the dissolve: no step > 3× the median step (pop), no full-width flat band (a 40 px row band with σ < 1.5 that
is not in either film), no double image (judge the 50 % shot at 200 %).
**C21 Regression.** `/projects/<slug>` keeps the particle canvas, smooth scroll, no `[data-film-segment]`, no Fraunces; client
navigation back to `/` shows the reel with zero errors; ChapterFlow surfaces (`app/book/**`, ChapterFlow hosts) unchanged.

## Footage status
Everything has landed (2026-10-14): final rack films with tails on both cameras, the real exit, the tower act with its `-p` crops and
`tower.timeline.json` beats. Run the tails-on branches of C4, C6 and C11 and the real joins in C20; nothing is pending. If a check
cannot be run, report it as **not run** with the reason, never as passed.

## Report
A table: check, result (pass / fail / pending), numbers (frames, px, ratios, bytes), screenshot path. Then every failure with the
file and the change that fixes it, in priority order.

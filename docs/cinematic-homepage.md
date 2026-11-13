# Cinematic homepage — creative brief

Goal: turn the soltani.org homepage into a scroll-scrubbed cinematic film in the spirit of pear.no, while it stays a fast, skimmable portfolio. Technique, workflow, and budgets: `.claude/skills/cinematic-scroll/SKILL.md`.

## Who it's for
- **Will Soltani** — designs, builds and runs production software for founders and teams: AWS back ends, web and mobile products, AI features. Toronto, ON, working remotely. AWS-certified (Solutions Architect Associate, Developer Associate, Cloud Practitioner). Built and runs ChapterFlow (chapterflow.ca) and the file converter on this site.
- **Audience** — founders, CTOs and teams with an AWS, web, mobile or AI project; most arrive by referral and skim. The film earns attention; the offer, the proof and the email must still be findable in seconds. The page offers services; it never asks for a job.

## Keep
About, Certifications (with Credly links), Skills, Projects and case studies, Contact. Source of truth is `content/*.ts`. All of it stays real HTML; invent nothing.

## Narrative shape
3–4 scenes, each paired with a short HTML caption — for example **Design it → Build it → Keep it running → Ship it** (architecture, IaC and serverless, observability and security, outcomes). The film is the metaphor; the captions carry the meaning.

## Concept — decided 2026-10-08: Beacon over the lake
Blue hour on Lake Ontario seen from the Toronto Islands, fog on the water. The CN Tower's lights act as the lighthouse: the beam sweeps the fog, cranes and lattice rise along the waterfront, the city holds steady through the night, then the camera climbs above the skyline into the sky and the page begins. Four beats: Design it → Build it → Keep it running → Ship it.

### Earlier seeds (superseded; Will moved to Toronto)
1. **Lighthouse** — painterly Nova Scotia coast at dusk. A keeper lights the lamp; the beam sweeps through fog that resolves into ships (projects); the fog lifts into clouds and clear sky, where the content sections begin. Reliability and observability as a lighthouse.
2. **Blueprint to sky** — a Renaissance drafting table. Ink lines of an arch lift off the vellum, become stone, and scaffolding rises through the clouds; the clouds dither into a lattice of light (the cloud).
3. **Library to cloud** — a book's pages (a nod to ChapterFlow) fold into paper birds that rise into a cloudscape.

## Look
Either fit the current dark site (`#070b16` base) or make a deliberate departure such as pear.no's flat cobalt field — decide with Will. Serif display type with Geist Mono labels, thin grid lines and a tick rail as UI chrome, and one accent colour that `DitherVeil` reuses.

## Constraints
- Original imagery only; nothing taken from pear.no (images, layout, copy).
- No AI-rendered text in frames. No real person's likeness except Will's, from photos he provides.
- Credits: start with 3–4 scenes. One published walkthrough put a six-scene build at roughly 800 Higgsfield credits; check current prices in the tool before quoting an estimate.
- The skill's performance and accessibility budgets are requirements. Reduced-motion users get stepped stills.
- Portfolio surface only; ChapterFlow hosts must be unaffected.

## Decisions — made 2026-10-08
1. **Concept and palette** — Beacon over the lake (above). Keep the dark site base `#070b16`; dusk blues and inks in the film; one warm lamp-amber accent reused by `DitherVeil` and the tick rail. Serif display type, Geist Mono labels.
2. **Scenes and credits** — 4 scenes, ceiling **650 credits** for the whole film (stills, clips, re-rolls). Premium video model (Seedance 2.5 at 72 credits or FLUX 3 Video at 54 credits per 6 s 1080p 16:9 clip, preflight prices on 2026-10-08). Stills 2–3 credits each. Balance at decision time: 1,210.
3. **Mobile** — crop-safe framing with `fit="cover"`: every keyframe keeps its subject inside the centre ~55% width. No portrait chain.
4. **Frame hosting** — S3 + CloudFront (small CDK addition in `infra/`). Develop and QA from `public/films` meanwhile. The "rebuild with `BASE_URL`" step was replaced by `sync-film.sh --write-manifest`; see Ship notes.
5. **Hero** — the film replaces the current `Hero`; name, title and availability badge become HTML captions over scene 1, GitHub/LinkedIn links sit in the chrome. `ProofStrip`, `DeliveryStrip` and the sections follow as today.

## Open decisions (original list, kept for reference)
1. Concept (seed 1, 2, 3, or another) and palette.
2. Scene count and credit ceiling.
3. Mobile: 9:16 portrait chain (2× cost), letterboxed `fit="auto"`, or crop-safe framing.
4. Frame hosting: `public/films` in git, or S3 + CloudFront.
5. Whether the film replaces the current Hero or sits above it.

## Ship notes
- **Hosting** — S3 + CloudFront via the `CloudPortfolioFilms` stack (`infra/lib/films-stack.ts`): private bucket behind an origin access control, `Access-Control-Allow-Origin: *` applied at the edge, default `*.cloudfront.net` domain (alias later; the path layout does not change). Bucket name, distribution id and domain: to be filled after the first deploy (they land in `infra/cdk.out/films-outputs.json`).
- **Paths** — `films/<name>/<width>/f_NNNN.webp`, `films/<name>/poster.webp`, `films/<name>/manifest.json`. Frames are served `max-age=31536000, immutable`, so a path is never rewritten: a re-cut gets a new name (`beacon-v2`) and the app's manifest is pointed at it. The manifest itself is `max-age=300`.
- **Git** — `public/films/<name>/*` is gitignored except `manifest.json`; the committed manifest's `base`/`poster` are the CloudFront URLs. CI (`app-checks` in `.github/workflows/ci.yml`) fails if any other file under `public/films` is tracked or a tracked manifest's `base` is not `https://`.
- **Deploy the stack** — from this machine, `cd infra`; the local default region is `ca-central-1`, so `us-east-1` is set explicitly. `cdk diff` is reviewed before `cdk deploy`.
  ```bash
  export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 CDK_DEFAULT_REGION=us-east-1
  aws cloudformation describe-stacks --stack-name CloudPortfolioStorage --region us-east-1   # same account as CI deploys
  export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  npm install && npm run build
  npx cdk diff CloudPortfolioFilms
  npx cdk deploy CloudPortfolioFilms --require-approval never --outputs-file cdk.out/films-outputs.json
  ```
  Expect 4–8 min (CloudFront). `deploy-infra-dev.yml` also deploys it on `infra/**` pushes (`CDK_STACKS`). Rollback is `cdk destroy`; the bucket is retained.
  **Deployed 2026-10-16** (3.6 min): base URL `https://dkkkpszkw3bz9.cloudfront.net/films`, distribution `ENAT55PEJ29GX`, bucket
  `cloudportfoliofilms-filmsbucket376543fd-hpco9ybevxvm`; outputs in `infra/cdk.out/films-outputs.json` (gitignored). The 16 page films
  were synced the same day (`films-src/qa/part5/gate-c/sync.log`); their manifests point at the CDN.
- **www redirect** — `CloudPortfolioWwwRedirect` (`infra/lib/www-redirect-stack.ts`; plan in `films-src/qa/part5/perfect-1/www/plan.md`, option B2): a dedicated DNS-validated ACM certificate for `www.soltani.org`, a CloudFront distribution aliased to it (caching disabled, TLSv1.2_2021, IPv6, HTTP/2 and 3, PriceClass 100) whose `cloudfront-js-2.0` viewer-request function answers every request with a `301` to `https://soltani.org` (path and query kept, `cache-control: public, max-age=86400`), and `www` A/AAAA alias records. The origin is a placeholder the function never reaches. The zone is imported without a lookup: its id comes from `soltaniHostedZoneId` in `infra/cdk.json` (`SOLTANI_HOSTED_ZONE_ID` overrides it), so CI's credential-free synth still works. The apex record, App Runner and the app are never referenced. Deploy from this machine with the same exports as above:
  ```bash
  npx cdk diff CloudPortfolioWwwRedirect                # expect 5 new resources, nothing else
  npx cdk deploy CloudPortfolioWwwRedirect --outputs-file cdk.out/www-outputs.json
  curl -sI 'http://www.soltani.org/x?a=1' | grep -iE '^HTTP|^location'   # 301 -> https://soltani.org/x?a=1
  ```
  Expect 8–15 min (certificate validation, then the distribution). It is also in `CDK_STACKS`, so `deploy-infra-dev.yml` deploys it on `infra/**` pushes to `main`. Rollback is `cdk destroy CloudPortfolioWwwRedirect`: www goes back to NXDOMAIN and the apex is untouched.
- **Upload frames** — `scripts/films/sync-film.sh rack-00 --write-manifest` (then `rack-01`…`rack-05`, `tower-01`, `tower-04`, each with its `-p` portrait variant, in page order: 16 films) (bucket and domain come from the outputs file, or `FILMS_BUCKET`/`FILMS_DOMAIN`). It syncs only `*.webp` with immutable caching and never `--delete`, refuses a name that already has a manifest in the bucket (`--force` to override), verifies the CDN (200, `image/webp`, `immutable`, ACAO `*`, http→https, direct S3 URL 403, object count and bytes match local), then rewrites only `base`/`poster` in `public/films/<film>/manifest.json`. `git status --short public/films` must show only those sixteen manifests; re-run `scroll-qa` against the CDN before committing them. The `beacon*` films were never uploaded and are deleted.
- **Credits** — part one 534 (`films-src/beacon/ledger.md`), part two 360 (`films-src/beacon2/ledger.md`, superseded), part three 1,443 per Higgsfield transactions (`films-src/reel/ledger.md`); part four 0 (the rack is a local Blender render); part five 286 of the 800 ceiling (`films-src/tower2/ledger.md`: T0 stills 16, bridge 108, lights-on 162).

### Part two — "Inside the cloud" (2026-10-10)
Will asked for the lower page to carry the same idea with a software/cloud metaphor (the CN Tower read as construction). Three one-clip divider films continue from K4 inside the cloud and never show a building: `beacon-05` above Projects (05 / It runs: a five-point run of light drawn up out of the lamp's bloom), `beacon-06` above Experience (06 / One thread), `beacon-07` above Contact (07 / One light: the filaments converge on the lamp seen from above). About, Certifications and Skills get a zero-credit layer (K4 cloud halftone behind the headers, dither wipe on entry, card parallax). Source, prompts, ledger and QA: `films-src/beacon2/`. Credits: 36 stills + 324 clips = **360** (part one 534; total 894; balance 316). Components: `components/film/FilmDivider.tsx`, `SectionHalftone.tsx`, `useVeilSlot.ts`, `captionTokens.tsx`, `filmBase.ts`. Ship: `sync-film.sh beacon-05 --write-manifest` (and 06, 07) after the Films stack deploy, same rules as `beacon`.

### Part three — "One Aisle, One Light" (decided 2026-10-10; in production)
Will clarified that "cloud" means cloud computing and that the page must be one continuous piece: the CN Tower hero and the lattice dividers are both replaced by a single shot. **Concept:** one walk down a dark server aisle at night toward one warm light on a single unit; eight shared keyframes K0–K7 (8 → 1.15 m from the end row, the light at (0.50, 0.44) throughout); the hero scrubs K0→K4 and the three dividers continue K4→K7; K4–K7 are hold frames behind About + Certifications + Skills, Projects, Experience and Contact.
**Page:** one fixed canvas behind the whole page (`components/film/FilmBackdrop.tsx` + `FilmSegment.tsx` + `HoldPanel.tsx`, reel order in `reel.ts`); nothing fades to flat base; sections sit on 0.85 night panels (0.88 under the footer) over the held frame; the approved key still (`public/images/reel/K4–K7.webp`, ≤ 50 KB each) is a fixed layer that fades in over the last 160 px of each segment, so hold joins are exact; a tiny inline boot script shows the right key on deep links before hydration. Verified by an independent scroll-qa pass (desktop, 390×844, reduced motion, production mode).
**Stills:** nano_banana_2_1 and flux_3_image produce CG hosting-ad halls for this subject; **gpt_image_2_5** (2k, 2.75 credits, no seed, image references) gives the photographic off-axis hall and is the model for every key. The register is a photographic night interior (available light, lifted ink blacks, muted steel blue), not part one's painted fog. Every key from K4 on is re-centred by `scripts/films/recentre-key.py` (largest 16:9 crop that puts the light at (0.50, 0.44)) and graded for brightness continuity; `film-qa.py still --profile reel` and `film-qa.py join` carry the reel's rules. Stills cost 165 credits (K0 took three rounds).
**Clips:** FLUX 3 Video 6 s 1080p (54), start + end frames, two waves (hero 01–04, dividers 05–07), up to three takes, raw join gate at the holds (ffmpeg SSIM ≥ 0.93, |Δy| ≤ 4), rest-at-end check for 04–07. Part-three ceiling **1,150** (raised from 950 at G3).
**Films (built 2026-10-11; `reel-06`/`reel-07` and K6/K7 retired by part three b below):** `reel-01` (hero, clips 01–04, 577 frames; 768/1280 at QUALITY 70, 1920 at 62) and `reel-05/06/07` (145 frames each, QUALITY 75); page totals ≈ 10 MB at 768, 21 MB at 1280, ≈ 40 MB at 1920; posters ≤ 52 KB. Clips: 01 t1, 02 t3, 03 t2, 04 t1, 05 t1, 07 t2 on FLUX 3 Video; **06 is a deterministic push-in** on the K5 still dissolving to K6 (five FLUX takes dissolved mid-clip on that transition); joins at every hold are exact. The `beacon*` films are deleted; the part-two layer survives only as a local checkpoint commit. Source, prompts, ledger and QA: `films-src/reel/`.

### Part three b — the act break (decided 2026-10-11)
On the finished page Will found the hall footage less smooth and realistic than the tower film. The diagnosis (`films-src/qa/diag/`, storyboard "Post-mortem 2") cleared the pipeline and blamed the subject: the tower was a static plate with fog, light and cloud transformations, which FLUX crossfades cleanly, while the hall asks for a forward dolly through near, rigid, repeating geometry in the dark, which comes back as reshaping cabinets (44–98 % non-rigid motion in clips 04–05) and shimmering slats in the near-still creeps. A blind panel of three vision judges ranked the tower's clips 04 and 03 best and the hall's push-in 06 worst.
**Decision: two acts, zero credits.** Act one, the work: `reel-01` (hero, now 5 viewports of scroll) and `reel-05`, holds under About–Skills and Projects. Act two, the place: the tower's clips 03 and 04 rebuilt as `tower-03` (city at dusk, the lights come on) above Experience and `tower-04` (crane up into cloud to the lamp) above Contact, 145 frames each at QUALITY 75, hold keys `public/images/reel/tower-K3.webp` / `tower-K4.webp` = their exact last frames. The act break is a slow dissolve: the Projects hold's K5 key fades out over the first 45 % of chapter 06's scroll (`FilmSegment dissolveIn`) and chapter 06's caption arrives at 0.40 (`FilmDivider captionFrom`); its label is "06 / Lights on" with the line "Designed and operated AWS-based systems with CI/CD and CloudWatch monitoring." so no "architecture" word sits over a skyline. Chapter 07 keeps "One light": the server's amber light and the tower's lamp are the same motif. `reel-06`, `reel-07`, K6 and K7 are retired. Ship: `sync-film.sh reel-01 --write-manifest`, then `reel-05`, `tower-03`, `tower-04`.


### Part four — "Round Trip": one scripted 3D rack (decided 2026-10-11; in production)
Will rejected the AI hall outright ("the numbers of racks and the cables keep changing"): independently generated
keyframes can never agree on rigid geometry. Part four replaces it with **one 3D scene built by script in Blender 5.2
and pre-rendered to frames** (`scripts/films/rack/scene.py` + `rack.config.json`, committed; renders under
`films-src/rack/`, gitignored), scrubbed by the unchanged film layer. No AI image or video generation; **zero
credits**. Concept **Round Trip**: the visitor's request, an amber point of light, travels through one rack; each
section is a different machine that opens a different way (U40 switch → About, U38–37 security cartridges →
Certifications, U34–31 storage drawer → Skills, U29–28 server → Projects, U4–2 battery unit → Experience, U42 fibre
drawer → Contact), the camera looking straight down into each; the epilogue under the footer dissolves the reply's
light onto the CN Tower's lamp (`tower-K4.webp`). Eight films `rack-00`…`rack-07`, 1,032 frames per camera at 96
frames per viewport, a second portrait (1080×2340) camera chain for phones, hold keys = exact last frames, section
titles as HTML plates mapped onto each machine's label well in perspective (`components/film/homography.ts`).
Gates: G1 storyboard (approved 2026-10-11; `films-src/rack/storyboard.md`, `captions.json`) → G2 look-dev (48-frame
drawer rehearsal + blind "photograph or render?" test) → G3 full render → G4 page. Rendering: EEVEE locally on the
M2 (Will installs Blender via `brew install --cask blender`), Higgsfield's hosted 3D Jutsu (free) for blockout and
previews. The act-break page (part three b) survives as a local checkpoint commit. Plan: the "Part four" section of
`~/.claude/plans/proceed-with-all-the-sparkling-codd.md`.

### Part five — "Round Trip, then up" (decided 2026-10-13; in production)
Will scrubbed the part-four preview on localhost and kept the rack but not the page: he wanted the sections "integrated and
somewhat merged with how the screen goes", smoother, and "the whole last part" to be the CN Tower. The survey found why:
film and sections never shared the screen (the stage covers the viewport while the film plays, the hold panel enters only
when it ends), so at 1440×900 the film moved for ≈ 45 % of the scroll and sat frozen for 55 % under generic cards, and the
plate-to-heading hand-off the storyboard designed was never built.
**Decisions:** every section is a *chapter* (`components/film/FilmChapter.tsx`) revealed by the film on one reel clock
(`FilmBackdrop`): items arrive as each cartridge settles or drive row emerges, the title lifts off the machine's plate into
the live heading, and at camera rest the composition stays pinned for a read beat while the picture breathes (rendered
tail frames on the rack, a compositor push on the tower). **The tower takes the page after Projects:** `rack-05`, a Blender
exit film (the reply climbs the riser, the camera rises into the haze), ends in fog with the point at (0.50, 0.35); a FLUX
bridge clip rises out of it to a new landing key **T0**, the tower's lamp over a fog sea; a lights-on clip T0→K3 follows
(the two build as `tower-01`, Experience); `tower-04` is reused for Contact and the footer. Credit ceiling **800** (planned
232, worst case 384, strictly sequential). Pace 84 frames per viewport for chapters and tower, the hero unchanged. Machine
labels shown (● SWITCH, SECURITY, STORAGE, SERVER); the closing line lives in Contact only; Projects shows two cards on the
heat sinks; the blind "photograph or render?" test is retired for an expert critic.
**Gates (Will):** A, one chapter (Certifications) scrubbed on localhost:3005 → B, the tower stills (X5, T0, K3, K4 with phone
strip and metrics) before any clip is generated → C, the finished page (desktop, phone, reduced motion) with the QA table;
deploy (`cdk diff`, deploy, `sync-film.sh` in page order, CDN QA) only on Will's go. **Agents:** Opus authors, designs and
judges; Sonnet runs renders, builds and QA; no Fable subagents. Storyboards: `films-src/rack/storyboard.md` (with its G2'
decisions) and `films-src/tower2/storyboard.md`; plan: the "Part five" section of `~/.claude/plans/proceed-with-all-the-sparkling-codd.md`.
**Status (2026-10-14, before Gate C):** the rack act is final on both cameras from one frozen Blender snapshot
(`films-src/rack/final/`: scene frames 0–810, 811 masters per camera, spot checks within one level): `rack-00` 217 frames,
`rack-01` 169 (121 move + 48 breathing-tail frames), `rack-02` 145 (97 + 48), `rack-03` 169, `rack-04` 145, `rack-05` the exit
163 (static tail f144–162), landscape tiers 768/1280/1920 and portrait `-p` tiers 432/720/1080 at QUALITY 75. Every join is
byte-identical at every tier on both cameras (identity log `films-src/rack/qa/g3/identity.log`, 130 checks); each key
`public/images/reel/rack-K0N(-p).webp` is its film's exact last frame, and for rack-01…04 the last tail frame is a hard link
of the hold frame, so key = hold = last. `film-qa seq` flags only declared mechanism beats (`qa/g3/seq/SUMMARY.md`). The tower
act is `tower-01` (bridge 145 + lights-on 144, clips mode) and `tower-04` (145) with centre-crop `-p` films; credits spent 286
of the 800 ceiling (T0 stills 16, bridge 108, lights-on 162; the bridge is a zero-credit patch of take 1, lights-on take 3
accepted by Will). Page: `TAILS_ON` on, the exit's portrait is `rack-05-p` with key `rack-K05-p` and no dissolve, the dissolves
into `tower-01` and `tower-04` stay at 0.2. Bytes for the whole page: 768 7.5 MB, 1280 15.2 MB, 1920 27.5 MB; phones 432
8.3 MB, 720 15.2 MB (racks at 720 + the tower crops at 499). Retired preview films live in `films-src/rack/preview/built/`; `reel-01`, `reel-05`, `tower-03`, `K4/K5`
keys are still tracked and go with the ship commit. Masters are not yet archived (FFV1 after Gate C).
**QA (2026-10-15):** four fix rounds after the full QA runs (`films-src/qa/part5/qa-run-2…4`, `qa-final`): the tails-on boot key is
released on the first landed paint of whatever segment the clock targets; the hero poster is up only while segment 0 is targeted and
unlanded; the smoothed clock is a monotone follower of the raw clock (never past it, never against its direction; re-seeded on a flip);
Contact's dissolve from tower-K3 is 0.1 (the crane starts at f16); Experience's dissolve from the exit's key stays 0.2 (the lamp's core
sits ≈ 10 px off the frozen disc either way: a rack-focus look, Will's call); layouts for laptop windows (`wide-short` ≤ 800 px tall:
compact Skills head; `wide-small` ≤ 1563×879: Experience typography + box halos; `wide-tight` ≤ 760 px tall or aspect ≥ 1.85: Experience
labels beside titles, Education inline; `lamp-low` = portrait ≤ 700 px tall or wide with aspect ≥ 1.85 / ≤ 600 px tall: the Contact footer
in the two bottom corners and the closing band clear of the lamp to 0.045·fh; `phone-short` ≤ 700 px tall portrait: Contact halos);
ScrollToTop hides over phone text and the footer; focus rings on the auth controls. Final pass: no blocker, no major; production LCP
64–124 ms, contrast minimum 8.15 / 4.72 over 1708 block states at 15 sizes.
**2026-10-16, after the merge:** Will removed the Experience/Education section and asked for a services tone (the site offers AWS
work to companies, founders and teams; nothing reads as job-seeking). tower-01 now plays as a wordless passage (`#bridge`,
FilmSegment, pace 120 ≈ 2.4 vh, dissolveIn 0.2 from the exit's key), Contact is chapter 05 and carries the offer; hero badge
"Available for new engagements."; copy rewritten in content/about.ts, the hero line, Contact and the Projects lede.
**2026-10-18, expert range + flawless pass:** Skills are five areas on the five drive rows (Cloud & Serverless, Web & Product,
AI & Automation, Software Engineering, 3D & Real-time Graphics; evidence-based, no game engines named); the hero reads
"Software engineer · AWS · web · mobile · AI"; the homepage header is transparent everywhere; the case-study pages lost their
placeholders; the project cards describe the real pipeline (Cognito, presigned S3, Step Functions, a container Lambda, DynamoDB)
and ChapterFlow as a live product; Contact's email is the obvious action; back-to-top is a veiled jump; phone compositions lift
into view during the read pin; the exit runs at pace 110 and the bridge at 160; rack chapters shade with a neutral night. Source:
a three-lens Opus design critique of the live page (`films-src/qa/part5/critique-1/`).

## Lab gate
A local gate that measures how well the film keeps up with a steady scroll, so every later change to how frames load is judged by
numbers and not by feel. It changes nothing a visitor sees. Setup, placeholder frames and the Playwright specs are in
`docs/film-lab-gate.md`; the manual QA it complements is `.claude/agents/scroll-qa.md`.

**Why.** On phones the film lags: the loader delivers 20 to 30 frames per second while a 600 px/s scroll needs 40 to 60, it has no
memory cap, a pass makes about 1,100 to 1,240 requests, and a one-way pass refetches nothing (measured on the live site before this
work). The gate reproduces that picture on a local production build and puts a number on each part of it.

**What it measures.** `scripts/films/scrub-quality.mjs` drives one steady, time-based scroll pass through the home page per profile
(and, with `--back`, the same pass back up, reported separately). Profiles: `desktop` (Chromium 1440x900, DPR 2, 900 px/s),
`iphone` (WebKit, device "iPhone 14", 600 px/s), `slowphone` (Chromium 390x844 mobile, DPR 3, CPU 4x slower, 9 Mbit/s down,
1.5 up, 165 ms latency, 600 px/s). The engine's counters (`window.__filmStats`, reset right before the pass) say what the canvas
showed; Playwright's request events say what went over the network; the script samples the browser's own frame clock and long
tasks itself. It refuses any page that is not localhost or 127.0.0.1 unless both `--cap` and `--allow-remote` are given, and it
never runs against the live site in this repository's workflow.

**How to run it.** A production build and server first (never `next dev`):
```bash
# placeholder frames (served from public/films; what CI uses)
npm run film:placeholder
NEXT_DIST_DIR=.next-film NEXT_PUBLIC_FILM_BASE=/films npx next build
NEXT_DIST_DIR=.next-film npx next start --hostname 127.0.0.1 --port 3006
# real frames from the film CDN (a local page may load them; it is how the site works)
NEXT_DIST_DIR=.next-film-cdn npx next build
NEXT_DIST_DIR=.next-film-cdn npx next start --hostname 127.0.0.1 --port 3007
# the gate
npm run film:quality -- --base http://127.0.0.1:3007 --back --json out.json
npm run film:quality -- --profiles iphone --speed 400 --assert thresholds.json
```
Options: `--base`, `--profiles desktop,iphone,slowphone`, `--speed <px/s>`, `--back`, `--cap <requests>`, `--allow-remote`,
`--json <file>`, `--assert <file>` (`{"*" or "<profile>": {"pass.exactShare": {"min": 97}}}`, dot paths into the JSON; exit 1 when
one is missed; nothing is enforced by default yet), `--headed`. The Playwright specs (`npm run test:film`) check correctness on
placeholder frames (every film painted, the frame read back from the canvas equals `data-frame`, no 4xx/5xx, no console errors,
viewports, reduced motion); they have no timing thresholds.

**The counters.** Frames requested (`requests`), asked for a second time in the page load (`refetches`), decoded and failed
(`decodes`, `failures`); `inflightPeak`; frames held and their estimated size, width x height x 4 bytes each, MB = 10^6
(`framesAlivePeak`, `decodedMBPeak`); canvas paints, split into exact (the effective target) and fallback (any other frame) with the
summed distance to the effective target (`draws`, `exactDraws`, `fallbackDraws`, `fallbackDistance`); clock ticks, ticks that ended
with the canvas not showing the effective target (`staleTicks`), the time spent so (`staleMs`) and the longest continuous stretch
(`staleMsMax`). The effective target (`effectiveFrame`, beside the raw `targetFrame`) is the target frame, or, where the engine never
loads that frame by design (odd breathing-tail frames on a coarse pointer, frames between the reduced-motion stills), the nearest
frame it does load. Also `held` (draw declined because a nearer frame was coming); `canvasResizes` (backing-store reallocations); `measures` (layout read batches). The script's
columns: "exact %" = exactDraws / draws, "stale %" = staleTicks / ticks, "mean fallback dist" = fallbackDistance / draws (an exact
paint counts 0), "settle ms" = time from the scroll stopping until the canvas shows the effective target (null: not within 10 s). Full
list and where the engine updates each: `docs/film-lab-gate.md`.

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

**Targets set by the plan** (none is enforced yet):
- the exact frame on 97 % of draws at 600 px/s on the phone profile without throttling;
- on Fast 4G: a mean fallback distance of 4 frames or less, and the exact frame within 1 s of stopping;
- longest stale stretch 100 ms or less;
- 30 requests or fewer per pass;
- decoded frames within 160 MB on phones and 384 to 512 MB on desktop;
- scrolling back costs 0 requests;
- 0 canvas reallocations when the address bar moves.

### Stage 4: budget loader
The second loader (`components/film/loader/budget.ts`, the default; the legacy loader stays selectable with `?loader=legacy`) against the
legacy one, on **real frames**. Design and counters: "The budget loader" in `docs/film-lab-gate.md`.

**Setup.** Date 2026-11-13, commit `84e879ab` (the gate script and specs of this stage are added on top; no engine file changed).
Machine: Apple M1 laptop, macOS 26.5, Node 20.20.2, Playwright 1.62.1, Chromium 151.0.7922.34, WebKit 26.5. Local production build
without `NEXT_PUBLIC_FILM_BASE` (`NEXT_DIST_DIR=.next-film-cdn`) on 127.0.0.1:3006, frames from the film CDN. Three rounds, alternating
(legacy, budget, legacy, budget, legacy, budget), each `npm run film:quality -- --profiles desktop,iphone,slowphone --back`;
legacy with `--query "loader=legacy"`, budget with `--query "loader=budget"` and, for iphone and slowphone,
`--query-iphone/--query-slowphone "loader=budget&budget=160"` (the lab browsers report a desktop memory size, so the real default
budget applies on desktop: 536.9 MB = 512 MiB; the two phone profiles ran at 167.8 MB = 160 MiB). Cells: median of the three runs
and, in brackets, min to max. "Network film-frame requests" are Playwright request events for `f_NNNN.webp`; "engine requests" the page's own
count (WebKit answers a repeat load without an event, and reports each `createImageBitmap(Blob)` as a `blob:` event, so read these two rows,
not "requests (all)", on the iphone profile).

**The machine was not quiet.** Another session on this computer ran iOS builds the whole time: the 1-minute load average at the start of
the six runs was 21.5, 23.9, 13.5, 12.0, 12.8 and 4.2 (round 3's budget run: 4.2, then 5.4 at its end; 8 cores). Run-to-run noise is
therefore larger than in the stage 1 baseline (legacy slowphone exact draws 74.3 to 84.2 %, and the one budget outlier below is in
round 1, the loaded one). Two more alternating rounds were run afterwards (loads 7.5 and 3.8 at their start, but the machine
spiked to 87 during round 4's budget run); they are not in the table, only quoted below.

**Later fixes not in these numbers.** Every row below predates two failure-path fixes to the budget loader (failed fetches of
frames other than the target are retried; a decoder that rejects the frames moves to main-thread decodes, then to the legacy
loader). Both act only when a fetch or a decode fails, and these runs had 0 failed frames and 0 failed responses on every leg,
so they were not re-run.

**Pass down**

| | desktop legacy | desktop budget | iphone legacy | iphone budget | slowphone legacy | slowphone budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| network film-frame requests | 1384 | 1384 | 1288 | 1288 | 1130 (1072 to 1135) | 1144 (1124 to 1147) |
| engine requests | 1384 | 1384 | 1288 | 1288 | 1130 (1072 to 1136) | 1144 (1124 to 1148) |
| refetches | 0 | 0 | 0 | 0 | 0 | 0 |
| redecodes | 0 | 0 | 0 | 0 | 0 | 0 |
| exact draws % | 99.1 (98.9 to 99.2) | 98.8 (98.5 to 100) | 100 (99.9 to 100) | 100 (97 to 100) | 81.1 (74.3 to 84.2) | 82.1 (80.4 to 84) |
| stale ticks % | 1.4 (1.4 to 1.8) | 2.2 (0.2 to 2.2) | 0.2 (0.2 to 0.4) | 0.3 (0.2 to 2.3) | 32 (30.8 to 38.2) | 34 (32.6 to 35.1) |
| longest stale ms | 67 (51 to 67) | 51 (32 to 83) | 37 (35 to 52) | 33 (32 to 287) | 566 (515 to 583) | 552 (517 to 669) |
| mean fallback distance (frames) | 0.01 | 0.01 (0 to 0.02) | 0 | 0 (0 to 0.03) | 0.3 (0.24 to 0.46) | 0.34 (0.32 to 0.39) |
| settle ms after stop | 17 | 17 | 16 (16 to 17) | 16 (13 to 17) | 17 (16 to 17) | 18 (17 to 19) |
| frames alive peak | 611 | 64 | 611 | 103 | 383 (332 to 388) | 103 |
| decoded MB peak | 5067.9 | 530.8 | 987.5 | 166.6 | 619.5 (537 to 627.6) | 166.6 |
| budget MB | 0 | 536.9 | 0 | 167.8 | 0 | 167.8 |
| bytes held MB peak | 0 | 27.5 | 0 | 7.9 | 0 | 7.1 (7.1 to 7.2) |
| in-flight peak | 6 | 6 | 6 | 6 | 6 | 6 |
| frames over 33 ms | 0 (0 to 1) | 1 (0 to 1) | 0 (0 to 10) | 3 (2 to 15) | 2 (0 to 5) | 1 (0 to 1) |
| long tasks (count) | 0 | 1 (0 to 1) | 0 | 0 | 0 (0 to 2) | 1 (0 to 1) |
| long tasks (total ms) | 0 | 95 (0 to 130) | 0 | 0 | 0 (0 to 1572) | 417 (0 to 755) |
| console errors | 0 | 0 | 0 | 0 | 0 | 0 |

**Return leg**

| | desktop legacy | desktop budget | iphone legacy | iphone budget | slowphone legacy | slowphone budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| network film-frame requests | 992 | 0 | 0 | 0 | 998 (986 to 1016) | 144 (139 to 164) |
| engine requests | 992 | 0 | 896 | 0 | 998 (986 to 1016) | 144 (139 to 164) |
| refetches | 992 | 0 | 896 | 0 | 835 (800 to 840) | 0 |
| redecodes | 0 | 1368 (1361 to 1378) | 0 | 1243 (1200 to 1243) | 0 | 815 (803 to 840) |
| exact draws % | 100 | 100 | 100 | 100 | 100 | 100 |
| stale ticks % | 0 | 0 | 0 | 0 | 0 | 0 |
| longest stale ms | 0 | 0 | 0 | 0 | 0 | 0 |
| mean fallback distance (frames) | 0 | 0 | 0 | 0 | 0 | 0 |
| settle ms after stop | 17 | 17 (17 to 18) | 17 (16 to 17) | 17 (17 to 18) | 16 (15 to 17) | 16 (16 to 17) |
| frames alive peak | 611 | 64 | 611 | 103 | 611 | 103 |
| decoded MB peak | 5067.9 | 530.8 | 987.5 | 166.6 | 987.5 | 166.6 |
| budget MB | 0 | 536.9 | 0 | 167.8 | 0 | 167.8 |
| bytes held MB peak | 0 | 27.5 | 0 | 7.9 | 0 | 7.9 |
| in-flight peak | 6 | 0 | 6 | 0 | 6 | 6 |
| frames over 33 ms | 2 | 1 (0 to 3) | 1 (0 to 1) | 0 (0 to 8) | 1 (0 to 10) | 0 (0 to 5) |
| long tasks (count) | 2 (1 to 2) | 1 (0 to 3) | 0 | 0 | 1 (0 to 3) | 0 (0 to 5) |
| long tasks (total ms) | 314 (284 to 806) | 106 (0 to 1415) | 0 | 0 | 271 (0 to 2055) | 0 (0 to 2269) |
| console errors | 0 | 0 | 0 | 0 | 0 | 0 |

**Verdict per line** (three required runs; "five runs" adds the two later rounds, read from the same JSON):

- (a) decoded MB peak within the budget in every run: **pass.** In all five budget runs and every leg: desktop 530.8 of 536.9 MB, iphone
  and slowphone 166.6 of 167.8 MB. Legacy held 5,068 / 988 / 620 MB (median) on the same passes: a tenth to a quarter of it.
- (b) return leg: 0 network frame requests and 0 refetches: **refetches pass, requests miss on the slow phone.** Refetches are 0 on every
  budget leg of every run (legacy 992 / 896 / 835). Frame requests on the way back are 0 on desktop and iphone; on slowphone they are
  139 to 164 (legacy about 1,000), all first fetches of frames the pass moved past before they arrived over the 9 Mbit/s link, not
  refetches. The bytes were never held, so nothing could be served from them.
- (c) exact draws and stale ticks on desktop and iphone no worse than legacy beyond the run-to-run range: **miss as measured, not
  reproduced later.** Exact draws are inside legacy's range on both (desktop 98.8 vs 99.1 %, iphone 100 vs 100 %). Stale ticks:
  desktop 2.2 vs 1.4 % (budget runs 2.2, 2.2, 0.2: two of three above legacy's 1.4 to 1.8), iphone median 0.3 vs 0.2 % but round 1
  was an outlier (97 % exact, 2.3 % stale, 287 ms longest stale, with a load of 24 to 30). In the two later rounds budget was equal
  or better (desktop stale 0.5 and 0.2 % vs legacy 2.0 and 1.6 %; iphone 0.2 and 0.4 % vs 0.2 and 0.4 %); over all five runs the
  desktop median stale is 0.5 % (budget) vs 1.6 % (legacy). Three loaded runs cannot separate a real cost from noise; the later runs
  say there is none worth measuring, but they were not the required three.
- (d) slowphone, exact draws not lower, stale ticks not higher, longest stale not longer than legacy medians: **miss on stale ticks.**
  Exact draws 82.1 vs 81.1 % (pass), longest stale 552 vs 566 ms (pass), stale ticks 34 vs 32 % (miss by 2 points, inside both
  loaders' ranges; five runs 33.1 vs 32). Mean fallback distance 0.34 vs 0.30 frames. The slow phone is network-bound here (9 Mbit/s,
  6 requests in flight, 1,100 requests): this stage changes where frames are decoded and kept, not how many are asked for or how
  fast they arrive, and both loaders sit at about a third of ticks stale and 0.5 s of longest stale stretch against the plan's 100 ms.
- (e) no console errors, no failed frames: **pass.** 0 console errors, 0 failed frames and 0 failed responses on every leg of
  all ten runs.
- (f) frames over 33 ms and long tasks not worse than legacy: **miss on the pass leg, better on the return leg.** Pass leg medians:
  frames over 33 ms desktop 1 vs 0, iphone 3 vs 0, slowphone 1 vs 2; long tasks desktop one task (95 and 130 ms) in 2 of 3 runs vs none, slowphone
  417 ms total vs 0 (budget one task in each run; legacy two in its loaded round 1). Return leg: desktop 106 vs 314 ms of long
  tasks, slowphone 0 vs 271 ms, frames over 33 ms equal or fewer. Over five runs the pass-leg medians are level (long tasks 0 vs 0,
  frames over 33 ms 1 vs 0 desktop, 2 vs 1 iphone, 0 vs 1 slowphone). The long tasks were not profiled; the source (worker start,
  `createImageBitmap` hand-off, the page's own scripts) is not known.

**What it shows.** The loader does what it was built for: decoded memory drops from 0.6 to 5.1 GB to the budget, a scroll back costs
no refetch and, outside the slow link, no request, and the way back is exact (100 % exact, 0 stale) while decoding 800 to 1,370
frames again from kept bytes (mean decode 1.5 to 6.7 ms in the worker, at most 3 decodes at once). Compressed bytes held peak at 27.5 MB
(desktop) and 7 to 8 MB (phone profiles), far under the 160 / 48 MiB caps. It does not move the slow phone's delivery shortfall; that
needs fewer, larger requests (the pack stage) and is the place to look for the plan's 100 ms and 4-frame targets.

**What the lab cannot show.** A real iPhone's memory ceiling (the lab's 160 MiB is a figure, not a limit: Safari's tab-kill point and
how it counts `ImageBitmap` memory against it differ from a Mac's), its decode speed (an M1 decodes a frame in 1.5 to 7 ms in the
worker; an A-series phone under thermal pressure may be several times slower, which the 4x CPU throttle only approximates, and the
decode cap of 2 at once was not tuned against it), and a real mobile network (the CDN is close to this machine). The first and the
last of these need a phone on the page with `?hud=1&loader=budget` against `?loader=legacy`.

### Stage 7: packs
One file per film directory and width holding all its frames (`docs/film-lab-gate.md`, "Packs" and "Packs at run time"), read by the
budget loader with a few streaming reads instead of one request per frame. The per-frame path stays the fallback (`?pack=0`, and any
film whose pack fails).

**Setup.** Date 2026-11-13, commit `e1bd0a6c`. Same machine and versions as stage 4 (Playwright 1.61.0 as installed now). The packs
are built (`npm run film:pack -- --from-cdn --all`, 46 packs) but not uploaded, so the page cannot read them from the CDN yet: these
runs use a lab-only static server on 127.0.0.1:3008 (a scratch script, not in the repository) that serves the real packs from the
build's output tree (Range, strong ETag, `immutable`, CORS with the CDN's exposed headers), cuts each per-frame file out of the same
pack, and proxies the posters from the CDN once; the page was built with `NEXT_PUBLIC_FILM_BASE=http://127.0.0.1:3008/films`
(`NEXT_DIST_DIR=.next-film-cdn`) on 127.0.0.1:3006. So both modes read the same bytes from the same server; it speaks HTTP/1.1, not
the CDN's HTTP/2. Three rounds per profile, alternating packs (default), `?pack=0` (budget loader, one file per frame) and
`?loader=legacy`; `--back`; slowphone with `budget=160` for both budget variants. Cells: median and, in brackets, min to max.

**The machine was badly loaded.** Other sessions kept the 1-minute load average between 29 and 80 (8 cores) through every run, and
several runs had main-thread stalls of seconds (a 9.2 s long task in one slowphone pack run, 28 s in one desktop pack run, 9.7 s
in a desktop legacy run, 12.9 s in a desktop `?pack=0` return leg). The scroll is time-based, so a stall becomes a jump. Read the
ranges, not only the medians, and no difference inside them is claimed.

**Slow phone** (9 Mbit/s, 165 ms, CPU 4x; load 33 to 51)

| | packs | `?pack=0` | legacy |
| --- | ---: | ---: | ---: |
| before the first scroll: film data requests / MB | 1 / 0.49 | 58 / 0.52 | 58 / 0.52 |
| pass: film data requests | 11 (11 to 18) | 1159 (1132 to 1181) | 1109 (1099 to 1205) |
| pass: film data MB | 7.72 (7.72 to 8.48) | 6.66 (6.52 to 6.67) | 6.38 (6.18 to 6.43) |
| pass: exact draws % | 99.8 (98.8 to 99.8) | 80.2 (79.5 to 83.2) | 80.5 (80.3 to 81) |
| pass: stale ticks % | 0.5 (0.5 to 8) | 30.5 (30.5 to 31) | 34 (33.3 to 34.5) |
| pass: longest stale ms | 115 (103 to 721) | 384 (373 to 587) | 582 (565 to 817) |
| pass: settle ms after stop | 17 | 17 (16 to 17) | 17 |
| pass: mean fallback distance | 0 (0 to 0.01) | 0.33 (0.32 to 0.35) | 0.36 (0.34 to 0.39) |
| pass: decoded MB peak (budget 167.8) | 166.6 | 166.6 | 592 (590 to 727) |
| back: film data requests | 0 | 129 (71 to 156) | 1008 (896 to 1011) |
| back: exact draws % / longest stale ms | 100 (99.4 to 100) / 53 (0 to 97) | 100 / 0 | 100 / 0 |
| console errors | 0 | 0 | 0 |

**Desktop** (unthrottled; load 38 to 80)

| | packs | `?pack=0` | legacy |
| --- | ---: | ---: | ---: |
| before the first scroll: film data requests / MB | 1 / 1.61 | 58 / 1.67 | 58 / 1.67 |
| pass: film data requests | 12 (12 to 13) | 1384 (1336 to 1384) | 1383 (798 to 1384) |
| pass: exact draws % | 99.8 (99.3 to 100) | 90.1 (85 to 96.6) | 83.5 (50 to 84) |
| pass: stale ticks % | 1.2 (0 to 1.2) | 13.5 (4.2 to 19.1) | 21.4 (17.3 to 53.4) |
| pass: longest stale ms | 68 (0 to 341) | 234 (217 to 312) | 582 (239 to 9742) |
| pass: decoded MB peak (budget 536.9) | 530.8 | 530.8 | 4139 |
| back: film data requests | 0 (0 to 4) | 0 (0 to 48) | 992 (520 to 992) |
| back: stale ticks % / longest stale ms | 1.2 (1.2 to 6.8) / 150 (80 to 343) | 0.3 (0 to 0.6) / 17 (0 to 73) | 0 (0 to 0.4) / 0 (0 to 81) |

**iPhone** (WebKit, unthrottled; load 28 to 37)

| | packs | `?pack=0` | legacy |
| --- | ---: | ---: | ---: |
| pass: film data requests | 11 | 1288 | 1288 |
| pass: exact draws % | 93.4 (88.6 to 99.4) | 80.8 (77.3 to 95.7) | 91.7 (88.2 to 93.6) |
| pass: stale ticks % | 6.8 (1.1 to 15.1) | 19.4 (4.6 to 23.6) | 6.8 (4.7 to 9.6) |
| pass: longest stale ms | 145 (102 to 1415) | 942 (100 to 1839) | 723 (485 to 1440) |
| back: film data requests | 0 | 0 | 896 (page count) |
| back: stale ticks % / longest stale ms | 8.4 (2.7 to 9.8) / 547 (71 to 669) | 2.4 (0.5 to 7.8) / 69 (67 to 334) | 0 / 0 |

**Where the longest stale stretch begins** (the new stale locator, `staleMax*`). With one file per frame on the slow phone it began
where one film hands over to the next: tower-01-p's last frames into tower-04-p (the bridge, 160 film frames per viewport), about
28 s into the pass, in three of four runs before the fix below (rack-01-p's first frames in the fourth), with the next film's first
frames still queued: the planner fetched the film ahead's entry frame only after every stride-2 and stride-1 frame of the active
film. After the fix the longest stretch still falls at that hand-over in two of three runs (the per-frame path cannot fetch the
bridge as fast as it plays on 9 Mbit/s), only shorter. Fixed (`budget-plan.ts` `NEXT_HEAD_FRAMES`: the film
ahead's entry, 0, M, last and every 4th of its first 32 frames now come right after the active film's coarse passes; unit test);
the slowphone `?pack=0` longest stretch went from 551 (517 to 757) to 384 (373 to 587) ms and stale ticks from 32.9 (32.7 to 36.2)
to 30.5 (30.5 to 31) %, between rounds on the same loaded machine. With packs it began on the first scroll, at the hero's first
frames: once the hero's skeleton was in, the next film's skeleton took the first read and the hero's own full read waited for it
(116 to 161 ms). Fixed (at most one full read, assigned in list order; unit test); what remains (103 and 115 ms) is one round trip
after the first scroll, the hero's rest being read only once the visitor engages. The one 721 ms pack run followed a 9.2 s stall.
On the unthrottled profiles the longest stretches are "decoding" or "bytes held, decode not started": decode-bound, not network.

**Packs: second visit** (same browser context, page reloaded, the same scroll; checked against the lab server's log). Chromium served
all 8 pack reads of the second visit from its HTTP cache, packs read whole and packs read in part alike (it caches the 206
answers and rewrote an open-ended `bytes=n-` into a closed range for the server on the first visit); the per-frame control did the
same (0 of 58 frames reached the server). Playwright's WebKit sent every request to the server again, the 206 reads, the plain
200 GETs and, in the control, every per-frame file (58 of 58): its lab context does not serve these fetches from a cache across a
reload, so what Safari on a phone does is not known from here.

**Verdict per target:**
- film data requests per pass 30 or fewer: **pass** (11 to 18 slow phone, 12 to 13 desktop, 11 iphone; placeholder specs 9 to 11).
- slow phone stale under 10 %, longest under 250 ms: **pass on the medians** (0.5 %, 115 ms); one stalled run 8 % and 721 ms. Both
  far better than `?pack=0` and legacy, whose ranges do not overlap with the packs' medians.
- exact frame within 1 s of stopping: **pass** (settle 17 ms medians; one desktop pack run 416 ms).
- desktop and iphone no worse than today: **pass on the pass leg** (desktop much better; iphone inside the ranges). The return leg
  with packs measured worse medians on both (desktop 1.2 vs 0.3 % stale, iphone 8.4 vs 2.4 %), inside the run-to-run ranges, with
  every leg decode-bound (decode means 14 to 21 ms in both modes) and long tasks of 0.1 to 1.6 s in most return legs; no
  difference is claimed, and it is the thing to re-measure on a quiet machine.
- decoded memory within the budget: **pass** (166.6 of 167.8 MB, 530.8 of 536.9 MB).
- way back 0 requests: **pass** on the slow phone and iphone (0 in every run), desktop 0 in two runs and 4 in one (films the pass
  outran, read at the end of the list).
- before the first scroll no more film bytes than today: **pass** (0.49 vs 0.52 MB phone profiles, 1.61 vs 1.67 MB desktop; one
  request). On placeholder packs it is more (0.13 vs 0.03 MB desktop) because the manifests' hints are the real packs' sizes, so the
  closed range of the first read covers the whole small placeholder pack.
- 0 console errors: **pass**.

**What the lab cannot show.** The packs were read from a local HTTP/1.1 server, not the CDN (HTTP/2, edge caches); the CDN's
behaviour with packs (Range from cache, Content-Range exposure) is checked by `npm run film:pack -- --check-cdn` once they are
uploaded, and the gate should then be re-run against the CDN-built page. A real phone's decode speed and Safari's cache are open,
as in stage 4.

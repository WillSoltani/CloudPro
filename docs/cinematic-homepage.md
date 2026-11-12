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

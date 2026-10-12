# Cinematic homepage — creative brief

Goal: turn the soltani.org homepage into a scroll-scrubbed cinematic film in the spirit of pear.no, while it stays a fast, skimmable portfolio. Technique, workflow, and budgets: `.claude/skills/cinematic-scroll/SKILL.md`.

## Who it's for
- **Will Soltani** — cloud engineer in Toronto, ON (moved from Halifax, NS in 2026); AWS-certified (Solutions Architect Associate, Developer Associate, Cloud Practitioner); co-founder at Silicon X; builds ChapterFlow; UBC Computer Science.
- **Audience** — hiring managers and engineers evaluating him for remote cloud roles in Canada. They skim. The film earns attention; the facts must still be findable in seconds.

## Keep
About, Certifications (with Credly links), Skills, Projects and case studies, Experience, Contact. Source of truth is `content/*.ts`. All of it stays real HTML; invent nothing.

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
- **Upload frames** — `scripts/films/sync-film.sh reel-01 --write-manifest` (then `reel-05`, `tower-03`, `tower-04`) (bucket and domain come from the outputs file, or `FILMS_BUCKET`/`FILMS_DOMAIN`). It syncs only `*.webp` with immutable caching and never `--delete`, refuses a name that already has a manifest in the bucket (`--force` to override), verifies the CDN (200, `image/webp`, `immutable`, ACAO `*`, http→https, direct S3 URL 403, object count and bytes match local), then rewrites only `base`/`poster` in `public/films/<film>/manifest.json`. `git status --short public/films` must show only the four manifests; re-run `scroll-qa` against the CDN before committing them. The `beacon*` films were never uploaded and are deleted.
- **Credits** — part one 534 (`films-src/beacon/ledger.md`), part two 360 (`films-src/beacon2/ledger.md`, superseded), part three 1,443 per Higgsfield transactions (`films-src/reel/ledger.md`).

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

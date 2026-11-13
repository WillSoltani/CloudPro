# soltani.org — cloud-portfolio

Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind 4 · framer-motion. AWS: DynamoDB, S3, Step Functions, Lambda, Cognito; CDK in `infra/` (its own package.json).

## Two surfaces, one app
`app/layout.tsx` switches on the request host: soltani.org is the portfolio; ChapterFlow hosts (`app/_lib/chapterflow-brand`) get their own background and the `app/book/**` routes. Portfolio homepage work must not change ChapterFlow surfaces.

## Commands
- `npm run dev` — http://localhost:3000 (`.claude/launch.json` runs it on 3005 for previews and QA)
- `npm run verify` — lint + typecheck + build (CI also runs `test:pdf-fill` and the infra synth)
- `npm run test:film-unit` and `npm run test:film` — film counters' unit tests, and the Playwright film specs on placeholder frames (`npm run film:placeholder` first; production build, never `next dev`; `docs/film-lab-gate.md`)
- `npm run film:quality -- --back` — the scroll-pass lab gate against a local production server (`--base`, default 127.0.0.1:3006; refuses non-local pages); baseline and targets in "Lab gate", `docs/cinematic-homepage.md`

## Homepage
`app/page.tsx` → `components/HomeClient.tsx` → `Hero` + `sections/*`; copy lives in `content/*.ts`. `components/InteractiveBackground.tsx` is a particle canvas mounted by the root layout.

## Cinematic homepage
Use the `cinematic-scroll` skill (technique, pipeline, budgets) with the `film-director` and `scroll-qa` agents; the brief and open decisions are in `docs/cinematic-homepage.md`. Higgsfield MCP generations cost credits — never generate past the approval gates the skill defines. Raw generations go in `films-src/` (gitignored); built frames in `public/films/`. Ship with `scripts/films/sync-film.sh <film> --write-manifest` (S3 + CloudFront, `CloudPortfolioFilms` stack): frames are gitignored, manifests are committed.

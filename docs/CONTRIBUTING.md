# Contributing

Author: Will Soltani

## 1) Development Principles
- Preserve deterministic behavior in conversion/fill pipelines.
- Keep conversion capability rules centralized in `app/app/_lib/conversion-support.ts`.
- Do not expose UI options that backend cannot execute.
- Prefer explicit, scoped state transitions; avoid cross-list side effects.

## 2) Repository Conventions

### 2.1 Frontend
- App Router pages and route handlers live under `app/`.
- Project workspace feature code lives under `app/app/projects/[projectId]/`.
- Keep large UI modules split by responsibility:
  - components/
  - hooks/
  - `_lib` utilities/types/api clients
- Shared site components remain in top-level `components/` and `sections/`.

### 2.2 Backend (Next.js API)
- Place reusable helpers in route-local `_lib` modules when scope is endpoint-specific.
- Always gate by authenticated user (`requireUser`) and project ownership.
- Use strict request validation with explicit error codes/messages.

### 2.3 Infra and worker
- CDK stack source is `infra/lib/storage-stack.ts`.
- Worker source is `infra/lib/lambdas/convert-worker/*`.
- If worker imports new local modules, update Docker build context COPY steps accordingly.

## 3) Naming and Patterns
- Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for global constants only
- Route handlers: keep HTTP verb function near top-level (`GET/POST/DELETE`)
- Prefer narrow utility modules over large mixed files.

## 4) Adding a New Conversion Format Safely
1. Add/adjust source and output mappings in `conversion-support.ts`.
2. Update worker conversion logic (`index.ts` and/or Python helpers).
3. Ensure content-type and extension mapping exists (worker `lib/formats.ts` and frontend helpers as needed).
4. Add or update tests in `infra/lib/lambdas/convert-worker/tests/` and relevant frontend tests.
5. Validate UI disable rules and backend rejections are consistent.
6. Confirm same-format re-encode behavior remains intentional.

## 5) Adding a New UI Feature Safely
1. Implement feature in the closest feature directory (`app/app/projects/[projectId]/...` when project-specific).
2. Keep server API contracts backward compatible unless migration is planned.
3. Isolate side effects in hooks; keep components mostly presentational.
4. Verify behavior in both list and detail contexts when applicable.
5. Add unit tests for deterministic utilities and critical state transitions.

## 6) Testing and Quality Expectations
Run before opening changes:
```bash
npm run test:pdf-fill
npm run lint
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

When worker changes are involved, also validate Docker image build and worker tests.

## 7) Generated/Vendored Files
Do not hand-edit generated or vendored output:
- `.next/`
- `infra/dist/`
- `infra/cdk.out/` and root `cdk.out/`
- `node_modules/`
- `infra/lib/lambdas/convert-worker/node_modules/`

## 8) Pull Request Checklist
- Behavior unchanged unless explicitly intended.
- Capability matrix + UI + backend are aligned.
- No dead options, no silent fallback failures.
- Logs are actionable for failure diagnosis.
- Documentation in `/docs` updated when architecture/contracts changed.

# Efficiency + Production Readiness Audit

Date: 2026-03-07
Scope: Entire repository (frontend, backend, infra, scripts)
Constraint followed: No project files modified. Only this report was created.

## A) Executive Summary

- **[Importance: High] [Area: Frontend] [Estimated impact: ~15–35% fewer preview-related API calls]** `useSignedUrls` currently refetches frequently and sequentially (batch loop + state dependency feedback), causing avoidable network chatter and render churn.
- **[Importance: High] [Area: Backend] [Estimated impact: ~20–40% lower memory pressure per conversion]** Convert worker loads full S3 objects into memory (`asBuffer`) and often creates additional full-size intermediate buffers/files.
- **[Importance: High] [Area: Infra/Cost] [Estimated impact: ~15–30% lower monthly storage + request cost]** No visible S3 lifecycle policy for raw/output artifacts; long-lived converted artifacts will accumulate cost.
- **[Importance: High] [Area: Infra] [Estimated impact: ~20–45% lower cold-start latency]** Lambda container includes heavy toolchain/runtime components (LibreOffice/fonts/Python codecs) with likely large image size.
- **[Importance: Medium] [Area: Backend/API latency] [Estimated impact: ~10–25% lower API latency at scale]** Several project/file lookups scan with `FilterExpression` over paginated query windows instead of key-addressable access patterns.
- **[Importance: Medium] [Area: Frontend] [Estimated impact: ~10–30% smoother large-list UX]** Ready/Converted lists are fully rendered with no virtualization/windowing.
- **[Importance: Medium] [Area: Frontend/PDF UX] [Estimated impact: ~10–30% faster interaction on large PDFs]** Fill page (`FillPdfClient`) is a very large client component with broad state and heavy page rendering work.
- **[Importance: Medium] [Area: Security/Cost] [Estimated impact: ~10–25% fewer signed-URL regenerations]** Download/preview presigns use short TTL and are re-requested frequently, increasing API and S3-signing overhead.
- **[Importance: Medium] [Area: CI/CD] [Estimated impact: ~20–50% lower deploy risk]** No CI workflow files were found; build/test/deploy gates appear manual.
- **[Importance: Low] [Area: Security/Dependencies] [Estimated impact: ~risk reduction more than performance]** `aws-sdk` v2 is still present and flagged by npm audit; migration to v3-only reduces maintenance/security surface.

### What NOT to change yet
- **[Importance: High]** Do not alter conversion logic ordering (especially PAGES/SVG/AVIF fallback paths) without fixture-based regression tests.
- **[Importance: High]** Do not shorten Lambda timeouts before profiling real p95/p99 conversion durations in production.
- **[Importance: Medium]** Do not enable aggressive output cleanup lifecycle until retention/SLA expectations are agreed.
- **[Importance: Medium]** Do not split FillPdfClient behavior yet in a broad refactor during active bugfixing unless covered by interaction tests.

---

## B) Efficiency Findings (Detailed)

### Category 1: Frontend performance

#### Finding F1 — Signed URL refresh loop drives avoidable network churn
- **Importance:** High
- **Location(s):** `app/app/projects/[projectId]/hooks/useSignedUrls.ts` (`useEffect`, `run`, `need/batch` loop)
- **Why it’s inefficient:** Effect depends on `signedUrls`, and each successful URL fetch updates state, retriggering effect. Fetching is sequential inside batch (`for ... await getInlineUrl`) and can create a repeated waterfall.
- **Recommended fix (no code changes yet):**
  1. Compute needed IDs from stable inputs and process in parallel with bounded concurrency.
  2. Remove direct `signedUrls` object from dependency feedback loop (derive stale IDs via memoized snapshot or reducer).
  3. Add TTL-aware cache with in-flight dedupe keyed by `projectId:fileId`.
- **Estimated efficiency gain:** ~15–35% fewer preview URL fetches; ~5–15% reduced client-side re-render pressure.
- **Risk level:** Medium
- **Validation method:** Compare `getInlineUrl` call count/session before vs after; track median preview open latency and React commit counts.

#### Finding F2 — File preview/download URL endpoint called per-item without bulk path
- **Importance:** Medium
- **Location(s):** `app/app/projects/[projectId]/_lib/api-client.ts` (`getInlineUrl`), `app/app/api/projects/[projectId]/files/[fileId]/download/route.ts`
- **Why it’s inefficient:** Per-file URL fetch pattern scales linearly with visible items; no batch pre-sign endpoint means more round trips and server work.
- **Recommended fix (no code changes yet):**
  1. Add optional batch endpoint for inline URLs.
  2. Cache signed URLs in-memory by expiry and reuse until threshold.
  3. Keep single-file endpoint for fallback.
- **Estimated efficiency gain:** ~10–30% faster file-list hydration for medium/large projects.
- **Risk level:** Medium
- **Validation method:** Measure total API calls and time-to-first-thumbnail for 20/50/100 file projects.

#### Finding F3 — Full list rendering without virtualization
- **Importance:** Medium
- **Location(s):** `app/app/projects/[projectId]/components/ReadyQueue.tsx`, `app/app/projects/[projectId]/components/ConvertedFiles.tsx`
- **Why it’s inefficient:** Entire list renders and updates on every relevant state change; heavy when many rows and controls exist.
- **Recommended fix (no code changes yet):**
  1. Add list virtualization/windowing for long lists.
  2. Memoize per-row components with stable props.
  3. Keep filtering/sorting memoized at list level.
- **Estimated efficiency gain:** ~10–30% lower main-thread time for large lists.
- **Risk level:** Low
- **Validation method:** React Profiler for list interactions at 100+ items; compare FPS and commit durations.

#### Finding F4 — O(n²)-style source lookup in derived views
- **Importance:** Medium
- **Location(s):** `app/app/projects/[projectId]/ProjectDetailClient.tsx` (`convertedView`, `filledPdfView` mapping + `server.files.find`)
- **Why it’s inefficient:** For each output file, performs lookup over full `server.files` array. Cost rises with project size.
- **Recommended fix (no code changes yet):**
  1. Build a `Map<fileId, FileRow>` once via `useMemo`.
  2. Use O(1) lookups in view mapping.
- **Estimated efficiency gain:** ~5–20% faster view derivation on large file sets.
- **Risk level:** Low
- **Validation method:** Compare JS self-time during `convertedView` compute with 200+ rows.

#### Finding F5 — Fill PDF page is monolithic and state-heavy
- **Importance:** Medium
- **Location(s):** `app/app/projects/[projectId]/fill/[fileId]/FillPdfClient.tsx` (~3255 LOC)
- **Why it’s inefficient:** Large component combines rendering, extraction, validation, export, overlay interaction, and modal logic; high rerender surface and memory pressure.
- **Recommended fix (no code changes yet):**
  1. Split into hooks/modules for rendering, field state, and export pipeline.
  2. Isolate heavy computed maps/selectors with memo boundaries.
  3. Consider virtual page rendering (render visible pages first).
- **Estimated efficiency gain:** ~10–30% improved interaction responsiveness for multi-page PDFs.
- **Risk level:** Medium
- **Validation method:** Profile page load + edit interactions on 20-page PDFs; compare scripting time and memory.

#### Finding F6 — Polling cadence is fixed and potentially chatty
- **Importance:** Medium
- **Location(s):** `app/app/projects/[projectId]/hooks/useServerFiles.ts` (`setInterval` every 4s while processing)
- **Why it’s inefficient:** Fixed polling interval regardless of queue state can generate unnecessary API traffic.
- **Recommended fix (no code changes yet):**
  1. Use adaptive backoff (e.g., 2s → 5s → 10s).
  2. Stop polling immediately when no processing files.
  3. Optionally move to event-based updates later.
- **Estimated efficiency gain:** ~10–25% fewer polling calls during long conversions.
- **Risk level:** Low
- **Validation method:** Count `/files` requests per conversion job lifecycle before/after.

### Category 2: Backend performance

#### Finding B1 — Worker does full-buffer reads and multi-copy transformations
- **Importance:** High
- **Location(s):** `infra/lib/lambdas/convert-worker/index.ts` (`asBuffer`, `preprocessInput`, `applyConversion`, `imageToPdfBuffer`)
- **Why it’s inefficient:** S3 object is fully buffered, then often copied/rewritten to temp files and re-buffered by Python subprocesses and Sharp pipelines.
- **Recommended fix (no code changes yet):**
  1. Introduce size-aware strategy: stream where possible, keep single materialized buffer where unavoidable.
  2. Avoid duplicate `Uint8Array/Buffer` copies between steps.
  3. Use temp-file handoff only when required by external tools.
- **Estimated efficiency gain:** ~20–40% lower peak memory, ~5–20% faster processing on large files.
- **Risk level:** Medium
- **Validation method:** Capture Lambda `MaxMemoryUsed`, duration, and page fault behavior on large fixtures.

#### Finding B2 — API lookup pattern uses paged query + filter scans
- **Importance:** High
- **Location(s):**
  - `app/app/api/projects/[projectId]/route.ts` (`findProject`, `listProjectFiles`)
  - `app/app/api/projects/[projectId]/uploads/route.ts` (`fetchProjectById`)
  - `app/app/api/projects/[projectId]/convert/route.ts` (`fetchProjectById`)
- **Why it’s inefficient:** Query+`FilterExpression` can scan many rows before finding target project/file; increases DynamoDB RCUs and latency with account growth.
- **Recommended fix (no code changes yet):**
  1. Add deterministic key access path or GSI for `projectId`.
  2. Store project row at predictable SK (or maintain lookup item).
  3. Remove scan-like filtered pagination for hot endpoints.
- **Estimated efficiency gain:** ~15–35% lower API latency and read costs on larger datasets.
- **Risk level:** Medium
- **Validation method:** Track DDB consumed capacity and route latency percentiles before/after.

#### Finding B3 — Conversion enqueue path is serial across jobs
- **Importance:** Medium
- **Location(s):** `app/app/api/projects/[projectId]/convert/route.ts` (`for ... of seen` loop)
- **Why it’s inefficient:** Per-job DDB read/write + Step Functions start are processed sequentially, slowing batch convert requests.
- **Recommended fix (no code changes yet):**
  1. Use bounded parallelism for job validation/enqueue.
  2. Keep idempotency and per-item error handling intact.
- **Estimated efficiency gain:** ~10–30% faster enqueue time for large (10–25) conversion batches.
- **Risk level:** Medium
- **Validation method:** Measure request latency with synthetic batch sizes (5/10/25).

#### Finding B4 — Validation mode can issue many S3 HEAD requests
- **Importance:** Medium
- **Location(s):** `app/app/api/projects/[projectId]/files/route.ts` (`validate=1`, `headExists`, `mapLimit`)
- **Why it’s inefficient:** Validation checks each file with S3 HEAD (bounded concurrency 6), potentially expensive for large projects.
- **Recommended fix (no code changes yet):**
  1. Run validation less frequently (only on explicit reconcile or stale markers).
  2. Cache recent existence checks for short windows.
  3. Avoid `validate=1` default for every page load if not needed.
- **Estimated efficiency gain:** ~10–25% fewer S3 requests in active projects.
- **Risk level:** Medium
- **Validation method:** CloudWatch S3 request metrics + API latency with/without aggressive validation.

#### Finding B5 — Sync subprocess model limits intra-invocation concurrency
- **Importance:** Low
- **Location(s):** `infra/lib/lambdas/convert-worker/index.ts` (`runPythonScript` uses `spawnSync`)
- **Why it’s inefficient:** Synchronous subprocess call blocks Node event loop in invocation, limiting overlap opportunities.
- **Recommended fix (no code changes yet):**
  1. Keep as-is for simplicity unless profiling proves bottleneck.
  2. If needed later, migrate to async spawn with strict timeout and log streaming.
- **Estimated efficiency gain:** ~5–10% potential, mostly under mixed workloads.
- **Risk level:** Medium
- **Validation method:** Profile invocation CPU idle/wait time and throughput under load.

### Category 3: Infrastructure efficiency

#### Finding I1 — Lambda container likely oversized for cold starts
- **Importance:** High
- **Location(s):** `infra/lib/lambdas/convert-worker/Dockerfile`
- **Why it’s inefficient:** Includes LibreOffice, many fonts, Python packages, codec plugins, and Node dependencies in one image; cold starts likely expensive.
- **Recommended fix (no code changes yet):**
  1. Measure image size and init duration by function version.
  2. Remove unnecessary runtime packages from final stage.
  3. Consider splitting heavy converters into specialized workers if profile justifies.
- **Estimated efficiency gain:** ~20–45% lower cold-start latency; potential compute cost reduction.
- **Risk level:** Medium
- **Validation method:** Compare Lambda init duration p50/p95 and billed duration across versions.

#### Finding I2 — No explicit lifecycle policy for raw/output buckets
- **Importance:** High
- **Location(s):** `infra/lib/storage-stack.ts` (`rawBucket`, `outputBucket`)
- **Why it’s inefficient:** Without lifecycle transitions/expiration, storage grows unbounded and versioned buckets increase cost.
- **Recommended fix (no code changes yet):**
  1. Define retention for raw uploads and transient outputs.
  2. Add transition rules for older artifacts where retention is required.
  3. Coordinate with product/legal retention requirements first.
- **Estimated efficiency gain:** ~15–30% storage cost reduction over time.
- **Risk level:** Medium
- **Validation method:** Track S3 bytes/object counts and monthly storage/request spend trend.

#### Finding I3 — Step Functions observability settings appear minimal
- **Importance:** Medium
- **Location(s):** `infra/lib/storage-stack.ts` (`StateMachine` definition)
- **Why it’s inefficient:** Limited logging/metrics visibility increases MTTR and hides retry/failure patterns.
- **Recommended fix (no code changes yet):**
  1. Enable Step Functions execution logging with appropriate level.
  2. Add alarms for failed executions and duration anomalies.
- **Estimated efficiency gain:** ~20–40% faster incident diagnosis; indirect cost savings.
- **Risk level:** Low
- **Validation method:** Time-to-diagnose benchmark for synthetic failures before/after observability improvements.

#### Finding I4 — Log retention/cost controls not explicit
- **Importance:** Medium
- **Location(s):** `infra/lib/storage-stack.ts` (no explicit log retention resources observed)
- **Why it’s inefficient:** Default retention can inflate CloudWatch cost and reduce signal-to-noise.
- **Recommended fix (no code changes yet):**
  1. Set explicit retention for Lambda/Step Functions logs.
  2. Keep detailed logs in dev/stage, tighter retention in prod.
- **Estimated efficiency gain:** ~5–20% lower logging/storage cost depending on traffic.
- **Risk level:** Low
- **Validation method:** Compare CloudWatch ingestion + archived GB/month.

#### Finding I5 — Committed build artifacts increase repo/deploy friction
- **Importance:** Low
- **Location(s):** `infra/dist/**` tracked in git
- **Why it’s inefficient:** Generated files in source control increase review noise and risk stale artifacts.
- **Recommended fix (no code changes yet):**
  1. Decide source-of-truth policy for generated files.
  2. If not required, stop tracking `infra/dist` and build in CI.
- **Estimated efficiency gain:** ~5–15% improvement in developer/review throughput.
- **Risk level:** Low
- **Validation method:** PR diff-size and merge-conflict frequency trend.

### Category 4: Security-related efficiency risks

#### Finding S1 — Presigned URL churn due short TTL and per-item fetching
- **Importance:** Medium
- **Location(s):**
  - `app/app/api/projects/[projectId]/files/[fileId]/download/route.ts` (`expiresIn: 60`)
  - `app/app/projects/[projectId]/hooks/useSignedUrls.ts`
- **Why it’s inefficient:** Very short TTL causes frequent refresh calls under normal browsing, increasing server and S3 signing load.
- **Recommended fix (no code changes yet):**
  1. Keep short TTL for security-sensitive paths, but add bounded client cache and pre-expiry refresh strategy.
  2. Consider modest TTL increase for inline previews if threat model allows.
- **Estimated efficiency gain:** ~10–25% fewer URL refresh calls.
- **Risk level:** Medium
- **Validation method:** Track signed URL requests/user-session and preview failure rate.

#### Finding S2 — SVG sanitization is robust but regex-heavy on full payload
- **Importance:** Low
- **Location(s):** `infra/lib/lambdas/convert-worker/index.ts` (`sanitizeSvg`, `stripDoctypeDeclarations`, CSS URL sanitization)
- **Why it’s inefficient:** Multiple global regex passes over full SVG buffer can add CPU cost on large inputs.
- **Recommended fix (no code changes yet):**
  1. Keep current security posture.
  2. Add input-size guardrails and profile sanitization time distribution.
  3. Consider a streaming/XML parser if large SVG throughput becomes a bottleneck.
- **Estimated efficiency gain:** ~5–15% CPU reduction on large SVG-heavy workloads.
- **Risk level:** Medium
- **Validation method:** Instrument `sanitizeSvg` execution duration vs SVG size bins.

#### Finding S3 — `aws-sdk` v2 dependency increases maintenance/security overhead
- **Importance:** Medium
- **Location(s):** root `package.json` (`aws-sdk` v2)
- **Why it’s inefficient:** Adds duplicate SDK surface (v2 + v3) and is flagged by npm audit advisory.
- **Recommended fix (no code changes yet):**
  1. Confirm no runtime imports of `aws-sdk` v2 remain.
  2. Remove v2 once verified and keep v3-only stack.
- **Estimated efficiency gain:** ~small runtime gain; meaningful dependency/security simplification.
- **Risk level:** Medium
- **Validation method:** Static import scan + build/test and runtime smoke tests after planned removal.

---

## C) Production Readiness Checklist and Guidance

### Environment and configuration
- Define strict `dev` / `stage` / `prod` account separation and deployment boundaries.
- Keep environment-specific values in parameterized config (not hardcoded).
- Ensure runtime env validation (`mustEnv`) covers all required vars with startup fail-fast.

### Secrets management
- Keep secrets exclusively in AWS Secrets Manager or SSM Parameter Store.
- Rotate Cognito/client secrets where applicable.
- Verify `.env.local` and any local secrets are never committed.

### Observability
- Standardize structured logs with a `requestId`, `projectId`, `fileId`, `executionArn` correlation set.
- Add CloudWatch dashboards for:
  - API latency/error rate by route
  - Lambda duration/cold starts/max memory
  - Step Functions success/failure/retry counts
- Configure alarms for:
  - conversion failures above threshold
  - Lambda timeout spikes
  - SQS/DLQ growth (if/when DLQs are introduced)

### Error handling and user-safe messages
- Continue returning actionable user-safe errors for unsupported/encrypted inputs.
- Normalize API error schema across routes to reduce frontend branching.

### Rate limiting and abuse prevention
- Add per-user/project rate limits for upload and conversion-start endpoints.
- Add guardrails for huge batch conversion attempts and repeated retry storms.

### Storage lifecycle and cleanup
- Add S3 lifecycle rules for raw and output prefixes with policy per artifact type.
- Define retention for filled PDFs separately if compliance requires it.
- Add periodic integrity cleanup job for orphaned metadata/object mismatches.

### Backup and recovery
- Confirm DynamoDB PITR is enabled (it is in stack) and test restore workflow.
- Verify bucket versioning restore procedures (enabled in stack).

### CI/CD hardening
- Add CI pipeline with required gates:
  - typecheck
  - lint
  - unit tests (frontend + worker)
  - container build smoke tests
  - CDK synth check
- Add deploy approvals for prod and rollback procedure.

### Security headers/CORS
- Review web headers and CORS to enforce minimal origins and methods per environment.
- Keep presigned URLs short-lived and scoped to exact key/action.

### IAM least privilege review
- Audit Lambda/Step Functions policies for minimal allowed actions/resources.
- Ensure no wildcard action/resource where tighter scope is possible.

### AWS Console changes (if needed)
- **Lambda memory/timeout tuning:** Validate 2048 MB / 2 min against production p95 and adjust for throughput-cost balance.
- **Provisioned Concurrency (optional):** Enable for conversion worker only if cold starts materially impact user SLAs.
- **Ephemeral storage:** Increase Lambda `/tmp` only if conversion failures show temp-space pressure.
- **Step Functions logging level:** Enable execution logs to CloudWatch for troubleshooting.
- **CloudWatch retention:** Set explicit retention days for Lambda and Step Functions log groups.
- **S3 lifecycle rules:** Configure expiration/transition by prefix (`raw/`, `output/`, `filled/`).
- **CloudFront caching headers (if introduced):** Cache static assets aggressively; avoid caching auth-sensitive API responses.

---

## D) Dependency Audit (Up-to-date check)

Data source used:
- `package.json` + lockfiles in root, `infra`, and `infra/lib/lambdas/convert-worker`
- `npm outdated --json` results (queried)
- `npm audit --json` results (queried)
- Python deps observed in `infra/lib/lambdas/convert-worker/Dockerfile` (no `requirements.txt`/lockfile found)

### JavaScript/TypeScript dependencies

#### D1 — AWS SDK v3 packages behind latest in root app
- **Importance:** High
- **Current:**
  - `@aws-sdk/client-dynamodb` `3.988.0`
  - `@aws-sdk/client-s3` `3.988.0`
  - `@aws-sdk/client-sfn` `3.1001.0`
  - `@aws-sdk/lib-dynamodb` `3.988.0`
  - `@aws-sdk/s3-request-presigner` `3.988.0`
- **Recommended target range:** `~3.1004.x` (align all AWS SDK v3 packages)
- **Why upgrade matters:** Bugfixes, consistency, and reduced mismatch risk between client modules.
- **Upgrade risk:** Low to Medium
- **Suggested upgrade plan:**
  1. Bump all AWS v3 packages together.
  2. Run build/tests and conversion smoke tests.
  3. Verify presign/download/upload flows in staging.

#### D2 — Root uses `aws-sdk` v2 and is audit-flagged
- **Importance:** High
- **Current:** `aws-sdk` `2.1693.0`
- **Recommended target range:** Remove if unused; otherwise latest `2.x` as interim and plan migration off v2.
- **Why upgrade matters:** npm audit reports advisory for v2 usage posture; simplifies stack if fully on v3.
- **Upgrade risk:** Medium (if hidden imports exist)
- **Suggested upgrade plan:**
  1. Search runtime imports for `aws-sdk`.
  2. Replace any remaining v2 usage with v3 clients.
  3. Remove dependency and verify builds/runtime.

#### D3 — Next ecosystem patch drift
- **Importance:** Medium
- **Current:** `eslint-config-next` `16.1.4` (latest `16.1.6`), `next` declared `^16.1.6`
- **Recommended target range:** Align `eslint-config-next` with framework minor/patch (`16.1.6`)
- **Why upgrade matters:** Lint/runtime compatibility alignment.
- **Upgrade risk:** Low
- **Suggested upgrade plan:** Patch update + lint/build pass.

#### D4 — UI/tooling patch updates available
- **Importance:** Low
- **Current -> latest examples:**
  - `tailwindcss` `4.1.18` -> `4.2.1`
  - `@tailwindcss/postcss` `4.1.18` -> `4.2.1`
  - `framer-motion` `12.34.0` -> `12.35.1`
  - `jose` `6.1.3` -> `6.2.0`
  - `lucide-react` `0.563.0` -> `0.577.0`
  - `react` / `react-dom` `19.2.3` -> `19.2.4`
- **Recommended target range:** latest compatible patch/minor per package.
- **Why upgrade matters:** Fixes and ecosystem stability.
- **Upgrade risk:** Low to Medium
- **Suggested upgrade plan:** Batch low-risk patch updates first, then run full UI regression checks.

#### D5 — Infra package updates
- **Importance:** Low
- **Current:** `dotenv` `16.6.1` (latest `17.3.1`), `@types/node` `22.19.13` (wanted `22.19.15`)
- **Recommended target range:** `dotenv` `^17.x` after compatibility check.
- **Why upgrade matters:** maintenance/security posture.
- **Upgrade risk:** Low
- **Suggested upgrade plan:** upgrade and run `npm --prefix infra run build` + `cdk synth`.

#### D6 — Convert worker dependency lag
- **Importance:** Medium
- **Current:** `heic-convert` `1.2.4` (latest `2.1.0`)
- **Recommended target range:** `^2.1.0` after runtime codec validation.
- **Why upgrade matters:** better format handling and maintenance.
- **Upgrade risk:** Medium (codec behavior differences)
- **Suggested upgrade plan:**
  1. Upgrade in worker package.
  2. Rebuild container.
  3. Run HEIC/HEIF/AVIF fixture conversions.

### Python dependencies in conversion worker

#### D7 — Python deps are not lock-pinned to exact versions
- **Importance:** Medium
- **Current declaration source:** `infra/lib/lambdas/convert-worker/Dockerfile` uses ranges:
  - `PyMuPDF>=1.23.0`
  - `Pillow>=10.0.0`
  - `pillow-avif-plugin>=1.4.0`
  - `pillow-heif>=0.16.0`
- **Recommended target range:** Pin exact tested versions (lock file or fixed image build args).
- **Why upgrade matters:** Reproducible builds and predictable conversion behavior.
- **Upgrade risk:** Medium
- **Suggested upgrade plan:**
  1. Record currently resolved versions from a known-good build.
  2. Pin them exactly.
  3. Upgrade intentionally with fixture regression tests.

### Security audit summary
- Root npm audit returned **1 low vulnerability** (`aws-sdk` v2 advisory).
- Infra and convert-worker npm audit returned **0 vulnerabilities** at time of check.

---

## E) Overall Efficiency Potential

### Overall Efficiency Potential

- **Frontend perceived performance potential:** **~20–45%**
  - Assumes implementing F1/F2/F3/F5/F6 (URL fetch reduction, list rendering optimization, fill-page modularity, adaptive polling).
- **Backend conversion throughput potential:** **~15–35%**
  - Assumes addressing B1/B2/B3 primarily (memory-copy reduction, better key access patterns, batch enqueue parallelism).
- **Infrastructure cost efficiency potential:** **~15–40%**
  - Assumes lifecycle policies, reduced presign churn, log retention tuning, and cold-start optimization from I1/I2/I4.

### Assumptions behind estimates
- Typical workload mix includes image conversions with occasional DOCX/PAGES/PDF processing.
- Significant gains depend on medium/large project sizes (many files per project and/or larger files).
- Estimates are cumulative but not strictly additive; overlapping optimizations reduce total combined gain.
- Security and correctness are preserved as hard constraints.

---

## Additional Notes

- No Python requirements lockfile was found; Python dependency versions currently come from Dockerfile ranges.
- No CI workflow files were found in `.github/workflows` during this pass.
- Recommendations are intentionally behavior-preserving and staged for low-risk rollout.

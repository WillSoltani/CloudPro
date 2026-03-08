# Architecture

Author: Will Soltani

## 1) System Overview
This project combines a Next.js application with AWS managed services to provide secure file conversion and PDF filling.

```text
Browser
  |
  | HTTPS (Next.js routes)
  v
Next.js App Router (UI + API handlers)
  |                \
  |                 \ StartExecution
  |                  v
  |               Step Functions
  |                  |
  |                  v
  |             Convert Worker (Lambda container)
  |
  +--> DynamoDB (project/file metadata)
  +--> S3 Raw Uploads (source objects)
  +--> S3 Outputs (converted + filled artifacts)
```

## 2) Frontend Architecture

### 2.1 App shell and site pages
- Public marketing/site content is rendered from `app/`, `components/`, `sections/`, and `content/`.
- Project tooling lives under `app/app/projects/*` and is isolated from the public pages.

### 2.2 Project workspace
Primary orchestrator:
- `app/app/projects/[projectId]/ProjectDetailClient.tsx`

State model (high level):
- Staged local files (pre-upload): `useStagedFiles`
- Server file list (raw/output artifacts): `useServerFiles`
- Signed URL cache/refresh: `useSignedUrls`
- Per-item conversion settings and global defaults
- Selection state per list (ready/converted)

UI modules:
- Ready queue: source files pending conversion.
- Converted files: output artifact listing + reconvert controls.
- Conversion settings panel: full target list with per-source capability disable rules.
- Fill PDF page: dedicated client route at `/app/projects/[projectId]/fill/[fileId]`.

### 2.3 PDF fill architecture
Core client:
- `app/app/projects/[projectId]/fill/[fileId]/FillPdfClient.tsx`

Support modules:
- `field-label-resolver.ts`
- `field-type-rules.ts`
- `field-validation.ts`

Pipeline:
1. Load source bytes via signed URL.
2. Render pages/widgets with PDF.js (client-only import path).
3. Maintain editable field + overlay state in React.
4. Build output bytes with pdf-lib.
5. Validate bytes (`%PDF-`, minimum length), then download and persist.

## 3) Backend API Architecture (Next.js Route Handlers)

### 3.1 Auth/session boundary
- Cognito JWT cookie validation in `app/app/api/_lib/auth.ts`.
- Route handlers call `requireUser()` and scope all access by `USER#{sub}` partition key.

### 3.2 File APIs
- Upload create/complete endpoints create raw file rows and presigned writes.
- File list endpoint can reconcile Dynamo rows against S3 object existence.
- Download endpoint returns short-lived signed inline/download URLs.
- Delete endpoint deletes one exact Dynamo row and one exact S3 key (safety rail logging included).

### 3.3 Conversion submission API
- `app/app/api/projects/[projectId]/convert/route.ts`
- Validates conversion jobs against centralized capability matrix (`conversion-support.ts`).
- Writes output rows in `processing` state.
- Starts Step Functions executions for worker processing.

### 3.4 Filled PDF artifact APIs
- Create endpoint reserves `artifactType=filled_pdf` output row + presigned upload URL.
- Upload endpoint accepts PDF bytes.
- Complete endpoint validates and marks row done.

## 4) Conversion Pipeline (Worker)

Worker entrypoint:
- `infra/lib/lambdas/convert-worker/index.ts`

Helpers/scripts:
- Python scripts for DOCX/PAGES/image-specialized operations.
- `lib/formats.ts` for format/content-type/extension mapping.

High-level conversion flow:
1. Read source metadata from DynamoDB.
2. Download source object from raw bucket.
3. Detect source kind (content-aware, not filename-only).
4. Route to conversion path:
   - image -> image/pdf
   - document -> canonical PDF -> target outputs
   - special input handling (SVG sanitization, AVIF/HEIC/ICO paths, PAGES fallback logic)
5. Upload output to output bucket.
6. Update output row (status, contentType, size, packaging/page metadata).

### 4.1 SVG handling
- Sanitization removes dangerous constructs while accepting common real-world SVG input.
- Rendering uses deterministic defaults for dimensions and transparency behavior.

### 4.2 PAGES handling
- Canonical PDF extraction pipeline attempts embedded preview PDF first.
- Falls back to preview-image assembly when PDF preview is missing.
- Canonical artifact feeds downstream format conversion.

## 5) Capability Matrix and Validation
Single source of truth:
- `app/app/_lib/conversion-support.ts`

Contains:
- Supported input labels
- Supported output labels
- Conversion matrix by source label/content type
- Recommendation priority and popular target mapping
- Helper functions used by both UI and API

Rule: UI can disable options, but backend remains authoritative and rejects unsupported requests.

## 6) Data and Storage Model

### 6.1 DynamoDB entity model
Table: `SecureDocApp`

Primary patterns:
- `PK = USER#{sub}`
- `SK = PROJECT#{projectId}`
- `SK = FILE#{projectId}#{fileId}`

File row fields (selected):
- `kind`: `raw` | `output`
- `artifactType`: `conversion` | `filled_pdf` (output rows)
- `status`: `queued` | `processing` | `done` | `failed`
- `bucket`, `key`, `contentType`, `sizeBytes`
- `sourceFileId`, `outputFormat`, `packaging`, `pageCount`, `outputCount`

### 6.2 S3 key model
- Raw uploads bucket: private source objects.
- Output bucket: converted artifacts and filled PDFs, user/project namespaced.

### 6.3 Artifact lifecycle
```text
Raw file: queued -> done (upload complete)
Output conversion: processing -> done|failed
Filled PDF: processing -> done|failed
Deleted artifact: explicit user delete only (no implicit cascade)
```

## 7) Orchestration and Infrastructure

CDK stack:
- `infra/lib/storage-stack.ts`

Provisions:
- KMS key (encryption)
- DynamoDB table
- Raw/output S3 buckets with CORS and SSL enforcement
- Lambda DockerImageFunction for conversion worker
- Step Functions state machine invoking worker

Entrypoints:
- `infra/bin/app.ts` (primary, referenced by `infra/cdk.json`)
- `infra/bin/infra.ts` (alternate entrypoint present in repo)

## 8) Operational Boundaries and Contracts
- API routes are Node runtime (`runtime = "nodejs"`) where required.
- Signed URLs are short TTL and generated server-side.
- Conversion and fill persistence must write exact object keys; deletion is key-scoped.
- Generated directories (`.next`, `infra/dist`, `infra/cdk.out`) are build artifacts and not source-of-truth.

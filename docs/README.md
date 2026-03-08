# Project Documentation

Author: Will Soltani

## What This Application Does
This repository contains a Next.js web application and AWS infrastructure for a secure document workflow:
- upload files into project-scoped queues,
- convert files between supported formats,
- fill and export PDFs in-browser,
- store outputs in S3 with metadata in DynamoDB.

The system is optimized for deterministic conversion behavior and explicit capability gating so the UI only offers conversions that the backend can execute.

## Architecture Summary
- Frontend: Next.js App Router pages and feature clients under `app/` and `app/app/projects/*`.
- Backend APIs: Next.js route handlers under `app/app/api/*` for auth/session, uploads, conversion job submission, file listing/deletion, and filled-PDF persistence.
- Conversion runtime: AWS Step Functions invokes a containerized Lambda worker (`infra/lib/lambdas/convert-worker`) for format-specific processing.
- Storage:
  - DynamoDB table (`SecureDocApp`) for project/file metadata and artifact lifecycle state.
  - S3 raw bucket for original uploads.
  - S3 output bucket for converted artifacts and filled PDFs.
  - KMS key for bucket encryption.

## Core User Flows
1. Upload -> Convert -> Download
- User uploads one or more files to a project.
- API creates upload intent and presigned PUT URL.
- Upload completion writes `kind=raw` file metadata to DynamoDB.
- Conversion request writes `kind=output` rows (`status=processing`) and starts Step Functions.
- Worker converts and writes final output file(s) to S3, then updates metadata to `status=done`.
- UI reads `/files` and downloads with short-lived signed URLs.

2. Fill PDF -> Download -> Persist as Filled Artifact
- User opens `/app/projects/[projectId]/fill/[fileId]`.
- PDF is loaded client-side (PDF.js) and edited (pdf-lib).
- On save/download, frontend validates PDF bytes and downloads immediately.
- Same bytes are uploaded to output storage and registered as `artifactType=filled_pdf`.

3. Reconvert Existing Output
- User picks a converted artifact and applies new target settings.
- API submits a new conversion job against the original source reference (`sourceFileId`).
- New output artifact is tracked independently; no cascade deletion is intended.

## Supported Formats
Authoritative conversion capabilities are centralized in `app/app/_lib/conversion-support.ts`.

Supported input labels:
- PNG, JPG, WebP, GIF, TIFF, AVIF, HEIC, HEIF, BMP, SVG, ICO, PDF, DOCX, PAGES, IMG

Supported output labels:
- PNG, JPG, WebP, GIF, TIFF, AVIF, HEIC, HEIF, BMP, ICO, SVG, PDF

Additional accepted upload extensions include `DOC` (mapped to DOCX-class document handling in source label logic).

### How Validation Works (High Level)
- Backend enforces allowed targets per detected source label and content type.
- Frontend uses the same capability map to disable unsupported targets.
- Same-format re-encode is supported where meaningful (for resize/quality/compression workflows).

## Local Development
Prerequisites:
- Node.js 20+
- npm
- AWS credentials/environment when exercising API/infra paths
- Docker (for convert-worker image build/test)

Commands:
```bash
npm install
npm run dev
npm run test:pdf-fill
npm run lint
```

Infra commands:
```bash
npm --prefix infra install
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

## Deployment (High Level)
1. Build and synth infra (`infra/`).
2. Deploy CDK stack that provisions DynamoDB, S3, KMS, Lambda (container), and Step Functions.
3. Deploy Next.js app with required env vars (Cognito, AWS resources, table/bucket names, state machine ARN).
4. Validate end-to-end upload/convert/fill/download flows.

## Documentation Map
- Architecture deep dive: `docs/ARCHITECTURE.md`
- Full repository file map: `docs/FILE_INDEX.md`
- Contribution standards: `docs/CONTRIBUTING.md`
- Production operations runbook: `docs/OPERATIONS.md`

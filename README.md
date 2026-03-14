# Cloud Portfolio

Cloud Portfolio is a Next.js monorepo with two product surfaces that share infrastructure and deployment patterns:

- `Cloud Portfolio` document workflows for uploads, conversions, and PDF filling
- `ChapterFlow` for guided reading, quizzes, progress tracking, badges, profile, settings, and subscription aware access

The repository is production oriented. The frontend uses App Router feature domains, the backend uses Next.js route handlers plus AWS services, and ChapterFlow content is ingested from validated book package JSON.

## Core product areas

### Cloud Portfolio
- Project based file uploads
- Format conversion orchestration through Step Functions and a Lambda worker
- Browser based PDF filling and export
- S3 backed artifacts with DynamoDB metadata

### ChapterFlow
- Library, book detail, and chapter reading flows
- Summary, examples, and quiz modes
- Actual reading time tracking
- Progress, streaks, badges, and profile analytics
- Saved state, settings, and per user reading preferences
- Admin ingestion path for validated book package uploads
- Stripe ready entitlement model for Free and Pro access

## Tech stack
- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS 4
- AWS DynamoDB, S3, Step Functions, Lambda, Cognito, SSM
- Stripe for ChapterFlow billing flows
- CDK for infrastructure

## Repository layout

```text
app/
  app/                     Cloud Portfolio dashboard routes and APIs
  book/                    ChapterFlow UI, hooks, data adapters, and components
  auth/                    Shared authentication routes
infra/                     AWS CDK app and conversion worker
book-packages/             Strict book package JSON content
public/book-covers/        Generated or curated ChapterFlow cover assets
docs/                      Maintained repository and product documentation
```

## Important routes

### Cloud Portfolio
- `/` public marketing site
- `/dashboard` authenticated dashboard entry
- `/app/projects` project workspace
- `/app/projects/[projectId]/fill/[fileId]` PDF fill flow

### ChapterFlow
- `/book` onboarding entry
- `/book/workspace` dashboard
- `/book/home` legacy redirect to `/book/workspace`
- `/book/library` catalog and book discovery
- `/book/library/[bookId]` book overview
- `/book/library/[bookId]/chapter/[chapterId]` chapter reader
- `/book/progress` progress analytics
- `/book/profile` user profile hub
- `/book/settings` settings control center
- `/book/badges` achievement hub
- `/book/saved` personal Read Next queue

## Setup

### Prerequisites
- Node.js 20 or newer
- npm
- AWS credentials for API and infra work
- Docker for conversion worker and some infra validation paths

### Install

```bash
npm install
npm --prefix infra install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Tests and checks

```bash
npm run verify
npm run test:pdf-fill
npm run lint
npm run typecheck
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

## Environment overview

This repo reads configuration from direct environment variables and, on the server, from SSM through `app/app/api/_lib/server-env.ts`.

### Shared auth and app routing
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `APP_BASE_URL`
- `ADMIN_SUBS`
- `ADMIN_EMAILS`
- `DEV_AUTH_BYPASS` for local only bypass flows

### AWS infrastructure and server runtime
- `AWS_REGION` or `AWS_DEFAULT_REGION`
- `SSM_PARAMETER_PREFIX`
- `SECURE_DOC_TABLE`
- `RAW_BUCKET`
- `OUTPUT_BUCKET`

### ChapterFlow specific
- `BOOK_TABLE_NAME`
- `BOOK_INGEST_BUCKET`
- `BOOK_CONTENT_BUCKET`
- `BOOK_FREE_SLOTS_DEFAULT`
- `BOOK_ADMIN_GROUP`
- `BOOK_PAYWALL_PRICE`
- `BOOK_STRIPE_PRICE_ID`
- `BOOK_STRIPE_SECRET_KEY`
- `BOOK_STRIPE_WEBHOOK_SECRET`

Use direct environment variables for local work when practical. In deployed environments, prefer SSM backed secrets and configuration.

## Book content model

ChapterFlow content is stored in strict package JSON files under `book-packages/`.

Each package is validated before ingestion and then published into backend storage for runtime reads. The package contract is chapter based and supports reading variants, examples, and quizzes.

If you are adding or updating books, start with [docs/BOOK_ACCELERATOR.md](docs/BOOK_ACCELERATOR.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Architecture docs
- [Documentation index](docs/README.md)
- [Repository architecture](docs/ARCHITECTURE.md)
- [ChapterFlow architecture and content flow](docs/BOOK_ACCELERATOR.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Contribution guide](docs/CONTRIBUTING.md)
- [Operations guide](docs/OPERATIONS.md)
- [CI and deployment notes](docs/CI_CD.md)
- [ChapterFlow app admin guide](docs/BOOKAPP_ADMIN_GUIDE.md)
- [Production deployment checklist](PRODUCTION_DEPLOYMENT_CHECKLIST.md)

## Notes
- Book JSON package contents are source content and should not be refactored casually
- Estimated reading time is content metadata only. Goal tracking uses actual tracked reading time
- ChapterFlow user state is a mix of server persisted state and local client caches optimized for responsiveness

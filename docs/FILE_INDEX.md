# File Index

Author: Will Soltani

This index documents repository source/config files that participate in runtime, build, test, or deployment.

## Generated and Vendored Artifacts (Do Not Edit Manually)
- `.next/` (Next.js build output)
- `cdk.out/` and `infra/cdk.out/` (CDK synthesis artifacts)
- `infra/dist/` (compiled infra artifacts)
- `node_modules/`, `infra/node_modules/`, and `infra/lib/lambdas/convert-worker/node_modules/` (third-party dependencies)
- `*.pyc` and `__pycache__/` (Python bytecode caches)

### `.gitignore`
- Purpose: Git ignore rules controlling which local/generated files are excluded from version control.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/_lib/conversion-support.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: Single source of truth for capabilities; UI and backend must stay aligned with this file.

### `app/app/api/_lib/auth.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: next/headers, jose
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/api/_lib/aws.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @aws-sdk/client-sfn
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/api/_lib/http.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: next/server, ./auth
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/api/auth/session/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, ../../_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/me/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, next/headers, jose
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/me/stats/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/convert/_lib/convert-route-utils.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: @/app/app/_lib/conversion-support
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/api/projects/[projectId]/convert/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-sfn, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth, @/app/app/_lib/conversion-support
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/[fileId]/download/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/[fileId]/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/filled/[fileId]/complete/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/filled/[fileId]/upload/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/filled/create/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/files/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, ../../_lib/aws, ../../_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/uploads/[uploadId]/complete/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/lib-dynamodb, @aws-sdk/client-s3, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth, @/app/app/_lib/conversion-support
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/[projectId]/uploads/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @aws-sdk/lib-dynamodb, @/app/app/api/_lib/aws, @/app/app/api/_lib/auth
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/api/projects/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: @aws-sdk/lib-dynamodb, ../_lib/aws, ../_lib/auth, ../_lib/http
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/app/layout.tsx`
- Purpose: Next.js App Router layout wrapper that defines shared page chrome and composition for nested routes.
- Key responsibilities: Provides shared wrappers and nested route composition for child pages.
- Key imports/dependencies: react
- How it is used: Loaded automatically by Next.js as a layout wrapper for nested routes.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: next/navigation
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/_lib/api.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: @/app/app/projects/_lib/types, ./parsers
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/_lib/parsers.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: @/app/app/projects/_lib/types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/_lib/types.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/_lib/ui-types.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/_lib/ui.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: ./types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/_lib/api-client.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: ../../_lib/types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/_lib/format.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: ../../_lib/types, ./ui-types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/_lib/local-types.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/_lib/preview.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: ./format
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/_lib/ui-types.ts`
- Purpose: Feature-local utility/types/api helper module used to keep orchestration code focused.
- Key responsibilities: Holds parsing/formatting/types/network helpers to avoid duplicating feature logic.
- Key imports/dependencies: @/app/app/_lib/conversion-support
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/ClientDate.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/ConversionSettings.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react, lucide-react, ../_lib/ui-types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/converted/file-badges.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react, lucide-react, ../../_lib/ui-types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/converted/reconvert-panel.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react, lucide-react, ../../_lib/ui-types, @/app/app/_lib/conversion-support
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/converted/sort-controls.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: lucide-react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/ConvertedFiles.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: lucide-react, react, ../_lib/ui-types, ./Thumb, ./FilePreviewModal, ../hooks/useFilePreview
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/DropzoneCard.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react, lucide-react, @/app/app/_lib/conversion-support
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/FilePreviewModal.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: react, lucide-react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/ReadyQueue.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: lucide-react, ../_lib/ui-types, ./Thumb, ./FilePreviewModal, ../hooks/useFilePreview, ../_lib/preview
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/components/Thumb.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/FileCountContext.tsx`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/fill/[fileId]/field-label-resolver.ts`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/fill/[fileId]/field-type-rules.ts`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/fill/[fileId]/field-validation.ts`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: ./field-type-rules
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/fill/[fileId]/FillPdfClient.tsx`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next/image, react, lucide-react, pdf-lib, ../../_lib/api-client, ./field-label-resolver
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: Large high-risk module; preserve client-only PDF.js behavior and byte validation when editing.

### `app/app/projects/[projectId]/fill/[fileId]/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: next/headers, next/navigation, ../../../_lib/types, ./FillPdfClient
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/hooks/useFilePreview.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, ../_lib/api-client, ../_lib/preview, ../components/FilePreviewModal
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/hooks/useServerFiles.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, ../../_lib/types, ../_lib/api-client, ../_lib/format
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/hooks/useSignedUrls.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, ../../_lib/types, ../_lib/api-client, ../_lib/preview
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/hooks/useStagedFiles.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, ../_lib/local-types, @/app/app/_lib/conversion-support, ../_lib/format
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/layout.tsx`
- Purpose: Next.js App Router layout wrapper that defines shared page chrome and composition for nested routes.
- Key responsibilities: Provides shared wrappers and nested route composition for child pages.
- Key imports/dependencies: react, next/headers, ./ProjectLayoutShell
- How it is used: Loaded automatically by Next.js as a layout wrapper for nested routes.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: next/headers, next/navigation, ./ProjectDetailClient, ../_lib/types
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/ProjectDetailClient.tsx`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, next/navigation, ./components/DropzoneCard, ./components/ReadyQueue, ./components/ConvertedFiles, ./components/ConversionSettings
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/[projectId]/ProjectLayoutShell.tsx`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next/link, next/navigation, ./FileCountContext
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/components/CreateProjectModal.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: framer-motion, lucide-react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/components/ProjectCard.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: next/link, framer-motion, lucide-react, ../_lib/types, ../[projectId]/components/ClientDate
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/components/ProjectMenu.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: framer-motion, ../_lib/types
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/components/StatCard.tsx`
- Purpose: UI component responsible for rendering a focused part of the user interface.
- Key responsibilities: Renders view logic, receives typed props, and emits UI events/callbacks upward.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/hooks/useCreateModalFromQuery.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, next/dist/shared/lib/app-router-context.shared-runtime, next/navigation
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/hooks/useEscapeClose.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/hooks/useProjectMeta.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react, ../_lib/types, ../_lib/ui
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/hooks/useViewportWidth.ts`
- Purpose: React hook encapsulating reusable stateful behavior for UI interactions and data synchronization.
- Key responsibilities: Encapsulates state transitions/effects and exposes focused hook APIs for callers.
- Key imports/dependencies: react
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/layout.tsx`
- Purpose: Next.js App Router layout wrapper that defines shared page chrome and composition for nested routes.
- Key responsibilities: Provides shared wrappers and nested route composition for child pages.
- Key imports/dependencies: react, next/link
- How it is used: Loaded automatically by Next.js as a layout wrapper for nested routes.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: next/headers, ./ProjectsClient
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/app/projects/ProjectsClient.tsx`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, lucide-react, next/navigation, ./_lib/types, ./components/StatCard, ./components/ProjectCard
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/auth/callback/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/auth/login/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/auth/logout/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/server, next/headers
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/auth/session/route.ts`
- Purpose: Next.js API route handler implementing backend behavior for authentication, upload, file operations, or conversion orchestration.
- Key responsibilities: Validates request input, enforces auth/ownership, coordinates AWS IO, and returns stable JSON API contracts.
- Key imports/dependencies: next/headers, next/server
- How it is used: Invoked by HTTP requests matching its App Router API path.
- Notes/footguns: Keep request/response schema stable and enforce ownership checks on every file/project operation.

### `app/favicon.ico`
- Purpose: Static icon/graphic resource used by UI routes or metadata endpoints.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None (static asset)
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/globals.css`
- Purpose: Global stylesheet defining base visual system tokens and application-wide styles.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Next.js/Tailwind CSS pipeline
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/layout.tsx`
- Purpose: Next.js App Router layout wrapper that defines shared page chrome and composition for nested routes.
- Key responsibilities: Provides shared wrappers and nested route composition for child pages.
- Key imports/dependencies: next, geist/font/sans, geist/font/mono, @/components/InteractiveBackground
- How it is used: Loaded automatically by Next.js as a layout wrapper for nested routes.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: @/components/PageShell, @/components/HomeClient
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/projects/[slug]/page.tsx`
- Purpose: Next.js App Router page entrypoint responsible for route-level rendering and data bootstrapping.
- Key responsibilities: Defines route-level rendering boundary and wires page-level props/components for this URL.
- Key imports/dependencies: next/link, next/navigation, next, react, next/image, lucide-react
- How it is used: Loaded automatically by Next.js when the corresponding route is requested.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/robots.ts`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/sitemap.ts`
- Purpose: Repository source/config file contributing to build, runtime, or deployment behavior.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/content/projects
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/tests/pdf-fill/field-label-resolver.test.ts`
- Purpose: Automated test file validating deterministic utility behavior and guarding against regressions.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: node:test, node:assert/strict, ../../app/projects/[projectId]/fill/[fileId]/field-label-resolver
- How it is used: Executed via `npm run test:pdf-fill`.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `app/tests/pdf-fill/field-rules-validation.test.ts`
- Purpose: Automated test file validating deterministic utility behavior and guarding against regressions.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: node:test, node:assert/strict, ../../app/projects/[projectId]/fill/[fileId]/field-type-rules, ../../app/projects/[projectId]/fill/[fileId]/field-validation
- How it is used: Executed via `npm run test:pdf-fill`.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components.json`
- Purpose: UI tooling configuration for component scaffolding conventions.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/auth/LoginButton.tsx`
- Purpose: Authentication-focused UI helper/component for Cognito login session controls.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/auth/LogoutButton.tsx`
- Purpose: Authentication-focused UI helper/component for Cognito login session controls.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/auth/useAuthStatus.ts`
- Purpose: Authentication-focused UI helper/component for Cognito login session controls.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/Chip.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ContactCTA.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, lucide-react, @/components/ui/card
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/DeliveryStrip.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/ui/card
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ExperienceCard.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/ui/card, @/content/experience
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: Possibly unused: no direct import reference found in a static search; verify before deletion because framework or manual invocation may still reference it.

### `components/ExperienceTimeline.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, @/components/ui/card
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/Hero.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, @/components/ui/button, lucide-react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/HomeClient.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/Hero, @/components/ProofStrip, @/components/DeliveryStrip, @/components/ScrollToTop, @/content/delivery, @/sections/AboutSection
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/InteractiveBackground.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/Navbar.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next/headers, @/components/NavbarClient
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/NavbarClient.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, framer-motion, lucide-react, next/link, @/components/auth/LoginButton, @/components/auth/LogoutButton
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/PageShell.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, @/components/Navbar
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/Pills.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: Possibly unused: no direct import reference found in a static search; verify before deletion because framework or manual invocation may still reference it.

### `components/ProjectCard.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next/link, framer-motion, lucide-react, @/components/ui/badge, @/components/ui/button, @/components/ui/card
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ProjectsSection.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, framer-motion, @/types/project, @/content/projects, @/components/ProjectCard, @/components/ui/button
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ProofStrip.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, lucide-react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ScrollToTop.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, framer-motion, lucide-react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/Section.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/SiteFooter.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, lucide-react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/SkillCategoryCard.tsx`
- Purpose: Reusable presentational component used by public pages and/or feature pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, @/components/ui/card, @/components/Chip, lucide-react
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ui/badge.tsx`
- Purpose: Reusable UI primitive shared across components and pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, class-variance-authority, @/lib/utils
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ui/button.tsx`
- Purpose: Reusable UI primitive shared across components and pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, @radix-ui/react-slot, class-variance-authority, @/lib/utils
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `components/ui/card.tsx`
- Purpose: Reusable UI primitive shared across components and pages.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: react, @/lib/utils
- How it is used: Imported by pages/sections/components that compose the UI.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/about.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: None declared
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/certifications.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: None declared
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/delivery.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: None declared
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/experience.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: None declared
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/projects/index.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: @/types/project, ./serverless-file-pipeline
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/projects/serverless-file-pipeline/index.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: @/types/project
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `content/projectsLayout.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: @/types/project
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: Possibly unused: no direct import reference found in a static search; verify before deletion because framework or manual invocation may still reference it.

### `content/skills.ts`
- Purpose: Typed content model used by the public site experience and project showcase pages.
- Key responsibilities: Defines typed content constants consumed by public-facing UI sections and routes.
- Key imports/dependencies: None declared
- How it is used: Imported by UI sections/pages to render portfolio content.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `docs/ARCHITECTURE.md`
- Purpose: Project documentation artifact for architecture, operations, contribution rules, or repository indexing.
- Key responsibilities: Documents system behavior, contracts, and contribution/operations guidance.
- Key imports/dependencies: None
- How it is used: Read by contributors/operators; not executed in runtime path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `docs/CONTRIBUTING.md`
- Purpose: Project documentation artifact for architecture, operations, contribution rules, or repository indexing.
- Key responsibilities: Documents system behavior, contracts, and contribution/operations guidance.
- Key imports/dependencies: None
- How it is used: Read by contributors/operators; not executed in runtime path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `docs/FILE_INDEX.md`
- Purpose: Project documentation artifact for architecture, operations, contribution rules, or repository indexing.
- Key responsibilities: Documents system behavior, contracts, and contribution/operations guidance.
- Key imports/dependencies: None
- How it is used: Read by contributors/operators; not executed in runtime path.
- Notes/footguns: Keep this file synchronized with repository changes so it remains a reliable source of truth.

### `docs/OPERATIONS.md`
- Purpose: Project documentation artifact for architecture, operations, contribution rules, or repository indexing.
- Key responsibilities: Documents system behavior, contracts, and contribution/operations guidance.
- Key imports/dependencies: None
- How it is used: Read by contributors/operators; not executed in runtime path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `docs/README.md`
- Purpose: Project documentation artifact for architecture, operations, contribution rules, or repository indexing.
- Key responsibilities: Documents system behavior, contracts, and contribution/operations guidance.
- Key imports/dependencies: None
- How it is used: Read by contributors/operators; not executed in runtime path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `eslint.config.mjs`
- Purpose: Build or lint configuration executed by tooling.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: eslint/config, eslint-config-next/core-web-vitals, eslint-config-next/typescript
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/bin/app.ts`
- Purpose: CDK executable entrypoint used to synthesize/deploy stacks from TypeScript sources.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: aws-cdk-lib, ../lib/storage-stack
- How it is used: Primary CDK app entrypoint used by `infra/cdk.json` synth/deploy command.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/bin/infra.ts`
- Purpose: CDK executable entrypoint used to synthesize/deploy stacks from TypeScript sources.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: aws-cdk-lib, ../lib/storage-stack
- How it is used: Alternate CDK entrypoint present in repo; not the `cdk.json` default app command.
- Notes/footguns: Possibly unused: no direct import reference found in a static search; verify before deletion because framework or manual invocation may still reference it.

### `infra/cdk.json`
- Purpose: Infrastructure-level configuration controlling CDK behavior and TypeScript builds.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/Dockerfile`
- Purpose: AWS CDK infrastructure source that defines runtime resources and deployment-time wiring.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/document_to_images_zip.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/docx_sanitize.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/docx_to_pdf.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/fonts/local.conf`
- Purpose: Font/rendering configuration used by document conversion tools inside the worker container.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/image_special_convert.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/image_to_pdf.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/index.ts`
- Purpose: TypeScript worker source used by Lambda container runtime for conversion orchestration.
- Key responsibilities: Coordinates conversion flow, invokes helper scripts/tools, and updates S3 + DynamoDB output state.
- Key imports/dependencies: @aws-sdk/client-s3, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, sharp, ./lib/formats
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: High blast radius module; changes affect all conversion paths and production runtime behavior.

### `infra/lib/lambdas/convert-worker/lib/formats.ts`
- Purpose: TypeScript worker source used by Lambda container runtime for conversion orchestration.
- Key responsibilities: Coordinates conversion flow, invokes helper scripts/tools, and updates S3 + DynamoDB output state.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/package-lock.json`
- Purpose: Worker package or TypeScript configuration used to build/run the conversion container bundle.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: Do not hand-edit; regenerate through package manager when dependencies change.

### `infra/lib/lambdas/convert-worker/package.json`
- Purpose: Worker package or TypeScript configuration used to build/run the conversion container bundle.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/pages_to_pdf.py`
- Purpose: Python helper script used by the conversion worker for document/image specialization tasks.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/README.md`
- Purpose: AWS CDK infrastructure source that defines runtime resources and deployment-time wiring.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: None
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tests/test_document_to_images_zip.py`
- Purpose: Worker integration/unit test covering conversion edge cases and helper scripts.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Executed in local/container test runs for worker regression coverage.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tests/test_docx_sanitize.py`
- Purpose: Worker integration/unit test covering conversion edge cases and helper scripts.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Executed in local/container test runs for worker regression coverage.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tests/test_image_special_convert.py`
- Purpose: Worker integration/unit test covering conversion edge cases and helper scripts.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Executed in local/container test runs for worker regression coverage.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tests/test_pages_to_pdf.py`
- Purpose: Worker integration/unit test covering conversion edge cases and helper scripts.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: None declared
- How it is used: Executed in local/container test runs for worker regression coverage.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tests/test_svg_rasterization.py`
- Purpose: Worker integration/unit test covering conversion edge cases and helper scripts.
- Key responsibilities: Executes format-specific transformations and returns deterministic outputs/metadata to the worker.
- Key imports/dependencies: fs, url
- How it is used: Executed in local/container test runs for worker regression coverage.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/lambdas/convert-worker/tsconfig.json`
- Purpose: Worker package or TypeScript configuration used to build/run the conversion container bundle.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Built into the conversion Lambda container image and invoked by Step Functions workflow.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/lib/storage-stack.ts`
- Purpose: AWS CDK infrastructure source that defines runtime resources and deployment-time wiring.
- Key responsibilities: Defines AWS resources, IAM permissions, env wiring, and stack outputs.
- Key imports/dependencies: aws-cdk-lib, constructs, aws-cdk-lib/aws-dynamodb, aws-cdk-lib/aws-s3, aws-cdk-lib/aws-kms, aws-cdk-lib/aws-lambda
- How it is used: Imported by CDK bin entrypoints to define infrastructure resources.
- Notes/footguns: Resource name/policy changes can impact existing deployed infrastructure and data retention semantics.

### `infra/package-lock.json`
- Purpose: Infrastructure-level configuration controlling CDK behavior and TypeScript builds.
- Key responsibilities: Locks transitive dependency versions for deterministic installs and builds.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: Do not hand-edit; regenerate through package manager when dependencies change.

### `infra/package.json`
- Purpose: Infrastructure-level configuration controlling CDK behavior and TypeScript builds.
- Key responsibilities: Defines scripts, dependency graph, and package scope metadata.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/tsconfig.build.json`
- Purpose: Infrastructure-level configuration controlling CDK behavior and TypeScript builds.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `infra/tsconfig.json`
- Purpose: Infrastructure-level configuration controlling CDK behavior and TypeScript builds.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `lib/utils.ts`
- Purpose: Shared utility helpers consumed by reusable UI primitives.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: clsx, tailwind-merge
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `middleware.ts`
- Purpose: Global middleware/proxy boundary for request-time behavior and route protection decisions.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next/server, jose
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `next.config.ts`
- Purpose: Next.js framework configuration for runtime/build settings.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: next
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `package-lock.json`
- Purpose: Dependency lockfile pinning resolved versions for reproducible installs.
- Key responsibilities: Locks transitive dependency versions for deterministic installs and builds.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: Do not hand-edit; regenerate through package manager when dependencies change.

### `package.json`
- Purpose: Package manifest defining scripts and dependencies for this scope.
- Key responsibilities: Defines scripts, dependency graph, and package scope metadata.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `postcss.config.mjs`
- Purpose: Build or lint configuration executed by tooling.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `public/diagrams/file-pipeline.png`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `public/file.svg`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `public/globe.svg`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `public/next.svg`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `public/vercel.svg`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `public/window.svg`
- Purpose: Static asset served directly by Next.js at runtime.
- Key responsibilities: Supplies static media referenced by UI and metadata routes.
- Key imports/dependencies: None (static asset)
- How it is used: Served directly by Next.js static file server.
- Notes/footguns: Static asset changes are immediately user-visible; maintain filename references used in code.

### `README.md`
- Purpose: Repository entry README that points contributors to the maintained documentation set under `/docs`.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None
- How it is used: Shown first on repository landing pages; points to full docs set.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/AboutSection.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/Section, @/components/ui/card, @/content/about
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/CertificationsSection.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: lucide-react, framer-motion, @/components/Section, @/content/certifications, @/components/ui/card, @/components/ui/button
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/ContactSection.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/Section, @/components/ContactCTA, @/components/SiteFooter
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/ExperienceSection.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/Section, @/components/ExperienceTimeline, @/content/experience
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/ProjectsBlock.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: @/components/Section, @/components/ProjectsSection
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `sections/SkillsSection.tsx`
- Purpose: Top-level section component for the public site layout.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: framer-motion, @/components/Section, @/components/SkillCategoryCard, @/content/skills
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `tsconfig.json`
- Purpose: TypeScript compiler configuration controlling type-check/build boundaries.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: Node/npm/CDK toolchain
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

### `types/project.ts`
- Purpose: Shared TypeScript type declarations used across routes/components.
- Key responsibilities: Supports the surrounding module/runtime with scoped configuration or helper behavior.
- Key imports/dependencies: None declared
- How it is used: Consumed by surrounding build/runtime tooling based on file convention and import path.
- Notes/footguns: No special footgun noted beyond standard TypeScript/Next.js/AWS change-safety practices.

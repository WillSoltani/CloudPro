import type { Project } from "@/types/project";

export const serverlessFilePipeline: Project = {
  slug: "serverless-file-pipeline",
  title: "Serverless File Processing Pipeline",
  description:
    "Convert HEIC, PDF, Word and Pages files from the browser, no account needed. Files go straight to S3, and Step Functions runs each job on a container Lambda.",
  tags: ["Serverless", "Step Functions", "Cognito", "CDK"],
  featured: true,

  type: "Live web app",
  stack: "Next.js, Cognito, Step Functions, Lambda (container), S3, DynamoDB",
  status: "Live",
  demoUrl: "/test",
  demoLabel: "Try the live demo",
  githubUrl: "https://github.com/WillSoltani/CloudPro",
  byline: "Built and run by me. Live on this site, and open to try without an account.",
  nextStep: { label: "Try the live demo", href: "/test" },

  caseStudy: {
    overview:
      "A file converter that runs on AWS end to end. Drop in an image, a PDF, or a Word or Pages document and pick an output: up to 12 formats, with presets for web, email and high quality. Guests get 5 conversions with no account. Signed-in users get projects, 10 conversions and a PDF form-filler.",
    architecture: [
      "Sign-in: Cognito's hosted UI on auth.soltani.org, using the authorization-code flow with PKCE; tokens are kept in httpOnly cookies.",
      "Guard: proxy.ts verifies the token against Cognito's public keys before any /app page renders (the guest workspace aside), and every signed-in API route verifies it again.",
      "Upload: the API returns a presigned S3 PUT URL, valid for 5 minutes with the content type signed in, and the browser sends the file straight to a KMS-encrypted bucket.",
      "Check: a complete call reads the first 64 KB, sniffs the real file type, rejects anything unsupported with a 415 and writes the file row to DynamoDB.",
      "Convert: the API checks ownership and the target format, reserves quota, and starts one Step Functions execution per job, up to 25 jobs per request.",
      "Work: the workflow invokes a container-image Lambda that runs sharp, Pillow, PyMuPDF and headless LibreOffice.",
      "Finish: the worker writes the result to a second bucket and marks its row done or failed; the page polls until no job is still processing.",
      "Download: a presigned GET URL, minted per request and valid for 60 seconds.",
      "Guests: /test gives each visitor a separate namespace and 5 conversions on the same pipeline, with no account.",
      "Hosting: the Next.js app and its API run on App Runner; the buckets, table, workflow, worker and alarms are defined in CDK.",
    ],
    decisions: [
      {
        title: "A container image for the worker",
        detail:
          "The worker needs LibreOffice, Python with Pillow and PyMuPDF, fonts including Noto CJK, and sharp. A container image carries all of it as one versioned artifact (x86_64, 2 GB, two-minute timeout). The cost is a heavier artifact to build and patch than a zip.",
      },
      {
        title: "Step Functions in front of the worker",
        detail:
          "Each job gets its own execution history and retries with backoff on Lambda service errors, with no queue to run. The cost: Standard workflows bill per state transition, and a failed job is marked failed rather than replayed from a dead-letter queue.",
      },
      {
        title: "Check the bytes, not the name",
        detail:
          "The file type comes from the object's first bytes, not its extension, so a renamed file cannot reach the wrong converter. SVGs lose scripts, entities and external references before they are rasterised.",
      },
      {
        title: "Quota as one conditional write",
        detail:
          "Each conversion reserves a unit with a single conditional DynamoDB update, so parallel requests cannot overrun a limit. A job that fails after its reservation keeps the unit for now.",
      },
      {
        title: "A demo on the real pipeline",
        detail:
          "Guests use the same buckets, workflow and worker as signed-in users, each in a namespace of its own, so trying the demo is trying the system.",
      },
    ],
    security: [
      "Cognito sign-in with PKCE; tokens in httpOnly, SameSite=Lax cookies, Secure in production.",
      "Every API route checks the caller (the Cognito token, or the guest cookie on guest routes), and file rows are keyed by that caller's ID.",
      "Both buckets: SSE-KMS with a customer-managed key (rotation on), TLS only, public access blocked, versioning on.",
      "Upload URLs last 5 minutes with the content type signed in; download URLs last 60 seconds.",
      "The worker's role reads raw uploads, writes outputs, updates job rows and uses the key, nothing else.",
      "SVG input is sanitised before it is rasterised.",
    ],
    observability: [
      "Two CloudWatch alarms: worker errors and failed executions, each at one or more in 5 minutes.",
      "Every job's state is a DynamoDB row: queued, processing, done or failed, with the error message.",
      "Each job has its own Step Functions execution history.",
      "Worker and workflow logs are kept for a month; the worker writes structured JSON events.",
    ],
    failureModes: [
      "A Lambda service error: the workflow retries twice, waiting 2 s and then 4 s.",
      "A job that hangs: the worker stops at 2 minutes and the workflow at 5, so nothing runs unbounded.",
      "A helper that stalls: LibreOffice gets 90 s and the image helpers 60 s; a failed job's row records the error message.",
      "A start that fails after quota is reserved: the output row is marked failed, so the page shows it.",
    ],
    cost: [
      "What drives it: Lambda time at 2 GB, Step Functions state transitions, S3 storage and requests, KMS requests and data transfer.",
      "What keeps it down: unfinished uploads are aborted after 7 days, old object versions expire after 30, logs after a month, and DynamoDB bills on demand.",
      "Quotas cap conversions per user and per guest session.",
    ],
    next: [
      "Send the two alarms to email through SNS.",
      "Expire guest files automatically.",
      "Give the quota unit back when a job fails after its reservation.",
      "An admin view with the cost of each job.",
    ],
  },
};

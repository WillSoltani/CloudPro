import type { Project } from "@/types/project";

export const serverlessFilePipeline: Project = {
  slug: "serverless-file-pipeline",
  title: "Serverless File Processing Pipeline",
  description:
    "Sign in, upload straight to S3 with presigned URLs, and convert images, PDFs and Word or Pages files in a Step Functions workflow that runs a containerised Lambda. Every job is tracked in DynamoDB.",
  tags: ["Serverless", "Step Functions", "Cognito", "CDK"],
  featured: true,

  type: "Live web app",
  stack: "Next.js, Cognito, Step Functions, Lambda (container), S3, DynamoDB",
  status: "Live",

  caseStudy: {
    overview:
      "A file converter that runs on AWS primitives end to end: sign in, upload, convert and download, with every job recorded and every byte encrypted at rest.",
    architecture: [
      "Cognito sign-in (OAuth 2 with PKCE); the middleware verifies the JWT on every /app route",
      "Browser uploads go straight to a KMS-encrypted S3 bucket through five-minute presigned PUT URLs",
      "The convert API reserves the user's quota and starts one Standard Step Functions execution per job",
      "The workflow invokes a container-image Lambda (sharp, canvas, pdf.js) with retries on transient errors",
      "Projects, files and jobs live in one DynamoDB table; outputs land in a second bucket and come back through presigned downloads",
    ],
    decisions: [
      {
        title: "A container-image Lambda for the worker",
        detail:
          "pdf.js and the native image libraries are well past the 250 MB zip limit, so the converter ships as an image (x86_64, 2 GB, two-minute timeout).",
      },
      {
        title: "Step Functions in front of the worker",
        detail:
          "Each job gets an execution history, retries with backoff on Lambda service errors and a failure alarm, without a queue to run.",
      },
    ],
    security: [
      "Least-privilege grants: the worker reads raw uploads, writes outputs and its job records, nothing else",
      "S3 SSE-KMS with key rotation, TLS-only buckets and blocked public access",
      "Presigned URLs with a five-minute TTL and a fixed content type",
    ],
    observability: [
      "Worker and state machine logs in CloudWatch with 30-day retention",
      "CloudWatch alarms on worker errors and failed executions",
    ],
    failureModes: [
      "Retries with backoff on transient Lambda errors inside the workflow",
      "Quota reserved before a job starts, so a burst cannot overrun a user's limit",
    ],
    cost: [
      "Primary drivers: Lambda duration, S3 storage and requests, data transfer",
      "Mitigations: right-sized memory, lifecycle rules for old versions and incomplete uploads",
    ],
    next: ["Add an admin dashboard and cost visibility"],
  },
};

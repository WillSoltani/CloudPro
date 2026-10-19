import type { Project } from "@/types/project";

export const bookAccelerator: Project = {
  slug: "book-accelerator",
  title: "ChapterFlow",
  description:
    "A reading product that turns each book into chapter summaries, examples and quizzes, with progress, streaks and Free and Pro plans. Live at chapterflow.ca.",
  tags: ["Product", "AWS", "AI", "Payments"],
  featured: true,

  type: "Live product",
  stack: "Next.js, TypeScript, DynamoDB, S3, Lambda, Cognito, Stripe, CDK",
  status: "Live",
  demoUrl: "https://chapterflow.ca",

  caseStudy: {
    overview:
      "ChapterFlow makes reading active instead of passive: each chapter is broken into a summary, worked examples and a quiz, and progress, streaks and badges keep a reader coming back.",
    architecture: [
      "Next.js App Router (React 19, TypeScript, Tailwind 4) on one host: marketing, catalogue, reader and dashboard",
      "Cognito sign-in through OAuth route handlers, with an admin group for the ingestion console",
      "Books, progress and entitlements in DynamoDB; book packages in S3, uploaded through a validated admin ingestion path",
      "Stripe-ready entitlement model for Free and Pro access",
      "Infrastructure in CDK across dev, staging and prod; prod deploys are approval-gated",
    ],
    decisions: [
      {
        title: "Quiz-gated progression",
        detail:
          "Readers pass a chapter's quiz to unlock the next one, so comprehension comes before progress.",
      },
      {
        title: "Books as validated packages",
        detail:
          "Each book arrives as a structured package that is validated on upload, so the reader never renders malformed content.",
      },
    ],
    security: [
      "Cognito auth, with the admin console limited to an admin group",
      "Secrets from per-environment deploy secrets and SSM parameters, never from the repo",
      "Entitlements checked server-side for Free and Pro access",
    ],
    observability: [
      "Actual reading time tracked per reader (estimates are content metadata only)",
      "Health checks and a rollback runbook for each environment",
    ],
    failureModes: [
      "Approval-gated prod deploys with a documented rollback",
      "Package validation rejects malformed books before they reach readers",
    ],
    cost: ["Serverless data plane (DynamoDB, S3, Lambda): cost follows usage"],
    next: ["Native SwiftUI client for iOS"],
  },
};

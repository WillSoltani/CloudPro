import type { Project } from "@/types/project";

export const chapterflow: Project = {
  slug: "chapterflow",
  title: "ChapterFlow",
  description:
    "Guided reading for non-fiction: over 130 books in 12-minute chapters, each a summary, examples and a quiz, then spaced review. Free and Pro plans on Stripe.",
  tags: ["AWS", "Stripe", "Spaced repetition", "CDK"],
  featured: true,

  type: "Live product",
  stack: "Next.js, TypeScript, DynamoDB, S3, Lambda, Cognito, Stripe, CDK",
  status: "Live",
  demoUrl: "https://chapterflow.ca",
  githubUrl: "https://github.com/WillSoltani/ChapterFlow",
  byline: "Built and run by me. Live at chapterflow.ca, with Free and Pro plans.",
  nextStep: { label: "Open chapterflow.ca", href: "https://chapterflow.ca" },

  caseStudy: {
    overview:
      "ChapterFlow is a live, paid reading product for non-fiction. Over 130 books are cut into chapters of about 12 minutes, and every chapter runs the same loop: a summary, worked examples and a quiz, then spaced review days later, scheduled with FSRS-5. Free covers two complete books with no card. Pro removes the limit and adds a deeper reading mode, text-to-speech audio and reading analytics; at the time of writing it costs $7.99 CAD a month or $59.99 CAD a year, with a 14-day trial.",
    architecture: [
      "One Next.js App Router app (React 19, TypeScript, Tailwind 4) serves the marketing site, the library, the reader and the dashboard.",
      "Cognito sign-in through OAuth route handlers; the admin console is limited to a Cognito admin group.",
      "Books, progress and plans live in DynamoDB; book packages live in S3 and arrive through a validated admin upload path.",
      "Stripe Checkout handles upgrades, and a signature-checked webhook updates the reader's plan.",
      "Spaced review is scheduled with FSRS-5, an open-source spaced-repetition scheduler.",
      "Also on AWS: Lambda, SSM parameters for configuration and SES for transactional email; infrastructure in CDK across dev, staging and prod.",
      "A push to main deploys dev; staging and prod are manual, and prod needs an approval.",
      "Text a reader submits for their own scenario goes to Anthropic's API for an automated quality and safety review before it can be published.",
    ],
    decisions: [
      {
        title: "A short loop per chapter",
        detail:
          "Summary, examples, quiz, then spaced review days later. The product rests on two findings it cites: recalling an idea fixes it better than rereading it (Karpicke and Roediger, 2008), and spaced study beats cramming (Cepeda et al., 2006). The cost is content: every chapter needs examples and a quiz, not just a summary.",
      },
      {
        title: "FSRS-5 instead of fixed intervals",
        detail:
          "The scheduler estimates when each idea is about to fade and brings it back then, so a reader reviews what is due and nothing more.",
      },
      {
        title: "Books as validated packages",
        detail:
          "Each book is a structured package that is checked on upload, so a malformed book is rejected before any reader sees it.",
      },
      {
        title: "Plan limits on the server",
        detail:
          "Starting a book reserves a slot with a conditional DynamoDB write, so the free limit holds across tabs and devices. Stripe events are verified by signature and applied once, even when Stripe sends one twice.",
      },
    ],
    security: [
      "Cognito sign-in with session tokens in secure, httpOnly cookies; the admin console is limited to an admin group.",
      "Secrets come from per-environment deploy secrets and SSM parameters, never from the repo.",
      "Card details stay with Stripe; ChapterFlow keeps only the customer ID and subscription status.",
      "A hashed device ID protects free book slots from multi-account abuse.",
      "Readers can export their data as JSON, CSV or Markdown and delete their account.",
    ],
    observability: [
      "Health checks, a runbook and a rollback procedure for each environment.",
      "Product analytics are opt-in and off by default.",
      "Operational logs are kept for about 18 months, then deleted.",
    ],
    failureModes: [
      "A bad deploy: prod deploys need an approval, and each environment has a documented rollback.",
      "A malformed book: package validation rejects it before it reaches readers.",
      "A duplicate Stripe event: each event is recorded first and applied once.",
      "Two requests for the last free book slot: the conditional write lets only one through.",
    ],
    cost: ["Serverless data plane (DynamoDB, S3, Lambda): cost follows usage."],
    next: [
      "A native iOS app, in development: Swift 6 and SwiftUI, 19 Swift packages plus share, action, widget and notification extensions. Not yet on TestFlight or the App Store.",
      "More titles: readers request books from the home page, and Pro requests get priority.",
    ],
  },
};

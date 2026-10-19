export type SkillCategory = {
  title: string;
  /** One short proof line (≤ 60 chars), rendered under the title on desktop. */
  claim?: string;
  items: string[];
};

/**
 * The Skills chapter's five groups, one per drive row (sections/SkillsSection.tsx lays exactly five rows:
 * keep five). Every item is used in this repo, ChapterFlow (web + iOS) or the making of this homepage; each
 * claim names the proof.
 */
export const skillCategories: SkillCategory[] = [
  {
    title: "AWS back ends",
    claim: "The back ends behind two live products",
    items: [
      "Container-image Lambda",
      "Step Functions",
      "DynamoDB single-table",
      "S3 + CloudFront",
      "Cognito, OAuth + PKCE",
      "KMS, least-privilege IAM",
      "CDK, OIDC deploys",
      "CloudWatch alarms",
    ],
  },
  {
    title: "Web products",
    claim: "Next.js in production, from sign-in to Stripe",
    items: [
      "Next.js App Router",
      "React 19",
      "TypeScript, strict",
      "Tailwind 4",
      "Stripe billing",
      "Accessibility",
      "Core Web Vitals",
      "Playwright QA",
    ],
  },
  {
    title: "Native iOS & mobile",
    claim: "A native iOS app in 19 Swift packages, in development",
    items: [
      "Swift 6 / SwiftUI",
      "Modular Swift packages",
      "Widgets and extensions",
      "AWS Amplify for Swift",
      "API contract tests",
      "SwiftLint, CI gates",
      "Dart / Flutter",
    ],
  },
  {
    title: "AI & automation",
    claim: "LLM review in ChapterFlow, agent pipelines for this site",
    items: [
      "Anthropic API",
      "LLM safety review",
      "Multi-agent workflows",
      "Claude Code agents",
      "Generative image & video",
      "Vision-model judging",
      "Python pipelines",
    ],
  },
  {
    title: "3D & real-time graphics",
    claim: "This page's rack film: one scripted Blender scene",
    items: [
      "Blender + Python (bpy)",
      "EEVEE rendering",
      "Procedural materials",
      "Camera rigs",
      "Scroll-scrubbed film",
      "Canvas 2D",
      "Perspective mapping",
      "ffmpeg + cwebp",
    ],
  },
];

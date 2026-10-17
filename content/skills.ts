export type SkillCategory = {
  title: string;
  items: string[];
};

/**
 * The Skills chapter's five groups, one per drive row (sections/SkillsSection.tsx lays exactly five rows:
 * keep five). Every item is something used in this repo, ChapterFlow (web + iOS), SX_Demo or the making of
 * this homepage.
 *
 * TODO(will): game engines go in "Games & Real-time Graphics" once there is a shipped or public project to
 * point to.
 */
export const skillCategories: SkillCategory[] = [
  {
    title: "Cloud & Serverless",
    items: ["Lambda", "API Gateway", "Step Functions", "DynamoDB", "S3 + CloudFront", "EventBridge / SQS", "CDK", "CloudWatch"],
  },
  {
    title: "Web & Product",
    items: ["Next.js App Router", "React", "Tailwind", "Design systems", "Accessibility", "Core Web Vitals", "Playwright QA", "Shipped: chapterflow.ca, soltani.org"],
  },
  {
    title: "AI & Automation",
    items: ["LLM features: summaries, quizzes", "Multi-agent workflows", "Structured outputs", "Judge panels", "QA gates for generated output", "Generative image & video", "Python ingestion pipelines"],
  },
  {
    title: "Software Engineering",
    items: ["TypeScript", "Python", "Swift 6 / SwiftUI", "Dart / Flutter", "Rust / C++", "OAuth 2 / PKCE", "GitHub Actions CI", "Code review"],
  },
  {
    title: "Games & Real-time Graphics",
    items: ["Blender + Python (bpy)", "EEVEE", "Procedural materials & lighting", "Camera rigs", "Canvas 2D / WebGL at 60 fps", "Homography & matrix3d", "Particle systems"],
  },
];

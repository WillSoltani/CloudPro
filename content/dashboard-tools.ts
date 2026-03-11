export type DashboardToolAccent = "sky" | "amber";
export type DashboardToolIcon = "converter" | "book";

export type DashboardTool = {
  id: string;
  category: string;
  title: string;
  description: string;
  bullets: [string, string, string];
  href: string;
  ctaLabel: string;
  openLabel: string;
  accent: DashboardToolAccent;
  icon: DashboardToolIcon;
};

export const dashboardTools: DashboardTool[] = [
  {
    id: "file-converter",
    category: "IMAGES & DOCUMENTS",
    title: "File Converter",
    description:
      "Convert images between formats instantly. PNG, JPG, WebP, SVG and more — with batch support.",
    bullets: [
      "Batch convert files",
      "Quality control slider",
      "Web-optimized presets",
    ],
    href: "/app/projects",
    ctaLabel: "Launch File Converter",
    openLabel: "Open app",
    accent: "sky",
    icon: "converter",
  },
  {
    id: "book-accelerator",
    category: "READ & LEARN FASTER",
    title: "Book Accelerator",
    description:
      "Progress through books chapter by chapter. Unlock the next chapter by passing a short quiz.",
    bullets: [
      "Chapter-gated quizzes",
      "Daily streak tracker",
      "Badge achievements",
    ],
    href: "/book",
    ctaLabel: "Launch Book Accelerator",
    openLabel: "Open app",
    accent: "amber",
    icon: "book",
  },
];


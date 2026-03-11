import { projects } from "@/content/projects";
import { getSiteUrl } from "@/app/_lib/site-url";

export default function sitemap() {
  const base = getSiteUrl();

  const projectUrls = projects.map((p) => ({
    url: `${base}/projects/${p.slug}`,
    lastModified: new Date(),
  }));

  return [
    { url: `${base}/`, lastModified: new Date() },
    ...projectUrls,
  ];
}

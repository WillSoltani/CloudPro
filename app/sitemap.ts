import { projects } from "@/content/projects";

export default function sitemap() {
  const base = "https://soltani.org";

  const projectUrls = projects.map((p) => ({
    url: `${base}/projects/${p.slug}`,
    lastModified: new Date(),
  }));

  return [
    { url: `${base}/`, lastModified: new Date() },
    ...projectUrls,
  ];
}

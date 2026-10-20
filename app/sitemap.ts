import { headers } from "next/headers";
import { projects } from "@/content/projects";
import { getSiteUrl } from "@/app/_lib/site-url";
import {
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  getChapterFlowSiteUrl,
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";

export default async function sitemap() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");

  if (isChapterFlowAuthHost(host)) {
    return [{ url: `${getChapterFlowAuthUrl()}/`, lastModified: new Date() }];
  }

  if (isChapterFlowSiteHost(host)) {
    const base = getChapterFlowSiteUrl();
    return [{ url: `${base}/`, lastModified: new Date() }];
  }

  if (isChapterFlowAppHost(host)) {
    const base = getChapterFlowAppUrl();
    return [
      { url: `${base}/`, lastModified: new Date() },
      { url: `${base}/book`, lastModified: new Date() },
      { url: `${base}/book/library`, lastModified: new Date() },
      { url: `${base}/book/profile`, lastModified: new Date() },
      { url: `${base}/book/progress`, lastModified: new Date() },
    ];
  }

  const base = getSiteUrl();

  // When each page's content last changed (update by hand with the page), not the time of the request.
  const LAST_MODIFIED: Record<string, string> = {
    "/": "2026-10-19",
    "/projects/serverless-file-pipeline": "2026-10-19",
    "/projects/chapterflow": "2026-10-19",
    "/projects/soltani-org": "2026-10-19",
  };
  const page = (path: string) => ({ url: `${base}${path}`, lastModified: LAST_MODIFIED[path] ?? "2026-10-19" });

  return [page("/"), ...projects.map((p) => page(`/projects/${p.slug}`))];
}

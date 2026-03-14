import { headers } from "next/headers";
import { getSiteUrl } from "@/app/_lib/site-url";
import {
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
} from "@/app/_lib/chapterflow-brand";

export default async function robots() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");

  if (isChapterFlowAuthHost(host)) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${getChapterFlowAuthUrl()}/sitemap.xml`,
    };
  }

  if (isChapterFlowAppHost(host)) {
    return {
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/book", "/book/library"],
          disallow: ["/app/", "/api/", "/auth/"],
        },
      ],
      sitemap: `${getChapterFlowAppUrl()}/sitemap.xml`,
    };
  }

  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/api/", "/auth/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

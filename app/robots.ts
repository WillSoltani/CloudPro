import { headers } from "next/headers";
import { getSiteUrl } from "@/app/_lib/site-url";
import {
  getChapterFlowAppUrl,
  getChapterFlowAuthUrl,
  getChapterFlowSiteUrl,
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
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

  if (isChapterFlowSiteHost(host)) {
    return {
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/chapterflow"],
          disallow: ["/app/", "/api/", "/auth/", "/book/"],
        },
      ],
      sitemap: `${getChapterFlowSiteUrl()}/sitemap.xml`,
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
        // /test sets a guest cookie and redirects into the app: nothing for a crawler (and it loops without cookies).
        disallow: ["/app/", "/api/", "/auth/", "/test"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

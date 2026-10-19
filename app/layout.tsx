import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import {
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";

// ✅ Client component is fine to render inside a Server Component layout
import { PortfolioBackground } from "@/components/PortfolioBackground";

// The production origin unless NEXT_PUBLIC_SITE_URL says otherwise, so og:url and the preview image's URL are
// never the dev server or the container's origin.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://soltani.org").replace(/\/+$/, "");

// The portfolio's defaults. ChapterFlow (app/book/layout.tsx) sets its own title, description and openGraph,
// which replace these whole; the summary_large_image card is set per page (app/page.tsx, the case studies),
// so /book never inherits it. The title is a plain string, not a template: a root template would also apply
// to /book's own default ("ChapterFlow" would read "ChapterFlow · Will Soltani"), so the portfolio's pages
// spell out their " · Will Soltani" suffix.
export const metadata: Metadata = {
  title: "Will Soltani · Products built and run on AWS",
  description:
    "Will Soltani designs, builds and runs production software for founders and teams: AWS back ends, web and mobile products, AI features.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Will Soltani · Products built and run on AWS",
    description:
      "AWS back ends, web and mobile products and AI features, designed, built and run in production.",
    url: "/",
    siteName: "Will Soltani",
    locale: "en_CA",
    type: "website",
    images: [
      {
        url: "/og/soltani-og.png",
        width: 1200,
        height: 630,
        alt: "Will Soltani: Products built and run on AWS, over a dark data hall",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const isChapterFlowSurface =
    isChapterFlowSiteHost(host) ||
    isChapterFlowAppHost(host) ||
    isChapterFlowAuthHost(host);

  return (
    <html lang="en" className={`${GeistSans.className} ${GeistMono.variable}`}>
      <body
        className={[
          "min-h-screen w-full overflow-x-hidden text-slate-100 antialiased",
          isChapterFlowSurface ? "bg-[#040812]" : "bg-[#070b16]",
        ].join(" ")}
      >
        {!isChapterFlowSurface ? <PortfolioBackground /> : null}

        {children}
      </body>
    </html>
  );
}

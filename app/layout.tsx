import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const metadata: Metadata = {
  title: "Will Soltani | Cloud Portfolio",
  description:
    "AWS-focused cloud portfolio featuring production-style projects, architecture, security, and observability.",
  metadataBase: new URL("https://soltani.org"),
  openGraph: {
    title: "Will Soltani | Cloud Portfolio",
    description:
      "AWS-focused cloud portfolio with production-grade projects and case studies.",
    url: "https://soltani.org",
    siteName: "Will Soltani",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.className} ${GeistMono.variable}`}
    >
      <body className="min-h-screen w-full overflow-x-hidden bg-[#070b16] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

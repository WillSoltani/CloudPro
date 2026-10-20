import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  isChapterFlowAppHost,
  isChapterFlowAuthHost,
  isChapterFlowSiteHost,
} from "@/app/_lib/chapterflow-brand";
import { TEXT_LINK } from "@/components/film/sectionTokens";


async function onChapterFlowHost(): Promise<boolean> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  return isChapterFlowSiteHost(host) || isChapterFlowAppHost(host) || isChapterFlowAuthHost(host);
}

export async function generateMetadata(): Promise<Metadata> {
  // ChapterFlow hosts get a title without the portfolio's name.
  return { title: (await onChapterFlowHost()) ? "Not found" : "Not found · Will Soltani" };
}

/**
 * The 404 page on the night base (Next's default is black text on it). ChapterFlow hosts get a neutral
 * variant: the same two lines and a link home, no portfolio links and no portfolio type.
 */
export default async function NotFound() {
  if (await onChapterFlowHost()) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-6 py-24">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Nothing at this address.</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          This page may have moved, or the link has a typo.
        </p>
        <p className="mt-8">
          <Link href="/" className={TEXT_LINK}>
            Go to the home page
          </Link>
        </p>
      </main>
    );
  }
  return (
    // No next/font here: the root 404 sits in every route's tree, so a font stylesheet imported by it was
    // preloaded on every page, ChapterFlow's included. Its line is set in the serif stack's fallback (Iowan
    // Old Style, Georgia), named directly: `font-serif` alone needs the Fraunces variable.
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-6 py-24">
      <h1
        className="text-4xl font-normal leading-tight text-slate-50 sm:text-5xl"
        style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}
      >
        Nothing at this address.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300">
        This page may have moved, or the link has a typo.
      </p>
      <p className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-base">
        <Link href="/" className={TEXT_LINK}>
          Back to soltani.org
        </Link>
        <a href="mailto:will@soltani.org" aria-label="Email will@soltani.org" className={TEXT_LINK}>
          will@soltani.org
        </a>
      </p>
    </main>
  );
}

import { Fraunces } from "next/font/google";
import { preconnect, preload } from "react-dom";
import manifest from "@/public/films/beacon/manifest.json";
import { PageShell } from "@/components/PageShell";
import { HomeClient } from "@/components/HomeClient";

// Page-scoped so ChapterFlow routes never preload it; exposed to the film captions as `font-serif`.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: "normal",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-fraunces",
});

// Mirrors the rewrite in components/film/BeaconHero.tsx so the preload names the same URL.
const FILM_BASE = process.env.NEXT_PUBLIC_FILM_BASE;
const filmBase = FILM_BASE ? `${FILM_BASE.replace(/\/+$/, "")}/${manifest.name}` : manifest.base;
const poster =
  FILM_BASE && manifest.poster.startsWith(manifest.base)
    ? `${filmBase}${manifest.poster.slice(manifest.base.length)}`
    : manifest.poster;

export default function Home() {
  if (/^https?:\/\//.test(filmBase)) preconnect(new URL(filmBase).origin);
  preload(poster, { as: "image", fetchPriority: "high" });
  return (
    <PageShell className={fraunces.variable}>
      <HomeClient />
    </PageShell>
  );
}

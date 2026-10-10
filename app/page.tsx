import { Fraunces } from "next/font/google";
import { preconnect, preload } from "react-dom";
import manifest from "@/public/films/beacon/manifest.json";
import { resolveFilm } from "@/components/film/filmBase";
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

// The same rewrite BeaconHero applies, so the preload names the hero's poster URL. Only the hero
// poster is preloaded: the chapter dividers fetch on approach through ScrollFilm's observer.
const beacon = resolveFilm(manifest);

export default function Home() {
  if (/^https?:\/\//.test(beacon.base)) preconnect(new URL(beacon.base).origin);
  preload(beacon.poster, { as: "image", fetchPriority: "high" });
  return (
    <PageShell className={fraunces.variable}>
      <HomeClient />
    </PageShell>
  );
}

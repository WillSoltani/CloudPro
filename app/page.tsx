import { Fraunces } from "next/font/google";
import { preconnect, preload } from "react-dom";
import { HERO_FILM, HOLD_KEYS, HOLD_SECTIONS, HOLD_STORAGE_KEY } from "@/components/film/reel";
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

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * Runs while the HTML is parsed, before any JS bundle: on a cold load into a hold (a #section deep
 * link, or a reload/back to a position the browser restores) it shows that hold's key straight away,
 * so the first paint is the held frame rather than flat night under the panel. It only adds a <style>
 * and a preload <link> to <head> (never touching React-rendered nodes, so hydration is unaffected);
 * FilmBackdrop takes over the key layers and removes the style once it runs.
 */
const HOLD_BOOT = `(function(){try{
var keys=${json(HOLD_KEYS)},holds=${json(HOLD_SECTIONS)},id=decodeURIComponent(location.hash.slice(1)),h=-1;
for(var i=0;i<holds.length;i++)if(holds[i].indexOf(id)>=0)h=i;
if(h<0){var n=performance.getEntriesByType("navigation")[0],t=n&&n.type;
if(t==="reload"||t==="back_forward"){var s=sessionStorage.getItem(${json(HOLD_STORAGE_KEY)});if(s)h=+s;}}
if(!(h>=0)||!keys[h])return;
var st=document.createElement("style");st.id="reel-hold-boot";st.setAttribute("data-hold",h);
st.textContent='[data-key="'+h+'"]{background-image:url("'+keys[h]+'");opacity:1}';
document.head.appendChild(st);
var l=document.createElement("link");l.rel="preload";l.as="image";l.href=keys[h];l.setAttribute("fetchpriority","high");
document.head.appendChild(l);
}catch(e){}})();`;

export default function Home() {
  // The reel's own (resolveFilm-ed) hero manifest, so the preload names the poster the hero shows.
  // Only the hero poster is preloaded: the backdrop fetches every segment's frames on approach.
  if (/^https?:\/\//.test(HERO_FILM.base)) preconnect(new URL(HERO_FILM.base).origin);
  preload(HERO_FILM.poster, { as: "image", fetchPriority: "high" });
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HOLD_BOOT }} />
      <PageShell className={fraunces.variable}>
        <HomeClient />
      </PageShell>
    </>
  );
}

import type { Metadata } from "next";
import { fraunces } from "@/app/_lib/fraunces";
import { preconnect, preload } from "react-dom";
import { WIDE_QUERY } from "@/components/film/filmBase";
import { HERO_FILM, HOLD_KEYS, HOLD_REVEALS_KEY, HOLD_SECTIONS, HOLD_STORAGE_KEY } from "@/components/film/reel";
import { PageShell } from "@/components/PageShell";
import { HomeClient } from "@/components/HomeClient";
import JSON_LD from "@/app/jsonld.json";

// The homepage only: the large link-preview card and the canonical URL (the layout's defaults apply
// everywhere, including /book, so neither lives there).
export const metadata: Metadata = {
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};


const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * Runs while the HTML is parsed, before any JS bundle: on a cold load into a hold (a #section deep
 * link, or a reload/back to a position the browser restores) it shows that hold's key straight away,
 * so the first paint is the held frame rather than flat night under the panel. It only adds a <style>
 * and a preload <link> to <head> (never touching React-rendered nodes, so hydration is unaffected);
 * FilmBackdrop takes over the key layers and removes the style once it runs.
 *
 * The key is the one for this page load's orientation, picked with the same `wide` media query the
 * backdrop uses (filmBase WIDE_QUERY; HOLD_KEYS.portrait already falls back to landscape per hold). A
 * hold may list no section ids (an empty list never matches a hash).
 *
 * Which hold: on a reload or back/forward the browser restores the scroll position, so the hold saved in
 * sessionStorage wins (even over a #hash left in the URL, which may name a chapter the viewer has since
 * scrolled past; a saved "" means the viewer was not in a hold, so no key); otherwise a #section deep link.
 *
 * The held chapter's read-pin and tail items (About's proof tokens, Contact's footer)
 * are clocked by the backdrop, but the server HTML is fully revealed (no-JS, SEO), so the same style pins
 * them until the backdrop has set the clock (`!important` beats the reveals' server inline opacity;
 * FilmBackdrop removes the style two frames after the key is on its layer, by when the reveals carry their
 * own values). A hash deep link lands at camera rest, where none has arrived yet: hidden. A restored
 * position boots each at the opacity the viewer left it with (FilmBackdrop saves them on `pagehide`,
 * HOLD_REVEALS_KEY, for the same hold and viewport width), so the clock takes over without a step; without
 * that record, hidden as on a deep link. The same record names the painted frame when the viewer left inside
 * a breathing tail (the hold key is the hold pose, a breath away): the boot layer shows that frame instead
 * (`data-src`, which FilmBackdrop keeps on the layer), so the canvas takes over from identical pixels; and
 * the held key's push (the tower's breath: scale and origin), so the key starts where the clock puts it.
 */
const HOLD_BOOT = `(function(){try{
var all=${json(HOLD_KEYS)},keys=matchMedia(${json(WIDE_QUERY)}).matches?all.landscape:all.portrait,holds=${json(HOLD_SECTIONS)},id=decodeURIComponent(location.hash.slice(1)),h=-1,s=null,r=null;
var n=performance.getEntriesByType("navigation")[0],t=n&&n.type;
if(t==="reload"||t==="back_forward"){try{s=sessionStorage.getItem(${json(HOLD_STORAGE_KEY)});r=JSON.parse(sessionStorage.getItem(${json(HOLD_REVEALS_KEY)})||"null");}catch(e){}}
if(s!==null){if(s!=="")h=+s;}else for(var i=0;i<holds.length;i++)if(id&&holds[i]&&holds[i].indexOf(id)>=0)h=i;
if(!(h>=0)||!keys[h])return;
var sec=holds[h]&&holds[h][0]||"",same=s!==null&&r&&r.h===h&&r.w===innerWidth,src=keys[h];
var st=document.createElement("style");st.id="reel-hold-boot";st.setAttribute("data-hold",h);
if(same&&typeof r.f==="string"&&new RegExp("^(https?:)?/[A-Za-z0-9_.:/%-]+$").test(r.f)){src=r.f;st.setAttribute("data-src",src);}
var css='[data-key="'+h+'"]{background-image:url("'+src+'");opacity:1}',ks,kx,ky;
if(same&&r.k&&r.k.length===3){ks=+r.k[0];kx=+r.k[1];ky=+r.k[2];if(ks>0.9&&ks<1.1&&isFinite(kx)&&isFinite(ky))css+='[data-key="'+h+'"]{transform:scale('+ks+');transform-origin:'+kx+'px '+ky+'px}';}
if(sec){var c='[data-chapter="'+sec+'"] [data-reveal]',k,v,set=0;
if(same&&r.o)for(k in r.o){v=+r.o[k];if(/^data-(pin|tail)="[0-9.,e+-]+"$/.test(k)&&v>=0&&v<=1){css+=c+'['+k+']{opacity:'+v+'!important}';set=1;}}
if(!set)css+=c+'[data-pin],'+c+'[data-tail]{opacity:0!important}';}
st.textContent=css;
document.head.appendChild(st);
var l=document.createElement("link");l.rel="preload";l.as="image";l.href=src;l.setAttribute("fetchpriority","high");
document.head.appendChild(l);
}catch(e){}})();`;

export default function Home() {
  // The reel's own (resolveFilm-ed) hero manifests, so the preload names the poster the hero shows.
  // Only the hero poster is preloaded: the backdrop fetches every segment's frames on approach. With a
  // portrait hero film each poster is preloaded only where the hero's <picture> will pick it.
  const { landscape, portrait } = HERO_FILM;
  for (const film of portrait ? [landscape, portrait] : [landscape]) {
    if (!/^https?:\/\//.test(film.base)) continue;
    const origin = new URL(film.base).origin;
    // The poster is a plain <img> (a credentialed connection); the backdrop fetches frames in CORS mode,
    // which cannot reuse it, so warm an anonymous connection as well.
    preconnect(origin);
    preconnect(origin, { crossOrigin: "anonymous" });
  }
  if (portrait) {
    preload(landscape.poster, { as: "image", fetchPriority: "high", media: WIDE_QUERY });
    preload(portrait.poster, { as: "image", fetchPriority: "high", media: `not all and ${WIDE_QUERY}` });
  } else {
    preload(landscape.poster, { as: "image", fetchPriority: "high" });
  }
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HOLD_BOOT }} />
      {/* WebSite, Person and ProfessionalService (copy pack §4: verified fields only). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(JSON_LD) }} />
      <PageShell className={fraunces.variable}>
        <HomeClient />
      </PageShell>
    </>
  );
}

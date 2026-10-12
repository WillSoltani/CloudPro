import reel01 from "@/public/films/reel-01/manifest.json";
import reel05 from "@/public/films/reel-05/manifest.json";
import tower03 from "@/public/films/tower-03/manifest.json";
import tower04 from "@/public/films/tower-04/manifest.json";
import type { FilmManifest } from "@/components/film/filmCore";
import { resolveFilm } from "@/components/film/filmBase";

/**
 * The homepage reel, in scroll order: the hero film, then one divider film above Projects,
 * Experience and Contact. One FilmBackdrop paints all of them on a single fixed canvas; segment
 * `i` of the page is REEL[i]. Resolved once at module level (NEXT_PUBLIC_FILM_BASE applied), so every
 * consumer sees the same stable objects and app/page.tsx preloads exactly the poster the hero shows.
 *
 * Server-safe: app/page.tsx imports it, so it must not pull in client hooks (filmCore is a type import).
 * Act one, the server hall: reel-01 (the hero, hall clips 01–04, K0→K4) and reel-05 (K4→K5, above
 * Projects); storyboard in films-src/reel/. Act two, the city: tower-03 (Toronto at dusk, the lights
 * come on; above Experience) and tower-04 (the camera cranes up into the cloud to the tower's lamp;
 * above Contact). The act break is the long dissolve out of the Projects hold (FilmDivider `dissolveIn`).
 */
export const REEL: readonly FilmManifest[] = [reel01, reel05, tower03, tower04].map(resolveFilm);

/** The opener; NavbarClient and ScrollToTop key off its section (`#hero[data-film]`). */
export const HERO_FILM: FilmManifest = REEL[0];

/**
 * The still for the hold after each segment (FilmBackdrop `keys`): K4 under About–Skills, K5 under
 * Projects, tower-K3 under Experience, tower-K4 under Contact. K4 and K5 are approved keys exported from
 * films-src/reel/keyframes by scripts/films/export-key.sh (exact 16:9, 1920 wide, ≤ 200 KB); the tower
 * keys are not approved stills but the exact last frames of tower-03 and tower-04 at the 1920 tier, so
 * those hold joins are exact by construction. All committed with the app.
 */
export const HOLD_KEYS: readonly string[] = [
  "/images/reel/K4.webp",
  "/images/reel/K5.webp",
  "/images/reel/tower-K3.webp",
  "/images/reel/tower-K4.webp",
];

/**
 * Section ids in each hold, in hold order (hold i follows segment i). Mirrors the HoldPanels in
 * components/HomeClient.tsx; the boot script in app/page.tsx uses it to show the right held key on a
 * cold deep link before any JS has run.
 */
export const HOLD_SECTIONS: readonly (readonly string[])[] = [
  ["about", "certifications", "skills"],
  ["projects"],
  ["experience"],
  ["contact"],
];

/** sessionStorage key: the hold the viewer was in, so a reload there shows the held key at first paint. */
export const HOLD_STORAGE_KEY = "reel-hold";

import reel01 from "@/public/films/reel-01/manifest.json";
import reel05 from "@/public/films/reel-05/manifest.json";
import reel06 from "@/public/films/reel-06/manifest.json";
import reel07 from "@/public/films/reel-07/manifest.json";
import type { FilmManifest } from "@/components/film/filmCore";
import { resolveFilm } from "@/components/film/filmBase";

/**
 * The homepage reel, in scroll order: the hero film, then one divider film above Projects,
 * Experience and Contact. One FilmBackdrop paints all of them on a single fixed canvas; segment
 * `i` of the page is REEL[i]. Resolved once at module level (NEXT_PUBLIC_FILM_BASE applied), so every
 * consumer sees the same stable objects and app/page.tsx preloads exactly the poster the hero shows.
 *
 * Server-safe: app/page.tsx imports it, so it must not pull in client hooks (filmCore is a type import).
 * Films: reel-01 (the hero, clips 01–04, K0→K4) and reel-05/06/07 (one clip each, K4→K7); storyboard in films-src/reel/.
 */
export const REEL: readonly FilmManifest[] = [reel01, reel05, reel06, reel07].map(resolveFilm);

/** The opener; NavbarClient and ScrollToTop key off its section (`#hero[data-film]`). */
export const HERO_FILM: FilmManifest = REEL[0];

/**
 * The approved still for the hold after each segment (FilmBackdrop `keys`): K4 under About–Skills, K5 under
 * Projects, K6 under Experience, K7 under Contact. Exported from films-src/reel/keyframes by
 * scripts/films/export-key.sh (exact 16:9, 1920 wide, ≤ 200 KB); committed with the app.
 */
export const HOLD_KEYS: readonly string[] = ["/images/reel/K4.webp", "/images/reel/K5.webp", "/images/reel/K6.webp", "/images/reel/K7.webp"];

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

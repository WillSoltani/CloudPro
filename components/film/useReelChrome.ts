"use client";

import { useSyncExternalStore } from "react";

/** The chrome under the header: a moving film, a pinned chapter composition, or a body / hold panel. */
export type ReelChrome = "film" | "composed" | "body";
/** Fired on window whenever `<html data-reel-chrome data-reel-section>` changes (FilmBackdrop). */
export const REEL_CHROME_EVENT = "reel:chrome";

/**
 * The page chrome's view of the reel (part five §2a), published by FilmBackdrop from the raw clock on
 * `<html data-reel-chrome data-reel-section>` with a `reel:chrome` event:
 * - `chrome`: `film` while a camera move plays (and through the hero's bare-film tail), `composed` through a
 *   chapter's read pin, `body` over hold panels, releases and bodies;
 * - `section`: the nav section whose unit has lit (its amber frame), "" over the hero and the epilogue.
 * NavbarClient (active pill; blur only over bodies), ScrollToTop (hidden in `film`) and useFilmInView read
 * it. Before the backdrop has measured (server, hydration) it is `film` / "" — the page opens on the hero.
 */
export type ReelChromeState = { chrome: ReelChrome; section: string };

const SERVER: ReelChromeState = { chrome: "film", section: "" };
let cached: ReelChromeState = SERVER;

function subscribe(onChange: () => void) {
  window.addEventListener(REEL_CHROME_EVENT, onChange);
  return () => window.removeEventListener(REEL_CHROME_EVENT, onChange);
}

function read(): ReelChromeState {
  const d = document.documentElement.dataset;
  const chrome = (d.reelChrome as ReelChrome | undefined) ?? "film";
  const section = d.reelSection ?? "";
  if (cached.chrome !== chrome || cached.section !== section) cached = { chrome, section };
  return cached;
}

export function useReelChrome(): ReelChromeState {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

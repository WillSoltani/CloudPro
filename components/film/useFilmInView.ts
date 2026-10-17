"use client";

import { useEffect, useState } from "react";
import { useReelChrome } from "@/components/film/useReelChrome";

/** The homepage opener's section. The brand-name hiding keys off this film only. */
export const HERO_FILM_SELECTOR = "#hero[data-film]";
/** Every film segment of the reel (hero, chapter dividers and chapters). */
export const FILM_SEGMENT_SELECTOR = "[data-film-segment]";

type FilmInView = {
  /** The hero film exists on the page and has been observed at least once. */
  present: boolean;
  /** The hero film intersects the viewport (shrunk by `rootMargin`). */
  inView: boolean;
  /**
   * The chrome is over the film: a camera move, the hero's bare-film tail or a chapter's pinned
   * composition (useReelChrome `chrome !== "body"`, published by FilmBackdrop from the raw clock).
   */
  overFilm: boolean;
};

/**
 * Tracks the film under the page chrome (navbar, scroll-to-top). `overFilm` comes from the reel clock
 * (useReelChrome); `inView` stays hero-only (the hero already says the name, so the navbar hides its
 * brand there), from an IntersectionObserver.
 */
export function useFilmInView(rootMargin = "0px"): FilmInView {
  const { chrome } = useReelChrome();
  const [hero, setHero] = useState({ present: false, inView: false });

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(HERO_FILM_SELECTOR);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const inView = entries[entries.length - 1].isIntersecting;
        setHero((prev) => (prev.present && prev.inView === inView ? prev : { present: true, inView }));
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ...hero, overFilm: chrome !== "body" };
}

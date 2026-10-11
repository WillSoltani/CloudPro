"use client";

import { useEffect, useState } from "react";

/** The homepage opener's section. The brand-name hiding keys off this film only. */
export const HERO_FILM_SELECTOR = "#hero[data-film]";
/** Every film segment of the reel (hero and chapter dividers). */
export const FILM_SEGMENT_SELECTOR = "[data-film-segment]";

type FilmInView = {
  /** The hero film exists on the page and has been observed at least once. */
  present: boolean;
  /** The hero film intersects the viewport (shrunk by `rootMargin`). */
  inView: boolean;
  /**
   * A film segment (hero or divider) is playing under the chrome: its top has reached `inset` px from
   * the viewport top and its stage has not been released yet (bottom still below the viewport bottom).
   */
  overFilm: boolean;
};

const INITIAL: FilmInView = { present: false, inView: false, overFilm: false };

/**
 * Tracks the film under the page chrome (navbar, scroll-to-top), so the chrome can stay out of the
 * picture while any segment plays and come back over the hold panels. `inView` stays hero-only (the
 * hero already says the name, so the navbar hides its brand there). State changes only inside the
 * observer, scroll/resize listeners and a frame callback.
 */
export function useFilmInView(rootMargin = "0px", inset = 0): FilmInView {
  const [state, setState] = useState<FilmInView>(INITIAL);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(HERO_FILM_SELECTOR);
    const segments = [...document.querySelectorAll<HTMLElement>(FILM_SEGMENT_SELECTOR)];
    if (!hero && !segments.length) return;
    let heroIn = false;
    let present = false;
    const publish = () => {
      const h = window.innerHeight;
      const overFilm = segments.some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= inset && r.bottom > h;
      });
      setState((prev) =>
        prev.present === present && prev.inView === heroIn && prev.overFilm === overFilm
          ? prev
          : { present, inView: heroIn, overFilm },
      );
    };
    const io = new IntersectionObserver(
      (entries) => {
        heroIn = entries[entries.length - 1].isIntersecting;
        present = true;
        publish();
      },
      { rootMargin },
    );
    if (hero) io.observe(hero);
    const raf = requestAnimationFrame(publish);
    window.addEventListener("scroll", publish, { passive: true });
    window.addEventListener("resize", publish);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", publish);
      window.removeEventListener("resize", publish);
    };
  }, [rootMargin, inset]);

  return state;
}

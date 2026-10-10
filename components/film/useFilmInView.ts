"use client";

import { useEffect, useState } from "react";

/** The homepage opener's section. Page chrome keys off this film only, never the chapter dividers. */
export const HERO_FILM_SELECTOR = "#hero[data-film]";

type FilmInView = {
  /** The hero film exists on the page and has been observed at least once. */
  present: boolean;
  /** The hero film intersects the viewport (shrunk by `rootMargin`). */
  inView: boolean;
};

const INITIAL: FilmInView = { present: false, inView: false };

/**
 * Tracks whether the hero film is on screen, so chrome (navbar, scroll-to-top) can stay out of the
 * picture while it plays. The lower-page dividers are also `[data-film]` sections but do not count:
 * the chrome behaves as on any page section while they play. State changes only inside the observer.
 */
export function useFilmInView(rootMargin = "0px"): FilmInView {
  const [state, setState] = useState<FilmInView>(INITIAL);

  useEffect(() => {
    const film = document.querySelector<HTMLElement>(HERO_FILM_SELECTOR);
    if (!film) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setState({ present: true, inView: entry.isIntersecting });
      },
      { rootMargin },
    );
    io.observe(film);
    return () => io.disconnect();
  }, [rootMargin]);

  return state;
}

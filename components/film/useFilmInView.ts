"use client";

import { useEffect, useState } from "react";

type FilmInView = {
  /** A `[data-film]` section exists on the page and has been observed at least once. */
  present: boolean;
  /** That section intersects the viewport (shrunk by `rootMargin`). */
  inView: boolean;
};

const INITIAL: FilmInView = { present: false, inView: false };

/**
 * Tracks whether the page's first scroll film is on screen, so chrome (navbar, scroll-to-top)
 * can stay out of the picture while it plays. State changes only inside the observer callback.
 */
export function useFilmInView(rootMargin = "0px"): FilmInView {
  const [state, setState] = useState<FilmInView>(INITIAL);

  useEffect(() => {
    const film = document.querySelector<HTMLElement>("[data-film]");
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

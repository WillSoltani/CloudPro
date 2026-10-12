"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useMotionValue } from "framer-motion";
import type { FilmManifest } from "@/components/film/filmCore";
import { FilmProgressContext } from "@/components/film/filmProgress";
import { REEL_OBJECT_POSITION, useFilmBackdrop } from "@/components/film/FilmBackdrop";

type Props = {
  /** A manifest from the backdrop's reel (same object); its position in the reel is the segment index. */
  film: FilmManifest;
  /** Scroll distance in viewport heights (svh). */
  length: number;
  id: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Under prefers-reduced-motion, step through this many stills instead of scrubbing. */
  reducedSteps?: number;
  /**
   * Length of the crossfade out of the previous hold as this segment begins, as a fraction of this
   * segment's scroll (default ≈ 120 px). Use a long one where the subject changes.
   */
  dissolveIn?: number;
  /** Overlays inside the sticky stage; read progress with useFilmProgress(). */
  children?: ReactNode;
};

// Sized like the backdrop canvas (top-aligned, dynamic viewport height) with the same cover crop and
// focus, so the poster sits exactly on the first painted frame; the stage clips what runs past 100svh.
const POSTER = "absolute inset-x-0 top-0 h-dvh w-full object-cover transition-opacity duration-300";

/**
 * One film of the reel: a tall section that scrolls the backdrop through `film`, with a sticky
 * full-viewport stage for its captions. It draws nothing itself; FilmBackdrop paints the frames
 * behind it. The hero (index 0) also carries the SSR poster (the first paint) until the backdrop
 * has drawn its first frame.
 *
 * Test hooks: section `data-film` `data-count` `data-film-segment` `data-index`, and `data-loaded`
 * (frames decoded, written by the backdrop).
 */
export function FilmSegment({
  film,
  length,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  reducedSteps = 5,
  dissolveIn,
  children,
}: Props) {
  const backdrop = useFilmBackdrop();
  const index = backdrop.indexOf(film);
  const hero = index === 0;
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useMotionValue(0);
  // Published by the backdrop's rAF draw; false on the server and until the first hero frame paints.
  const drawn = useSyncExternalStore(
    backdrop.subscribeDrawn,
    () => hero && backdrop.hasDrawn(0),
    () => false,
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (index < 0) {
      console.error(`FilmSegment: "${film.name}" is not in the backdrop's reel`);
      return;
    }
    return backdrop.register({ index, film, el, reducedSteps, progress, dissolveIn });
  }, [backdrop, index, film, reducedSteps, progress, dissolveIn]);

  return (
    <FilmProgressContext.Provider value={progress}>
      <section
        ref={sectionRef}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        data-film={film.name}
        data-count={film.count}
        data-film-segment=""
        data-index={index}
        className="relative"
        style={{ height: `${length * 100}svh` }}
      >
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          {hero ? (
            // Poster: the first paint, and the fallback until the backdrop has landed on its target frame.
            // eslint-disable-next-line @next/next/no-img-element -- must match the canvas crop exactly
            <img
              src={film.poster}
              alt=""
              aria-hidden
              fetchPriority="high"
              className={`${POSTER} ${drawn ? "opacity-0" : "opacity-100"}`}
              style={{ objectPosition: REEL_OBJECT_POSITION }}
            />
          ) : null}
          <div className="relative h-full w-full">{children}</div>
        </div>
      </section>
    </FilmProgressContext.Provider>
  );
}

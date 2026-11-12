"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type SyntheticEvent } from "react";
import type { FilmEntry, FilmManifest } from "@/components/film/filmCore";
import { WIDE_QUERY } from "@/components/film/filmBase";
import { FilmProgressContext } from "@/components/film/filmProgress";
import { REEL_OBJECT_POSITION, useFilmBackdrop } from "@/components/film/FilmBackdrop";
import { useSegmentRegistration } from "@/components/film/useSegmentRegistration";

type Props = {
  /**
   * The reel entry this segment plays (components/film/reel.ts REEL, the same object the backdrop holds);
   * either of its manifests also works. Its position in the reel is the segment index; the backdrop
   * decides which of the entry's films plays (portrait where the `wide` rule fails and one exists).
   */
  film: FilmEntry | FilmManifest;
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
  /**
   * Length of the fade onto this segment's own end key (the hold after it), as a fraction (0.01–0.5) of
   * this segment's scroll, eased with smootherstep (default ≈ 160 px, linear; the hero 6 %). Use it when
   * the key is not the segment's last frame, e.g. the epilogue's dissolve onto tower-K4 (0.273).
   */
  keyIn?: number;
  /**
   * The nav section this segment carries (`<html data-reel-section>`), from move frame `activeFrom` (its
   * unit's amber frame); "" clears the nav (the hero, the epilogue). Omitted: the previous one carries on.
   */
  section?: string;
  activeFrom?: number;
  /** Overlays inside the sticky stage; read progress with useFilmProgress(). */
  children?: ReactNode;
};

// Sized like the backdrop canvas (top-aligned, dynamic viewport height) with the same cover crop and
// focus, so the poster sits exactly on the first painted frame; the stage clips what runs past 100svh.
const POSTER = "absolute inset-x-0 top-0 h-dvh w-full object-cover transition-opacity duration-300";

/**
 * One film of the reel: a tall section that scrolls the backdrop through `film`, with a sticky
 * full-viewport stage for its captions. It draws nothing itself; FilmBackdrop paints the frames
 * behind it. The hero (index 0) also carries the SSR poster (the first paint), up while the clock
 * targets the hero and rack-00 has not landed; with a portrait film the poster is a <picture> that
 * picks by the same `wide` rule at parse time.
 *
 * Test hooks: section `data-film` `data-count` (the manifest this page load plays; the landscape one
 * on the server and during hydration) `data-film-segment` `data-index`, and `data-loaded` (frames
 * decoded, written by the backdrop).
 */
export function FilmSegment({
  film,
  length,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  reducedSteps = 5,
  dissolveIn,
  keyIn,
  section,
  activeFrom,
  children,
}: Props) {
  const backdrop = useFilmBackdrop();
  const sectionRef = useRef<HTMLElement>(null);
  const { index, entry, manifest, progress } = useSegmentRegistration(film, sectionRef, {
    reducedSteps,
    dissolveIn,
    keyIn,
    section,
    activeFrom,
  });
  const hero = index === 0;
  // Published by the backdrop: up on the server and while the clock targets segment 0 before it has landed
  // (a cold load at the top; a return to the top before rack-00 has painted), down everywhere else, so the
  // poster never bands the chapter joined over the hero's stage.
  const posterUp = useSyncExternalStore(
    backdrop.subscribeDrawn,
    () => !hero || backdrop.posterUp(),
    () => true,
  );

  const posterClass = `${POSTER} ${posterUp ? "opacity-100" : "opacity-0"}`;
  // A poster that fails to load (a CDN outage) is hidden rather than drawn as a broken-image glyph over the
  // hero; one that failed before hydration is caught by the effect.
  const posterRef = useRef<HTMLImageElement>(null);
  const hidePoster = (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.visibility = "hidden";
  };
  useEffect(() => {
    const img = posterRef.current;
    if (img?.complete && img.naturalWidth === 0) img.style.visibility = "hidden";
  }, []);

  return (
    <FilmProgressContext.Provider value={progress}>
      <section
        ref={sectionRef}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        data-film={manifest.name}
        data-count={manifest.count}
        data-film-segment=""
        data-index={index}
        className="relative"
        style={{ height: `${length * 100}svh` }}
      >
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
          {hero && entry ? (
            // Poster: the first paint, and the fallback until the backdrop has landed on its target frame.
            entry.portrait ? (
              <picture>
                <source media={WIDE_QUERY} srcSet={entry.landscape.poster} />
                <img
                  ref={posterRef}
                  src={entry.portrait.poster}
                  alt=""
                  aria-hidden
                  fetchPriority="high"
                  onError={hidePoster}
                  className={posterClass}
                  style={{ objectPosition: REEL_OBJECT_POSITION }}
                />
              </picture>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- must match the canvas crop exactly
              <img
                ref={posterRef}
                src={entry.landscape.poster}
                alt=""
                aria-hidden
                fetchPriority="high"
                onError={hidePoster}
                className={posterClass}
                style={{ objectPosition: REEL_OBJECT_POSITION }}
              />
            )
          ) : null}
          <div className="relative h-full w-full">{children}</div>
        </div>
      </section>
    </FilmProgressContext.Provider>
  );
}

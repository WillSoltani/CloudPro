"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReducedMotionSafe } from "@/components/film/filmCore";
import { useFilmBackdrop } from "@/components/film/FilmBackdrop";
import {
  PerspectivePlate,
  type PlateHandoff,
  type PlateTrack,
} from "@/components/film/PerspectivePlate";
import { useChapterOptional } from "@/components/film/chapterContext";

/**
 * The rack's section plates (storyboard §5): "01 About" … "04 Projects" mapped in perspective onto each
 * opened unit's label well (170 × 20 mm), the number in amber Geist Mono and the name in Fraunces. The
 * section's real h2 stays in HTML; the plate is decorative (PerspectivePlate is `aria-hidden`); with
 * `handoff` it flies into that h2 (part five §2d). The tower chapters have no plate.
 *
 * Tracks: components/film/plates/<film>.json, the landscape camera's well corners per film frame, written
 * by scripts/films/rack/page-plates.py from `scene.py export --plates` run on the same snapshot as the
 * frames (corners TL TR BR BL in frame fractions, and an alpha that carries the appear / lift-off rules).
 * Each loads on approach (a separate chunk, fetched once the painted segment is within one of its own).
 *
 * Both cameras: `<film>.json` (landscape) and `<film>-p.json` (portrait), the page format of the
 * renderer's final export (films-src/rack/final/export/page/, row per film frame, the breathing tail's 48
 * rows padded after the move). FilmChapter mounts a plate wherever useRackPlatesOn() holds (motion allowed,
 * no Save-Data); elsewhere the heading arrives at the unit's amber frame instead.
 */
type TrackLoader = () => Promise<{ default: PlateTrack }>;
const TRACKS: Readonly<Record<string, { landscape: TrackLoader; portrait: TrackLoader }>> = {
  "rack-01": {
    landscape: () => import("@/components/film/plates/rack-01.json"),
    portrait: () => import("@/components/film/plates/rack-01-p.json"),
  },
  "rack-02": {
    landscape: () => import("@/components/film/plates/rack-02.json"),
    portrait: () => import("@/components/film/plates/rack-02-p.json"),
  },
  "rack-03": {
    landscape: () => import("@/components/film/plates/rack-03.json"),
    portrait: () => import("@/components/film/plates/rack-03-p.json"),
  },
  "rack-04": {
    landscape: () => import("@/components/film/plates/rack-04.json"),
    portrait: () => import("@/components/film/plates/rack-04-p.json"),
  },
};

/** The well's 170 × 20 mm at 10 px per mm: large, so the text stays crisp when the plate is near. */
const BOX: readonly [number, number] = [1700, 200];

const noSubscribe = () => () => {};
const saveDataOn = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const onClient = () => true;
const onServer = () => false;

/**
 * Whether this page load draws the rack's plates: on the client, without prefers-reduced-motion and
 * without Save-Data (both cameras have tracks). False on the server and during hydration, so the server
 * HTML carries the headings on their no-plate windows (fully revealed).
 */
export function useRackPlatesOn(): boolean {
  const reduced = useReducedMotionSafe();
  const saveData = useSyncExternalStore(noSubscribe, saveDataOn, onServer);
  const mounted = useSyncExternalStore(noSubscribe, onClient, onServer);
  return mounted && !reduced && !saveData;
}

/**
 * One section's plate on segment `index` (its film's track); renders nothing until the track has loaded.
 * With `handoff`, inside a FilmChapter: after its opaque run the plate flies into the chapter's heading
 * (`[data-plate-target]`) on the chapter's clock, landing at its choreography's `land` (part five §2d).
 */
export function RackPlate({
  index,
  n,
  name,
  handoff = false,
}: {
  index: number;
  n: string;
  name: string;
  handoff?: boolean;
}) {
  const backdrop = useFilmBackdrop();
  const chapter = useChapterOptional();
  const flight = useMemo<PlateHandoff | undefined>(
    () =>
      handoff && chapter
        ? {
            frame: chapter.frame,
            land: chapter.choreo.land,
            h2: chapter.head.h2,
            target: () =>
              chapter.sectionRef.current?.querySelector<HTMLElement>("[data-plate-target]") ?? null,
            pinned: () => chapter.composeRef.current,
            raw: chapter.rawFrame,
          }
        : undefined,
    [handoff, chapter],
  );
  const film = backdrop.reel[index]?.landscape.name;
  const [track, setTrack] = useState<PlateTrack | null>(null);

  useEffect(() => {
    const entry = backdrop.reel[index];
    const played = backdrop.manifestAt(index);
    const loaders = film ? TRACKS[film] : undefined;
    if (!entry || !played || !loaders) return;
    // The camera this page load plays (the backdrop's pick).
    const load = played === entry.portrait ? loaders.portrait : loaders.landscape;
    const { drawnSegment } = backdrop;
    let cancelled = false;
    let requested = false;
    const approach = () => {
      const painted = drawnSegment.get();
      if (requested || painted < 0 || Math.abs(painted - index) > 1) return;
      requested = true;
      load().then(
        (m) => {
          if (!cancelled) setTrack(m.default);
        },
        () => {}, // no track: the plate simply does not draw
      );
    };
    const off = drawnSegment.on("change", approach);
    approach();
    return () => {
      cancelled = true;
      off();
    };
  }, [backdrop, film, index]);

  if (!track) return null;
  return (
    <PerspectivePlate index={index} track={track} portraitTrack={track} box={BOX} handoff={flight}>
      <div className="flex h-full w-full items-center gap-[44px] whitespace-nowrap px-[40px]">
        <span className="font-mono text-[100px] leading-none tracking-[0.06em] text-lamp">{n}</span>
        <span className="font-serif text-[146px] leading-none text-slate-50 [font-variation-settings:'opsz'_144]">
          {name}
        </span>
      </div>
    </PerspectivePlate>
  );
}

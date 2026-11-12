"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { FilmStats } from "@/components/film/filmStats";

/**
 * The film engine's counters on screen, for the lab and for manual QA: `?hud=1` in the URL. The flag is read
 * on the client after hydration (the server snapshot is always false), so the server HTML and hydration are
 * the same with or without it; without it nothing renders and nothing runs. A fixed overlay that ignores the
 * pointer and the accessibility tree, so it moves nothing on the page.
 */
const noop = () => () => {};
const readHudFlag = () => new URLSearchParams(window.location.search).get("hud") === "1";

export function FilmHud() {
  const on = useSyncExternalStore(noop, readHudFlag, () => false);
  return on ? <FilmHudPanel /> : null;
}

const REFRESH_MS = 250;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

/** Line 1: film, painted / target frame, tier width. */
export function hudPositionLine(s: FilmStats): string {
  const film = s.paintedFilm || "(no paint)";
  return `${film} · f${s.paintedFrame}/${s.targetFrame}${s.paintedSeg !== s.targetSeg ? ` (seg ${s.paintedSeg}/${s.targetSeg})` : ""} · ${s.width}w · ${s.mode}`;
}

/** Line 2: exact share of draws, stale share of ticks, longest stale ms, refetches, frames alive, decoded MB peak, in flight, canvas resizes. */
export function hudStatsLine(s: FilmStats): string {
  return [
    `exact ${pct(s.exactDraws, s.draws)}%`,
    `stale ${pct(s.staleTicks, s.ticks)}%`,
    `max ${Math.round(s.staleMsMax)} ms`,
    `refetch ${s.refetches}`,
    `alive ${s.framesAlive}`,
    `peak ${s.decodedMBPeak.toFixed(0)} MB`,
    `fly ${s.inflight}`,
    `resize ${s.canvasResizes}`,
  ].join(" · ");
}

function FilmHudPanel() {
  const [lines, setLines] = useState("");
  useEffect(() => {
    const read = () => {
      const s = window.__filmStats;
      setLines(s ? `${hudPositionLine(s)}\n${hudStatsLine(s)}` : "film stats not running");
    };
    const id = window.setInterval(read, REFRESH_MS);
    const first = window.setTimeout(read, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);
  return (
    <div
      aria-hidden
      data-film-hud=""
      className="pointer-events-none fixed bottom-2 left-2 z-[1000] max-w-[calc(100vw-1rem)] whitespace-pre-wrap rounded bg-black/75 px-2 py-1 font-mono text-[10px] leading-snug text-white select-none"
    >
      {lines}
    </div>
  );
}

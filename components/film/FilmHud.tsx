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

/**
 * Line 1: film, painted / target frame (then `eff` and the effective target where the engine never loads the target
 * frame by design, e.g. an odd tail frame on a phone), tier width, canvas backing size in device px, the loader, then
 * the input that moved the page last and the smoothing it gets (steady lag in ms; `?smooth=<ms>` sets touch's).
 */
export function hudPositionLine(s: FilmStats): string {
  const film = s.paintedFilm || "(no paint)";
  const eff = s.effectiveFrame !== s.targetFrame ? ` eff ${s.effectiveFrame}` : "";
  return `${film} · f${s.paintedFrame}/${s.targetFrame}${eff}${s.paintedSeg !== s.targetSeg ? ` (seg ${s.paintedSeg}/${s.targetSeg})` : ""} · ${s.width}w · canvas ${s.backingW}x${s.backingH} · ${s.mode} · ${s.input} ${Math.round(s.smoothMs)} ms`;
}

/**
 * Line 2: exact share of draws, stale share of ticks, longest stale ms, refetches, frames alive with their decoded MB
 * (against the budget where the loader has one), decoded MB peak, then for a loader that keeps compressed bytes the
 * bytes held and the redecodes, in flight, canvas resizes. The loader's name ends line 1.
 */
export function hudStatsLine(s: FilmStats): string {
  const budget = s.budgetMB > 0 ? `/${s.budgetMB.toFixed(0)}` : "";
  return [
    `exact ${pct(s.exactDraws, s.draws)}%`,
    `stale ${pct(s.staleTicks, s.ticks)}%`,
    `max ${Math.round(s.staleMsMax)} ms`,
    `refetch ${s.refetches}`,
    `alive ${s.framesAlive} (${s.decodedMB.toFixed(0)}${budget} MB)`,
    `peak ${s.decodedMBPeak.toFixed(0)} MB`,
    ...(s.budgetMB > 0 || s.bytesHeldMB > 0 ? [`bytes ${s.bytesHeldMB.toFixed(1)} MB`, `redecode ${s.redecodes}`] : []),
    `fly ${s.inflight}`,
    `resize ${s.canvasResizes}`,
  ].join(" · ");
}

/**
 * Line 3, with film packs (stage 7): films reading a pack / given up to frame-by-frame files, the film data requests
 * (pack reads + per-frame file requests), pack MB received (read twice), frames from packs / from files. Empty when
 * no film has a pack on this page load (`?pack=0`, or no manifest names one).
 */
export function hudPackLine(s: FilmStats): string {
  if (s.packFilms + s.packFallbackFilms === 0 && s.packRequests === 0) return "";
  return [
    `packs ${s.packFilms}${s.packFallbackFilms ? ` (${s.packFallbackFilms} as files)` : ""}`,
    `data req ${s.packRequests + s.requests} (${s.packRequests} pack + ${s.requests} file)`,
    `pack ${s.packBytesMB.toFixed(1)} MB${s.packBytesRepeatedMB > 0 ? ` (${s.packBytesRepeatedMB.toFixed(2)} twice)` : ""}`,
    `frames ${s.framesFromPacks} pack / ${s.framesFromFiles} file`,
  ].join(" · ");
}

function FilmHudPanel() {
  const [lines, setLines] = useState("");
  useEffect(() => {
    const read = () => {
      const s = window.__filmStats;
      const packs = s ? hudPackLine(s) : "";
      setLines(s ? `${hudPositionLine(s)}\n${hudStatsLine(s)}${packs ? `\n${packs}` : ""}` : "film stats not running");
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

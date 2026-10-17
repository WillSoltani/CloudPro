import rack00 from "@/public/films/rack-00/manifest.json";
import rack01 from "@/public/films/rack-01/manifest.json";
import rack02 from "@/public/films/rack-02/manifest.json";
import rack03 from "@/public/films/rack-03/manifest.json";
import rack04 from "@/public/films/rack-04/manifest.json";
import rack05 from "@/public/films/rack-05/manifest.json";
import rack00p from "@/public/films/rack-00-p/manifest.json";
import rack01p from "@/public/films/rack-01-p/manifest.json";
import rack02p from "@/public/films/rack-02-p/manifest.json";
import rack03p from "@/public/films/rack-03-p/manifest.json";
import rack04p from "@/public/films/rack-04-p/manifest.json";
import rack05p from "@/public/films/rack-05-p/manifest.json";
import tower01 from "@/public/films/tower-01/manifest.json";
import tower01p from "@/public/films/tower-01-p/manifest.json";
import tower04 from "@/public/films/tower-04/manifest.json";
import tower04p from "@/public/films/tower-04-p/manifest.json";
import towerTimeline from "@/components/film/tower.timeline.json";
import timeline from "@/components/film/rack.timeline.json";
import type { FilmEntry, FilmManifest, HoldKeys } from "@/components/film/filmCore";
import { resolveFilm } from "@/components/film/filmBase";

type Breath = NonNullable<FilmEntry["breath"]>;

/**
 * Breathing tails (part five §2e): ON. rack-01…04's manifests carry the 48 rendered tail frames after the
 * move on both cameras (169 / 145 frames; the last tail frame is a hard link of the hold frame f_M), so
 * each rack chapter's read pin and release play them and its hold key is not shown. The keys stay the
 * fallback where no tail frames play: reduced motion and Save-Data (the backdrop's tailCount), the boot
 * key on a cold deep link (held until the canvas has painted, then faded), and the tower's holds (no
 * rendered tails: the key push about the lamp). Off (a kill switch), every tail registers 0 frames: the
 * move still ends at the timeline's segment, the keys hold and the key push stands in for the breath.
 */
const TAILS_ON = true;

type Timed = (typeof timeline)["films"][number] & { tail?: { frames: number } };
const TIMELINE: ReadonlyMap<string, Timed> = new Map(timeline.films.map((f) => [f.name, f as Timed]));

/** A reel entry with resolveFilm() applied to both manifests, and its tail from the timeline. */
function film(
  landscape: FilmManifest,
  extra: Omit<FilmEntry, "landscape" | "portrait"> & { portrait?: FilmManifest } = {},
): FilmEntry {
  const { portrait, ...rest } = extra;
  const t = TIMELINE.get(rest.timeline ?? landscape.name);
  const own = rest.standIn !== true && t;
  // The tail starts at the move's end (the timeline's segment); its frames only where tails are on and
  // every camera's manifest carries them.
  const hasTail = !!own && !!t.tail && [landscape, portrait].every((m) => !m || m.count >= t.frames + t.tail!.frames);
  return {
    landscape: resolveFilm(landscape),
    ...(portrait ? { portrait: resolveFilm(portrait) } : {}),
    ...(own && t.tail ? { tail: { from: t.segment, frames: TAILS_ON && hasTail ? t.tail.frames : 0 } } : {}),
    ...rest,
  };
}

/** Hold key `rack-K0N` after film `rack-0N`: that film's exact last frame at its top tier (both cameras). */
const rackKey = (n: number, portrait = false) =>
  `/images/reel/rack-K0${n}${portrait ? "-p" : ""}.webp`;

/**
 * Chapter pace (part five §2h, Will 2026-10-13): 84 film frames per viewport for the chapters, the exit
 * and the tower; the hero keeps the timeline's 96.
 */
const CHAPTER_PACE = 84;
/** The bridge carries no text since Experience left the page (2026-10-16): a quicker passage, ≈ 2.4 vh. */
const BRIDGE_PACE = 120;

/**
 * The hold key's breath wherever no rendered tail frames play (§2a, §2e): a push of
 * 1 + scale·sin²(π·g(τ)) about `origin` (frame fractions). The rack's holds about the reel's centre point C
 * (only on the fallback paths: Save-Data, or TAILS_ON off; never under reduced motion), the tower's about
 * its lamp (tower-01 0.012 at (0.50, 0.35), tower-04 0.010 at (0.50, 0.848); the tower has no tail frames).
 * The bridge is joined to Contact (no hold), so tower-K3 only shows through its fades and never breathes.
 */
const RACK_BREATH: Breath = { scale: 0.01, origin: [0.5, 0.45] };
const TOWER_01_BREATH: Breath = { scale: 0.012, origin: [0.5, 0.35] };
const TOWER_04_BREATH: Breath = { scale: 0.01, origin: [0.5, 0.848] };

/**
 * The homepage reel, in scroll order: part five, "Round Trip, then up" (the plan's §1, §2i). One fixed
 * canvas (FilmBackdrop) paints them all; segment `i` of the page is REEL[i].
 *
 *   0 rack-00   the hero (the data hall down to the rack), joined to About (no hold)
 *   1 rack-01   About: the switch                     ┐ FilmChapters: the final renders on both cameras,
 *   2 rack-02   Certifications: the security unit     │ each move followed by its 48-frame breathing tail
 *   3 rack-03   Skills: the storage drawer            │ (rack-01/03 121 + 48, rack-02/04 97 + 48); every
 *   4 rack-04   Projects: the server                  ┘ join byte-identical on both cameras
 *   5 rack-05   the exit: the lid closes, the server slides home, the door shuts and the reply climbs into
 *               the fog; no section; its last frame dissolves into the bridge. Final on both cameras
 *               (163 frames, no tail); its first frame is rack-04's last, byte for byte
 *   6 tower-01  the bridge out of the fog over the lake to the tower (145 frames) and the city's lights
 *               coming on (144), one film of 289 (clips mode); a wordless passage like the exit, joined to
 *               it and to Contact (no hold). Its 1920 tier has one codec pop at frame 2 (FLUX's
 *               first-frame step), under the dissolve from the exit's key.
 *   7 tower-04  the crane up into the cloud to the lamp (K3 → K4); Contact and the footer, the page's end
 *
 * Each entry: the landscape manifest, the portrait one where the second camera exists (the rack's second
 * camera; the tower's centre crops x 0.370–0.630, aspect 0.462, tiers 432/499, a quarter of the pixels),
 * the hold key after it (rack-K01…K04: the rack chapters' fallback where no tail plays, and the boot key;
 * rack-K05(-p) for the exit's dissolve into the bridge; tower-K3(-p) for the bridge's dissolve into
 * Contact; tower-K4(-p) under the tower's push: each byte-identical to its film's last frame at the top
 * tier, which for rack-01…04 is also the hold frame f_M), the pace and the key's breath. Resolved once at
 * module level (NEXT_PUBLIC_FILM_BASE applied).
 *
 * Server-safe: app/page.tsx imports it, so it must not pull in client hooks (filmCore is a type import).
 */
export const REEL: readonly FilmEntry[] = [
  film(rack00, { portrait: rack00p }),
  film(rack01, {
    portrait: rack01p,
    key: rackKey(1),
    portraitKey: rackKey(1, true),
    pace: CHAPTER_PACE,
    breath: RACK_BREATH,
  }),
  film(rack02, {
    portrait: rack02p,
    key: rackKey(2),
    portraitKey: rackKey(2, true),
    pace: CHAPTER_PACE,
    breath: RACK_BREATH,
  }),
  film(rack03, {
    portrait: rack03p,
    key: rackKey(3),
    portraitKey: rackKey(3, true),
    pace: CHAPTER_PACE,
    breath: RACK_BREATH,
  }),
  film(rack04, {
    portrait: rack04p,
    key: rackKey(4),
    portraitKey: rackKey(4, true),
    pace: CHAPTER_PACE,
    breath: RACK_BREATH,
  }),
  // The exit: rack-05 on both cameras (163 frames, scene 648–810, no tail; its first frame is rack-04's
  // last, byte for byte, landscape and portrait); its key rack-K05(-p) is its own last frame.
  film(rack05, {
    portrait: rack05p,
    key: rackKey(5),
    portraitKey: rackKey(5, true),
    pace: CHAPTER_PACE,
  }),
  film(tower01, {
    portrait: tower01p,
    key: "/images/reel/tower-K3.webp",
    portraitKey: "/images/reel/tower-K3-p.webp",
    pace: BRIDGE_PACE,
    breath: TOWER_01_BREATH,
  }),
  film(tower04, {
    portrait: tower04p,
    key: "/images/reel/tower-K4.webp",
    portraitKey: "/images/reel/tower-K4-p.webp",
    pace: CHAPTER_PACE,
    breath: TOWER_04_BREATH,
  }),
];

/** Reel indices by role (the page's chapters read their film from here). */
export const REEL_INDEX = {
  hero: 0,
  about: 1,
  certifications: 2,
  skills: 3,
  projects: 4,
  exit: 5,
  bridge: 6,
  contact: 7,
} as const;

/** The opener's entry; NavbarClient and ScrollToTop key off its section (`#hero[data-film]`). */
export const HERO_FILM: FilmEntry = REEL[REEL_INDEX.hero];

/**
 * The still for the hold after each segment (FilmBackdrop `keys`; `keys.x[i]` after segment i), per
 * orientation, derived from REEL: `portrait[i]` is the entry's `portraitKey` when it has a portrait film,
 * else its landscape `key` (the per-index fallback). app/page.tsx's boot script picks the same side.
 */
export const HOLD_KEYS: HoldKeys = {
  landscape: REEL.map((e) => e.key),
  portrait: REEL.map((e) => (e.portrait && e.portraitKey) || e.key),
};

/**
 * Section ids in each hold, in hold order (hold i follows segment i): the anchor each chapter puts at its
 * camera rest. The boot script in app/page.tsx uses it to show the right held key on a cold deep link
 * before any JS has run. An empty list is a hold with no section (the hero, the exit and the bridge are
 * joined to what follows; a stale /#experience link matches none, so the page loads at the top).
 */
export const HOLD_SECTIONS: readonly (readonly string[])[] = [
  [],
  ["about"],
  ["certifications"],
  ["skills"],
  ["projects"],
  [],
  [],
  ["contact"],
];

/** sessionStorage key: the hold the viewer was in, so a reload there shows the held key at first paint. */
export const HOLD_STORAGE_KEY = "reel-hold";

/**
 * sessionStorage key, written on `pagehide`: the held chapter's read-pin and tail reveals as the viewer left
 * them, `{h: hold, w: innerWidth, o: {'data-pin="a,b"': opacity, …}}`, so a reload or back/forward there
 * (the browser restores the scroll) boots each one in that state instead of hidden (app/page.tsx).
 */
export const HOLD_REVEALS_KEY = "reel-hold-reveals";

// ---- Timing. Rack films from the renderer's timeline: components/film/rack.timeline.json is
// films-src/rack/final/export/rack.timeline.json with each anchor's per-frame `track` moved out to
// components/film/anchors/<film>.json (so the client bundle carries ≈ 2 KB gzipped of it, not 13; a re-copy
// redoes that split). The tower's films are not in it: their moves come from their manifests (count − 1) and
// their beats from components/film/tower.timeline.json.
// Scroll is a pace in film frames per viewport: the timeline's page constant (96) unless the entry sets
// its own `pace`, so a retune is never a re-render.

// The tower's timeline (components/film/tower.timeline.json, a copy of films-src/tower2/export/) carries
// beats and counts only; its films' moves are their manifests' last frame index (segmentOf).
const TOWER_COUNTS: ReadonlyMap<string, number> = new Map(towerTimeline.films.map((f) => [f.name, f.count]));

for (const e of REEL) {
  const towerCount = TOWER_COUNTS.get(e.landscape.name);
  if (towerCount !== undefined) {
    for (const m of e.portrait ? [e.landscape, e.portrait] : [e.landscape]) {
      if (m.count !== towerCount) console.warn(`reel: ${m.name} has ${m.count} frames; tower.timeline.json says ${towerCount}`);
    }
  }
  const t = TIMELINE.get(e.timeline ?? e.landscape.name);
  if (!t || e.standIn === true) continue;
  const withTail = t.frames + (t.tail?.frames ?? 0);
  for (const m of e.portrait ? [e.landscape, e.portrait] : [e.landscape]) {
    if (m.count !== t.frames && m.count !== withTail) {
      console.warn(`reel: ${m.name} has ${m.count} frames; rack.timeline.json says ${t.frames} (+ tail)`);
    }
  }
}

/**
 * The camera move's frames (M): the timeline's segment, else (the tower, a stand-in) the manifest's last
 * frame index.
 */
export function segmentOf(entry: FilmEntry): number {
  const t = entry.standIn === true ? undefined : TIMELINE.get(entry.timeline ?? entry.landscape.name);
  return t?.segment ?? entry.landscape.count - 1;
}

/**
 * A segment's `keyIn` from its timeline's `static_tail` beat: the share of the move that holds the last
 * frame (the exit: rack-05's f144–162 of 162, 0.111), over which the hold key fades in invisibly. Undefined
 * without one.
 */
export function keyInOf(entry: FilmEntry): number | undefined {
  const t = TIMELINE.get(entry.timeline ?? entry.landscape.name);
  const tail = t?.beats.find((b) => b.id === "static_tail");
  return t && tail ? (t.segment - tail.from) / t.segment : undefined;
}

/** The camera move of a reel entry in viewport heights (svh): its segment frames / its pace. */
export function moveVhOf(entry: FilmEntry): number {
  return segmentOf(entry) / (entry.pace ?? timeline.frames_per_vh);
}

/**
 * FilmSegment `length` (viewport heights of scroll) of a legacy segment (the hero, the exit, the bridge): its move plus
 * the viewport its sticky stage occupies.
 */
export function lengthOf(entry: FilmEntry): number {
  return moveVhOf(entry) + 1;
}

/** The hold key's breath for a chapter where no tail frames play (the tower; the rack's fallback paths). */
export function breathOf(entry: FilmEntry): FilmEntry["breath"] {
  return entry.breath;
}

/**
 * Rendered breathing-tail frames of an entry (renderer §2e): rack-01…04 `{from: M, frames: 48}` while
 * TAILS_ON (frames 0 when off); none for the hero, the exit, the bridge and the tower.
 */
export function tailOf(entry: FilmEntry): FilmEntry["tail"] {
  return entry.tail;
}

import timeline from "@/components/film/rack.timeline.json";
import towerTimeline from "@/components/film/tower.timeline.json";

/**
 * Chapter choreography (part five §2f): every reveal window of a chapter as local film frames, derived
 * from the renderer's beats in components/film/rack.timeline.json so a renumbered film cannot drift.
 * Windows are [f0, f1] on the chapter's smoothed `frame` (Reveal `at`); M is the move's last frame.
 *
 * Server-safe and pure (no React): HomeClient, the chapters and their QA read the same numbers.
 */

export type FrameWindow = readonly [number, number];

/** One chapter's windows; `head` depends on whether its plate draws (the plate lands at `land`). */
export type ChapterChoreo = {
  /** Reel film name (landscape). */
  film: string;
  /** The move's last frame (the hold pose): the film's segment length. */
  M: number;
  /** The unit's amber frame: the nav switches here, and without a plate the heading arrives here. */
  amber: number;
  /** The plate's flight ends and the h2 takes over: [land, land + 4]. */
  land: number;
  /** Keyboard focus before this raw frame scrolls to the anchor (a revealed hold). */
  headAt: number;
  /** Heading windows with the plate on (h2 at land) and off (h2 at amber). */
  head: { plate: HeadWindows; noPlate: HeadWindows };
  /** One window per item, in content order. */
  items: readonly FrameWindow[];
  /**
   * Windows in fractions of the read pin (Reveal `pin`: 0 = camera rest, 1 = the pin's end), for what
   * arrives while the picture breathes (About's ProofStrip tokens, Experience's bullets, the footer).
   */
  pins?: readonly FrameWindow[];
  /** The read pin after camera rest, in viewport heights. */
  readVh: number;
  /** The nav switch (raw move frame); default `amber`. */
  activeFrom?: number;
};

/**
 * Heading windows. `h2` is the heading (the plate's landing box on the rack); `number` gives the amber
 * number its own window (the tower, where no plate lands); `extra` holds a chapter's other head lines.
 */
export type HeadWindows = {
  h2: FrameWindow;
  number?: FrameWindow;
  support?: FrameWindow;
  lede?: FrameWindow;
  extra?: Readonly<Record<string, FrameWindow>>;
};

/** The nav switch for About (the plan's f20; its unit's amber lands in the hero, rack-00 f190). */
export const ABOUT_ACTIVE_FROM = 20;

type TimelineFilm = (typeof timeline)["films"][number];

function filmOf(name: string): TimelineFilm {
  const f = timeline.films.find((t) => t.name === name);
  if (!f) throw new Error(`choreo: film "${name}" is not in components/film/rack.timeline.json`);
  return f;
}

function beatOf(name: string, id: string): { from: number; to: number } {
  const b = filmOf(name).beats.find((x) => x.id === id);
  if (!b) throw new Error(`choreo: ${name} has no beat "${id}" in rack.timeline.json`);
  return b;
}

/** One exported anchor at camera rest, `rest` in frame fractions (the per-frame track lives in anchors/<film>.json). */
type ExportedAnchor = { rest: readonly [number, number] };
type ExportedAnchors = {
  landscape: Readonly<Record<string, unknown>>;
  portrait: Readonly<Record<string, unknown>>;
  beats: Readonly<Record<string, number>>;
};

function anchorsOfFilm(name: string): ExportedAnchors {
  const a = (filmOf(name) as { anchors?: ExportedAnchors }).anchors;
  if (!a) throw new Error(`choreo: ${name} has no anchors in rack.timeline.json`);
  return a;
}

/** An exported anchor's rest position (frame fractions) on one camera. */
export function anchorRest(
  name: string,
  key: string,
  camera: "landscape" | "portrait" = "landscape",
): readonly [number, number] {
  const a = anchorsOfFilm(name)[camera][key] as ExportedAnchor | undefined;
  if (!a?.rest) throw new Error(`choreo: ${name} has no ${camera} anchor "${key}" in rack.timeline.json`);
  return a.rest;
}

/** An exported anchor beat (a local film frame), e.g. `cartridge_0_tip`, `row_3`. */
export function anchorBeat(name: string, key: string): number {
  const b = anchorsOfFilm(name).beats[key];
  if (typeof b !== "number") throw new Error(`choreo: ${name} has no anchor beat "${key}" in rack.timeline.json`);
  return b;
}

/** Head windows from the heading's arrival frame h: h2 [h, h+4], support [h+2, h+6], lede [h+4, h+10]. */
function headFrom(h: number): HeadWindows {
  return { h2: [h, h + 4], support: [h + 2, h + 6], lede: [h + 4, h + 10] };
}

/**
 * The nav section's switch frame for a rack chapter (FilmChapter `activeFrom`, via `amber`): its unit's
 * amber beat when it falls inside the film, else `fallback` (About's u40 amber lands in the hero, rack-00 f190; the
 * plan's About switch is rack-01 f20).
 */
export function activeFromOf(name: string, fallback = 0): number {
  const f = filmOf(name);
  const amber = f.unit ? f.beats.find((b) => b.id === `${f.unit}_amber`) : undefined;
  return amber ? amber.from : fallback;
}

/**
 * Certifications on rack-02: f26 amber (plate 02, nav) · the plate lifts at the end of its opaque run (f66)
 * and lands at the end of the camera's `straight_down` (f84) · cartridge k settles at its exported tip beat
 * (`cartridge_k_tip` 66/71/76/81), so cert k reveals over [settle − 2, settle + 4], shifted so the first
 * window opens only after the carrier rests (`carrier_out` ends f70 → certs at [74 + 5k, 80 + 5k]) · h2
 * f84–88 · "● SECURITY" f86–90 · lede f88–94 · read pin 0.5 vh · no body. Each column rides its cartridge's
 * exported track while the camera settles (CertificationsSection).
 */
function certifications(): ChapterChoreo {
  const name = "rack-02";
  const f = filmOf(name);
  const n = 4;
  const settles = Array.from({ length: n }, (_, k) => anchorBeat(name, `cartridge_${k}_tip`));
  const land = beatOf(name, "straight_down").to;
  const amber = activeFromOf(name);
  // A cert may not appear before its cartridge has stopped moving: the carrier is still sliding until
  // `carrier_out` ends (f70), so the first window starts no earlier than that rest + 4, and the whole run
  // still ends inside the film (every cert visible by p = 1).
  const carrierRest = beatOf(name, "carrier_out").to;
  const firstSettle = settles[0];
  const latestStart = f.segment - 1 - 6 - (settles[n - 1] - settles[0]);
  const shift = Math.max(0, Math.min(carrierRest + 4, latestStart) - (firstSettle - 2));
  return {
    film: name,
    M: f.segment,
    amber,
    land,
    headAt: land,
    head: { plate: headFrom(land), noPlate: headFrom(amber) },
    items: settles.map((s0): FrameWindow => {
      const settle = s0 + shift;
      return [settle - 2, settle + 4];
    }),
    readVh: 0.5,
  };
}

/**
 * About on rack-01, joined to the hero (§2f): f0–30 the door opens while the hero line and CTA ride out ·
 * f20 plate 01 (nav → About) · the plate lifts at the end of its opaque run (f75) and flies while the lid
 * rises (`lid_up` f74–95), landing at f96 · h2 f96–100 · "● SWITCH" f100–104 · lede f102–108 · bullets
 * [106, 112] [110, 116] [114, 120] · the read pin carries the four ProofStrip tokens (τ .02/.06/.10/.14 of a
 * 0.26 pin, i.e. 8 %, 23 %, 38 %, 54 % of the pin, 15 % each) · release; DeliveryStrip is the body. Without
 * a plate (phones) the heading arrives at f40, clear of the hero's CTA riding out.
 */
function about(): ChapterChoreo {
  const name = "rack-01";
  const f = filmOf(name);
  const land = beatOf(name, "lid_up").to + 1;
  const h = (at: number): HeadWindows => ({ h2: [at, at + 4], support: [at + 4, at + 8], lede: [at + 6, at + 12] });
  return {
    film: name,
    M: f.segment,
    amber: ABOUT_ACTIVE_FROM,
    land,
    headAt: land,
    head: { plate: h(land), noPlate: h(40) },
    items: [0, 1, 2].map((k): FrameWindow => [land + 10 + 4 * k, land + 16 + 4 * k]),
    pins: [0, 1, 2, 3].map((k): FrameWindow => {
      const a = (0.02 + 0.04 * k) / 0.26;
      return [a, a + 0.04 / 0.26];
    }),
    readVh: 0.5,
  };
}


/**
 * Skills on rack-03: f42 amber (plate 03, nav) · the plate lifts at f71 (end of its opaque run) and lands
 * at f92 · group k at [row_k − 2, row_k + 4] as each drive row clears the rack face (the exported `row_k`
 * beats 67/75/81/89/109, row_0 the frontmost) · h2 f92–96 · "● STORAGE" f96–100 · lede f98–104 · read pin
 * 0.5 vh.
 */
function skills(): ChapterChoreo {
  const name = "rack-03";
  const f = filmOf(name);
  const amber = activeFromOf(name);
  const land = 92;
  const h = (at: number): HeadWindows => ({ h2: [at, at + 4], support: [at + 4, at + 8], lede: [at + 6, at + 12] });
  return {
    film: name,
    M: f.segment,
    amber,
    land,
    headAt: land,
    head: { plate: h(land), noPlate: h(amber) },
    items: [0, 1, 2, 3, 4].map((k): FrameWindow => {
      const r = anchorBeat(name, `row_${k}`);
      return [r - 2, r + 4];
    }),
    readVh: 0.5,
  };
}

/**
 * Projects on rack-04: f32 amber (plate 04, nav) · the plate lifts at f37 and makes the long flight to f80
 * over the server sliding out, while the air cover clears the heat sinks (`aircover_to_lid` f72–86) · h2
 * f80–84 · "● SERVER" f82–86 · lede f84–88 · project k at [86 + 4k, 92 + 4k] · read pin 0.5 vh.
 */
function projects(): ChapterChoreo {
  const name = "rack-04";
  const f = filmOf(name);
  const amber = activeFromOf(name);
  const land = 80;
  return {
    film: name,
    M: f.segment,
    amber,
    land,
    headAt: land,
    // The plan's Projects lede is a short one (f84–88), so the cards can follow from f86.
    head: {
      plate: { ...headFrom(land), lede: [land + 4, land + 8] },
      noPlate: { ...headFrom(amber), lede: [amber + 4, amber + 8] },
    },
    items: [0, 1].map((k): FrameWindow => [86 + 4 * k, 92 + 4 * k]),
    readVh: 0.5,
  };
}

/**
 * The tower's beats (components/film/tower.timeline.json, a copy of films-src/tower2/export/, 0-based film
 * frames): tower-01 lamp_lit 123 (the lamp steady on the bridge frames), lights_1 236 / lights_2 251 (the
 * waterfront's windows at 25 % / 60 % of their rise), rest 283; tower-04 lamp_settle 112, rest 125.
 */
type TowerFilm = { name: string; count: number; beats: Readonly<Record<string, number | undefined>> };
function towerFilm(name: string): TowerFilm {
  const f = (towerTimeline.films as readonly TowerFilm[]).find((t) => t.name === name);
  if (!f) throw new Error(`choreo: film "${name}" is not in components/film/tower.timeline.json`);
  return f;
}
function towerBeat(name: string, id: string): number {
  const b = towerFilm(name).beats[id];
  if (typeof b !== "number") throw new Error(`choreo: ${name} has no beat "${id}" in tower.timeline.json`);
  return b;
}

/**
 * Contact + footer on tower-04, the page's last chapter (it ends inside the read pin): lamp_settle S (112) ·
 * "05" [S−12, S−8], name [S−10, S−4] · "Let's Connect" [S−4, S+2] · the closing line [S, S+6] · paragraph
 * [S+2, S+8] · link k at [S+4+3k, S+8+3k] · the footer over the first fifth of the pin (τ [0, .2]) · read
 * pin 0.6 vh.
 */
function contact(): ChapterChoreo {
  const name = "tower-04";
  const S = towerBeat(name, "lamp_settle");
  const head: HeadWindows = {
    number: [S - 12, S - 8],
    h2: [S - 10, S - 4],
    extra: { kicker: [S - 4, S + 2], line: [S, S + 6], paragraph: [S + 2, S + 8] },
  };
  return {
    film: name,
    M: towerFilm(name).count - 1,
    amber: S - 12,
    land: S - 10,
    headAt: S - 10,
    head: { plate: head, noPlate: head },
    items: [0, 1, 2].map((k): FrameWindow => [S + 4 + 3 * k, S + 8 + 3 * k]),
    pins: [[0, 0.2]],
    readVh: 0.6,
  };
}

export const CHOREO = {
  about: about(),
  certifications: certifications(),
  skills: skills(),
  projects: projects(),
  contact: contact(),
} as const;


/**
 * The exported rest anchors the compositions centre on (landscape camera; phones stack, so they need none):
 * the four face-up cartridges (x 0.206 / 0.402 / 0.598 / 0.794) and the two heat sinks (x 0.339 / 0.661).
 * Their per-frame tracks are in components/film/anchors/<film>.json (lazily loaded, for riding).
 */
export const ANCHORS = {
  cartridges: [0, 1, 2, 3].map((k) => anchorRest("rack-02", `cartridge_${k}`)),
  heatsinks: [0, 1].map((k) => anchorRest("rack-04", `heatsink_${k}`)),
} as const;

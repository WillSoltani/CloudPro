import { RACK_CAPTIONS } from "@/components/film/rackCaptions";

/**
 * The hero's caption windows, in one place: BeaconCaptions renders them, TickRail puts a tick at each
 * numbered window's start, and NavbarClient keeps the brand hidden while the intro block is up.
 *
 * Two kinds of window, both in hero progress (0–1):
 * - `intro`: the badge, the h1 (name), the titles and the location (HERO_COPY); persistent in the
 *   accessibility tree, present from the first paint when it starts at 0.
 * - `caption`: an optional numbered label (`n` + `label`, which also gets a tick on the rail and a row in
 *   the sr-only "How I work" list), an optional serif `line` and mono `support`, and an optional `cta`
 *   button; a caption with a CTA uses the finale layout (bottom-centred block on phones).
 */
export type HeroBeat = {
  kind: "intro" | "caption";
  from: number;
  to: number;
  n?: string;
  label?: string;
  line?: string;
  support?: string;
  cta?: { label: string; href: string };
};

/** The hero block's strings (verbatim; the rack's captions.json quotes the same ones). */
export const HERO_COPY = {
  badge: RACK_CAPTIONS.hero.badge,
  name: RACK_CAPTIONS.hero.name,
  title: RACK_CAPTIONS.hero.title,
  location: RACK_CAPTIONS.hero.location,
  cta: RACK_CAPTIONS.hero.cta,
} as const;

/**
 * The part-four hero (rack-00, films-src/rack/storyboard.md §5): the intro block for the first 40 %, then
 * the serif line and the button from 74 % through the stage's exit. No numbered beats, so no ticks and
 * no "How I work" list (retired at G1).
 */
export const RACK_HERO_BEATS: readonly HeroBeat[] = [
  { kind: "intro", from: 0, to: 0.4 },
  { kind: "caption", line: RACK_CAPTIONS.hero.line, cta: HERO_COPY.cta, from: 0.74, to: 1 },
];

/** The beats the page plays: the rack-00 hero. */
export const HERO_BEATS: readonly HeroBeat[] = RACK_HERO_BEATS;

/** Hero progress at which the intro block has left (the navbar shows its brand from here; 0.40 for rack-00). */
export const HERO_INTRO_END: number = HERO_BEATS.find((b) => b.kind === "intro")?.to ?? 0.1;

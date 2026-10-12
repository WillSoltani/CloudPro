"use client";

import { motion, useTransform } from "framer-motion";
import type { FilmManifest } from "@/components/film/filmCore";
import { useFilmProgress } from "@/components/film/filmProgress";
import { FilmCaption } from "@/components/film/FilmCaption";
import { FilmSegment } from "@/components/film/FilmSegment";
import { FilmScrims } from "@/components/film/FilmScrims";
import {
  CAPTION_COLUMN,
  CAPTION_LINE,
  CAPTION_SUPPORT,
  CAPTION_SUPPORT_BASE,
  CaptionLabel,
} from "@/components/film/captionTokens";

type Props = {
  /** A manifest from the reel (components/film/reel.ts): the same object the backdrop holds. */
  film: FilmManifest;
  id: string;
  /** `"05 / It runs"`: the number lights in lamp, the words follow in mono caps (uppercased by CSS). */
  label: string;
  /** Serif line (≤ 12 words). */
  line: string;
  /** Mono support line(s); each string is its own line. */
  support?: string | readonly string[];
  /** Keep the caption to the end (`to={1}`): the last divider hands its caption to the section under it. */
  holdCaption?: boolean;
  /** Names the region for assistive tech, e.g. "Chapter 05: It runs". */
  ariaLabel: string;
  /**
   * Crossfade out of the hold above, as a fraction of this divider's scroll (FilmSegment `dissolveIn`;
   * default ≈ 120 px). Set a long one where the subject changes.
   */
  dissolveIn?: number;
  /**
   * Progress at which the caption arrives (default CAPTION_FROM); the left scrim and the tick arrive
   * with it. Push it later when a long dissolve should play on the bare frame first.
   */
  captionFrom?: number;
  /**
   * Peak alpha of the left scrim band (FilmScrims `leftAlpha`, default 0.65). Lower it over the brighter
   * city frames, where the default band reads as a dark rectangle.
   */
  scrimAlpha?: number;
};

// One caption window per divider. The film itself never fades: it continues out of the hold above
// and into the hold below.
const CAPTION_FROM = 0.1;
const CAPTION_TO = 0.9;
const HELD_CAPTION_TO = 0.985;
// The held caption leaves over 0.935–0.985; its scrim follows, gone by the time the stage releases.
const HELD_SCRIM_FADE: [number, number] = [0.95, 1];
// The left scrim arrives just ahead of the caption (over SCRIM_LEAD), so the stage enters from the hold
// as the bare frame.
const SCRIM_LEAD = 0.06;
// Where the scrim and tick start arriving; rounded so the default is exactly 0.04 (0.1 − 0.06 is not).
const leadIn = (from: number) => Math.round((from - SCRIM_LEAD) * 1e4) / 1e4;

const LAMP = "#f0a63c";
const SLATE = "#64748b";

function splitLabel(label: string): { n: string; text: string } {
  const m = /^\s*(\d+)\s*\/\s*(.+?)\s*$/.exec(label);
  return m ? { n: m[1], text: m[2] } : { n: "", text: label };
}

/** The chapter number as one quiet tick at the right edge (desktop only), lit while the caption plays. */
function DividerTick({ n, from, to }: { n: string; from: number; to: number }) {
  const progress = useFilmProgress();
  const color = useTransform(
    progress,
    [from - 0.02, from, to, Math.min(1.001, to + 0.02)],
    [SLATE, LAMP, LAMP, to >= 1 ? LAMP : SLATE],
  );
  // Leaves with its caption: after the usual window, or over the held caption's own last 5 %.
  const out: [number, number] = to > CAPTION_TO ? [to - 0.05, to] : [CAPTION_TO, 0.96];
  const opacity = useTransform(progress, [leadIn(from), from, out[0], out[1]], [0, 1, 1, 0]);
  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 right-6 hidden -translate-y-1/2 items-center gap-2.5 wide:flex xl:right-10"
      style={{ color, opacity }}
    >
      <span className="font-mono text-[10px] leading-none tracking-[0.22em]">{n}</span>
      <span className="h-px w-2 bg-current opacity-70" />
    </motion.div>
  );
}

/**
 * A chapter divider: one short segment of the reel (2 viewport heights of scroll) between two hold
 * panels, carrying a single caption in the hero's typography. No tick rail or hairlines — dividers
 * stay quiet. Reduced motion shows the first and last frame as two stills.
 *
 * By default the hold above crossfades out over ≈ 120 px and the caption arrives at 10 %. Where the
 * subject changes (the act break into the city), `dissolveIn` lengthens the crossfade and `captionFrom`
 * holds the caption, its scrim and its tick back until the dissolve has nearly resolved.
 */
export function FilmDivider({
  film,
  id,
  label,
  line,
  support,
  holdCaption = false,
  ariaLabel,
  dissolveIn,
  captionFrom = CAPTION_FROM,
  scrimAlpha,
}: Props) {
  const { n, text } = splitLabel(label);
  // A held caption leaves over the last 5 % of its window, so it is gone just before the stage releases
  // and never rides up under the header.
  const to = holdCaption ? HELD_CAPTION_TO : CAPTION_TO;
  const supports: readonly string[] =
    support === undefined ? [] : typeof support === "string" ? [support] : support;

  return (
    <FilmSegment
      film={film}
      id={id}
      aria-label={ariaLabel}
      length={2}
      reducedSteps={2}
      dissolveIn={dissolveIn}
    >
      {/* The left band leaves with the caption: with the usual window, or over the last 5 % when the
          caption is held to the end (so it does not outstay the caption and leave a strip at the release). */}
      <FilmScrims
        left
        leftIn={[leadIn(captionFrom), captionFrom]}
        leftFade={holdCaption ? HELD_SCRIM_FADE : [CAPTION_TO - 0.04, CAPTION_TO + 0.02]}
        leftAlpha={scrimAlpha}
      />

      <div className="pointer-events-none absolute inset-0">
        <FilmCaption from={captionFrom} to={to} className={CAPTION_COLUMN}>
          <div aria-hidden>
            <CaptionLabel n={n} label={text} />
            <p className={CAPTION_LINE}>{line}</p>
            {supports.map((s, i) => (
              <p key={s} className={i === 0 ? CAPTION_SUPPORT : `mt-1 ${CAPTION_SUPPORT_BASE}`}>
                {s}
              </p>
            ))}
          </div>
        </FilmCaption>
        {/* The caption as plain text, since the visible copy comes and goes with scroll. */}
        <p className="sr-only">
          {n} {text}: {line} {supports.join(" ")}
        </p>
      </div>

      {n ? <DividerTick n={n} from={captionFrom} to={to} /> : null}
    </FilmSegment>
  );
}

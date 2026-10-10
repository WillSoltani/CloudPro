"use client";

import { motion, useTransform } from "framer-motion";
import {
  FilmCaption,
  ScrollFilm,
  useFilmProgress,
  type FilmManifest,
} from "@/components/film/ScrollFilm";
import { FilmFadeIn, FilmFadeOut } from "@/components/film/FilmFadeOut";
import { FilmScrims } from "@/components/film/FilmScrims";
import {
  CAPTION_COLUMN,
  CAPTION_LINE,
  CAPTION_SUPPORT,
  CAPTION_SUPPORT_BASE,
  CaptionLabel,
} from "@/components/film/captionTokens";

type Props = {
  /** Manifest passed through resolveFilm() at module level, so ScrollFilm sees one stable object. */
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
  /** Crop focal point, 0–1 per axis (storyboard §7: 07 centres its light with `[0.5, 0.5]`). */
  focus?: [number, number];
  /** Names the region for assistive tech, e.g. "Chapter 05: It runs". */
  ariaLabel: string;
};

// One caption window per divider; the film fades in before it and out after it.
const FADE_IN: [number, number] = [0, 0.08];
const CAPTION_FROM = 0.1;
const CAPTION_TO = 0.9;
const FADE_OUT: [number, number] = [0.92, 1];

const LAMP = "#f0a63c";
const SLATE = "#64748b";

function splitLabel(label: string): { n: string; text: string } {
  const m = /^\s*(\d+)\s*\/\s*(.+?)\s*$/.exec(label);
  return m ? { n: m[1], text: m[2] } : { n: "", text: label };
}

/** The chapter number as one quiet tick at the right edge (desktop only), lit while the caption plays. */
function DividerTick({ n, to }: { n: string; to: number }) {
  const progress = useFilmProgress();
  const color = useTransform(
    progress,
    [CAPTION_FROM - 0.02, CAPTION_FROM, to, Math.min(1.001, to + 0.02)],
    [SLATE, LAMP, LAMP, to >= 1 ? LAMP : SLATE],
  );
  const opacity = useTransform(progress, [0.04, CAPTION_FROM, CAPTION_TO, 0.96], [0, 1, 1, 0]);
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
 * A chapter divider: one short film (2 viewport heights of scroll) that fades up from the page base,
 * carries a single caption in the hero's typography, and fades back to the base. No tick rail or
 * hairlines — dividers stay quiet. Reduced motion shows the first and last frame as two stills.
 */
export function FilmDivider({
  film,
  id,
  label,
  line,
  support,
  holdCaption = false,
  focus = [0.5, 0.45],
  ariaLabel,
}: Props) {
  const { n, text } = splitLabel(label);
  const to = holdCaption ? 1 : CAPTION_TO;
  const supports: readonly string[] =
    support === undefined ? [] : typeof support === "string" ? [support] : support;

  return (
    <ScrollFilm
      film={film}
      id={id}
      aria-label={ariaLabel}
      length={2}
      focus={focus}
      fit="cover"
      reducedSteps={2}
      // Room under the released stage so the next section's heading does not butt against it.
      className="bg-night mb-6 sm:mb-10"
    >
      <FilmFadeIn from={FADE_IN[0]} to={FADE_IN[1]} />
      <FilmFadeOut from={FADE_OUT[0]} to={FADE_OUT[1]} />
      {/* The left band leaves with the caption, or stays when the caption is held to the end. */}
      <FilmScrims left leftFade={holdCaption ? null : [CAPTION_TO - 0.04, CAPTION_TO + 0.02]} />

      <div className="pointer-events-none absolute inset-0">
        <FilmCaption from={CAPTION_FROM} to={to} className={CAPTION_COLUMN}>
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

      {n ? <DividerTick n={n} to={to} /> : null}
    </ScrollFilm>
  );
}

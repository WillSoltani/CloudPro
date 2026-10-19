/**
 * Chapter typography (part five §2g), shared by every migrated chapter. One accent: the lamp amber, only
 * for chapter numbers, the support line's dot (the unit's lit status light), link hover and focus rings.
 * Slate-50 headings, slate-200 body over film, slate-300 meta. Fraunces for the h2, item names and ledes;
 * Geist Mono caps 11–12 px for meta, tags and links; Geist Sans 15–16 px for bullets and descriptions.
 * No cards, borders, glows, pills, gradient text or hover lifts over the film.
 */

/**
 * The chapter heading: Fraunces, clamp(2.5rem, 2.9vw, 3.25rem) (phones: 2.5rem, easing to 2rem below 381 px
 * wide, so "02 Certifications" fits a 320 px screen even with WCAG text spacing); the plate lands in it. Line height comes
 * with the target: CHAPTER_H2_PLATE (`leading-none`, the plate box's em metrics hold the glyphs) or
 * CHAPTER_H2_PLAIN (1.25, so Fraunces' 1.23 em glyph box stays inside the line and the text never rises
 * above its band's 96 px header clearance).
 */
export const CHAPTER_H2 =
  "font-serif text-[clamp(2rem,10.5vw,2.5rem)] font-normal text-slate-50 wide:text-[clamp(2.5rem,2.9vw,3.25rem)]";
export const CHAPTER_H2_PLATE = "leading-none";
export const CHAPTER_H2_PLAIN = "leading-[1.25]";

/**
 * `[data-plate-target]` inside the h2: the plate box's own metrics in em of the heading (RackPlate BOX
 * 1700 × 200 px laid out for a 146 px name: 11.6438 × 1.3699 em, 40 px padding = 0.274 em, 44 px gap =
 * 0.3014 em), pulled left by its padding so the number starts on the column. On every viewport, since both
 * cameras have plates; the box's empty right part may run past a phone's edge, so the h2 clips it
 * (CHAPTER_H2_CLIP).
 */
export const PLATE_TARGET =
  "inline-flex h-[1.3699em] w-[11.6438em] items-center gap-[0.3014em] whitespace-nowrap pl-[0.274em] -ml-[0.274em]";

/** Added to the h2 that holds a plate target: clip the target box's empty overflow, never the text. */
export const CHAPTER_H2_CLIP = "overflow-x-clip";

/** The h2's inner line where no plate lands (the tower): number and name on one baseline. */
export const PLAIN_TARGET = "inline-flex items-baseline gap-[0.3em] whitespace-nowrap";

/** The amber chapter number (aria-hidden), the plate's 100 px mono at 146 px: 0.6849 em. */
export const CHAPTER_NUMBER = "font-mono text-[0.6849em] leading-none tracking-[0.06em] text-lamp";

/** The heading's name, at the plate's optical size so the crossfade does not reshape the glyphs. */
export const CHAPTER_NAME = "font-serif leading-none [font-variation-settings:'opsz'_144]";

/** `● SECURITY`: Geist Mono caps; the dot is the only amber. */
export const SUPPORT_LINE =
  "mt-3 font-mono text-[11px] uppercase leading-none tracking-[0.22em] text-slate-300 wide:mt-2 wide:text-xs";
export const SUPPORT_DOT = "mr-2 text-lamp";

/** The lede under the heading (Fraunces). */
export const LEDE =
  "mt-3 max-w-[48rem] font-serif text-lg leading-snug text-pretty text-slate-200 wide:mt-2.5 wide:text-[clamp(1.05rem,1.25vw,1.3rem)]";

/** Item meta (issuer · year, dates, stack): Geist Mono caps. */
export const ITEM_META =
  "font-mono text-[11px] uppercase leading-snug tracking-[0.18em] text-slate-300 wide:text-xs";

/** Item name (h3): Fraunces. */
export const ITEM_NAME =
  "mt-2 font-serif text-lg font-normal leading-snug text-balance text-slate-50 wide:text-[clamp(1.05rem,1.3vw,1.4rem)]";

/** A text link over the film: mono caps, amber only on hover and focus; 44 px tall to tap on touch screens. */
export const FILM_LINK = [
  "inline-flex pointer-coarse:min-h-11 items-center gap-1.5 rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] text-slate-200 underline-offset-4 transition-colors wide:text-xs",
  "hover:text-lamp hover:underline focus-visible:text-lamp focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night",
].join(" ");

/**
 * A link set in the text around it (Geist Sans, underlined) rather than as one more row of mono caps: the
 * project cards' links, the email lines. Amber on hover and focus, as FILM_LINK; on touch screens it becomes
 * a 44 px tall inline box, so it is a full-size tap target.
 */
export const TEXT_LINK =
  "pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center rounded-sm text-slate-50 underline decoration-white/30 underline-offset-4 transition-colors hover:text-lamp focus-visible:text-lamp focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night";

/**
 * A wrapping list with clipped separators (Skills' items, Projects' tags): each item after the first carries
 * a "·" (SEP_DOT, aria-hidden) centred in the 24 px gap before it; the list reaches 24 px left of its column
 * and clips that strip, so the dot of an item that opens a line is cut off and no line starts with a dot.
 */
export const SEP_LIST = "-ml-6 flex flex-wrap items-baseline gap-y-1 [clip-path:inset(-4px_-4px_-4px_1.5rem)]";
export const SEP_ITEM = "relative ml-6";
export const SEP_DOT = "absolute -left-3 -translate-x-1/2 text-slate-500";

/** A mono caps label inside a composition (ProofStrip tokens, group titles' meta, the footer). */
export const MONO_LABEL = "font-mono text-[11px] uppercase leading-snug tracking-[0.18em] text-slate-200 wide:text-xs";

/** Body copy over film or a tone: Geist Sans 15–16 px, slate-200. */
export const BODY_TEXT = "text-[15px] leading-relaxed text-pretty text-slate-200 wide:text-base";

/** A group or entry title (Skills' groups, Certifications' and Projects' entries): Fraunces, slate-50. */
export const GROUP_TITLE = "font-serif text-lg font-normal leading-snug text-slate-50 wide:text-[clamp(1.1rem,1.35vw,1.45rem)]";

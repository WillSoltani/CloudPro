// Where the back-to-top button's corner meets a chapter's text, worked out from numbers measured once instead of from
// the DOM on every scroll frame (stage 8). The geometry is pure and unit-tested (cornerText.test.ts); only
// measureChapterText() touches the DOM, and it runs when the chapter's box changes size, fonts load or the film's
// viewport changes, never on a scroll.
//
// Why a model. A chapter's composition and body are one `position: sticky; top: 0` box (FilmChapter `data-compose`)
// inside the chapter's section: it travels with the page until its top reaches the viewport's top, stays there through the
// camera move and the read pin, and travels on again once the section's bottom reaches its own bottom. The text inside it
// never moves relative to that box except by (a) the box's own `translateY` (the stacked lift, written by framer-motion
// on the composition's inline style) and (b) the reveals' rise (Reveal / FlowReveal: at most REVEAL_SLACK px). So the text
// boxes are measured relative to the composition's top once, and its place on screen is stickyTop(scrollY) plus its lift.

/** A box as [left, top, right, bottom] in CSS px. */
export type TextBox = readonly [number, number, number, number];

// The button's box: fixed 24 px (bottom-6 / right-6) from the corner, 44 px square (p-3 + 20 px icon).
export const INSET = 24;
export const SIZE = 44;
// Clear space kept between the button and the text.
export const CLEAR = 8;
// A reveal moves its element by up to this many px (Reveal's `y`, FlowReveal's 10 px rise) while the text is measured:
// the zone grows by it above and below, so a line mid-rise is never missed. This is the margin chosen over re-measuring
// when a reveal settles (it makes the button step aside up to 10 px earlier at the edges of a line, never later).
export const REVEAL_SLACK = 10;

/** The safe-area insets the button keeps clear of (a phone's notch in landscape, its home indicator), in px. */
export type Insets = { right: number; bottom: number };

/**
 * The button's corner with CLEAR around it, in viewport coordinates. The button sits INSET px from the corner, or the
 * safe-area inset where that is larger (`right-[max(1.5rem,env(safe-area-inset-right))]`, ScrollToTop).
 */
export function cornerZone(vw: number, vh: number, insets: Insets = { right: 0, bottom: 0 }): TextBox {
  const right = Math.max(INSET, insets.right);
  const bottom = Math.max(INSET, insets.bottom);
  return [vw - right - SIZE - CLEAR, vh - bottom - SIZE - CLEAR, vw - right + CLEAR, vh - bottom + CLEAR];
}

/** The right and bottom safe-area insets now (0 where there are none): one probe element, read and removed. */
export function safeInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:0 env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) 0";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = { right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return insets;
}

/** What was measured of one chapter: its text boxes and the sticky geometry (document px at the time). */
export type ChapterText = {
  /** Text line boxes: x in viewport px, y relative to the composition box's top. */
  boxes: readonly TextBox[];
  /** The section's top in the document, its height, and the composition's height (its layout box, without its transform). */
  secTop: number;
  secHeight: number;
  composeHeight: number;
};

/**
 * Where the sticky composition's top sits in the viewport at `scrollY` (its `translateY` not included): its natural place
 * (the section's top), held at the viewport's top while the section lasts, and no lower than where the section's bottom
 * lets it end.
 */
export function stickyTop(m: Pick<ChapterText, "secTop" | "secHeight" | "composeHeight">, scrollY: number): number {
  const natural = m.secTop - scrollY;
  const limit = m.secTop + m.secHeight - m.composeHeight - scrollY;
  return Math.min(Math.max(natural, 0), limit);
}

/**
 * True when a line of the chapter's text is within the zone: `top` is the composition's top in the viewport now
 * (stickyTop + its lift). The vertical margin is REVEAL_SLACK; boxes of zero width never count.
 */
export function textInZone(boxes: readonly TextBox[], top: number, zone: TextBox): boolean {
  const [left, zoneTop, right, zoneBottom] = zone;
  const t = zoneTop - top - REVEAL_SLACK;
  const b = zoneBottom - top + REVEAL_SLACK;
  for (const [l, bt, r, bb] of boxes) if (r > l && r > left && l < right && bb > t && bt < b) return true;
  return false;
}

const NUM = String.raw`(-?[\d.]+(?:e-?\d+)?)`;

/**
 * The vertical translation in a CSS transform string, as framer-motion writes it on the composition's inline style
 * ("none", "translateY(-12px) translateZ(0)", a translate3d or a matrix). 0 for anything else.
 */
export function translateYOf(transform: string): number {
  const t = transform.trim();
  if (!t || t === "none") return 0;
  const y = new RegExp(String.raw`translateY\(\s*${NUM}px`).exec(t);
  if (y) return Number(y[1]);
  const xy = new RegExp(String.raw`translate(?:3d)?\(\s*[^,)]+,\s*${NUM}px`).exec(t);
  if (xy) return Number(xy[1]);
  const m = new RegExp(String.raw`matrix\(\s*(?:[^,)]+,\s*){5}${NUM}`).exec(t);
  return m ? Number(m[1]) : 0;
}

/** Measures a chapter's text (one layout pass; call it when the box, the fonts or the viewport change, not on a scroll). */
export function measureChapterText(compose: HTMLElement, section: HTMLElement): ChapterText {
  const sec = section.getBoundingClientRect();
  const top = compose.getBoundingClientRect().top;
  const boxes: TextBox[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(compose, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 0) boxes.push([r.left, r.top - top, r.right, r.bottom - top]);
  }
  return { boxes, secTop: sec.top + window.scrollY, secHeight: sec.height, composeHeight: compose.offsetHeight };
}

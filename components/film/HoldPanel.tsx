import type { CSSProperties, ReactNode } from "react";

const NIGHT = "7 11 22"; // --color-night #070b16

/**
 * The feather, as (px from the edge, share of the way from the edge's alpha to the panel's). Eased
 * and long, so a bright band of the held frame dims gradually instead of being cut along a line.
 */
const FEATHER: readonly (readonly [number, number])[] = [
  [0, 0],
  [35, 0.25],
  [70, 0.55],
  [105, 0.8],
  [140, 0.95],
  [160, 1],
];

/** One edge of the panel: alpha `from` at the edge easing to `to`, written top-down. */
function edge(from: number, to: number, side: "top" | "bottom"): string[] {
  return FEATHER.map(([px, k]) => {
    const a = +(from + (to - from) * k).toFixed(4);
    return `rgb(${NIGHT} / ${a}) ${side === "top" ? `${px}px` : `calc(100% - ${px}px)`}`;
  });
}

function gradient(topFrom: number, alpha: number, closing: boolean): string {
  const top = edge(topFrom, alpha, "top");
  const bottom = closing ? [`rgb(${NIGHT} / ${alpha}) 100%`] : edge(0, alpha, "bottom").reverse();
  return `linear-gradient(to bottom, ${[...top, ...bottom].join(", ")})`;
}

/**
 * A run of HTML sections on the held film frame: flat night at 85 % (88 % for the closing panel with
 * the footer) over the backdrop canvas, which keeps painting the previous segment's last frame here.
 *
 * Edges feather over 160 px with px stops (never % gradients, which would thin the panel under text on
 * tall runs), so the film reads through where a segment's stage meets the panel:
 * - top: from the stage's own bottom edge — clear on `wide` desktops, solid night below that, where
 *   every stage ends on the phone caption scrim (FilmScrims) — down to the panel tone;
 * - bottom: panel tone → clear, into the next segment's unscrimmed top edge. The closing panel runs flat
 *   to the end of the page.
 * Padding keeps the text on the flat tone: the sections bring 48–64 px of their own, the panel adds the
 * rest of the feather where it starts clear (top on `wide`, every bottom but the closing one's).
 */
export function HoldPanel({
  children,
  closing = false,
}: {
  children: ReactNode;
  /** The last panel (Contact + footer): 88 %, and no bottom feather since nothing follows it. */
  closing?: boolean;
}) {
  const alpha = closing ? 0.88 : 0.85;
  const style = {
    "--hold-narrow": gradient(1, alpha, closing),
    "--hold-wide": gradient(0, alpha, closing),
  } as CSSProperties;
  return (
    <div
      data-hold-panel={closing ? "closing" : ""}
      className={[
        "[background-image:var(--hold-narrow)] wide:[background-image:var(--hold-wide)] wide:pt-24",
        closing ? "" : "pb-24",
      ].join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

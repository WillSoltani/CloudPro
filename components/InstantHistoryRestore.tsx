"use client";

import { useEffect } from "react";

/**
 * Back and Forward restore the scroll position instantly on the portfolio. html's `scroll-behavior:
 * smooth` (app/globals.css) would otherwise animate the browser's own restoration, so Back to the homepage
 * flew through the whole film from the hero to Projects. Off for the two frames of a history traversal,
 * then smooth again. Mounted by the root layout on the portfolio host only.
 */
export function InstantHistoryRestore() {
  useEffect(() => {
    const instant = () => {
      const html = document.documentElement;
      html.style.scrollBehavior = "auto";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          html.style.scrollBehavior = "";
        }),
      );
    };
    window.addEventListener("popstate", instant, { capture: true });
    return () => window.removeEventListener("popstate", instant, { capture: true });
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { fragmentClick } from "@/components/film/navJump";

/**
 * Back and Forward restore the scroll position instantly on the portfolio. html's `scroll-behavior:
 * smooth` (app/globals.css) would otherwise animate the browser's own restoration, so Back to the homepage
 * flew through the whole film from the hero to Projects. Off for the two frames of a history traversal,
 * then smooth again. The `popstate` that Chromium fires for a click on an in-page link is not a traversal: it is left alone
 * (components/AnchorJumps.tsx notes the click), so a click to the next chapter scrolls smoothly. Mounted by the root layout on
 * the portfolio host only.
 */
export function InstantHistoryRestore() {
  useEffect(() => {
    const instant = () => {
      if (fragmentClick.consume(performance.now())) return;
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

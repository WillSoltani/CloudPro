"use client";

import { useEffect } from "react";
import { currentChapter, isNavTarget, navScroll, navSmoothRequested } from "@/components/film/navJump";

// How long `scroll-behavior: auto` is held on <html> after a jumping click: the browser's fragment scroll runs at the end of
// the click, and Next's own hash scroll for the brand link a little later.
const HOLD_MS = 500;

/**
 * The page's in-page anchor clicks (the nav's pills and menu, the brand link, the hero's call to action, the skip link):
 * where the target chapter is more than one chapter away from the current one (components/film/navJump.ts) the click
 * scrolls instantly instead of through every film in between; one chapter away it keeps app/globals.css's smooth scroll.
 * `?nav=smooth` keeps it smooth everywhere for the page load. It only sets `scroll-behavior` on <html> for a moment: the
 * browser still does the navigation (the hash, the history entry, the focus move), so nothing else about a click changes.
 * Renders nothing.
 */
export function AnchorJumps() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      if (!isNavTarget(id)) return;
      const projects = document.getElementById("projects");
      const from = currentChapter(root.dataset.reelSection ?? "", !!projects && projects.getBoundingClientRect().top < 0);
      const to = currentChapter(id, false);
      if (navScroll(from, to, navSmoothRequested(window.location.search)) !== "instant") return;
      root.style.scrollBehavior = "auto";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.style.removeProperty("scroll-behavior"), HOLD_MS);
    };
    // Capture: before the framework's own link handlers run.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
      root.style.removeProperty("scroll-behavior");
    };
  }, []);
  return null;
}

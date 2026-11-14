"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useReelChrome } from "@/components/film/useReelChrome";
import { coarsePointerStore } from "@/components/film/filmCore";
import { subscribeScroll } from "@/components/film/scrollHub";
import { subscribeFilmViewport } from "@/components/film/viewport";
import { createFirstReportSkip, createTextCache } from "@/components/film/textCache";
import {
  cornerZone,
  measureChapterText,
  safeInsets,
  stickyTop,
  textInZone,
  translateYOf,
  type ChapterText,
  type Insets,
} from "@/components/film/cornerText";

// After the corner has been clear of text this long, the button comes back (no flicker as lines pass it).
const TEXT_CLEAR_MS = 300;
// The veiled jump back to the top: night in, the jump, the hero's first frame, night out.
const VEIL_IN_S = 0.16;
const VEIL_OUT_S = 0.32;
// The longest the veil waits for the film to report the hero's first frame (rack-00(-p) f0) before it lifts.
const VEIL_WAIT_MS = 800;

export function ScrollToTop() {
  const [past, setPast] = useState(false);
  const [overFooter, setOverFooter] = useState(false);
  const [overText, setOverText] = useState(false);
  // The section whose corner has been checked for text at least once: the button never shows before that.
  const [checked, setChecked] = useState<string | null>(null);
  const [veil, setVeil] = useState(false);
  // Focus never drops to <body>: after a jump it goes to the hero's h1; when the button hides while it has
  // focus, to the heading of the chapter on screen (the last one, over the wordless passages).
  const buttonFocused = useRef(false);
  const lastSection = useRef("");
  const { chrome, section } = useReelChrome();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (section) lastSection.current = section;
  }, [section]);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 500);
    onScroll();
    return subscribeScroll(onScroll);
  }, []);

  // The page ends inside Contact's read pin with the footer line pinned in the bottom band: where the button
  // would cover that text (phones, where the centred line runs under the corner) it steps aside.
  const atPageEnd = chrome === "composed" && section === "contact";
  useEffect(() => {
    if (!atPageEnd) return;
    const check = () => {
      const text = document.querySelector("[data-page-footer]")?.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const [left, top, right, bottom] = cornerZone(vw, vh, safeInsets());
      setOverFooter(!!text && text.right > left && text.left < right && text.bottom > top && text.top < bottom);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [atPageEnd]);

  // On touch screens the compositions run to within 20 px of the edges, so the corner can land on a line of
  // a chapter's text (its composition or its body): there the button steps aside, and comes back once the
  // corner has been clear for TEXT_CLEAR_MS.
  //
  // Stage 8: every chapter's text is measured once (cornerText.ts measureChapterText: one layout pass, the lines' boxes
  // relative to the chapter's sticky composition): the current chapter's at once, the others one per idle slice
  // (textCache.ts), and all again when a composition's box changes size, fonts load or the film's viewport changes. A
  // scroll compares the corner with those numbers and the scroll offset only (no layout read, no text walk, no timer).
  // What moves the text afterwards is the composition's own lift, which framer-motion writes on its inline style as the
  // clock settles (a MutationObserver on that one attribute re-checks, reading the style string, not the layout), and the
  // reveals' rise of at most REVEAL_SLACK px, covered by a margin (not a re-measure when a reveal settles).
  const watcher = useRef<((section: string) => void) | null>(null);
  useEffect(() => {
    if (!coarsePointerStore.get()) return;
    const chapters = new Map<string, { compose: HTMLElement; section: HTMLElement }>();
    for (const root of document.querySelectorAll<HTMLElement>("[data-chapter]")) {
      const compose = root.querySelector<HTMLElement>("[data-compose]");
      const sectionEl = compose?.closest("section");
      if (root.dataset.chapter && compose && sectionEl) chapters.set(root.dataset.chapter, { compose, section: sectionEl });
    }
    let insets: Insets = { right: 0, bottom: 0 };
    let current = "";
    let raf = 0;
    let clearTimer = 0;
    let alive = true;
    const cache = createTextCache<ChapterText>({
      ids: [...chapters.keys()],
      measure: (id) => {
        const c = chapters.get(id)!;
        return measureChapterText(c.compose, c.section);
      },
      schedule: (fn) =>
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(fn, { timeout: 1500 })
          : window.setTimeout(fn, 300),
      cancel: (h) =>
        typeof window.cancelIdleCallback === "function" ? window.cancelIdleCallback(h) : window.clearTimeout(h),
    });
    const check = () => {
      raf = 0;
      const c = chapters.get(current);
      const measured = cache.peek(current);
      if (!c || !measured) return;
      setChecked(current);
      const top = stickyTop(measured, window.scrollY) + translateYOf(c.compose.style.transform);
      const zone = cornerZone(document.documentElement.clientWidth, window.innerHeight, insets);
      if (textInZone(measured.boxes, top, zone)) {
        window.clearTimeout(clearTimer);
        clearTimer = 0;
        setOverText(true);
      } else if (!clearTimer) {
        clearTimer = window.setTimeout(() => {
          clearTimer = 0;
          setOverText(false);
        }, TEXT_CLEAR_MS);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    // Everything measured is stale: the current chapter is measured now, the rest when idle.
    const remeasure = () => {
      if (!alive) return;
      insets = safeInsets();
      cache.invalidate(current);
      check();
    };
    // The chapter on screen changes: the button's text check follows it.
    let mo: MutationObserver | null = null;
    watcher.current = (id) => {
      current = id;
      mo?.disconnect();
      mo = null;
      const c = chapters.get(id);
      if (!c) return;
      cache.ensure(id);
      mo = new MutationObserver(schedule);
      mo.observe(c.compose, { attributes: true, attributeFilter: ["style"] });
      check();
    };
    insets = safeInsets();
    cache.start();
    const offScroll = subscribeScroll(schedule);
    // `resize` alone is a phone's toolbar moving: the corner moves with the dynamic viewport, the text does not.
    window.addEventListener("resize", schedule, { passive: true });
    const offViewport = subscribeFilmViewport(remeasure);
    // The observer reports each element once on observing; only a later report is a resize.
    const resized = createFirstReportSkip();
    const ro = new ResizeObserver((entries) => {
      if (resized(entries.map((e) => e.target))) remeasure();
    });
    for (const c of chapters.values()) {
      ro.observe(c.compose);
      ro.observe(c.section);
    }
    void document.fonts?.ready.then(remeasure);
    document.fonts?.addEventListener("loadingdone", remeasure);
    return () => {
      alive = false;
      watcher.current = null;
      cancelAnimationFrame(raf);
      window.clearTimeout(clearTimer);
      cache.stop();
      offScroll();
      window.removeEventListener("resize", schedule);
      offViewport();
      ro.disconnect();
      mo?.disconnect();
      document.fonts?.removeEventListener("loadingdone", remeasure);
    };
  }, []);
  useEffect(() => {
    // Under a moving film (and over the hero's and the epilogue's passages) there is no chapter to check.
    if (chrome === "film" || !section) return;
    if (watcher.current) watcher.current(section);
    else setChecked(section);
  }, [chrome, section]);

  // Stay out of the film: hidden while a camera move plays (the hero throughout, every chapter move and the
  // exit); back over a chapter's composition, releases and bodies; never over the footer line, nor (touch
  // screens) over any line of the chapter's text, which is checked before the button first shows.
  const show =
    past && chrome !== "film" && checked === section && !(atPageEnd && overFooter) && !overText && !veil;

  useEffect(() => {
    if (show || veil || !buttonFocused.current) return;
    buttonFocused.current = false;
    const id = section || lastSection.current;
    const heading = id ? document.getElementById(`${id}-title`) : null;
    (heading ?? document.getElementById("hero-title"))?.focus({ preventScroll: true });
  }, [show, veil, section]);

  const focusHero = () => document.getElementById("hero-title")?.focus({ preventScroll: true });

  // Within the first viewport: the browser's smooth scroll. Further down, a smooth scroll would rewind the
  // whole film (every chapter's text over every other's), so the page veils in night, jumps, waits for the
  // hero's first frame and lifts the veil. Reduced motion: the jump alone.
  const goTop = () => {
    // The jump hands focus to the hero's h1 itself (the button unmounts without a blur event).
    buttonFocused.current = false;
    if (window.scrollY < window.innerHeight) {
      window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
      focusHero();
    } else if (reduced) {
      window.scrollTo({ top: 0, behavior: "instant" });
      focusHero();
    } else {
      setVeil(true);
    }
  };
  const jumpUnderVeil = () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-frame]");
    const t0 = performance.now();
    let frames = 0;
    const wait = () => {
      frames++;
      // rack-00 on the landscape camera, rack-00-p on the portrait one.
      const atStart = !canvas || (!!canvas.dataset.segment?.startsWith("rack-00") && canvas.dataset.frame === "0");
      if ((frames >= 2 && atStart) || performance.now() - t0 > VEIL_WAIT_MS) {
        setVeil(false);
        focusHero();
      } else requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  };

  return (
    <>
      <AnimatePresence>
        {veil ? (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-40 bg-night"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: VEIL_IN_S, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: VEIL_OUT_S, ease: "easeOut" } }}
            onAnimationComplete={(def) => {
              if ((def as { opacity?: number }).opacity === 1) jumpUnderVeil();
            }}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {show ? (
          <motion.button
            type="button"
            onClick={goTop}
            onFocus={() => (buttonFocused.current = true)}
            onBlur={() => (buttonFocused.current = false)}
            aria-label="Scroll to top"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            // Out quickly: it steps aside the moment text arrives under it.
            exit={{ opacity: 0, y: 16, scale: 0.9, transition: { duration: 0.12, ease: "easeOut" } }}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-50 inline-flex items-center justify-center rounded-full bg-white/10 p-3 text-slate-100 backdrop-blur hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}

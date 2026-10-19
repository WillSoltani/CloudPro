"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useReelChrome } from "@/components/film/useReelChrome";

// The button's box: fixed 24 px (bottom-6 / right-6) from the corner, 44 px square (p-3 + 20 px icon).
const INSET = 24;
const SIZE = 44;
// Clear space kept between the button and the footer text.
const CLEAR = 8;
// After the corner has been clear of text this long, the button comes back (no flicker as lines pass it).
const TEXT_CLEAR_MS = 300;
// How often the corner is re-checked while a chapter is on screen (its read pin's lift and reveals run on
// the clock's spring, after the scroll has stopped).
const TEXT_POLL_MS = 100;
// The veiled jump back to the top: night in, the jump, the hero's first frame, night out.
const VEIL_IN_S = 0.16;
const VEIL_OUT_S = 0.32;
// The longest the veil waits for the film to report the hero's first frame (rack-00(-p) f0) before it lifts.
const VEIL_WAIT_MS = 800;

/**
 * True when a line of text inside `root` comes within CLEAR px of the button's corner box: shown, or still
 * to be revealed there (so the button never fades in where copy is about to arrive).
 */
function textUnderButton(root: Element): boolean {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const left = vw - INSET - SIZE - CLEAR;
  const top = vh - INSET - SIZE - CLEAR;
  const right = vw - INSET + CLEAR;
  const bottom = vh - INSET + CLEAR;
  const hits = (r: DOMRect) => r.width > 0 && r.right > left && r.left < right && r.bottom > top && r.top < bottom;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim() || !hits(el.getBoundingClientRect())) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (hits(r)) return true;
  }
  return false;
}

export function ScrollToTop() {
  const [past, setPast] = useState(false);
  const [overFooter, setOverFooter] = useState(false);
  const [overText, setOverText] = useState(false);
  // The section whose corner has been checked for text at least once: the button never shows before that.
  const [checked, setChecked] = useState<string | null>(null);
  const [veil, setVeil] = useState(false);
  const { chrome, section } = useReelChrome();
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      const left = vw - INSET - SIZE - CLEAR;
      const top = vh - INSET - SIZE - CLEAR;
      const right = vw - INSET + CLEAR;
      const bottom = vh - INSET + CLEAR;
      setOverFooter(!!text && text.right > left && text.left < right && text.bottom > top && text.top < bottom);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [atPageEnd]);

  // On touch screens the compositions run to within 20 px of the edges, so the corner can land on a line of
  // a chapter's text (its composition or its body): there the button steps aside, and comes back once the
  // corner has been clear for TEXT_CLEAR_MS. Checked on scroll, and every TEXT_POLL_MS while the chapter is
  // on screen (the read pin's items fade in on the clock's spring, after the scroll has stopped).
  useEffect(() => {
    if (chrome === "film" || !section) return;
    const root = document.querySelector(`[data-chapter="${section}"]`);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (!root || !touch) {
      setChecked(section);
      return;
    }
    let raf = 0;
    let clearTimer = 0;
    const check = () => {
      raf = 0;
      setChecked(section);
      if (textUnderButton(root)) {
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
    check();
    const poll = window.setInterval(schedule, TEXT_POLL_MS);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clearTimer);
      window.clearInterval(poll);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [chrome, section]);

  // Stay out of the film: hidden while a camera move plays (the hero throughout, every chapter move and the
  // exit); back over a chapter's composition, releases and bodies; never over the footer line, nor (touch
  // screens) over any line of the chapter's text, which is checked before the button first shows.
  const show =
    past && chrome !== "film" && checked === section && !(atPageEnd && overFooter) && !overText && !veil;

  // Within the first viewport: the browser's smooth scroll. Further down, a smooth scroll would rewind the
  // whole film (every chapter's text over every other's), so the page veils in night, jumps, waits for the
  // hero's first frame and lifts the veil. Reduced motion: the jump alone.
  const goTop = () => {
    if (window.scrollY < window.innerHeight) {
      window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
    } else if (reduced) {
      window.scrollTo({ top: 0, behavior: "instant" });
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
      if ((frames >= 2 && atStart) || performance.now() - t0 > VEIL_WAIT_MS) setVeil(false);
      else requestAnimationFrame(wait);
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
            aria-label="Scroll to top"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            // Out quickly: it steps aside the moment text arrives under it.
            exit={{ opacity: 0, y: 16, scale: 0.9, transition: { duration: 0.12, ease: "easeOut" } }}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full bg-white/10 p-3 text-slate-100 backdrop-blur hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}

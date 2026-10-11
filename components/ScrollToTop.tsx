"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useFilmInView } from "@/components/film/useFilmInView";

export function ScrollToTop() {
  const [past, setPast] = useState(false);
  const film = useFilmInView();
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Stay out of the film: hidden while the hero is on screen and while any chapter divider plays.
  const show = past && !film.inView && !film.overFilm;

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          type="button"
          onClick={goTop}
          aria-label="Scroll to top"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          whileHover={{ y: -2, scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 p-3 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-night"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

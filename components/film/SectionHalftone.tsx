"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { DitherVeil } from "@/components/film/DitherVeil";
import { useReducedMotionSafe } from "@/components/film/ScrollFilm";
import { useVeilSlot } from "@/components/film/useVeilSlot";

const LAMP = "#f0a63c";
const NIGHT = "#070b16";

/** K4's lower-third cloud, darkened so the amber halftone covers ≈4 % of a header strip (see the plate note in the report). */
export const CLOUD_PLATE = "/images/beacon-cloud.webp";

type Props = {
  children: ReactNode;
  /** Same-origin plate drawn as a 1-bit halftone in lamp amber behind the section heading. */
  image?: string;
  /** Halftone density 0–1. Held at 1 (a still texture) unless the caller animates it. */
  progress?: MotionValue<number>;
  /** Scroll-linked dither reveal as the section enters and leaves; off under reduced motion. */
  wipe?: boolean;
  className?: string;
};

/**
 * Zero-credit texture for an HTML section: the film's cloud continues as amber halftone behind the
 * heading, and the section dissolves in through a dither as it enters. WebGL is mounted only while
 * the header is near the viewport (observer, 50 % margin) and, for the halftone, only while the
 * section holds one of two slots (useVeilSlot), so no more than two halftone contexts are alive.
 */
export function SectionHalftone({
  children,
  image = CLOUD_PLATE,
  progress,
  wipe = true,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // The header box as state (callback ref): the observer and the slot registry both key off it.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const still = useMotionValue(1);
  const density = progress ?? still;
  const reduced = useReducedMotionSafe();

  // Cover 1 → 0 while the section's top travels from the viewport bottom to 40 % of its height;
  // the veil is flipped so the heading (top rows) clears first.
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start end", "start 40%"] });
  const cover = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const [near, setNear] = useState(false);
  const [entering, setEntering] = useState(true);
  useMotionValueEvent(scrollYProgress, "change", (v) => setEntering(v < 1));

  useEffect(() => {
    if (!box) return;
    const io = new IntersectionObserver(
      (entries) => {
        setNear(entries[entries.length - 1].isIntersecting);
        setEntering(scrollYProgress.get() < 1);
      },
      { rootMargin: "50% 0px" },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [box, scrollYProgress]);

  const slot = useVeilSlot(box, near);
  const showWipe = wipe && !reduced && near && entering;

  return (
    <div ref={wrapRef} className={["relative isolate", className].filter(Boolean).join(" ")}>
      {/* Header texture, full-bleed behind the heading; masked top, bottom and sides into the base. */}
      <div
        ref={setBox}
        aria-hidden
        // Box ≈ the heading block (padding + h2 + subtitle); the mask's core sits on the heading and is
        // gone before the first card row, so the grain never shows through the cards' backdrop blur.
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-52 opacity-70 sm:h-64 [mask-image:linear-gradient(to_bottom,transparent,#000_25%,#000_55%,transparent_78%)]"
      >
        <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          {/* Fades in on mount; unmounts at once so the slot cap is strict (the handoff happens at the
              viewport's edges, inside the mask's feathered bands, so no exit fade is needed). */}
          {slot ? (
            <motion.div
              data-halftone=""
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <DitherVeil progress={density} image={image} color={LAMP} cell={3} />
            </motion.div>
          ) : null}
        </div>
      </div>

      {children}

      {showWipe ? (
        <DitherVeil
          progress={cover}
          color={NIGHT}
          cell={3}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full -scale-y-100"
        />
      ) : null}
    </div>
  );
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/** Written by scripts/films/build-film.sh to public/films/<name>/manifest.json. */
export type FilmManifest = {
  name: string;
  count: number;
  fps: number;
  widths: number[];
  aspect: number;
  pad: number;
  ext: string;
  base: string;
  poster: string;
  kb?: Record<string, number>;
};

type ScrollFilmProps = {
  /** Pass a stable object (e.g. the manifest JSON import) — a new object restarts loading. */
  film: FilmManifest;
  /** Optional 9:16 chain, used when the viewport is taller than it is wide. */
  portraitFilm?: FilmManifest;
  /** Scroll distance in viewport heights. Defaults to ~100 frames per viewport (min 3). */
  length?: number;
  /** Crop / letterbox focal point, 0–1 per axis. */
  focus?: [number, number];
  /** "auto" letterboxes on portrait viewports when there is no portraitFilm. */
  fit?: "cover" | "contain" | "auto";
  /** Spring-smooth the scrub. */
  smooth?: boolean;
  /** Under prefers-reduced-motion, step through this many stills instead of scrubbing. */
  reducedSteps?: number;
  className?: string;
  /** Overlays rendered inside the sticky stage; read progress with useFilmProgress(). */
  children?: ReactNode;
  /** Landmark attributes passed through to the <section>. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

// Coarse-to-fine load order: every 16th frame first, so the film scrubs long before it has fully loaded.
const STRIDES = [16, 8, 4, 2, 1];
const PORTRAIT_QUERY = "(max-aspect-ratio: 9/10)";

function subscribePortrait(onChange: () => void) {
  const query = window.matchMedia(PORTRAIT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isPortrait = () => window.matchMedia(PORTRAIT_QUERY).matches;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_QUERY).matches;

const FilmProgressContext = createContext<MotionValue<number> | null>(null);

/** Smoothed 0→1 scroll progress of the enclosing <ScrollFilm>. */
export function useFilmProgress(): MotionValue<number> {
  const progress = useContext(FilmProgressContext);
  if (!progress) throw new Error("useFilmProgress must be used inside <ScrollFilm>");
  return progress;
}

export function frameUrl(film: FilmManifest, width: number, index: number): string {
  return `${film.base}/${width}/f_${String(index + 1).padStart(film.pad, "0")}.${film.ext}`;
}

export function ScrollFilm({
  film,
  portraitFilm,
  length,
  focus = [0.5, 0.5],
  fit = "cover",
  smooth = true,
  reducedSteps = 5,
  className,
  children,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: ScrollFilmProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, () => false);
  const active = portraitFilm && portrait ? portraitFilm : film;
  const contain = fit === "contain" || (fit === "auto" && portrait && !portraitFilm);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;
  const [fx, fy] = focus;
  const steps = Math.max(2, reducedSteps);

  const scrolled = useMotionValue(0);
  // Critically damped: smooths wheel steps without a slow tail.
  const spring = useSpring(scrolled, { stiffness: 140, damping: 24, mass: 1, restDelta: 0.0005 });
  const progress = smooth && !reduced ? spring : scrolled;

  // 0 when the section's top meets the viewport top, 1 when its bottom meets the viewport bottom.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let first = true;
    const update = () => {
      const { top, height } = section.getBoundingClientRect();
      const range = height - document.documentElement.clientHeight;
      const value = range > 0 ? Math.min(1, Math.max(0, -top / range)) : 0;
      scrolled.set(value);
      if (first) {
        spring.jump(value); // don't scrub through the film when the page loads mid-scroll
        first = false;
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scrolled, spring]);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !stage || !canvas || !ctx) return;

    const count = active.count;
    const frames: (HTMLImageElement | undefined)[] = new Array(count);
    const inflight = new Set<HTMLImageElement>();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let cancelled = false;
    let shown = false;
    let raf = 0;
    let target = 0;
    let drawn = -1;
    let loaded = 0;

    const toIndex = (p: number) => {
      const q = reduced ? Math.round(p * (steps - 1)) / (steps - 1) : p;
      return Math.min(count - 1, Math.max(0, Math.round(q * (count - 1))));
    };

    // Frame width: enough for the stage at (capped) device resolution; phones top out at 1280.
    const sorted = [...active.widths].sort((a, b) => a - b);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const ceiling = saveData ? sorted[0] : coarse ? 1280 : Infinity;
    const pool = sorted.filter((w) => w <= ceiling);
    if (!pool.length) pool.push(sorted[0]);
    const span = contain
      ? Math.min(stage.clientWidth, stage.clientHeight * active.aspect)
      : Math.max(stage.clientWidth, stage.clientHeight * active.aspect);
    const need = span * Math.min(dpr, 1.5) * 0.75;
    const width = pool.find((w) => w >= need) ?? pool[pool.length - 1];
    section.dataset.width = String(width);

    const nearestLoaded = (i: number) => {
      for (let d = 0; d < count; d++) {
        if (frames[i - d]) return i - d;
        if (frames[i + d]) return i + d;
      }
      return -1;
    };

    const draw = () => {
      raf = 0;
      const i = nearestLoaded(target);
      if (i < 0 || i === drawn) return;
      const img = frames[i]!;
      const fitScale = contain ? Math.min : Math.max;
      const s = fitScale(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      if (contain) ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (canvas.width - w) * fx, (canvas.height - h) * fy, w, h);
      drawn = i;
      canvas.dataset.frame = String(i);
      if (!shown) {
        shown = true;
        setReadyFor(active.name);
      }
    };

    const schedule = () => {
      if (!raf && !cancelled) raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      canvas.width = Math.max(1, Math.round(stage.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(stage.clientHeight * dpr));
      drawn = -1;
      schedule();
    };

    const order: number[] = [];
    const queued = new Uint8Array(count);
    const enqueue = (i: number) => {
      if (!queued[i]) {
        queued[i] = 1;
        order.push(i);
      }
    };
    if (reduced) {
      for (let k = 0; k < steps; k++) enqueue(toIndex(k / (steps - 1)));
    } else {
      enqueue(0);
      enqueue(count - 1);
      for (const stride of STRIDES) for (let i = 0; i < count; i += stride) enqueue(i);
    }

    let cursor = 0;
    const pump = () => {
      while (!cancelled && inflight.size < (saveData ? 3 : 6) && cursor < order.length) {
        const i = order[cursor++];
        const img = new Image();
        img.decoding = "async";
        img.src = frameUrl(active, width, i);
        inflight.add(img);
        img
          .decode()
          .then(() => {
            if (cancelled) return;
            frames[i] = img;
            stage.dataset.loaded = String(++loaded);
            schedule();
          })
          .catch(() => {}) // a missing frame is covered by its neighbours
          .finally(() => {
            inflight.delete(img);
            pump();
          });
      }
    };

    // Start fetching once the film is within ~1.5 viewports.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          pump();
        }
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(section);

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    target = toIndex(progress.get());
    const unsubscribe = progress.on("change", (p) => {
      target = toIndex(p);
      schedule();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      for (const img of inflight) img.src = "";
    };
  }, [active, contain, fx, fy, reduced, steps, progress]);

  const ready = readyFor === active.name;
  const scrollLength = length ?? Math.max(3, Math.round(active.count / 100));

  return (
    <FilmProgressContext.Provider value={progress}>
      <section
        ref={sectionRef}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        data-film={active.name}
        data-count={active.count}
        className={className ? `relative ${className}` : "relative"}
        style={{ height: `${scrollLength * 100}svh` }}
      >
        <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden">
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
          {/* Poster: the LCP element, and the fallback until the first frame is drawn. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.poster}
            alt=""
            aria-hidden
            fetchPriority="high"
            className={[
              "absolute inset-0 h-full w-full transition-opacity duration-300",
              contain ? "object-contain" : "object-cover",
              ready ? "opacity-0" : "opacity-100",
            ].join(" ")}
            style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }}
          />
          <div className="relative h-full w-full">{children}</div>
        </div>
      </section>
    </FilmProgressContext.Provider>
  );
}

/**
 * HTML caption that fades and drifts across [from, to] of the film's progress. While faded out it
 * is also `visibility: hidden` (unfocusable, out of the accessibility tree) unless `persistent`.
 */
export function FilmCaption({
  from,
  to,
  persistent = false,
  className,
  children,
}: {
  from: number;
  to: number;
  /** Keep the block in the accessibility tree when faded out (e.g. the page's h1). */
  persistent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const progress = useFilmProgress();
  // Same query as useReducedMotion(), but with a server snapshot so hydration matches the SSR
  // markup; React re-renders with the viewer's preference right after.
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const fade = Math.min(0.05, (to - from) / 4);
  const opacity = useTransform(
    progress,
    [from, from + fade, to - fade, to],
    [from <= 0 ? 1 : 0, 1, 1, to >= 1 ? 1 : 0],
  );
  const drift = reduced ? 0 : 24;
  const y = useTransform(progress, [from, to], [from <= 0 ? 0 : drift, to >= 1 ? 0 : -drift]);
  const visibility = useTransform(opacity, (o) =>
    persistent || o > 0.001 ? "visible" : "hidden",
  );
  return (
    <motion.div style={{ opacity, y, visibility }} className={className}>
      {children}
    </motion.div>
  );
}

// One shared viewport subscription for the film (client only; the comparison is pure and unit-tested).
//
// A phone's toolbar moving changes the dynamic viewport (window.innerHeight, dvh) and fires `resize`, but nothing the
// film is laid out with: the fixed film layers are as tall as the large viewport and the stage is the small one
// (components/film/placement.ts). So the film's resize work listens here instead of to `resize`, and runs only when
// the layout viewport's width, the large viewport's height or the stage's height actually changes (a rotation, a
// window resize, a zoom), not when only the dynamic height does.
//
// The heights come from the two probes FilmBackdrop renders (`[data-film-probe="layer"]`, LAYER_HEIGHT_CLASS, and
// `[data-film-probe="stage"]`, STAGE_HEIGHT_CLASS); without them, innerHeight and the root's clientHeight stand in.
// They are read on `resize` and when a ResizeObserver sees a probe change (which is also how a test that sets
// `--film-lvh` / `--film-svh` on :root reaches the film).

/** The film's viewport in CSS px: the layout viewport's width, the large viewport's height, the stage's (svh). */
export type FilmViewport = { width: number; lvh: number; svh: number };

/** True when the film must re-lay out: any of the three changed (or there was no previous reading). */
export function viewportChanged(prev: FilmViewport | null, next: FilmViewport): boolean {
  return !prev || prev.width !== next.width || prev.lvh !== next.lvh || prev.svh !== next.svh;
}

type Listener = (v: FilmViewport) => void;

const listeners = new Set<Listener>();
let current: FilmViewport | null = null;
let ro: ResizeObserver | null = null;
const observed: Element[] = [];

const probe = (name: "layer" | "stage") => document.querySelector<HTMLElement>(`[data-film-probe="${name}"]`);

/** Reads the viewport now (one layout read). */
function read(): FilmViewport {
  const root = document.documentElement;
  const layer = probe("layer");
  const stage = probe("stage");
  return {
    width: root.clientWidth,
    lvh: layer?.offsetHeight || window.innerHeight,
    svh: stage?.offsetHeight || root.clientHeight,
  };
}

// Observe the probes present now (a remount replaces them; the next check picks the new ones up).
function observeProbes() {
  if (!ro) return;
  const want = [probe("layer"), probe("stage")].filter((el): el is HTMLElement => !!el);
  if (want.length === observed.length && want.every((el, i) => el === observed[i])) return;
  ro.disconnect();
  observed.length = 0;
  for (const el of want) {
    ro.observe(el);
    observed.push(el);
  }
}

function check() {
  observeProbes();
  const next = read();
  if (!viewportChanged(current, next)) return;
  current = next;
  for (const listener of [...listeners]) listener(next);
}

/**
 * The film's viewport: the last reading while anything is subscribed (no layout read), else a fresh one. Client only.
 */
export function filmViewport(): FilmViewport {
  if (current && listeners.size) return current;
  return read();
}

/**
 * Calls `listener` whenever the film's viewport changes (see the module comment), never for a toolbar move alone.
 * It is not called on subscribing; read filmViewport() for the current value. Returns the unsubscribe.
 */
export function subscribeFilmViewport(listener: Listener): () => void {
  if (!listeners.size) {
    current = read();
    window.addEventListener("resize", check, { passive: true });
    if (typeof ResizeObserver !== "undefined") ro = new ResizeObserver(check);
    observeProbes();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener("resize", check);
    ro?.disconnect();
    ro = null;
    observed.length = 0;
    current = null;
  };
}

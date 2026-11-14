// One application per animation frame for the overlays the film's clock drives (PerspectivePlate, RideAnchor), in the
// frame the canvas paints the picture they belong to. Pure: the frame loop and the microtask queue are injected
// (overlayFrame.ts binds framer-motion's), so node runs the tests on a fake loop (overlayScheduler.test.ts).
//
// Why two ways in. The canvas paints in FilmBackdrop's draw(), which runs
//   - in the frame loop's update step, from the smoothed clock's tick (onReel): the usual case while scrolling;
//   - outside the loop: in the backdrop's own animation frame callback (a frame that arrived), in a scroll event (a
//     jump), in a timer (the follower's quiet step), in a resize.
// A job invalidated inside the loop runs in the loop's pre-render step of the same tick (after the clock, the painted
// frame and every chapter's frame have been set in update, before framer-motion writes the styles in render, so its
// layout reads find the layout clean). A job invalidated anywhere runs at the latest in a microtask when the current
// task ends, which is before the browser renders: whichever comes first runs it, the other finds nothing to do. So
// the four triggers of a plate (the painted segment, the painted frame, the chapter's clock, the scroll) run its work
// once, and never a frame after the picture.
//
// A scroll alone (the h2 a plate flies to moves with the page once the composition is released) is `defer`red to the
// coming frame's pre-render step: a scroll event comes before the frame's animation callbacks, and the clock's tick
// that usually follows it in the same frame then runs the job once with both.
//
// Reads before writes: every job's `read` runs before any job's `write` in a flush.

/** An overlay's work: `read` takes the layout it needs (optional), `write` sets the styles. */
export type OverlayJob = {
  /** The counter key (`plate:<index>`, `ride:<anchor>`). */
  readonly name: string;
  read?: () => void;
  write: () => void;
};

export type OverlayHost = {
  /** True while the frame loop processes a frame (framer-motion `frameData.isProcessing`). */
  inFrame(): boolean;
  /**
   * Runs `fn` in the frame loop's pre-render step: this tick's when called before that step (in the update step, or
   * from a scroll event before the frame's callbacks), else the next tick's. Wakes the loop if it sleeps.
   */
  beforeRender(fn: () => void): void;
  /** Runs `fn` when the current task has ended, before the browser renders (queueMicrotask). */
  afterTask(fn: () => void): void;
};

/** Measurement only (`window.__filmOverlay`, read by e2e/film-layers.spec.ts): flushes, and runs per job name. */
export type OverlayCounters = { flushes: number; runs: Record<string, number> };

export type OverlayScheduler = {
  /** The job's inputs changed with the picture (the painted frame, the clock): it runs before this frame renders. */
  invalidate(job: OverlayJob): void;
  /** The job's inputs changed without the picture (a scroll): it runs in the coming frame, with its clock tick. */
  defer(job: OverlayJob): void;
  /** Drops a pending run (an unmount). */
  cancel(job: OverlayJob): void;
};

export function createOverlayScheduler(host: OverlayHost, counters: () => OverlayCounters | undefined = () => undefined): OverlayScheduler {
  const dirty = new Set<OverlayJob>();
  let taskQueued = false;
  let frameQueued = false;

  const flush = () => {
    if (!dirty.size) return;
    const jobs = [...dirty];
    dirty.clear();
    const c = counters();
    if (c) c.flushes++;
    for (const job of jobs) job.read?.();
    for (const job of jobs) {
      if (c) c.runs[job.name] = (c.runs[job.name] ?? 0) + 1;
      job.write();
    }
  };
  const taskFlush = () => {
    taskQueued = false;
    flush();
  };
  const frameFlush = () => {
    frameQueued = false;
    flush();
  };
  const queueFrame = () => {
    if (frameQueued) return;
    frameQueued = true;
    host.beforeRender(frameFlush);
  };
  const queueTask = () => {
    if (taskQueued) return;
    taskQueued = true;
    host.afterTask(taskFlush);
  };

  return {
    invalidate(job) {
      dirty.add(job);
      if (host.inFrame()) queueFrame();
      // Also when in the loop: invalidated in its render or post-render step, the pre-render flush would be next tick's.
      queueTask();
    },
    defer(job) {
      dirty.add(job);
      queueFrame();
    },
    cancel(job) {
      dirty.delete(job);
    },
  };
}

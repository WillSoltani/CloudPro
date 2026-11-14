// Tests for components/film/overlayScheduler.ts (pure) on a fake frame loop. Run: npm run test:film-unit
//
// The model of a browser frame: events (a scroll) come first, then the animation frame callbacks (the frame loop's
// tick: its update step, where the film's clock ticks and the canvas paints, then pre-render, then render), each
// followed by its microtasks, then the browser renders what the DOM holds. A plate is right when, at that render, it
// shows the frame the canvas painted; it is cheap when it ran once.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOverlayScheduler, type OverlayCounters, type OverlayJob } from "./overlayScheduler";

function fakePage() {
  let processing = false;
  let preRender: (() => void)[] = [];
  const micro: (() => void)[] = [];
  const counters: OverlayCounters = { flushes: 0, runs: {} };
  const sched = createOverlayScheduler(
    {
      inFrame: () => processing,
      beforeRender: (fn) => {
        preRender.push(fn);
      },
      afterTask: (fn) => {
        micro.push(fn);
      },
    },
    () => counters,
  );
  /** The end of a task (an event listener, an animation frame callback): its microtasks run. */
  const endTask = () => {
    while (micro.length) micro.shift()!();
  };
  /** One tick of the frame loop as one animation frame callback: update, pre-render, render; then its microtasks. */
  const tick = (update: () => void = () => {}, render: () => void = () => {}) => {
    processing = true;
    update();
    const jobs = preRender;
    preRender = [];
    for (const fn of jobs) fn();
    render();
    processing = false;
    endTask();
  };
  /** Code outside the loop (a scroll event, the backdrop's own animation frame callback, a timer), then its microtasks. */
  const task = (fn: () => void) => {
    fn();
    endTask();
  };
  return { sched, tick, task, counters, pendingFrame: () => preRender.length };
}

/** A plate-like job: records the painted frame it computed for, and how often it ran. */
function plateJob(painted: { frame: number }, log?: string[], name = "plate:2") {
  const job = {
    name,
    runs: 0,
    shows: -1,
    seen: -1,
    read() {
      log?.push(`read ${name}`);
      job.seen = painted.frame;
    },
    write() {
      log?.push(`write ${name}`);
      job.runs++;
      job.shows = job.seen;
    },
  };
  return job;
}

describe("overlay scheduler", () => {
  it("runs a plate once per clock tick, after the paint, in the same tick (the usual scroll frame)", () => {
    const page = fakePage();
    const painted = { frame: 10 };
    const job = plateJob(painted);
    for (let frame = 11; frame <= 20; frame++) {
      let shownAtRender = -1;
      page.tick(
        () => {
          // onReel: the chapter's clock first, then draw(): the painted frame, then the painted segment.
          page.sched.invalidate(job);
          painted.frame = frame;
          page.sched.invalidate(job);
          page.sched.invalidate(job);
        },
        () => {
          shownAtRender = job.shows;
        },
      );
      // Run in the pre-render step: before framer-motion's render step, with the frame painted in update.
      assert.equal(shownAtRender, frame);
      assert.equal(job.shows, frame);
    }
    assert.equal(job.runs, 10);
    assert.equal(page.counters.runs["plate:2"], 10);
  });

  it("runs a plate before the end of a task that painted outside the loop (a frame that arrived, a jump, a resize)", () => {
    const page = fakePage();
    const painted = { frame: 0 };
    const job = plateJob(painted);
    page.task(() => {
      painted.frame = 33;
      page.sched.invalidate(job);
      page.sched.invalidate(job);
      // Nothing ran synchronously: the triggers coalesce.
      assert.equal(job.runs, 0);
    });
    // The task's microtasks ran: the plate shows frame 33 before the browser renders.
    assert.equal(job.shows, 33);
    assert.equal(job.runs, 1);
    // The pre-render flush queued for nothing (none here: not in the loop) does not run it again.
    page.tick();
    assert.equal(job.runs, 1);
  });

  it("folds a scroll into the clock's tick of the same frame", () => {
    const page = fakePage();
    const painted = { frame: 0 };
    const job = plateJob(painted);
    page.task(() => page.sched.defer(job)); // the scroll event: nothing runs yet
    assert.equal(job.runs, 0);
    assert.equal(page.pendingFrame(), 1);
    page.tick(() => {
      painted.frame = 7;
      page.sched.invalidate(job);
    });
    assert.equal(job.runs, 1);
    assert.equal(job.shows, 7);
  });

  it("runs a scroll alone in the coming frame", () => {
    const page = fakePage();
    const job = plateJob({ frame: 4 });
    page.task(() => page.sched.defer(job));
    page.tick();
    assert.equal(job.runs, 1);
    assert.equal(job.shows, 4);
  });

  it("runs a job invalidated after the pre-render step in the same task, not the next frame", () => {
    const page = fakePage();
    const painted = { frame: 1 };
    const job = plateJob(painted);
    page.tick(undefined, () => {
      painted.frame = 2;
      page.sched.invalidate(job);
    });
    assert.equal(job.shows, 2);
    assert.equal(job.runs, 1);
  });

  it("reads every job before writing any", () => {
    const page = fakePage();
    const painted = { frame: 3 };
    const log: string[] = [];
    const a = plateJob(painted, log, "plate:1");
    const b = plateJob(painted, log, "ride:cartridge_0");
    const c: OverlayJob = { name: "write-only", write: () => log.push("write write-only") };
    page.tick(() => {
      page.sched.invalidate(a);
      page.sched.invalidate(c);
      page.sched.invalidate(b);
    });
    assert.deepEqual(log, ["read plate:1", "read ride:cartridge_0", "write plate:1", "write write-only", "write ride:cartridge_0"]);
    assert.equal(page.counters.flushes, 1);
  });

  it("does not lose a job invalidated while the flush runs", () => {
    const page = fakePage();
    let again = true;
    let runs = 0;
    const job: OverlayJob = {
      name: "j",
      write: () => {
        runs++;
        if (again) {
          again = false;
          page.sched.invalidate(job);
        }
      },
    };
    page.task(() => page.sched.invalidate(job));
    assert.equal(runs, 2);
  });

  it("drops a cancelled job", () => {
    const page = fakePage();
    const job = plateJob({ frame: 1 });
    page.task(() => {
      page.sched.invalidate(job);
      page.sched.cancel(job);
    });
    page.tick();
    assert.equal(job.runs, 0);
  });
});

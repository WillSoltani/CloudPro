import type { FilmManifest } from "../filmCore";
import type { FrameLoader, JoinOptions, LoaderEnv, WantPlan } from "./types";

/**
 * A loader that can hand the page to the legacy loader at run time (design E: when the budget loader cannot decode the
 * frames on the main thread either). FilmBackdrop builds its loader once per page load and keeps it, so the swap
 * happens behind this one FrameLoader: `start(onUnusable)` builds the first loader; when it calls `onUnusable`, it is
 * disposed (its frames closed and reported), `startLegacy` builds the legacy loader, and everything the page has told
 * the loader so far is told again: the segments joined (at the width each had), which are near, the idle gate, the
 * page state, and the last plan (so frames are requested at once, even with the visitor at rest). `mode` becomes
 * "legacy" and is reported through `stats.mode`; onArrive subscriptions carry over.
 *
 * Of the last plan it keeps the numbers and FilmBackdrop's `entry` function (one closure for the page load), never the
 * WantPlan object itself (./types.ts).
 */
export function withLegacyFallback(
  env: LoaderEnv,
  start: (onUnusable: () => void) => FrameLoader,
  startLegacy: (env: LoaderEnv) => FrameLoader,
): FrameLoader {
  const joined = new Map<number, { film: FilmManifest; opts: JoinOptions }>();
  const near = new Map<number, boolean>();
  const arrive = new Set<(index: number, frame: number) => void>();
  let engaged = env.engaged;
  let hidden = false;
  let online = true;
  let disposed = false;
  const last: WantPlan = { active: -1, frame: 0, direction: 0, entry: () => 0 };
  let planned = false;

  const relay = (index: number, frame: number) => {
    for (const cb of arrive) cb(index, frame);
  };

  let swapping = false;
  const swap = () => {
    if (disposed || swapping || inner.mode === "legacy") return;
    swapping = true;
    const old = inner;
    const widths = new Map<number, number>();
    for (const index of joined.keys()) widths.set(index, old.width(index));
    unsubscribe();
    old.dispose();
    inner = startLegacy({ ...env, engaged });
    unsubscribe = inner.onArrive(relay);
    env.stats.mode?.(inner.mode);
    if (hidden) inner.visibility(true);
    if (!online) inner.network(false);
    for (const [index, j] of joined) {
      inner.join(index, j.film, widths.get(index) || env.tier(j.film), j.opts);
      env.onLoaded?.(index, 0);
    }
    if (near.size) inner.setNear([...near]);
    inner.rerank();
    if (planned) inner.want(last);
    swapping = false;
  };

  let inner = start(() => {
    // Never inside the first loader's own call stack: it is disposed by the swap.
    queueMicrotask(swap);
  });
  let unsubscribe = inner.onArrive(relay);

  return {
    get mode() {
      return inner.mode;
    },
    join(index, film, width, opts) {
      joined.set(index, { film, opts });
      inner.join(index, film, width, opts);
    },
    leave(index) {
      joined.delete(index);
      near.delete(index);
      inner.leave(index);
    },
    setNear(changes) {
      for (const [index, n] of changes) near.set(index, n);
      inner.setNear(changes);
    },
    engage() {
      engaged = true;
      inner.engage();
    },
    rerank() {
      inner.rerank();
    },
    want(plan) {
      last.active = plan.active;
      last.frame = plan.frame;
      last.direction = plan.direction;
      last.entry = plan.entry;
      planned = true;
      inner.want(plan);
    },
    nearest: (index, frame) => inner.nearest(index, frame),
    isComing: (index, frame, tolerance) => inner.isComing(index, frame, tolerance),
    waitReason: (index, frame) => inner.waitReason?.(index, frame) ?? "",
    debugState: (index, frame) => inner.debugState?.(index, frame) ?? { mode: inner.mode },
    usable: (index, frame) => inner.usable(index, frame),
    loaded: (index) => inner.loaded(index),
    width: (index) => inner.width(index),
    onArrive(cb) {
      arrive.add(cb);
      return () => {
        arrive.delete(cb);
      };
    },
    isSlow: () => inner.isSlow(),
    visibility(h) {
      hidden = h;
      inner.visibility(h);
    },
    network(on) {
      online = on;
      inner.network(on);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      arrive.clear();
      inner.dispose();
    },
  };
}

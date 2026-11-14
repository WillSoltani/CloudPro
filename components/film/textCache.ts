// The back-to-top button's per-chapter text measurements, kept in one place so that nothing is measured while the page
// scrolls (stage 8). Every chapter is measured once: the current one at once when it is asked for, the others one per idle
// slice after the page has loaded, and all of them again (lazily, the same way) when something that changes the text's place
// is reported. A chapter that scrolls into view has been measured already; if its turn has not come yet it is measured then,
// which is the one case a text walk can land inside a scroll, and only on a phone that never went idle in 1.5 s.
//
// Pure: the measuring, the idle scheduler and its cancel are injected, so node tests run it on fakes (textCache.test.ts).

export type TextCacheOptions<T> = {
  /** The chapters' ids, in page order (the order the idle slices measure them in). */
  ids: readonly string[];
  /** Measures one chapter (a layout read and a text walk: the cost this module keeps off the scroll). */
  measure(id: string): T;
  /** Runs `fn` when the browser is idle; returns a handle for `cancel`. */
  schedule(fn: () => void): number;
  cancel(handle: number): void;
};

export type TextCache<T> = {
  /** The chapter's measurement, taking it now if it has none. */
  ensure(id: string): T;
  /** The chapter's measurement if it has one. */
  peek(id: string): T | undefined;
  /** How many chapters are measured (tests, measurement). */
  size(): number;
  /** Starts the idle slices for the chapters not measured yet. */
  start(): void;
  /** Everything measured is stale: forget it, measure `current` now (when given) and the rest when idle. */
  invalidate(current?: string): void;
  /** Cancels the idle slice; the cache keeps what it has. */
  stop(): void;
};

export function createTextCache<T>(opts: TextCacheOptions<T>): TextCache<T> {
  const cache = new Map<string, T>();
  let handle = 0;
  let stopped = false;
  const slice = () => {
    handle = 0;
    if (stopped) return;
    const next = opts.ids.find((id) => !cache.has(id));
    if (next === undefined) return;
    cache.set(next, opts.measure(next));
    if (opts.ids.some((id) => !cache.has(id))) handle = opts.schedule(slice);
  };
  const restart = () => {
    if (handle) opts.cancel(handle);
    handle = stopped || opts.ids.every((id) => cache.has(id)) ? 0 : opts.schedule(slice);
  };
  const ensure = (id: string): T => {
    const have = cache.get(id);
    if (have !== undefined) return have;
    const m = opts.measure(id);
    cache.set(id, m);
    return m;
  };
  return {
    ensure,
    peek: (id) => cache.get(id),
    size: () => cache.size,
    start() {
      stopped = false;
      restart();
    },
    invalidate(current) {
      if (stopped) return;
      cache.clear();
      if (current !== undefined && opts.ids.includes(current)) ensure(current);
      restart();
    },
    stop() {
      stopped = true;
      if (handle) opts.cancel(handle);
      handle = 0;
    },
  };
}

/**
 * A ResizeObserver reports every element once when it starts observing it; that report is not a change. `changed(targets)`
 * takes the targets of one callback's entries and says whether any of them was reported before (a real resize).
 */
export function createFirstReportSkip(): (targets: Iterable<unknown>) => boolean {
  const seen = new Set<unknown>();
  return (targets) => {
    let changed = false;
    for (const t of targets) {
      if (seen.has(t)) changed = true;
      else seen.add(t);
    }
    return changed;
  };
}

// The flow reveals' shared controller (stage 8). A FlowReveal (components/film/Reveal.tsx) fades in on raw scroll as its top
// rises through the bottom 18 % of the viewport. Before stage 8 each of them kept its own scroll listener and animation
// frame loop for the whole life of the page, reading its layout and writing its style one after another. Now one controller
// serves all of them:
//   - one IntersectionObserver (rootMargin FLOW_BAND, one and a half viewports above and below) says which are near;
//   - while at least one is near, a scroll runs ONE animation frame that reads every near item and then writes every near
//     item (no read after a write);
//   - an item writes only what changed.
// An item beyond the band is already at its end state (0 below, 1 above): nothing to do until it comes within the band, and
// then, on entering, the controller refreshes EVERY item once (an item that a jump took from one side of the band to the
// other never reported anything, so it would otherwise keep a stale state). A scroll that moves more than the band in one
// event does the same, in that event's own frame, and so the controller keeps its scroll subscription (the shared one,
// scrollHub.ts) while any item is registered, near or not: with nothing near it only compares `scrollY` with the last one.
// Without it an instant jump from beyond the band (a restored history position, a click on the scrollbar's track) was first
// seen by the IntersectionObserver, whose report comes after the frame at the target is painted: one frame of items at 0.
// Pure: the browser is injected (FlowHost), so node tests run it on a fake (flowReveal.test.ts).

/** IntersectionObserver rootMargin of the band: one and a half viewports above and below the viewport. */
export const FLOW_BAND = "150% 0px 150% 0px";
/** A scroll event that moves the page by more than this many viewports refreshes every item (a jump). */
export const FLOW_JUMP = 1.5;

/** The rise in px of an item that has not arrived. */
export const FLOW_RISE = 10;
/** The ramp's length: the item's top rising through this share of the viewport's bottom. */
export const FLOW_RAMP = 0.18;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** The flow item's opacity: 0 while its untransformed top is at or below the viewport's bottom, 1 once the ramp is through. */
export function flowOpacity(top: number, vh: number): number {
  return easeOutCubic(Math.min(1, Math.max(0, (vh - top) / (FLOW_RAMP * vh))));
}

/** What an item's inline style holds at opacity `o` (the strings the DOM gets: `transform` empty once arrived). */
export function flowStyle(o: number): { opacity: string; transform: string } {
  return {
    opacity: String(+o.toFixed(3)),
    transform: o >= 1 ? "" : `translateY(${((1 - o) * FLOW_RISE).toFixed(2)}px)`,
  };
}

/** One flow item as the controller sees it. */
export type FlowItem = {
  /** The item's top in the viewport without its own rise (a layout read). */
  top(): number;
  /** Sets the inline style (called only when it changes), and says what the rise is now. */
  write(style: { opacity: string; transform: string }): void;
};

export type FlowHost = {
  /** Reports whether `item` is within the band, now and whenever it changes. Returns the stop. */
  observe(item: FlowItem, onBand: (inBand: boolean) => void): () => void;
  /** One shared scroll subscription; returns the unsubscribe. */
  onScroll(fn: () => void): () => void;
  /** The viewport's changes (rotation, window resize); returns the unsubscribe. */
  onViewport(fn: () => void): () => void;
  frame(fn: () => void): number;
  cancelFrame(id: number): void;
  scrollY(): number;
  height(): number;
};

export type FlowController = {
  /** Registers an item and applies it once now; returns the removal (which leaves its last state in place). */
  add(item: FlowItem): () => void;
};

export function createFlowController(host: FlowHost): FlowController {
  type Entry = { item: FlowItem; near: boolean; style: string; stop: () => void };
  const entries = new Set<Entry>();
  let near = 0;
  let offScroll: (() => void) | null = null;
  let offViewport: (() => void) | null = null;
  let raf = 0;
  let all = false;
  let lastY = 0;

  const pass = (every: boolean) => {
    const vh = host.height();
    const run: [Entry, number][] = [];
    for (const e of entries) if (every || e.near) run.push([e, flowOpacity(e.item.top(), vh)]);
    for (const [e, o] of run) {
      const s = flowStyle(o);
      const key = `${s.opacity}|${s.transform}`;
      if (key === e.style) continue;
      e.style = key;
      e.item.write(s);
    }
  };
  const frame = () => {
    raf = 0;
    const every = all;
    all = false;
    pass(every);
  };
  const schedule = (every = false) => {
    all ||= every;
    if (!raf) raf = host.frame(frame);
  };
  const onScroll = () => {
    const y = host.scrollY();
    const jump = Math.abs(y - lastY) > FLOW_JUMP * host.height();
    lastY = y;
    // Nothing near and no jump: every item is at its end state, nothing to do.
    if (jump || near > 0) schedule(jump);
  };
  const sync = () => {
    if (entries.size && !offScroll) {
      lastY = host.scrollY();
      offScroll = host.onScroll(onScroll);
    } else if (!entries.size && offScroll) {
      offScroll();
      offScroll = null;
    }
  };

  return {
    add(item) {
      const e: Entry = { item, near: false, style: "", stop: () => {} };
      entries.add(e);
      sync();
      if (!offViewport) offViewport = host.onViewport(() => schedule(true));
      e.stop = host.observe(item, (inBand) => {
        if (inBand === e.near) return;
        e.near = inBand;
        near += inBand ? 1 : -1;
        sync();
        // Entering or leaving: every item is refreshed once (see the module comment).
        schedule(true);
      });
      // Applied at once (as before stage 8): the first paint after hydration shows the right state.
      const o = flowOpacity(item.top(), host.height());
      const s = flowStyle(o);
      e.style = `${s.opacity}|${s.transform}`;
      item.write(s);
      return () => {
        e.stop();
        if (e.near) near--;
        entries.delete(e);
        sync();
        if (!entries.size) {
          if (raf) host.cancelFrame(raf);
          raf = 0;
          all = false;
          offViewport?.();
          offViewport = null;
        }
      };
    },
  };
}

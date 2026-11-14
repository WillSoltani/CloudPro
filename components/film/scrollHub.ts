// One window `scroll` listener for the page chrome (the nav, the back-to-top button, the flow reveals, the plates), however
// many of them ask: it is attached while anything is subscribed and detached after the last unsubscribe. Each subscriber
// still does its own cheap work (setting a flag, scheduling an animation frame); what is shared is the listener, so the
// browser dispatches one scroll event handler instead of one per component. Client only; the host is injectable so node
// tests run it on a fake (scrollHub.test.ts).

export type ScrollHost = {
  add(listener: () => void): void;
  remove(listener: () => void): void;
};

export type ScrollHub = {
  /** Calls `fn` on every scroll event (and on no other). Returns the unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** How many subscribers there are now (measurement and tests). */
  size(): number;
};

export function createScrollHub(host: ScrollHost): ScrollHub {
  const subscribers = new Set<() => void>();
  const onScroll = () => {
    for (const fn of [...subscribers]) fn();
  };
  return {
    subscribe(fn) {
      if (!subscribers.size) host.add(onScroll);
      subscribers.add(fn);
      return () => {
        if (!subscribers.delete(fn) || subscribers.size) return;
        host.remove(onScroll);
      };
    },
    size: () => subscribers.size,
  };
}

const hub = createScrollHub({
  add: (l) => window.addEventListener("scroll", l, { passive: true }),
  remove: (l) => window.removeEventListener("scroll", l),
});

/** The page's shared scroll subscription (see the module comment). */
export const subscribeScroll = hub.subscribe;

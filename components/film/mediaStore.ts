// One matchMedia listener per query for the whole page (useSyncExternalStore stores), however many components read it.
//
// Before stage 8 every component that cared about prefers-reduced-motion made its own MediaQueryList and listener
// (about 21 on the home page), and the chapters and anchors each listened to the `wide` rule too. A store keeps one
// MediaQueryList per query and one `change` listener on it, attached while anything is subscribed. Pure: the matchMedia
// function is injected (the default is the window's), so node tests run it on a fake (mediaStore.test.ts).

/** The part of a MediaQueryList the stores use. */
export type MediaQueryListLike = {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
};

export type MediaStore = {
  /** For useSyncExternalStore: `onChange` runs when the query's result changes. Returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** The query's result now (client only). */
  get(): boolean;
};

/** A shared store for `query`: one MediaQueryList, one `change` listener while there are subscribers. */
export function createMediaStore(
  query: string,
  matchMedia: (query: string) => MediaQueryListLike = (q) => window.matchMedia(q),
): MediaStore {
  let mql: MediaQueryListLike | null = null;
  const list = () => (mql ??= matchMedia(query));
  const subscribers = new Set<() => void>();
  const onChange = () => {
    for (const fn of [...subscribers]) fn();
  };
  return {
    subscribe(fn) {
      if (!subscribers.size) list().addEventListener("change", onChange);
      subscribers.add(fn);
      return () => {
        if (!subscribers.delete(fn) || subscribers.size) return;
        list().removeEventListener("change", onChange);
      };
    },
    get: () => list().matches,
  };
}

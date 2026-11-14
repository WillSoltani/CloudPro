import assert from "node:assert/strict";
import { test } from "node:test";
import { createMediaStore, type MediaQueryListLike } from "./mediaStore";

/** A fake matchMedia: one MediaQueryList per call, so a test can count how many were made and how many listeners are alive. */
function fakeMatchMedia(initial = false) {
  let matches = initial;
  const made: string[] = [];
  const listeners = new Set<() => void>();
  const list: MediaQueryListLike = {
    get matches() {
      return matches;
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return {
    matchMedia: (q: string) => (made.push(q), list),
    made,
    alive: () => listeners.size,
    set(next: boolean) {
      matches = next;
      for (const l of [...listeners]) l();
    },
  };
}

test("many subscribers share one MediaQueryList and one listener", () => {
  const m = fakeMatchMedia();
  const store = createMediaStore("(a)", m.matchMedia);
  const offs = Array.from({ length: 21 }, () => store.subscribe(() => {}));
  assert.equal(m.made.length, 1);
  assert.equal(m.alive(), 1);
  for (const off of offs) off();
  assert.equal(m.alive(), 0);
});

test("every subscriber hears a change, and get() follows it", () => {
  const m = fakeMatchMedia(false);
  const store = createMediaStore("(a)", m.matchMedia);
  let a = 0;
  let b = 0;
  const offA = store.subscribe(() => a++);
  store.subscribe(() => b++);
  assert.equal(store.get(), false);
  m.set(true);
  assert.deepEqual([a, b, store.get()], [1, 1, true]);
  offA();
  m.set(false);
  assert.deepEqual([a, b, store.get()], [1, 2, false]);
});

test("the listener is re-attached after the last subscriber left, and an unsubscribe twice is harmless", () => {
  const m = fakeMatchMedia();
  const store = createMediaStore("(a)", m.matchMedia);
  const off = store.subscribe(() => {});
  off();
  off();
  assert.equal(m.alive(), 0);
  const again = store.subscribe(() => {});
  assert.equal(m.alive(), 1);
  assert.equal(m.made.length, 1);
  again();
});

test("nothing touches matchMedia until the store is read or subscribed", () => {
  const m = fakeMatchMedia(true);
  const store = createMediaStore("(a)", m.matchMedia);
  assert.equal(m.made.length, 0);
  assert.equal(store.get(), true);
  assert.equal(m.made.length, 1);
});

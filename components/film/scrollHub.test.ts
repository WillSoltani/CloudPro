import assert from "node:assert/strict";
import { test } from "node:test";
import { createScrollHub } from "./scrollHub";

function fakeHost() {
  const listeners = new Set<() => void>();
  return {
    add: (l: () => void) => void listeners.add(l),
    remove: (l: () => void) => void listeners.delete(l),
    alive: () => listeners.size,
    fire: () => {
      for (const l of [...listeners]) l();
    },
  };
}

test("one host listener serves every subscriber and goes with the last", () => {
  const host = fakeHost();
  const hub = createScrollHub(host);
  assert.equal(host.alive(), 0);
  let a = 0;
  let b = 0;
  const offA = hub.subscribe(() => a++);
  const offB = hub.subscribe(() => b++);
  assert.equal(host.alive(), 1);
  host.fire();
  assert.deepEqual([a, b], [1, 1]);
  offA();
  assert.equal(host.alive(), 1);
  host.fire();
  assert.deepEqual([a, b], [1, 2]);
  offB();
  offB();
  assert.equal(host.alive(), 0);
  assert.equal(hub.size(), 0);
});

test("a subscriber that unsubscribes while the event is dispatched does not stop the others", () => {
  const host = fakeHost();
  const hub = createScrollHub(host);
  let b = 0;
  const offA = hub.subscribe(() => offA());
  hub.subscribe(() => b++);
  host.fire();
  host.fire();
  assert.equal(b, 2);
  assert.equal(hub.size(), 1);
});

// Tests for scripts/films/leg-bucket.mjs. Run: npm run test:film-unit
import test from "node:test";
import assert from "node:assert/strict";
import { legBucket } from "./leg-bucket.mjs";

const make = () => ({ load: { requests: 0 }, pass: { requests: 0 }, back: { requests: 0 }, between: { requests: 0 } });

test("a measured leg gets its own bucket", () => {
  const legs = make();
  for (const k of ["load", "pass", "back", "between"]) assert.equal(legBucket(legs, k), legs[k]);
});

test("a phase without a bucket lands in between (the gate set phase = \"done\" while requests were still arriving)", () => {
  const legs = make();
  assert.equal(legBucket(legs, "done"), legs.between);
  assert.doesNotThrow(() => {
    legBucket(legs, "done").requests++;
  });
  assert.equal(legs.between.requests, 1);
  assert.equal(legs.pass.requests, 0);
});

test("names that exist on Object.prototype are not buckets", () => {
  const legs = make();
  assert.equal(legBucket(legs, "constructor"), legs.between);
  assert.equal(legBucket(legs, "toString"), legs.between);
});

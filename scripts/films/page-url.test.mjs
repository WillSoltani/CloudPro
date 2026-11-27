import assert from "node:assert/strict";
import test from "node:test";
import { pageUrl } from "./page-url.mjs";

test("pageUrl: no query is the bare page", () => {
  assert.equal(pageUrl("http://127.0.0.1:3006", ""), "http://127.0.0.1:3006/");
  assert.equal(pageUrl("http://127.0.0.1:3006", undefined), "http://127.0.0.1:3006/");
});

test("pageUrl: a query is appended after a question mark, a leading ? or & is dropped", () => {
  assert.equal(pageUrl("http://127.0.0.1:3006", "budget=160"), "http://127.0.0.1:3006/?budget=160");
  assert.equal(pageUrl("http://127.0.0.1:3006", "?budget=160&hud=1"), "http://127.0.0.1:3006/?budget=160&hud=1");
  assert.equal(pageUrl("http://127.0.0.1:3006", "&hud=1"), "http://127.0.0.1:3006/?hud=1");
});

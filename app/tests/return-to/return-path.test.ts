import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnPath } from "../../auth/_lib/return-path";

const FALLBACK = "/app";

test("control characters the URL parser would strip fall back (no open redirect)", () => {
  for (const raw of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\t\\evil.com"]) {
    assert.equal(sanitizeReturnPath(raw, FALLBACK), FALLBACK, JSON.stringify(raw));
  }
});

test("protocol-relative values fall back", () => {
  for (const raw of ["//evil.com", "/\\evil.com", "///evil.com", "/\\/evil.com"]) {
    assert.equal(sanitizeReturnPath(raw, FALLBACK), FALLBACK, JSON.stringify(raw));
  }
});

test("same-site paths are kept with their query and hash", () => {
  assert.equal(sanitizeReturnPath("/ok?x=1", FALLBACK), "/ok?x=1");
  assert.equal(sanitizeReturnPath("/app/projects/guest?from=test", FALLBACK), "/app/projects/guest?from=test");
  assert.equal(sanitizeReturnPath("/app#files", FALLBACK), "/app#files");
});

test("an encoded double slash stays a path on this site", () => {
  const out = sanitizeReturnPath("/%2F%2Fevil.com", FALLBACK);
  assert.equal(out, "/%2F%2Fevil.com");
  assert.equal(new URL(out, "https://soltani.org").host, "soltani.org");
});

test("anything that is not a path falls back", () => {
  assert.equal(sanitizeReturnPath("https://evil.com/", FALLBACK), FALLBACK);
  assert.equal(sanitizeReturnPath("evil.com", FALLBACK), FALLBACK);
});

// Tests for the lab pack server's answers (scripts/films/pack-serve.mjs). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { REPO } from "./pack-lib.mjs";
import { answer, DEFAULT_ROOT } from "./pack-serve.mjs";

const data = Buffer.from("0123456789");
const E = '"abc"';

describe("pack-serve default root", () => {
  it("is the builder's default output tree (pack.mjs --out), films-src/packs under the repository root", () => {
    assert.equal(DEFAULT_ROOT, path.join(REPO, "films-src", "packs"));
  });
});

describe("pack-serve answer", () => {
  it("a plain GET is a 200 with the CDN's headers", () => {
    const a = answer("GET", {}, data, E);
    assert.equal(a.status, 200);
    assert.equal(a.headers["Content-Length"], "10");
    assert.equal(a.headers["Access-Control-Allow-Origin"], "*");
    assert.match(a.headers["Access-Control-Expose-Headers"], /Content-Range/);
    assert.equal(a.headers["Accept-Ranges"], "bytes");
    assert.match(a.headers["Cache-Control"], /immutable/);
  });
  it("a Range request is a 206 with a Content-Range", () => {
    const a = answer("GET", { range: "bytes=2-5" }, data, E);
    assert.equal(a.status, 206);
    assert.equal(a.headers["Content-Range"], "bytes 2-5/10");
    assert.equal(a.body.toString(), "2345");
    const b = answer("GET", { range: "bytes=7-" }, data, E);
    assert.equal(b.headers["Content-Range"], "bytes 7-9/10");
    assert.equal(answer("GET", { range: "bytes=4-99" }, data, E).headers["Content-Range"], "bytes 4-9/10");
  });
  it("a range past the end is a 416, a matching ETag a 304, HEAD has no body", () => {
    assert.equal(answer("GET", { range: "bytes=10-" }, data, E).status, 416);
    assert.equal(answer("GET", { "if-none-match": E }, data, E).status, 304);
    assert.equal(answer("HEAD", {}, data, E).body, null);
  });
});

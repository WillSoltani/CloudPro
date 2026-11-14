// Tests for components/film/navJump.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NAV_ORDER, createFragmentClickMark, currentChapter, isNavTarget, navScroll, navSmoothRequested } from "./navJump";

const at = (id: (typeof NAV_ORDER)[number]) => NAV_ORDER.indexOf(id);

describe("currentChapter", () => {
  it("is the lit section, else the hero before About and the epilogue after Projects", () => {
    assert.equal(currentChapter("skills", true), at("skills"));
    assert.equal(currentChapter("", false), at("hero"));
    assert.equal(currentChapter("", true), at("epilogue"));
    assert.equal(currentChapter("nonsense", false), at("hero"));
  });
});

describe("navScroll", () => {
  it("scrolls smoothly to the next or the previous chapter and to the same one", () => {
    assert.equal(navScroll(at("hero"), at("about"), false), "smooth");
    assert.equal(navScroll(at("skills"), at("certifications"), false), "smooth");
    assert.equal(navScroll(at("skills"), at("skills"), false), "smooth");
    assert.equal(navScroll(at("skills"), at("projects"), false), "smooth");
  });
  it("jumps when the target is more than one chapter away, in either direction", () => {
    assert.equal(navScroll(at("hero"), at("certifications"), false), "instant");
    assert.equal(navScroll(at("about"), at("contact"), false), "instant");
    assert.equal(navScroll(at("contact"), at("about"), false), "instant");
    assert.equal(navScroll(at("projects"), at("contact"), false), "instant"); // through the exit and the bridge
    assert.equal(navScroll(at("epilogue"), at("contact"), false), "smooth");
  });
  it("keeps smooth everywhere when ?nav=smooth asked", () => {
    assert.equal(navScroll(at("hero"), at("contact"), true), "smooth");
  });
});

describe("the targets and the switch", () => {
  it("only the five nav sections are targets", () => {
    for (const id of ["about", "certifications", "skills", "projects", "contact"]) assert.equal(isNavTarget(id), true, id);
    for (const id of ["hero", "epilogue", "exit", "", "nope"]) assert.equal(isNavTarget(id), false, id);
  });
  it("reads ?nav=smooth and nothing else", () => {
    assert.equal(navSmoothRequested("?nav=smooth"), true);
    assert.equal(navSmoothRequested("?x=1&nav=smooth"), true);
    assert.equal(navSmoothRequested(""), false);
    assert.equal(navSmoothRequested("?nav=instant"), false);
  });
});

describe("the fragment click mark", () => {
  it("answers true once for the popstate that follows a click, then false", () => {
    const m = createFragmentClickMark(1000);
    m.note(5000);
    assert.equal(m.consume(5003), true);
    assert.equal(m.consume(5004), false); // a Back press after the click's own popstate is a traversal
  });
  it("is false with no click, and when the popstate comes after the window (a click whose navigation did not fire one)", () => {
    const m = createFragmentClickMark(1000);
    assert.equal(m.consume(10), false);
    m.note(100);
    assert.equal(m.consume(1101), false);
    assert.equal(m.consume(1102), false); // and the stale mark is gone
  });
  it("a second click re-arms it", () => {
    const m = createFragmentClickMark(1000);
    m.note(0);
    m.consume(1);
    m.note(2000);
    assert.equal(m.consume(2002), true);
  });
});

// Tests for components/film/cornerText.ts (pure parts). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLEAR,
  INSET,
  REVEAL_SLACK,
  SIZE,
  cornerZone,
  stickyTop,
  textInZone,
  translateYOf,
  type ChapterText,
  type TextBox,
} from "./cornerText";

const sec = { secTop: 1000, secHeight: 4000, composeHeight: 1200 };

describe("cornerZone", () => {
  it("is the button's box (24 px in, 44 px square) with CLEAR around it", () => {
    assert.deepEqual(cornerZone(390, 844), [390 - INSET - SIZE - CLEAR, 844 - INSET - SIZE - CLEAR, 390 - INSET + CLEAR, 844 - INSET + CLEAR]);
    assert.deepEqual(cornerZone(390, 844), [314, 768, 374, 828]);
  });
});

describe("cornerZone with safe-area insets", () => {
  it("moves with the button where an inset is larger than its 24 px, and not otherwise", () => {
    assert.deepEqual(cornerZone(844, 390, { right: 47, bottom: 21 }), [844 - 47 - SIZE - CLEAR, 390 - INSET - SIZE - CLEAR, 844 - 47 + CLEAR, 390 - INSET + CLEAR]);
    assert.deepEqual(cornerZone(390, 844, { right: 0, bottom: 34 }), [314, 844 - 34 - SIZE - CLEAR, 374, 844 - 34 + CLEAR]);
    assert.deepEqual(cornerZone(390, 844, { right: 10, bottom: 10 }), cornerZone(390, 844));
  });
});

describe("stickyTop", () => {
  it("travels with the page before the pin, holds at the top through it, and travels on at the section's end", () => {
    assert.equal(stickyTop(sec, 0), 1000); // 1000 px below the viewport's top
    assert.equal(stickyTop(sec, 400), 600);
    assert.equal(stickyTop(sec, 1000), 0); // reaches the top
    assert.equal(stickyTop(sec, 2500), 0); // pinned
    assert.equal(stickyTop(sec, 3800), 0); // limit = 1000 + 4000 - 1200 - 3800 = 0
    assert.equal(stickyTop(sec, 4300), -500); // released: leaves with the section
  });
});

describe("textInZone", () => {
  const zone = cornerZone(390, 844); // [314, 768, 374, 828]
  const line: TextBox = [40, 100, 350, 130]; // a line 100..130 under the composition's top, spanning the corner's x
  it("finds a line under the corner and none away from it", () => {
    assert.equal(textInZone([line], 700, zone), true); // line at 800..830 on screen
    assert.equal(textInZone([line], 0, zone), false);
  });
  it("gives REVEAL_SLACK above and below, and none beyond", () => {
    // The line's bottom at viewport y = top + 130; zone top 768 less the slack.
    assert.equal(textInZone([line], 768 - REVEAL_SLACK - 130 + 0.5, zone), true);
    assert.equal(textInZone([line], 768 - REVEAL_SLACK - 130 - 0.5, zone), false);
    // The line's top at top + 100; zone bottom 828 plus the slack.
    assert.equal(textInZone([line], 828 + REVEAL_SLACK - 100 - 0.5, zone), true);
    assert.equal(textInZone([line], 828 + REVEAL_SLACK - 100 + 0.5, zone), false);
  });
  it("needs the line to reach the corner's x range", () => {
    assert.equal(textInZone([[40, 100, 300, 130]], 700, zone), false); // ends left of 314
    assert.equal(textInZone([[374, 100, 380, 130]], 700, zone), false); // starts at the zone's right edge
    assert.equal(textInZone([[0, 100, 0, 130]], 700, zone), false); // zero width
  });
  it("follows the sticky model: the same line is under the corner at one scroll and clear at another", () => {
    const m: ChapterText = { ...sec, boxes: [[40, 300, 350, 330]] };
    const at = (scrollY: number, lift = 0) => textInZone(m.boxes, stickyTop(m, scrollY) + lift, zone);
    assert.equal(at(2500), false); // pinned: the line sits at 300..330
    assert.equal(at(2500, 500), true); // lifted by +500: 800..830
    assert.equal(at(500), true); // before the pin: top 500 -> 800..830
    assert.equal(at(1000), false);
    assert.equal(at(4000), false); // released: top -200 -> 100..130
  });
});

describe("translateYOf", () => {
  it("reads what framer-motion writes", () => {
    assert.equal(translateYOf(""), 0);
    assert.equal(translateYOf("none"), 0);
    assert.equal(translateYOf("translateY(-12.5px)"), -12.5);
    assert.equal(translateYOf("translateY(-120px) translateZ(0)"), -120);
    assert.equal(translateYOf("translateY(3.2e-7px)"), 3.2e-7);
    assert.equal(translateYOf("translate3d(0px, -40px, 0px)"), -40);
    assert.equal(translateYOf("translate(5px, 7px)"), 7);
    assert.equal(translateYOf("matrix(1, 0, 0, 1, 0, -33)"), -33);
    assert.equal(translateYOf("scale(2)"), 0);
  });
});

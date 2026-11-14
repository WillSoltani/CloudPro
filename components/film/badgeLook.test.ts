// Tests for components/film/badgeLook.ts (pure). Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BADGE_CALM,
  BADGE_COARSE_WASH,
  PING_CALM,
  PING_CYCLES,
  badgeBlurRequested,
  badgeLook,
  contrast,
  over,
} from "./badgeLook";

const LAMP = [0xf0, 0xa6, 0x3c];
const NIGHT = [7, 11, 22];
const TEXT = [0xe2, 0xe8, 0xf0]; // text-slate-200
const SLATE_400 = [0x94, 0xa3, 0xb8]; // the short-phone note's proxy for the film's bright ceiling

describe("the badge on touch screens", () => {
  it("keeps the text at 4.5:1 on the bright proxy once the blur is gone (WCAG AA)", () => {
    const fill = over(NIGHT, over(LAMP, SLATE_400, 0.1), BADGE_COARSE_WASH);
    assert.ok(contrast(TEXT, fill) >= 4.5, `contrast ${contrast(TEXT, fill).toFixed(2)}`);
  });
  it("is darker than the old short-phone wash (20 %), so it reads at least as well wherever the blur helped", () => {
    const old = contrast(TEXT, over(NIGHT, over(LAMP, SLATE_400, 0.1), 0.2));
    const calm = contrast(TEXT, over(NIGHT, over(LAMP, SLATE_400, 0.1), BADGE_COARSE_WASH));
    assert.ok(calm > old);
  });
  it("names the same wash in its class", () => {
    assert.ok(BADGE_CALM.includes(`rgb(7_11_22/${BADGE_COARSE_WASH})`));
    assert.ok(BADGE_CALM.includes("pointer-coarse:backdrop-blur-none"));
  });
});

describe("the ping", () => {
  it("runs PING_CYCLES one-second cycles and stops on its last keyframe", () => {
    assert.ok(PING_CALM.includes(`_${PING_CYCLES}_forwards`));
    assert.ok(PING_CALM.includes("ping_1s_cubic-bezier(0,0,0.2,1)"));
  });
});

describe("the switch", () => {
  it("reads ?badge=blur and nothing else", () => {
    assert.equal(badgeBlurRequested("?badge=blur"), true);
    assert.equal(badgeBlurRequested("?a=1&badge=blur"), true);
    assert.equal(badgeBlurRequested(""), false);
    assert.equal(badgeBlurRequested("?badge=calm"), false);
  });
  it("gives the old look with the endless ping, and the default look otherwise", () => {
    const old = badgeLook(true);
    assert.equal(old.look, "blur");
    assert.ok(old.ping.endsWith("animate-ping"));
    assert.ok(!old.pill.includes("pointer-coarse"));
    const calm = badgeLook(false);
    assert.equal(calm.look, "calm");
    assert.ok(calm.pill.includes("pointer-coarse"));
  });
});

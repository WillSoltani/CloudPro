// Tests for components/film/flowReveal.ts (pure) on a fake browser. Run: npm run test:film-unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLOW_JUMP,
  FLOW_RAMP,
  createFlowController,
  flowOpacity,
  flowStyle,
  type FlowHost,
  type FlowItem,
} from "./flowReveal";

const VH = 800;

/** A page of items at document tops; the viewport scrolls; `band` is what the fake IntersectionObserver reports. */
function fakePage(tops: number[]) {
  let scroll = 0;
  let nextId = 1;
  let scrollListeners = 0;
  let viewportListeners = 0;
  const frames = new Map<number, () => void>();
  const bands = new Map<FlowItem, (inBand: boolean) => void>();
  const log: string[] = [];
  const items = tops.map((doc, i) => {
    let style = { opacity: "", transform: "" };
    const item: FlowItem & { doc: number; style: () => typeof style; id: number } = {
      doc,
      id: i,
      top: () => (log.push(`read${i}`), doc - scroll),
      write: (s) => {
        log.push(`write${i}`);
        style = s;
      },
      style: () => style,
    };
    return item;
  });
  const handlers = new Set<() => void>();
  const host: FlowHost = {
    observe: (item, onBand) => {
      bands.set(item, onBand);
      return () => void bands.delete(item);
    },
    onScroll: (fn) => {
      scrollListeners++;
      handlers.add(fn);
      return () => {
        scrollListeners--;
        handlers.delete(fn);
      };
    },
    onViewport: () => {
      viewportListeners++;
      return () => void viewportListeners--;
    },
    frame: (fn) => {
      const id = nextId++;
      frames.set(id, fn);
      return id;
    },
    cancelFrame: (id) => void frames.delete(id),
    scrollY: () => scroll,
    height: () => VH,
  };
  return {
    items,
    host,
    log,
    scrollTo(y: number) {
      scroll = y;
      for (const h of [...handlers]) h();
    },
    /** What the IntersectionObserver would report: items within 1.5 viewports of the viewport. */
    reportBands() {
      for (const [item, cb] of bands) {
        const d = (item as (typeof items)[number]).doc - scroll;
        cb(d + 100 > -1.5 * VH && d < VH + 1.5 * VH);
      }
    },
    runFrames() {
      const run = [...frames.values()];
      frames.clear();
      for (const f of run) f();
    },
    pendingFrames: () => frames.size,
    scrollListeners: () => scrollListeners,
    viewportListeners: () => viewportListeners,
  };
}

describe("flowOpacity / flowStyle: the ramp the page had before stage 8", () => {
  it("is 0 at the viewport's bottom, 1 once the top has risen through 18 % of it, ease-out cubic between", () => {
    assert.equal(flowOpacity(VH, VH), 0);
    assert.equal(flowOpacity(VH + 50, VH), 0);
    assert.equal(flowOpacity(VH - FLOW_RAMP * VH, VH), 1);
    assert.equal(flowOpacity(100, VH), 1);
    const half = flowOpacity(VH - 0.09 * VH, VH);
    assert.ok(Math.abs(half - (1 - 0.5 ** 3)) < 1e-12);
  });
  it("writes a 10 px rise that vanishes at 1, and 3 decimals of opacity", () => {
    assert.deepEqual(flowStyle(0), { opacity: "0", transform: "translateY(10.00px)" });
    assert.deepEqual(flowStyle(0.5), { opacity: "0.5", transform: "translateY(5.00px)" });
    assert.deepEqual(flowStyle(1), { opacity: "1", transform: "" });
    assert.equal(flowStyle(1 / 3).opacity, "0.333");
  });
});

describe("createFlowController", () => {
  it("applies an item at once, and while nothing is near a scroll that is not a jump reads nothing and runs no frame", () => {
    const p = fakePage([5000]);
    createFlowController(p.host).add(p.items[0]!);
    assert.equal(p.items[0]!.style().opacity, "0");
    p.log.length = 0;
    for (const y of [100, 200, 300]) p.scrollTo(y);
    assert.equal(p.pendingFrames(), 0);
    assert.deepEqual(p.log, []);
  });

  it("keeps one shared scroll subscription for all its items, near or not", () => {
    const p = fakePage([3000, 3400]);
    const c = createFlowController(p.host);
    for (const it of p.items) c.add(it);
    p.reportBands();
    assert.equal(p.scrollListeners(), 1); // 3000 px away (beyond 800 + 1200), yet subscribed: see the next test
    p.scrollTo(1100);
    p.reportBands();
    assert.equal(p.scrollListeners(), 1); // one for both
    p.scrollTo(8000);
    p.reportBands();
    assert.equal(p.scrollListeners(), 1);
  });

  it("applies an instant jump from beyond the band in the scroll's own frame, before the observer reports", () => {
    // A restored history position or a click on the scrollbar's track: from the top straight into a list. The observer's
    // report comes after the frame at the target is painted, so the items must not wait for it (else one frame at 0).
    const p = fakePage([5000, 5200]);
    const c = createFlowController(p.host);
    for (const it of p.items) c.add(it);
    p.reportBands(); // nothing near
    assert.equal(p.items[0]!.style().opacity, "0");
    p.scrollTo(4500); // no reportBands: the observer has not spoken yet
    assert.equal(p.pendingFrames(), 1, "the jump's scroll event asked for a frame");
    p.runFrames();
    assert.deepEqual(p.items[0]!.style(), { opacity: "1", transform: "" }); // top at 500
    assert.ok(Number(p.items[1]!.style().opacity) > 0.5, "the second item (top at 700) is on its ramp");
  });

  it("runs one frame per burst of scroll events, reads every near item before it writes any", () => {
    const p = fakePage([1650, 1660, 90000]);
    const c = createFlowController(p.host);
    for (const it of p.items) c.add(it);
    p.scrollTo(900);
    p.reportBands();
    p.runFrames();
    p.log.length = 0;
    for (const y of [920, 940, 960, 980]) p.scrollTo(y);
    assert.equal(p.pendingFrames(), 1);
    p.runFrames();
    assert.deepEqual(p.log, ["read0", "read1", "write0", "write1"]); // the far item is not read
  });

  it("writes only what changed", () => {
    const p = fakePage([1800]);
    createFlowController(p.host).add(p.items[0]!);
    p.scrollTo(900);
    p.reportBands();
    p.runFrames();
    p.log.length = 0;
    p.scrollTo(901); // the item is still below the viewport: opacity 0, nothing to write
    p.runFrames();
    assert.deepEqual(p.log, ["read0"]);
    p.scrollTo(1500); // its top at 300: arrived
    p.runFrames();
    assert.deepEqual(p.log, ["read0", "read0", "write0"]);
    assert.deepEqual(p.items[0]!.style(), { opacity: "1", transform: "" });
  });

  it("refreshes every item when one enters the band (an item a jump took across never reported)", () => {
    const p = fakePage([1500, 9000]);
    const c = createFlowController(p.host);
    for (const it of p.items) c.add(it);
    assert.equal(p.items[0]!.style().opacity, "0");
    // Jump past the first item and into the band of the second, with no frame in between.
    p.scrollTo(8000);
    p.reportBands();
    p.runFrames();
    assert.equal(p.items[0]!.style().opacity, "1"); // it was never near again, yet it is now 1
  });

  it("refreshes every item on a scroll that jumps by more than the band's share, and on a viewport change", () => {
    const p = fakePage([1500, 20000]);
    const c = createFlowController(p.host);
    for (const it of p.items) c.add(it);
    p.scrollTo(900);
    p.reportBands();
    p.runFrames();
    p.log.length = 0;
    p.scrollTo(900 + FLOW_JUMP * VH + 1);
    p.runFrames();
    assert.ok(p.log.includes("read1"), "the far item was read on a jump");
    assert.equal(p.viewportListeners(), 1);
  });

  it("removes cleanly: no frame, no scroll subscription, no viewport subscription", () => {
    const p = fakePage([1500]);
    const remove = createFlowController(p.host).add(p.items[0]!);
    p.scrollTo(900);
    p.reportBands();
    assert.equal(p.scrollListeners(), 1);
    p.scrollTo(910);
    remove();
    assert.equal(p.scrollListeners(), 0);
    assert.equal(p.viewportListeners(), 0);
    assert.equal(p.pendingFrames(), 0);
  });
});

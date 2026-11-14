import { expect, test, type Page } from "@playwright/test";
import { assertPlaceholdersPresent, openHome, settle, settleNote, watchPage } from "./film-frames";

// The layers around the film (stage 8): the back-to-top button's text check, the page's scroll listeners and animation
// frame loops, the hero badge, the nav clicks, and the two hidden headings. Counts, computed styles and the order of
// events only; nothing here depends on how fast the machine is. Four tests, so the one-worker suite stays inside its
// time: what shares a page load shares a test.

test.beforeAll(() => assertPlaceholdersPresent());

const TOUCH = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } as const;

test.describe("the page's layers on a phone", () => {
  test.use(TOUCH);

  test("no text walk while scrolling, and few scroll listeners and frame loops at rest @chrome", async ({ page }) => {
    // Before any page script: count TreeWalkers (cornerText.ts measureChapterText creates one per chapter measured), the
    // window's live scroll listeners, and requestAnimationFrame requests.
    await page.addInitScript(() => {
      const w = window as unknown as { __chrome: { walkers: number; raf: number; scroll: Set<string> } };
      w.__chrome = { walkers: 0, raf: 0, scroll: new Set() };
      const create = Document.prototype.createTreeWalker;
      Document.prototype.createTreeWalker = function (this: Document, ...args: Parameters<Document["createTreeWalker"]>) {
        w.__chrome.walkers++;
        return create.apply(this, args);
      };
      // Live `scroll` listeners on the window, keyed by listener identity and capture flag.
      const ids = new WeakMap<object, number>();
      let next = 1;
      const key = (l: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions | EventListenerOptions) => {
        if (!ids.has(l)) ids.set(l, next++);
        const capture = typeof opts === "boolean" ? opts : !!opts?.capture;
        return `${ids.get(l)}:${capture}`;
      };
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
        if (this === window && type === "scroll" && l) w.__chrome.scroll.add(key(l, opts));
        return add.call(this, type, l, opts);
      } as typeof EventTarget.prototype.addEventListener;
      EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, opts?: boolean | EventListenerOptions) {
        if (this === window && type === "scroll" && l) w.__chrome.scroll.delete(key(l, opts));
        return remove.call(this, type, l, opts);
      } as typeof EventTarget.prototype.removeEventListener;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        w.__chrome.raf++;
        return raf(cb);
      };
    });
    await openHome(page);
    expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);

    // Every chapter's text is measured when the browser is idle (one TreeWalker each): wait until all are, and nothing
    // more is measured for a second (a font arriving late measures them again).
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForFunction(
      () => (window as unknown as { __chrome: { walkers: number } }).__chrome.walkers >= document.querySelectorAll("[data-compose]").length,
      undefined,
      { timeout: 30_000 },
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const w = window as unknown as { __chrome: { walkers: number } };
          let last = w.__chrome.walkers;
          const look = () => {
            if (w.__chrome.walkers === last) return resolve();
            last = w.__chrome.walkers;
            setTimeout(look, 1000);
          };
          setTimeout(look, 1000);
        }),
    );

    // At rest: a shared scroll subscription, not one listener per component (before stage 8: the film's, the nav's, the
    // button's and one per flow reveal, about a dozen), and no frame loop of its own beyond the page background's.
    const rest = await page.evaluate(
      () =>
        new Promise<{ listeners: number; requests: number; frames: number }>((resolve) => {
          const w = window as unknown as { __chrome: { raf: number; scroll: Set<string> } };
          const before = w.__chrome.raf;
          const start = performance.now();
          let frames = 0;
          const tick = () => {
            frames++;
            if (performance.now() - start < 1000) requestAnimationFrame(tick);
            else resolve({ listeners: w.__chrome.scroll.size, requests: w.__chrome.raf - before - frames, frames });
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(rest.listeners, "live window scroll listeners at rest").toBeLessThanOrEqual(3);
    // The counter's own loop is subtracted; at most one other loop may run (the page background's), never one per reveal.
    expect(rest.requests, `frame requests at rest beyond the counter's own (${rest.frames} frames)`).toBeLessThanOrEqual(rest.frames + 2);

    // A scroll through the whole page, one step per animation frame, crossing every chapter: no TreeWalker is created.
    const before = await page.evaluate(() => (window as unknown as { __chrome: { walkers: number } }).__chrome.walkers);
    const reached = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          let y = 0;
          const step = () => {
            y = Math.min(max, y + 400);
            window.scrollTo({ top: y, behavior: "instant" });
            if (y >= max) setTimeout(() => resolve(window.scrollY), 500);
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
    );
    expect(reached, "the scroll reached the end of the page").toBeGreaterThan(5000);
    const after = await page.evaluate(() => (window as unknown as { __chrome: { walkers: number } }).__chrome.walkers);
    expect(after - before, "TreeWalkers created during the scroll").toBe(0);
  });
});

test.describe("the hero badge", () => {
  test.use(TOUCH);

  /** What the badge and its dot compute now. */
  const read = (page: Page, untilEnded = false) =>
    page.evaluate(async (waitEnd) => {
      const badge = document.querySelector<HTMLElement>("[data-badge]")!;
      // The ping: the first child of the dot's wrapper (BeaconCaptions Intro).
      const dot = badge.querySelector<HTMLElement>("span.relative > span")!;
      const cs = getComputedStyle(badge);
      const ping = dot.getAnimations().find((a) => (a as CSSAnimation).animationName === "ping");
      const timing = ping?.effect?.getComputedTiming();
      return {
        look: badge.dataset.badge,
        filter: cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"),
        image: cs.backgroundImage,
        iterations: timing?.iterations ?? null,
        fill: timing?.fill ?? null,
        ended:
          waitEnd && ping
            ? await Promise.race([ping.finished.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 4500))])
            : null,
      };
    }, untilEnded);

  test("blur and ping: calm on touch screens and on desktop, ?badge=blur brings the old look back @chrome", async ({ page, browser, baseURL }) => {
    const watch = watchPage(page, baseURL ?? "http://127.0.0.1:3006");
    await openHome(page);
    const calm = await read(page, true);
    expect(calm.look, "touch default").toBe("calm");
    expect(calm.filter, "no backdrop blur on a touch screen").toMatch(/^(none|)$/);
    expect(calm.image, "the night wash over the amber tint").toContain("rgba(7, 11, 22, 0.45)");
    expect(calm.iterations, "the ping's cycles").toBe(3);
    expect(calm.fill).toBe("forwards");
    expect(calm.ended, "the ping stops after its three cycles").toBe(true);

    // The switch is read after mount: the markup the server sent and the first client render agree (no hydration error).
    await page.goto("/?badge=blur", { waitUntil: "load" });
    await page.locator("[data-badge]").waitFor({ state: "attached" });
    await page.waitForFunction(() => document.querySelector("[data-badge]")?.getAttribute("data-badge") === "blur");
    const old = await read(page);
    expect(old.filter, "the old look blurs").toContain("blur");
    expect(old.iterations, "the old ping never stops").toBe(Infinity);
    expect(watch.consoleErrors.filter((m) => /hydrat|did not match/i.test(m)), "hydration errors").toEqual([]);

    // Desktop (a fine pointer) keeps the blur and gets the same three cycles. The touch options are named: a context made
    // here takes every option of the describe's test.use(TOUCH) it does not set itself (Playwright fills in the missing
    // keys), and hasTouch alone would make the pointer coarse.
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      baseURL,
    });
    try {
      const d = await desktop.newPage();
      await openHome(d);
      const look = await read(d);
      expect(look.look).toBe("calm");
      expect(look.filter, "desktop keeps the blur").toContain("blur");
      expect(look.iterations).toBe(3);
    } finally {
      await desktop.close();
    }
  });
});

test.describe("nav clicks", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Clicks the nav's `#id` link on a freshly loaded `url` and returns how many scroll events the page fired for it. */
  async function scrollEventsAfterClick(page: Page, url: string, id: string): Promise<{ events: number; y: number; behavior: string }> {
    await page.goto(url, { waitUntil: "load" });
    await page.locator("canvas[data-segment]").waitFor({ state: "attached" });
    await page.evaluate(() => {
      const w = window as unknown as { __navScrolls: number };
      w.__navScrolls = 0;
      window.addEventListener("scroll", () => w.__navScrolls++, { passive: true });
    });
    await page.locator(`header a[href="#${id}"]:visible`).first().click();
    // Long enough for a smooth scroll to end (and for the hold on html's scroll-behavior to lapse).
    await page.waitForTimeout(2500);
    return page.evaluate(() => ({
      events: (window as unknown as { __navScrolls: number }).__navScrolls,
      y: window.scrollY,
      behavior: document.documentElement.style.scrollBehavior,
    }));
  }

  test("a target more than one chapter away is a jump, an adjacent one is smooth, ?nav=smooth is smooth everywhere @chrome", async ({ page }) => {
    // From the hero to Projects (four chapters on): a jump. A smooth scroll that far fires a scroll event on most frames.
    const far = await scrollEventsAfterClick(page, "/", "projects");
    expect(far.y, "the jump landed").toBeGreaterThan(1000);
    expect(far.events, "scroll events of a jump").toBeLessThanOrEqual(4);
    expect(far.behavior, "html's scroll-behavior is handed back").toBe("");

    // From the hero to About (the next chapter): smooth.
    const near = await scrollEventsAfterClick(page, "/", "about");
    expect(near.y).toBeGreaterThan(500);
    expect(near.events, "scroll events of a smooth scroll").toBeGreaterThanOrEqual(8);

    // The switch: the same far click, smooth.
    const smooth = await scrollEventsAfterClick(page, "/?nav=smooth", "projects");
    expect(smooth.events, "scroll events with ?nav=smooth").toBeGreaterThanOrEqual(8);
    expect(smooth.y).toBeGreaterThan(1000);
  });
});

test.describe("structure", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the exit and the bridge have a hidden h2, heading order holds, the portfolio pages cover the screen @chrome", async ({ page, browser, baseURL }) => {
    await openHome(page);
    expect(await settle(page), `the first frame settles${settleNote(page)}`).toBe(true);
    const doc = await page.evaluate(() => {
      const headings = [...document.querySelectorAll<HTMLElement>("h1,h2,h3")]
        .filter((h) => !h.closest("[aria-hidden='true']"))
        .map((h) => ({ level: Number(h.tagName[1]), id: h.id, text: (h.textContent ?? "").trim() }));
      const passage = (id: string) => {
        const s = document.getElementById(id);
        const h = document.getElementById(`${id}-title`);
        const box = h?.getBoundingClientRect();
        return {
          labelledby: s?.getAttribute("aria-labelledby") ?? null,
          label: s?.getAttribute("aria-label") ?? null,
          tag: h?.tagName ?? null,
          text: h?.textContent ?? null,
          within: !!h && !!s && s.contains(h),
          hidden: box ? box.width <= 1 && box.height <= 1 : null,
        };
      };
      return {
        headings,
        exit: passage("exit"),
        bridge: passage("bridge"),
        viewport: document.querySelector<HTMLMetaElement>("meta[name=viewport]")?.content ?? "",
      };
    });
    for (const [name, p, text] of [
      ["exit", doc.exit, "The reply leaves the rack"],
      ["bridge", doc.bridge, "Over the lake to the tower"],
    ] as const) {
      expect(p.tag, `${name}: a heading`).toBe("H2");
      expect(p.text, `${name}: its text`).toBe(text);
      expect(p.labelledby, `${name}: the section is named by it`).toBe(`${name}-title`);
      expect(p.label, `${name}: no aria-label next to it`).toBeNull();
      expect(p.within).toBe(true);
      expect(p.hidden, `${name}: visually hidden`).toBe(true);
    }
    // In reading order: the chapters' h2s, then the exit's, the bridge's and Contact's; one h1 first; no level skipped.
    const ids = doc.headings.map((h) => h.id);
    const at = (id: string) => ids.indexOf(id);
    expect(doc.headings[0].level, "the first heading is the h1").toBe(1);
    expect(doc.headings.filter((h) => h.level === 1)).toHaveLength(1);
    expect(at("projects-title")).toBeGreaterThan(-1);
    expect(at("exit-title")).toBeGreaterThan(at("projects-title"));
    expect(at("bridge-title")).toBeGreaterThan(at("exit-title"));
    if (at("contact-title") > -1) expect(at("contact-title")).toBeGreaterThan(at("bridge-title"));
    let prev = 0;
    for (const h of doc.headings) {
      expect(h.level, `heading "${h.text}" (h${h.level}) after an h${prev}`).toBeLessThanOrEqual(prev + 1);
      prev = h.level;
    }
    expect(doc.viewport, "the home page's viewport").toContain("viewport-fit=cover");

    // A project page is a portfolio page too.
    await page.goto("/projects/soltani-org", { waitUntil: "load" });
    const meta = await page.locator("meta[name=viewport]").getAttribute("content");
    expect(meta, "a project page's viewport").toContain("viewport-fit=cover");

    // A notched phone in landscape (852x393 with the insets an iPhone Pro reports there: 59 px left and right, 21 px at the
    // bottom; Chromium's safe-area override). With viewport-fit=cover the canvas runs under the notch at full width, so the
    // compositions, the hero's stage and its poster must be exactly as wide (the frame variables, frameBox.ts, are built on
    // the composition's width, and the poster must match the canvas's crop), and the insets belong to the text's padding:
    // no visible text inside them. Every option is named: the context would otherwise take the describe's viewport.
    const phone = await browser.newContext({
      viewport: { width: 852, height: 393 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 3,
      baseURL,
    });
    try {
      const p = await phone.newPage();
      const cdp = await phone.newCDPSession(p);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: 59, right: 59, bottom: 21 } });
      await openHome(p);
      await p.evaluate(() => document.fonts.ready.then(() => undefined));
      const notch = await p.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.cssText =
          "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:0 env(safe-area-inset-right,0px) 0 env(safe-area-inset-left,0px)";
        document.body.append(probe);
        const cs = getComputedStyle(probe);
        const inset = { left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight) };
        probe.remove();
        const box = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, width: r.width };
        };
        const canvas = box(document.querySelector("canvas[data-segment]"))!;
        const poster = document.querySelector<HTMLElement>('section[data-film-segment][data-index="0"] img');
        const W = window.innerWidth;
        // Visible text inside the insets (the plates are painted onto the film and aria-hidden; sr-only text is 1x1).
        const intrusions: string[] = [];
        const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? "").trim();
          const el = n.parentElement;
          if (!text || !el || el.closest('[aria-hidden="true"],[data-perspective-plate],.sr-only')) continue;
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width <= 1 || r.height <= 1) continue;
            if (r.left < inset.left - 0.5 || r.right > W - inset.right + 0.5)
              intrusions.push(`"${text.slice(0, 40)}" x ${Math.round(r.left)}..${Math.round(r.right)}`);
          }
        }
        return {
          inset,
          width: W,
          canvas,
          compositions: [...document.querySelectorAll("[data-compose]")].map(box).filter((b): b is { left: number; width: number } => !!b && b.width > 0),
          stage: box(poster?.closest(".sticky") ?? null),
          poster: box(poster),
          intrusions: intrusions.slice(0, 12),
        };
      });
      expect(notch.inset, "the safe-area override took effect").toEqual({ left: 59, right: 59 });
      expect(Math.abs(notch.canvas.width - notch.width), "the canvas covers the width, notch included").toBeLessThanOrEqual(0.5);
      expect(notch.compositions.length, "compositions laid out").toBeGreaterThan(0);
      for (const c of notch.compositions) {
        expect(Math.abs(c.width - notch.canvas.width), "a composition is as wide as the canvas").toBeLessThanOrEqual(0.5);
        expect(Math.abs(c.left - notch.canvas.left), "and starts where it starts").toBeLessThanOrEqual(0.5);
      }
      for (const [name, b] of [["the hero's stage", notch.stage], ["the hero poster", notch.poster]] as const) {
        expect(b, name).not.toBeNull();
        expect(Math.abs(b!.width - notch.canvas.width), `${name} is as wide as the canvas`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(b!.left - notch.canvas.left), `${name} starts where the canvas starts`).toBeLessThanOrEqual(0.5);
      }
      expect(notch.intrusions, "visible text inside the safe-area insets").toEqual([]);
    } finally {
      await phone.close();
    }
  });
});

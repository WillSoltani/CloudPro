import { expect, test } from "@playwright/test";
import { assertPlaceholdersPresent, PLACEHOLDER_RUN, readPaintedFrame } from "./film-frames";

// The scaffold, end to end: the production build serves the home page, the film canvas paints, nothing the
// page or the film base serves answers an error, and the console stays clean. The film specs that judge
// loading and scrubbing build on this (see docs/film-lab-gate.md).

test.beforeAll(() => assertPlaceholdersPresent());

test("home page paints the film without errors @smoke", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  const origin = new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:3006").origin;
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    const url = new URL(res.url());
    // The page itself and everything under /films (the placeholder frames, posters); the hold keys under
    // /images/reel are committed stills, checked here as well.
    const mine = url.origin === origin && (url.pathname === "/" || url.pathname.startsWith("/films/") || url.pathname.startsWith("/images/reel/"));
    if (mine && res.status() >= 400) failed.push(`${res.status()} ${url.pathname}`);
  });

  const response = await page.goto("/", { waitUntil: "load" });
  expect(response?.status()).toBe(200);

  const canvas = page.locator("canvas[data-segment]");
  await expect(canvas).toHaveAttribute("data-frame", /^\d+$/);
  await expect(canvas).toHaveAttribute("data-segment", "rack-00");

  if (PLACEHOLDER_RUN) {
    // The pixels name the frame the hook names: the placeholder row reads back from the canvas.
    await expect
      .poll(async () => {
        const painted = await readPaintedFrame(page);
        return painted?.pixels ? `${painted.pixels.film}:${painted.pixels.index}` : null;
      })
      .not.toBeNull();
    const painted = await readPaintedFrame(page);
    expect(painted?.pixels?.film).toBe(painted?.hook.segment);
  }

  // A scroll moves the film on: a later frame, still readable from the pixels.
  const first = Number(await canvas.getAttribute("data-frame"));
  await page.mouse.move(400, 400);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(60);
  }
  await expect.poll(async () => Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(first);
  if (PLACEHOLDER_RUN) {
    await expect
      .poll(async () => {
        const painted = await readPaintedFrame(page);
        return painted?.pixels && painted.pixels.film === painted.hook.segment && painted.pixels.index === painted.hook.frame;
      })
      .toBe(true);
  }

  expect(failed, "requests that answered 4xx or 5xx").toEqual([]);
  expect(consoleErrors, "console errors").toEqual([]);
});

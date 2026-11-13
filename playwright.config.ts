import { defineConfig, devices } from "@playwright/test";

// The film gate: Playwright specs for the home page's scroll film (e2e/film-*.spec.ts), run against a
// production build (`next build` + `next start`, never `next dev`) on loopback. The specs never touch the
// live site.
//
// Frames. By default the build is made with NEXT_PUBLIC_FILM_BASE=/films, so every film frame and poster
// is served from public/films, where `npm run film:placeholder` has put tiny stand-in frames that carry
// their own index in their pixels (scripts/films/placeholder.mjs). FILM_FRAMES=cdn builds without it: the
// page then loads the real frames from the film CDN named in the manifests (a locally served page may do
// that; it is how the site works), for a run that needs real footage.
//
// The server has its own build directory (.next-film, or .next-film-cdn for FILM_FRAMES=cdn), so it never disturbs a `.next` from `next dev`
// or `npm run build`. Locally an already running server on the port is reused: it is whatever it was
// built as, so stop it when you switch between FILM_FRAMES modes or change the source.
//
// Safari: PW_WEBKIT=1 adds the webkit project (npm run test:film:safari). CI installs chromium only.
const PORT = Number(process.env.FILM_PORT ?? 3006);
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const REAL_FRAMES = process.env.FILM_FRAMES === "cdn";
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PW_WEBKIT === "1" ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }] : []),
  ],
  webServer: {
    command: `npx next build && npx next start --hostname ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    // The command builds first.
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_DIST_DIR: REAL_FRAMES ? ".next-film-cdn" : ".next-film",
      // Inlined at build time (components/film/filmBase.ts). Empty = the manifests' own CDN base.
      NEXT_PUBLIC_FILM_BASE: REAL_FRAMES ? "" : "/films",
      NEXT_TELEMETRY_DISABLED: "1",
      // The same non-secret placeholders .github/workflows/ci.yml builds with.
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "ci-user-pool",
      SECURE_DOC_TABLE: "ci-table",
    },
  },
});

/**
 * Where the budget loader (./budget.ts) decodes on this page load. FilmBackdrop asks once, in its effect; these
 * helpers are pure so the rule is unit-tested (budget.test.ts).
 *
 * - "budget": decoding in the film worker (./frame-worker.js), falling back to main-thread decodes on its own if the
 *   worker cannot run.
 * - "budget-main": decoding on the main thread from the start (pages without Worker). Where the page lacks fetch, Blob
 *   or createImageBitmap the loader is stopped from the start (mode "stopped"): no frame is requested.
 */

export type LoaderName = "budget" | "budget-main";

/** What the page offers that the budget loader needs. */
export type LoaderCaps = { fetch: boolean; blob: boolean; createImageBitmap: boolean; worker: boolean };

/**
 * The film worker runs where the page has Worker, fetch, Blob and createImageBitmap; anywhere else the loader is built
 * on the main thread (which stops it at once where fetch, Blob or createImageBitmap is missing), so no worker starts.
 */
export function runnableLoader(caps: LoaderCaps): LoaderName {
  return caps.worker && caps.fetch && caps.blob && caps.createImageBitmap ? "budget" : "budget-main";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * LAB ONLY: `?packorigin=http://127.0.0.1:<port>` makes the page read its packs from a local server (same path, other
 * origin) while the frames stay where the manifest puts them. It exists to measure packs that are built but not yet
 * uploaded (docs/film-lab-gate.md, "Packs: local origin"). It is honoured only when the page itself is on localhost or
 * 127.0.0.1 and the origin is a plain http localhost or 127.0.0.1 origin, so no page on a real host can be pointed at
 * another origin with it. Returns the origin, or null (absent, or refused).
 */
export function packOriginFromQuery(search: string, pageHostname: string): string | null {
  if (!LOCAL_HOSTS.has(pageHostname)) return null;
  const v = new URLSearchParams(search).get("packorigin");
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" || !LOCAL_HOSTS.has(u.hostname) || u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** `url` (absolute) with its origin replaced by `origin`: the same path and query on another server. */
export function rehostUrl(url: string, origin: string): string {
  try {
    const u = new URL(url);
    return `${origin}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** The page's capabilities (client only). */
export function pageCaps(): LoaderCaps {
  return {
    fetch: typeof fetch === "function",
    blob: typeof Blob === "function",
    createImageBitmap: typeof createImageBitmap === "function",
    worker: typeof Worker === "function",
  };
}

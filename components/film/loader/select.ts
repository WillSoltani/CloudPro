/**
 * Which frame loader a page load runs. FilmBackdrop holds the default (one constant, `DEFAULT_LOADER` there) and reads
 * `?loader=` once, in its effect; these helpers are pure so the rule is unit-tested (budget.test.ts).
 *
 * - "legacy": ./legacy.ts.
 * - "budget": ./budget.ts, decoding in the film worker (./frame-worker.js), falling back to main-thread decodes on its
 *   own if the worker cannot run.
 * - "budget-main": the budget loader decoding on the main thread from the start (the lab, and pages without Worker).
 */

export type LoaderName = "legacy" | "budget" | "budget-main";

/** What the page offers that the budget loader needs. */
export type LoaderCaps = { fetch: boolean; blob: boolean; createImageBitmap: boolean; worker: boolean };

/** The loader `?loader=` asks for, or `fallback` when the flag is absent or names no loader. */
export function loaderFromQuery(search: string, fallback: LoaderName): LoaderName {
  const v = new URLSearchParams(search).get("loader");
  return v === "legacy" || v === "budget" || v === "budget-main" ? v : fallback;
}

/**
 * The loader that can run here for the one asked for: the budget loader needs fetch, Blob and createImageBitmap on the
 * page (its main-thread decodes are its fallback), else the legacy loader runs; without Worker it decodes on the main
 * thread from the start.
 */
export function runnableLoader(wanted: LoaderName, caps: LoaderCaps): LoaderName {
  if (wanted === "legacy") return "legacy";
  if (!caps.fetch || !caps.blob || !caps.createImageBitmap) return "legacy";
  return wanted === "budget" && caps.worker ? "budget" : "budget-main";
}

/**
 * Film packs (stage 7) for this page load: on unless the URL says `?pack=0` (every film then loads one file per frame,
 * the per-frame path of the budget loader, unchanged). Read once, in FilmBackdrop's effect.
 */
export function packsFromQuery(search: string): boolean {
  return new URLSearchParams(search).get("pack") !== "0";
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

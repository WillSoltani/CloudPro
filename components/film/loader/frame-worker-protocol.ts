/**
 * Messages between the budget loader (./budget.ts) and the frame store it talks to: the store runs in a worker
 * (./frame-worker.js) or, as the fallback, on the page (its createFrameStore used directly). Structured-clone data only;
 * decoded frames travel as transferred ImageBitmaps.
 *
 * The page decides what to fetch and decode and when (./budget-plan.ts); the store fetches a frame's compressed bytes,
 * keeps them under the key the page gave, decodes them on request, and lets them go when the page says so. Keys are
 * unique for the page load (the planner's segment epoch and the frame), so bytes that land for a segment that has left
 * or changed tier never mix with the bytes of its next life.
 */

export type ToWorker =
  /** First message: how many fetches and decodes may run at once (the page sends no more than that). */
  | { t: "init"; maxFetches: number; maxDecodes: number }
  /** New limits (the network turned out slow). */
  | { t: "limits"; maxFetches: number; maxDecodes: number }
  /** Fetch a frame's bytes (CORS, no credentials) and keep them under `key`. Answered `fetched`. */
  | { t: "fetch"; id: number; key: string; url: string }
  /** Decode the bytes kept under `key` with createImageBitmap. Answered `decoded`. */
  | { t: "decode"; id: number; key: string }
  /** Let these bytes go. Answered `held`. */
  | { t: "drop"; keys: string[] }
  /**
   * Forget these jobs if they have not started yet (each is answered as cancelled); a fetch or decode already running
   * finishes and is answered as usual.
   */
  | { t: "cancel"; ids: number[] }
  /** Let go of everything; nothing is answered afterwards. */
  | { t: "dispose" };

export type FromWorker =
  /** Reply to init: false when the store lacks fetch, Blob or createImageBitmap (the page then decodes itself). */
  | { t: "ready"; ok: boolean; missing?: string }
  /** A frame's bytes are kept: `size` bytes, fetched in `ms` (request start to the last byte); `held` in all. */
  | { t: "fetched"; id: number; ok: true; size: number; ms: number; held: number }
  /**
   * A fetch produced nothing: `retryable` for a network error or a 408/429/5xx answer, false for any other answer
   * (a 404: the frame does not exist); `cancelled` when it never started.
   */
  | { t: "fetched"; id: number; ok: false; retryable: boolean; status?: number; cancelled?: boolean }
  /** A decoded frame (the bitmap is transferred) and the time the decode took. */
  | { t: "decoded"; id: number; ok: true; bitmap: ImageBitmap; ms: number }
  /** No frame: the bytes were not held (`missing`), would not decode (`error`), or the job never started (`cancelled`). */
  | { t: "decoded"; id: number; ok: false; reason: "missing" | "error" | "cancelled" }
  /** Compressed bytes held now, after a drop. */
  | { t: "held"; held: number };

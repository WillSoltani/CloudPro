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
  /**
   * Read pack `url` (stage 7, ./pack-format.mjs) from byte `from` up to byte `to` (exclusive), or up to where the pack's
   * own header says (`to` < 0: PACK_TO_SKELETON, PACK_TO_HOLD = the end of its first `hold` slots, PACK_TO_END) while
   * the page does not know the header yet. The store starts at the first byte it does not hold (a plain GET without a
   * Range header from byte 0 to the end of the file, else a Range request), stops before the next byte it holds, cuts every frame out as its
   * bytes arrive and keeps it under `prefix + frame` like a fetched frame. A read that ends before the end of the file
   * asks for a closed range (`bytes=n-m`; before the header is known, up to `est`, the page's estimate from the
   * manifest's hints; none: open-ended). Answered `pack-header` (once per store and
   * pack), `pack-frames` (per chunk that completed frames) and one `pack-done`. `type`: the frames' MIME type, given to
   * their Blobs.
   */
  | { t: "pack"; id: number; url: string; prefix: string; from: number; to: number; hold: number; est?: number; type?: string }
  /** A pack read's end moves (`to` as in `pack`); a read already past it stops (answered `pack-done`, ok). */
  | { t: "pack-to"; id: number; to: number }
  /** Stop a pack read where it is (abort); answered `pack-done` with `cancelled`. Its bytes so far stay. */
  | { t: "pack-stop"; id: number }
  /** The page gave pack `url` up (it loads that film frame by frame): its partial bytes and header go. */
  | { t: "pack-forget"; url: string }
  /** Let go of everything; nothing is answered afterwards. */
  | { t: "dispose" };

/** `to` of a pack read while the page does not know the header: the skeleton end, the hold frames' end, the file's end. */
export const PACK_TO_SKELETON = -1;
export const PACK_TO_HOLD = -2;
export const PACK_TO_END = -3;

/** Why a pack read ended without reaching its end. */
export type PackFailure =
  /** Worth another try: a network error, a 408/429/5xx answer, a body that ended early. */
  | "retry"
  /**
   * The pack cannot be read here: a 403 (the film CDN, for a pack it does not hold), 404, 410, 416 or another final
   * status, a header that fails its check, a 206 whose Content-Range (or, unreadable, its byte count) disagrees with the
   * range asked for, a body that cannot be streamed.
   */
  | "final";

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
  | { t: "held"; held: number }
  /**
   * The pack's own header, parsed from the bytes of read `id`: frame count, header length, skeleton end, total bytes,
   * and per file slot the frame index and the byte offset.
   */
  | {
      t: "pack-header";
      id: number;
      count: number;
      header: number;
      skeletonEnd: number;
      bytes: number;
      slotFrame: Int32Array;
      slotOffset: Uint32Array;
    }
  /**
   * Frames read `id` completed with this chunk (each now kept under `prefix + frame`, `sizes[k]` bytes): `pos` is the
   * byte the read has reached, `got` the body bytes since the previous message of this read, `repeated` how many of
   * them were held already (read twice), `ms` the time since the request started, `held` the store's bytes in all.
   */
  | {
      t: "pack-frames";
      id: number;
      frames: number[];
      sizes: number[];
      pos: number;
      got: number;
      repeated: number;
      ms: number;
      held: number;
    }
  /**
   * Read `id` ended: `ok` when it reached its end; `cancelled` when the page stopped it; else `failure` (and `status`
   * when the server answered, `reason` for the record). `rangeless`: the server answered a Range request with the whole
   * file (200), so later reads of this pack start at byte 0. `got` / `repeated` as in `pack-frames`.
   */
  | {
      t: "pack-done";
      id: number;
      ok: boolean;
      cancelled?: boolean;
      failure?: PackFailure;
      status?: number;
      reason?: string;
      rangeless?: boolean;
      pos: number;
      got: number;
      repeated: number;
      held: number;
    };

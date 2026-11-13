/**
 * Byte arithmetic of the budget loader (components/film/loader/budget-plan.ts): how many decoded bytes this device may
 * hold, what one frame costs at a tier, how many frames that is, and how many compressed bytes may be kept. Pure: no
 * DOM except `pickFrameBudgetBytes`'s defaults, which read `window` and `navigator` only when no device is passed.
 *
 * Ported from the memory-palace sister project (components/film/frame-cache.ts: `pickFrameBudgetBytes`, `capacity`,
 * HEADROOM; pack-client.ts: the compressed caps), unchanged in their figures. MB here is 2^20 bytes, as there.
 */

export const MB = 1024 * 1024;

/** The wanted set may use this share of the budget; the rest is room for frames held outside it (evicted first). */
export const HEADROOM = 0.8;

/** Budgets below this are "small" (phones): fewer decodes at once, the smaller compressed-byte cap. */
export const SMALL_BUDGET = 256 * MB;

/** Compressed frame bytes kept, at most: small devices / everything else (sister pack-client.ts PACK_CAP_*). */
export const BYTES_CAP_SMALL = 48 * MB;
export const BYTES_CAP_LARGE = 160 * MB;

/** Decodes at once: small budget / otherwise. */
export const DECODES_SMALL = 2;
export const DECODES_LARGE = 3;

/** What `pickFrameBudgetBytes` reads of the device (navigator.deviceMemory in GB, Chromium only, capped at 8). */
export type BudgetDevice = { deviceMemory?: number; innerWidth: number; innerHeight: number };

/**
 * Decoded-frame budget for this device, in bytes. With navigator.deviceMemory: min(512, max(96, memory × 48)) MB.
 * Without it (Safari, Firefox): 160 MB when the window is narrower than 1024 px or portrait (phones, tablets), else
 * 384 MB. Without a device and without `window` (server, tests): 160 MB.
 */
export function pickFrameBudgetBytes(device?: BudgetDevice): number {
  let d = device;
  if (!d) {
    if (typeof window === "undefined") return 160 * MB;
    d = {
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  }
  const mem = d.deviceMemory;
  if (typeof mem === "number" && mem > 0) return Math.min(512, Math.max(96, mem * 48)) * MB;
  const small = d.innerWidth < 1024 || d.innerHeight > d.innerWidth;
  return (small ? 160 : 384) * MB;
}

/**
 * The lab override `?budget=<MB>` (read once, when the loader starts): a positive number of MB, at least 8 and at most
 * 4096, forces the budget so a desktop browser can run with the phone's figure. Null when absent or not a number.
 */
export function budgetOverrideBytes(search: string): number | null {
  const raw = new URLSearchParams(search).get("budget");
  if (raw === null || raw.trim() === "") return null;
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return Math.round(Math.min(4096, Math.max(8, mb)) * MB);
}

/** The budget is a phone's (fewer decodes at once, the small compressed cap). */
export function smallBudget(budgetBytes: number): boolean {
  return budgetBytes < SMALL_BUDGET;
}

/** Decoded size of one frame of `width` × `height` px (RGBA). */
export function decodedBytes(width: number, height: number): number {
  return width * height * 4;
}

/**
 * Decoded size of one frame of a film of aspect `aspect` (width / height) at tier `width`: the frame is
 * width × round(width / aspect) px, the same estimate as filmStats `frameBytes`.
 */
export function tierFrameBytes(width: number, aspect: number): number {
  return decodedBytes(width, Math.round(width / aspect));
}

/** The decoded bytes the wanted set may use: HEADROOM of the budget. */
export function wantedBytesOf(budgetBytes: number): number {
  return Math.floor(budgetBytes * HEADROOM);
}

/** Frames of `frameBytes` that fit in the budget, and how many of them the wanted set may hold (at least 1). */
export function framesPerBudget(budgetBytes: number, frameBytes: number): { frames: number; wanted: number } {
  const frames = Math.floor(budgetBytes / frameBytes);
  return { frames, wanted: Math.max(1, Math.floor((budgetBytes * HEADROOM) / frameBytes)) };
}

/** Compressed bytes the loader may keep for this budget: 48 MB on a small budget, else 160 MB. */
export function bytesCapFor(budgetBytes: number): number {
  return smallBudget(budgetBytes) ? BYTES_CAP_SMALL : BYTES_CAP_LARGE;
}

/** Decodes at once for this budget: 2 on a small budget, else 3. */
export function maxDecodesFor(budgetBytes: number): number {
  return smallBudget(budgetBytes) ? DECODES_SMALL : DECODES_LARGE;
}

/**
 * The order in which segments give up their compressed bytes when the cap is passed: farthest from `active` first;
 * at the same distance the one behind the direction of travel first (at rest: the one above, the reel being read
 * downwards). `active` itself is never in the result. Writes into `out` and returns how many it wrote (no allocation).
 */
export function bytesDropOrder(indices: ArrayLike<number>, active: number, direction: number, out: Int32Array): number {
  let n = 0;
  for (let k = 0; k < indices.length; k++) if (indices[k] !== active) out[n++] = indices[k];
  const behindSign = direction < 0 ? 1 : -1; // moving up, the segments below are behind
  // Insertion sort: a reel has a handful of segments.
  for (let a = 1; a < n; a++) {
    const v = out[a];
    let b = a - 1;
    while (b >= 0 && dropsBefore(v, out[b], active, behindSign)) {
      out[b + 1] = out[b];
      b--;
    }
    out[b + 1] = v;
  }
  return n;
}

function dropsBefore(x: number, y: number, active: number, behindSign: number): boolean {
  const dx = Math.abs(x - active);
  const dy = Math.abs(y - active);
  if (dx !== dy) return dx > dy;
  return Math.sign(x - active) === behindSign && Math.sign(y - active) !== behindSign;
}

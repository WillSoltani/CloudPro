// Types of ./frame-worker.js (plain JavaScript on purpose: the browser loads that file as it is, see its header).
import type { FromWorker, ToWorker } from "./frame-worker-protocol";

/** The part of a fetch Response the store reads. */
export type ResponseLike = { ok: boolean; status: number; blob(): Promise<Blob> };
export type FetchLike = (url: string, init: RequestInit) => Promise<ResponseLike>;
/** The part of an ImageBitmap the loader uses (tests pass fakes). */
export type BitmapLike = { readonly width: number; readonly height: number; close(): void };

export type StoreDeps = {
  fetch?: FetchLike;
  createImageBitmap?: (blob: Blob) => Promise<BitmapLike>;
  now: () => number;
  /** An answer to the page; `transfer` holds the decoded bitmap (ignored on the page). */
  emit: (m: FromWorker, transfer?: Transferable[]) => void;
};

export type FrameStore = {
  /** Compressed bytes held now. */
  readonly held: number;
  handle(m: ToWorker): void;
};

/** A 408, a 429 and any 5xx are worth another try; any other failed answer is final. */
export function retryableStatus(status: number): boolean;

/** The frame store: in the worker, or on the page as the main-thread fallback. */
export function createFrameStore(deps: StoreDeps): FrameStore;

// Types of ./pack-format.mjs (plain JavaScript on purpose: Node scripts, the page and the film worker load that one
// file, see its header).

export declare const PACK_MAGIC: "CFPK";
export declare const PACK_LAYOUT_VERSION: 1;
export declare const PACK_FIXED_BYTES: 24;
export declare const PACK_ENTRY_BYTES: 12;
export declare const SKELETON_STRIDE: 4;
export declare const PACK_MAX_FRAMES: number;
export declare const PACK_FILE_PATTERN: RegExp;

/** File order and the size (in frames) of each section. */
export type PackOrder = {
  order: number[];
  /** The move's end actually used (clamped to the film). */
  moveEnd: number;
  hold: number;
  skeleton: number;
  rest: number;
  tail: number;
};

export declare function packOrder(count: number, moveEnd: number): PackOrder;

/** A byte range [start, end). */
export type ByteRange = [number, number];

export type BuiltPack = {
  data: Uint8Array;
  /** Length of the whole file. */
  bytes: number;
  /** Length of the fixed part plus the table: where frame bytes start. */
  header: number;
  skeletonEnd: number;
  order: number[];
  moveEnd: number;
  parts: { fixed: ByteRange; table: ByteRange; hold: ByteRange; skeleton: ByteRange; rest: ByteRange; tail: ByteRange };
  counts: { hold: number; skeleton: number; rest: number; tail: number };
};

export declare function buildPack(frames: readonly Uint8Array[], moveEnd: number): BuiltPack;

export type PackFixed = { version: number; count: number; header: number; skeletonEnd: number; bytes: number };
export type PackSlot = { index: number; offset: number; length: number };
export type PackHeader = PackFixed & {
  /** Frames in file order. */
  slots: PackSlot[];
  /** Frame index → slot (-1 when the table has no such frame). */
  slotOf: Int32Array;
};
export type PackError = { error: string };

export declare function readPackFixed(bytes: Uint8Array): PackFixed | PackError | null;
export declare function parsePackHeader(bytes: Uint8Array): PackHeader | PackError | null;
export declare function frameEnd(h: PackHeader, index: number): number;

/** What a manifest records about a pack (FilmManifest `packs[width]`); hints only. */
export type PackHint = { file?: string; bytes?: number; header?: number; skeletonEnd?: number };
export declare function packHintProblem(h: PackHeader, hint: PackHint | null | undefined): string | null;

export type PackWriteResult = {
  /** Frame indices that became complete with this write. */
  completed: number[];
  /** Set when the pack turned out unusable (bad header); the store stays failed. */
  error?: string;
};

export declare class PackBytes {
  header: PackHeader | null;
  error: string | null;
  heldBytes: number;
  repeatedBytes: number;
  gapBytes: number;
  readonly headerFilled: number;
  slotFilled(slot: number): number;
  held(index: number): boolean;
  frame(index: number): Uint8Array | null;
  heldFrames(): number[];
  write(pos: number, chunk: Uint8Array): PackWriteResult;
  firstMissing(from?: number, to?: number): number;
  nextHeld(from: number, to: number): number;
  dropFrame(index: number): number;
  /** Hand a complete frame's bytes over and free them here; the frame stays counted as held. Null when not complete. */
  release(index: number): Uint8Array | null;
  dropSlot(slot: number): number;
}

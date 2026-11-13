import type { FilmManifest } from "@/components/film/filmCore";

/**
 * The seam between the film engine (components/film/FilmBackdrop.tsx) and the code that decides which frames exist in
 * memory. FilmBackdrop owns the clock, the draw call, the hold keys, the chrome and the registration; a FrameLoader
 * owns the requests, the decoded frames and their eviction. FilmBackdrop picks one loader per page load
 * (`createLegacyLoader` in ./legacy.ts today) and talks to it only through this interface, so another loader can be
 * dropped in without touching the clock, the hold keys, the breathing tails, the overlays or the choreography.
 *
 * A loader knows nothing of the page beyond Image, performance and navigator.connection (passed in `LoaderEnv`):
 * the canvas, the data attributes and `window.__filmStats` are written by FilmBackdrop, through the callbacks below.
 */

/** How a segment's frames are used on this page load, fixed while the segment is joined. */
export type JoinOptions = {
  /** M: the move's last frame (the hold pose); the film's last frame unless breathing-tail frames follow it. */
  moveEnd: number;
  /** T: the breathing-tail frames this page load plays after M (0: none, or reduced motion / Save-Data). */
  tailFrames: number;
  /** Only the even tail frames are ever shown (coarse pointers). */
  evenTailOnly: boolean;
  /** Under reduced motion: the only frames ever shown (0 … M, in step order); null otherwise. */
  reducedStills: readonly number[] | null;
  /** The widest gap the canvas tolerates between the painted frame and the target while something covers it. */
  tolerance: number;
};

/** What the clock wants now, handed to the loader on every clock tick. */
export type WantPlan = {
  /** The segment the clock is in. */
  active: number;
  /** Its target frame (the frame the canvas should show). */
  frame: number;
  /** Direction of travel of the raw clock: 1 down the page, −1 up, 0 at rest. */
  direction: number;
  /**
   * For a segment other than `active`: the frame the scroll will enter it from (0 for a segment ahead; for one behind,
   * its last frame, or M without tail frames).
   */
  entry: (index: number) => number;
};

/** A decoded frame for draw(): the nearest one held to the frame asked for. */
export type HeldFrame = {
  frame: number;
  image: CanvasImageSource;
  /** The image's own pixel size (for the cover fit). */
  width: number;
  height: number;
};

/**
 * The loader's counters, reported to FilmBackdrop (which keeps `window.__filmStats`, components/film/filmStats.ts)
 * instead of written into the page's stats object, so every loader reports the same way.
 */
export type LoaderStats = {
  /** A request started for `film` at tier `width`, frame `frame`; `inflight` is the number in flight after it. */
  requested(film: string, width: number, frame: number, inflight: number): void;
  /** A request's slot was freed (settled, or cancelled); `inflight` is the number in flight after it. */
  released(inflight: number): void;
  /** A frame finished decoding and is now held; `bytes` is its estimated decoded size (filmStats frameBytes). */
  decoded(bytes: number): void;
  /** A held frame was let go (evicted, retiered, its segment left or the loader disposed). */
  dropped(bytes: number): void;
  /** A live request failed to load or decode (a cancelled one is not reported). */
  failed(): void;
};

export type ImageLike = {
  decoding: string;
  crossOrigin: string | null;
  src: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  decode(): Promise<void>;
};

export type LoaderEnv = {
  stats: LoaderStats;
  /** navigator.connection, where the browser has one (Save-Data, the network class). */
  connection?: { saveData?: boolean; effectiveType?: string; rtt?: number; downlink?: number };
  /** The visitor has already engaged when the loader starts (reduced motion, a boot key, a restored scroll position). */
  engaged: boolean;
  /**
   * The frame tier a segment's film would get now (FilmBackdrop's tier(), from the canvas box, the DPR and the network
   * class). The legacy loader asks it at a segment boundary on a slow network, for the segments not yet started.
   */
  tier(film: FilmManifest): number;
  /** A segment's count of decoded frames changed (FilmBackdrop writes it to the section's `data-loaded`). */
  onLoaded?(index: number, loaded: number): void;
  /** Injected for tests; default: the browser's Image and performance. */
  Image?: new () => ImageLike;
  timing?: { getEntriesByName(name: string): readonly { duration: number }[] };
};

export interface FrameLoader {
  /** The loader's name, `window.__filmStats.mode`. */
  readonly mode: string;
  /** Segment `index` joins with its film at tier `width` (FilmBackdrop's tier()). */
  join(index: number, film: FilmManifest, width: number, opts: JoinOptions): void;
  /** Segment `index` leaves: its frames are let go and its requests cancelled. */
  leave(index: number): void;
  /** One IntersectionObserver callback's changes: which segments are within reach of the viewport now. */
  setNear(changes: ReadonlyArray<readonly [index: number, near: boolean]>): void;
  /** The visitor has scrolled (or arrived on a hash or a restored position): lift the idle gate. Idempotent. */
  engage(): void;
  /** Forget the active segment, so the next want() plans every segment again (the registry changed). */
  rerank(): void;
  /** Called on every clock tick. */
  want(plan: WantPlan): void;
  /** What draw() paints for `frame` of segment `index`: the nearest decoded frame (lower first on a tie), or null. */
  nearest(index: number, frame: number): HeldFrame | null;
  /** A frame within `tolerance` of `frame` may still arrive (queued or in flight), so it is worth waiting for. */
  isComing(index: number, frame: number, tolerance: number): boolean;
  /** The frames this page load ever shows for segment `index`; the one rule shared by loading and by the counters. */
  usable(index: number, frame: number): boolean;
  /** Decoded frames held for segment `index` (0 when it has not joined). */
  loaded(index: number): number;
  /** Frame tier width of segment `index` (0 when it has not joined). */
  width(index: number): number;
  /** A frame finished decoding (FilmBackdrop schedules a paint when it is the target segment). Returns the unsubscribe. */
  onArrive(cb: (index: number, frame: number) => void): () => void;
  /** The network is slow (by navigator.connection, or by the timed first hero frames): the smallest tier, fewer requests. */
  isSlow(): boolean;
  /** Let go of everything; nothing is requested afterwards. */
  dispose(): void;
}

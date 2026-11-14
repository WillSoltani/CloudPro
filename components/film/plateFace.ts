// The pure parts of the plates and the anchors (PerspectivePlate, RideAnchor): which track row a painted frame shows,
// where a flight is, when a flight must look at the page, writing only what changed, and the layer hint while a plate
// moves. No React and no DOM (the writer takes anything with `style` and `dataset`), so node runs the tests
// (plateFace.test.ts).

/** A plate track's row for a painted film frame: row per frame when the track is at least as long, else proportional. */
export function trackRow(frame: number, trackCount: number, filmCount: number): number {
  return trackCount >= filmCount || filmCount < 2
    ? Math.min(frame, trackCount - 1)
    : Math.round((frame * (trackCount - 1)) / (filmCount - 1));
}

/** The film frame of a track row (the hand-off's lift), the inverse of trackRow(). −1 stays −1. */
export function liftFrameOf(liftRow: number, trackCount: number, filmCount: number): number {
  return liftRow < 0 || trackCount >= filmCount || trackCount < 2
    ? liftRow
    : Math.round((liftRow * (filmCount - 1)) / (trackCount - 1));
}

/**
 * Whether the composition can have left its pin: only once the raw frame has reached the move's end M (the sticky box
 * releases after the read pin, past camera rest, and the stacked lift runs during the pin). Before that the release
 * guard reads nothing. Without a raw frame or an end it always looks.
 */
export function mayBeReleased(raw: number | undefined, end: number | undefined): boolean {
  return raw === undefined || end === undefined || raw >= end;
}

/**
 * The flight's quad: each corner of the lift quad `from` moved toward the landing box by `s` (0…1). The plate layer
 * is fixed at the viewport's origin, so the box's client coordinates are the layer's own.
 */
export function flightQuad(
  from: readonly (readonly [number, number])[],
  box: { left: number; top: number; right: number; bottom: number },
  s: number,
): [number, number][] {
  const to: [number, number][] = [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ];
  return from.map(([x, y], i): [number, number] => [x + (to[i][0] - x) * s, y + (to[i][1] - y) * s]);
}

/**
 * A RideAnchor's offset at smoothed frame `f`: the anchor's track (frame fractions, row per film frame) interpolated at
 * f, less its rest position, through the painted frame's size, as the wrapper's transform.
 */
export function rideTransform(
  track: readonly (readonly [number, number])[],
  f: number,
  rest: readonly [number, number],
  size: { width: number; height: number },
): string {
  const i = Math.min(track.length - 1, Math.max(0, f));
  const i0 = Math.floor(i);
  const i1 = Math.min(track.length - 1, i0 + 1);
  const t = i - i0;
  const x = track[i0][0] + (track[i1][0] - track[i0][0]) * t;
  const y = track[i0][1] + (track[i1][1] - track[i0][1]) * t;
  const dx = (x - rest[0]) * size.width;
  const dy = (y - rest[1]) * size.height;
  return `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
}

/** How long a plate keeps its layer hint after its last move. */
export const HINT_REST_MS = 250;

export type HintHost = {
  /** Sets (`true`) or removes the hint (`will-change: transform`). */
  set(on: boolean): void;
  now(): number;
  later(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

export type RestHint = {
  /** The plate's transform changed: the hint goes on (once) and stays until `restMs` without a move. */
  moved(): void;
  /** The plate hid or unmounts: the hint goes now. */
  off(): void;
  readonly on: boolean;
};

/**
 * The layer hint while a plate moves: `will-change: transform` from its first move, removed `restMs` after its last one
 * (or at once when it hides), so the browser keeps the plate's raster while it flies and draws it again at its final
 * scale at rest. One timer per rest, not one per frame.
 */
export function createRestHint(host: HintHost, restMs = HINT_REST_MS): RestHint {
  let on = false;
  let lastMove = 0;
  let timer: unknown = null;
  const off = () => {
    if (timer !== null) {
      host.clear(timer);
      timer = null;
    }
    if (!on) return;
    on = false;
    host.set(false);
  };
  const check = () => {
    timer = null;
    const left = restMs - (host.now() - lastMove);
    if (left > 0) timer = host.later(check, left);
    else off();
  };
  return {
    moved() {
      lastMove = host.now();
      if (!on) {
        on = true;
        host.set(true);
      }
      if (timer === null) timer = host.later(check, restMs);
    },
    off,
    get on() {
      return on;
    },
  };
}

/**
 * What a plate shows. Hidden: `flight` null removes the layer's `data-plate-flight`, undefined leaves it (a plate that
 * hides after landing keeps its last flight value, as it always has). Shown: the plate element's transform and
 * opacity, the track row in `data-plate-frame` and the flight's progress in `data-plate-flight` (null: none).
 */
export type PlateFace =
  | { shown: false; flight?: null }
  | { shown: true; transform: string; opacity: string; row: number; flight: string | null };

export const HIDDEN: PlateFace = { shown: false };

type StyleLike = { transform: string; opacity: string; visibility: string };
type DatasetLike = { [key: string]: string | undefined };

/**
 * Writes a PlateFace to the layer and the plate element, only what differs from what it wrote last (nothing is read
 * back from the DOM). The first write of each value always goes out (the effect may follow another one that left the
 * element in any state). A changed transform on a shown plate is a move (the hint); hiding drops the hint.
 */
export function createFaceWriter(layer: { dataset: DatasetLike }, plate: { style: StyleLike }, hint: Pick<RestHint, "moved" | "off">) {
  const UNSET = "\u0000";
  let transform = UNSET;
  let opacity = UNSET;
  let visibility = UNSET;
  let row = UNSET;
  let flight: string | null = UNSET;
  const setFlight = (v: string | null | undefined) => {
    if (v === undefined || v === flight) return;
    flight = v;
    if (v === null) delete layer.dataset.plateFlight;
    else layer.dataset.plateFlight = v;
  };
  return (face: PlateFace) => {
    if (!face.shown) {
      hint.off();
      if (opacity !== "0") plate.style.opacity = opacity = "0";
      if (visibility !== "hidden") plate.style.visibility = visibility = "hidden";
      if (row !== "-1") layer.dataset.plateFrame = row = "-1";
      setFlight(face.flight);
      return;
    }
    if (face.transform !== transform) {
      plate.style.transform = transform = face.transform;
      hint.moved();
    }
    if (face.opacity !== opacity) plate.style.opacity = opacity = face.opacity;
    if (visibility !== "visible") plate.style.visibility = visibility = "visible";
    const r = String(face.row);
    if (r !== row) layer.dataset.plateFrame = row = r;
    setFlight(face.flight);
  };
}

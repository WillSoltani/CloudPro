#!/usr/bin/env python3
"""Turn `scene.py export --plates` corner tracks into the page's PerspectivePlate tracks.

    python3 scripts/films/rack/page-plates.py <export-dir> <out-dir> [--camera landscape|portrait|both]

<export-dir> holds plates/rack-0N.json (and plates/rack-0N-p.json, the portrait camera's) and rack.timeline.json
(scene.py export --plates --out <export-dir>); writes, per film with a unit, <out-dir>/rack-0N.json (landscape)
and <out-dir>/rack-0N-p.json (portrait: film "rack-0N-p", the reel's portrait film, as RackPlate passes it as
portraitTrack) as {film, camera, count, window, corners, alpha} (components/film/PerspectivePlate.tsx
PlateTrack: corners per film frame x0,y0 ... x3,y3 in frame fractions, top-left origin, in the plate's own order
TL TR BR BL; alpha 0..1). Default both cameras. Run it on the export made from the same snapshot as the frames,
so every row lands on the frame it was measured on.

Breathing tails (part five §2e): a film whose timeline row carries `tail: {frames: T}` is built as its masters
plus T tail frames, so its track gets T more rows (the hold's corners, alpha 0: the plate has lifted off before
the hold) and count = frames + T = the built film's count.

The export's rows are [scene frame, then x, y, depth for the well quad's four vertices] in mesh order, which
scene.py builds bottom-left, bottom-right, top-right, top-left (seen from the front); x, y are the camera's
view-frame fractions (lens shift included) with y down, depth is metres along the view axis.

Alpha carries the storyboard's plate rules (films-src/rack/storyboard.md section 5):
- appear at the later of the unit's amber frame (timeline `amber`) and the frame the well is clear of the
  door (OCCLUDED_UNTIL; rack-01's door clears the switch's well at f20, section 3), fading in over FADE frames;
- lift off at the first of: the well turned more than LIFT_ANGLE from the camera (angle between the well's
  normal and the ray to its centre, from the depths and the camera's field of view; the lens shift, about
  0.03 of the frame, is ignored, a 1-2 degree error), a door the well sits on starting to drop (DOOR_DROP:
  rack-06's cover, the `cover_down` beat), or p = LIFT_P; it has faded out by that frame;
- 0 wherever a corner is behind the camera or outside the frame, or the quad faces away; each run of
  drawable frames fades in and out over FADE frames, and runs shorter than MIN_RUN frames are dropped.
The hand-off flight from the lift-off point onto the section's heading is not modelled here.
"""
import json
import math
import os
import sys

FADE = 6
MIN_RUN = 4
LIFT_ANGLE = 55.0
LIFT_P = 0.85
OCCLUDED_UNTIL = {"rack-01": 20}
DOOR_DROP = {"rack-06": "cover_down"}


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def convert(name, rows, film, amber, cam):
    a, b = film["range"]
    L = film["segment"]
    if len(rows) != film["frames"]:
        raise SystemExit(f"{name}: {len(rows)} rows, timeline says {film['frames']} frames")
    for k, r in enumerate(rows):
        if r[0] != a + k:
            raise SystemExit(f"{name}: row {k} is scene frame {r[0]}, expected {a + k}")
    tan_h = cam["sensor_mm"] / 2 / cam["lens_mm"]           # sensor fit AUTO: the sensor spans the longer side
    rx, ry = cam["res"]
    tan_w, tan_t = (tan_h, tan_h * ry / rx) if rx >= ry else (tan_h * rx / ry, tan_h)

    corners, facing, inframe, angle = [], [], [], []
    for r in rows:
        v = [(r[1 + 3 * i], r[2 + 3 * i], r[3 + 3 * i]) for i in range(4)]   # BL, BR, TR, TL
        tl, tr, br, bl = v[3], v[2], v[1], v[0]
        quad = (tl, tr, br, bl)
        corners.append([round(c, 5) for p in quad for c in p[:2]])
        cross = (tr[0] - tl[0]) * (br[1] - tr[1]) - (tr[1] - tl[1]) * (br[0] - tr[0])
        facing.append(cross > 0)
        inframe.append(all(p[2] > 0 and 0 <= p[0] <= 1 and 0 <= p[1] <= 1 for p in quad))
        P = [((x - 0.5) * 2 * tan_w * z, (0.5 - y) * 2 * tan_t * z, z) for x, y, z in quad]
        u = [P[1][i] - P[0][i] for i in range(3)]
        w = [P[3][i] - P[0][i] for i in range(3)]
        n = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])
        c = [sum(p[i] for p in P) / 4 for i in range(3)]
        nn = math.sqrt(sum(x * x for x in n)) or 1e-12
        cc = math.sqrt(sum(x * x for x in c)) or 1e-12
        cos = abs(sum(n[i] * c[i] for i in range(3))) / (nn * cc)
        angle.append(math.degrees(math.acos(min(1.0, cos))))

    unit = film["unit"]
    start = max(0, amber.get(unit, a) - a, OCCLUDED_UNTIL.get(name, 0))
    ends = {"p": math.ceil(LIFT_P * L)}
    turned = next((f for f in range(start, L + 1) if angle[f] > LIFT_ANGLE), None)
    if turned is not None:
        ends["angle"] = turned
    if name in DOOR_DROP:
        beat = next(x for x in film["beats"] if x["id"] == DOOR_DROP[name])
        ends["door"] = beat["from"]
    end = min(ends.values())
    why = min(ends, key=ends.get)

    # Every run of drawable frames fades in and out over FADE frames (a run that starts as the well enters
    # the frame, or ends as it leaves, fades rather than pops); runs under MIN_RUN frames are dropped.
    on = [start <= f < end and facing[f] and inframe[f] for f in range(L + 1)]
    alpha = [0.0] * (L + 1)
    f = 0
    while f <= L:
        if not on[f]:
            f += 1
            continue
        s = f
        while f <= L and on[f]:
            f += 1
        if f - s >= MIN_RUN:
            for g in range(s, f):
                alpha[g] = round(smoothstep(min(g - s + 1, f - g) / FADE), 3)
    shown = [f for f in range(L + 1) if alpha[f] > 0]
    summary = {
        "start": start, "end": end, "ends_by": why, "ends": ends, "shown": len(shown),
        "first": shown[0] if shown else None, "last": shown[-1] if shown else None,
        "angle_at_start": round(angle[start], 1),
        "gaps": [g for g in range(start, end) if not (facing[g] and inframe[g])],
    }
    T = int((film.get("tail") or {}).get("frames", 0))
    corners += [list(corners[-1]) for _ in range(T)]       # the tail: the hold's quad, never drawn
    alpha += [0.0] * T
    summary["tail"] = T
    return {"film": name, "count": len(rows) + T, "window": [start, end], "corners": corners, "alpha": alpha}, summary


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    src, out = argv[1], argv[2]
    which = argv[argv.index("--camera") + 1] if "--camera" in argv else "both"
    cameras = ["landscape", "portrait"] if which == "both" else [which]
    tl = json.load(open(os.path.join(src, "rack.timeline.json")))
    os.makedirs(out, exist_ok=True)
    for film in tl["films"]:
        if not film.get("unit"):
            continue
        name = film["name"]
        for camera in cameras:
            suf = "-p" if camera == "portrait" else ""
            own = os.path.join(src, "plates", f"{name}{suf}.json")
            rows = json.load(open(own if suf and os.path.exists(own) else os.path.join(src, "plates", f"{name}.json")))[camera]
            track, summary = convert(name, rows, film, tl["amber"], tl["cameras"][camera])
            track = {"film": track["film"] + suf, "camera": camera, **{k: v for k, v in track.items() if k != "film"}}
            with open(os.path.join(out, f"{name}{suf}.json"), "w") as fh:
                json.dump(track, fh, separators=(",", ":"))
                fh.write("\n")
            print(name + suf, json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

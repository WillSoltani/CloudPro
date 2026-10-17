#!/usr/bin/env python3
"""Storyboard §4 numbers for one or more rendered frames (same definitions as film-qa.py).
  python3 scripts/films/rack/measure.py <png> [<png> …] [--box x0 x1 y0 y1] [--json]
Per image: mean Y (Rec.709 full range), p1, p99, amber % (HSV hue 14–42 on PIL's 0–255 scale, S ≥ 90, V ≥ 60),
clipped % (Y ≥ 250) and the widest clipped blob, warm % (R > B + 8 outside the amber mask), texture (std of the means of
16-px boxes, scaled to 1920 wide); --box repeats the numbers inside a frame-fraction box (x0 x1 y0 y1)."""
import sys, json
import numpy as np
from PIL import Image

def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def amber_mask(im):
    h, s, v = [np.asarray(c, dtype=np.int32) for c in im.convert("HSV").split()]
    return (h >= 14) & (h <= 42) & (s >= 90) & (v >= 60)

def widest_blob(mask):
    if not mask.any():
        return 0
    cols = np.nonzero(mask.any(axis=0))[0]
    best = run = 0
    for i, c in enumerate(cols):
        run = run + 1 if i and c == cols[i - 1] + 1 else 1
        best = max(best, run)
    return int(best)

def stats(im, a, y, am, box=None):
    h, w = y.shape
    sl = (slice(0, h), slice(0, w))
    if box:
        x0, x1, y0, y1 = box
        sl = (slice(int(y0 * h), int(y1 * h)), slice(int(x0 * w), int(x1 * w)))
    yy, aa, mm = y[sl], a[sl], am[sl]
    clip = yy >= 250
    warm = (aa[..., 0] > aa[..., 2] + 8) & ~mm
    bs = max(4, int(16 * yy.shape[1] / 1920))
    cells = yy[: yy.shape[0] // bs * bs, : yy.shape[1] // bs * bs].reshape(yy.shape[0] // bs, bs, yy.shape[1] // bs, bs).mean(axis=(1, 3))
    return {"mean_y": round(float(yy.mean()), 1), "p1": round(float(np.percentile(yy, 1)), 1),
            "p99": round(float(np.percentile(yy, 99)), 1), "amber_pct": round(100 * float(mm.mean()), 3),
            "clip_pct": round(100 * float(clip.mean()), 4), "clip_widest_px": widest_blob(clip),
            "warm_pct": round(100 * float(warm.mean()), 3), "texture": round(float(cells.std()), 1),
            "amber_centroid": [round(float(c), 4) for c in (np.nonzero(mm)[1].mean() / mm.shape[1], np.nonzero(mm)[0].mean() / mm.shape[0])] if mm.any() else None}

def main(argv):
    box, as_json, files = None, False, []
    i = 0
    while i < len(argv):
        if argv[i] == "--box":
            box = tuple(float(v) for v in argv[i + 1:i + 5]); i += 5
        elif argv[i] == "--json":
            as_json = True; i += 1
        else:
            files.append(argv[i]); i += 1
    out = {}
    for f in files:
        im = Image.open(f).convert("RGB")
        a = np.asarray(im).astype(np.int32)
        y, am = luma(a), amber_mask(im)
        out[f] = {"size": list(im.size), "frame": stats(im, a, y, am)}
        if box:
            out[f]["box"] = stats(im, a, y, am, box)
    if as_json:
        print(json.dumps(out, indent=1))
    else:
        for f, d in out.items():
            fr = d["frame"]
            line = f"{f.split('/')[-1]:>14}  Y {fr['mean_y']:5.1f}  p1 {fr['p1']:5.1f}  p99 {fr['p99']:5.1f}  amber {fr['amber_pct']:.3f}%  clip {fr['clip_pct']:.4f}% ({fr['clip_widest_px']}px)  warm {fr['warm_pct']:.2f}%  tex {fr['texture']}"
            if "box" in d:
                b = d["box"]; line += f"  | box Y {b['mean_y']} p99 {b['p99']} amber {b['amber_pct']}%"
            print(line)

if __name__ == "__main__":
    main(sys.argv[1:])

#!/usr/bin/env python3
"""Re-centre a keyframe's light at a target point (default (0.50, 0.44)) by the largest 16:9 crop that allows it,
with an optional gamma lift, or a gamma solved so the output's mean Rec.709 luma lands inside a band.
usage: recentre-key.py <in.png> <out.png> --light LX LY [--target 0.50 0.44] [--gamma G | --fit-mean-y LO HI]
                       [--margin 1.0] [--min-f 0.78] [--json out.json]
Prints the crop fraction f, the box, and the output size; exits 2 when no crop of at least --min-f can do it.
The crop fraction is f = min(1, lx / tx, (1 - lx) / (1 - tx), ly / ty, (1 - ly) / (1 - ty)) (width rounded down to a
multiple of 16, height = width * 9 / 16): at the default target exactly the original script, for every input
where that crop fits; when it would be taller than the frame (inputs wider than 16:9, e.g. a raw 2752x1536) the
width is capped at H * 16 / 9 (the old script cropped past the frame there). --fit-mean-y keeps gamma 1.0 when the cropped frame's mean Y is already inside [LO, HI], and
otherwise bisects gamma so the mean lands MARGIN inside the nearer bound (gamma < 1 brightens).
film-qa.py imports plan_crop / apply_gamma / fit_gamma / mean_luma from this file (`still --profile t0 --stage raw`)."""
import argparse
import json
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def plan_crop(W, H, lx, ly, tx=0.50, ty=0.44):
    """Largest 16:9 crop (width a multiple of 16) of a W x H frame placing the light (lx, ly) at (tx, ty).
    Returns (f, (x0, y0, x1, y1)) with f = crop width / W before rounding; f may be < min-f (caller decides)."""
    # The original fractional bound, generalised to any target (identical to the old script at (0.50, 0.44) for
    # every input), plus a guard for inputs wider than 16:9, where the old crop height would exceed the frame.
    f = max(0.0, min(1.0, lx / tx, (1 - lx) / (1 - tx), ly / ty, (1 - ly) / (1 - ty)))
    cw = int(round(f * W))
    cw -= cw % 16
    ch = cw * 9 // 16
    if ch > H:  # only for inputs wider than 16:9; the old script cropped past the frame here
        f = H * 16 / 9 / W
        cw = int(H * 16 / 9)
        cw -= cw % 16
        ch = cw * 9 // 16
    x0 = int(round(lx * W - tx * cw))
    y0 = int(round(ly * H - ty * ch))
    x0 = max(0, min(x0, W - cw))
    y0 = max(0, min(y0, H - ch))
    return f, (x0, y0, x0 + cw, y0 + ch)


def apply_gamma(im, g):
    if g == 1.0:
        return im
    lut = [int(round(255 * (i / 255) ** g)) for i in range(256)]
    return im.point(lut * 3)


def mean_luma(im, step=1):
    a = np.asarray(im.convert('RGB'), dtype=np.float32)[::step, ::step]
    return float((0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]).mean())


def fit_gamma(im, lo, hi, margin=1.0, g_min=0.5, g_max=2.0):
    """Gamma that moves the mean Rec.709 luma into [lo, hi] (MARGIN inside the nearer bound); 1.0 when already in.
    Bisection on a 1/4-sampled copy, then the exact value on the full frame is reported by the caller."""
    small = im.convert('RGB').resize((max(1, im.width // 4), max(1, im.height // 4)), Image.BOX)
    m0 = mean_luma(small)
    if lo <= m0 <= hi:
        return 1.0
    target = lo + margin if m0 < lo else hi - margin
    a, b = g_min, g_max  # mean luma falls as gamma rises
    for _ in range(40):
        g = (a + b) / 2
        if mean_luma(apply_gamma(small, g)) > target:
            a = g
        else:
            b = g
    return round((a + b) / 2, 4)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--light', nargs=2, type=float, required=True, metavar=('LX', 'LY'))
    ap.add_argument('--target', nargs=2, type=float, default=(0.50, 0.44), metavar=('TX', 'TY'),
                    help='where the light lands in the crop (default 0.50 0.44)')
    ap.add_argument('--gamma', type=float, default=1.0)
    ap.add_argument('--fit-mean-y', nargs=2, type=float, metavar=('LO', 'HI'),
                    help='solve gamma so the output mean Y lands inside [LO, HI] (overrides --gamma)')
    ap.add_argument('--margin', type=float, default=1.0, help='with --fit-mean-y: land this far inside the bound')
    ap.add_argument('--min-f', type=float, default=0.78)
    ap.add_argument('--json')
    a = ap.parse_args(argv)
    lx, ly = a.light
    tx, ty = a.target
    if not (0 < tx < 1 and 0 < ty < 1):
        ap.error('--target must lie strictly inside (0, 1)')
    im = Image.open(a.src).convert('RGB')
    W, H = im.size
    f, box = plan_crop(W, H, lx, ly, tx, ty)
    if f < a.min_f:
        print(json.dumps({'ok': False, 'f': round(f, 4), 'target': [tx, ty], 'reason': 'crop would lose too much'}))
        return 2
    x0, y0, x1, y1 = box
    cw, ch = x1 - x0, y1 - y0
    out = im.crop(box)
    gamma = fit_gamma(out, *a.fit_mean_y, margin=a.margin) if a.fit_mean_y else a.gamma
    out = apply_gamma(out, gamma)
    out.save(a.dst)
    res = {'ok': True, 'f': round(cw / W, 4), 'box': [x0, y0, x1, y1], 'size': [cw, ch], 'gamma': gamma,
           'light_after': [round((lx * W - x0) / cw, 4), round((ly * H - y0) / ch, 4)],
           'target': [tx, ty], 'mean_y': round(mean_luma(out), 2)}
    print(json.dumps(res))
    if a.json:
        json.dump(res, open(a.json, 'w'), indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())

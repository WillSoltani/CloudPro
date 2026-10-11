#!/usr/bin/env python3
"""Re-centre a keyframe's light at (0.50, 0.44) by the largest 16:9 crop that allows it, with an optional gamma lift.
usage: recentre-key.py <in.png> <out.png> --light LX LY [--gamma G] [--min-f 0.78] [--json out.json]
Prints the crop fraction f, the box, and the output size; exits 2 when no crop of at least --min-f can do it."""
import argparse, json, sys
from PIL import Image
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--light', nargs=2, type=float, required=True, metavar=('LX', 'LY'))
ap.add_argument('--gamma', type=float, default=1.0); ap.add_argument('--min-f', type=float, default=0.78)
ap.add_argument('--json'); a = ap.parse_args()
lx, ly = a.light
f = min(1.0, 2 * lx, 2 * (1 - lx), ly / 0.44, (1 - ly) / 0.56)
im = Image.open(a.src).convert('RGB'); W, H = im.size
if f < a.min_f:
    print(json.dumps({'ok': False, 'f': round(f, 4), 'reason': 'crop would lose too much'})); sys.exit(2)
cw = int(round(f * W)); cw -= cw % 16; ch = cw * 9 // 16
x0 = int(round(lx * W - 0.5 * cw)); y0 = int(round(ly * H - 0.44 * ch))
x0 = max(0, min(x0, W - cw)); y0 = max(0, min(y0, H - ch))
out = im.crop((x0, y0, x0 + cw, y0 + ch))
if a.gamma != 1.0:
    lut = [int(round(255 * (i / 255) ** a.gamma)) for i in range(256)]
    out = out.point(lut * 3)
out.save(a.dst)
res = {'ok': True, 'f': round(cw / W, 4), 'box': [x0, y0, x0 + cw, y0 + ch], 'size': [cw, ch], 'gamma': a.gamma, 'light_after': [round((lx * W - x0) / cw, 4), round((ly * H - y0) / ch, 4)]}
print(json.dumps(res))
if a.json: json.dump(res, open(a.json, 'w'), indent=1)

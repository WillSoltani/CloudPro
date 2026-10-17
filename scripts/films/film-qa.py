#!/usr/bin/env python3
"""Objective QA for scroll-film keyframes and clips (PIL + numpy + ffmpeg).

  film-qa.py still  <image> [--key K0] [--json out.json]
  film-qa.py still  <image> --profile reel [--key K0..K7] [--prev prev-key.json] [--strict-regions] [--json out.json]
                    (reel profile is auto-selected for paths containing /films-src/reel/)
  film-qa.py still  <image> --profile t0 [--stage final|raw] [--min-f 0.90] [--sim-out sim.png] [--json out.json]
                    (part five's landing key T0, the tower above a fog sea; raw = simulate the commit first)
  film-qa.py clip   <clip.mp4> --prev K.png --next K.png --out <dir> --tag 01_t1 [--tophalf] [--json out.json]
  film-qa.py seq    <dir of png|webp frames> [--json out.json] [--pop 4.0] [--full]
  film-qa.py lamp   <clip.mp4|dir of frames> --window X0 X1 Y0 Y1 --target LX LY --tol T [TY] [--from N]
                    [--core 245] [--count-change 0.40] [--json out.json] [--full]
  film-qa.py join   --last <last.png|clip.mp4> --key <key.png> [--alpha 0.80] [--base 070b16] [--out join.png]
  film-qa.py sheet  --out sheet.png [--cols N] [--labels a,b,c] [--tile-width 960] <images...>
  film-qa.py phone  --out strip.png [--labels a,b] [--width 390 --height 844] <images...>
                    (sheet / phone take any number of images, e.g. K0 … K7 with --cols 4)
  film-qa.py ledger --dir films-src/beacon/ledger --out films-src/beacon/ledger.md [--ceiling 598] [--title beacon]

Luma is full-range Rec.709 computed on RGB pixels in Python (Y = .2126R + .7152G + .0722B, 0..255),
so absolute targets from the storyboard (base ≈ 11, K4 top-half ≤ 22) compare directly. ffmpeg's
signalstats is used only for per-frame series inside one file, where the limited-range offset cancels.

`seq` (the rack film) decodes a directory of PNG or WebP frames (natural sort: f_2 before f_10) to 480 px wide
Rec.709 luma and prints a compact table, then a summary and flags; --json writes every series. Per frame:
mean Y; "diff" = mean |Y[i] - Y[i-1]|; "shimmer" = temporal second difference mean |Y[i-1] - 2 Y[i] + Y[i+1]|
(per pixel, so it catches boil and moire that the mean Y hides); clip% = share of pixels with Y >= 250 at 480 px
(a speck of LED that is clipped at full size can average out below that). Flags: "pop" when a frame's diff exceeds
--pop x the median diff (median floored at 0.05 so a long static hold does not flag every move); drift is a
summary line (first vs last mean Y), never a flag, because a dolly into a lit unit is meant to brighten.
Frame numbers are 1-based positions in the sorted list. Without PIL WebP support, frames decode through ffmpeg
(its YUV-to-RGB step reads lossy WebP about 1.5 levels darker than libwebp, so compare absolute Y only within one
decoder; the diff and shimmer series agree to about 0.1).

`lamp` (part five's tower act) follows the brightest blob inside a window on every frame of a clip (16:9 content:
FLUX's 1920x1088 is centre-cropped to 1080 rows first) or a frame directory: the blob is the 8-connected
component set at Y >= --core (245) when the window reaches it, otherwise at a relative threshold (peak - 0.2 x
(peak - median), reported as mode "rel"); components within --merge (0.02 of frame height) of the brightest one
are one lamp. Per frame: the luma-weighted centroid (fractions of the full frame), the blob count (clusters of at
least --min-area px at 1920 width and --second-frac (0.30) of the lamp's area; a cluster longer than --second-elong
(3) times its width is a line, e.g. the pod's lit window band, counted as n_lines and never as a second lamp), the
lamp's >= core pixel count, a second blob if any. Gates: centroid within --tol of --target on every frame from
--from, one blob, the lamp's core count changing by at most --count-change frame to frame (relative to the
previous frame, ignored while both are below --count-floor px at 1920 width). `steady_from` is the first frame from which the core count stays within 15 % of
the median of the last 12 frames (a candidate `lamp_lit` beat). stdout carries the summary; --json every series.

`still --profile t0` checks the landing key T0 against its storyboard must-holds: the lamp blob in x 0.40-0.60 /
y 0.25-0.45 at (0.50 +/- 0.01, 0.35 +/- 0.01); mean Y 48-56; top quarter <= 45; fog sea (rows 0.50-0.95) 55-70;
amber <= 1 %; left quarter quiet (high-pass detail <= 2.6); no warm pixels outside the lamp disc, the beam wedge to
camera-right and the tower column; tower scale (mast tip to lamp, fraction of frame height) within 6 % of K3's.
`--stage raw` centre-crops to 16:9, re-centres on the lamp with recentre-key.py's arithmetic (target (0.50, 0.35),
f >= --min-f) and solves the commit gamma into 48-56, then measures that simulated committed frame.

`still --profile reel` and `join` (part-three "reel" film) print {metrics, failures[], flags[], verdict}; a hard
failure sets verdict "fail" / objective_reject true but the exit status stays 0, like the other subcommands.
`join` is gated on the RAW pair exactly as `clip` gates its last frame: ffmpeg's ssim filter (ssim_raw = clip's
ssim_last) and full-frame mean-Y delta (dy_raw = clip's dy_last). The scrim-composited pair (numpy Gaussian SSIM,
ssim_composited_gauss) is informational and feeds the sheet for the human judge.
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = None

# ---------------------------------------------------------------- helpers


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def load_rgb(path: str) -> np.ndarray:
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.asarray(im, dtype=np.float32)


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def amber_mask(rgb: np.ndarray) -> np.ndarray:
    """HSV on the PIL 0..255 scale: hue 14..42 (≈20°–60°), sat ≥ 90, value ≥ 60."""
    hsv = np.asarray(Image.fromarray(rgb.astype(np.uint8)).convert("HSV"), dtype=np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return (h >= 14) & (h <= 42) & (s >= 90) & (v >= 60)


def box_means(y: np.ndarray, box: int = 32) -> np.ndarray:
    h, w = y.shape
    hh, ww = h // box, w // box
    return y[: hh * box, : ww * box].reshape(hh, box, ww, box).mean(axis=(1, 3))


def font(size: int) -> ImageFont.ImageFont:
    for p in (
        "/System/Library/Fonts/Supplemental/Menlo.ttc",
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                pass
    return ImageFont.load_default()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def texture(region: np.ndarray) -> float:
    """Texture proxy for a luma region: std of its 16-px box means (shared by `still` and the reel profile)."""
    bm = box_means(region, 16)
    return float(bm.std())


# ---------------------------------------------------------------- still


def still_metrics(path: str, key: str | None) -> dict:
    rgb = load_rgb(path)
    h, w, _ = rgb.shape
    y = luma(rgb)
    amber = amber_mask(rgb)
    out: dict = {"file": path, "dims": [w, h], "key": key}

    out["mean_y"] = round(float(y.mean()), 2)
    out["amber_pct"] = round(float(amber.mean() * 100), 3)
    out["amber_above_y067_pct"] = round(float(amber[: int(h * 0.67)].mean() * 100), 3)

    top_half = y[: h // 2]
    out["top_half_yavg"] = round(float(top_half.mean()), 2)
    out["top_half_region_ymax"] = round(float(box_means(top_half).max()), 2)
    out["top_quarter_yavg"] = round(float(y[: h // 4].mean()), 2)
    out["bottom_third_yavg"] = round(float(y[int(h * 2 / 3) :].mean()), 2)

    # Lamp / bloom: brightest amber pixels, in the band the storyboard expects for this key.
    # K0–K3: lamp near the top; K4: lamp at the bottom; L0–L2 (part two): bloom in the bottom third;
    # L3: the converging light just below centre.
    if key == "K4" or (key or "").startswith("L") and key != "L3":
        band = (int(h * 0.60), h)
    elif key == "L3":
        band = (int(h * 0.40), int(h * 0.70))
    else:
        band = (0, int(h * 0.45))
    hsv_v = np.asarray(Image.fromarray(rgb.astype(np.uint8)).convert("HSV"), dtype=np.int16)[..., 2]
    lamp = amber & (hsv_v >= 200)
    lamp[: band[0]] = False
    lamp[band[1] :] = False
    if lamp.any():
        ys, xs = np.nonzero(lamp)
        out["lamp_centroid"] = [round(float(xs.mean() / w), 4), round(float(ys.mean() / h), 4)]
        out["lamp_pixels"] = int(lamp.sum())
    else:
        out["lamp_centroid"] = None
        out["lamp_pixels"] = 0

    # Tower: darkest column (15-px moving average) in the mid band, centre third.
    y0, y1 = int(h * 0.30), int(h * 0.55)
    x0, x1 = int(w * 0.33), int(w * 0.67)
    cols = y[y0:y1, x0:x1].mean(axis=0)
    k = 15
    sm = np.convolve(cols, np.ones(k) / k, mode="same")
    out["tower_x_estimate"] = round(float((x0 + int(sm.argmin())) / w), 4)
    out["tower_contrast"] = round(float(sm.max() - sm.min()), 2)

    # Horizon: strongest luma gradient in rows 50–70 % over the centre half of columns.
    rows = y[:, int(w * 0.25) : int(w * 0.75)].mean(axis=1)
    r0, r1 = int(h * 0.50), int(h * 0.70)
    grad = np.abs(np.diff(rows[r0 : r1 + 1]))
    out["horizon_y_estimate"] = round(float((r0 + int(grad.argmax())) / h), 4)
    out["horizon_strength"] = round(float(grad.max()), 2)

    # Quiet left quarter / low-detail bottom third: local std as a texture proxy.
    out["left_quarter_texture"] = round(texture(y[:, : w // 4]), 2)
    out["bottom_third_texture"] = round(texture(y[int(h * 2 / 3) :]), 2)

    flags = []
    if out["amber_pct"] > 8:
        flags.append("amber>8%")
    elif out["amber_pct"] > 5:
        flags.append("amber 5-8% (judge)")
    if out["lamp_centroid"] is None:
        flags.append("no lamp found in expected band")
    elif abs(out["lamp_centroid"][0] - 0.5) > 0.03:
        flags.append("lamp off-centre")
    if key == "K4":
        if out["top_half_yavg"] > 22:
            flags.append("K4 top-half yavg>22")
        if out["top_half_region_ymax"] > 28:
            flags.append("K4 top-half region>28")
        if out["amber_above_y067_pct"] > 0.1:
            flags.append("K4 amber above lower third")
    elif key in ("K0", "K1", "K2", "K3") and abs(out["horizon_y_estimate"] - 0.60) > 0.04:
        flags.append("horizon off 60% (judge)")
    if (key or "").startswith("L"):
        if out["mean_y"] > 48:
            flags.append("mean Y>48 (too bright for a cloud interior)")
        if key == "L0" and not (21.6 <= out["top_half_yavg"] <= 31.6):
            flags.append("L0 top-half Y outside 26.6±5")
        if out["lamp_centroid"] is not None and key == "L3" and not (0.45 <= out["lamp_centroid"][1] <= 0.65):
            flags.append("L3 light not near y 0.55")
    if key == "K3" and not (14 <= out["top_quarter_yavg"] <= 24):
        flags.append("K3 top-quarter Y outside 14-24 (soft)")
    out["flags"] = flags
    out["objective_reject"] = any(f in flags for f in ("amber>8%", "lamp off-centre", "K4 top-half yavg>22",
                                                        "K4 top-half region>28", "K4 amber above lower third",
                                                        "mean Y>48 (too bright for a cloud interior)",
                                                        "L0 top-half Y outside 26.6±5"))
    return out


# ---------------------------------------------------------------- still: reel profile
#
# Part three ("reel") names its keys K0–K7, which collide with the beacon K-names, so its rules live behind
# `still --profile reel` (auto-selected for paths under /films-src/reel/). Geometry is from the approved
# storyboard: the light sits at (0.50, 0.44) in every key, and K4–K7 are holds.

REEL_KEYS = tuple(f"K{i}" for i in range(8))
REEL_LIGHT = (0.50, 0.44)
REEL_LIGHT_BOX = (0.40, 0.60, 0.30, 0.60)  # x0, x1, y0, y1 (fractions): where the amber centroid is searched
REEL_LIGHT_TOL = (0.02, 0.03)  # hard fail beyond this |dx|, |dy|
REEL_AMBER_CEILING = {"K0": 1.0, "K1": 1.2, "K2": 1.5, "K3": 2.0, "K4": 2.5, "K5": 3.0, "K6": 4.0, "K7": 5.0}
REEL_HOLD_Y = {"K4": 45.0, "K5": 45.0, "K6": 42.0, "K7": 40.0}  # holds: mean-Y ceiling (flag), hard fail above 50
REEL_HOLD_Y_FAIL = 50.0
# Region rules (left quarter x < 0.25, bottom third y > 2/3) are provisional until the K0 round calibrates them:
# flags by default, hard fails under --strict-regions.
REEL_LEFT_Y, REEL_LEFT_TEXTURE = 30.0, 14.0
REEL_BOTTOM_Y, REEL_BOTTOM_TEXTURE = 34.0, 20.0


def reel_key_from_name(path: str) -> str | None:
    """K4 from K4.png / K4_a.png (variants keep the key prefix)."""
    m = re.match(r"(K[0-7])(?![0-9])", os.path.basename(path), re.IGNORECASE)
    return m.group(1).upper() if m else None


def reel_prev_mean_y(path: str) -> float:
    """Mean Y of the previous key, from its metrics json (reel `metrics.mean_y` or a flat beacon `mean_y`)."""
    try:
        with open(path) as fh:
            data = json.load(fh)
        return float(data.get("metrics", data)["mean_y"])
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as e:
        raise SystemExit(f"--prev {path}: cannot read mean_y ({e})")


def reel_metrics(path: str, key: str, prev_y: float | None, strict_regions: bool) -> dict:
    rgb = load_rgb(path)
    h, w, _ = rgb.shape
    y = luma(rgb)
    amber = amber_mask(rgb)
    m: dict = {}
    failures: list[str] = []  # hard fails
    flags: list[str] = []
    notes: list[str] = []  # rules skipped, not verdict-relevant

    m["mean_y"] = round(float(y.mean()), 2)
    m["amber_pct"] = round(float(amber.mean() * 100), 3)
    m["top_third_y"] = round(float(y[: int(h / 3)].mean()), 2)
    m["centre_third_y"] = round(float(y[:, int(w * 0.33) : int(w * 0.67)].mean()), 2)

    # Light position: unweighted centroid of the amber mask inside the search box.
    bx0, bx1 = int(w * REEL_LIGHT_BOX[0]), int(w * REEL_LIGHT_BOX[1])
    by0, by1 = int(h * REEL_LIGHT_BOX[2]), int(h * REEL_LIGHT_BOX[3])
    ys, xs = np.nonzero(amber[by0:by1, bx0:bx1])
    m["light_pixels"] = int(len(xs))
    if len(xs):
        cx, cy = (bx0 + float(xs.mean())) / w, (by0 + float(ys.mean())) / h
        m["light_centroid"] = [round(cx, 4), round(cy, 4)]
        m["light_dx"] = round(cx - REEL_LIGHT[0], 4)
        m["light_dy"] = round(cy - REEL_LIGHT[1], 4)
        if abs(m["light_dx"]) > REEL_LIGHT_TOL[0]:
            failures.append(f"light x off by {m['light_dx']:+.4f} (>{REEL_LIGHT_TOL[0]})")
        if abs(m["light_dy"]) > REEL_LIGHT_TOL[1]:
            failures.append(f"light y off by {m['light_dy']:+.4f} (>{REEL_LIGHT_TOL[1]})")
    else:
        m["light_centroid"] = m["light_dx"] = m["light_dy"] = None
        failures.append("no light: no amber pixels in x 0.40-0.60, y 0.30-0.60")

    # Amber coverage: flag above the ceiling, hard fail above 1.5x.
    ceil = REEL_AMBER_CEILING[key]
    if m["amber_pct"] > ceil * 1.5:
        failures.append(f"amber {m['amber_pct']}% > 1.5x ceiling {ceil}%")
    elif m["amber_pct"] > ceil:
        flags.append(f"amber {m['amber_pct']}% > ceiling {ceil}%")

    # Mean Y: K0 band, K1-K3 vs previous key, holds K4-K7.
    my = m["mean_y"]
    if prev_y is not None:
        m["prev_mean_y"] = round(prev_y, 2)
    if key == "K0":
        if not 45 <= my <= 55:
            flags.append(f"K0 mean Y {my} outside 45-55")
    elif key in ("K1", "K2", "K3"):
        if prev_y is None:
            notes.append("mean-Y vs previous key skipped (no --prev)")
        elif my > prev_y + 2:
            flags.append(f"mean Y {my} > previous key {prev_y:.2f} + 2")
    else:
        hold_ok = True
        if my > REEL_HOLD_Y_FAIL:
            failures.append(f"hold mean Y {my} > {REEL_HOLD_Y_FAIL:g}")
            hold_ok = False
        elif my > REEL_HOLD_Y[key]:
            flags.append(f"hold mean Y {my} > {REEL_HOLD_Y[key]:g}")
        if key == "K7":
            if prev_y is None:
                notes.append("K7 <= K6 - 1 skipped (no --prev)")
            elif my > prev_y - 1 and my <= REEL_HOLD_Y_FAIL:
                flags.append(f"K7 mean Y {my} > K6 {prev_y:.2f} - 1")
        m["hold_ok"] = hold_ok

    # Quiet left quarter / low-detail bottom third: all four ceilings are provisional (flags; hard fails only
    # with --strict-regions). Texture is the same metric as `still`: std of 16-px luma box means, native resolution.
    left, bottom = y[:, : w // 4], y[int(h * 2 / 3) :]
    m["left_quarter_y"] = round(float(left.mean()), 2)
    m["left_quarter_texture"] = round(texture(left), 2)
    m["bottom_third_y"] = round(float(bottom.mean()), 2)
    m["bottom_third_texture"] = round(texture(bottom), 2)
    for name, val, limit in (("left quarter mean Y", m["left_quarter_y"], REEL_LEFT_Y),
                             ("left_quarter_texture", m["left_quarter_texture"], REEL_LEFT_TEXTURE),
                             ("bottom third mean Y", m["bottom_third_y"], REEL_BOTTOM_Y),
                             ("bottom_third_texture", m["bottom_third_texture"], REEL_BOTTOM_TEXTURE)):
        if val > limit:
            if strict_regions:
                failures.append(f"{name} {val} > {limit:g} (strict)")
            else:
                flags.append(f"{name} {val} > {limit:g} (provisional)")

    return {"file": path, "dims": [w, h], "key": key, "profile": "reel", "metrics": m,
            "failures": failures, "flags": flags, "notes": notes,
            "verdict": "fail" if failures else "flag" if flags else "pass",
            "objective_reject": bool(failures)}


# ---------------------------------------------------------------- bright blobs (shared by `lamp` and the t0 profile)


def components(mask: np.ndarray) -> list[list[tuple[int, int, int]]]:
    """8-connected components of a boolean mask as lists of runs (row, c0, c1) with c1 exclusive.
    Run-length labelling with union-find (numpy + stdlib only; scipy is not installed here)."""
    runs: list[tuple[int, int, int]] = []
    parent: list[int] = []

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    prev: list[int] = []
    for r in range(mask.shape[0]):
        row = mask[r]
        if not row.any():
            prev = []
            continue
        d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        cur = []
        for s, e in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
            i = len(runs)
            runs.append((r, int(s), int(e)))
            parent.append(i)
            cur.append(i)
            for k in prev:
                _, ps, pe = runs[k]
                if ps <= e and pe >= s:  # 8-connected: the previous row's run touches [s - 1, e]
                    a, b = find(i), find(k)
                    if a != b:
                        parent[max(a, b)] = min(a, b)
        prev = cur
    groups: dict[int, list[tuple[int, int, int]]] = {}
    for i, run in enumerate(runs):
        groups.setdefault(find(i), []).append(run)
    return list(groups.values())


def blob_clusters(y: np.ndarray, thr: float, merge_px: float, core: float = 245.0) -> list[dict]:
    """Components of y >= thr, merged into clusters when their bounding boxes lie within merge_px of each other
    (a lamp core fragmented by its own bloom is one lamp). Sorted by luma-weighted mass (brightest first).
    Coordinates are pixels of y; weights are (Y - thr + 1); "core" counts the pixels at Y >= core."""
    comps = []
    for runs in components(y >= thr):
        area = wsum = wx = wy = ncore = 0.0
        peak = 0.0
        r0 = c0 = 10 ** 9
        r1 = c1 = -1
        for r, s, e in runs:
            v = y[r, s:e]
            wgt = v - thr + 1.0
            area += e - s
            ncore += float((v >= core).sum())
            wsum += float(wgt.sum())
            wx += float((wgt * np.arange(s, e)).sum())
            wy += float(wgt.sum()) * r
            peak = max(peak, float(v.max()))
            r0, r1, c0, c1 = min(r0, r), max(r1, r), min(c0, s), max(c1, e - 1)
        comps.append({"area": area, "core": ncore, "wsum": wsum, "wx": wx, "wy": wy, "peak": peak,
                      "bbox": [r0, c0, r1, c1]})
    comps.sort(key=lambda c: -c["wsum"])
    clusters: list[dict] = []
    for c in comps:
        for cl in clusters:
            r0, c0, r1, c1 = cl["bbox"]
            gr = max(0, c["bbox"][0] - r1, r0 - c["bbox"][2])
            gc = max(0, c["bbox"][1] - c1, c0 - c["bbox"][3])
            if max(gr, gc) <= merge_px:
                for k in ("area", "core", "wsum", "wx", "wy"):
                    cl[k] += c[k]
                cl["peak"] = max(cl["peak"], c["peak"])
                cl["bbox"] = [min(r0, c["bbox"][0]), min(c0, c["bbox"][1]), max(r1, c["bbox"][2]), max(c1, c["bbox"][3])]
                cl["parts"] += 1
                break
        else:
            clusters.append(dict(c, parts=1))
    for cl in clusters:
        cl["cx"] = cl["wx"] / cl["wsum"] if cl["wsum"] else float("nan")
        cl["cy"] = cl["wy"] / cl["wsum"] if cl["wsum"] else float("nan")
    clusters.sort(key=lambda c: -c["wsum"])
    return clusters


LAMP_CORE = 245.0  # "core" pixels: Y >= this
LAMP_REL = 0.20  # relative threshold below the core: peak - REL x (peak - median)
LAMP_MIN_CONTRAST = 12.0  # peak - median below this: no distinct blob in the window
LAMP_MERGE = 0.02  # cluster merge distance, fraction of frame height
LAMP_MIN_AREA = 4.0  # px at 1920 width (scaled by (w / 1920)^2)
LAMP_SECOND_FRAC = 0.30  # a second cluster counts when its area is at least this share of the lamp's (the CN Tower
# pod's window lights sit 0.03 below the lamp at 4-7 px against the lamp's ~30 at 1920 in the accepted clip 03)
LAMP_SECOND_ELONG = 3.0  # ... and is compact: bbox long side / short side at most this. The pod's lit window band
# (a flat line 0.03 below the lamp, up to 0.47 of the lamp's area in clip 03) is a line, never a second lamp.


def lamp_in_window(y: np.ndarray, window: tuple[float, float, float, float], core: float = LAMP_CORE,
                   merge: float = LAMP_MERGE, min_area_1920: float = LAMP_MIN_AREA,
                   second_frac: float = LAMP_SECOND_FRAC, second_elong: float = LAMP_SECOND_ELONG) -> dict:
    """Brightest blob of a full-frame luma array inside window (x0, x1, y0, y1 as fractions)."""
    h, w = y.shape
    x0, x1 = int(round(window[0] * w)), int(round(window[1] * w))
    y0, y1 = int(round(window[2] * h)), int(round(window[3] * h))
    win = y[y0:y1, x0:x1]
    scale = (w / 1920.0) ** 2
    min_area = max(1.0, min_area_1920 * scale)
    peak, med = float(win.max()), float(np.median(win))
    core_px = int((win >= core).sum())
    out: dict = {"peak": round(peak, 1), "median": round(med, 1), "core_px": core_px,
                 "core_px_1920": round(core_px / scale, 1)}
    if peak >= core:
        thr, mode = core, "core"
    elif peak - med >= LAMP_MIN_CONTRAST:
        thr, mode = peak - LAMP_REL * (peak - med), "rel"
    else:
        out.update(mode="none", thr=None, centroid=None, n_blobs=0, main_area=0, lamp_core_px_1920=0.0, second=None)
        return out
    cls = blob_clusters(win, thr, merge * h, core)
    main = cls[0]
    def elong(c: dict) -> float:
        bh, bw = c["bbox"][2] - c["bbox"][0] + 1, c["bbox"][3] - c["bbox"][1] + 1
        return max(bh, bw) / min(bh, bw)

    big = [c for c in cls if c is not main and c["area"] >= min_area and c["area"] >= second_frac * main["area"]]
    lines = [c for c in big if elong(c) > second_elong]
    sig = ([main] if main["area"] >= min_area else []) + [c for c in big if elong(c) <= second_elong]
    second = next((c for c in sig if c is not main), None)
    out.update(mode=mode, thr=round(thr, 1),
               centroid=[round((x0 + main["cx"]) / w, 4), round((y0 + main["cy"]) / h, 4)],
               n_blobs=len(sig), n_lines=len(lines),
               main_area=int(main["area"]), main_area_1920=round(main["area"] / scale, 1), main_parts=main["parts"],
               lamp_core_px_1920=round(main["core"] / scale, 1),
               second=None if second is None else {
                   "centroid": [round((x0 + second["cx"]) / w, 4), round((y0 + second["cy"]) / h, 4)],
                   "area": int(second["area"]), "area_ratio": round(second["area"] / main["area"], 3),
                   "peak": round(second["peak"], 1)})
    return out


# ---------------------------------------------------------------- still: t0 profile (part five, the tower act)
#
# T0 is the landing key of the bridge (the light out of the rack becomes the CN Tower's lamp over a sea of fog)
# and the start frame of the lights-on clip (T0 -> K3), so it shares K3's framing: lamp at (0.50, 0.35), the same
# tower size, a level fog-sea surface at y 0.42-0.48, nothing below the pod but fog. Storyboard:
# films-src/tower2/storyboard.md section 3.

T0_LAMP = (0.50, 0.35)
T0_LAMP_BAND = (0.40, 0.60, 0.25, 0.45)  # x0, x1, y0, y1: where the lamp blob is searched
T0_LAMP_TOL = (0.01, 0.01)
T0_MEAN_Y = (48.0, 56.0)
T0_TOP_QUARTER_MAX = 45.0
T0_FOG_ROWS = (0.50, 0.95)
T0_FOG_Y = (55.0, 70.0)
T0_AMBER_MAX = 1.0  # percent
T0_LEFT_DETAIL_FAIL, T0_LEFT_DETAIL_FLAG = 2.6, 1.8  # highpass_detail of the left quarter (K0 1.23, K4 2.14, K3 2.30, tower-04 f1 2.61)
T0_WARM_FAIL, T0_WARM_FLAG = 0.05, 0.02  # percent of the frame warm outside the lamp, beam and tower column
T0_SURFACE = (0.42, 0.48)  # fog-sea surface (flag only; the judges read it)
T0_K3_MAST = 0.1572  # K3.png: mast tip (y 0.1953) to lamp centroid (y 0.3525), fraction of frame height (mast_length)
T0_SCALE_TOL = 0.06
T0_MIN_F = 0.90


def warm_mask(rgb: np.ndarray) -> np.ndarray:
    """Any warm colour (red through amber; PIL hue <= 45 or >= 240), saturated and not dark."""
    hsv = np.asarray(Image.fromarray(rgb.astype(np.uint8)).convert("HSV"), dtype=np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h <= 45) | (h >= 240)) & (s >= 70) & (v >= 50)


def box_blur(a: np.ndarray, k: int) -> np.ndarray:
    """k x k mean filter (edge-padded, same size) via a summed-area table."""
    p = k // 2
    c = np.pad(np.cumsum(np.cumsum(np.pad(a, p, mode="edge"), 0), 1), ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def highpass_detail(y: np.ndarray) -> float:
    """Local detail: std of 8-px box means (at 1920 width) minus their 7 x 7-box local mean. Smooth gradients, a soft
    fog surface and thin veils read low; rooftops, a skyline or hard cloud edges read high. Beacon calibration
    (left quarter): K0 1.23, K1 1.11 (fog and water), K3 2.30 (low skyline), K3_a 5.15 (edge-to-edge towers),
    K4 2.14 (cloud banks)."""
    bm = box_means(y, max(4, int(round(8 * y.shape[1] * 4 / 1920))))  # y is the left quarter: scale by full width
    return float((bm - box_blur(bm, 7)).std())


def mast_length(y: np.ndarray, lx: float, ly: float) -> dict:
    """Mast tip above the lamp: scanning up from just above the lamp, the highest row (before a gap of 1 % of the
    height) where a narrow column at lx is darker than the sky either side by at least 35 % of the mast body's
    contrast. Returns the length lamp -> tip as a fraction of frame height and whether the reading is confident."""
    h, w = y.shape
    cx = int(round(lx * w))
    hw = max(2, int(round(0.006 * w)))
    s0, s1 = int(round(0.015 * w)), int(round(0.03 * w))
    if cx - s1 < 0 or cx + s1 >= w:
        return {"tip_y": None, "length": None, "body_contrast": None, "confident": False}

    def contrast(r: int) -> float:
        b = y[max(0, r - 2): r + 3].mean(axis=0)
        side = np.r_[b[cx - s1: cx - s0], b[cx + s0: cx + s1]]
        return float(np.median(side) - b[cx - hw: cx + hw + 1].min())

    start, stop = int((ly - 0.03) * h), int(0.02 * h)
    body = [contrast(r) for r in range(int((ly - 0.10) * h), start) if r > 0]
    ref = float(np.median(body)) if body else 0.0
    thr = max(6.0, 0.35 * ref)
    tip, miss = None, 0
    for r in range(start, stop, -1):
        if contrast(r) >= thr:
            tip, miss = r, 0
        else:
            miss += 1
            if miss > 0.01 * h:
                break
    if tip is None:
        return {"tip_y": None, "length": None, "body_contrast": round(ref, 1), "confident": False}
    return {"tip_y": round(tip / h, 4), "length": round(ly - tip / h, 4), "body_contrast": round(ref, 1),
            "confident": ref >= 12.0 and tip > stop + 2}


def _recentre_module():
    """recentre-key.py's crop and gamma arithmetic (one source of truth for the commit simulation)."""
    import importlib.util
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "recentre-key.py")
    spec = importlib.util.spec_from_file_location("recentre_key", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def t0_metrics(path: str, stage: str = "final", min_f: float = T0_MIN_F, sim_out: str | None = None) -> dict:
    im = crop_169(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))
    failures: list[str] = []
    flags: list[str] = []
    notes: list[str] = []
    sim = None
    if stage == "raw":
        lamp0 = lamp_in_window(luma(np.asarray(im, dtype=np.float32)), T0_LAMP_BAND)
        sim = {"input_dims": list(Image.open(path).size), "dims_169": list(im.size), "lamp_raw": lamp0["centroid"]}
        if lamp0["centroid"] is None:
            failures.append("no lamp in x 0.40-0.60, y 0.25-0.45 (raw)")
        else:
            rk = _recentre_module()
            f, box = rk.plan_crop(im.width, im.height, lamp0["centroid"][0], lamp0["centroid"][1], *T0_LAMP)
            sim.update(f=round(f, 4), box=list(box))
            if f < min_f:
                failures.append(f"lamp not crop-fixable: re-centring to (0.50, 0.35) needs f {f:.4f} < {min_f}")
            else:
                im = im.crop(box)
                g = rk.fit_gamma(im, *T0_MEAN_Y)
                im = rk.apply_gamma(im, g)
                sim.update(gamma=g, dims=list(im.size))
                if sim_out:
                    im.save(sim_out)
                    sim["out"] = sim_out
                if not 0.80 <= g <= 1.25:
                    flags.append(f"commit gamma {g} is a large correction (judge the grade)")
    rgb = np.asarray(im, dtype=np.float32)
    h, w, _ = rgb.shape
    y = luma(rgb)
    m: dict = {}
    m["mean_y"] = round(float(y.mean()), 2)
    m["top_quarter_y"] = round(float(y[: h // 4].mean()), 2)
    m["fog_sea_y"] = round(float(y[int(T0_FOG_ROWS[0] * h): int(T0_FOG_ROWS[1] * h)].mean()), 2)
    amber = amber_mask(rgb)
    m["amber_pct"] = round(float(amber.mean() * 100), 3)
    left = y[:, : w // 4]
    m["left_quarter_y"] = round(float(left.mean()), 2)
    m["left_quarter_texture"] = round(texture(left), 2)
    m["left_quarter_detail"] = round(highpass_detail(left), 2)

    lamp = lamp_in_window(y, T0_LAMP_BAND)
    m["lamp"] = lamp
    m["lamp_centroid"] = lamp["centroid"]
    if lamp["centroid"] is None:
        failures.append("no lamp in x 0.40-0.60, y 0.25-0.45")
        lx, ly = T0_LAMP
    else:
        lx, ly = lamp["centroid"]
        m["lamp_dx"], m["lamp_dy"] = round(lx - T0_LAMP[0], 4), round(ly - T0_LAMP[1], 4)
        if abs(m["lamp_dx"]) > T0_LAMP_TOL[0]:
            failures.append(f"lamp x off by {m['lamp_dx']:+.4f} (>{T0_LAMP_TOL[0]})")
        if abs(m["lamp_dy"]) > T0_LAMP_TOL[1]:
            failures.append(f"lamp y off by {m['lamp_dy']:+.4f} (>{T0_LAMP_TOL[1]})")
        if lamp["n_blobs"] > 1:
            flags.append(f"second bright blob in the lamp band at {lamp['second']['centroid']} (judge: doubled lamp?)")
        if lamp["mode"] != "core":
            flags.append(f"lamp core below Y {LAMP_CORE:g} (peak {lamp['peak']})")

    lo, hi = T0_MEAN_Y
    if not lo <= m["mean_y"] <= hi:
        failures.append(f"mean Y {m['mean_y']} outside {lo:g}-{hi:g}")
    if m["top_quarter_y"] > T0_TOP_QUARTER_MAX:
        failures.append(f"top quarter Y {m['top_quarter_y']} > {T0_TOP_QUARTER_MAX:g}")
    if not T0_FOG_Y[0] <= m["fog_sea_y"] <= T0_FOG_Y[1]:
        failures.append(f"fog sea (rows {T0_FOG_ROWS[0]}-{T0_FOG_ROWS[1]}) Y {m['fog_sea_y']} outside "
                        f"{T0_FOG_Y[0]:g}-{T0_FOG_Y[1]:g}")
    if m["amber_pct"] > T0_AMBER_MAX:
        failures.append(f"amber {m['amber_pct']}% > {T0_AMBER_MAX:g}%")
    if m["left_quarter_detail"] > T0_LEFT_DETAIL_FAIL:
        failures.append(f"left quarter not quiet: detail {m['left_quarter_detail']} > {T0_LEFT_DETAIL_FAIL:g}")
    elif m["left_quarter_detail"] > T0_LEFT_DETAIL_FLAG:
        flags.append(f"left quarter detail {m['left_quarter_detail']} > {T0_LEFT_DETAIL_FLAG:g} (judge)")

    # Warm outside the amber uses: allowed = lamp disc (6 % of height), the beam wedge to camera-right, the tower
    # column (|x - lx| <= 0.012: aviation lights on the mast and the pod's window band).
    yy, xx = np.mgrid[0:h, 0:w]
    fx, fy = xx / w, yy / h
    disc = ((fx - lx) * w) ** 2 + ((fy - ly) * h) ** 2 <= (0.06 * h) ** 2
    wedge = (fx >= lx) & (np.abs(fy - ly) <= 0.035 + 0.10 * (fx - lx))
    column = np.abs(fx - lx) <= 0.012
    warm_out = warm_mask(rgb) & ~(disc | wedge | column)
    m["warm_outside_pct"] = round(float(warm_out.mean() * 100), 4)
    if warm_out.any():
        wy, wx = np.nonzero(warm_out)
        m["warm_outside_centroid"] = [round(float(wx.mean() / w), 4), round(float(wy.mean() / h), 4)]
    if m["warm_outside_pct"] > T0_WARM_FAIL:
        failures.append(f"warm outside the lamp/beam {m['warm_outside_pct']}% > {T0_WARM_FAIL:g}% "
                        f"(city lights, ferry, sunset?) near {m.get('warm_outside_centroid')}")
    elif m["warm_outside_pct"] > T0_WARM_FLAG:
        flags.append(f"warm outside the lamp/beam {m['warm_outside_pct']}% > {T0_WARM_FLAG:g}% (judge)")

    # Tower scale: mast tip to lamp vs K3.
    mast = mast_length(y, lx, ly)
    m["mast"] = mast
    if mast["length"] is not None:
        m["scale_vs_k3"] = round(mast["length"] / T0_K3_MAST, 4)
        off = m["scale_vs_k3"] - 1
        if abs(off) > T0_SCALE_TOL:
            (failures if mast["confident"] else flags).append(
                f"tower scale {m['scale_vs_k3']:.3f} x K3 (mast {mast['length']} vs {T0_K3_MAST})"
                + ("" if mast["confident"] else " (low-confidence reading; judge)"))
        elif not mast["confident"]:
            notes.append("mast reading low-confidence (veils over the mast?)")
    else:
        m["scale_vs_k3"] = None
        flags.append("mast tip not found (judge the tower scale)")

    # Fog-sea surface: the strongest change (either sign) of the row profile left of the tower (x 0.05-0.45; the
    # beam runs to camera-right) between y 0.36 (below the pod) and 0.62; a rough reading, flag only.
    rows = y[:, int(0.05 * w): int(0.45 * w)].mean(axis=1)
    k = max(3, int(0.01 * h))
    sm = np.convolve(rows, np.ones(k) / k, mode="same")
    r0, r1 = int(0.36 * h), int(0.62 * h)
    step = max(2, int(0.02 * h))
    rise = sm[r0 + step: r1 + step] - sm[r0 - step: r1 - step]
    i = int(np.abs(rise).argmax())
    m["fog_surface_y_estimate"] = round((r0 + i) / h, 4)
    m["fog_surface_step"] = round(float(rise[i]), 2)
    if not T0_SURFACE[0] <= m["fog_surface_y_estimate"] <= T0_SURFACE[1]:
        flags.append(f"fog surface estimate y {m['fog_surface_y_estimate']} outside {T0_SURFACE[0]}-{T0_SURFACE[1]} "
                     "(rough; judge)")

    res = {"file": path, "dims": [w, h], "key": "T0", "profile": "t0", "stage": stage, "metrics": m,
           "failures": failures, "flags": flags, "notes": notes,
           "verdict": "fail" if failures else "flag" if flags else "pass", "objective_reject": bool(failures)}
    if sim is not None:
        res["simulated"] = sim
    return res


# ---------------------------------------------------------------- clip


def ffprobe(path: str) -> dict:
    p = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
             "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration,pix_fmt",
             "-of", "json", path])
    st = json.loads(p.stdout)["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    return {
        "width": int(st["width"]), "height": int(st["height"]),
        "fps": round(int(num) / int(den), 3), "frames": int(st["nb_read_frames"]),
        "duration": round(float(st.get("duration", 0)), 3), "pix_fmt": st.get("pix_fmt"),
    }


def extract_frame(clip: str, n: int, out: str) -> None:
    run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-vf", f"select=eq(n\\,{n})", "-fps_mode", "passthrough",
         "-frames:v", "1", out])


def ssim(a: str, b: str) -> float:
    """SSIM of image a against image b (b is scaled to a's size)."""
    w, h = Image.open(a).size
    p = run(["ffmpeg", "-v", "info", "-i", a, "-i", b, "-filter_complex",
             f"[1:v]scale={w}:{h}:flags=lanczos,format=gbrp[r];[0:v]format=gbrp[m];[m][r]ssim=stats_file=-",
             "-f", "null", "-"], check=False)
    m = re.findall(r"All:([0-9.]+)", p.stderr)
    return float(m[-1]) if m else float("nan")


def series(clip: str, vf: str) -> list[float]:
    p = run(["ffmpeg", "-v", "error", "-i", clip, "-vf", f"{vf},metadata=print:key=lavfi.signalstats.YAVG:file=-",
             "-f", "null", "-"], check=False)
    return [float(v) for v in re.findall(r"lavfi\.signalstats\.YAVG=([0-9.]+)", p.stdout)]


def series_stats(vals: list[float]) -> dict:
    if len(vals) < 3:
        return {"n": len(vals)}
    arr = np.asarray(vals)
    steps = np.abs(np.diff(arr))
    t = np.arange(len(arr))
    trend = np.polyval(np.polyfit(t, arr, 1), t)
    resid = arr - trend
    return {
        "n": len(vals), "start": round(float(arr[0]), 2), "end": round(float(arr[-1]), 2),
        "min": round(float(arr.min()), 2), "max": round(float(arr.max()), 2),
        "max_step": round(float(steps.max()), 3), "max_step_at": int(steps.argmax()) + 1,
        "max_trend_residual": round(float(np.abs(resid).max()), 3),
        "max_rise_above_start": round(float((arr - arr[0]).max()), 3),
    }


def clip_metrics(clip: str, prev: str, nxt: str, out_dir: str, tag: str, tophalf: bool) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    info = ffprobe(clip)
    n = info["frames"]
    res: dict = {"clip": clip, "tag": tag, "probe": info, "files": {}}

    first = os.path.join(out_dir, f"{tag}_first.png")
    last = os.path.join(out_dir, f"{tag}_last.png")
    extract_frame(clip, 0, first)
    extract_frame(clip, n - 1, last)
    res["files"]["first"] = first
    res["files"]["last"] = last
    samples = []
    for frac in (0.25, 0.5, 0.75):
        idx = int(round((n - 1) * frac))
        p = os.path.join(out_dir, f"{tag}_f{idx:04d}.png")
        extract_frame(clip, idx, p)
        samples.append(p)
    res["files"]["samples"] = samples

    # Centre crops of first / middle / last for the marks judge.
    crops = []
    for src in (first, samples[1], last):
        im = Image.open(src)
        w, h = im.size
        crop = im.crop((int(w * 0.35), 0, int(w * 0.65), h))
        dst = src.replace(".png", "_centre.png")
        crop.save(dst)
        crops.append(dst)
    res["files"]["centre_crops"] = crops

    # Boundary agreement.
    res["ssim_first"] = round(ssim(first, prev), 4)
    res["ssim_last"] = round(ssim(last, nxt), 4)
    yf, yp = luma(load_rgb(first)), luma(load_rgb(prev))
    yl, yn = luma(load_rgb(last)), luma(load_rgb(nxt))
    res["dy_first"] = round(float(yf.mean() - yp.mean()), 3)
    res["dy_last"] = round(float(yl.mean() - yn.mean()), 3)
    res["y_prev"] = round(float(yp.mean()), 2)
    res["y_next"] = round(float(yn.mean()), 2)
    if tophalf:
        hl, hn = yl.shape[0] // 2, yn.shape[0] // 2
        res["dy_last_tophalf"] = round(float(yl[:hl].mean() - yn[:hn].mean()), 3)
        res["last_tophalf_yavg"] = round(float(yl[:hl].mean()), 2)

    # Per-frame series (relative; ffmpeg limited-range offset cancels).
    full = series(clip, "signalstats")
    res["head_pop"] = round(abs(full[1] - full[0]), 3) if len(full) > 1 else 0.0  # frame 0 is the pasted start image
    res["y_series"] = series_stats(full[1:])
    res["diff_series"] = {}
    diffs = series(clip, "tblend=all_mode=difference,signalstats")[1:]
    if diffs:
        d = np.asarray(diffs[1:]) if len(diffs) > 1 else np.asarray(diffs)
        med = float(np.median(d))
        res["diff_series"] = {"median": round(med, 3), "max": round(float(d.max()), 3),
                              "max_over_median": round(float(d.max() / med), 2) if med > 0 else None,
                              "max_at": int(d.argmax()) + 1}
    if tophalf:
        res["y_series_tophalf"] = series_stats(series(clip, "crop=iw:ih/2:0:0,signalstats")[1:])

    # Scrub sheet: every 6th frame, 6x4 tiles.
    scrub = os.path.join(out_dir, f"{tag}_scrub.png")
    run(["ffmpeg", "-v", "error", "-y", "-i", clip, "-vf",
         "select='not(mod(n,6))',scale=480:-2,tile=6x4:padding=4:margin=4:color=0x070b16",
         "-fps_mode", "vfr", "-frames:v", "1", scrub])
    res["files"]["scrub_sheet"] = scrub

    # Join sheet: [prev | first] over [last | next].
    join = os.path.join(out_dir, f"{tag}_joins.png")
    make_sheet([prev, first, last, nxt], join, cols=2, labels=["K(i-1)", "clip first", "clip last", "K(i)"],
               tile_width=960)
    res["files"]["join_sheet"] = join

    # Objective verdicts.
    flags = []
    if not (info["width"] == 1920 and 1080 <= info["height"] <= 1088):
        flags.append(f"dims {info['width']}x{info['height']}")
    elif info["height"] != 1080:
        res["padding_rows"] = info["height"] - 1080  # codec padding; build-film.sh crops it (soft, informational)
    if not (5.8 <= info["duration"] <= 6.3):
        flags.append(f"duration {info['duration']}s")
    if res["ssim_first"] < 0.90:
        flags.append("ssim_first<0.90" + (" (soft)" if res["ssim_first"] >= 0.85 else ""))
    if res["ssim_last"] < 0.75:
        flags.append("ssim_last<0.75 (end_frame)")
    elif res["ssim_last"] < 0.85:
        flags.append("ssim_last 0.75-0.85 (judge)")
    if abs(res["dy_first"]) > max(1.5, 0.03 * res["y_prev"]):
        flags.append("dy_first")
    if abs(res["dy_last"]) > max(1.5, 0.03 * res["y_next"]):
        flags.append("dy_last (end_frame)")
    ys = res["y_series"]
    if ys.get("max_step", 0) > 1.0:
        flags.append("y step>1.0 (flicker/strobe)")
    if ys.get("max_trend_residual", 0) > 3.0:
        flags.append("y residual>3.0 (pump)")
    if tophalf and res.get("y_series_tophalf", {}).get("max_rise_above_start", 0) > 1.0:
        flags.append("clip04 top-half brightens>1.0")
    ds = res["diff_series"]
    if ds.get("median", 0) > 4.0:
        flags.append("diff median>4.0 (boiling)")
    elif ds.get("median", 0) > 2.5:
        flags.append("diff median 2.5-4.0 (judge)")
    if ds.get("max_over_median") and ds["max_over_median"] > 4:
        flags.append("diff snap (judge)")
    res["flags"] = flags
    hard = [f for f in flags if "(judge)" not in f and "(soft)" not in f]
    res["objective_reject"] = bool(hard)
    res["hard_flags"] = hard
    return res


# ---------------------------------------------------------------- seq (a rendered frame sequence)

SEQ_EXTS = (".png", ".webp")
SEQ_WIDTH = 480  # frames are compared at this width, which keeps a 900-frame film to a minute or two
SEQ_CLIP_Y = 250.0  # "clipped" = Y at or above this (0..255)
SEQ_DIFF_FLOOR = 0.05  # median-diff floor, so a pop is not flagged on every move after a long static hold


def natural_key(name: str) -> list:
    """Natural sort key (f_2 < f_10; f_00001 works too). re.split alternates str, int, str, ... so keys compare."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def seq_files(dir_: str) -> list[str]:
    names = [n for n in os.listdir(dir_) if n.lower().endswith(SEQ_EXTS) and not n.startswith(".")]
    return [os.path.join(dir_, n) for n in sorted(names, key=natural_key)]


def webp_ok() -> bool:
    try:
        from PIL import features
        return bool(features.check("webp"))
    except Exception:
        return False


def seq_luma_pil(path: str) -> np.ndarray:
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        small = im.resize((SEQ_WIDTH, max(1, round(h * SEQ_WIDTH / w))), Image.BOX)
    return luma(np.asarray(small, dtype=np.float32))


def seq_luma_ffmpeg(path: str) -> np.ndarray:
    """Same reduction through ffmpeg (raw RGB, then the same Rec.709 luma) for a PIL build without WebP."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-frames:v", "1",
                        "-vf", f"scale={SEQ_WIDTH}:-2:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True)
    row = SEQ_WIDTH * 3
    if p.returncode != 0 or not p.stdout or len(p.stdout) % row:
        raise SystemExit(f"ffmpeg could not decode {path}: {p.stderr.decode(errors='replace').strip()}")
    rgb = np.frombuffer(p.stdout, dtype=np.uint8).reshape(-1, SEQ_WIDTH, 3).astype(np.float32)
    return luma(rgb)


def seq_metrics(dir_: str, pop: float, force_ffmpeg: bool = False) -> dict:
    files = seq_files(dir_)
    if not files:
        raise SystemExit(f"no .png/.webp frames in {dir_}")
    names = [os.path.basename(p) for p in files]
    use_ffmpeg = force_ffmpeg or (any(n.lower().endswith(".webp") for n in names) and not webp_ok())
    decode = seq_luma_ffmpeg if use_ffmpeg else seq_luma_pil
    n = len(files)

    mean_y: list[float] = []
    clip_pct: list[float] = []
    diff: list[float | None] = [None] * n  # diff[i]: mean |Y[i] - Y[i-1]|
    shimmer: list[float | None] = [None] * n  # shimmer[i]: mean |Y[i-1] - 2 Y[i] + Y[i+1]|
    prev = prev2 = None
    shape = None
    for i, path in enumerate(files):
        y = decode(path)
        if shape is None:
            shape = y.shape
        elif y.shape != shape:
            raise SystemExit(f"{names[i]} decodes to {y.shape[1]}x{y.shape[0]}, the first frame to {shape[1]}x{shape[0]}")
        mean_y.append(float(y.mean()))
        clip_pct.append(float((y >= SEQ_CLIP_Y).mean() * 100))
        if prev is not None:
            diff[i] = float(np.abs(y - prev).mean())
        if prev2 is not None:
            shimmer[i - 1] = float(np.abs(prev2 - 2.0 * prev + y).mean())
        prev2, prev = prev, y

    # Frame numbers below are 1-based positions in the sorted list, not the numbers inside the file names.
    ys = series_stats(mean_y)
    if "max_step_at" in ys:
        ys["max_step_at"] += 1  # series_stats counts from 0; the step lands on this (1-based) frame
    res: dict = {
        "dir": dir_, "n": n, "decoder": "ffmpeg" if use_ffmpeg else "pil", "dims": [shape[1], shape[0]],
        "pop_threshold": pop, "files": names,
        "mean_y": [round(v, 3) for v in mean_y],
        "diff": [None if v is None else round(v, 4) for v in diff],
        "shimmer": [None if v is None else round(v, 4) for v in shimmer],
        "clip_pct": [round(v, 4) for v in clip_pct],
        "y_series": ys,
        "drift": {"first": round(mean_y[0], 2), "last": round(mean_y[-1], 2),
                  "delta": round(mean_y[-1] - mean_y[0], 3)},
    }

    d = np.asarray([v for v in diff if v is not None])
    res["diff_series"] = {}
    pops: list[dict] = []
    if d.size:
        med = float(np.median(d))
        base = max(med, SEQ_DIFF_FLOOR)
        res["diff_series"] = {"median": round(med, 4), "max": round(float(d.max()), 4),
                              "max_over_median": round(float(d.max()) / base, 2),
                              "max_at": int(np.nanargmax([np.nan if v is None else v for v in diff])) + 1}
        for i, v in enumerate(diff):
            if v is not None and v > pop * base:
                pops.append({"frame": i + 1, "file": names[i], "diff": round(v, 4), "over_median": round(v / base, 2)})
    s = np.asarray([v for v in shimmer if v is not None])
    res["shimmer_series"] = {}
    if s.size:
        res["shimmer_series"] = {"median": round(float(np.median(s)), 4), "max": round(float(s.max()), 4),
                                 "max_at": int(np.nanargmax([np.nan if v is None else v for v in shimmer])) + 1}
    cp = np.asarray(clip_pct)
    res["clip"] = {"max_pct": round(float(cp.max()), 4), "max_at": int(cp.argmax()) + 1,
                   "frames_with_clipping": int((cp > 0).sum())}
    res["pops"] = pops
    res["flags"] = [f"pop @ frame {p['frame']} ({p['file']}): diff {p['diff']:.2f} = {p['over_median']:.1f}x median"
                    for p in pops]
    return res


def print_seq(res: dict, full: bool) -> None:
    n = res["n"]
    names = res["files"]
    pop_frames = {p["frame"] for p in res["pops"]}
    # A long film prints every ~n/40th row plus the ends and each pop with the frame before it; --full prints all.
    step = 1 if full or n <= 48 else -(-n // 40)
    show = {i for i in range(n) if i % step == 0 or i == n - 1}
    for f in pop_frames:
        show.update({f - 1, f - 2})
    show = sorted(i for i in show if 0 <= i < n)
    wname = min(24, max(len(x) for x in names))

    def cell(v: float | None, spec: str, width: int) -> str:
        return ("-" if v is None else format(v, spec)).rjust(width)

    print(f"{res['dir']}: {n} frames, decoded {res['dims'][0]}x{res['dims'][1]} ({res['decoder']}), "
          f"pop > {res['pop_threshold']:g}x median")
    print(f"{'#':>5}  {'file':<{wname}} {'meanY':>7} {'dY':>7} {'diff':>7} {'shimmer':>8} {'clip%':>6}")
    if len(show) < n:
        print(f"(every {step}th frame, the last, and each pop with the frame before it; --full prints all {n})")
    for i in show:
        dy = None if i == 0 else res["mean_y"][i] - res["mean_y"][i - 1]
        mark = "  <- pop" if (i + 1) in pop_frames else ""
        print(f"{i + 1:>5}  {names[i][:wname]:<{wname}} {res['mean_y'][i]:7.2f} {cell(dy, '+.2f', 7)} "
              f"{cell(res['diff'][i], '.3f', 7)} {cell(res['shimmer'][i], '.3f', 8)} {res['clip_pct'][i]:6.2f}{mark}")
    ys, ds, ss, cl, dr = res["y_series"], res["diff_series"], res["shimmer_series"], res["clip"], res["drift"]
    print()
    print(f"mean Y   range {ys.get('min', dr['first'])}..{ys.get('max', dr['first'])}"
          + (f"  max step {ys['max_step']} @ {ys['max_step_at']}  max trend residual {ys['max_trend_residual']}"
             if "max_step" in ys else ""))
    print(f"drift    first {dr['first']}  last {dr['last']}  delta {dr['delta']:+.2f}")
    if ds:
        print(f"diff     median {ds['median']}  max {ds['max']} @ {ds['max_at']}  ({ds['max_over_median']}x median)")
    if ss:
        print(f"shimmer  median {ss['median']}  max {ss['max']} @ {ss['max_at']}")
    print(f"clip     max {cl['max_pct']}% @ {cl['max_at']}  frames with any clipping {cl['frames_with_clipping']}/{n}")
    print(f"flags    {len(res['flags']) or 'none'}")
    for f in res["flags"]:
        print(f"  {f}")


# ---------------------------------------------------------------- lamp (per-frame lamp tracking, part five)

LAMP_COUNT_CHANGE = 0.40
LAMP_COUNT_FLOOR = 20.0  # core px at 1920 width; count changes are ignored while both frames are below this
LAMP_STEADY_TOL = 0.15


def crop_rows_169(rgb: np.ndarray) -> np.ndarray:
    """Centre-crop rows to 16:9 as build-film.sh does (FLUX's 1920x1088 -> 1920x1080); wider frames untouched."""
    h, w = rgb.shape[:2]
    oh = min(h, int(w * 9 / 16 / 2) * 2)
    y0 = (h - oh) // 2
    return rgb[y0: y0 + oh]


def iter_frames_rgb(src: str):
    """(n, name, rgb float32) for a directory of png/webp frames (natural order) or every frame of a video."""
    if os.path.isdir(src):
        files = seq_files(src)
        if not files:
            raise SystemExit(f"no .png/.webp frames in {src}")
        for n, p in enumerate(files):
            with Image.open(p) as im:
                rgb = np.asarray(ImageOps.exif_transpose(im).convert("RGB"), dtype=np.float32)
            yield n, os.path.basename(p), crop_rows_169(rgb)
        return
    p = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
             "-of", "json", src])
    st = json.loads(p.stdout)["streams"][0]
    w, h = int(st["width"]), int(st["height"])
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                            stdout=subprocess.PIPE)
    size = w * h * 3
    n = 0
    try:
        while True:
            buf = proc.stdout.read(size)
            if len(buf) < size:
                break
            rgb = np.frombuffer(buf, dtype=np.uint8).reshape(h, w, 3).astype(np.float32)
            yield n, f"n={n}", crop_rows_169(rgb)
            n += 1
    finally:
        proc.stdout.close()
        proc.wait()
    if n == 0:
        raise SystemExit(f"ffmpeg decoded no frames from {src}")


def lamp_series(src: str, window: tuple[float, float, float, float], target: tuple[float, float],
                tol: tuple[float, float], start: int = 0, core: float = LAMP_CORE,
                count_change: float = LAMP_COUNT_CHANGE, count_floor: float = LAMP_COUNT_FLOOR,
                merge: float = LAMP_MERGE, min_area: float = LAMP_MIN_AREA,
                second_frac: float = LAMP_SECOND_FRAC, second_elong: float = LAMP_SECOND_ELONG) -> dict:
    frames: list[dict] = []
    dims = None
    for n, name, rgb in iter_frames_rgb(src):
        y = luma(rgb)
        dims = [y.shape[1], y.shape[0]]
        r = lamp_in_window(y, window, core, merge, min_area, second_frac, second_elong)
        r = {"n": n, "file": name, **r}
        if r["centroid"] is not None:
            r["dx"] = round(r["centroid"][0] - target[0], 4)
            r["dy"] = round(r["centroid"][1] - target[1], 4)
        frames.append(r)

    checked = [f for f in frames if f["n"] >= start]
    off, multi, missing, jumps = [], [], [], []
    prev = None
    for f in checked:
        why = []
        if f["centroid"] is None:
            missing.append(f["n"])
            why.append("no lamp")
        else:
            if abs(f["dx"]) > tol[0] or abs(f["dy"]) > tol[1]:
                off.append(f["n"])
                why.append(f"off target ({f['dx']:+.4f}, {f['dy']:+.4f})")
            if f["n_blobs"] > 1:
                multi.append(f["n"])
                why.append(f"{f['n_blobs']} blobs (second at {f['second']['centroid']})")
        c = f["lamp_core_px_1920"]
        if prev is not None:
            p = prev["lamp_core_px_1920"]
            if max(p, c) >= count_floor:
                ch = abs(c - p) / max(p, count_floor)
                f["count_change"] = round(ch, 3)
                if ch > count_change:
                    jumps.append({"n": f["n"], "prev": p, "cur": c, "change": round(ch, 3)})
                    why.append(f"core count {p:g} -> {c:g} ({ch:.0%})")
        f["ok"] = not why
        f["why"] = why
        prev = f

    res: dict = {"src": src, "frames": len(frames), "from": start, "checked": len(checked), "dims": dims,
                 "window": list(window), "target": list(target), "tol": list(tol), "core": core,
                 "count_change_max": count_change, "count_floor_1920": count_floor}
    with_c = [f for f in checked if f["centroid"] is not None]
    if with_c:
        wdx = max(with_c, key=lambda f: abs(f["dx"]))
        wdy = max(with_c, key=lambda f: abs(f["dy"]))
        res["max_abs_dx"] = {"value": abs(wdx["dx"]), "n": wdx["n"]}
        res["max_abs_dy"] = {"value": abs(wdy["dy"]), "n": wdy["n"]}
        res["mean_centroid"] = [round(float(np.mean([f["centroid"][0] for f in with_c])), 4),
                                round(float(np.mean([f["centroid"][1] for f in with_c])), 4)]
    counts = [f["lamp_core_px_1920"] for f in checked]
    if counts:
        tail = counts[-12:]
        ref = float(np.median(tail))
        band = LAMP_STEADY_TOL * max(ref, count_floor)
        steady = len(counts)
        for i in range(len(counts) - 1, -1, -1):
            if abs(counts[i] - ref) <= band:
                steady = i
            else:
                break
        res["lamp_core_px_1920"] = {"first": counts[0], "last": counts[-1], "min": min(counts), "max": max(counts),
                               "median": float(np.median(counts)), "tail_median": ref}
        res["steady_from"] = checked[steady]["n"] if steady < len(checked) else None
    res["modes"] = {m: sum(1 for f in checked if f["mode"] == m) for m in ("core", "rel", "none")}
    res["max_count_change"] = max((f.get("count_change", 0.0) for f in checked), default=0.0)

    def span(ns: list[int]) -> str:
        return ", ".join(str(x) for x in ns[:12]) + (f" ... ({len(ns)} frames)" if len(ns) > 12 else "")

    failures = []
    if missing:
        failures.append(f"no lamp in the window on frames {span(missing)}")
    if off:
        failures.append(f"lamp off target (tol {tol[0]}, {tol[1]}) on frames {span(off)}; worst |dx| "
                        f"{res['max_abs_dx']['value']} @ {res['max_abs_dx']['n']}, |dy| "
                        f"{res['max_abs_dy']['value']} @ {res['max_abs_dy']['n']}")
    if multi:
        failures.append(f"more than one blob on frames {span(multi)}")
    if jumps:
        worst = max(jumps, key=lambda j: j["change"])
        failures.append(f"core count changed > {count_change:.0%} frame to frame on frames "
                        f"{span([j['n'] for j in jumps])}; worst {worst['prev']:g} -> {worst['cur']:g} @ {worst['n']}")
    res["off_target"] = off
    res["multi_blob"] = multi
    res["no_lamp"] = missing
    res["count_jumps"] = jumps
    res["failures"] = failures
    res["verdict"] = "fail" if failures else "pass"
    res["series"] = frames
    return res


# ---------------------------------------------------------------- sheets


def make_sheet(paths: list[str], out: str, cols: int, labels: list[str] | None, tile_width: int) -> None:
    tiles = []
    for p in paths:
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        w, h = im.size
        th = int(round(h * tile_width / w))
        tiles.append(im.resize((tile_width, th), Image.LANCZOS))
    th = max(t.height for t in tiles)
    label_h = 36 if labels else 0
    pad = 8
    rows = math.ceil(len(tiles) / cols)
    sheet = Image.new("RGB", (cols * tile_width + (cols + 1) * pad, rows * (th + label_h) + (rows + 1) * pad),
                      (7, 11, 22))
    draw = ImageDraw.Draw(sheet)
    f = font(20)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        x = pad + c * (tile_width + pad)
        y = pad + r * (th + label_h + pad)
        if labels and i < len(labels):
            draw.text((x + 6, y + 7), labels[i], fill=(240, 166, 60), font=f)
        sheet.paste(t, (x, y + label_h))
    sheet.save(out)


def split_labels(arg: str | None, n: int) -> list[str] | None:
    """--labels a,b,c -> list; warns on stderr when the count does not match the images (K0 … K7 = 8)."""
    if not arg:
        return None
    labels = arg.split(",")
    if len(labels) != n:
        print(f"warning: {len(labels)} labels for {n} images", file=sys.stderr)
    return labels


def phone_crop(path: str, width: int, height: int) -> Image.Image:
    """What fit="cover" with focus x=0.5 shows on a width×height portrait screen."""
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = im.size
    cw = int(round(h * width / height))
    x0 = (w - cw) // 2
    return im.crop((x0, 0, x0 + cw, h)).resize((width, height), Image.LANCZOS)


def make_phone_strip(paths: list[str], out: str, labels: list[str] | None, width: int, height: int) -> None:
    crops = [phone_crop(p, width, height) for p in paths]
    pad, label_h = 8, 30 if labels else 0
    strip = Image.new("RGB", (len(crops) * width + (len(crops) + 1) * pad, height + label_h + 2 * pad), (7, 11, 22))
    draw = ImageDraw.Draw(strip)
    f = font(18)
    for i, c in enumerate(crops):
        x = pad + i * (width + pad)
        if labels and i < len(labels):
            draw.text((x + 6, pad + 4), labels[i], fill=(240, 166, 60), font=f)
        strip.paste(c, (x, pad + label_h))
    strip.save(out)


# ---------------------------------------------------------------- join (clip last frame -> next keyframe)

JOIN_SIZE = (1280, 720)  # both sides are centre-cropped to 16:9, then resized to this
JOIN_SSIM_MIN = 0.93  # raw pair (ffmpeg ssim, as clip's ssim_last) must reach this ...
JOIN_DY_MAX = 4.0  # ... with |raw mean-Y delta| (as clip's dy_last) no larger than this
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".webm", ".mkv")


def parse_hex_rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", s):
        raise ValueError(s)
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def crop_169(im: Image.Image) -> Image.Image:
    """Centre-crop to 16:9 (2752x1536 -> 2731x1536, 1920x1088 -> 1920x1080); a frame already within 0.2 % is kept."""
    w, h = im.size
    if abs(w / h - 16 / 9) / (16 / 9) <= 0.002:
        return im
    if w / h > 16 / 9:
        cw = int(round(h * 16 / 9))
        x0 = (w - cw) // 2
        return im.crop((x0, 0, x0 + cw, h))
    ch = int(round(w * 9 / 16))
    y0 = (h - ch) // 2
    return im.crop((0, y0, w, y0 + ch))


def load_join_image(path: str) -> Image.Image:
    im = crop_169(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))
    return im.resize(JOIN_SIZE, Image.LANCZOS)


def gaussian_window(size: int = 11, sigma: float = 1.5) -> np.ndarray:
    ax = np.arange(size, dtype=np.float64) - (size - 1) / 2
    k = np.exp(-(ax ** 2) / (2 * sigma ** 2))
    return k / k.sum()


def gaussian_filter_valid(a: np.ndarray, k: np.ndarray) -> np.ndarray:
    """Separable 'valid' Gaussian filtering (rows, then columns) as a sum of shifted slices."""
    n = len(k)
    hh, ww = a.shape[0] - n + 1, a.shape[1] - n + 1
    t = sum(k[i] * a[i : i + hh] for i in range(n))
    return sum(k[i] * t[:, i : i + ww] for i in range(n))


def ssim_luma(a: np.ndarray, b: np.ndarray, data_range: float = 255.0) -> float:
    """Mean SSIM of two 2-D luma arrays: Wang et al. 2004 (11x11 Gaussian window, sigma 1.5, K1 .01, K2 .03,
    population covariance, valid region only). numpy only, no scikit-image."""
    a, b = a.astype(np.float64), b.astype(np.float64)
    k = gaussian_window()
    c1, c2 = (0.01 * data_range) ** 2, (0.03 * data_range) ** 2
    mu_a, mu_b = gaussian_filter_valid(a, k), gaussian_filter_valid(b, k)
    var_a = gaussian_filter_valid(a * a, k) - mu_a ** 2
    var_b = gaussian_filter_valid(b * b, k) - mu_b ** 2
    cov = gaussian_filter_valid(a * b, k) - mu_a * mu_b
    s = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (var_a + var_b + c2))
    return float(s.mean())


def make_join_sheet(rows: list[tuple[str, Image.Image, Image.Image, str, str]], out: str, tile_width: int) -> None:
    """One row per (name, last, key, last_label, key_label); each image is followed by a centre crop
    (x 0.35-0.65, full height) shown at 200 % of the tile scale."""
    scale = tile_width / JOIN_SIZE[0]
    tw, th = tile_width, int(round(JOIN_SIZE[1] * scale))
    cx0, cx1 = int(round(JOIN_SIZE[0] * 0.35)), int(round(JOIN_SIZE[0] * 0.65))
    cw, ch = int(round((cx1 - cx0) * scale * 2)), int(round(JOIN_SIZE[1] * scale * 2))
    label_h, pad = 36, 8
    row_h = label_h + max(th, ch)
    sheet = Image.new("RGB", (2 * (tw + cw) + 5 * pad, len(rows) * (row_h + pad) + pad), (7, 11, 22))
    draw = ImageDraw.Draw(sheet)
    f = font(18)
    for r, (name, last, key, last_label, key_label) in enumerate(rows):
        y0 = pad + r * (row_h + pad)
        x = pad
        for tag, im, text in (("last", last, last_label), ("key", key, key_label)):
            draw.text((x + 6, y0 + 7), text, fill=(240, 166, 60), font=f)
            sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y0 + label_h))
            x += tw + pad
            draw.text((x + 6, y0 + 7), f"{name} {tag} x2 centre", fill=(240, 166, 60), font=f)
            sheet.paste(im.crop((cx0, 0, cx1, JOIN_SIZE[1])).resize((cw, ch), Image.LANCZOS), (x, y0 + label_h))
            x += cw + pad
    sheet.save(out)


def join_metrics(last: str, key: str, alpha: float, base_rgb: tuple[int, int, int], out: str | None,
                 tile_width: int) -> dict:
    res: dict = {"last": last, "key": key, "alpha": alpha, "base": "".join(f"{c:02x}" for c in base_rgb),
                 "compare_size": list(JOIN_SIZE),
                 "gate": f"ssim_raw >= {JOIN_SSIM_MIN} and |dy_raw| <= {JOIN_DY_MAX:g} "
                         "(ffmpeg ssim and full-frame mean-Y delta, exactly as clip's ssim_last / dy_last)"}
    with tempfile.TemporaryDirectory() as tmp:
        last_png = last
        if last.lower().endswith(VIDEO_EXT):
            n = ffprobe(last)["frames"]
            last_png = os.path.join(tmp, "last.png")
            extract_frame(last, n - 1, last_png)
            if not os.path.exists(last_png):
                raise SystemExit(f"could not extract frame {n - 1} from {last}")
            res["last_frame"] = {"from_video": True, "index": n - 1, "frames": n}
        else:
            res["last_frame"] = {"from_video": False}
        res["dims_in"] = {"last": list(Image.open(last_png).size), "key": list(Image.open(key).size)}

        # Gate: the raw pair, computed as clip computes ssim_last / dy_last (key scaled to the frame's size by
        # ffmpeg, full-frame luma, no crop).
        ssim_raw = round(ssim(last_png, key), 4)
        yl_raw, yk_raw = luma(load_rgb(last_png)), luma(load_rgb(key))
        m = {"ssim_raw": ssim_raw, "dy_raw": round(float(yl_raw.mean() - yk_raw.mean()), 3),
             "y_last_raw": round(float(yl_raw.mean()), 2), "y_key_raw": round(float(yk_raw.mean()), 2)}

        # Informational: the 16:9-cropped 1280x720 pair under the scrim (alpha * base + (1 - alpha) * image),
        # judged with the numpy Gaussian SSIM. Never part of the verdict.
        last_im, key_im = load_join_image(last_png), load_join_image(key)
    base = np.asarray(base_rgb, dtype=np.float32)
    comp_l = alpha * base + (1 - alpha) * np.asarray(last_im, dtype=np.float32)
    comp_k = alpha * base + (1 - alpha) * np.asarray(key_im, dtype=np.float32)
    yl_c, yk_c = luma(comp_l), luma(comp_k)
    m.update({"ssim_composited_gauss": round(ssim_luma(yl_c, yk_c), 4),
              "dy_composited": round(float(yl_c.mean() - yk_c.mean()), 3),
              "y_last_composited": round(float(yl_c.mean()), 2), "y_key_composited": round(float(yk_c.mean()), 2)})
    res["metrics"] = m

    failures = []
    if math.isnan(ssim_raw):
        failures.append("ssim_raw unavailable (ffmpeg ssim failed)")
    elif ssim_raw < JOIN_SSIM_MIN:
        failures.append(f"ssim_raw {ssim_raw} < {JOIN_SSIM_MIN}")
    if abs(m["dy_raw"]) > JOIN_DY_MAX:
        failures.append(f"|dy_raw| {abs(m['dy_raw'])} > {JOIN_DY_MAX:g}")
    res["failures"] = failures
    res["flags"] = []
    res["verdict"] = "fail" if failures else "pass"

    if out:
        def u8(a: np.ndarray) -> Image.Image:
            return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8))

        make_join_sheet(
            [("raw", last_im, key_im, f"raw last  Y {m['y_last_raw']:.2f}",
              f"raw key  Y {m['y_key_raw']:.2f}  SSIM(ffmpeg) {m['ssim_raw']:.4f}  dY {m['dy_raw']:+.2f}"),
             ("composited", u8(comp_l), u8(comp_k), f"composited last  Y {m['y_last_composited']:.2f}",
              f"composited key  Y {m['y_key_composited']:.2f}  SSIM(gauss) {m['ssim_composited_gauss']:.4f}"
              f"  dY {m['dy_composited']:+.2f}")], out, tile_width)
        res["out"] = out
    return res


# ---------------------------------------------------------------- ledger


def render_ledger(dir_: str, out: str, ceiling: int, title: str = "beacon") -> dict:
    start = {}
    sp = os.path.join(dir_, "_start.json")
    if os.path.exists(sp):
        start = json.load(open(sp))
    rows = []
    for p in sorted(glob.glob(os.path.join(dir_, "*.json"))):
        if os.path.basename(p).startswith("_"):
            continue
        try:
            rows.append(json.load(open(p)))
        except json.JSONDecodeError:
            continue
    rows.sort(key=lambda r: r.get("time", ""))
    total = 0.0
    lines = [f"# Ledger — {title}", "",
             f"Balance at start: {start.get('balance_start', '?')} · ceiling {ceiling} · rendered {now_iso()}", "",
             "| time | kind | model | item | attempt | prompt summary | credits | job id | status | reason |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        credits = r.get("credits_charged")
        if credits is None:
            credits = r.get("credits_preflight", 0)
        total += float(credits or 0)
        lines.append("| {time} | {kind} | {model} | {item} | {attempt} | {summary} | {credits} | {job} | {status} | {reason} |".format(
            time=r.get("time", ""), kind=r.get("kind", ""), model=r.get("model", ""),
            item=r.get("key_or_clip", "") + (f" {r['variant']}" if r.get("variant") else ""),
            attempt=r.get("attempt", ""), summary=str(r.get("prompt_summary", "")).replace("|", "/"),
            credits=credits, job=str(r.get("job_id", ""))[:8], status=r.get("status", ""),
            reason=str(r.get("reason", "")).replace("|", "/")))
    lines += ["", f"**Total credits (sidecars): {total:g} of {ceiling}** — remaining under ceiling: {ceiling - total:g}", ""]
    with open(out, "w") as fh:
        fh.write("\n".join(lines))
    return {"rows": len(rows), "total": total, "ceiling": ceiling, "remaining": ceiling - total}


# ---------------------------------------------------------------- main


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("still")
    s.add_argument("image")
    s.add_argument("--key")
    s.add_argument("--json")
    s.add_argument("--profile", choices=("beacon", "reel", "t0"),
                   help="default: reel when the path contains /films-src/reel/, otherwise beacon")
    s.add_argument("--prev", help="reel: metrics json of the previous key (K1-K3 and K7 mean-Y rules)")
    s.add_argument("--strict-regions", action="store_true",
                   help="reel: turn the provisional left-quarter / bottom-third ceilings (Y and texture) into hard fails")
    s.add_argument("--stage", choices=("final", "raw"), default="final",
                   help="t0: final = measure as is (the committed key); raw = simulate the commit (16:9 crop, "
                        "re-centre to (0.50, 0.35), gamma into 48-56) and measure that")
    s.add_argument("--min-f", type=float, default=T0_MIN_F, help="t0 --stage raw: smallest allowed re-centring crop")
    s.add_argument("--sim-out", help="t0 --stage raw: save the simulated committed frame (png) here")

    c = sub.add_parser("clip")
    c.add_argument("clip")
    c.add_argument("--prev", required=True)
    c.add_argument("--next", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--tag", required=True)
    c.add_argument("--tophalf", action="store_true")
    c.add_argument("--json")

    sq = sub.add_parser("seq")
    sq.add_argument("dir")
    sq.add_argument("--json")
    sq.add_argument("--pop", type=float, default=4.0, help="flag a frame whose diff exceeds POP x the median diff")
    sq.add_argument("--full", action="store_true", help="print every frame row (default: ~40 rows plus pops)")

    jn = sub.add_parser("join")
    jn.add_argument("--last", required=True, help="last frame of the clip: a png or a video (last frame is extracted)")
    jn.add_argument("--key", required=True, help="the keyframe png the clip should land on")
    jn.add_argument("--alpha", type=float, default=0.80)
    jn.add_argument("--base", default="070b16")
    jn.add_argument("--out")
    jn.add_argument("--tile-width", type=int, default=640)
    jn.add_argument("--json")

    sh = sub.add_parser("sheet")
    sh.add_argument("images", nargs="+")
    sh.add_argument("--out", required=True)
    sh.add_argument("--cols", type=int, default=2)
    sh.add_argument("--labels")
    sh.add_argument("--tile-width", type=int, default=960)

    ph = sub.add_parser("phone")
    ph.add_argument("images", nargs="+")
    ph.add_argument("--out", required=True)
    ph.add_argument("--labels")
    ph.add_argument("--width", type=int, default=390)
    ph.add_argument("--height", type=int, default=844)

    lg = sub.add_parser("ledger")
    lg.add_argument("--dir", required=True)
    lg.add_argument("--out", required=True)
    lg.add_argument("--ceiling", type=int, default=598)
    lg.add_argument("--title", default="beacon", help="film name in the ledger heading")

    lp = sub.add_parser("lamp")
    lp.add_argument("src", help="a clip (mp4/mov/...) or a directory of png/webp frames")
    lp.add_argument("--window", nargs=4, type=float, required=True, metavar=("X0", "X1", "Y0", "Y1"),
                    help="search window, fractions of the 16:9 frame")
    lp.add_argument("--target", nargs=2, type=float, required=True, metavar=("LX", "LY"))
    lp.add_argument("--tol", nargs="+", type=float, required=True, metavar="T",
                    help="centroid tolerance: one value for x and y, or two (x then y)")
    lp.add_argument("--from", dest="start", type=int, default=0,
                    help="first frame (0-based) the gates apply to; 1 skips FLUX's pasted start image")
    lp.add_argument("--core", type=float, default=LAMP_CORE)
    lp.add_argument("--count-change", type=float, default=LAMP_COUNT_CHANGE)
    lp.add_argument("--count-floor", type=float, default=LAMP_COUNT_FLOOR)
    lp.add_argument("--merge", type=float, default=LAMP_MERGE)
    lp.add_argument("--min-area", type=float, default=LAMP_MIN_AREA)
    lp.add_argument("--second-frac", type=float, default=LAMP_SECOND_FRAC)
    lp.add_argument("--second-elong", type=float, default=LAMP_SECOND_ELONG)
    lp.add_argument("--json")
    lp.add_argument("--full", action="store_true", help="also print the per-frame series on stdout")

    a = ap.parse_args(argv)
    if a.cmd == "still":
        profile = a.profile or ("reel" if "/films-src/reel/" in os.path.abspath(a.image).replace(os.sep, "/")
                                else "beacon")
        if profile != "t0" and (a.stage != "final" or a.min_f != T0_MIN_F or a.sim_out):
            ap.error("--stage / --min-f / --sim-out only apply to --profile t0")
        if a.sim_out and a.stage != "raw":
            ap.error("--sim-out needs --stage raw")
        if profile == "t0":
            if a.prev or a.strict_regions:
                ap.error("--prev / --strict-regions only apply to --profile reel")
            res = t0_metrics(a.image, a.stage, a.min_f, a.sim_out)
        elif profile == "reel":
            key = (a.key or reel_key_from_name(a.image) or "").upper()
            if key not in REEL_KEYS:
                ap.error(f"reel profile needs --key K0..K7 (got {a.key or os.path.basename(a.image)!r})")
            res = reel_metrics(a.image, key, reel_prev_mean_y(a.prev) if a.prev else None, a.strict_regions)
        else:
            if a.prev or a.strict_regions:
                ap.error("--prev / --strict-regions only apply to --profile reel")
            res = still_metrics(a.image, a.key)
    elif a.cmd == "clip":
        res = clip_metrics(a.clip, a.prev, a.next, a.out, a.tag, a.tophalf)
    elif a.cmd == "seq":
        if not os.path.isdir(a.dir):
            ap.error(f"not a directory: {a.dir}")
        if a.pop <= 0:
            ap.error("--pop must be positive")
        res = seq_metrics(a.dir, a.pop)
        print_seq(res, a.full)
        if a.json:
            with open(a.json, "w") as fh:
                fh.write(json.dumps(res, indent=2))
        return 0
    elif a.cmd == "join":
        if not 0.0 <= a.alpha <= 1.0:
            ap.error("--alpha must be between 0 and 1")
        try:
            base_rgb = parse_hex_rgb(a.base)
        except ValueError:
            ap.error(f"--base must be 6 hex digits like 070b16 (got {a.base!r})")
        res = join_metrics(a.last, a.key, a.alpha, base_rgb, a.out, a.tile_width)
    elif a.cmd == "sheet":
        make_sheet(a.images, a.out, a.cols, split_labels(a.labels, len(a.images)), a.tile_width)
        res = {"out": a.out, "n": len(a.images)}
    elif a.cmd == "phone":
        make_phone_strip(a.images, a.out, split_labels(a.labels, len(a.images)), a.width, a.height)
        res = {"out": a.out, "n": len(a.images)}
    elif a.cmd == "lamp":
        x0, x1, y0, y1 = a.window
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            ap.error("--window needs 0 <= X0 < X1 <= 1 and 0 <= Y0 < Y1 <= 1")
        if len(a.tol) not in (1, 2):
            ap.error("--tol takes one or two values")
        if not (os.path.isdir(a.src) or os.path.isfile(a.src)):
            ap.error(f"no such clip or directory: {a.src}")
        tol = (a.tol[0], a.tol[-1])
        res = lamp_series(a.src, (x0, x1, y0, y1), tuple(a.target), tol, a.start, a.core, a.count_change,
                          a.count_floor, a.merge, a.min_area, a.second_frac, a.second_elong)
        if a.json:
            with open(a.json, "w") as fh:
                fh.write(json.dumps(res, indent=2))
        shown = res if a.full else {k: v for k, v in res.items() if k != "series"}
        print(json.dumps(shown, indent=2))
        return 0
    else:
        res = render_ledger(a.dir, a.out, a.ceiling, a.title)
    text = json.dumps(res, indent=2)
    if getattr(a, "json", None):
        with open(a.json, "w") as fh:
            fh.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Objective QA for scroll-film keyframes and clips (PIL + numpy + ffmpeg).

  film-qa.py still  <image> [--key K0] [--json out.json]
  film-qa.py still  <image> --profile reel [--key K0..K7] [--prev prev-key.json] [--strict-regions] [--json out.json]
                    (reel profile is auto-selected for paths containing /films-src/reel/)
  film-qa.py clip   <clip.mp4> --prev K.png --next K.png --out <dir> --tag 01_t1 [--tophalf] [--json out.json]
  film-qa.py join   --last <last.png|clip.mp4> --key <key.png> [--alpha 0.80] [--base 070b16] [--out join.png]
  film-qa.py sheet  --out sheet.png [--cols N] [--labels a,b,c] [--tile-width 960] <images...>
  film-qa.py phone  --out strip.png [--labels a,b] [--width 390 --height 844] <images...>
                    (sheet / phone take any number of images, e.g. K0 … K7 with --cols 4)
  film-qa.py ledger --dir films-src/beacon/ledger --out films-src/beacon/ledger.md [--ceiling 598]

Luma is full-range Rec.709 computed on RGB pixels in Python (Y = .2126R + .7152G + .0722B, 0..255),
so absolute targets from the storyboard (base ≈ 11, K4 top-half ≤ 22) compare directly. ffmpeg's
signalstats is used only for per-frame series inside one file, where the limited-range offset cancels.

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


def render_ledger(dir_: str, out: str, ceiling: int) -> dict:
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
    lines = ["# Ledger — beacon", "",
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
    s.add_argument("--profile", choices=("beacon", "reel"),
                   help="default: reel when the path contains /films-src/reel/, otherwise beacon")
    s.add_argument("--prev", help="reel: metrics json of the previous key (K1-K3 and K7 mean-Y rules)")
    s.add_argument("--strict-regions", action="store_true",
                   help="reel: turn the provisional left-quarter / bottom-third ceilings (Y and texture) into hard fails")

    c = sub.add_parser("clip")
    c.add_argument("clip")
    c.add_argument("--prev", required=True)
    c.add_argument("--next", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--tag", required=True)
    c.add_argument("--tophalf", action="store_true")
    c.add_argument("--json")

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

    a = ap.parse_args(argv)
    if a.cmd == "still":
        profile = a.profile or ("reel" if "/films-src/reel/" in os.path.abspath(a.image).replace(os.sep, "/")
                                else "beacon")
        if profile == "reel":
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
    else:
        res = render_ledger(a.dir, a.out, a.ceiling)
    text = json.dumps(res, indent=2)
    if getattr(a, "json", None):
        with open(a.json, "w") as fh:
            fh.write(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

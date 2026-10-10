#!/usr/bin/env python3
"""Objective QA for scroll-film keyframes and clips (PIL + numpy + ffmpeg).

  film-qa.py still  <image> [--key K0] [--json out.json]
  film-qa.py clip   <clip.mp4> --prev K.png --next K.png --out <dir> --tag 01_t1 [--tophalf] [--json out.json]
  film-qa.py sheet  --out sheet.png [--cols N] [--labels a,b,c] [--tile-width 960] <images...>
  film-qa.py phone  --out strip.png [--labels a,b] [--width 390 --height 844] <images...>
  film-qa.py ledger --dir films-src/beacon/ledger --out films-src/beacon/ledger.md [--ceiling 598]

Luma is full-range Rec.709 computed on RGB pixels in Python (Y = .2126R + .7152G + .0722B, 0..255),
so absolute targets from the storyboard (base ≈ 11, K4 top-half ≤ 22) compare directly. ffmpeg's
signalstats is used only for per-frame series inside one file, where the limited-range offset cancels.
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

    # Lamp: brightest amber pixels, in the band the storyboard expects for this key.
    band = (int(h * 0.67), h) if key == "K4" else (0, int(h * 0.45))
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
    def texture(region: np.ndarray) -> float:
        bm = box_means(region, 16)
        return float(bm.std())

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
    if key == "K3" and not (14 <= out["top_quarter_yavg"] <= 24):
        flags.append("K3 top-quarter Y outside 14-24 (soft)")
    out["flags"] = flags
    out["objective_reject"] = any(f in flags for f in ("amber>8%", "lamp off-centre", "K4 top-half yavg>22",
                                                        "K4 top-half region>28", "K4 amber above lower third"))
    return out


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

    c = sub.add_parser("clip")
    c.add_argument("clip")
    c.add_argument("--prev", required=True)
    c.add_argument("--next", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--tag", required=True)
    c.add_argument("--tophalf", action="store_true")
    c.add_argument("--json")

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
        res = still_metrics(a.image, a.key)
    elif a.cmd == "clip":
        res = clip_metrics(a.clip, a.prev, a.next, a.out, a.tag, a.tophalf)
    elif a.cmd == "sheet":
        make_sheet(a.images, a.out, a.cols, a.labels.split(",") if a.labels else None, a.tile_width)
        res = {"out": a.out, "n": len(a.images)}
    elif a.cmd == "phone":
        make_phone_strip(a.images, a.out, a.labels.split(",") if a.labels else None, a.width, a.height)
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

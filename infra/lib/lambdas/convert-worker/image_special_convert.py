#!/usr/bin/env python3
"""
Image special encoders used by the conversion worker.

Usage:
  python3 image_special_convert.py <input-image> <output-file> <target>

Targets:
  - ico
  - bmp
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image


def emit_error(where: str, message: str) -> None:
    payload = {
        "ok": False,
        "error_type": "image_special_convert_error",
        "where": where,
        "message": message,
    }
    print(json.dumps(payload), file=sys.stderr, flush=True)


def icon_sizes(width: int, height: int) -> list[tuple[int, int]]:
    preferred = [256, 192, 128, 96, 64, 48, 32, 24, 16]
    max_dim = max(width, height)
    sizes = [(s, s) for s in preferred if s <= max_dim]
    if sizes:
        return sizes
    fallback = max(16, min(256, max_dim))
    return [(fallback, fallback)]


def main() -> None:
    if len(sys.argv) != 4:
        emit_error("args", f"Usage: {sys.argv[0]} <input-image> <output-file> <target>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    target = (sys.argv[3] or "").strip().lower()

    if target not in {"ico", "bmp"}:
        emit_error("validate_args", f"Unsupported target: {target}")
        sys.exit(1)
    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    try:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with Image.open(input_path) as src:
            if target == "ico":
                rgba = src.convert("RGBA")
                sizes = icon_sizes(rgba.width, rgba.height)
                rgba.save(output_path, format="ICO", sizes=sizes)
            else:
                # BMP has no alpha channel in common viewers; flatten transparency to white.
                if src.mode in {"RGBA", "LA"} or "transparency" in src.info:
                    rgba = src.convert("RGBA")
                    canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                    canvas.alpha_composite(rgba)
                    bmp = canvas.convert("RGB")
                else:
                    bmp = src.convert("RGB")
                bmp.save(output_path, format="BMP")
    except Exception as exc:
        emit_error("convert", str(exc))
        sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "Output file was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "Output file is empty")
        sys.exit(1)

    print(
        json.dumps(
            {
                "ok": True,
                "target": target,
                "size": size,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()

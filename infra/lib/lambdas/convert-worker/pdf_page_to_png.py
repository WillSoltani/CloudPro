#!/usr/bin/env python3
"""
Render the first page of a PDF to a PNG image using PyMuPDF.

Usage:
  python3 pdf_page_to_png.py <input.pdf> <output.png>
"""

import os
import sys


def main() -> None:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.pdf> <output.png>", file=sys.stderr)
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        import fitz  # noqa: PLC0415
    except ImportError as exc:
        print(f"PyMuPDF not available: {exc}", file=sys.stderr)
        sys.exit(1)

    doc = fitz.open(input_path)
    try:
        if len(doc) == 0:
            raise ValueError("PDF has no pages")
        page = doc[0]
        # 2x scale gives approximately 144 DPI, enough for previews.
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pix.save(output_path)
    finally:
        doc.close()

    if not os.path.exists(output_path):
        print("PNG output file was not created", file=sys.stderr)
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size < 1000:
        print(f"PNG output is suspiciously small ({size} bytes)", file=sys.stderr)
        sys.exit(1)

    print(f"OK:{size}", flush=True)


if __name__ == "__main__":
    main()

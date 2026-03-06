#!/usr/bin/env python3
"""
PDF → DOCX converter using pdf2docx.

Usage: python3 pdf_to_docx.py <input.pdf> <output.docx>

Exit code 0 = success (prints output byte-size to stdout).
Exit code 1 = failure (error message on stderr).

pdf2docx preserves text, tables, images, and multi-column layouts from text-based
PDFs.  For scanned PDFs (image-only pages) it embeds the page rasters as images in
the DOCX so the document is visually faithful even without OCR.
"""

import sys
import os


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: pdf_to_docx.py <input.pdf> <output.docx>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"Input file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from pdf2docx import Converter  # type: ignore
    except ImportError as exc:
        print(f"pdf2docx is not installed: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
    except Exception as exc:  # pylint: disable=broad-except
        print(f"Conversion failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(docx_path):
        print("pdf2docx did not produce an output file", file=sys.stderr)
        sys.exit(1)

    size = os.path.getsize(docx_path)
    if size == 0:
        print("pdf2docx produced an empty output file", file=sys.stderr)
        sys.exit(1)

    print(f"OK:{size}", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()

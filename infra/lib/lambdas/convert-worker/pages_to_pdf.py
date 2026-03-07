#!/usr/bin/env python3
"""
Extract a canonical PDF from an Apple Pages (.pages) bundle.

Usage:
  python3 pages_to_pdf.py <input.pages> <output.pdf>
"""

from __future__ import annotations

import json
import os
import sys
import zipfile


def emit_error(where: str, message: str, extra: dict | None = None) -> None:
    payload = {
        "ok": False,
        "error_type": "pages_to_pdf_error",
        "where": where,
        "message": message,
    }
    if extra:
        payload.update(extra)
    print(json.dumps(payload), file=sys.stderr, flush=True)


def pick_preview_pdf(entries: list[str]) -> str | None:
    lower_map = {name.lower(): name for name in entries}
    preferred = [
        "quicklook/preview.pdf",
        "preview.pdf",
    ]
    for p in preferred:
        if p in lower_map:
            return lower_map[p]
    for name in entries:
        if name.lower().endswith("preview.pdf"):
            return name
    return None


def count_pdf_pages(path: str) -> int:
    try:
        import fitz  # noqa: PLC0415
    except Exception:
        return 0
    try:
        doc = fitz.open(path)
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception:
        return 0


def main() -> None:
    if len(sys.argv) != 3:
        emit_error("args", f"Usage: {sys.argv[0]} <input.pages> <output.pdf>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)

    if not zipfile.is_zipfile(input_path):
        emit_error("validate_input", "Input is not a valid .pages zip container")
        sys.exit(1)

    try:
        with zipfile.ZipFile(input_path, "r") as zf:
            names = zf.namelist()
            preview_entry = pick_preview_pdf(names)
            if not preview_entry:
                quicklook_entries = [n for n in names if n.lower().startswith("quicklook/")]
                emit_error(
                    "extract_preview",
                    "Could not find QuickLook preview PDF inside .pages bundle",
                    {
                        "hint": "Open the file in Apple Pages and export/save with previews enabled.",
                        "quicklook_entries": quicklook_entries[:20],
                    },
                )
                sys.exit(1)
            data = zf.read(preview_entry)
    except zipfile.BadZipFile:
        emit_error("read_zip", "Invalid .pages zip file")
        sys.exit(1)
    except Exception as exc:
        emit_error("read_zip", str(exc))
        sys.exit(1)

    if not data.startswith(b"%PDF-"):
        emit_error("validate_preview", "Embedded preview file is not a valid PDF")
        sys.exit(1)

    try:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(data)
    except Exception as exc:
        emit_error("write_output", str(exc))
        sys.exit(1)

    if not os.path.exists(output_path):
        emit_error("validate_output", "Output PDF was not created")
        sys.exit(1)

    size = os.path.getsize(output_path)
    if size <= 0:
        emit_error("validate_output", "Output PDF is empty")
        sys.exit(1)

    page_count = count_pdf_pages(output_path)
    print(
        json.dumps(
            {
                "ok": True,
                "converter": "pages_quicklook_preview",
                "source_entry": preview_entry,
                "page_count": page_count,
                "size": size,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()

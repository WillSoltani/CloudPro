#!/usr/bin/env python3
"""
Convert PDF or DOCX/DOC to per-page images and package as ZIP.

Usage:
  python3 document_to_images_zip.py \
    <input_path> <output_zip> <base_name> <format> <dpi> <quality> <resize_pct> <max_width>

Notes:
- format: png | jpg | webp
- resize_pct: 10-100 (100 = no explicit resize)
- max_width: 0 to disable preset width cap
"""

import io
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import zipfile


def emit_error(where: str, message: str, extra: dict | None = None) -> None:
    payload = {
        "ok": False,
        "error_type": "document_to_images_zip_error",
        "where": where,
        "message": message,
    }
    if extra:
        payload.update(extra)
    print(json.dumps(payload), file=sys.stderr, flush=True)


def sanitize_base_name(name: str) -> str:
    base = (name or "").strip()
    if not base:
        return "document"
    cleaned = "".join(ch for ch in base if ch not in '/\\:*?"<>|\r\n\t')
    return cleaned.strip() or "document"


def run_doc_to_pdf_script(input_path: str, output_pdf: str) -> None:
    script = "/var/task/docx_to_pdf.py"
    if not os.path.exists(script):
        script = os.path.join(os.path.dirname(__file__), "docx_to_pdf.py")

    proc = subprocess.run(
        ["python3", script, input_path, output_pdf],
        check=False,
        capture_output=True,
        text=True,
        timeout=100,
    )
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        details = " | ".join(x for x in [stderr, stdout] if x)
        raise RuntimeError(f"DOCX->PDF pre-conversion failed{': ' + details if details else ''}")
    if not os.path.exists(output_pdf):
        raise RuntimeError("DOCX->PDF pre-conversion did not produce a PDF")


def open_pdf_from_input(input_path: str):
    ext = pathlib.Path(input_path).suffix.lower()
    if ext == ".pdf":
        return input_path, None

    if ext in [".docx", ".doc"]:
        tmp_dir_obj = tempfile.TemporaryDirectory(prefix="doc-to-pdf-")
        pdf_path = os.path.join(tmp_dir_obj.name, "converted.pdf")
        run_doc_to_pdf_script(input_path, pdf_path)
        return pdf_path, tmp_dir_obj

    raise ValueError(f"Unsupported input type for document image conversion: {ext or 'unknown'}")


def mean_abs_error(a, b) -> float:
    # Normalized MAE in [0,1] over grayscale diff.
    from PIL import ImageChops  # noqa: PLC0415

    if a.size != b.size:
        raise ValueError(f"image dimensions mismatch: {a.size} vs {b.size}")
    diff = ImageChops.difference(a, b).convert("L")
    hist = diff.histogram()
    total = sum(v * count for v, count in enumerate(hist))
    denom = 255.0 * float(a.width * a.height)
    if denom <= 0:
        return 1.0
    return total / denom


def main() -> None:
    if len(sys.argv) != 9:
        emit_error(
            "args",
            "Usage: document_to_images_zip.py <input_path> <output_zip> <base_name> <format> <dpi> <quality> <resize_pct> <max_width>",
        )
        sys.exit(1)

    input_path = sys.argv[1]
    output_zip = sys.argv[2]
    base_name = sanitize_base_name(sys.argv[3])
    target_fmt = sys.argv[4].lower()
    dpi = int(sys.argv[5])
    quality = int(sys.argv[6])
    resize_pct = int(sys.argv[7])
    max_width = int(sys.argv[8])

    if not os.path.exists(input_path):
        emit_error("validate_input", f"Input file not found: {input_path}")
        sys.exit(1)
    if target_fmt not in ["png", "jpg", "webp"]:
        emit_error("validate_args", f"Unsupported target image format: {target_fmt}")
        sys.exit(1)
    if dpi < 36 or dpi > 400:
        emit_error("validate_args", "dpi must be between 36 and 400")
        sys.exit(1)
    if quality < 1 or quality > 100:
        emit_error("validate_args", "quality must be between 1 and 100")
        sys.exit(1)
    if resize_pct < 10 or resize_pct > 100:
        emit_error("validate_args", "resize_pct must be between 10 and 100")
        sys.exit(1)
    if max_width < 0:
        emit_error("validate_args", "max_width must be >= 0")
        sys.exit(1)

    try:
        import fitz  # noqa: PLC0415
    except ImportError as exc:
        emit_error("import", f"PyMuPDF not installed: {exc}")
        sys.exit(1)

    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError as exc:
        emit_error("import", f"Pillow not installed: {exc}")
        sys.exit(1)

    tmp_ctx = None
    doc = None
    try:
        pdf_path, tmp_ctx = open_pdf_from_input(input_path)
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        if page_count <= 0:
            raise RuntimeError("Document has no pages")

        os.makedirs(os.path.dirname(output_zip) or ".", exist_ok=True)
        scale = dpi / 72.0
        matrix = fitz.Matrix(scale, scale)
        thresholds = {"png": 0.0010, "jpg": 0.0200, "webp": 0.0200}
        threshold = thresholds[target_fmt]
        page_mae: list[float] = []

        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for i in range(page_count):
                page = doc[i]
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                reference = image.copy()

                if resize_pct < 100:
                    new_w = max(1, round(image.width * resize_pct / 100.0))
                    new_h = max(1, round(image.height * resize_pct / 100.0))
                    image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    reference = reference.resize((new_w, new_h), Image.Resampling.LANCZOS)
                elif max_width > 0 and image.width > max_width:
                    ratio = max_width / float(image.width)
                    new_h = max(1, round(image.height * ratio))
                    image = image.resize((max_width, new_h), Image.Resampling.LANCZOS)
                    reference = reference.resize((max_width, new_h), Image.Resampling.LANCZOS)

                out_name = f"{base_name}_page_{i + 1:02d}.{target_fmt}"
                out_bytes = io.BytesIO()

                if target_fmt == "png":
                    image.save(out_bytes, format="PNG", optimize=True, compress_level=6)
                elif target_fmt == "jpg":
                    image.save(out_bytes, format="JPEG", quality=quality, optimize=True, progressive=True)
                else:
                    image.save(out_bytes, format="WEBP", quality=quality, method=6)

                encoded = out_bytes.getvalue()
                zf.writestr(out_name, encoded)

                # Fidelity gate: encoded page must stay within strict visual threshold
                decoded = Image.open(io.BytesIO(encoded)).convert("RGB")
                mae = mean_abs_error(reference, decoded)
                page_mae.append(mae)
                if mae > threshold:
                    emit_error(
                        "fidelity_gate",
                        f"Page {i + 1} exceeds fidelity threshold ({mae:.6f} > {threshold:.6f})",
                        {
                            "page": i + 1,
                            "format": target_fmt,
                            "mae": mae,
                            "threshold": threshold,
                        },
                    )
                    sys.exit(1)

        if not os.path.exists(output_zip):
            raise RuntimeError("ZIP output file was not created")
        zip_size = os.path.getsize(output_zip)
        if zip_size <= 256:
            raise RuntimeError(f"ZIP output is suspiciously small ({zip_size} bytes)")

        max_mae = max(page_mae) if page_mae else 0.0
        avg_mae = sum(page_mae) / len(page_mae) if page_mae else 0.0

        print(
            json.dumps(
                {
                    "ok": True,
                    "pages": page_count,
                    "zip_size": zip_size,
                    "format": target_fmt,
                    "fidelity": {
                        "threshold": threshold,
                        "max_mae": max_mae,
                        "avg_mae": avg_mae,
                        "page_mae": page_mae,
                    },
                }
            ),
            flush=True,
        )
    except subprocess.TimeoutExpired:
        emit_error("docx_to_pdf", "DOCX->PDF pre-conversion timed out")
        sys.exit(1)
    except Exception as exc:
        emit_error("convert", str(exc))
        sys.exit(1)
    finally:
        if doc is not None:
            doc.close()
        if tmp_ctx is not None:
            tmp_ctx.cleanup()


if __name__ == "__main__":
    main()

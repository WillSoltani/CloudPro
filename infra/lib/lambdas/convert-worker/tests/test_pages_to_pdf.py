#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "pages_to_pdf.py"
if not SCRIPT.exists():
    SCRIPT = Path("/var/task/pages_to_pdf.py")


class TestPagesToPdf(unittest.TestCase):
    def _run(self, input_path: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_extracts_quicklook_preview_pdf(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            preview_pdf_path = td_path / "preview.pdf"
            output_pdf_path = td_path / "out.pdf"

            Image.new("RGB", (300, 120), (220, 220, 250)).save(preview_pdf_path, "PDF")

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(preview_pdf_path, arcname="QuickLook/Preview.pdf")
                zf.writestr("Index/Document.iwa", b"iwa")

            proc = self._run(pages_path, output_pdf_path)
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(output_pdf_path.exists())
            self.assertGreater(output_pdf_path.stat().st_size, 0)

            with output_pdf_path.open("rb") as f:
                header = f.read(5)
            self.assertEqual(header, b"%PDF-")

            payload = json.loads((proc.stdout or "").strip().splitlines()[-1])
            self.assertTrue(payload.get("ok"))
            self.assertEqual(payload.get("converter"), "pages_quicklook_preview")

    def test_fails_when_no_preview_pdf_exists(self) -> None:
        with tempfile.TemporaryDirectory(prefix="pages-to-pdf-missing-") as td:
            td_path = Path(td)
            pages_path = td_path / "sample.pages"
            output_pdf_path = td_path / "out.pdf"

            with zipfile.ZipFile(pages_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("Index/Document.iwa", b"iwa")
                zf.writestr("QuickLook/Thumbnail.jpg", b"not-a-real-jpg")

            proc = self._run(pages_path, output_pdf_path)
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("preview", (proc.stderr or "").lower())


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "image_special_convert.py"
if not SCRIPT.exists():
    SCRIPT = Path("/var/task/image_special_convert.py")


class TestImageSpecialConvert(unittest.TestCase):
    def _run(self, input_path: Path, output_path: Path, target: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), str(input_path), str(output_path), target],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_png_to_ico_emits_multi_size_icon(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-ico-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.ico"

            img = Image.new("RGBA", (320, 180), (10, 100, 220, 255))
            img.save(src, format="PNG")

            proc = self._run(src, out, "ico")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())
            self.assertGreater(out.stat().st_size, 0)

            with Image.open(out) as ico:
                self.assertEqual(ico.format, "ICO")
                sizes = set(ico.info.get("sizes", []))
                # Ensure multiple icon sizes are embedded (small + large variants).
                self.assertTrue(any(max(s) <= 24 for s in sizes), msg=f"sizes={sizes}")
                self.assertTrue(any(max(s) >= 96 for s in sizes), msg=f"sizes={sizes}")

    def test_png_with_transparency_to_bmp_flattens_to_white(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-bmp-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.bmp"

            img = Image.new("RGBA", (2, 1), (0, 0, 0, 0))
            img.putpixel((1, 0), (255, 0, 0, 200))
            img.save(src, format="PNG")

            proc = self._run(src, out, "bmp")
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(out.exists())
            self.assertGreater(out.stat().st_size, 0)

            with Image.open(out) as bmp:
                self.assertEqual(bmp.format, "BMP")
                self.assertEqual(bmp.mode, "RGB")
                # Fully transparent pixel should be flattened to white.
                self.assertEqual(bmp.getpixel((0, 0)), (255, 255, 255))

    def test_invalid_target_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="special-invalid-") as td:
            td_path = Path(td)
            src = td_path / "input.png"
            out = td_path / "output.bad"
            Image.new("RGB", (10, 10), (120, 30, 60)).save(src, format="PNG")

            proc = self._run(src, out, "svg")
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("Unsupported target", proc.stderr)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHARP_MODULE = ROOT / "node_modules" / "sharp"
if not SHARP_MODULE.exists():
    SHARP_MODULE = Path("/var/task/node_modules/sharp")


class TestSvgRasterization(unittest.TestCase):
    def test_svg_to_png_preserves_transparency(self) -> None:
        if not SHARP_MODULE.exists():
            self.skipTest("sharp module is not available in this runtime")

        with tempfile.TemporaryDirectory(prefix="svg-raster-") as td:
            td_path = Path(td)
            svg_path = td_path / "input.svg"
            png_path = td_path / "output.png"
            svg_path.write_text(
                (
                    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">'
                    '<rect x="20" y="20" width="160" height="80" fill="#ff4d4f"/>'
                    "</svg>"
                ),
                encoding="utf-8",
            )

            node_script = (
                "const fs=require('fs');"
                "const sharp=require(process.argv[1]);"
                "(async()=>{"
                "const input=fs.readFileSync(process.argv[2]);"
                "const out=await sharp(input,{failOn:'none',density:192}).png().toBuffer();"
                "fs.writeFileSync(process.argv[3],out);"
                "})().catch((e)=>{console.error(e);process.exit(1);});"
            )
            proc = subprocess.run(
                ["node", "-e", node_script, str(SHARP_MODULE), str(svg_path), str(png_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, msg=f"stderr={proc.stderr}\nstdout={proc.stdout}")
            self.assertTrue(png_path.exists())
            self.assertGreater(png_path.stat().st_size, 0)

            with Image.open(png_path) as img:
                self.assertIn(img.mode, {"RGBA", "LA"})
                # Corner should remain transparent (alpha = 0).
                corner = img.getpixel((0, 0))
                alpha = corner[3] if isinstance(corner, tuple) and len(corner) > 3 else 255
                self.assertEqual(alpha, 0)


if __name__ == "__main__":
    unittest.main()

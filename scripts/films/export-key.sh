#!/usr/bin/env bash
# Export a keyframe still as the hold-key WebP the page overlays use: exact 16:9 centre crop, ≤ MAX_KB, 1920 wide.
# usage: scripts/films/export-key.sh <in.png> <out.webp> [MAX_KB=200]
set -euo pipefail
in=${1:?input png}; out=${2:?output webp}; max_kb=${3:-200}
mkdir -p "$(dirname "$out")"
tmp=$(mktemp -t key).png
python3 - "$in" "$tmp" <<'PY'
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB"); w, h = im.size
cw = round(h * 16 / 9); x0 = (w - cw) // 2
im = im.crop((x0, 0, x0 + cw, h)) if cw <= w else im.crop((0, (h - round(w * 9 / 16)) // 2, w, (h - round(w * 9 / 16)) // 2 + round(w * 9 / 16)))
im.save(sys.argv[2])
PY
for q in 82 76 70 64 58 52; do
  cwebp -quiet -q "$q" -resize 1920 0 "$tmp" -o "$out"
  kb=$(( $(stat -f%z "$out") / 1024 ))
  if [ "$kb" -le "$max_kb" ]; then echo "$out: ${kb} KB at q$q"; rm -f "$tmp"; exit 0; fi
done
echo "$out: ${kb} KB still above ${max_kb} KB at q52" >&2; rm -f "$tmp"; exit 1

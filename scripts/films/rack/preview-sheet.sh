#!/usr/bin/env bash
# Tile the PNGs of a directory into one contact sheet, four across, in name order.
#   scripts/films/rack/preview-sheet.sh <dir> <out.png> [columns=4] [tile width=480]
set -euo pipefail
dir=$(cd "${1:?dir}" && pwd); out=${2:?out.png}; cols=${3:-4}; w=${4:-480}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
i=0
for f in $(ls "$dir"/*.png | sort -V); do ln -s "$f" "$tmp/$(printf 's_%04d.png' "$i")"; i=$((i + 1)); done
[[ $i -gt 0 ]] || { echo "no PNGs in $dir" >&2; exit 1; }
rows=$(( (i + cols - 1) / cols ))
ffmpeg -v error -y -framerate 1 -i "$tmp/s_%04d.png" -vf "scale=$w:-2,tile=${cols}x${rows}:padding=4:color=black" -frames:v 1 "$out"
echo "$out: $i frames, ${cols}x${rows}"

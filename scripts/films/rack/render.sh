#!/usr/bin/env bash
# Run the rack scene script in local Blender 5.2 (part four of the homepage film).
#
#   scripts/films/rack/render.sh build                       # construct the scene and bake every key → films-src/rack/rack.blend
#   scripts/films/rack/render.sh check                        # structural audit (JSON)
#   scripts/films/rack/render.sh preview [landscape|portrait] # 25 % EEVEE stills at the beat frames → films-src/rack/renders/preview-<camera>/
#   scripts/films/rack/render.sh render rack-01 landscape [--frames 216-264] [--res-scale 1]   # PNG frames → films-src/rack/renders/rack-01/
#   scripts/films/rack/render.sh export                       # rack.timeline.json + plate corner tracks → films-src/rack/export/
#
# Env: BLENDER (binary; default: the app bundle or `blender` on PATH)  SAMPLES=64  JOBS unused (one Blender per film).
# Everything renders with motion blur off, DOF on, deterministic samples; see scene.py's docstring for every option.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
BLENDER=${BLENDER:-}
if [[ -z $BLENDER ]]; then
  if [[ -x /Applications/Blender.app/Contents/MacOS/Blender ]]; then BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
  else BLENDER=$(command -v blender || true); fi
fi
[[ -n $BLENDER && -x $BLENDER ]] || { echo "Blender not found: brew install --cask blender (5.2 LTS), or set BLENDER=/path/to/Blender" >&2; exit 1; }
ver=$("$BLENDER" --version 2>/dev/null | head -1)
case $ver in *" 5.2"*) ;; *) echo "warning: expected Blender 5.2.x, got: $ver" >&2 ;; esac

src=$root/films-src/rack
blend=$src/rack.blend
mkdir -p "$src/renders" "$src/export"
cmd=${1:-}; shift || true
run() { caffeinate -i "$BLENDER" --factory-startup -b "$@"; }

case $cmd in
  build)
    run --python "$here/scene.py" -- build --save "$blend" "$@"
    ;;
  check)
    [[ -f $blend ]] || { echo "no $blend: run build first" >&2; exit 1; }
    run "$blend" --python "$here/scene.py" -- check "$@"
    ;;
  preview)
    cam=${1:-landscape}; shift || true
    [[ -f $blend ]] || { echo "no $blend: run build first" >&2; exit 1; }
    beats="0,100,190,216,260,300,336,380,432,500,552,600,648,710,768,850,900,950,1032"
    [[ $cam == portrait ]] && beats="216,336,432,552,648,768,900,1032"
    run "$blend" --python "$here/scene.py" -- render --camera "$cam" --frames "$beats" --res-scale 0.25 \
      --samples "${SAMPLES:-16}" --out "$src/renders/preview-$cam" "$@"
    "$here/preview-sheet.sh" "$src/renders/preview-$cam" "$src/renders/preview-$cam.png"
    ;;
  render)
    film=${1:?film name, e.g. rack-01}; cam=${2:-landscape}; shift 2 || true
    [[ -f $blend ]] || { echo "no $blend: run build first" >&2; exit 1; }
    out=$src/renders/$film; [[ $cam == portrait ]] && out=$src/renders/$film-p
    run "$blend" --python "$here/scene.py" -- render --film "$film" --camera "$cam" --samples "${SAMPLES:-64}" --out "$out" "$@"
    ;;
  export)
    [[ -f $blend ]] || { echo "no $blend: run build first" >&2; exit 1; }
    run "$blend" --python "$here/scene.py" -- export --plates --out "$src/export"
    ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac

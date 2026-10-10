#!/usr/bin/env bash
# Turn generated clips into a scroll-scrubbed frame sequence for <ScrollFilm>.
#
#   scripts/films/build-film.sh <name> <clip1.mp4> [clip2.mp4 ...]
#
# Clips are joined in the order given. For first/last-frame morph chains (clip N ends on the
# still clip N+1 starts from) the duplicated boundary frame is dropped, so joins are seamless.
# Writes public/films/<name>/<width>/f_0001.webp…, poster.webp and manifest.json.
#
# Env: FPS=24  WIDTHS="768 1280 1920"  QUALITY=70  SKIP_BOUNDARY=1  CROP_169=1  OUT_ROOT=public/films
#      BASE_URL=/films (set to a CDN origin + /films when frames are hosted off-site)  JOBS=<cpus>
set -euo pipefail

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
[[ $# -ge 2 ]] || usage
NAME=$1
shift
[[ $NAME =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "film name must be kebab-case: $NAME" >&2; exit 1; }

FPS=${FPS:-24}
WIDTHS=${WIDTHS:-"768 1280 1920"}
QUALITY=${QUALITY:-70}
CROP_169=${CROP_169:-1}
SKIP_BOUNDARY=${SKIP_BOUNDARY:-1}
OUT_ROOT=${OUT_ROOT:-public/films}
BASE_URL=${BASE_URL:-/films}
JOBS=${JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)}

for bin in ffmpeg ffprobe cwebp; do
  command -v "$bin" >/dev/null || { echo "missing $bin — brew install ffmpeg webp" >&2; exit 1; }
done
for clip in "$@"; do
  [[ -f $clip ]] || { echo "no such clip: $clip" >&2; exit 1; }
done

probe() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$1"; }
IFS=, read -r SRC_W SRC_H < <(probe "$1")

# Every clip must share the first clip's aspect ratio (±1%), or frames would jump in size.
for clip in "$@"; do
  IFS=, read -r w h < <(probe "$clip")
  diff=$((w * SRC_H - h * SRC_W))
  diff=${diff#-}
  if ((diff * 100 > w * SRC_H)); then
    echo "aspect mismatch: $clip is ${w}x${h}, first clip is ${SRC_W}x${SRC_H}" >&2
    exit 1
  fi
done

# Never upscale: drop widths wider than the source.
BUILD_WIDTHS=()
for w in $(printf '%s\n' $WIDTHS | sort -n); do
  if ((w <= SRC_W)); then
    BUILD_WIDTHS+=("$w")
  else
    echo "skipping ${w}w: source is only ${SRC_W}px wide" >&2
  fi
done
((${#BUILD_WIDTHS[@]})) || BUILD_WIDTHS=("$SRC_W")
MAX_W=${BUILD_WIDTHS[${#BUILD_WIDTHS[@]} - 1]}

OUT=$OUT_ROOT/$NAME
TMP=$(mktemp -d "${TMPDIR:-/tmp}/film-$NAME.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
rm -rf "$OUT"
for w in "${BUILD_WIDTHS[@]}"; do mkdir -p "$OUT/$w"; done

count=0
k=0
for clip in "$@"; do
  vf="fps=$FPS"
  if ((k > 0 && SKIP_BOUNDARY)); then vf="$vf,select='gte(n,1)'"; fi
  # Video models pad to a multiple of 16 (e.g. 1920x1088): centre-crop any rows beyond a 16:9 height.
  if ((CROP_169)); then vf="$vf,crop=iw:'min(ih,floor(iw*9/16/2)*2)':0:'(ih-oh)/2'"; fi
  vf="$vf,scale=$MAX_W:-2:flags=lanczos"
  rm -f "$TMP"/f_*.png
  ffmpeg -v error -i "$clip" -an -vf "$vf" -fps_mode passthrough \
    -start_number $((count + 1)) "$TMP/f_%04d.png"
  n=$(find "$TMP" -name 'f_*.png' | wc -l | tr -d ' ')
  ((n > 0)) || { echo "no frames decoded from $clip" >&2; exit 1; }
  for w in "${BUILD_WIDTHS[@]}"; do
    find "$TMP" -name 'f_*.png' -print0 |
      W=$w Q=$QUALITY DEST=$OUT/$w xargs -0 -n 1 -P "$JOBS" sh -c \
        'cwebp -quiet -q "$Q" -m 5 -resize "$W" 0 "$1" -o "$DEST/$(basename "$1" .png).webp"' _
  done
  echo "  $(basename "$clip"): $n frames"
  count=$((count + n))
  k=$((k + 1))
done

for w in "${BUILD_WIDTHS[@]}"; do
  got=$(find "$OUT/$w" -name 'f_*.webp' | wc -l | tr -d ' ')
  [[ $got == "$count" ]] || { echo "${w}w has $got frames, expected $count" >&2; exit 1; }
done
cp "$OUT/$MAX_W/f_0001.webp" "$OUT/poster.webp"

# Aspect of the frames actually written (after any 16:9 crop), not of the padded source.
IFS=, read -r OUT_W OUT_H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/$MAX_W/f_0001.webp" 2>/dev/null || echo "$SRC_W,$SRC_H")
aspect=$(awk -v w="$OUT_W" -v h="$OUT_H" 'BEGIN { printf "%.4f", w / h }')
widths_json=$(IFS=,; echo "${BUILD_WIDTHS[*]}")
kb_json=""
for w in "${BUILD_WIDTHS[@]}"; do
  kb_json="$kb_json${kb_json:+, }\"$w\": $(du -sk "$OUT/$w" | cut -f1)"
done
cat >"$OUT/manifest.json" <<JSON
{
  "name": "$NAME",
  "count": $count,
  "fps": $FPS,
  "widths": [$widths_json],
  "aspect": $aspect,
  "pad": 4,
  "ext": "webp",
  "base": "$BASE_URL/$NAME",
  "poster": "$BASE_URL/$NAME/poster.webp",
  "kb": { $kb_json }
}
JSON

echo "$NAME: $count frames at ${FPS}fps → $OUT"
for w in "${BUILD_WIDTHS[@]}"; do
  kb=$(du -sk "$OUT/$w" | cut -f1)
  budget=25600
  if ((w <= 768)); then budget=12288; fi
  note=""
  if ((kb > budget)); then note="  over budget ($((budget / 1024)) MB): lower QUALITY or FPS, or trim clips"; fi
  echo "  ${w}w: $((kb / 1024)) MB$note"
done
echo "  poster: $(($(du -k "$OUT/poster.webp" | cut -f1))) KB"

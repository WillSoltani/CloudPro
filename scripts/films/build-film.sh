#!/usr/bin/env bash
# Turn generated clips, or a rendered PNG sequence, into a scroll-scrubbed frame sequence for the homepage reel (<FilmBackdrop>).
#
#   scripts/films/build-film.sh <name> <clip1.mp4> [clip2.mp4 ...]
#   scripts/films/build-film.sh <name> <frames-dir>
#
# Clips mode: clips are joined in the order given. For first/last-frame morph chains (clip N ends on the
# still clip N+1 starts from) the duplicated boundary frame is dropped, so joins are seamless.
# Frames mode (exactly one argument after the name, and it is a directory): the directory's *.png files,
# in natural order (f_1, f_2, f_10; f_00001 works too), are symlinked as f_0001.png... and encoded as they are:
# no decode, no crop, no boundary drop. FPS, CROP_169 and SKIP_BOUNDARY apply to clips only (in frames mode
# FPS is just the value written to the manifest). Every PNG must share the first one's aspect ratio (±1%).
# Writes <OUT_ROOT>/<name>/<width>/f_0001.webp…, poster.webp and manifest.json.
#
# Env: FPS=24  WIDTHS="768 1280 1920"  QUALITY=70  SKIP_BOUNDARY=1  CROP_169=1  OUT_ROOT=public/films
#      BASE_URL=/films (set to a CDN origin + /films when frames are hosted off-site)  JOBS=<cpus>
#      FRAMES_FIRST=<n> FRAMES_LAST=<m> (frames mode: build only sorted files n..m, 1-based inclusive)
#      PREBLUR="768=0.7 432=0.7" (width=sigma pairs: those tiers are scaled with Lanczos and given a Gaussian of
#      sigma px before cwebp, which band-limits detail the small tier cannot hold; default none)
#      DEDUPE=1 (frames mode: byte-identical PNGs are encoded once and the WebP copied, so held frames stay identical)
set -euo pipefail

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 1; }
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
FRAMES_FIRST=${FRAMES_FIRST:-}
FRAMES_LAST=${FRAMES_LAST:-}
PREBLUR=${PREBLUR:-}
DEDUPE=${DEDUPE:-1}

FRAMES_MODE=0
if [[ $# -eq 1 && -d $1 ]]; then FRAMES_MODE=1; fi

for bin in ffmpeg ffprobe cwebp; do
  command -v "$bin" >/dev/null || { echo "missing $bin — brew install ffmpeg webp" >&2; exit 1; }
done

probe() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$1"; }

if ((FRAMES_MODE)); then
  FRAMES_DIR=$(cd "$1" && pwd)
  ALL=()
  while IFS= read -r f; do ALL+=("$f"); done < <(
    find "$FRAMES_DIR" -maxdepth 1 \( -type f -o -type l \) -name '*.png' | sort -V
  )
  total=${#ALL[@]}
  ((total > 0)) || { echo "no .png frames in $1" >&2; exit 1; }
  first=${FRAMES_FIRST:-1}
  last=${FRAMES_LAST:-$total}
  [[ $first =~ ^[1-9][0-9]*$ && $last =~ ^[1-9][0-9]*$ ]] ||
    { echo "FRAMES_FIRST/FRAMES_LAST must be positive integers (got '${FRAMES_FIRST}' / '${FRAMES_LAST}')" >&2; exit 1; }
  ((first <= last && last <= total)) ||
    { echo "invalid frame range $first..$last: need 1 <= first <= last <= $total ($total .png files in $1)" >&2; exit 1; }
  SEL=()
  i=$first
  while ((i <= last)); do SEL+=("${ALL[i - 1]}"); i=$((i + 1)); done
  ((${#SEL[@]} <= 9999)) || { echo "${#SEL[@]} frames exceed the 4-digit manifest pad (max 9999)" >&2; exit 1; }
  IFS=, read -r SRC_W SRC_H < <(probe "${SEL[0]}")

  # Every frame must share the first one's aspect ratio (±1%), or frames would jump in size.
  # `file` reads every PNG header in a few processes, where ffprobe would cost one process per frame.
  sizes=$(printf '%s\0' "${SEL[@]}" | xargs -0 file -b |
    sed -n 's/^PNG image data, \([0-9]*\) x \([0-9]*\).*/\1,\2/p' | sort -u)
  if [[ -z $sizes ]]; then
    echo "warning: could not read PNG sizes with file(1); frame sizes not cross-checked" >&2
  else
    while IFS=, read -r w h; do
      diff=$((w * SRC_H - h * SRC_W))
      diff=${diff#-}
      if ((diff * 100 > w * SRC_H)); then
        echo "aspect mismatch: some frames are ${w}x${h}, first frame is ${SRC_W}x${SRC_H}" >&2
        exit 1
      fi
    done <<<"$sizes"
  fi
else
  for clip in "$@"; do
    [[ -d $clip ]] && { echo "a frame directory must be the only argument after the name: $clip" >&2; exit 1; }
    [[ -f $clip ]] || { echo "no such clip: $clip" >&2; exit 1; }
  done
  [[ -z $FRAMES_FIRST$FRAMES_LAST ]] || echo "warning: FRAMES_FIRST/FRAMES_LAST only apply to frames mode; ignored" >&2
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
fi

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

# Encode every f_*.png in $TMP (clips: the clip just decoded; frames: the whole sequence) to each width tier.
encode_tmp() {
  local w sigma pair
  for w in "${BUILD_WIDTHS[@]}"; do
    sigma=""
    for pair in $PREBLUR; do [[ ${pair%%=*} == "$w" ]] && sigma=${pair#*=}; done
    if [[ -n $sigma ]]; then
      find "$TMP" -name 'f_*.png' -print0 |
        W=$w Q=$QUALITY S=$sigma DEST=$OUT/$w xargs -0 -n 1 -P "$JOBS" sh -c \
          'b=$(basename "$1" .png); ffmpeg -v error -y -i "$1" -vf "scale=$W:-2:flags=lanczos,gblur=sigma=$S" "$DEST/$b.pre.png" &&
           cwebp -quiet -q "$Q" -m 5 "$DEST/$b.pre.png" -o "$DEST/$b.webp" && rm -f "$DEST/$b.pre.png"' _
    else
      find "$TMP" -name 'f_*.png' -print0 |
        W=$w Q=$QUALITY DEST=$OUT/$w xargs -0 -n 1 -P "$JOBS" sh -c \
          'cwebp -quiet -q "$Q" -m 5 -resize "$W" 0 "$1" -o "$DEST/$(basename "$1" .png).webp"' _
    fi
  done
}

count=0
if ((FRAMES_MODE)); then
  n=0
  for src in "${SEL[@]}"; do
    n=$((n + 1))
    printf -v name 'f_%04d.png' "$n"
    ln -s "$src" "$TMP/$name"
  done
  DUPS=()
  if ((DEDUPE)); then                      # identical masters (held frames, the static tail) encode once
    prev_h="" prev_n=""
    while read -r h f; do
      bn=$(basename "$f")
      if [[ $h == "$prev_h" ]]; then DUPS+=("$bn:$prev_n"); rm "$TMP/$bn"; else prev_h=$h; prev_n=$bn; fi
    done < <(cd "$TMP" && for f in f_*.png; do printf '%s %s\n' "$(shasum -a 256 < "$f" | cut -c1-64)" "$f"; done | sort -k1,1 -k2,2 -s)
  fi
  encode_tmp
  for d in ${DUPS[@]+"${DUPS[@]}"}; do      # "dup.png:first.png"
    for w in "${BUILD_WIDTHS[@]}"; do cp "$OUT/$w/$(basename "${d#*:}" .png).webp" "$OUT/$w/$(basename "${d%%:*}" .png).webp"; done
  done
  ((${#DUPS[@]} == 0)) || echo "  $((${#DUPS[@]})) duplicate masters copied, not re-encoded"

  echo "  $(basename "$FRAMES_DIR") [$first..$last]: $n frames"
  count=$n
else
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
    encode_tmp
    echo "  $(basename "$clip"): $n frames"
    count=$((count + n))
    k=$((k + 1))
  done
fi

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

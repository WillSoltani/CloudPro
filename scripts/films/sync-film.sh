#!/usr/bin/env bash
# Upload a built scroll film to the films bucket and point its manifest at the CDN.
#
#   scripts/films/sync-film.sh <name> [--dry-run] [--size-only] [--force] [--write-manifest]
#                                     [--bucket B] [--domain D] [--prefix films] [--region us-east-1] [--profile P]
#
# Syncs only *.webp from public/films/<name>/ (built by build-film.sh) with immutable caching and
# never --delete, then uploads a manifest whose base/poster point at https://<domain>/<prefix>/<name>
# and verifies the CDN (200, image/webp, immutable, Access-Control-Allow-Origin: *). Frames are
# immutable per film name: a film that already has a manifest in the bucket is refused unless
# --force — re-cuts get a new name (beacon-v2), never a reused path, because browsers never
# re-fetch an immutable URL. --write-manifest copies the CDN manifest back over
# public/films/<name>/manifest.json (only base/poster change) so the app imports the CDN URLs.
#
# Env: FILMS_BUCKET  FILMS_DOMAIN  FILMS_OUTPUTS=infra/cdk.out/films-outputs.json (flags win over env,
#      env over the outputs file written by `cdk deploy CloudPortfolioFilms --outputs-file …`)
set -euo pipefail

usage() { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
die() { echo "sync-film: $*" >&2; exit 1; }
fsize() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }

NAME=""
DRY_RUN=0
SIZE_ONLY=0
FORCE=0
WRITE_MANIFEST=0
BUCKET=${FILMS_BUCKET:-}
DOMAIN=${FILMS_DOMAIN:-}
OUTPUTS=${FILMS_OUTPUTS:-infra/cdk.out/films-outputs.json}
PREFIX=films
REGION=us-east-1
PROFILE=""
while (($#)); do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    --size-only) SIZE_ONLY=1 ;;
    --force) FORCE=1 ;;
    --write-manifest) WRITE_MANIFEST=1 ;;
    --bucket | --domain | --prefix | --region | --profile)
      [[ $# -ge 2 ]] || die "$1 needs a value"
      case $1 in
        --bucket) BUCKET=$2 ;;
        --domain) DOMAIN=$2 ;;
        --prefix) PREFIX=$2 ;;
        --region) REGION=$2 ;;
        --profile) PROFILE=$2 ;;
      esac
      shift
      ;;
    -h | --help) usage ;;
    -*) echo "unknown flag: $1" >&2; usage ;;
    *)
      [[ -z $NAME ]] || { echo "unexpected argument: $1" >&2; usage; }
      NAME=$1
      ;;
  esac
  shift
done
[[ -n $NAME ]] || usage
[[ $NAME =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "film name must be kebab-case: $NAME"

for bin in aws jq curl; do
  command -v "$bin" >/dev/null || die "missing $bin"
done

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LOCAL=$ROOT/public/films/$NAME
[[ $OUTPUTS == /* ]] || OUTPUTS=$ROOT/$OUTPUTS

# Bucket and CDN domain: flag > env > outputs file from `cdk deploy --outputs-file`.
if [[ -z $BUCKET && -f $OUTPUTS ]]; then
  BUCKET=$(jq -r '.CloudPortfolioFilms.FilmsBucketName // empty' "$OUTPUTS")
fi
if [[ -z $DOMAIN && -f $OUTPUTS ]]; then
  DOMAIN=$(jq -r '.CloudPortfolioFilms.FilmsDistributionDomainName // empty' "$OUTPUTS")
fi
[[ -n $BUCKET ]] || die "no bucket: pass --bucket, set FILMS_BUCKET, or deploy with --outputs-file $OUTPUTS"
[[ -n $DOMAIN ]] || die "no domain: pass --domain, set FILMS_DOMAIN, or deploy with --outputs-file $OUTPUTS"
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN#http://}
DOMAIN=${DOMAIN%/}
PREFIX=${PREFIX#/}
PREFIX=${PREFIX%/}
KEY_PREFIX=${PREFIX:+$PREFIX/}$NAME
MANIFEST_KEY=$KEY_PREFIX/manifest.json
BASE_URL=https://$DOMAIN/$KEY_PREFIX

AWS=(aws --region "$REGION")
if [[ -n $PROFILE ]]; then AWS+=(--profile "$PROFILE"); fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/sync-film-$NAME.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# --- preflight ---------------------------------------------------------------------------------
echo "== preflight: $LOCAL → s3://$BUCKET/$KEY_PREFIX/ ($BASE_URL)"
[[ -f $LOCAL/manifest.json ]] || die "no $LOCAL/manifest.json — run scripts/films/build-film.sh $NAME first"
[[ -f $LOCAL/poster.webp ]] || die "no $LOCAL/poster.webp"
COUNT=$(jq -r '.count' "$LOCAL/manifest.json")
PAD=$(jq -r '.pad // 4' "$LOCAL/manifest.json")
EXT=$(jq -r '.ext // "webp"' "$LOCAL/manifest.json")
[[ $EXT == webp ]] || die "only webp films are supported (manifest ext is $EXT)"
# shellcheck disable=SC2207  # widths are integers, word-splitting is the point
WIDTHS=($(jq -r '.widths[]' "$LOCAL/manifest.json"))
((${#WIDTHS[@]})) || die "manifest lists no widths"
MAX_W=0
for w in "${WIDTHS[@]}"; do
  got=$(find "$LOCAL/$w" -name 'f_*.webp' 2>/dev/null | wc -l | tr -d ' ')
  [[ $got == "$COUNT" ]] || die "${w}w has $got frames, manifest says $COUNT"
  if ((w > MAX_W)); then MAX_W=$w; fi
done
LOCAL_WEBP=$(find "$LOCAL" -name '*.webp' | wc -l | tr -d ' ')
EXPECT_WEBP=$((COUNT * ${#WIDTHS[@]} + 1))
[[ $LOCAL_WEBP == "$EXPECT_WEBP" ]] || die "$LOCAL holds $LOCAL_WEBP .webp files, expected $EXPECT_WEBP (count × widths + poster)"
LOCAL_BYTES=$(find "$LOCAL" -name '*.webp' -print0 | xargs -0 wc -c | awk '$2 != "total" { s += $1 } END { print s + 0 }')
POSTER_BYTES=$(fsize "$LOCAL/poster.webp")
((POSTER_BYTES <= 204800)) || die "poster is $((POSTER_BYTES / 1024)) KB, limit 200 KB — fix it in build-film.sh, never by hand"
FIRST=$(printf "f_%0${PAD}d.webp" 1)
ACCOUNT=$("${AWS[@]}" sts get-caller-identity --query Account --output text) || die "no AWS credentials (sts get-caller-identity failed)"
echo "  $COUNT frames × ${#WIDTHS[@]} widths (${WIDTHS[*]}) + poster = $LOCAL_WEBP files, $((LOCAL_BYTES / 1024 / 1024)) MB; poster $((POSTER_BYTES / 1024)) KB"
echo "  account $ACCOUNT, region $REGION${PROFILE:+, profile $PROFILE}"

# --- immutability guard -----------------------------------------------------------------------
if head_err=$("${AWS[@]}" s3api head-object --bucket "$BUCKET" --key "$MANIFEST_KEY" 2>&1 >/dev/null); then
  if ((FORCE)); then
    echo "  WARNING: s3://$BUCKET/$MANIFEST_KEY exists; --force re-uploads over an immutable path (stale objects are kept, never deleted)" >&2
  else
    die "s3://$BUCKET/$MANIFEST_KEY already exists. Frames are immutable per name: re-cut under a new name (e.g. $NAME-v2) or pass --force to overwrite anyway."
  fi
elif [[ $head_err != *"(404)"* && $head_err != *"Not Found"* ]]; then
  die "head-object failed: $head_err"
fi

# --- frames: immutable, never --delete --------------------------------------------------------
echo "== sync frames"
SYNC=("${AWS[@]}" s3 sync "$LOCAL/" "s3://$BUCKET/$KEY_PREFIX/"
  --exclude '*' --include '*.webp'
  --content-type image/webp --cache-control 'public, max-age=31536000, immutable' --no-progress)
if ((SIZE_ONLY)); then SYNC+=(--size-only); fi
if ((DRY_RUN)); then SYNC+=(--dryrun); else SYNC+=(--only-show-errors); fi
"${SYNC[@]}"

# --- manifest: short cache so a flip shows within minutes -------------------------------------
echo "== manifest"
jq --arg base "$BASE_URL" '.base = $base | .poster = ($base + "/poster.webp")' "$LOCAL/manifest.json" >"$TMP/manifest.json"
CP=("${AWS[@]}" s3 cp "$TMP/manifest.json" "s3://$BUCKET/$MANIFEST_KEY"
  --content-type application/json --cache-control 'public, max-age=300' --no-progress)
if ((DRY_RUN)); then CP+=(--dryrun); fi
"${CP[@]}"

if ((DRY_RUN)); then
  echo "== dry run: nothing uploaded; verification and --write-manifest skipped"
  echo "  manifest would become:"
  sed 's/^/    /' "$TMP/manifest.json"
  echo "base: $BASE_URL"
  exit 0
fi

# --- verify through the CDN -------------------------------------------------------------------
echo "== verify"
FAILS=0
fail() { echo "  FAIL $*"; FAILS=$((FAILS + 1)); }
# check <label> <url> <content-type> <cache-control substring>. Always sends an Origin header so the
# ACAO assertion exercises the response-headers policy the way a browser's crossOrigin load does.
check() {
  local label=$1 url=$2 want_type=$3 want_cache=$4 code headers ok=1 xcache
  code=$(curl -sS -o /dev/null -D "$TMP/headers" -w '%{http_code}' -H 'Origin: http://localhost:3005' "$url" 2>/dev/null || echo 000)
  headers=$(tr -d '\r' <"$TMP/headers" | tr '[:upper:]' '[:lower:]')
  [[ $code == 200 ]] || { fail "$label: HTTP $code, want 200"; ok=0; }
  grep -q "^content-type: $want_type" <<<"$headers" || { fail "$label: $(grep '^content-type:' <<<"$headers" || echo 'no content-type'), want $want_type"; ok=0; }
  grep -q "^cache-control: .*$want_cache" <<<"$headers" || { fail "$label: $(grep '^cache-control:' <<<"$headers" || echo 'no cache-control'), want $want_cache"; ok=0; }
  grep -q '^access-control-allow-origin: \*' <<<"$headers" || { fail "$label: no access-control-allow-origin: *"; ok=0; }
  xcache=$(grep '^x-cache:' <<<"$headers" | cut -d' ' -f2- || true)
  if ((ok)); then echo "  ok   $label${xcache:+ ($xcache)}"; fi
}

# Fill the edge cache for the first frame WITHOUT an Origin header first: the Origin-carrying request
# below must still get ACAO * from that cache hit (originOverride applies at the edge).
curl -sS -o /dev/null "$BASE_URL/$MAX_W/$FIRST" 2>/dev/null || true
check "poster" "$BASE_URL/poster.webp" image/webp immutable
check "frame $MAX_W/$FIRST" "$BASE_URL/$MAX_W/$FIRST" image/webp immutable
check "manifest" "$BASE_URL/manifest.json" application/json max-age=300

code=$(curl -sS -o /dev/null -w '%{http_code}' "http://$DOMAIN/$KEY_PREFIX/poster.webp" 2>/dev/null || echo 000)
if [[ $code == 301 ]]; then echo "  ok   http → https ($code)"; else fail "http://$DOMAIN/$KEY_PREFIX/poster.webp returned $code, want 301"; fi
code=$(curl -sS -o /dev/null -w '%{http_code}' "https://$BUCKET.s3.$REGION.amazonaws.com/$KEY_PREFIX/poster.webp" 2>/dev/null || echo 000)
if [[ $code == 403 ]]; then echo "  ok   direct S3 URL is private ($code)"; else fail "direct S3 URL returned $code, want 403"; fi

summary=$("${AWS[@]}" s3 ls "s3://$BUCKET/$KEY_PREFIX/" --recursive --summarize)
remote_objects=$(awk '/Total Objects:/ { print $3 }' <<<"$summary")
remote_bytes=$(awk '/Total Size:/ { print $3 }' <<<"$summary")
expect_objects=$((LOCAL_WEBP + 1))
expect_bytes=$((LOCAL_BYTES + $(fsize "$TMP/manifest.json")))
if [[ $remote_objects == "$expect_objects" && $remote_bytes == "$expect_bytes" ]]; then
  echo "  ok   $remote_objects objects, $remote_bytes bytes match local"
else
  fail "bucket holds ${remote_objects:-?} objects / ${remote_bytes:-?} bytes, local is $expect_objects / $expect_bytes (stale objects from an earlier --force? re-cut under a new name)"
fi

((FAILS == 0)) || die "$FAILS verification check(s) failed; manifest not written back"

if ((WRITE_MANIFEST)); then
  cp "$TMP/manifest.json" "$LOCAL/manifest.json"
  echo "== wrote $LOCAL/manifest.json (base/poster → CDN); commit only that file: git status --short public/films"
fi
echo "base: $BASE_URL"

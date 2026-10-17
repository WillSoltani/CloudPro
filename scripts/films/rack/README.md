# The rack scene (homepage part four, "Round Trip")

One Blender 5.2 scene built entirely by `scene.py` from `rack.config.json`: a dark data hall, one 42U rack, six
units that open on rails, two cameras (landscape 1920×1080 and portrait 1080×2340) on one continuous path, and
every key baked per frame. Eight films (`rack-00` … `rack-07`, scene frames 0–216–336–432–552–648–768–900–1032)
are cut from that one timeline, so neighbouring films share their boundary frame byte for byte and the page's
hold keys are exact last frames. Storyboard and caption copy: `films-src/rack/storyboard.md`, `captions.json`
(gitignored). Nothing readable is ever rendered; all text is HTML on the page.

## Install (once, Will)
```bash
brew install --cask blender        # Blender 5.2 LTS (the hosted runner and this script are pinned to 5.2)
blender --version                  # expect 5.2.x; or /Applications/Blender.app/Contents/MacOS/Blender --version
```
Keep ≥ 10 GB free: PNG masters are 1–3 MB a frame (≈ 1–3 GB per camera at peak); the built WebP tiers are ≈ 60–80 MB.

## Without Blender (now)
```bash
python3 scripts/films/rack/scene.py selftest     # config, timeline, camera path, holds, rigs, amber frames (74 checks)
python3 scripts/films/rack/scene.py timeline     # the page's rack.timeline.json content
python3 scripts/films/rack/scene.py export --out films-src/rack/export   # writes rack.timeline.json (plates need Blender)
python3 scripts/films/rack/scene.py plan         # per-frame state hashes (every frame stale until rendered)
```

## With Blender, in order
```bash
scripts/films/rack/render.sh build                 # → films-src/rack/rack.blend (geometry, rigs, lights, cameras, keys)
scripts/films/rack/render.sh check                 # structural audit: no text, no image textures, clearance, hold centres
scripts/films/rack/render.sh preview landscape     # 25 % EEVEE stills at the beat frames → renders/preview-landscape.png
scripts/films/rack/render.sh preview portrait
scripts/films/rack/render.sh render rack-01 landscape --frames 216-264   # the 48-frame look-dev rehearsal (G2)
scripts/films/rack/render.sh render rack-00 landscape                    # full films, one Blender process each …
scripts/films/rack/render.sh render rack-00 portrait
scripts/films/rack/render.sh export                # rack.timeline.json + plate corner tracks for the page
```
Frames land in `films-src/rack/renders/<film>[-p]/f_<scene frame>.png`. Build a film for the page with the frame
builder's frames mode: `QUALITY=75 scripts/films/build-film.sh rack-01 films-src/rack/renders/rack-01` (portrait:
`WIDTHS="432 720 1080" … rack-01-p …`). Hold keys are byte copies of each film's last 1920 frame.

## Render settings (scene.py `render`)
EEVEE, 64 TAA samples (`--samples`), motion blur off, DOF on (f/4 in the long views, f/8 at the holds), AgX,
8-bit RGB PNG, deterministic sample pattern. `--res-scale 0.25` for previews, `--twice` renders a frame twice and
compares the bytes (determinism check). Cycles is the fallback if EEVEE reads too clean at G2.

## Files
- `scene.py` — the whole scene; subcommands `build | check | plan | render | export | meter | selftest | timeline`.
- `rack.config.json` — units (U, height, kind, mechanism, travel, angles, hold plane), films (frames, beats, camera
  waypoints, rigs, amber), cameras, hold rule, poses, request path, hall, LEDs, lights, look, seed.
- `render.sh`, `preview-sheet.sh` — local wrappers (caffeinate, factory startup, output folders, contact sheets).
- `homography.test.mjs` — tests for the page's perspective-plate maths (`node --experimental-strip-types --test`).

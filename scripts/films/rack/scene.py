"""soltani.org part four, "Round Trip": one hall, one rack, one camera path (Blender 5.2).

Reference: films-src/rack/storyboard.md (G1, approved; 96 frames per viewport). Config: rack.config.json.
Local:  blender -b --factory-startup --python scene.py -- <build|check|plan|render|export> [options]
          build [--stage all|geometry|anim]      check [--no-clearance]      plan [--film F] [--full]
          render --film rack-01 --camera landscape|portrait [--frames a-b|a,b,c] [--res-scale 0.25]
                 [--samples N] [--out DIR] [--twice] [--border x0,x1,y0,y1] [--no-warmup]
                                                           frames are SCENE frames, files f_%05d.png
          render --tail rack-0N --camera C [--frames T] [--ks a-b] [--zero] [--master FILE|DIR] [--out DIR] [--no-link]
                                                           breathing tail at the hold: t_001..t_T.png, t_T a hard link
          export [--plates] [--anchors] [--out DIR]       timeline (+ tail, anchors) and plate tracks (-p: portrait)
          meter --frames a,b --camera C [--wash 1,2] [--bay 1,0.5] [--ev -1,0,1] [--box x0,x1,y0,y1]
Hosted: CONFIG_JSON = <rack.config.json as a str> + HOSTED = True + this file + `result = main([...])`.

Rules: geometry through bmesh and the data API only (bpy.ops only to render); objects named by role;
every random draw from rng(cfg, name) = Random(crc32(f"{seed}:{name}")); no wall clock in build;
camera, rigs, lights and exposure are pure functions of the scene frame, baked to keys on every frame
(constant runs dropped, exact under LINEAR/CONSTANT interpolation). The pure math runs without bpy.
"""
import json, math, os, sys, zlib, random, hashlib, time, tempfile

try:
    import bpy, bmesh
    from mathutils import Vector, Matrix, Euler
except ImportError:  # pure-math use outside Blender (tests)
    bpy = None

try:
    CONFIG_JSON
except NameError:
    CONFIG_JSON = None
try:
    HOSTED
except NameError:
    HOSTED = False

PI = math.pi


def load_config():
    if CONFIG_JSON:
        return json.loads(CONFIG_JSON)
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rack.config.json")) as fh:
        return json.load(fh)


# ------------------------------------------------------------------ pure math
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def smoother(t):
    t = clamp(t)
    return t * t * t * (t * (t * 6 - 15) + 10)


def ease(x, a, b):
    if b <= a:
        return 1.0 if x >= b else 0.0
    return smoother((x - a) / (b - a))


def lerp(a, b, t):
    return a + (b - a) * t


def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def v_dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def v_len(a): return math.sqrt(v_dot(a, a))


def rng(cfg, name):
    return random.Random(zlib.crc32(f"{cfg['seed']}:{name}".encode()))


def pw_linear(keys, x):
    if x <= keys[0][0]:
        return keys[0][1]
    for (x0, y0), (x1, y1) in zip(keys, keys[1:]):
        if x <= x1:
            return y1 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return keys[-1][1]


def pw_eased(keys, x):
    if not keys:
        return 0.0
    if x <= keys[0][0]:
        return keys[0][1]
    for (x0, y0), (x1, y1) in zip(keys, keys[1:]):
        if x <= x1:
            return y1 if x1 == x0 else y0 + (y1 - y0) * smoother((x - x0) / (x1 - x0))
    return keys[-1][1]


def pchip(xs, ys, x):
    """Monotone C1 cubic through (xs, ys) (Fritsch-Carlson); flat where neighbouring secants disagree."""
    n = len(xs)
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    h = [max(xs[i + 1] - xs[i], 1e-9) for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    i = 0
    while i < n - 2 and x > xs[i + 1]:
        i += 1
    t = (x - xs[i]) / h[i]
    t2, t3 = t * t, t * t * t
    return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
            + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])


def cr_centripetal(P0, P1, P2, P3, s):
    def tj(ti, a, b):
        return ti + max(v_len(v_sub(b, a)), 1e-6) ** 0.5
    t0 = 0.0
    t1 = tj(t0, P0, P1); t2 = tj(t1, P1, P2); t3 = tj(t2, P2, P3)
    t = t1 + (t2 - t1) * s
    def mix(A, B, ta, tb):
        return v_add(v_mul(A, (tb - t) / (tb - ta)), v_mul(B, (t - ta) / (tb - ta)))
    A1, A2, A3 = mix(P0, P1, t0, t1), mix(P1, P2, t1, t2), mix(P2, P3, t2, t3)
    return mix(mix(A1, A2, t0, t2), mix(A2, A3, t1, t3), t1, t2)


def cr_scalar(p0, p1, p2, p3, s):
    return 0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s
                  + (3 * p1 - p0 - 3 * p2 + p3) * s * s * s)


def _vnoise(seed, ch, t):
    i = math.floor(t)
    def h(n):
        return zlib.crc32(f"{seed}:hh:{ch}:{n}".encode()) / 4294967295.0 * 2 - 1
    f = t - i
    return lerp(h(i), h(i + 1), f * f * (3 - 2 * f))


# ------------------------------------------------------------------ camera optics
def cam_tans(cc):
    """tan(half fov) horizontal, vertical, and of the larger side (Blender sensor_fit AUTO)."""
    W, H = cc["res"]
    tl = (cc["sensor_mm"] / 2.0) / cc["lens_mm"]
    return (tl, tl * H / W, tl) if W >= H else (tl * W / H, tl, tl)


def cam_axes(yaw, pitch):
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    return (cy, sy, 0.0), (sp * sy, -sp * cy, cp), (-sy * cp, cy * cp, sp)  # right, up, forward


def cam_euler(yaw, pitch):
    return (PI / 2 + pitch, 0.0, yaw)


def shift_y_for(cc, v, fy):
    """Blender shift_y that puts a point at image-plane height v (tangent units) at frame y fy (from top)."""
    th, tv, tl = cam_tans(cc)
    return (v + tv * (2 * fy - 1)) / (2 * tl)


def project(cc, pos, yaw, pitch, sx, sy, p):
    """Frame position (x from left, y from top, 0..1) of world point p, or None if behind."""
    th, tv, tl = cam_tans(cc)
    r, u, f = cam_axes(yaw, pitch)
    d = v_sub(p, pos)
    depth = v_dot(d, f)
    if depth <= 1e-9:
        return None
    ui, vi = v_dot(d, r) / depth, v_dot(d, u) / depth
    return ((ui - (2 * sx * tl - th)) / (2 * th), 1 - (vi - (2 * sy * tl - tv)) / (2 * tv))


# ------------------------------------------------------------------ timeline and units
def film_table(cfg):
    """Segment i covers scene frames [a, b], b = a + frames = next a; film i carries both ends."""
    a, out = cfg["frame_start"], []
    for f in cfg["films"]:
        b = a + f["frames"]
        if f.get("range") and list(f["range"]) != [a, b]:
            raise ValueError(f"{f['name']}: range {f['range']} != computed {[a, b]}")
        out.append(dict(f, a=a, b=b))
        a = b
    return out


def slot_bot(cfg, u):
    return cfg["rack"]["u1_z"] + (u - 1) * cfg["rack"]["U"]


def slot_hh(cfg, unit):
    return unit["h"] * cfg["rack"]["U"] - cfg["rack"]["gap"]


def resolved_units(cfg):
    units = [dict(u) for u in cfg["units"]]
    if cfg.get("fill") == "auto":
        af = cfg["autofill"]
        lo, hi = af["range"]
        r = rng(cfg, "autofill")
        blanks = set(r.sample(list(range(lo, hi + 1)), af["blanks"]))
        p = hi
        while p >= lo:
            if p in blanks:
                units.append({"id": f"u{p}", "kind": "blank", "u": p, "h": 1, "mech": "none"}); p -= 1
            elif p - 1 >= lo and (p - 1) not in blanks and r.random() < af["p2u"]:
                units.append({"id": f"u{p - 1}", "kind": "server2u", "u": p - 1, "h": 2, "mech": "none",
                              "depth": af["depth"]}); p -= 2
            else:
                units.append({"id": f"u{p}", "kind": "server1u", "u": p, "h": 1, "mech": "none",
                              "depth": af["depth"]}); p -= 1
    units.sort(key=lambda d: -d["u"])
    return units


def opening_units(cfg):
    return [u for u in resolved_units(cfg) if u.get("mech", "none") != "none"]


MECH_PARTS = {
    "slide_lid": ["sled", "rail_mid", "lid"],
    "door_carrier": ["front", "sled", "rail_mid"],
    "slide": ["sled", "rail_mid"],
    "slide_lid_aircover": ["sled", "rail_mid", "lid", "aircover"],
    "door_tray": ["front", "sled", "rail_mid"],
    "slide_cover": ["sled", "rail_mid", "front"],
}
IN_SLOT = ("sled", "rail_mid")          # parts that must stay inside their U slot at open 0 and 1


def rig_parts(u):
    parts = list(MECH_PARTS.get(u.get("mech", "none"), []))
    if u.get("mech") == "door_carrier":
        parts += [f"cart{k + 1}" for k in range(u.get("cartridges", 4))]
    return parts


def part_parent(u, part):
    if part in ("lid", "aircover") or part.startswith("cart"):
        return "sled"
    if part == "front" and u["mech"] == "slide_cover":
        return "sled"
    return "rig"


def face_part(u):
    """The part carrying the label well and the status light."""
    return {"door_carrier": "body", "door_tray": "body", "slide_cover": "front"}.get(u["mech"], "sled")


def part_rest(cfg, u, part):
    hh = slot_hh(cfg, u)
    if part == "front":
        return (0.0, 0.0, 0.0004)
    if part == "lid":
        return (0.0, u["depth"], hh - 0.0004)          # hinge on the rear top edge
    if part == "aircover":
        return (0.0, 0.44, 0.065)                      # its rear edge, resting on the heat sinks
    if part.startswith("cart"):
        k, n = int(part[4:]) - 1, u.get("cartridges", 4)
        return ((k - (n - 1) / 2.0) * 0.102, u.get("cart_y", 0.046), 0.0138)   # bottom-rear edge, on the carrier
    return (0.0, 0.0, 0.0)


def part_local(cfg, u, part, o):
    """(location, rotation_euler) of a rig part relative to its parent, as a pure function of open."""
    w, tr, A, rest = u.get("windows", {}), u.get("travel", 0.0), u.get("angles", {}), part_rest(cfg, u, part)
    dx = dy = dz = rx = 0.0
    if part == "sled":
        dy = -tr * ease(o, *w["slide"])
    elif part == "rail_mid":
        dy = -0.5 * tr * ease(o, *w["slide"])
    elif part == "lid":
        if "lid_back" in w:
            dy = u.get("lid_back", 0.0) * ease(o, *w["lid_back"])
        rx = -math.radians(A["lid"]) * ease(o, *w["lid"])
    elif part == "aircover":
        a0, a1 = w["aircover"]
        s = a1 - a0
        dz = u["aircover"]["lift"] * ease(o, a0, a0 + 0.3 * s)
        dy = u["aircover"]["slide"] * ease(o, a0 + 0.3 * s, a0 + 0.6 * s)
        rx = -math.radians(A["aircover"]) * ease(o, a0 + 0.6 * s, a1)
    elif part == "front":
        rx = math.radians(A["front"]) * ease(o, *w["front"])
    elif part.startswith("cart"):
        t0 = w["tip0"] + (int(part[4:]) - 1) * w["tip_step"]
        rx = -math.radians(A["cartridge"]) * ease(o, t0, t0 + w["tip_len"])
    return (rest[0] + dx, rest[1] + dy, rest[2] + dz), (rx, 0.0, 0.0)


def rig_keys(cfg):
    keys = {}
    for f in film_table(cfg):
        for rid, ks in f.get("rigs", []):
            keys.setdefault(rid, []).extend((f["a"] + k[0], float(k[1])) for k in ks)
    for rid in keys:
        keys[rid].sort()
    return keys


def amber_frames(cfg):
    out = {}
    for f in film_table(cfg):
        for uid, lf in f.get("amber", []):
            out[uid] = f["a"] + lf
    return out


def film_keys(cfg, name):
    keys = []
    for fl in film_table(cfg):
        keys += [(fl["a"] + k[0], float(k[1])) for k in fl.get(name, [])]
    return sorted(keys)


def bay_level(cfg, f):
    return pw_eased(film_keys(cfg, "bay"), f)


def haze_level(cfg, f):
    return pw_eased(film_keys(cfg, "haze"), f)


def fill_level(cfg, f):
    """Multiplier on the camera fill (default 1): a film's `fill` keys [[local f, x], ...], eased."""
    k = film_keys(cfg, "fill")
    return pw_eased(k, f) if k else 1.0


def exposure_targets(cfg):
    """Per-film end exposure: a film's own `exposure` (set from `meter`), else the hero's plus inverse-square
    compensation for the bay strip, clamped to look.exposure_max_stops."""
    lk, b = cfg["look"], cfg["lights"]["bay"]
    ub = {u["id"]: u for u in resolved_units(cfg)}
    out = []
    for fl in film_table(cfg):
        u = ub.get(fl.get("unit"))
        if fl.get("exposure_keys"):
            out.append(float(fl["exposure_keys"][-1][1]))
        elif "exposure" in fl:
            out.append(float(fl["exposure"]))
        elif u is None:
            out.append(lk["exposure"])
        else:
            st = math.log2(((b["pos"][2] - u["hold"]["plane_z"]) / b["ref_dist"]) ** 2)
            out.append(lk["exposure"] + clamp(st, -lk["exposure_max_stops"], lk["exposure_max_stops"]))
    return out


def exposure_at(cfg, f):
    """Changes only inside each film's exposure window (default: never in its last 24 frames). A film may instead
    carry `exposure_keys` [[local frame, EV], ...]: eased from the previous film's end value through each key."""
    T, prev = exposure_targets(cfg), cfg["look"]["exposure"]
    for i, fl in enumerate(film_table(cfg)):
        if f <= fl["b"]:
            if fl.get("exposure_keys"):
                return pw_eased([(fl["a"], prev)] + [(fl["a"] + k, float(v)) for k, v in fl["exposure_keys"] if k > 0], f)
            w0, w1 = fl.get("exposure_window", [0, fl["frames"] - 24])
            return lerp(prev, T[i], ease(f, fl["a"] + w0, fl["a"] + w1))
        prev = T[i]
    return prev


def _cum(pts):
    c = [0.0]
    for a, b in zip(pts, pts[1:]):
        c.append(c[-1] + v_len(v_sub(b, a)))
    return c


def polyline_len(pts, cum, s):
    s = clamp(s, 0.0, cum[-1])
    for i in range(len(pts) - 1):
        if s <= cum[i + 1] or i == len(pts) - 2:
            L = cum[i + 1] - cum[i]
            t = 0.0 if L <= 0 else clamp((s - cum[i]) / L)
            return v_add(pts[i], v_mul(v_sub(pts[i + 1], pts[i]), t))
    return tuple(pts[-1])


def request_state(cfg, f):
    """(visible, position, scale 0..1) of the travelling point at scene frame f (arc length by PCHIP)."""
    rq = cfg["request"]
    for fl in film_table(cfg):
        r = fl.get("request")
        if not r:
            continue
        pts = [tuple(p) for p in rq["path_in" if r["path"] == "in" else "path_out"]]
        cum = _cum(pts)
        g0, g1 = fl["a"] + r["fade"][0], fl["a"] + r["fade"][1]
        end = fl["a"] + r.get("hide_after", fl["frames"])
        if g0 <= f <= end:
            s = pchip([fl["a"] + k[0] for k in r["keys"]], [cum[k[1]] for k in r["keys"]], f)
            return True, polyline_len(pts, cum, s), smoother((f - g0) / max(g1 - g0, 1))
    return False, tuple(rq["path_in"][0]), 0.0


def request_glow_width(cfg, f):
    """Width (rho^2 scale) of the bead's glow lobe: request.look.glow[1], widened in a film by its request.glow_width
    keys [[local f, width], ...] (eased) so the reply's whole disc glows as a lamp in the fog instead of showing its
    dark rim against it."""
    w0 = float(cfg["request"]["look"]["glow"][1])
    for fl in film_table(cfg):
        g = (fl.get("request") or {}).get("glow_width")
        if g and fl["a"] <= f <= fl["b"]:
            return pw_eased([(fl["a"] + k, float(v)) for k, v in g], f) if f >= fl["a"] + g[0][0] else w0
    return w0


def request_grow(cfg, f):
    """Size factor of the point's bead (its light is unchanged): a film's request.grow keys [[local f, factor], ...],
    eased; the reply swells slowly while it climbs so its core meets tower-K4's lamp at the dissolve."""
    for fl in film_table(cfg):
        g = (fl.get("request") or {}).get("grow")
        if g and fl["a"] <= f <= fl["b"]:
            return pw_eased([(fl["a"] + k, float(v)) for k, v in g], f)
    return 1.0


# ------------------------------------------------------------------ the exit's ceiling fog (VOL_upper), pure
def upper_level(cfg, f):
    """Level 0..1 of the exit's ceiling fog (a film's `upper` keys [[local f, level], ...], eased); 0 elsewhere."""
    return pw_eased(film_keys(cfg, "upper"), f)


def grad_level(cfg, f):
    """Strength 0..1 of the compositor's graduated top filter (a film's `grad` keys, eased); 0 elsewhere."""
    return pw_eased(film_keys(cfg, "grad"), f)


def riser_fade_on(cfg, f):
    """The riser swaps to its height-faded twin from a film's `riser_fade_from` (local frame) onward."""
    return any(fl.get("riser_fade_from") is not None and f >= fl["a"] + fl["riser_fade_from"] for fl in film_table(cfg))


def request_volume(cfg, f):
    """Volume factor of the request light: a film's request.volume keys [[local f, factor], ...], eased; else
    lights.request.volume (the lamp-in-fog halo of the exit)."""
    ks = sorted((fl["a"] + k, float(v)) for fl in film_table(cfg) for k, v in (fl.get("request") or {}).get("volume", []))
    return pw_eased(ks, f) if ks else float(cfg["lights"]["request"].get("volume", 0.0))


def upper_sigma(cfg, p, lv):
    """Extinction (1/m) of VOL_upper at world point p for level lv: sigma_max * smootherstep((z - z0)/dz) * lv inside
    its box (Principled Volume with a black absorption colour: extinction = density)."""
    up, bx = cfg["look"].get("upper"), cfg["hall"].get("upper_box")
    if not up or not bx or lv <= 0.0:
        return 0.0
    if not (bx[0] <= p[0] <= bx[1] and bx[2] <= p[1] <= bx[3] and bx[4] <= p[2] <= bx[5]):
        return 0.0
    return up["sigma_max"] * smoother((p[2] - up["base"][0]) / up["base"][1]) * lv


def optical_depth(cfg, a, b, f, n=400):
    """Optical depth of VOL_upper along the segment a -> b at scene frame f (midpoint rule; 0.0 exactly when off)."""
    lv = upper_level(cfg, f)
    if lv <= 0.0:
        return 0.0
    d = v_sub(b, a)
    return sum(upper_sigma(cfg, v_add(a, v_mul(d, (i + 0.5) / n)), lv) for i in range(n)) * v_len(d) / n


def ray_depth(cfg, c, d, f, far=40.0, step=0.005):
    """Optical depth of VOL_upper along the ray c + t d (d unit) until it leaves the box or meets the slab."""
    lv, bx = upper_level(cfg, f), cfg["hall"].get("upper_box")
    if lv <= 0.0 or not bx:
        return 0.0
    tau, t = 0.0, 0.5 * step
    while t < far:
        p = v_add(c, v_mul(d, t))
        if p[2] >= cfg["lights"]["wash"]["ceiling_z"] or not (bx[0] <= p[0] <= bx[1] and bx[2] <= p[1] <= bx[3]) \
                or (d[2] < 0 and p[2] < bx[4]):
            break
        tau += upper_sigma(cfg, p, lv) * step
        t += step
    return tau


def _box_dist(p, b):
    """Distance from point p to the axis-aligned box b = (x0, x1, y0, y1, z0, z1) (0 inside)."""
    d = [max(b[2 * i] - p[i], 0.0, p[i] - b[2 * i + 1]) for i in range(3)]
    return math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])


def clearance_boxes(cfg):
    """Analytic boxes (from the config alone) of what the exit's camera rises past: the slab, the bay strip's
    housing and its hangers, the aisle fixtures (housing up to the slab: their wires), the sprinkler main (and its
    hangers), the cross tray (trapeze, up to the slab: its rods) and the hero rack's cabinet. Conservative: each
    box is at least as large as the geometry build_hall / build_lights_cams makes."""
    hl, L, T, rk = cfg["hall"], cfg["lights"], cfg["hall"]["trays"], cfg["rack"]
    cz = L["wash"]["ceiling_z"]
    x0, x1, y0, y1 = hl["floor"]
    out = [("slab", (x0, x1, y0, y1, cz, cz + 0.06))]
    b = L["bay"]
    bx, by, bz = b["pos"]
    sx, sy = b["size"][0] / 2, b["size"][1] / 2
    out.append(("bay_housing", (bx - sx - 0.025, bx + sx + 0.025, by - sy - 0.006, by + sy + 0.006, bz + 0.02, bz + 0.055)))
    for s in (-1, 1):
        out.append(("bay_housing", (bx + s * sx - 0.0015, bx + s * sx + 0.0015, by - 0.0015, by + 0.0015, bz + 0.055, cz)))
    fx = L["wash"]["fixture"]
    for ln in L["wash"]["lines"]:
        y, hw, hy = ln["y"][0], fx["width"] / 2 + 0.015, fx["length"] / 2
        while y + fx["length"] <= ln["y"][1] + 1e-6:
            cy = y + hy
            out.append(("fixture", (ln["x"] - hw, ln["x"] + hw, cy - hy, cy + hy, ln["z"] - 0.006, cz)))
            y += fx["pitch"]
    sv = hl.get("services")
    if sv:
        sx_, sz_, sr_ = sv["sprinkler"]
        out.append(("sprinkler", (sx_ - sr_ - 0.004, sx_ + sr_ + 0.004, y0, y1, sz_ - sr_ - 0.004, cz)))
    w = T["width"] / 2
    out.append(("cross_tray", (T["rows_x"][0] - 0.15, T["rows_x"][1] + 0.15, T["cross_y"] - w - 0.06,
                               T["cross_y"] + w + 0.06, T["z"] - 0.06, cz)))
    out.append(("rack", (-rk["width"] / 2, rk["width"] / 2, rk["front_y"], rk["front_y"] + rk["depth"], 0.0,
                         rk["height"] + 0.05)))
    return out


def exit_clearance(cfg, path, film):
    """Least distance (m) from each camera to each analytic box over a film's frames, and from each camera to the
    door's hinge line while the door moves: {camera: {object: [m, frame]}}."""
    rk, boxes = cfg["rack"], clearance_boxes(cfg)
    dk = rig_keys(cfg).get("door")
    hx, hy, hz = (-1 if rk["door"]["hinge"] == "left" else 1) * rk["width"] / 2, rk["front_y"], (rk["plinth"], rk["top_z"])
    out = {"landscape": {}, "portrait": {}}
    for f in range(film["a"], film["b"] + 1):
        p = pose_at(cfg, path, f)
        moving = dk is not None and abs(pw_linear(dk, f) - pw_linear(dk, f - 1)) > 1e-12
        for key, c in (("landscape", (p["x"], p["y"], p["z"])), ("portrait", portrait_of(p))):
            row = out[key]
            for name, bb in boxes:
                d = _box_dist(c, bb)
                if name not in row or d < row[name][0]:
                    row[name] = [round(d, 4), f]
            if moving:
                d = _box_dist(c, (hx, hx, hy, hy, hz[0], hz[1]))
                if "door_hinge" not in row or d < row["door_hinge"][0]:
                    row["door_hinge"] = [round(d, 4), f]
    return out


def frame_ray(cc, yaw, pitch, sx, sy, fx, fy):
    """Unit world direction through frame point (fx, fy) (x from left, y from top) of a camera (project's inverse)."""
    th, tv, tl = cam_tans(cc)
    r, u, f = cam_axes(yaw, pitch)
    ui, vi = fx * 2 * th + (2 * sx * tl - th), (1 - fy) * 2 * tv + (2 * sy * tl - tv)
    d = v_add(f, v_add(v_mul(r, ui), v_mul(u, vi)))
    return v_mul(d, 1.0 / v_len(d))


def exit_film(cfg):
    return next((fl for fl in film_table(cfg) if fl["role"] == "exit"), None)


def exit_checks(cfg, path):
    """Plan part five 3a, pure: [(ok, message)] for the exit film (the reply's track on both cameras, the fog's
    level, its optical depth at the last frame, the per-camera gains, analytic clearances). Shared by selftest and
    check."""
    fl, out = exit_film(cfg), []
    if fl is None:
        return [(False, "no film with role 'exit'")]
    a, b, cams, rq = fl["a"], fl["b"], cfg["cameras"], cfg["request"]
    vis = [f for f in range(a, b + 1) if request_state(cfg, f)[0]]
    first = vis[0] if vis else None
    out.append((first == a + 86, f"reply first visible at scene frame {first} (plan: 734)"))
    top, rt = rq["path_out"][-1][2], rq["riser_top"]
    out.append((top <= rt - 0.30 + 1e-9, f"path_out ends at z {top} <= riser_top - 0.30 ({rt - 0.30:.2f})"))
    # the reply's track over 740..810 on both cameras: centred, inside y 0.15..0.40, never climbing back > 0.015
    # within 6 frames, at poses.point_end.screen +- 0.002 over the static tail
    tail = next(((x, y) for f_, x, y in static_tails(cfg) if f_["name"] == fl["name"]), (b, b))
    want = tuple(cfg["poses"]["point_end"]["screen"])
    t0 = a + next((bt["from"] for bt in fl["beats"] if bt["id"] == "reply_climbs"), 92)
    for key in ("landscape", "portrait"):
        xs, ys, end = [], [], []
        for f in range(t0, b + 1):
            p = pose_at(cfg, path, f)
            pos, sx, sy = ((p["x"], p["y"], p["z"]), p["sx"], p["sy"]) if key == "landscape" else (portrait_of(p), p["psx"], p["psy"])
            q = project(cams[key], pos, p["yaw"], p["pitch"], sx, sy, request_state(cfg, f)[1])
            xs.append(q[0]); ys.append(q[1])
            if tail[0] <= f <= tail[1]:
                end.append(max(abs(q[0] - want[0]), abs(q[1] - want[1])))
        rev = max(ys[i] - ys[j] for i in range(len(ys)) for j in range(i + 1, min(i + 7, len(ys))))
        dx = max(abs(x - 0.5) for x in xs)
        out.append((dx <= 0.01, f"{key} reply x within 0.50 +- 0.01 over {t0}-{b} (worst {dx:.4f})"))
        out.append((0.15 <= min(ys) and max(ys) <= 0.40, f"{key} reply y {min(ys):.4f}..{max(ys):.4f} inside 0.15..0.40"))
        out.append((rev <= 0.015, f"{key} reply never climbs back > 0.015 within 6 frames (worst {rev:.4f})"))
        out.append((max(end) <= 0.002, f"{key} reply at {want} +- 0.002 over {tail[0]}-{tail[1]} (worst {max(end):.5f})"))
    # the fog: off (level 0, VOL_upper hidden) before the exit's fog_gathers beat starts, and nowhere in rack-01..04
    k0 = film_keys(cfg, "upper")[0][0] if film_keys(cfg, "upper") else b
    on = [f for f in range(0, k0 + 1) if upper_level(cfg, f) > 0.0]
    out.append((not on and k0 == a + 60, f"VOL_upper level 0 (hidden) at every frame up to {k0} (plan: before 708)"
                + ("" if not on else f": on at {on[:3]}")))
    hz = [f for n in HAZE_FREE for x in film_table(cfg) if x["name"] == n for f in range(x["a"] + 1, x["b"])
          if haze_level(cfg, f) > 0.0]
    out.append((not hz, "hall haze 0 inside rack-01..rack-04" + ("" if not hz else f" (at {hz[:3]})")))
    # optical depth at the last frame: centre ray >= 6 on both cameras, top-edge ray >= 4.5 / 2.5
    p = pose_at(cfg, path, b)
    for key, pos, sx, sy, top_min in (("landscape", (p["x"], p["y"], p["z"]), p["sx"], p["sy"], 4.5),
                                      ("portrait", portrait_of(p), p["psx"], p["psy"], 2.5)):
        tc = ray_depth(cfg, pos, frame_ray(cams[key], p["yaw"], p["pitch"], sx, sy, 0.5, 0.5), b)
        tt = ray_depth(cfg, pos, frame_ray(cams[key], p["yaw"], p["pitch"], sx, sy, 0.5, 0.0), b)
        out.append((tc >= 6.0 and tt >= top_min, f"{key} optical depth at f{b}: centre {tc:.2f} (>= 6), top edge "
                    f"{tt:.2f} (>= {top_min})"))
    # gains: finite, >= 1, constant over the static tail
    G = [request_gains(cfg, path, f) for f in range(tail[0], tail[1] + 1)]
    for key in ("landscape", "portrait"):
        gs = [g[key] for g in G]
        ok = all(math.isfinite(g) and g >= 1.0 for g in gs) and max(gs) - min(gs) < 1e-12
        out.append((ok, f"{key} fog gain finite and constant over the tail ({gs[0]:.3f})"))
    # analytic clearances on both cameras, and the door hinge while the door moves
    cl = exit_clearance(cfg, path, fl)
    for key, row in cl.items():
        bad = {k: v for k, v in row.items() if v[0] < (0.70 if k == "door_hinge" else cfg["hold"]["clearance_m"])}
        out.append((not bad, f"{key} analytic clearance (m, frame): " + ", ".join(f"{k} {v[0]:.3f}@{v[1]}" for k, v in row.items())
                    + ("" if not bad else f"; BELOW: {sorted(bad)}")))
    return out


def request_gains(cfg, path, f, p=None):
    """Per-camera gain exp(tau camera -> point) on the reply bead's emission and its light, so the point keeps its
    strength inside the ceiling fog; exactly 1.0 wherever VOL_upper is off (every frame before the exit's fog)."""
    vis, P, _ = request_state(cfg, f)
    if not vis or upper_level(cfg, f) <= 0.0:
        return {"landscape": 1.0, "portrait": 1.0}
    p = p or pose_at(cfg, path, f)
    cl = float(cfg["look"]["upper"].get("gain_clamp", 200.0))
    return {k: min(math.exp(optical_depth(cfg, c, P, f)), cl)
            for k, c in (("landscape", (p["x"], p["y"], p["z"])), ("portrait", portrait_of(p)))}


# ------------------------------------------------------------------ poses and the camera path
CH = ("x", "y", "z", "yaw", "pitch", "focus", "sx", "sy", "lrho", "psx", "psy", "fstop")
OPT = ("sx", "sy", "lrho", "psx", "psy", "fstop")


SLED_WALL_TOP = {"door_tray": 0.08, "door_carrier": 0.024}   # sled wall top above the slot bottom (else hh - 0.006)
HEM_IN, HEM_T = 0.0055, 0.0008          # each sled wall's hem, folded inward along its top: inner edge inboard of the
                                        # wall's outer face (rin), and its thickness (build_units)
PLINTH_RECESS, PLINTH_FLOOR = 0.035, 0.012   # the hero rack's plinth: its front face behind the rack front, its underside


def sled_wall_top(cfg, u):
    return SLED_WALL_TOP.get(u.get("mech"), slot_hh(cfg, u) - 0.006)


def wall_edge(cfg, u):
    """(half-width, world z) of the innermost edge of an opened sled's walls seen from above: the inner lower corner
    of the hem along each wall top (inboard of it only the wall's inner face, in its own shadow)."""
    return cfg["rack"]["body_width"] / 2 - HEM_IN, slot_bot(cfg, u["u"]) + sled_wall_top(cfg, u) - HEM_T


def ups_modules(u):
    """The UPS's two battery modules, sled-local (_int_ups): centre offset |x|, half width, front y0, rear y1."""
    y0, y1 = u.get("module_y", (0.076, 0.272))
    return u.get("module_xc", 0.0914), u.get("module_hw", 0.0905), y0, y1


def hold_cy(u):
    """C's distance behind the sled's front edge: hold.cy, else derived from the parts §2 names (the battery's C is
    the centre of its two modules, so it follows them if they move)."""
    if "cy" in u["hold"]:
        return u["hold"]["cy"]
    if u["kind"] == "ups":
        _, _, y0, y1 = ups_modules(u)
        return (y0 + y1) / 2
    raise KeyError(f"{u['id']}: hold.cy")


def hold_centre(cfg, u):
    return (0.0, cfg["rack"]["face_y"] - u.get("travel", 0.0) + hold_cy(u), u["hold"]["plane_z"])


def hold_walls(cfg, u):
    """(half-width, world z) the hold fits to the wall band: the unit's hold.inner_width (the width its walls'
    innermost edge really has; default hold.inner_width) at hold.wall_z (default the subject plane)."""
    h = u["hold"]
    return h.get("inner_width", cfg["hold"]["inner_width"]) / 2, h.get("wall_z", h["plane_z"])


def hero_rack_span(cfg):
    """The hero rack's full height seen square-on: the plinth's lower front edge and the top's front edge."""
    rk = cfg["rack"]
    return (0.0, rk["front_y"] + PLINTH_RECESS, PLINTH_FLOOR), (0.0, rk["front_y"], rk["height"])


def hold_walls_x(cfg, u, key, pos, yaw, pitch, sx, sy):
    """Frame x (left, right) on camera `key` of a hold's walls: walls_x = the fitted inner walls (hold_walls),
    hem_x = the hem's innermost edge from the geometry (wall_edge), rails_x = the rails' outer faces at their top."""
    cc, C = cfg["cameras"][key], hold_centre(cfg, u)
    xw, wz = hold_walls(cfg, u)
    xh, zh = wall_edge(cfg, u)
    hh, z0 = slot_hh(cfg, u), slot_bot(cfg, u["u"])
    zr = z0 + (0.024 if u.get("mech") == "door_carrier" else hh / 2 + min(0.016, hh * 0.35))
    pr = lambda x, z: [project(cc, pos, yaw, pitch, sx, sy, (s * x, C[1], z))[0] for s in (-1, 1)]
    return {"walls_x": pr(xw, wz), "hem_x": pr(xh, zh), "rails_x": pr(cfg["rack"]["rail_span"] / 2, zr)}


def in_wall_band(cfg, key, xs, eps=1e-4):
    """Storyboard §7: the left wall inside hold.wall_band[key] (x 0.06-0.10 landscape, 0.04-0.07 portrait), the
    right one inside its mirror."""
    lo, hi = cfg["hold"]["wall_band"][key]
    return lo - eps <= xs[0] <= hi + eps and 1 - hi - eps <= xs[1] <= 1 - lo + eps


def hero_height_share(cfg, key, pos, yaw, pitch, sx, sy):
    """Share of the frame height (and width) the hero rack fills on camera `key`, and its middle's frame y."""
    cc, (bot, top), W = cfg["cameras"][key], hero_rack_span(cfg), cfg["rack"]["width"] / 2
    qb, qt = (project(cc, pos, yaw, pitch, sx, sy, q) for q in (bot, top))
    zm = (bot[2] + top[2]) / 2
    ql, qr = (project(cc, pos, yaw, pitch, sx, sy, (s * W, cfg["rack"]["front_y"], zm)) for s in (-1, 1))
    return {"height": qb[1] - qt[1], "width": qr[0] - ql[0], "top_y": qt[1], "bottom_y": qb[1],
            "mid_y": (qb[1] + qt[1]) / 2}


def hold_pose(cfg, u):
    """Storyboard §3: straight down onto the subject plane, image up toward the rack, roll 0, never tilt;
    frame width W = inner width / (wall_x span), d = (W/2)/tan(hfov/2); C lands at hold.centre by lens shift."""
    hd, cams = cfg["hold"], cfg["cameras"]
    C = hold_centre(cfg, u)
    cx, cy = hd["centre"]
    iw = 2 * hold_walls(cfg, u)[0]               # per unit (hold.inner_width): the walls' real innermost width
    wz = u["hold"].get("wall_z")                 # a tall sled (the 2U server): its wall tops sit well above P and
    def fit(key):                                # nearer the lens, so they are fitted too (hold.wall_top_x); a low
        cc = cams[key]                           # tray (the UPS, the carrier) has its wall tops below P, farther from
        th, tv, tl = cam_tans(cc)                # the lens: they are fitted to the wall band at their own depth
        lo, hi = hd["wall_x"][key]
        d = (iw / (hi - lo) / 2) / th
        if wz is not None and wz > C[2] and hd.get("wall_top_x"):
            xt = hd["wall_top_x"][key]
            d = max(d, (iw / (1 - 2 * xt) / 2) / th + (wz - C[2]))
        elif wz is not None and wz < C[2]:
            d = min(d, (iw / (hi - lo) / 2) / th - (C[2] - wz))
        return d, th * (1 - 2 * cx) / (2 * tl), shift_y_for(cc, 0.0, cy)
    dl, sxl, syl = fit("landscape")
    dp, sxp, syp = fit("portrait")
    return {"x": C[0], "y": C[1], "z": C[2] + dl, "yaw": 0.0, "pitch": -PI / 2, "focus": dl,
            "sx": sxl, "sy": syl, "lrho": math.log(dp / dl), "psx": sxp, "psy": syp, "fstop": hd["fstop"],
            "stop": True, "C": C}


def rack_front_pose(cfg):
    pf, cams = cfg["poses"]["rack_front"], cfg["cameras"]
    D, zc, Dp = pf["distance"], pf["cam_z"], pf["portrait_distance"]
    C = (0.0, cfg["rack"]["front_y"], pf["centre_z"])
    return {"x": 0.0, "y": C[1] - D, "z": zc, "yaw": 0.0, "pitch": 0.0, "focus": D,
            "sx": 0.0, "sy": shift_y_for(cams["landscape"], (C[2] - zc) / D, pf["frame_y"]),
            "lrho": math.log(Dp / D), "psx": 0.0,
            "psy": shift_y_for(cams["portrait"], (C[2] - zc) / Dp, pf["frame_y"]),
            "fstop": cfg["look"]["dof"]["fstop_long"], "stop": True, "C": C}


def point_end_pose(cfg):
    """Epilogue rest: the reply point at poses.point_end.screen on both cameras; the portrait camera moves
    along the shared view ray so the point keeps the same share of frame height."""
    pe, cams = cfg["poses"]["point_end"], cfg["cameras"]
    C, P = tuple(pe["pos"]), tuple(cfg["request"]["path_out"][-1])
    d = v_sub(P, C)
    yaw, elev = math.atan2(-d[0], d[1]), math.atan2(d[2], math.hypot(d[0], d[1]))
    fy = pe["screen"][1]
    tv = cam_tans(cams["landscape"])[1]
    pitch = elev - math.atan(tv * (1 - 2 * fy))
    focus = v_len(d)
    rho = tv / cam_tans(cams["portrait"])[1]
    r, u, f = cam_axes(yaw, pitch)
    dp = v_sub(P, v_add(C, v_mul(f, focus * (1 - rho))))
    return {"x": C[0], "y": C[1], "z": C[2], "yaw": yaw, "pitch": pitch, "focus": focus, "sx": 0.0, "sy": 0.0,
            "lrho": math.log(rho), "psx": 0.0, "psy": shift_y_for(cams["portrait"], v_dot(dp, u) / v_dot(dp, f), fy),
            "fstop": cfg["look"]["dof"]["fstop_long"], "stop": True, "C": P}


def aim_point(cfg, C, P, fy, rho):
    """Camera at C aimed so world point P lands at frame (0.5, fy) on both cameras: yaw/pitch/focus as
    point_end_pose, the portrait camera on the same ray at rho with its lens shift psy re-centring P."""
    cams = cfg["cameras"]
    d = v_sub(P, C)
    yaw, elev = math.atan2(-d[0], d[1]), math.atan2(d[2], math.hypot(d[0], d[1]))
    pitch, focus = elev - math.atan(cam_tans(cams["landscape"])[1] * (1 - 2 * fy)), v_len(d)
    r, u, f = cam_axes(yaw, pitch)
    dp = v_sub(P, v_add(C, v_mul(f, focus * (1 - rho))))
    return {"yaw": yaw, "pitch": pitch, "focus": focus, "sx": 0.0, "sy": 0.0, "lrho": math.log(rho), "psx": 0.0,
            "psy": shift_y_for(cams["portrait"], v_dot(dp, u) / v_dot(dp, f), fy)}


def track_pose(cfg, w, g):
    """A `track` waypoint: the camera at w.pos aimed so the reply point (request_state at scene frame g) lands at
    frame (0.5, w.track_y) on both cameras (aim_point; w.rho is required, psy depends on it). Between the stops
    around a run of track waypoints pose_at keeps aiming at the point frame by frame (track_spec), so its screen
    track is the monotone curve through the stops' own y and the track_y values, never a spline's overshoot."""
    vis, P, _ = request_state(cfg, g)
    if not vis:
        raise ValueError(f"track waypoint at frame {g}: the point is not visible")
    C = tuple(w["pos"])
    wp = dict(aim_point(cfg, C, P, float(w["track_y"]), float(w["rho"])), x=C[0], y=C[1], z=C[2],
              stop=bool(w.get("stop")), track_y=float(w["track_y"]))
    if "fstop" in w:
        wp["fstop"] = float(w["fstop"])
    return wp


def track_spec(cfg, pts):
    """Screen-y keys of a tracked segment: the point's landscape y at both stops (from their own poses) and each
    inner track waypoint's track_y, by scene frame."""
    cc = cfg["cameras"]["landscape"]
    def y_at(p):
        vis, P, _ = request_state(cfg, p["g"])
        if not vis:
            raise ValueError(f"tracked segment: the point is not visible at its stop f{p['g']}")
        return project(cc, (p["x"], p["y"], p["z"]), p["yaw"], p["pitch"], p["sx"], p["sy"], P)[1]
    g0, g1 = pts[0]["g"], pts[-1]["g"]
    keys = [(pts[0]["g"], y_at(pts[0]))] + [(p["g"], p["track_y"]) for p in pts[1:-1] if "track_y" in p] \
        + [(pts[-1]["g"], y_at(pts[-1]))]
    return {"g": [k[0] for k in keys], "u": [smoother((k[0] - g0) / (g1 - g0)) for k in keys], "y": [k[1] for k in keys]}


def resolve_wp(cfg, w, ub, g=None):
    if "track_y" in w:
        return track_pose(cfg, w, g)
    if "pose" in w:
        kind, _, arg = w["pose"].partition(":")
        fn = {"hold": lambda: hold_pose(cfg, ub[arg]), "rack_front": lambda: rack_front_pose(cfg),
              "point_end": lambda: point_end_pose(cfg)}.get(kind)
        if fn is None:
            raise ValueError(f"unknown pose {w['pose']}")
        return fn()
    pos = tuple(w["pos"])
    if "aim" in w:
        d = v_sub(tuple(w["aim"]), pos)
        h = math.hypot(d[0], d[1])
        yaw = math.atan2(-d[0], d[1]) if h > 1e-9 else 0.0
        pitch, focus = math.atan2(d[2], h), v_len(d)
    else:
        yaw, pitch = math.radians(w.get("yaw", 0.0)), math.radians(w["pitch"])
        focus = w.get("focus", 3.0)
    wp = {"x": pos[0], "y": pos[1], "z": pos[2], "yaw": yaw, "pitch": pitch, "focus": focus, "stop": bool(w.get("stop"))}
    for c in ("sx", "sy", "psx", "psy", "fstop"):
        if c in w:
            wp[c] = float(w[c])
    if "rho" in w:
        wp["lrho"] = math.log(w["rho"])
    if "match_y" in w:                          # the portrait's lens shift puts this world point at the landscape's
        cams, Q = cfg["cameras"], tuple(w["match_y"])   # frame y (the exit's door view: the grommet the reply rises from)
        fy = project(cams["landscape"], pos, wp["yaw"], wp["pitch"], wp.get("sx", 0.0), wp.get("sy", 0.0), Q)[1]
        r, u, f = cam_axes(wp["yaw"], wp["pitch"])
        dp = v_sub(Q, v_add(pos, v_mul(f, wp["focus"] * (1 - math.exp(wp["lrho"])))))
        wp["psy"] = shift_y_for(cams["portrait"], v_dot(dp, u) / v_dot(dp, f), fy)
    return wp


def build_path(cfg):
    ub = {u["id"]: u for u in resolved_units(cfg)}
    W = []
    for fl in film_table(cfg):
        for w in fl["camera"]:
            wp = resolve_wp(cfg, w, ub, fl["a"] + w["f"])
            wp["g"] = fl["a"] + w["f"]
            W.append(wp)
        last = fl["camera"][-1]
        settle = last.get("settle", cfg["hold"]["settle_frames"])
        if "pose" in last and settle > 0:       # arrive early and rest: speed 0 over the last frames
            wp = resolve_wp(cfg, last, ub)
            wp["g"] = fl["a"] + last["f"] - settle
            W.append(wp)
    W.sort(key=lambda p: p["g"])
    for a, b in zip(W, W[1:]):
        if a["g"] == b["g"]:
            raise ValueError(f"two camera waypoints at frame {a['g']}")
    if not (W[0]["stop"] and W[-1]["stop"]) or any(c not in W[0] or c not in W[-1] for c in OPT):
        raise ValueError("first and last camera waypoints must be complete stops")
    for i, p in enumerate(W):                   # optional channels: smootherstep between waypoints that set them
        for c in OPT:
            if c not in p:
                j = max(k for k in range(i) if c in W[k])
                k = min(k for k in range(i + 1, len(W)) if c in W[k])
                p[c] = lerp(W[j][c], W[k][c], smoother((p["g"] - W[j]["g"]) / (W[k]["g"] - W[j]["g"])))
    stops = [i for i, p in enumerate(W) if p["stop"]]
    segs = []
    for s0, s1 in zip(stops, stops[1:]):
        pts = W[s0:s1 + 1]
        g0, g1 = pts[0]["g"], pts[-1]["g"]
        seg = (g0, g1, pts, [smoother((p["g"] - g0) / (g1 - g0)) for p in pts])
        if any("track_y" in p for p in pts[1:-1]):    # a tracked segment carries its screen-y keys (pose_at aims)
            seg += (track_spec(cfg, pts),)
        segs.append(seg)
    return segs


def _spline(pts, t):
    K = len(pts) - 1
    i = min(int(t), K - 1)
    s = t - i
    def P(j):
        if 0 <= j <= K:
            return pts[j]
        a, b = (pts[0], pts[1]) if j < 0 else (pts[K], pts[K - 1])
        return {k: 2 * a[k] - b[k] for k in CH}
    q = [P(i - 1), P(i), P(i + 1), P(i + 2)]
    out = dict(zip(("x", "y", "z"), cr_centripetal(*[(p["x"], p["y"], p["z"]) for p in q], s)))
    for c in CH[3:]:
        out[c] = cr_scalar(q[0][c], q[1][c], q[2][c], q[3][c], s)
    return out


def handheld_weight(cfg, f):
    hh = cfg["look"]["handheld"]
    for fl in film_table(cfg):
        if fl["a"] <= f <= fl["b"]:
            z = fl["b"] - hh["zero_last"]
            return ease(f, fl["a"], fl["a"] + hh["fade_in"]) * (1.0 - ease(f, z - 12, z))
    return 0.0


def pose_at(cfg, path, f):
    """Camera state at scene frame f: smootherstep progress between stops (zero velocity at every stop),
    PCHIP from progress to waypoint index, centripetal Catmull-Rom through the waypoints; handheld noise
    windowed to zero at each film's start and over its last 24 frames."""
    if f <= path[0][0]:
        return {c: path[0][2][0][c] for c in CH}
    if f >= path[-1][1]:
        return {c: path[-1][2][-1][c] for c in CH}
    for seg in path:
        g0, g1, pts, us = seg[:4]
        if f <= g1:
            u = smoother((f - g0) / (g1 - g0))
            if len(seg) > 4:                    # tracked: position, rho and f-stop by pchip in the same smootherstep
                p = {c: pchip(us, [q[c] for q in pts], u) for c in ("x", "y", "z", "lrho", "fstop")}   # progress
                p.update(aim_point(cfg, (p["x"], p["y"], p["z"]), request_state(cfg, f)[1],   # (exact on a line),
                                   pchip(seg[4]["u"], seg[4]["y"], u), math.exp(p["lrho"])))   # aimed every frame
            else:
                p = _spline(pts, pchip(us, list(range(len(us))), smoother((f - g0) / (g1 - g0))))
            hh = cfg["look"]["handheld"]
            if hh.get("enabled"):
                w, t = handheld_weight(cfg, f), f / hh["period"]
                for c in ("x", "y", "z"):
                    p[c] += w * hh["mm"] * 1e-3 * _vnoise(cfg["seed"], c, t)
                for c in ("yaw", "pitch"):
                    p[c] += w * math.radians(hh["deg"]) * _vnoise(cfg["seed"], c, t)
            return p
    return {c: path[-1][2][-1][c] for c in CH}


def portrait_of(p):
    """Portrait camera: same view ray, distance to the aim scaled by rho = exp(lrho)."""
    f = cam_axes(p["yaw"], p["pitch"])[2]
    return v_add((p["x"], p["y"], p["z"]), v_mul(f, p["focus"] * (1 - math.exp(p["lrho"]))))


def frame_state(cfg, path, f):
    p = pose_at(cfg, path, f)
    vis, rpos, rs = request_state(cfg, f)
    gn = request_gains(cfg, path, f, p)
    uk = film_keys(cfg, "uplight")
    return {"cam": [round(p[c], 6) for c in CH], "bay": round(bay_level(cfg, f), 6),
            "haze": round(haze_level(cfg, f), 6), "exp": round(exposure_at(cfg, f), 6),
            "req": [vis, [round(x, 6) for x in rpos], round(rs, 6), round(request_grow(cfg, f), 6),
                    round(request_glow_width(cfg, f), 6)],
            "open": {k: round(pw_linear(v, f), 6) for k, v in sorted(rig_keys(cfg).items())},
            "amber": sorted(k for k, g in amber_frames(cfg).items() if f >= g),
            "upper": round(upper_level(cfg, f), 6), "riser_fade": riser_fade_on(cfg, f),
            "gain": [round(gn["landscape"], 6), round(gn["portrait"], 6)], "req_volume": round(request_volume(cfg, f), 6),
            "uplight": round(pw_eased(uk, f), 6) if uk else 1.0, "grad": round(grad_level(cfg, f), 6)}


# ------------------------------------------------------------------ breathing holds and page anchors (part five §2e)
# A section film's hold breathes through T rendered tail frames: the camera orbits about the hold centre C (the aim
# stays on C, so C keeps its frame position), dollies along the view axis and opens f/8 -> 5.6 -> 8 with the focus
# pulled 8 mm deeper, all scaled by b(t) = sin^2(pi t), t = k/T. Everything else (lights, haze, exposure, rigs,
# LEDs, the handheld phase) stays at the hold frame. k = 0 and k = T are the hold pose itself; k = T is a hard link
# of the film's last master, so the tail ends byte-identical to the hold key and the next film's first frame.
BREATH_DEFAULTS = {"frames": 48, "films": ["rack-01", "rack-02", "rack-03", "rack-04"],
                   "orbit_deg": {"landscape": 0.2, "portrait": 0.15}, "orbit_axis_deg": 180.0,
                   "dolly_mm": {"landscape": 2.5, "portrait": 1.5}, "fstop_mid": 5.6, "focus_mm": 8.0,
                   "limits": {"width_px": 1600, "centre_px": 2.0, "edge_px": 6.0, "step_px": 0.4,
                              "orbit_deg": 0.2, "dolly_mm": 3.0, "focus_mm": 8.0}}
# The orbit axis is in the image plane, in degrees from image right (180: the camera swings toward the frame's bottom,
# the front, so the keystone and the dolly cancel at the far edge); amplitudes per camera keep the drift inside the
# limits with the frame scaled to width_px wide (the portrait frame is 3467 px tall there, hence its smaller breath).
# Storyboard section 2's calm boxes per hold, [x0, y0, x1, y1] from the top-left (desktop, phone).
CALM_BOX = {"u40": {"landscape": [0.12, 0.16, 0.88, 0.80], "portrait": [0.09, 0.36, 0.91, 0.54]},
            "u37": {"landscape": [0.12, 0.18, 0.88, 0.80], "portrait": [0.09, 0.37, 0.91, 0.57]},
            "u31": {"landscape": [0.12, 0.08, 0.88, 0.92], "portrait": [0.09, 0.10, 0.91, 0.80]},
            "u28": {"landscape": [0.12, 0.16, 0.88, 0.80], "portrait": [0.09, 0.28, 0.91, 0.62]},
            "u2": {"landscape": [0.12, 0.18, 0.88, 0.82], "portrait": [0.09, 0.26, 0.91, 0.64]},
            "u42": {"landscape": [0.12, 0.18, 0.88, 0.82], "portrait": [0.09, 0.30, 0.91, 0.54]}}
# Both live here, not in rack.config.json: EEVEE's normal frames are sensitive to the config file's size (an inert
# padding key of the same bytes flips one pixel by one level at f552; lookdev/tails/qa/gate-*), so the tail's settings
# stay out of the locked config. A `breath` or `calm_box` block in the config overrides them.


def breath_cfg(cfg):
    bc = dict(BREATH_DEFAULTS, **cfg.get("breath", {}))
    bc["limits"] = dict(BREATH_DEFAULTS["limits"], **cfg.get("breath", {}).get("limits", {}))
    return bc


def _per_cam(v, key):
    return v[key] if isinstance(v, dict) else v


def breath_b(t):
    """The breath envelope sin^2(pi t): 0 at both ends exactly, 1 at t = 0.5."""
    return 0.0 if t <= 0.0 or t >= 1.0 else math.sin(PI * t) ** 2


def breath_films(cfg):
    """The films whose hold breathes (breath.films): [(film row of film_table, T)]."""
    bc = breath_cfg(cfg)
    return [(fl, int(bc["frames"])) for fl in film_table(cfg) if fl["name"] in bc["films"]]


def v_cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def rot_axis(n, ang, v):
    """v rotated by ang about the unit axis n (Rodrigues)."""
    c, s = math.cos(ang), math.sin(ang)
    return v_add(v_add(v_mul(v, c), v_mul(v_cross(n, v), s)), v_mul(n, v_dot(n, v) * (1.0 - c)))


def euler_xyz(axes):
    """Blender XYZ euler of a camera whose right, up, forward are `axes` (columns right, up, -forward)."""
    r, u, f = axes
    return (math.atan2(u[2], -f[2]), math.asin(max(-1.0, min(1.0, -r[2]))), math.atan2(r[1], r[0]))


def project_ax(cc, pos, axes, sx, sy, p):
    """project() for a camera given by its axes (right, up, forward) instead of yaw and pitch."""
    th, tv, tl = cam_tans(cc)
    r, u, f = axes
    d = v_sub(p, pos)
    depth = v_dot(d, f)
    if depth <= 1e-9:
        return None
    ui, vi = v_dot(d, r) / depth, v_dot(d, u) / depth
    return ((ui - (2 * sx * tl - th)) / (2 * th), 1 - (vi - (2 * sy * tl - tv)) / (2 * tv))


def unproject_ax(cc, pos, axes, sx, sy, fx, fy, z):
    """The world point on the plane at height z seen at frame position (fx, fy), or None."""
    th, tv, tl = cam_tans(cc)
    r, u, f = axes
    ui, vi = 2 * th * fx + 2 * sx * tl - th, (1 - fy) * 2 * tv + 2 * sy * tl - tv
    d = v_add(f, v_add(v_mul(r, ui), v_mul(u, vi)))
    if abs(d[2]) < 1e-12 or (z - pos[2]) / d[2] <= 0:
        return None
    return v_add(pos, v_mul(d, (z - pos[2]) / d[2]))


def cam_view(p, key):
    """(position, axes, shift x, shift y) of camera `key` for path pose p, as baked."""
    axes = cam_axes(p["yaw"], p["pitch"])
    if key == "landscape":
        return (p["x"], p["y"], p["z"]), axes, p["sx"], p["sy"]
    return portrait_of(p), axes, p["psx"], p["psy"]


def breath_cam(cfg, p, key, t):
    """Camera `key` at tail time t (0..1) about hold pose p: position, axes, XYZ euler, shifts, f-stop and the aim
    (the AIM_main location; DOF focuses on it). At b(t) = 0 these are exactly the values the bake keys."""
    bc = breath_cfg(cfg)
    pos, axes, sx, sy = cam_view(p, key)
    aim = v_add((p["x"], p["y"], p["z"]), v_mul(axes[2], p["focus"]))   # the baked aim: C at the hold
    b = breath_b(t)
    if b == 0.0:
        return {"pos": pos, "axes": axes, "euler": cam_euler(p["yaw"], p["pitch"]), "sx": sx, "sy": sy,
                "fstop": p["fstop"], "aim": aim, "b": 0.0}
    phi = math.radians(bc["orbit_axis_deg"])
    n = v_add(v_mul(axes[0], math.cos(phi)), v_mul(axes[1], math.sin(phi)))   # in the image plane, through C
    n = v_mul(n, 1.0 / v_len(n))
    th = math.radians(_per_cam(bc["orbit_deg"], key)) * b
    ax2 = tuple(rot_axis(n, th, a) for a in axes)
    pos2 = v_add(v_add(aim, rot_axis(n, th, v_sub(pos, aim))), v_mul(ax2[2], _per_cam(bc["dolly_mm"], key) * 1e-3 * b))
    return {"pos": pos2, "axes": ax2, "euler": euler_xyz(ax2), "sx": sx, "sy": sy,
            "fstop": p["fstop"] + (bc["fstop_mid"] - p["fstop"]) * b,
            "aim": v_add(aim, v_mul(ax2[2], bc["focus_mm"] * 1e-3 * b)), "b": b}


def sled_depth(u):
    """The opened sled's depth (build_units' sled_D)."""
    return {"door_tray": u.get("tray_depth", u["depth"]), "door_carrier": 0.26}.get(u.get("mech"), u["depth"])


def part_world(cfg, u, part, o, q):
    """World position of point q given in rig part `part`'s local frame at open o (the rig chain of _part_matrix:
    RIG at (0, face_y, slot bottom), then the sled, then the part; parts rotate about local x only)."""
    for nm in reversed([part] if part_parent(u, part) == "rig" else ["sled", part]):
        loc, rot = part_local(cfg, u, nm, o)
        c, s = math.cos(rot[0]), math.sin(rot[0])
        q = v_add(loc, (q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c))
    return v_add((0.0, cfg["rack"]["face_y"], slot_bot(cfg, u["u"])), q)


STORAGE_ROW = (0.04, 0.165, 0.15)     # _int_storage: first row's front edge, row pitch, carrier length (sled y)


def anchor_parts(cfg, u):
    """{anchor: (rig part, point in that part's frame)} the page reads per unit (the numbers mirror the interior
    builders): the switch board's centre; each cartridge's seal-ring centre on its face; each drive row's front-edge
    centre on the carrier tops; each heat sink's centre at fin mid-height."""
    pz = u["hold"]["plane_z"] - slot_bot(cfg, u["u"])
    kind = u["kind"]
    if kind == "switch":
        return {"board": ("sled", (0.0, (0.012 + 0.2525) / 2, pz))}
    if kind == "security":
        return {f"cartridge_{k}": (f"cart{k + 1}", (0.0, -0.0163, 0.0215)) for k in range(u.get("cartridges", 4))}
    if kind == "storage":
        y0, dy, _ = STORAGE_ROW
        return {f"row_{k}": ("sled", (0.0, y0 + k * dy, pz)) for k in range(u.get("rows", 5))}
    if kind == "server":
        return {f"heatsink_{k}": ("sled", (sx, 0.365, pz + (0.0085 + 0.048) / 2)) for k, sx in enumerate((-0.0875, 0.0875))}
    return {}


def unit_rect_corners(cfg, u):
    """The opened sled's inner walls (hold.inner_width at hold.wall_z) from its front edge to its rear, sled-local."""
    xw, wz = hold_walls(cfg, u)
    z = wz - slot_bot(cfg, u["u"])
    return [(s * xw, y, z) for y in (0.0, sled_depth(u)) for s in (-1, 1)]


def anchor_beats(cfg, fl, u):
    """Mechanism beats (local film frames): cartridge_k_tip, the first frame cartridge k lies face-up; row_k, the
    first frame drive row k is fully out of the slot (its rear edge past the rack face)."""
    ks = rig_keys(cfg).get(u["id"])
    if not ks:
        return {}
    out, w = {}, u.get("windows", {})
    for f in range(fl["a"], fl["b"] + 1):
        o = pw_linear(ks, f)
        if u["kind"] == "security":
            for k in range(u.get("cartridges", 4)):
                t0 = w["tip0"] + k * w["tip_step"]
                if ease(o, t0, t0 + w["tip_len"]) >= 1.0 - 1e-9:
                    out.setdefault(f"cartridge_{k}_tip", f - fl["a"])
        if u["kind"] == "storage":
            y0, dy, ln = STORAGE_ROW
            for k in range(u.get("rows", 5)):
                if part_world(cfg, u, "sled", o, (0.0, y0 + k * dy + ln, 0.0))[1] <= cfg["rack"]["face_y"] + 1e-6:
                    out.setdefault(f"row_{k}", f - fl["a"])
    return dict(sorted(out.items()))


class PureView:
    """Projection for the page's anchors in pure maths (project() of the baked camera path)."""
    def __init__(self, cfg, path):
        self.cfg, self.path = cfg, path

    def frame(self, f):
        self.p = pose_at(self.cfg, self.path, f)

    def world(self, u, part, o, q):
        return part_world(self.cfg, u, part, o, q)

    def proj(self, key, X):
        pos, axes, sx, sy = cam_view(self.p, key)
        return project_ax(self.cfg["cameras"][key], pos, axes, sx, sy, X)


def _r4(q):
    return None if q is None else [round(q[0], 4), round(q[1], 4)]


def film_anchors(cfg, fl, u, view):
    """One film's anchors on both cameras (frame fractions, top-left origin, 1e-4): per film frame and at rest for
    each anchor_parts point; at the hold the projected centre C, the unit's inner-wall rectangle and the
    storyboard's calm box; and the mechanism beats."""
    parts, ks = anchor_parts(cfg, u), rig_keys(cfg).get(u["id"])
    keys = list(cfg["cameras"])
    tracks, heads = {k: {n: [] for n in parts} for k in keys}, {}
    for f in (range(fl["a"], fl["b"] + 1) if parts else [fl["b"]]):
        o = pw_linear(ks, f) if ks else 0.0
        view.frame(f)
        W = {n: view.world(u, part, o, q) for n, (part, q) in parts.items()}
        for key in keys:
            for n in parts:
                tracks[key][n].append(_r4(view.proj(key, W[n])))
            if f == fl["b"]:
                R = [view.proj(key, view.world(u, "sled", o, q)) for q in unit_rect_corners(cfg, u)]
                heads[key] = {"centre": _r4(view.proj(key, hold_centre(cfg, u))),
                              "unit_rect": None if None in R else [round(min(r[0] for r in R), 4), round(min(r[1] for r in R), 4),
                                                                   round(max(r[0] for r in R), 4), round(max(r[1] for r in R), 4)],
                              "calm_box": ((cfg.get("calm_box") or CALM_BOX).get(u["id"]) or {}).get(key)}
    out = {key: dict(heads[key], **{n: {"rest": tracks[key][n][-1], "track": tracks[key][n]} for n in parts}) for key in keys}
    out["beats"] = anchor_beats(cfg, fl, u)
    return out


def page_anchors(cfg, films):
    """Adds `tail` (breath films) and `anchors` (films that end on an opened unit's hold) to timeline() rows."""
    path, ub = build_path(cfg), {u["id"]: u for u in resolved_units(cfg)}
    tails = {fl["name"]: T for fl, T in breath_films(cfg)}
    rows = {fl["name"]: fl for fl in film_table(cfg)}
    view = PureView(cfg, path)
    for row in films:
        if row["name"] in tails:
            row["tail"] = {"frames": tails[row["name"]]}
        u = ub.get(row.get("unit") or "")
        if u is not None and u.get("mech", "none") != "none":
            row["anchors"] = film_anchors(cfg, rows[row["name"]], u, view)
    return films


def breath_drift(cfg, path, fl, key, T=None):
    """Image-space drift of the breath on camera `key` (px with the frame scaled to limits.width_px wide): at C, at
    the frame's edges and corners on the subject plane, at the unit's wall rectangle and the anchors at rest
    (subject), and on the floor (parallax, reported only); the largest step between tail frames; the camera's
    largest displacement (both cameras' positions are checked for clearance separately)."""
    bc = breath_cfg(cfg)
    T = int(T or bc["frames"])
    ub = {u["id"]: u for u in resolved_units(cfg)}
    u, cc = ub[fl["unit"]], cfg["cameras"][key]
    p = pose_at(cfg, path, fl["b"])
    W, H = cc["res"]
    sw = float(bc["limits"]["width_px"])
    sh = sw * H / W
    C = hold_centre(cfg, u)
    c0 = breath_cam(cfg, p, key, 0.0)
    ks = rig_keys(cfg).get(u["id"])
    o = pw_linear(ks, fl["b"]) if ks else 0.0
    pts = {"C": ("centre", C)}
    for fx in (0.0, 0.5, 1.0):
        for fy in (0.0, cfg["hold"]["centre"][1], 1.0):
            q = unproject_ax(cc, c0["pos"], c0["axes"], c0["sx"], c0["sy"], fx, fy, C[2])
            if q is not None and (fx, fy) != (0.5, cfg["hold"]["centre"][1]):
                pts[f"edge {fx:g},{fy:g}"] = ("edge", q)
    for i, q in enumerate(unit_rect_corners(cfg, u)):
        pts[f"wall {i}"] = ("subject", part_world(cfg, u, "sled", o, q))
    for n, (part, q) in anchor_parts(cfg, u).items():
        pts[n] = ("subject", part_world(cfg, u, part, o, q))
    for fy in (0.0, 1.0):
        q = unproject_ax(cc, c0["pos"], c0["axes"], c0["sx"], c0["sy"], 0.5, fy, 0.0)
        if q is not None:
            pts[f"floor {fy:g}"] = ("floor", q)
    def pr(c, X):
        return project_ax(cc, c["pos"], c["axes"], c["sx"], c["sy"], X)
    base = {n: pr(c0, X) for n, (_, X) in pts.items()}
    for n in [n for n, (g, _) in pts.items() if g == "subject" and not (base[n] and 0 <= base[n][0] <= 1 and 0 <= base[n][1] <= 1)]:
        del pts[n], base[n]                       # subject points outside the frame at the hold do not count
    mx, step, prev, shift, ang = {}, 0.0, None, 0.0, 0.0
    cams = [breath_cam(cfg, p, key, k / T) for k in range(T + 1)]
    for c in cams:
        cur = {n: pr(c, X) for n, (_, X) in pts.items()}
        for n, (g, _) in pts.items():
            d = math.hypot((cur[n][0] - base[n][0]) * sw, (cur[n][1] - base[n][1]) * sh)
            mx[g] = max(mx.get(g, 0.0), d)
            if prev is not None and g != "floor":
                step = max(step, math.hypot((cur[n][0] - prev[n][0]) * sw, (cur[n][1] - prev[n][1]) * sh))
        prev = cur
        shift = max(shift, v_len(v_sub(c["pos"], c0["pos"])))
        ang = max(ang, math.degrees(math.acos(max(-1.0, min(1.0, v_dot(c["axes"][2], c0["axes"][2]))))))
    end = cams[-1]
    same_end = end["pos"] == c0["pos"] and end["euler"] == c0["euler"] and end["fstop"] == c0["fstop"]
    return {"frames": T, "centre_px": round(mx["centre"], 3), "edge_px": round(mx["edge"], 3),
            "subject_px": round(mx.get("subject", 0.0), 3), "floor_px": round(mx.get("floor", 0.0), 3),
            "step_px": round(step, 3), "cam_shift_mm": round(shift * 1000, 3), "orbit_deg": round(ang, 4),
            "focus_mm": round(max(v_len(v_sub(c["aim"], c0["aim"])) for c in cams) * 1000, 3),
            "fstop": [round(min(c["fstop"] for c in cams), 3), round(max(c["fstop"] for c in cams), 3)],
            "centre_k0": [round(v, 5) for v in base["C"]], "end_is_hold": same_end,
            "width_px": [int(sw), int(round(sh))]}


def timeline_same(a, b, tol=2e-4, _in=False):
    """Exported timeline a equals timeline b; numbers under `anchors` may differ by tol (a Blender export projects
    with world_to_camera_view, the pure one with project(): they agree to ~1e-6 before rounding to 1e-4)."""
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(timeline_same(a[k], b[k], tol, _in or k == "anchors") for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(timeline_same(x, y, tol, _in) for x, y in zip(a, b))
    if _in and isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return abs(a - b) <= tol
    return a == b


def _aabb_dist(p, lo, hi):
    d = [max(lo[i] - p[i], 0.0, p[i] - hi[i]) for i in range(3)]
    return math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])


def breath_positions(cfg, path):
    """{scene frame b: [(camera key + '_breath', position)]} for every breathing hold's tail (k = 1..T-1)."""
    out = {}
    for fl, T in breath_films(cfg):
        p = pose_at(cfg, path, fl["b"])
        for key in cfg["cameras"]:
            out.setdefault(fl["b"], []).extend((key + "_breath", breath_cam(cfg, p, key, k / T)["pos"]) for k in range(1, T))
    return out


# ================================================================== Blender side
def O(name):
    return bpy.data.objects[name]


def setattr_safe(obj, name, val):
    if obj is not None and hasattr(obj, name):
        try:
            setattr(obj, name, val)
            return True
        except Exception:
            return False
    return False


def wipe():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
                 bpy.data.actions, bpy.data.worlds, bpy.data.collections):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    if sc.animation_data:
        sc.animation_data_clear()


def new_coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def empty(name, coll, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.05
    coll.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


class MB:
    """bmesh accumulator: boxes, cylinders, quads; material index per face."""
    def __init__(self):
        self.bm = bmesh.new()

    def box(self, x0, x1, y0, y1, z0, z1, mi=0):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        v = [self.bm.verts.new(c) for c in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.bm.faces.new([v[i] for i in idx]).material_index = mi
        return v

    def cbox(self, x0, x1, y0, y1, z0, z1, mi=0, c=0.0008, top_only=True):
        """Box with chamfered edges (the top and vertical edges, or all): pressed and moulded parts catch a thin
        highlight on every edge instead of meeting at a perfect 90 degrees."""
        v = self.box(x0, x1, y0, y1, z0, z1, mi)
        c = min(c, abs(x1 - x0) / 3, abs(y1 - y0) / 3, abs(z1 - z0) / 3)
        if c < 2e-5:
            return
        zt = max(z0, z1)
        es = list({e for vv in v for e in vv.link_edges})
        if top_only:
            es = [e for e in es if any(abs(q.co.z - zt) < 1e-7 for q in e.verts)]
        bmesh.ops.bevel(self.bm, geom=es, offset=c, offset_type="OFFSET", segments=1, profile=0.5,
                        affect="EDGES", clamp_overlap=True)

    def tube_ax(self, axis, a0, a1, u, v, r0, r1, n=24, mi=0, ang0=0.0, ang1=2 * PI):
        """Annulus (r0 = 0: a solid cylinder) along axis x, y or z from a0 to a1, centred at (u, v) on the other two
        axes (x: (y, z), y: (x, z), z: (x, y)); ang0..ang1 < 2 pi gives an annular sector (fan blades, tabs)."""
        full = ang1 - ang0 >= 2 * PI - 1e-9
        m = n if full else n + 1
        def P(t, r, k):
            a = ang0 + (ang1 - ang0) * k / n
            p, q = u + r * math.cos(a), v + r * math.sin(a)
            return {"x": (t, p, q), "y": (p, t, q), "z": (p, q, t)}[axis]
        rings = [[self.bm.verts.new(P(t, r, k)) for k in range(m)] for t, r in ((a0, r1), (a1, r1), (a0, r0), (a1, r0))]
        fs = []
        segs = range(n) if full else range(n)
        nxt = (lambda k: (k + 1) % m) if full else (lambda k: k + 1)
        for k in segs:
            j = nxt(k)
            fs.append(self.bm.faces.new((rings[0][k], rings[0][j], rings[1][j], rings[1][k])))
            if r0 > 1e-6:
                fs.append(self.bm.faces.new((rings[2][j], rings[2][k], rings[3][k], rings[3][j])))
                fs.append(self.bm.faces.new((rings[0][j], rings[0][k], rings[2][k], rings[2][j])))
                fs.append(self.bm.faces.new((rings[1][k], rings[1][j], rings[3][j], rings[3][k])))
        if r0 <= 1e-6:
            for t in (0, 1):
                fs.append(self.bm.faces.new(rings[t]))
            for q in rings[2] + rings[3]:
                self.bm.verts.remove(q)
        if not full:
            for k in (0, n):
                if r0 > 1e-6:
                    fs.append(self.bm.faces.new((rings[0][k], rings[2][k], rings[3][k], rings[1][k])))
        for f in fs:
            f.material_index = mi
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)

    def cyl(self, cx, cy, z0, z1, r, n=24, mi=0):
        lo = [self.bm.verts.new((cx + r * math.cos(2 * PI * i / n), cy + r * math.sin(2 * PI * i / n), z0))
              for i in range(n)]
        hi = [self.bm.verts.new((v.co.x, v.co.y, z1)) for v in lo]
        self.bm.faces.new(list(reversed(lo))).material_index = mi
        self.bm.faces.new(hi).material_index = mi
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((lo[i], lo[j], hi[j], hi[i])).material_index = mi

    def quad(self, pts, mi=0):
        self.bm.faces.new([self.bm.verts.new(p) for p in pts]).material_index = mi

    def mark(self):
        return len(self.bm.verts)

    def since(self, k):
        self.bm.verts.ensure_lookup_table()
        return [self.bm.verts[i] for i in range(k, len(self.bm.verts))]

    def bevel(self, k=0, w=0.0018, segs=2):
        """Chamfer every edge built since mark k (the hero rack only, 1.5-2 mm), keeping each face's material."""
        vs = self.since(k)
        es = list({e: None for v in vs for e in v.link_edges})       # insertion-ordered: deterministic
        bmesh.ops.bevel(self.bm, geom=vs + es, offset=w, offset_type="OFFSET", segments=segs, profile=0.5,
                        affect="EDGES", clamp_overlap=True, material=-1)

    def rotate_z(self, k, ang, pivot):
        bmesh.ops.rotate(self.bm, verts=self.since(k), cent=pivot, matrix=Matrix.Rotation(ang, 3, "Z"))

    def cyl_y(self, cx, cz, y0, y1, r, n=12, mi=0):
        """Cylinder along y: screw heads, buttons, lock barrels, feet seen from the front."""
        a = [self.bm.verts.new((cx + r * math.cos(2 * PI * i / n), y0, cz + r * math.sin(2 * PI * i / n))) for i in range(n)]
        b = [self.bm.verts.new((v.co.x, y1, v.co.z)) for v in a]
        self.bm.faces.new(a).material_index = mi
        self.bm.faces.new(list(reversed(b))).material_index = mi
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((a[i], b[i], b[j], a[j])).material_index = mi

    def tube(self, pts, r, n=6, mi=0, caps=True, smooth=True, head=None):
        """Sweep an n-gon of radius r (or one radius per point) along a polyline (parallel-transport frames).
        head = (k, mi): the first k rings (a plug's boot) take material mi."""
        rings = [[self.bm.verts.new(v) for v in ring] for ring in tube_verts(pts, r, n)]
        hk, hm = head if head else (0, mi)
        for i, (ra, rb) in enumerate(zip(rings, rings[1:])):
            for k in range(n):
                j = (k + 1) % n
                f = self.bm.faces.new((ra[k], ra[j], rb[j], rb[k]))
                f.material_index, f.smooth = (hm if i < hk - 1 else mi), smooth
        if caps:
            self.bm.faces.new(list(reversed(rings[0]))).material_index = hm if hk else mi
            self.bm.faces.new(rings[-1]).material_index = mi
        return rings

    def obj(self, name, mats, coll, parent=None, loc=(0, 0, 0)):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in mats:
            me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        coll.objects.link(o)
        o.parent = parent
        o.location = loc
        return o


def catenary(a, b, sag, n=7, bulge=(0.0, 0.0, -1.0)):
    return [v_add(v_add(a, v_mul(v_sub(b, a), i / (n - 1))), v_mul(bulge, sag * 4 * (i / (n - 1)) * (1 - i / (n - 1))))
            for i in range(n)]


def cable(name, pts, radius, mat, coll, parent=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    cu.resolution_u = 8
    setattr_safe(cu, "use_fill_caps", True)
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(mat)
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.parent = parent
    return o


# ------------------------------------------------------------------ materials (procedural only)
def _tree(idb):
    if tuple(bpy.app.version[:2]) < (5, 0):         # 5.x: every material and world has its node tree (use_nodes is
        setattr_safe(idb, "use_nodes", True)       # deprecated, removed in 6.0)
    return idb.node_tree


def mat_p(name, base, rough=0.5, metal=0.0, alpha=1.0, spec=0.5):
    m = bpy.data.materials.new(name)
    nt = _tree(m)
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*base, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec      # < 0.5: a matte black that stays black under a lamp
    m.diffuse_color = (*base, 1.0)
    if alpha < 1.0:
        p.inputs["Alpha"].default_value = alpha
        setattr_safe(m, "surface_render_method", "DITHERED")
    return m, p, nt


def mat_emit_objcolor(name, strength):
    m, p, nt = mat_p(name, (0.01, 0.01, 0.01), 0.35)
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    nt.links.new(oi.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = strength
    return m


def mat_emit(name, color, strength):
    m, p, nt = mat_p(name, (0.01, 0.01, 0.01), 0.35)
    p.inputs["Emission Color"].default_value = (*color, 1.0)
    p.inputs["Emission Strength"].default_value = strength
    return m


class SN:
    """Shader-node builder for one node tree: inputs are numbers, tuples or sockets; methods return output sockets.
    Every pattern below is band-limited by the pixel footprint (view distance / focal px / |N.I|), so detail that a
    1920 master cannot resolve fades to its mean instead of aliasing when the film is scrubbed."""
    SRC = {"tc": "ShaderNodeTexCoord", "geo": "ShaderNodeNewGeometry", "obj": "ShaderNodeObjectInfo",
           "cam": "ShaderNodeCameraData"}

    def __init__(self, nt):
        self.nt, self._src = nt, {}

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def put(self, sock, v):
        if v is None:
            return
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, sock)
            return
        if sock.type in ("VECTOR", "RGBA") and isinstance(v, (int, float)):
            v = (float(v),) * len(sock.default_value)
        elif sock.type == "RGBA" and len(v) == 3:
            v = (*v, 1.0)
        sock.default_value = v

    def io(self, n, ins):
        by_id = {s.identifier: s for s in n.inputs}
        for k, v in ins.items():
            self.put(by_id[k] if k in by_id else n.inputs[k], v)
        return n

    def src(self, kind):
        if kind not in self._src:
            self._src[kind] = self.node(self.SRC[kind])
        return self._src[kind]

    def out(self, kind, name):
        return self.src(kind).outputs[name]

    def math(self, op, a, b=0.0, c=0.0, clamp=False):
        n = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b, c)):
            self.put(n.inputs[i], v)
        return n.outputs[0]

    def mad(self, a, b, c):                      # a * b + c
        return self.math("MULTIPLY_ADD", a, b, c)

    def vec(self, op, a, b=None, s=None):
        n = self.node("ShaderNodeVectorMath", operation=op)
        self.put(n.inputs[0], a)
        if b is not None:
            self.put(n.inputs[1], b)
        if s is not None:
            self.put(n.inputs["Scale"], s)
        return n.outputs["Value" if op in ("LENGTH", "DOT_PRODUCT", "DISTANCE") else "Vector"]

    def mix(self, fac, a, b, kind="Float"):
        n = self.node("ShaderNodeMix", data_type={"Float": "FLOAT", "Vector": "VECTOR", "Color": "RGBA"}[kind],
                      clamp_factor=True)
        self.io(n, {"Factor_Float": fac, "A_" + kind: a, "B_" + kind: b})
        return {s.identifier: s for s in n.outputs}["Result_" + kind]

    def smooth(self, x, lo, hi):                 # smoothstep from lo to hi (lo > hi inverts), clamped to 0..1
        n = self.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
        return self.io(n, {"Value": x, "From Min": lo, "From Max": hi, "To Min": 0.0, "To Max": 1.0}).outputs["Result"]

    def sep(self, v):
        n = self.node("ShaderNodeSeparateXYZ")
        self.put(n.inputs[0], v)
        return n.outputs[0], n.outputs[1], n.outputs[2]

    def comb(self, x, y, z=0.0):
        n = self.node("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.put(n.inputs[i], v)
        return n.outputs[0]

    def noise(self, v, scale=1.0, detail=1.0, rough=0.5, distort=0.0):
        n = self.node("ShaderNodeTexNoise", noise_dimensions="3D")
        return self.io(n, {"Vector": v, "Scale": scale, "Detail": detail, "Roughness": rough,
                           "Distortion": distort}).outputs["Fac"]

    def white(self, v):
        n = self.node("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
        return self.io(n, {"Vector": v}).outputs["Value"]

    def bump(self, height, strength, dist, normal=None):
        n = self.node("ShaderNodeBump")
        return self.io(n, {"Height": height, "Strength": strength, "Distance": dist, "Normal": normal}).outputs["Normal"]

    def hsv(self, color, h=0.5, s=1.0, v=1.0):
        n = self.node("ShaderNodeHueSaturation")
        return self.io(n, {"Hue": h, "Saturation": s, "Value": v, "Fac": 1.0, "Color": color}).outputs["Color"]

    # ---- shared fields
    def seeded(self, coord, off, per_object=True):
        """coord + a fixed offset (from rng) + a per-object offset (Object Info Random: instances differ too)."""
        q = self.vec("ADD", coord, off)
        if per_object:
            q = self.vec("ADD", q, self.vec("SCALE", (97.0, 53.0, 71.0), s=self.out("obj", "Random")))
        return q

    def footprint(self, fpx):
        """Metres covered by one pixel of the 1920 master here (stretched by grazing incidence)."""
        cos = self.math("MAXIMUM", self.math("ABSOLUTE", self.vec("DOT_PRODUCT", self.out("geo", "True Normal"),
                                                                   self.out("geo", "Incoming"))), 0.2)
        return self.math("DIVIDE", self.out("cam", "View Distance"), self.math("MULTIPLY", cos, fpx))

    def resolved(self, fp, feature, px_lo=3.0, px_hi=6.0):
        """1 where a feature of this size (m) spans >= px_hi pixels, 0 where <= px_lo."""
        return self.smooth(self.math("DIVIDE", feature, self.math("MAXIMUM", fp, 1e-6)), px_lo, px_hi)

    def jitter(self, color, amt):
        """Per-object tonal jitter: value +-amt, saturation +-1.5 amt, hue +-0.08 amt (Object Info Random)."""
        r = self.math("SUBTRACT", self.out("obj", "Random"), 0.5)
        return self.hsv(color, self.mad(r, amt * 0.15, 0.5), self.mad(r, amt * 3.0, 1.0), self.mad(r, amt * 2.0, 1.0))

    def brushed(self, q, axis, across, along, detail=1.0):
        """Stretched noise: long streaks along `axis` (EEVEE 5.2 ignores Principled Anisotropic); 0..1 around 0.5."""
        if axis == "xy":                              # members both ways: streak along whichever axis the face runs
            ny = self.math("ABSOLUTE", self.sep(self.out("geo", "True Normal"))[1])
            return self.mix(self.smooth(ny, 0.3, 0.7), self.brushed(q, "y", across, along, detail),
                            self.brushed(q, "x", across, along, detail))
        sc = tuple(along if a == axis else across for a in "xyz")
        return self.noise(self.vec("MULTIPLY", q, sc), 1.0, detail, 0.45)

    def dust(self, q, scale, up_lo=0.55, up_hi=0.95):
        """Dust on up-facing surfaces: normal-driven, patchy (low-frequency noise)."""
        up = self.smooth(self.sep(self.out("geo", "True Normal"))[2], up_lo, up_hi)
        patch = self.smooth(self.noise(q, scale, 2.0, 0.5), 0.3, 0.75)
        return self.math("MULTIPLY", up, patch)          # the patch's full range: clean and dusty areas, not a tint

    def holes_hex(self, x, y, pitch, radius, fp):
        """Hex-staggered round holes (nearest-neighbour spacing `pitch`); 1 inside a hole, anti-aliased by `fp`."""
        sp = (pitch, pitch * SQ3, 1.0)
        p = self.comb(x, y, 0.0)
        ds = []
        for off in ((0.0, 0.0, 0.0), (pitch / 2, pitch * SQ3 / 2, 0.0)):
            f = self.vec("SUBTRACT", self.vec("FRACTION", self.vec("DIVIDE", self.vec("SUBTRACT", p, off), sp)),
                         (0.5, 0.5, 0.0))
            ds.append(self.vec("LENGTH", self.vec("MULTIPLY", f, sp)))
        return self._edge(self.math("MINIMUM", *ds), radius, fp)

    def holes_square(self, x, y, pitch, radius, fp):
        p = self.comb(x, y, 0.0)
        f = self.vec("SUBTRACT", self.vec("FRACTION", self.vec("ADD", self.vec("DIVIDE", p, (pitch, pitch, 1.0)),
                                                                   (0.5, 0.5, 0.0))), (0.5, 0.5, 0.0))
        return self._edge(self.vec("LENGTH", self.vec("SCALE", f, s=pitch)), radius, fp)

    def _edge(self, d, radius, fp):
        w = self.math("MAXIMUM", self.math("MULTIPLY", fp, 0.8), 0.00015)
        return self.smooth(d, self.math("ADD", radius, w), self.math("SUBTRACT", radius, w))

    def perf(self, hole, pitch, open_frac, fp):
        """Fade a hole field to its open fraction once the pitch falls below ~6 px (no moire at any distance)."""
        return self.mix(self.resolved(fp, pitch, 3.0, 6.0), open_frac, hole)

def mat_request(cfg):
    """The request / reply point: an amber bead whose emission falls with its screen-radius fraction rho
    (rho^2 = 1 - (N.V)^2 on the smooth sphere): a small hot core that clips, an amber body and a dim rim
    that the compositor's bloom carries outward, so it reads as a lamp, never a flat white disc."""
    rl = cfg["request"]["look"]
    m, p, nt = mat_p("MAT_request", (0.0, 0.0, 0.0), 0.35, 0.0, 1.0, 0.0)
    p.inputs["Emission Color"].default_value = (*rl["color"], 1.0)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5                  # Facing = 1 - |N.V| exactly
    def op(kind, a, b=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = kind
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = float(v)
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]
    t = op("SUBTRACT", 1.0, lw.outputs["Facing"])
    r2 = op("SUBTRACT", 1.0, op("MULTIPLY", t, t))
    def lobe(k):
        w = op("MULTIPLY", r2, -1.0 / rl[k][1])
        w.node.name = f"REQ_{k}_w"                          # the glow lobe's width is keyed in the exit (bake)
        return op("MULTIPLY", rl[k][0], op("EXPONENT", w))
    gain = nt.nodes.new("ShaderNodeMath")              # keyed by bake_look: the same display brightness in every film
    gain.name, gain.operation = "REQ_gain", "MULTIPLY"
    gain.inputs[1].default_value = 1.0
    nt.links.new(op("ADD", op("ADD", rl["floor"], lobe("glow")), lobe("core")), gain.inputs[0])
    nt.links.new(gain.outputs[0], p.inputs["Emission Strength"])
    return m


MAT_NAMES = {"rack": "MAT_rack_powder", "post": "MAT_rack_post", "bezel": "MAT_unit_bezel", "metal": "MAT_nickel",
             "board": "MAT_board_black", "rail": "MAT_rail_steel", "dark": "MAT_dark_plastic", "plate": "MAT_label_well",
             "tray": "MAT_tray_galv", "cable": "MAT_cable_rubber", "vent": "MAT_vent_tile", "bg_door": "MAT_bg_door",
             "roof": "MAT_cabinet_roof", "wall": "MAT_hall_wall"}
SQ3 = math.sqrt(3.0)


def _seed_vec(cfg, name):
    r = rng(cfg, f"mat:{name}")
    return tuple(r.uniform(-500.0, 500.0) for _ in range(3))


def _spec(cfg, key):
    r, g, b, rough, metal, *spec = cfg["look"]["materials"][key]
    return (r, g, b), rough, metal, (spec[0] if spec else 0.5)


def shade_powder(cfg, key, name=None, perf=None, alpha_perf=None, per_object=True, extra=None):
    """Powder-coated steel: per-object jitter, fine orange-peel bump (fades out when unresolved), low-frequency
    roughness smudges, dust on up-facing faces. `perf` shades holes dark (background doors); `alpha_perf` cuts
    them as dithered alpha on the front face only (the hero door)."""
    fx = cfg["look"]["materials"]["fx"]
    pw = {**fx["powder"], **fx.get(f"powder_{key}", {}), **(extra or {})}
    base, rough, metal, spec = _spec(cfg, key)
    m, p, nt = mat_p(name or MAT_NAMES[key], base, rough, metal, 1.0, spec)
    S = SN(nt)
    q = S.seeded(S.out("tc", "Object"), _seed_vec(cfg, key), per_object)
    fp = S.footprint(fx["fpx"])
    col = S.jitter(base, fx["jitter"]) if per_object else base     # twins (the hero door's two sheets) match
    sm = S.noise(q, pw["smudge_scale"], 2.0, 0.5)
    rgh = S.mad(S.math("SUBTRACT", sm, 0.5), 2.0 * pw["smudge_amp"], rough)
    if pw.get("kick", 0) > 0:                     # shoe scuffs on the lowest ~30 cm: rubbed smoother, a shade lighter
        kz = S.smooth(S.sep(S.out("tc", "Object"))[2], 0.36, 0.12)
        kn = S.noise(S.vec("MULTIPLY", q, (14.0, 14.0, 30.0)), 1.0, 2.0, 0.5)
        kick = S.math("MULTIPLY", kz, S.smooth(kn, 0.5, 0.75))
        kick = S.math("MULTIPLY", kick, pw["kick"])
        rgh = S.mad(kick, -0.25, rgh)
        col = S.hsv(col, 0.5, 1.0, S.mad(kick, 0.35, 1.0))
    peel = S.noise(q, pw["peel_scale"], 0.0, 0.5)
    nrm = S.bump(peel, S.math("MULTIPLY", S.resolved(fp, 4.0 / pw["peel_scale"], 3.0, 8.0), pw["peel_strength"]),
                 0.0004)
    if pw.get("dust", 0) > 0:
        d = S.math("MULTIPLY", S.dust(q, pw.get("dust_scale", fx["dust"]["scale"])), pw["dust"])
        if pw.get("dust_grad"):                    # heavier toward the rear, where nobody reaches (object y: front 0)
            ya, yb = pw["dust_grad"]
            d = S.math("MULTIPLY", d, S.mad(S.smooth(S.sep(S.out("tc", "Object"))[1], ya, yb), 0.7, 0.3))
        col = S.mix(d, col, tuple(pw.get("dust_color", fx["dust"]["color"])), "Color")
        rgh = S.mix(d, rgh, 0.9)
    if pw.get("polish"):                           # G2' R3: hand-polished round a handle (object x, z centre, radii):
        px_, pz_, rx_, rz_ = pw["polish"]           # smoother and a shade lighter, its edge broken by noise
        ox_, _, oz_ = S.sep(S.out("tc", "Object"))
        dx_ = S.math("DIVIDE", S.math("SUBTRACT", ox_, px_), rx_)
        dz_ = S.math("DIVIDE", S.math("SUBTRACT", oz_, pz_), rz_)
        e_ = S.math("ADD", S.math("MULTIPLY", dx_, dx_), S.math("MULTIPLY", dz_, dz_))
        pn_ = S.smooth(S.noise(S.vec("MULTIPLY", q, (24.0, 24.0, 24.0)), 1.0, 2.0, 0.5), 0.3, 0.7)
        po_ = S.math("MULTIPLY", S.smooth(e_, 1.0, 0.2), S.mad(pn_, 0.6, 0.4))
        rgh = S.mad(po_, pw.get("polish_rough", -0.22), rgh)
        col = S.hsv(col, 0.5, 1.0, S.mad(po_, pw.get("polish_value", 0.25), 1.0))
    if pw.get("scuff", 0) > 0:                     # a hand-rubbed band along the front edge: smoother, a shade lighter
        sy_ = S.smooth(S.sep(S.out("tc", "Object"))[1], pw["scuff"], pw["scuff"] * 0.3)
        sn = S.smooth(S.noise(S.vec("MULTIPLY", q, (40.0, 12.0, 40.0)), 1.0, 2.0, 0.5), 0.45, 0.7)
        sc_ = S.math("MULTIPLY", sy_, sn)
        rgh = S.mad(sc_, -0.2, rgh)
        col = S.hsv(col, 0.5, 1.0, S.mad(sc_, 0.3, 1.0))
    if perf or alpha_perf:
        pf = perf or alpha_perf
        hole_d, pitch = pf["hole_mm"] / 1000.0, pf["pitch_mm"] / 1000.0
        openf = pf.get("open", math.pi * hole_d ** 2 / (2.0 * SQ3 * pitch ** 2))
        x, _, z = S.sep(S.out("tc", "Object"))
        front_face = S.smooth(S.math("ABSOLUTE", S.sep(S.out("tc", "Normal"))[1]), 0.5, 0.9)   # not the edges
        # background doors turn the lattice 90 deg (30 deg for a hex grid): seen through the open hero door,
        # two near-aligned lattices of similar pitch beat into broad moire bands; at 30 deg the beat is hole-sized
        u, v = (z, x) if pf.get("rotate") else (x, z)
        if pf.get("origin"):                         # the hero door's grid, exactly where perf_sheet cut it
            u, v = S.math("SUBTRACT", u, pf["origin"][0]), S.math("SUBTRACT", v, pf["origin"][1])
        # the hole edge is anti-aliased at the 1920 master's footprint, but the field fades to its open fraction by
        # the smallest delivery tier's (768 px) footprint, stretched by the facing ratio, so it never crawls there
        fpf = S.footprint(fx.get("perf_fpx", fx["fpx"]))
        lo, hi = pf.get("perf_px", fx.get("perf_px", [3.0, 6.0]))
        res = S.resolved(fpf, pitch, lo, hi)
        holes = S.holes_hex(u, v, pitch, hole_d / 2, fp)
        inside = front_face
        if pf.get("cells"):                          # perf_sheet's rows and columns only; solid margins round them
            xs_, zs_, rh, nr, nc = pf["cells"]
            r = S.math("FLOOR", S.math("DIVIDE", S.math("SUBTRACT", z, zs_), rh))
            par = S.math("SUBTRACT", r, S.math("MULTIPLY", S.math("FLOOR", S.math("MULTIPLY", r, 0.5)), 2.0))
            k = S.math("DIVIDE", S.math("SUBTRACT", S.math("SUBTRACT", x, xs_), S.math("MULTIPLY", par, 0.5 * pitch)), pitch)
            cell = S.math("MULTIPLY", S.math("MULTIPLY", S.math("GREATER_THAN", r, -0.5), S.math("LESS_THAN", r, nr - 0.5)),
                          S.math("MULTIPLY", S.math("GREATER_THAN", k, 0.0), S.math("LESS_THAN", k, float(nc))))
            inside = S.math("MULTIPLY", inside, cell)
        hc = tuple(pf.get("hole_color", (0.006, 0.0065, 0.007)))
        if pf.get("equipment"):                      # what shows through a door: gear in 44.45 mm units, each its own
            e0, e1 = pf["equipment"]                 # tone (per cabinet, per U), a darker gap between devices
            zu = S.math("DIVIDE", z, cfg["rack"]["U"])
            fu = S.math("FRACT", zu)
            ru = S.white(S.vec("ADD", S.comb(S.math("FLOOR", zu), S.math("MULTIPLY", S.out("obj", "Random"), 113.0), 0.0),
                               _seed_vec(cfg, "bg_equipment")))
            gap = S.math("MULTIPLY", S.smooth(fu, 0.0, 0.1), S.smooth(fu, 1.0, 0.9))
            t = S.math("MULTIPLY", S.mad(S.math("POWER", ru, 2.0), e1 - e0, e0), S.mad(gap, 0.65, 0.35))
            hc = S.comb(t, S.math("MULTIPLY", t, 1.03), S.math("MULTIPLY", t, 1.09))
        if perf:
            h = S.math("MULTIPLY", S.mix(res, openf, holes), inside)
            col = S.mix(h, col, hc, "Color")
            rgh = S.mix(h, rgh, 1.0)
            S.put(p.inputs["Specular IOR Level"], S.mix(h, spec, 0.0))
        else:
            # resolved: really open holes (alpha); unresolved: an opaque sheet toned by its open fraction, as a
            # 1.5 mm perforated sheet reads at a grazing angle (never a translucent pane over what is behind it)
            cut = S.math("MULTIPLY", S.math("MULTIPLY", res, holes), inside)
            tone = S.math("MULTIPLY", S.math("MULTIPLY", S.math("SUBTRACT", 1.0, res), openf), inside)
            col = S.mix(tone, col, hc, "Color")
            front = S.math("SUBTRACT", 1.0, S.out("geo", "Backfacing"))
            S.put(p.inputs["Alpha"], S.math("MULTIPLY", S.math("SUBTRACT", 1.0, cut), front))
            setattr_safe(m, "surface_render_method", "DITHERED")
            setattr_safe(m, "use_transparent_shadow", True)
    S.put(p.inputs["Base Color"], col)
    S.put(p.inputs["Roughness"], rgh)
    S.put(p.inputs["Normal"], nrm)
    return m


def shade_metal(cfg, key, axis):
    """Brushed nickel-grey steel: stretched-noise roughness streaks and a faint matching bump along `axis`."""
    fx = cfg["look"]["materials"]["fx"]
    bm = {**fx["brushed"], **fx.get(f"brushed_{key}", {})}
    base, rough, metal, spec = _spec(cfg, key)
    m, p, nt = mat_p(MAT_NAMES[key], base, rough, metal, 1.0, spec)
    S = SN(nt)
    q = S.seeded(S.out("tc", "Object"), _seed_vec(cfg, key))
    fp = S.footprint(fx["fpx"])
    b = S.brushed(q, axis, bm["across"], bm["along"], bm["detail"])
    blot = S.noise(q, bm["blot_scale"], 2.0, 0.5)              # broad tonal variation (handling, plating)
    vis = S.resolved(fp, 1.0 / bm["across"], 2.0, 6.0)
    if len(axis) == 1:                           # a face looking down the brushing axis has no streaks (no speckle)
        na = S.sep(S.out("tc", "Normal"))["xyz".index(axis)]
        vis = S.math("MULTIPLY", vis, S.smooth(S.math("ABSOLUTE", na), 0.8, 0.4))
    streak = S.math("MULTIPLY", S.math("SUBTRACT", b, 0.5), vis)
    rgh = S.mad(streak, 2.0 * bm["rough_amp"], S.mad(S.math("SUBTRACT", blot, 0.5), 2.0 * bm["blot_amp"], rough))
    val = S.mad(streak, bm["value_amp"], 1.0)
    col = S.hsv(S.jitter(base, fx["jitter"] * 0.6), 0.5, 1.0, val)
    nrm = S.bump(b, S.math("MULTIPLY", vis, bm["bump"]), 0.0003)
    rgh = S.math("MAXIMUM", rgh, 0.08)
    if bm.get("dust", 0) > 0:                                  # dust on the up-facing tops of tray members
        d = S.math("MULTIPLY", S.dust(q, fx["dust"]["scale"]), bm["dust"])
        col = S.mix(d, col, tuple(fx["dust"]["color"]), "Color")
        rgh = S.mix(d, rgh, 0.9)
        S.put(p.inputs["Metallic"], S.mix(d, metal, 0.0))
    S.put(p.inputs["Base Color"], col)
    S.put(p.inputs["Roughness"], rgh)
    S.put(p.inputs["Normal"], nrm)
    return m


def shade_matte(cfg, key, amp, scale, jit):
    """Board / plastic / rubber: per-object jitter and a gentle low-frequency roughness breakup."""
    fx = cfg["look"]["materials"]["fx"]
    base, rough, metal, spec = _spec(cfg, key)
    m, p, nt = mat_p(MAT_NAMES[key], base, rough, metal, 1.0, spec)
    S = SN(nt)
    q = S.seeded(S.out("tc", "Object"), _seed_vec(cfg, key))
    S.put(p.inputs["Base Color"], S.jitter(base, jit))
    S.put(p.inputs["Roughness"], S.mad(S.math("SUBTRACT", S.noise(q, scale, 2.0, 0.5), 0.5), 2.0 * amp, rough))
    return m, p, S


def shade_board(cfg):
    """Solder-masked board (the switch's and the server's): satin, so the bay light leaves a soft gradient across
    it, with trace groups under the mask: columns of fine traces running front to back in staggered segments and
    sparser rows across, a shade lighter and a touch glossier than the bare mask. Each fine trace fades to its
    group's mean below ~3 px and each group gap below ~2 px (no field of lines that crawls when scrubbed)."""
    fx = cfg["look"]["materials"]["fx"]
    bd = fx["board"]
    base, rough, metal, spec = _spec(cfg, "pcb")
    m, p, nt = mat_p("MAT_pcb_black", base, rough, metal, 1.0, spec)
    S = SN(nt)
    pos = S.out("tc", "Object")                                   # sled-local: x across, y from the front
    x, y, _ = S.sep(pos)
    fp = S.footprint(fx["fpx"])
    sd = _seed_vec(cfg, "pcb")
    def layer(a, b, w, L, density, k):
        """Groups `w` wide across axis a, in segments along axis b: tiles of length L, each group's segment
        starting and ending at seeded offsets inside its tile; ~density of the groups populated."""
        ia, ib = S.math("FLOOR", S.math("DIVIDE", a, w)), S.math("FLOOR", S.math("DIVIDE", b, L))
        cell = S.vec("ADD", S.comb(ia, ib, float(k)), sd)
        on = S.smooth(S.white(cell), 1.0 - density - 0.02, 1.0 - density + 0.02)
        r0 = S.white(S.vec("ADD", cell, (11.0, 0.0, 0.0)))
        r1 = S.white(S.vec("ADD", cell, (0.0, 13.0, 0.0)))
        tb = S.math("SUBTRACT", S.math("DIVIDE", b, L), ib)        # 0..1 along the tile
        seg = S.math("MULTIPLY", S.smooth(tb, S.mad(r0, 0.35, 0.02), S.mad(r0, 0.35, 0.04)),
                     S.smooth(tb, S.mad(r1, -0.35, 0.98), S.mad(r1, -0.35, 0.96)))
        ta = S.math("SUBTRACT", S.math("DIVIDE", a, w), ia)        # 0..1 across the group
        gap = bd["gap_mm"] / 1000.0 / w
        edge = S.math("MULTIPLY", S.smooth(ta, gap * 0.5, gap), S.smooth(ta, 1.0 - gap * 0.5, 1.0 - gap))
        edge = S.mix(S.resolved(fp, bd["gap_mm"] / 1000.0, 1.5, 3.0), 1.0, edge)
        tp = bd["trace_mm"] / 1000.0                               # fine traces at this pitch inside a group
        tr = S.smooth(S.math("ABSOLUTE", S.math("SUBTRACT", S.math("FRACT", S.math("DIVIDE", a, tp)), 0.5)), 0.32, 0.2)
        tr = S.mix(S.resolved(fp, tp, 2.0, 4.0), 0.5, tr)
        return S.math("MULTIPLY", S.math("MULTIPLY", on, seg), S.math("MULTIPLY", edge, tr))
    v = layer(x, y, bd["col_mm"] / 1000.0, bd["tile_m"], bd["density"], 1)
    h = layer(y, x, bd["row_mm"] / 1000.0, bd["tile_m"] * 0.7, bd["density"] * 0.6, 2)
    band = S.math("MAXIMUM", v, h)
    q = S.seeded(pos, sd)
    col = S.hsv(S.jitter(base, 0.02), 0.5, 1.0, S.mad(band, bd["value"], 1.0))
    rgh = S.mad(S.math("SUBTRACT", S.noise(q, bd["rough_scale"], 2.0, 0.5), 0.5), 2.0 * bd["rough_amp"], rough)
    rgh = S.mad(band, -bd["gloss"], rgh)
    S.put(p.inputs["Base Color"], col)
    S.put(p.inputs["Roughness"], rgh)
    return m


def shade_floor(cfg):
    """0.6 m raised-floor tiles: per-tile tone within +-tile_var/2 (never a chessboard), dark seams band-limited
    by the footprint, grime along the seams, a trodden path down the aisle, dust toward the cabinets."""
    fx = cfg["look"]["materials"]["fx"]
    fl, tile = fx["floor"], cfg["hall"]["tile"]
    m, p, nt = mat_p("MAT_floor_tiles", tuple(fl["base"]), fl["rough"], 0.0, 1.0, fl["spec"])
    S = SN(nt)
    pos = S.out("tc", "Object")                                  # ENV_floor sits at the origin: object = world
    x, y, _ = S.sep(pos)
    xs = S.math("DIVIDE", S.math("ADD", x, tile / 2), tile)       # seams on the rack edges (x = +-0.3)
    ys = S.math("DIVIDE", y, tile)
    ix, iy = S.math("FLOOR", xs), S.math("FLOOR", ys)
    u, v = S.math("FRACT", xs), S.math("FRACT", ys)
    cell = S.vec("ADD", S.comb(ix, iy, 0.0), _seed_vec(cfg, "floor_tile"))
    r1 = S.white(cell)
    r2 = S.white(S.vec("ADD", cell, (17.0, 31.0, 5.0)))
    e = S.math("MULTIPLY", S.math("MINIMUM", S.math("MINIMUM", u, S.math("SUBTRACT", 1.0, u)),
                                  S.math("MINIMUM", v, S.math("SUBTRACT", 1.0, v))), tile)   # metres to the seam
    fp = S.footprint(fx["fpx"])
    q = S.vec("ADD", pos, _seed_vec(cfg, "floor"))
    # tone: per tile, plus a slow mottle
    tone = S.mad(S.math("SUBTRACT", r1, 0.5), fl["tile_var"], 1.0)
    tone = S.mad(S.math("SUBTRACT", S.noise(q, fl["mottle_scale"], 3.0, 0.55), 0.5), fl["mottle"], tone)
    # seam: a dark gap of seam_mm, widened to >= 0.8 px with its contrast scaled down so the far floor keeps its mean
    w0 = fl["seam_mm"] / 1000.0
    w = S.math("MAXIMUM", S.math("MULTIPLY", fp, 0.8), w0)
    gap = S.math("MULTIPLY", S.smooth(e, w, S.math("MULTIPLY", w, 0.4)), S.math("DIVIDE", w0, w))
    # grime: within a few cm of the seams, patchy
    gn = S.smooth(S.noise(q, fl["grime_scale"], 3.0, 0.6), 0.4, 0.75)
    grime = S.math("MULTIPLY", S.smooth(e, fl["grime_mm"] / 1000.0, 0.0), S.mad(gn, 0.7, 0.3))
    # trodden path down the aisle centre (|x| < ~0.6 m): a touch lighter and smoother, scuffed along y
    path = S.math("MULTIPLY", S.smooth(S.math("ABSOLUTE", x), 0.75, 0.2),
                  S.smooth(S.noise(q, fl["wear_scale"], 2.0, 0.5), 0.35, 0.7))
    scuff = S.noise(S.vec("MULTIPLY", q, (60.0, 4.0, 60.0)), 1.0, 1.0, 0.5)
    wear = S.math("MULTIPLY", path, S.mad(scuff, 0.6, 0.4))
    # dust: more toward the cabinets and in the tile corners nobody steps on
    dn = S.smooth(S.noise(q, fl.get("dust_scale", fx["dust"]["scale"] * 1.5), 3.0, 0.55), 0.35, 0.75)
    dust = S.math("MULTIPLY", S.mad(S.smooth(S.math("ABSOLUTE", x), 0.4, 0.9), 0.7, 0.3), dn)
    dust = S.math("MULTIPLY", dust, fl["dust"])
    aw = cfg["hall"]["aisle_width"] / 2                        # dirt line where the cabinets meet the floor
    ax = S.math("MULTIPLY", S.smooth(S.math("ABSOLUTE", S.math("SUBTRACT", S.math("ABSOLUTE", x), aw)),
                                     fl["base_mm"] / 1000.0, 0.0), S.smooth(y, 0.05, -0.05))
    fy = S.math("MULTIPLY", S.smooth(S.math("ABSOLUTE", y), fl["base_mm"] / 1000.0, 0.0),
                S.smooth(S.math("ABSOLUTE", x), aw + 0.1, aw))
    base = S.math("MULTIPLY", S.math("MAXIMUM", ax, fy), S.mad(gn, 0.5, 0.5))
    grime = S.math("MAXIMUM", grime, base)
    val = S.math("MULTIPLY", tone, S.math("SUBTRACT", 1.0, S.math("MULTIPLY", grime, fl["grime"])))
    val = S.math("MULTIPLY", val, S.mad(wear, fl["wear"], 1.0))
    col = S.hsv(tuple(fl["base"]), 0.5, 1.0, val)
    col = S.mix(dust, col, tuple(fx["dust"]["color_floor"]), "Color")
    col = S.mix(S.math("MULTIPLY", gap, 0.85), col, (0.01, 0.01, 0.011), "Color")
    rgh = S.mad(S.math("SUBTRACT", r2, 0.5), fl["tile_rough_var"], fl["rough"])
    rgh = S.mad(wear, -fl["wear_rough"], rgh)
    rgh = S.mix(S.math("MAXIMUM", dust, S.math("MULTIPLY", grime, 0.6)), rgh, 0.9)
    rgh = S.mix(gap, rgh, 1.0)
    S.put(p.inputs["Base Color"], col)
    S.put(p.inputs["Roughness"], rgh)
    edge = S.smooth(e, 0.0, 0.003)                               # the tiles' rounded edges catch a little light
    S.put(p.inputs["Normal"], S.bump(edge, S.math("MULTIPLY", S.resolved(fp, 0.003, 2.0, 5.0), fl["edge_bump"]),
                                     0.001))
    return m


def shade_vent(cfg):
    """Perforated steel tile: a square grid of round holes onto the dark plenum, solid border; fades to its mean."""
    fx = cfg["look"]["materials"]["fx"]
    vt, tile = fx["vent"], cfg["hall"]["tile"]
    base, rough, metal, spec = _spec(cfg, "vent")
    m, p, nt = mat_p(MAT_NAMES["vent"], base, rough, metal, 1.0, spec)
    S = SN(nt)
    x, y, _ = S.sep(S.out("tc", "Object"))
    lx = S.math("SUBTRACT", S.math("MULTIPLY", S.math("FRACT", S.math("DIVIDE", S.math("ADD", x, tile / 2), tile)),
                                   tile), tile / 2)
    ly = S.math("SUBTRACT", S.math("MULTIPLY", S.math("FRACT", S.math("DIVIDE", y, tile)), tile), tile / 2)
    fp = S.footprint(fx["fpx"])
    pitch, rad = vt["pitch_mm"] / 1000.0, vt["hole_mm"] / 2000.0
    lim = tile / 2 - vt["border_mm"] / 1000.0
    inside = S.math("MULTIPLY", S.smooth(S.math("ABSOLUTE", lx), lim, lim - 0.002),
                    S.smooth(S.math("ABSOLUTE", ly), lim, lim - 0.002))
    openf = math.pi * rad * rad / (pitch * pitch)
    if cfg["hall"].get("vent_hole_mm"):               # build_hall cuts real holes (perf_sheet): paint only the web
        h = S.math("MULTIPLY", inside, 0.0)
    else:
        h = S.math("MULTIPLY", S.perf(S.holes_square(lx, ly, pitch, rad, fp), pitch, openf, fp), inside)
    q = S.seeded(S.out("tc", "Object"), _seed_vec(cfg, "vent"))
    web = S.hsv(base, 0.5, 1.0, S.mad(S.math("SUBTRACT", S.noise(q, 6.0, 2.0, 0.5), 0.5), 0.12, 1.0))
    S.put(p.inputs["Base Color"], S.mix(h, web, tuple(vt["hole_color"]), "Color"))
    S.put(p.inputs["Roughness"], S.mix(h, rough, 1.0))
    S.put(p.inputs["Specular IOR Level"], S.mix(h, spec, 0.0))
    return m


def shade_led(cfg, name, strength, color=None):
    """A small lens: full emission at the face centre falling to `edge` at its rim (bbox-normalised coords)."""
    lens = cfg["look"]["materials"]["fx"]["led_edge"]
    m, p, nt = mat_p(name, (0.01, 0.01, 0.01), 0.35)
    S = SN(nt)
    if color is None:
        S.put(p.inputs["Emission Color"], S.out("obj", "Color"))
    else:
        p.inputs["Emission Color"].default_value = (*color, 1.0)
    if lens >= 1.0:
        p.inputs["Emission Strength"].default_value = strength
        return m
    g = S.vec("MULTIPLY", S.vec("SUBTRACT", S.out("tc", "Generated"), (0.5, 0.5, 0.5)), (2.0, 2.0, 2.0))
    t = S.node("ShaderNodeVectorTransform", vector_type="NORMAL", convert_from="WORLD", convert_to="OBJECT")
    S.put(t.inputs[0], S.out("geo", "True Normal"))
    n = S.vec("NORMALIZE", t.outputs[0])
    perp = S.vec("SUBTRACT", g, S.vec("SCALE", n, s=S.vec("DOT_PRODUCT", g, n)))
    k = S.smooth(S.vec("LENGTH", perp), 1.15, 0.25)
    S.put(p.inputs["Emission Strength"], S.math("MULTIPLY", S.mad(k, 1.0 - lens, lens), strength))
    return m


def shade_led_glow(cfg, name, strength, color):
    """A status lens seen through a door's mesh at a distance: a quad ~2.5x the lens whose emission is a hot core
    (core x the lens strength) inside a soft gaussian halo, so it reads as a small lamp glowing, not a printed dot."""
    gl = cfg["hall"]["bg_leds"].get("glow", {"core": 1.5, "core_r": 0.3, "halo": 0.35, "halo_r": 0.7})
    m, p, nt = mat_p(name, (0.0, 0.0, 0.0), 0.35, 0.0, 1.0, 0.0)
    S = SN(nt)
    p.inputs["Emission Color"].default_value = (*color, 1.0)
    g = S.vec("MULTIPLY", S.vec("SUBTRACT", S.out("tc", "UV"), (0.5, 0.5, 0.0)), (2.0, 2.0, 0.0))   # per quad
    r2 = S.vec("DOT_PRODUCT", g, g)
    lobe = lambda w, rr: S.math("MULTIPLY", w, S.math("EXPONENT", S.math("MULTIPLY", r2, -1.0 / (rr * rr))))
    S.put(p.inputs["Emission Strength"], S.math("MULTIPLY", S.math("ADD", lobe(gl["core"], gl["core_r"]),
                                                                   lobe(gl["halo"], gl["halo_r"])), strength))
    return m


def materials(cfg):
    M = {}
    fx = cfg["look"]["materials"]["fx"]
    M["rack"] = shade_powder(cfg, "rack")
    if fx.get("powder_rack_worn"):                  # G2' R3: the solid end door's own finish (hand-polished at the lever)
        M["rack_worn"] = shade_powder(cfg, "rack", "MAT_rack_worn", extra=fx["powder_rack_worn"])
    M["bezel"] = shade_powder(cfg, "bezel")
    M["bg_door"] = shade_powder(cfg, "bg_door", perf=fx["bg_perf"])
    M["roof"] = shade_powder(cfg, "roof")                         # the row cabinets' roofs: matte, dusty, dark
    M["post"] = shade_metal(cfg, "post", "z")
    M["metal"] = shade_metal(cfg, "metal", "y")
    M["rail"] = shade_metal(cfg, "rail", "y")
    M["tray"] = shade_metal(cfg, "tray", "xy")
    M["board"] = shade_matte(cfg, "board", 0.04, 25.0, 0.02)[0]
    M["pcb"] = shade_board(cfg)
    M["dark"] = shade_matte(cfg, "dark", 0.05, 40.0, 0.03)[0]
    cb = fx["cable"]
    m, p, S = shade_matte(cfg, "cable", cb["rough_amp"], 12.0, cb["jitter"])
    p.inputs["Sheen Weight"].default_value = cb["sheen"]
    p.inputs["Sheen Roughness"].default_value = cb["sheen_rough"]
    p.inputs["Sheen Tint"].default_value = (*cb["sheen_tint"], 1.0)
    M["cable"] = m
    base, rough, metal, spec = _spec(cfg, "plate")                # the label well stays plain: the page's plate lands on it
    M["plate"] = mat_p(MAT_NAMES["plate"], base, rough, metal, 1.0, spec)[0]
    M["vent"] = shade_vent(cfg)
    rd = cfg["look"]["materials"]["rod"]                          # threaded hanger rods: rough, dark, no glints
    M["rod"] = mat_p("MAT_rod", tuple(rd[:3]), rd[3], rd[4], 1.0, rd[5] if len(rd) > 5 else 0.5)[0]
    M["wall"] = shade_matte(cfg, "wall", 0.05, 0.6, 0.0)[0]      # the hall's painted walls
    M["led"] = shade_led(cfg, "MAT_led", cfg["leds"]["strength"])
    M["fixture"] = mat_emit_objcolor("MAT_bay_strip", 8.0)
    M["led_standby"] = shade_led(cfg, "MAT_led_standby", cfg["leds"]["strength"], tuple(cfg["leds"]["standby"]))
    M["led_glow"] = shade_led_glow(cfg, "MAT_led_glow", cfg["leds"]["strength"], tuple(cfg["leds"]["standby"]))
    M["top"] = shade_powder(cfg, "top", "MAT_rack_top", per_object=False)   # the hero rack's roof (its own dust)
    rs = cfg["look"]["materials"].get("riser")                    # the reply's riser: matte, so the point never streaks it
    M["riser"] = mat_p("MAT_riser", tuple(rs[:3]), rs[3], rs[4], 1.0, rs[5])[0] if rs else None
    rf = cfg["look"]["materials"].get("riser_fade")               # its twin for the exit: fades out with height
    if rf:                                                        # (alpha 1 - smootherstep((z - z0)/dz), dithered), so
        m_, p_, nt_ = mat_p("MAT_riser_fade", tuple(rs[:3]) if rs else (0.012, 0.012, 0.013),   # the reply rises free
                            rs[3] if rs else 1.0, rs[4] if rs else 0.0, 1.0, rs[5] if rs else 0.0)   # into the fog
        S_ = SN(nt_)
        mr = S_.node("ShaderNodeMapRange", interpolation_type="SMOOTHERSTEP", clamp=True)
        S_.io(mr, {"Value": S_.sep(S_.out("geo", "Position"))[2], "From Min": rf[0], "From Max": rf[0] + rf[1],
                   "To Min": 1.0, "To Max": 0.0})
        nt_.links.new(mr.outputs["Result"], p_.inputs["Alpha"])
        setattr_safe(m_, "surface_render_method", "DITHERED")
        M["riser_fade"] = m_
    M["request"] = mat_request(cfg)
    M["floor"] = shade_floor(cfg)
    hz = cfg["look"]["haze"]                     # density = base x VOL_haze.color alpha (keyed)
    m = bpy.data.materials.new("MAT_haze")
    nt = _tree(m)
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out, pv = nt.nodes.new("ShaderNodeOutputMaterial"), nt.nodes.new("ShaderNodeVolumePrincipled")
    oi, mul = nt.nodes.new("ShaderNodeObjectInfo"), nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = hz["density"]
    nt.links.new(oi.outputs["Alpha"], mul.inputs[0])
    nt.links.new(mul.outputs[0], pv.inputs["Density"])
    pv.inputs["Color"].default_value = (*hz["color"], 1)
    pv.inputs["Anisotropy"].default_value = hz["anisotropy"]
    if hz.get("ambient", 0.0) > 0.0:             # single scatter of the hall's even ambient field: an even distance
        amb = nt.nodes.new("ShaderNodeMath")       # tint that rides the same keyed density (no beams, no cones)
        amb.operation = "MULTIPLY"
        amb.inputs[1].default_value = hz["ambient"]
        nt.links.new(mul.outputs[0], amb.inputs[0])
        nt.links.new(amb.outputs[0], pv.inputs["Emission Strength"])
        pv.inputs["Emission Color"].default_value = (*hz.get("ambient_color", hz["color"]), 1)
    nt.links.new(pv.outputs["Volume"], out.inputs["Volume"])
    M["haze"] = m
    up = cfg["look"].get("upper")                # the exit's ceiling fog: density sigma_max x smootherstep of height x
    if up:                                       # level (VOL_upper.color alpha, keyed), luminance from an even emission
        m = bpy.data.materials.new("MAT_upper")  # term riding the density (radiance -> emission x color once dense)
        nt = _tree(m)
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        S_ = SN(nt)
        out, pv = nt.nodes.new("ShaderNodeOutputMaterial"), nt.nodes.new("ShaderNodeVolumePrincipled")
        mr = S_.node("ShaderNodeMapRange", interpolation_type="SMOOTHERSTEP", clamp=True)
        S_.io(mr, {"Value": S_.sep(S_.out("geo", "Position"))[2], "From Min": up["base"][0],
                   "From Max": up["base"][0] + up["base"][1], "To Min": 0.0, "To Max": float(up["sigma_max"])})
        dens = S_.math("MULTIPLY", mr.outputs["Result"], S_.out("obj", "Alpha"))
        nt.links.new(dens, pv.inputs["Density"])
        pv.inputs["Color"].default_value = (*up["color"], 1)
        pv.inputs["Anisotropy"].default_value = up.get("anisotropy", 0.0)
        nt.links.new(S_.math("MULTIPLY", dens, float(up["emission"])), pv.inputs["Emission Strength"])
        pv.inputs["Emission Color"].default_value = (*up["emission_color"], 1)
        nt.links.new(pv.outputs["Volume"], out.inputs["Volume"])
        M["upper"] = m
    return M


# ------------------------------------------------------------------ scene settings
def setup_scene(cfg):
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.render.fps, sc.render.fps_base = cfg["fps"], 1.0
    w = bpy.data.worlds.new("WORLD_hall")
    nt = _tree(w)
    bg = next((n for n in nt.nodes if n.type == "BACKGROUND"), None)
    if bg is None:
        bg = nt.nodes.new("ShaderNodeBackground")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_WORLD"), None) or nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs["Color"].default_value = (*cfg["look"]["world"], 1.0)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    setattr_safe(sc.eevee, "shadow_pool_size", str(cfg["lights"].get("shadow_pool_mb", 512)))   # ~25 soft lights
    apply_look(cfg, sc, cfg["look"]["samples"]["preview"])


def apply_look(cfg, sc, samples):
    lk = cfg["look"]
    sc.render.engine = lk["engine"]
    ee = sc.eevee
    setattr_safe(ee, "taa_render_samples", int(samples))
    setattr_safe(ee, "use_overscan", True)
    setattr_safe(ee, "overscan_size", lk["overscan"])
    setattr_safe(ee, "volumetric_tile_size", lk["volumetrics"]["tile"])
    setattr_safe(ee, "volumetric_samples", lk["volumetrics"]["steps"])
    setattr_safe(ee, "volumetric_end", lk["volumetrics"]["end"])
    setattr_safe(ee, "use_volumetric_shadows", True)
    setattr_safe(ee, "use_raytracing", True)
    setattr_safe(ee, "use_shadows", True)
    sc.render.use_motion_blur = bool(lk["motion_blur"])
    if "filter_size" in lk:                          # pixel filter width (px): a touch wider than 1.5 calms sub-pixel detail
        setattr_safe(sc.render, "filter_size", float(lk["filter_size"]))
    for k_, v_ in lk.get("gi", {}).items():          # fast GI / horizon scan (eevee.fast_gi_*), from config
        setattr_safe(ee, k_, v_)
    rto = getattr(ee, "ray_tracing_options", None)
    for k_, v_ in lk.get("ray_tracing", {}).items():
        setattr_safe(rto, k_, v_)
    setattr_safe(ee, "use_bokeh_jittered", bool(lk["dof"].get("jittered", True)))
    setattr_safe(ee, "bokeh_overblur", float(lk["dof"].get("overblur", 5.0)))
    cp = lk["compositor"]
    sc.render.use_compositing = bool(cp.get("applied"))
    setattr_safe(sc.render, "use_sequencer", False)
    setattr_safe(sc.render, "compositor_device", cp.get("device", "GPU"))
    setattr_safe(sc.render, "compositor_precision", cp.get("precision", "FULL"))
    sc.render.film_transparent = False
    setattr_safe(sc.render, "dither_intensity", lk["dither"])
    vs = sc.view_settings
    setattr_safe(vs, "view_transform", lk["view_transform"])
    for name in (lk["look"], lk["look"].replace("AgX - ", ""), "None"):
        if setattr_safe(vs, "look", name):
            break
    for a in [p.identifier for p in sc.render.bl_rna.properties if p.identifier.startswith("use_stamp")]:
        setattr_safe(sc.render, a, False)            # no date/time/render-time text chunks in the PNGs
    ims = sc.render.image_settings
    setattr_safe(ims, "media_type", "IMAGE")
    ims.file_format = "PNG"
    ims.color_mode = "RGB"
    ims.color_depth = "8"


# ------------------------------------------------------------------ geometry helpers (hall dressing, hero rack)
def ptframes(P):
    """Parallel-transport frames (tangent, normal, binormal) along a polyline of Vectors."""
    m, T = len(P), []
    for i in range(m):
        d = P[min(i + 1, m - 1)] - P[max(i - 1, 0)]
        T.append(d.normalized() if d.length > 1e-12 else Vector((0.0, 1.0, 0.0)))
    a = Vector((0.0, 0.0, 1.0)) if abs(T[0].z) < 0.9 else Vector((1.0, 0.0, 0.0))
    N, out = T[0].cross(a).normalized(), []
    for t in T:
        N = N - t * N.dot(t)
        N = N.normalized() if N.length > 1e-9 else t.orthogonal().normalized()
        out.append((t, N, t.cross(N)))
    return out


def tube_verts(pts, r, n):
    P = [Vector(p) for p in pts]
    return [[P[i] + (nn * math.cos(2 * PI * k / n) + bb * math.sin(2 * PI * k / n)) * (r[i] if isinstance(r, (list, tuple)) else r)
             for k in range(n)] for i, (t, nn, bb) in enumerate(ptframes(P))]


def arclen(P):
    s = [0.0]
    for a, b in zip(P, P[1:]):
        s.append(s[-1] + (Vector(b) - Vector(a)).length)
    return s


def at_len(P, s, x):
    """Point and unit tangent at arc length x along polyline P (cumulative lengths s)."""
    x = clamp(x, 0.0, s[-1])
    for i in range(len(P) - 1):
        if x <= s[i + 1] or i == len(P) - 2:
            a, b = Vector(P[i]), Vector(P[i + 1])
            return a.lerp(b, clamp((x - s[i]) / max(s[i + 1] - s[i], 1e-9))), (b - a).normalized()


def resample(P, n):
    s = arclen(P)
    return [tuple(at_len(P, s, s[-1] * i / (n - 1))[0]) for i in range(n)]


def wander(r, n=48):
    """Seeded smooth 1-D noise in -1..1 with knots at the integers (cable wander, sag variety)."""
    kn = [r.uniform(-1, 1) for _ in range(n)]
    def f(t):
        i = math.floor(t)
        u = t - i
        return lerp(kn[i % n], kn[(i + 1) % n], u * u * (3 - 2 * u))
    return f


def fillet(W, rad, step=0.05):
    """Polyline through waypoints W, every interior corner rounded (radius rad, clamped to the neighbouring
    segments), sampled about every `step` metres; consecutive duplicates dropped."""
    W = [Vector(p) for p in W]
    out = [W[0]]
    for i in range(1, len(W) - 1):
        a, b, c = W[i - 1], W[i], W[i + 1]
        d0, d1 = b - a, c - b
        if d0.length < 1e-9 or d1.length < 1e-9:
            continue
        ang = d0.angle(d1)
        if ang < 1e-3:
            out.append(b)
            continue
        t = min(rad * math.tan(ang / 2), 0.49 * d0.length, 0.49 * d1.length)
        p0, p1 = b - d0.normalized() * t, b + d1.normalized() * t
        k = max(3, int(t * ang / step) + 3)
        out += [p0 * (1 - u) ** 2 + b * 2 * u * (1 - u) + p1 * u * u for u in (j / k for j in range(k + 1))]
    out.append(W[-1])
    res = [out[0]]
    for a, b in zip(out, out[1:]):
        L = (b - a).length
        if L < 1e-6:
            continue
        m = max(1, int(L / step + 0.5))
        res += [a.lerp(b, j / m) for j in range(1, m + 1)]
    return [tuple(p) for p in res]


def bundle(mbs, P, R, n_out, r, mats, rr, straps=(), sides=6, cut=None):
    """A velcro-strapped cable bundle along polyline P: n_out cables (radius r) on a ring just inside R around a
    dark core, twisting slowly, each wandering inward a little (never outward, so the straps sit on top);
    straps are 19 mm bands at the given arc lengths. mats = (cable, core, strap) material indices. With `cut`
    the points up to index cut go to mbs[0] and the rest to mbs[-1] (separate objects, one seamless bundle)."""
    Pv, s = [Vector(p) for p in P], arclen(P)
    F = ptframes(Pv)
    c = len(P) - 1 if cut is None else cut
    A, B = mbs[0], mbs[-1]
    def emit(pts, rad, n, mi):
        A.tube(pts[:c + 1], rad, n, mi)
        if c < len(pts) - 1:
            B.tube(pts[c:], rad, n, mi)
    tw = rr.uniform(0.5, 1.1) * (1 if rr.random() < 0.5 else -1)
    st_ = sorted(straps)
    def free(x):                                     # 0 under a strap, 1 from 6 cm away from the nearest one
        return min(1.0, min([abs(x - q) for q in st_] or [1.0]) / 0.06)
    for k in range(n_out):
        ph, wn, sc = 2 * PI * k / n_out + rr.uniform(-0.12, 0.12), wander(rr, 24), rr.uniform(0.25, 0.6)
        loose = rr.random() < 0.125                  # about one cable in eight: crosses a neighbour, lifts between straps
        wa, wl = wander(rr, 24), wander(rr, 24)
        aw, lift = (rr.uniform(0.25, 0.45), rr.uniform(0.001, 0.002)) if loose else (0.0, 0.0)
        pts_ = []
        for i, (p, (t, nn, bb)) in enumerate(zip(Pv, F)):
            a_ = ph + tw * s[i] + aw * wa(s[i] / 0.35) * free(s[i])
            rad_ = (R - r) * (1.0 - 0.07 * abs(wn(s[i] / sc))) + lift * free(s[i]) * (0.6 + 0.4 * wl(s[i] / 0.2))
            pts_.append(p + (nn * math.cos(a_) + bb * math.sin(a_)) * rad_)
        emit(pts_, r, sides, mats[0])
    emit(Pv, max(R - 1.8 * r, 0.6 * r), sides + 2, mats[1])
    for x in straps:
        q, t = at_len(P, s, x)
        (A if x <= s[c] else B).tube([q - t * 0.0095, q + t * 0.0095], R + 0.0016, 16, mats[2])


def perf_grid(x0, x1, z0, z1, p, align=None):
    """perf_sheet's staggered grid (pure): rows nr at pitch h = p sqrt(3)/2 from zs, columns nc at p from xs (odd
    rows offset p/2); `align` = (x, z) moves it so a hole is centred there."""
    h = p * math.sqrt(3) / 2
    nr, nc = int((z1 - z0) / h) - 2, int((x1 - x0) / p - 0.5) - 2
    xs, zs = x0 + ((x1 - x0) - (nc + 0.5) * p) / 2, z0 + ((z1 - z0) - nr * h) / 2
    if align:
        ax, az = align
        rr_ = int(round((az - zs) / h - 0.5))
        zs += az - (zs + (rr_ + 0.5) * h)
        off = 0.5 * p * (rr_ % 2)
        xs += ax - (xs + off + (int(round((ax - xs - off) / p - 0.5)) + 0.5) * p)
    return {"xs": xs, "zs": zs, "h": h, "nr": nr, "nc": nc, "p": p}


def door_align(cfg):
    """Where the door's grid is pinned (door-local x, z): a hole in front of rack.door.align_led's status light,
    seen from both cameras at the hero's end."""
    rk, dr = cfg["rack"], cfg["rack"]["door"]
    if not dr.get("align_led"):
        return None
    W = rk["width"] / 2
    u = next(v for v in resolved_units(cfg) if v["id"] == dr["align_led"])
    lx, ldz = dr.get("align_led_pos", [0.2, 0.0])
    led = (lx, rk["face_y"] - 0.001, slot_bot(cfg, u["u"]) + led_face_z(cfg, u) + ldz)
    path, ft, ys = build_path(cfg), film_table(cfg), rk["front_y"] - 0.005 - 0.007
    hits = []
    p = pose_at(cfg, path, ft[0]["b"])
    for c in ((p["x"], p["y"], p["z"]), portrait_of(p)):
        tt = (ys - c[1]) / (led[1] - c[1])
        hits.append((c[0] + tt * (led[0] - c[0]) + W, c[2] + tt * (led[2] - c[2])))
    off = dr.get("align_offset", [0.0, 0.0])        # split between the hero end and the epilogue's shut-door view
    return (sum(h[0] for h in hits) / len(hits) + off[0], sum(h[1] for h in hits) / len(hits) + off[1])


def door_grid(cfg):
    rk, dr = cfg["rack"], cfg["rack"]["door"]
    dw, pl, top = rk["width"], rk["plinth"], rk["top_z"]
    return perf_grid(0.022, dw - 0.037, pl + 0.027, top - 0.027, dr["pitch_mm"] / 1000.0, door_align(cfg))


def led_face_z(cfg, u):
    """A unit's status-light height above its slot bottom, in its face part's frame (as build_units places it)."""
    hh = slot_hh(cfg, u)
    zoff = -0.0004 if face_part(u) == "front" else 0.0
    zc = (hh - u["strip"] / 2) if "strip" in u else hh / 2 + zoff
    return hh - 0.016 if u["kind"] == "server" else zc


def led_positions(cfg):
    """Status-light (x, dz) per opening unit. G2': every light is frozen in rack.door.align_leds.fixed (the values
    the ray test below computed at G2 round 3 from the f950 epilogue camera, plus the lights placed by eye), so the
    hold films rack-00...rack-04 do not move when the timeline after f648 changes. The ray test (frame, max dx, max
    dz: the nudge that leaves each light behind an open door hole from that frame's camera) runs only for a unit that
    is not frozen, and only when its frame is inside the timeline. The align_led unit stays put (the grid is pinned
    to it at the hero's end)."""
    rk, dr = cfg["rack"], cfg["rack"]["door"]
    out = {u["id"]: (0.2, 0.0) for u in opening_units(cfg)}
    if dr.get("align_led"):
        out[dr["align_led"]] = tuple(dr.get("align_led_pos", [0.2, 0.0]))
    al = dr.get("align_leds")
    if not al:
        return out
    fixed = al.get("fixed", {})
    todo = [u for u in opening_units(cfg) if u["id"] != dr.get("align_led") and u["id"] not in fixed]
    for uid, v in fixed.items():                     # frozen (G2'), or placed by eye (an occluder the ray test cannot see)
        if uid in out and uid != dr.get("align_led"):
            out[uid] = tuple(v)
    ft = film_table(cfg)
    if not todo or "frame" not in al or not (ft[0]["a"] <= al["frame"] <= ft[-1]["b"]):
        return out
    g, W = door_grid(cfg), rk["width"] / 2
    ys = rk["front_y"] - 0.005 - 0.00775
    p = pose_at(cfg, build_path(cfg), al["frame"])
    c = (p["x"], p["y"], p["z"])
    holes = [(g["xs"] + 0.5 * g["p"] * (r % 2) + (k + 0.5) * g["p"] - W, g["zs"] + (r + 0.5) * g["h"])
             for r in range(g["nr"]) for k in range(g["nc"])]
    for u in todo:
        zl = slot_bot(cfg, u["u"]) + led_face_z(cfg, u) + (0.0004 if face_part(u) == "front" else 0.0)
        L = (0.2, rk["face_y"] - 0.001, zl)
        t = (ys - c[1]) / (L[1] - c[1])
        hx, hz = c[0] + t * (L[0] - c[0]), c[2] + t * (L[2] - c[2])
        best, dzm = None, al.get("dz", {}).get(u["id"], al["dz_default"])
        for (qx, qz) in holes:                       # the nudge (clamped) that leaves the hit nearest a hole centre
            dx, dz = clamp((qx - hx) / t, -al["dx"], al["dx"]), clamp((qz - hz) / t, -dzm, dzm)
            res = math.hypot(qx - hx - t * dx, qz - hz - t * dz)
            if best is None or (res, dx * dx + dz * dz) < best[:2]:
                best = (res, dx * dx + dz * dz, dx, dz)
        if best and best[0] < cfg["rack"]["door"]["hole_mm"] / 2000.0 - 0.003:
            out[u["id"]] = (round(0.2 + best[2], 5), round(best[3], 5))
    return out


def perf_sheet(mb, x0, x1, z0, z1, y0, y1, rad, p, mi=0, align=None):
    """A perforated steel sheet in the x-z plane, faces at depths y0 < y1: round holes (12-gons, radius rad) on a
    staggered grid (row pitch p*sqrt(3)/2), solid margins all round. With 12-gons on that grid every cell's
    boundary points coincide with its neighbours', so all faces share welded vertices (no cracks to sparkle).
    `align` = (x, z) moves the grid (inside its margins) so a hole is centred there."""
    n = 12
    gr = perf_grid(x0, x1, z0, z1, p, align)
    h, nr, nc, xs, zs = gr["h"], gr["nr"], gr["nc"], gr["xs"], gr["zs"]
    V = {}
    def vert(x, z, side):
        key = (round(x * 1e6), round(z * 1e6), side)
        v = V.get(key)
        if v is None:
            v = V[key] = mb.bm.verts.new((x, y0 if side == 0 else y1, z))
        return v
    def face(pts, side):
        vs = []
        for q in pts:
            v = vert(q[0], q[1], side)
            if not vs or vs[-1] is not v:
                vs.append(v)
        if len(vs) > 2 and vs[0] is vs[-1]:
            vs.pop()
        if len(vs) > 2:
            mb.bm.faces.new(vs if side == 0 else list(reversed(vs))).material_index = mi
    lines = {k: {round(x0, 6), round(x1, 6)} for k in range(nr + 1)}
    cells = []
    for r_ in range(nr):
        off = 0.5 * p * (r_ % 2)
        for k in range(nc):
            cx, cz = xs + off + (k + 0.5) * p, zs + (r_ + 0.5) * h
            cells.append((r_, cx, cz))
            for d in (-0.5, -0.25, 0.0, 0.25, 0.5):
                lines[r_].add(round(cx + d * p, 6))
                lines[r_ + 1].add(round(cx + d * p, 6))
    th = [2 * PI * i / n for i in range(n)]
    def proj(cx, cz, a):
        c, s = math.cos(a), math.sin(a)
        t = min(p / 2 / abs(c) if abs(c) > 1e-9 else 1e9, h / 2 / abs(s) if abs(s) > 1e-9 else 1e9)
        return (cx + t * c, cz + t * s)
    ca = math.atan2(h, p)
    corners = [(ca, 1, 1), (PI - ca, -1, 1), (PI + ca, -1, -1), (2 * PI - ca, 1, -1)]
    tg = 0.5 * p * math.tan(PI / 6)
    for side in (0, 1):
        for (r_, cx, cz) in cells:
            ring = [(cx + rad * math.cos(a), cz + rad * math.sin(a)) for a in th]
            for i in range(n):
                a0, a1 = th[i], th[i] + 2 * PI / n
                chain = [proj(cx, cz, a0)]
                chain += [(cx + sx * p / 2, cz + sz * h / 2) for (ac, sx, sz) in corners if a0 < ac < a1]
                chain.append(proj(cx, cz, a1))
                face(chain + [ring[(i + 1) % n], ring[i]], side)
        for r_ in range(nr):                          # side margins of each row, bottom and top strips
            off, za, zb = 0.5 * p * (r_ % 2), zs + r_ * h, zs + (r_ + 1) * h
            le, re, cz = xs + off, xs + off + nc * p, zs + (r_ + 0.5) * h
            bot = sorted(x for x in lines[r_] if x0 - 1e-6 <= x <= le + 1e-6)
            top = sorted((x for x in lines[r_ + 1] if x0 - 1e-6 <= x <= le + 1e-6), reverse=True)
            face([(x, za) for x in bot] + [(le, cz - tg), (le, cz), (le, cz + tg)] + [(x, zb) for x in top], side)
            bot = sorted(x for x in lines[r_] if re - 1e-6 <= x <= x1 + 1e-6)
            top = sorted((x for x in lines[r_ + 1] if re - 1e-6 <= x <= x1 + 1e-6), reverse=True)
            face([(x, za) for x in bot] + [(x, zb) for x in top] + [(re, cz + tg), (re, cz), (re, cz - tg)], side)
        face([(x0, z0), (x1, z0)] + [(x, zs) for x in sorted(lines[0], reverse=True)], side)
        face([(x, zs + nr * h) for x in sorted(lines[nr])] + [(x1, z1), (x0, z1)], side)
    for (r_, cx, cz) in cells:                        # hole walls
        f = [vert(cx + rad * math.cos(a), cz + rad * math.sin(a), 0) for a in th]
        b = [vert(cx + rad * math.cos(a), cz + rad * math.sin(a), 1) for a in th]
        for i in range(n):
            j = (i + 1) % n
            mb.bm.faces.new((f[i], f[j], b[j], b[i])).material_index = mi
    return {"n": len(cells), "xs": xs, "zs": zs, "h": h, "nr": nr, "nc": nc, "p": p}   # the grid, for a shader twin


def cam_track(cfg):
    """Both cameras' positions at every scene frame (pure), for keeping hall props clear of the path."""
    path, ft = build_path(cfg), film_table(cfg)
    out = []
    for f in range(ft[0]["a"], ft[-1]["b"] + 1):
        p = pose_at(cfg, path, f)
        out += [(p["x"], p["y"], p["z"]), portrait_of(p)]
    return out


def rod_clear(track, x, y, za, zb):
    best = 9.0
    for c in track:
        dz = max(za - c[2], 0.0, c[2] - zb)
        best = min(best, math.sqrt((c[0] - x) ** 2 + (c[1] - y) ** 2 + dz * dz))
    return best


# ------------------------------------------------------------------ compositor (scene linear, before the view transform)
COMP_NODES = ("COMP_render", "COMP_expose", "COMP_bloom", "COMP_lens", "COMP_vig_coords", "COMP_vignette",
              "COMP_black_sq", "COMP_black_add", "COMP_black", "COMP_unexpose", "COMP_out")


def black_floor_at(cfg, f):
    """The compositor's black floor at scene frame f: look.compositor.black_floor on every frame. (G2': the old
    black_floor_tail, which eased the last film's floor deeper during its tilt-up, is removed: it keyed off "the last
    film" and would hit the exit film's door view.)"""
    return float(cfg["look"]["compositor"]["black_floor"])


HAZE_FREE = ("rack-01", "rack-02", "rack-03", "rack-04")     # the hold films: no hall haze inside them (check)


def static_tails(cfg):
    """[(film, first scene frame, last scene frame)] for every film with a static_tail beat (local from..to)."""
    out = []
    for fl, row in zip(film_table(cfg), cfg["films"]):
        for bt in row.get("beats") or []:
            if bt.get("id") == "static_tail":
                out.append((fl, fl["a"] + int(bt["from"]), fl["a"] + int(bt["to"])))
    return out


def comp_tree(sc, create=False):
    """The scene's compositor: scene.compositing_node_group on 5.x, scene.node_tree with use_nodes before."""
    if hasattr(sc, "compositing_node_group"):
        if sc.compositing_node_group is None and create:
            sc.compositing_node_group = bpy.data.node_groups.new("COMP_look", "CompositorNodeTree")
        return sc.compositing_node_group
    if create:
        sc.use_nodes = True
    return getattr(sc, "node_tree", None)


def build_compositor(cfg):
    """Render -> exposure in -> Bloom -> lens distortion + dispersion -> elliptical vignette -> soft black floor
    sqrt(x^2 + c^2) -> exposure out -> output. The chain runs at the keyed view exposure (baked by bake_compositor),
    so `bloom_threshold` and `black_floor` are display-exposure linear values in every film. Deterministic: no
    image, texture, time or jitter nodes."""
    cp = cfg["look"]["compositor"]
    sc = bpy.context.scene
    if not cp.get("applied"):
        return None
    ng = comp_tree(sc, create=True)
    for n in list(ng.nodes):
        ng.nodes.remove(n)
    N, L = ng.nodes, ng.links
    def node(kind, name, x, y=0):
        n = N.new(kind)
        n.name = n.label = name
        n.location = (x, y)
        return n
    def vmath(name, kind, x, y=0):
        n = node("ShaderNodeVectorMath", name, x, y)
        n.operation = kind
        return n
    def smath(name, kind, b, x, y=0):
        n = node("ShaderNodeMath", name, x, y)
        n.operation = kind
        n.inputs[1].default_value = b
        return n
    rl = node("CompositorNodeRLayers", "COMP_render", 0)
    rl.scene = sc
    pre = node("CompositorNodeExposure", "COMP_expose", 200)
    gl = node("CompositorNodeGlare", "COMP_bloom", 400)
    for k, v in (("Type", "Bloom"), ("Quality", cp["bloom_quality"]), ("Threshold", cp["bloom_threshold"]),
                 ("Smoothness", cp["bloom_smoothness"]), ("Clamp", True), ("Maximum", cp["bloom_max"]),
                 ("Strength", cp["bloom_strength"]), ("Saturation", 1.0), ("Size", cp["bloom_size"])):
        gl.inputs[k].default_value = v
    ld = node("CompositorNodeLensdist", "COMP_lens", 600)
    for k, v in (("Type", "Radial"), ("Distortion", cp["lens_distortion"]), ("Dispersion", cp["dispersion"]),
                 ("Jitter", False), ("Fit", bool(cp["lens_fit"]))):
        ld.inputs[k].default_value = v
    ic = node("CompositorNodeImageCoordinates", "COMP_vig_coords", 600, -250)
    uv = vmath("COMP_vig_uv", "MULTIPLY_ADD", 800, -250)          # normalized 0..1 -> -1..1 on both axes
    uv.inputs[1].default_value, uv.inputs[2].default_value = (2.0, 2.0, 0.0), (-1.0, -1.0, 0.0)
    r2 = vmath("COMP_vig_r2", "DOT_PRODUCT", 1000, -250)          # ellipse fitted to the frame, corners at 2
    fall = smath("COMP_vig_fall", "MULTIPLY", 0.5, 1200, -250)
    pw = smath("COMP_vig_pow", "POWER", float(cp["vignette_power"]), 1400, -250)
    amt = smath("COMP_vig_amt", "MULTIPLY", -(1.0 - float(cp["vignette"])), 1600, -250)
    vig = smath("COMP_vig_gain", "ADD", 1.0, 1800, -250)
    mx = node("ShaderNodeMix", "COMP_vignette", 1000)
    mx.data_type, mx.blend_type = "RGBA", "MULTIPLY"
    mx.inputs[0].default_value = 1.0
    c2 = black_floor_at(cfg, sc.frame_current) ** 2
    sq = vmath("COMP_black_sq", "MULTIPLY", 1200)
    ad = vmath("COMP_black_add", "ADD", 1400)
    ad.inputs[1].default_value = (c2, c2, c2)
    rt = vmath("COMP_black", "POWER", 1600)
    rt.inputs[1].default_value = (0.5, 0.5, 0.5)
    post = node("CompositorNodeExposure", "COMP_unexpose", 1800)
    if hasattr(sc, "compositing_node_group"):
        if not any(i.item_type == "SOCKET" and i.in_out == "OUTPUT" for i in ng.interface.items_tree):
            ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        out = node("NodeGroupOutput", "COMP_out", 2000)
    else:
        out = node("CompositorNodeComposite", "COMP_out", 2000)
    L.new(rl.outputs["Image"], pre.inputs["Image"])
    L.new(pre.outputs["Image"], gl.inputs["Image"])
    L.new(gl.outputs["Image"], ld.inputs["Image"])
    L.new(ld.outputs["Image"], ic.inputs["Image"])
    L.new(ic.outputs["Normalized"], uv.inputs[0])
    L.new(uv.outputs["Vector"], r2.inputs[0])
    L.new(uv.outputs["Vector"], r2.inputs[1])
    L.new(r2.outputs["Value"], fall.inputs[0])
    L.new(fall.outputs[0], pw.inputs[0])
    L.new(pw.outputs[0], amt.inputs[0])
    L.new(amt.outputs[0], vig.inputs[0])
    L.new(ld.outputs["Image"], mx.inputs[6])
    L.new(vig.outputs[0], mx.inputs[7])
    img = mx.outputs[2]
    gd = cp.get("grad")
    if gd:                                             # a graduated filter over the top of the frame (the exit's fog
        gy = vmath("COMP_grad_y", "DOT_PRODUCT", 800, -500)   # darkening toward the night above): the image scaled by
        gy.inputs[1].default_value = (0.0, 1.0, 0.0)          # g = 1 + amt * smoothstep over the top `to` share, amt
        L.new(ic.outputs["Normalized"], gy.inputs[0])         # keyed -amount x level(f); exactly 1 while level is 0
        t_ = smath("COMP_grad_t", "MULTIPLY_ADD", 1.0 / float(gd["to"]), 1000, -500)
        t_.inputs[2].default_value, t_.use_clamp = 1.0 - 1.0 / float(gd["to"]), True
        L.new(gy.outputs["Value"], t_.inputs[0])
        s3 = smath("COMP_grad_s3", "MULTIPLY_ADD", -2.0, 1200, -500)
        s3.inputs[2].default_value = 3.0
        L.new(t_.outputs[0], s3.inputs[0])
        s2 = smath("COMP_grad_s2", "MULTIPLY", 1.0, 1400, -500)
        L.new(s3.outputs[0], s2.inputs[0]); L.new(t_.outputs[0], s2.inputs[1])
        s1 = smath("COMP_grad_s1", "MULTIPLY", 1.0, 1600, -500)
        L.new(s2.outputs[0], s1.inputs[0]); L.new(t_.outputs[0], s1.inputs[1])
        am_ = smath("COMP_grad_amt", "MULTIPLY", 0.0, 1800, -500)
        L.new(s1.outputs[0], am_.inputs[0])
        g1 = smath("COMP_grad_gain", "ADD", 1.0, 2000, -500)
        L.new(am_.outputs[0], g1.inputs[0])
        sc_ = vmath("COMP_grad", "SCALE", 1100)
        L.new(img, sc_.inputs[0]); L.new(g1.outputs[0], sc_.inputs["Scale"])
        img = sc_.outputs["Vector"]
    L.new(img, sq.inputs[0])
    L.new(img, sq.inputs[1])
    L.new(sq.outputs["Vector"], ad.inputs[0])
    L.new(ad.outputs["Vector"], rt.inputs[0])
    L.new(rt.outputs["Vector"], post.inputs["Image"])
    L.new(post.outputs["Image"], out.inputs[0])
    return ng


def bake_look(cfg, F):
    """Key the compositor's exposure pair to the view exposure, its black floor and its graduated filter (pure
    functions of the frame). The request bead's gain is keyed by key_request_gain (per camera)."""
    E = [exposure_at(cfg, f) for f in F]
    n = 0
    ng = comp_tree(bpy.context.scene)
    if ng is None or "COMP_expose" not in ng.nodes:
        return n
    n += anim_vec(ng, 'nodes["COMP_black_add"].inputs[1].default_value', F,
                  [(black_floor_at(cfg, f) ** 2,) * 3 for f in F])
    if "COMP_grad_amt" in ng.nodes:                    # the graduated filter's strength (films' `grad` keys)
        a_ = float(cfg["look"]["compositor"]["grad"]["amount"])
        n += anim(ng, 'nodes["COMP_grad_amt"].inputs[1].default_value', -1, F, [-a_ * grad_level(cfg, f) for f in F])
    return (n + anim(ng, 'nodes["COMP_expose"].inputs[1].default_value', -1, F, E)
            + anim(ng, 'nodes["COMP_unexpose"].inputs[1].default_value', -1, F, [-e for e in E]))


def request_gain_values(cfg, F, camkey, path=None, P=None):
    """Per frame: the bead's REQ_gain = 2^(request.gain_ref_ev - exposure) x the camera's fog gain (request_gains),
    and LGT_request's energy = request_light_w x fade x the same fog gain (0 while hidden). gain_ref_ev pins the
    display brightness the point had at the G2 epilogue's end (default: the exposure at the last frame)."""
    path = path or build_path(cfg)
    E = [exposure_at(cfg, f) for f in F]
    ref = float(cfg["request"].get("gain_ref_ev", E[-1]))
    lw, gv, ev = cfg["leds"]["request_light_w"], [], []
    for i, f in enumerate(F):
        s = request_state(cfg, f)
        fg = request_gains(cfg, path, f, P[i] if P else None)[camkey]
        gv.append(2.0 ** (ref - E[i]) * fg)
        ev.append(lw * s[2] * fg if s[0] else 0.0)
    return gv, ev


def key_request_gain(cfg, F, camkey, path=None, P=None):
    """Key MAT_request's REQ_gain and LGT_request's energy for one camera (bake: landscape; render swaps)."""
    gv, ev = request_gain_values(cfg, F, camkey, path, P)
    n, m = 0, bpy.data.materials.get("MAT_request")
    if m is not None and m.node_tree and "REQ_gain" in m.node_tree.nodes:
        n += anim(m.node_tree, 'nodes["REQ_gain"].inputs[1].default_value', -1, F, gv)
    return n + anim(O("LGT_request").data, "energy", -1, F, ev)


def comp_for_camera(cfg, sc, camkey):
    """Bloom size is relative to the image's larger side; scale it so the glow keeps the same share of frame
    height on every camera (bloom_size is defined on the landscape camera)."""
    ng = comp_tree(sc)
    if ng is None or "COMP_bloom" not in ng.nodes:
        return
    ref, cc = cfg["cameras"]["landscape"]["res"], cfg["cameras"][camkey]["res"]
    k = (max(ref) / ref[1]) / (max(cc) / cc[1])
    cp = cfg["look"]["compositor"]
    ng.nodes["COMP_bloom"].inputs["Size"].default_value = float(cp["bloom_size"]) * k
    # measured on 5.2.2: the Bloom glare's Size does not change the halo, so on the tall phone frame the same
    # strength spreads a brighter halo over the same share of the height; bloom_strength_portrait restores the match
    # (the reply point's halo against tower-K4's 9:19.5 crop)
    st_ = float(cp["bloom_strength"]) * (float(cp.get("bloom_strength_portrait", 1.0)) if camkey != "landscape" else 1.0)
    ng.nodes["COMP_bloom"].inputs["Strength"].default_value = st_
    if "COMP_lens" in ng.nodes:                        # the radial term is normalised to the frame, so on the tall phone
        sc_ = cp.get("lens_distortion_portrait", 1.0) if camkey != "landscape" else 1.0   # frame it bows the top edge
        ng.nodes["COMP_lens"].inputs["Distortion"].default_value = float(cp["lens_distortion"]) * sc_
        dp_ = cp.get("dispersion_portrait") if camkey != "landscape" else None             # no warm fringe on the
        ng.nodes["COMP_lens"].inputs["Dispersion"].default_value = float(cp["dispersion"] if dp_ is None else dp_)   # phone


def check_compositor(cfg, sc):
    """Issues with the look: the compositor chain and its values, colour management and render switches."""
    lk, cp, bad = cfg["look"], cfg["look"]["compositor"], []
    vs, ee, r = sc.view_settings, sc.eevee, sc.render
    if vs.view_transform != lk["view_transform"] or vs.look not in (lk["look"], lk["look"].replace("AgX - ", "")):
        bad.append(f"view {vs.view_transform}/{vs.look}")
    if r.use_motion_blur: bad.append("motion blur on")
    if not getattr(ee, "use_overscan", True): bad.append("overscan off")
    if abs(r.dither_intensity - lk["dither"]) > 1e-6: bad.append(f"dither {r.dither_intensity}")
    if lk["dof"]["enabled"] and not getattr(ee, "use_bokeh_jittered", True): bad.append("bokeh not jittered")
    ims = r.image_settings
    if (ims.file_format, ims.color_mode, ims.color_depth) != ("PNG", "RGB", "8"):
        bad.append(f"output {ims.file_format}/{ims.color_mode}/{ims.color_depth}")
    if [a for a in ("use_stamp", "use_stamp_date", "use_stamp_time", "use_stamp_render_time") if getattr(r, a, False)]:
        bad.append("stamp metadata on")
    if not cp.get("applied"):
        return bad
    ng = comp_tree(sc)
    if ng is None or not r.use_compositing:
        return bad + ["compositor missing or off"]
    missing = [n for n in COMP_NODES if n not in ng.nodes]
    if missing:
        return bad + [f"compositor nodes missing: {missing}"]
    banned = [n.name for n in ng.nodes if n.type in ("IMAGE", "TEXTURE", "TIME", "MOVIECLIP", "MASK", "TRACKPOS")
              or n.bl_idname in ("CompositorNodeImage", "CompositorNodeTexture", "CompositorNodeTime")]
    if banned: bad.append(f"non-procedural or time nodes: {banned}")
    g, l = ng.nodes["COMP_bloom"].inputs, ng.nodes["COMP_lens"].inputs
    want = [(g["Type"].default_value, "Bloom"), (round(g["Threshold"].default_value, 4), round(cp["bloom_threshold"], 4)),
            (round(g["Size"].default_value, 4), round(cp["bloom_size"], 4)),
            (round(l["Distortion"].default_value, 5), round(cp["lens_distortion"], 5)),
            (round(l["Dispersion"].default_value, 5), round(cp["dispersion"], 5)), (l["Jitter"].default_value, False),
            (round(ng.nodes["COMP_vig_amt"].inputs[1].default_value, 4), round(cp["vignette"] - 1.0, 4)),
            (round(ng.nodes["COMP_black_add"].inputs[1].default_value[0] ** 0.5, 5),
             round(black_floor_at(cfg, sc.frame_current), 5))]
    bad += [f"compositor value {a!r} != {b!r}" for a, b in want if a != b]
    seen, todo = set(), [ng.nodes["COMP_out"]]                       # the output must reach the render through every stage
    while todo:
        n = todo.pop()
        seen.add(n.name)
        todo += [lk_.from_node for s in n.inputs for lk_ in s.links if lk_.from_node.name not in seen]
    unreached = [n for n in COMP_NODES if n not in seen]
    if unreached: bad.append(f"compositor stages not on the path to the output: {unreached}")
    return bad


# ------------------------------------------------------------------ hall
def bg_cabinet(cfg, M, name, kd, seed_name):
    """One background cabinet kind (a collection instanced along the rows): body with dark seams to its
    neighbours, a framed front door (perforated field, swing handle, hinges), split rear doors, a roof with a
    cable-entry brush strip (or fans), a recessed plinth and faint static standby lights seen through the door.
    kd: h, handle (swing|lever), top (grommet|fans|plain), ajar_deg, perf (real holes), equipment, led_x."""
    hl = cfg["hall"]
    cw, cd = hl["cabinet"][0], hl["cabinet"][1]
    ch, hw = kd.get("h", hl["cabinet"][2]), hl["cabinet"][0] / 2
    coll = bpy.data.collections.new(name)
    coll.use_fake_user = True
    r = rng(cfg, seed_name)
    mats = [M["rack"], M["bg_door"], M["dark"], M["post"], M["bezel"], M["roof"], M["velcro"], M.get("rack_worn", M["rack"])]
    mb = MB()
    # body, 3 mm seam to its neighbour; its top stops 0.5 mm under the roof (a separate instancer): coplanar hidden
    # faces in two instancers tie in the depth test differently from run to run (1-level noise, not bit-exact)
    tb = cfg["hall"].get("roof_band", 0.0)          # G2' R4: the top band (body, door rails) is part of the roof mesh
    mb.box(-hw + 0.0015, hw - 0.0015, 0.0, cd, 0.1, ch - 0.0065 - tb - (0.0005 if tb else 0.0), 0)
    # the roof is its own collection (instanced beside the body), so the hall's fixtures can be flagged off it
    # (light linking works per instancer): one pressed panel inside a 30 mm rim, bevelled, four lifting eyebolts;
    # open where the cables enter (a raised collar round a dark brush) on cabinets that take drops from the tray
    rcoll = bpy.data.collections.new(name.replace("BG_cabinet_", "BG_roof_"))
    rcoll.use_fake_user = True
    rm = MB()
    for s in (-1, 1):                                                                # roof rim
        rm.box(s * (hw - 0.0015), s * (hw - 0.03), 0.0, cd, ch - 0.006, ch, 5)
    rm.box(-hw + 0.03, hw - 0.03, 0.0, 0.03, ch - 0.006, ch, 5)
    rm.box(-hw + 0.03, hw - 0.03, cd - 0.03, cd, ch - 0.006, ch, 5)
    rm.bevel(0, 0.002, 1)
    zr, grom = ch - 0.003, kd.get("top", "grommet") == "grommet"
    ox0, ox1, oy0, oy1 = -0.13, 0.13, cd - 0.32, cd - 0.24
    k_ = rm.mark()
    if grom:
        for (xa, xb, ya, yb) in ((-hw + 0.03, hw - 0.03, 0.03, oy0), (-hw + 0.03, hw - 0.03, oy1, cd - 0.03),
                                 (-hw + 0.03, ox0, oy0, oy1), (ox1, hw - 0.03, oy0, oy1)):
            rm.box(xa, xb, ya, yb, ch - 0.006, zr, 5)
    else:
        rm.box(-hw + 0.03, hw - 0.03, 0.03, cd - 0.03, ch - 0.006, zr, 5)
    rm.bevel(k_, 0.0012, 1)
    if grom:
        rm.box(ox0, ox1, oy0, oy1, ch - 0.03, ch - 0.028, 2)                         # the dark cavity under it
        t = 0.006
        for (xa, xb, ya, yb) in ((ox0 - t, ox1 + t, oy0 - t, oy0), (ox0 - t, ox1 + t, oy1, oy1 + t),
                                 (ox0 - t, ox0, oy0, oy1), (ox1, ox1 + t, oy0, oy1)):
            rm.box(xa, xb, ya, yb, zr, zr + 0.012, 4)                                # raised collar, 12 mm
        for (ya, yb) in ((oy0, (oy0 + oy1) / 2 - 0.0008), ((oy0 + oy1) / 2 + 0.0008, oy1)):
            rm.box(ox0, ox1, ya, yb, zr - 0.004, zr + 0.007, 6)                      # two brush rows meeting
    for x in (-hw + 0.06, hw - 0.06):                                                # lifting eyebolts
        for y in (0.06, cd - 0.06):
            rm.cyl(x, y, ch, ch + 0.006, 0.0085, 12, 3)
            rm.tube_ax("x", x - 0.0025, x + 0.0025, y, ch + 0.019, 0.0075, 0.0115, 16, 3)
    if kd.get("top") == "fans":
        for y in (0.42, 0.78):
            rm.cyl(0.0, y, ch - 0.003, ch + 0.012, 0.07, 24, 2)
            rm.cyl(0.0, y, ch + 0.012, ch + 0.0135, 0.022, 12, 4)
    if tb:                                       # (light-linked like the roof: the aisle fixtures and the bay strip
        rm.box(-hw + 0.0015, hw - 0.0015, 0.0, cd, ch - 0.0065 - tb, ch - 0.0065, 0)   # skip it, so neighbours' height
    mb.box(-hw + 0.012, hw - 0.012, 0.014, cd - 0.014, 0.0, 0.1, 2)                 # steps and door tops stay dark)
    for x in (-hw + 0.03, hw - 0.03):
        for y in (0.03, cd - 0.03):
            mb.cyl(x, y, 0.0, 0.012, 0.014, 10, 3)
    if kd.get("equipment"):                                                          # gear behind a see-through door
        z = 0.15
        while z < ch - 0.12:
            k = r.choice((1, 1, 2, 2, 4))
            hh = k * 0.04445 - 0.001
            mb.box(-0.24, 0.24, -0.004, 0.0, z, z + hh, 4 if r.random() < 0.7 else 2)
            z += k * 0.04445
    yf, st, zb, zt = -0.022, 0.042, 0.1, ch - 0.012                                  # front door
    k0, rk0 = mb.mark(), rm.mark()
    zs_ = zt - 0.06 if tb else zt                                                    # stiles stop under the top band
    wm = 7 if kd.get("solid") and kd.get("worn") else 0                              # the lever stile and panel: worn
    mb.box(-hw + 0.002, -hw + 0.002 + st, yf, yf + 0.016, zb, zs_, 0)
    mb.box(hw - 0.002 - st, hw - 0.002, yf, yf + 0.016, zb, zs_, wm)
    if tb:                                                                           # the door's top band: roof mesh
        rm.box(-hw + 0.002, hw - 0.002, yf, yf + 0.016, zt - 0.06, zt, 0)
    else:
        mb.box(-hw + 0.002 + st, hw - 0.002 - st, yf, yf + 0.016, zt - 0.06, zt, 0)
    mb.box(-hw + 0.002 + st, hw - 0.002 - st, yf, yf + 0.016, zb, zb + 0.08, 0)
    fx0, fx1, fz0, fz1 = -hw + 0.002 + st - 0.008, hw - 0.002 - st + 0.008, zb + 0.072, zt - 0.052
    if kd.get("perf"):
        perf_sheet(mb, fx0, fx1, fz0, fz1, yf + 0.006, yf + 0.0075, cfg["rack"]["door"]["hole_mm"] / 2000.0,
                   cfg["rack"]["door"]["pitch_mm"] / 1000.0, 0)
    elif kd.get("solid"):                                                            # a plain steel door, vented at the top
        vb = kd.get("vent_band", 0.16)
        mb.box(fx0, fx1, yf + 0.006, yf + 0.0075, fz0, fz1 - vb, wm)
        if kd.get("seam_z"):                                                         # G2' R3: one pressed seam across
            sz, xa, xb = kd["seam_z"], fx0 + 0.012, fx1 - 0.012                      # (a lip that catches the light,
            mb.box(xa, xb, yf + 0.0052, yf + 0.006, sz - 0.006, sz - 0.0012, wm)     # a dark fold, a softer upper lip)
            mb.box(xa, xb, yf + 0.0057, yf + 0.006, sz - 0.0012, sz + 0.0012, 2)
            mb.box(xa, xb, yf + 0.0055, yf + 0.006, sz + 0.0012, sz + 0.004, wm)
        if kd.get("kick_h"):                                                         # a satin kick plate, four screws
            ka, kb_, kz0, kz1 = fx0 + 0.006, fx1 - 0.006, fz0 + 0.004, fz0 + kd["kick_h"]
            mb.box(ka, kb_, yf + 0.005, yf + 0.006, kz0, kz1, 4)
            for x_ in (ka + 0.012, kb_ - 0.012):
                for z_ in (kz0 + 0.012, kz1 - 0.012):
                    mb.cyl_y(x_, z_, yf + 0.0042, yf + 0.005, 0.0028, 10, 2)
        mb.box(fx0, fx1, yf + 0.0075, yf + 0.008, fz1 - vb, fz1, 2)                 # dark behind the louvres
        zz = fz1 - vb + 0.012
        while zz < fz1 - 0.01:                                                       # pressed louvres, 9 mm apart
            mb.box(fx0 + 0.02, fx1 - 0.02, yf + 0.005, yf + 0.0075, zz, zz + 0.0045, 0)
            zz += 0.009
        mb.box(fx0, fx1, yf + 0.006, yf + 0.0075, fz1 - vb, fz1 - vb + 0.01, 0)
        mb.box(fx0, fx0 + 0.02, yf + 0.006, yf + 0.0075, fz1 - vb, fz1, 0)
        mb.box(fx1 - 0.02, fx1, yf + 0.006, yf + 0.0075, fz1 - vb, fz1, 0)
    else:
        mb.box(fx0, fx1, yf + 0.006, yf + 0.0075, fz0, fz1, 1)
    hx = hw - 0.002 - st / 2
    if kd.get("handle", "swing") == "swing":
        mb.box(hx - 0.013, hx + 0.013, yf - 0.004, yf, 0.97, 1.19, 2)
        mb.box(hx - 0.007, hx + 0.007, yf - 0.019, yf - 0.004, 1.0, 1.15, 2)
        mb.cyl_y(hx, 1.17, yf - 0.007, yf - 0.004, 0.0055, 12, 3)
    else:
        mb.box(hx - 0.011, hx + 0.011, yf - 0.003, yf, 1.02, 1.12, 2)
        mb.box(hx - 0.006, hx + 0.006, yf - 0.024, yf - 0.003, 1.035, 1.05, 3)
        mb.box(hx - 0.006, hx + 0.006, yf - 0.024, yf - 0.016, 1.05, 1.11, 3)
        if kd.get("lock_z"):                                                         # G2' R3: cylinder lock above the
            lz = kd["lock_z"]                                                        # lever: escutcheon ring, the
            mb.cyl_y(hx, lz, yf - 0.004, yf, 0.0115, 20, 3)                          # plug's face, a keyway slot
            mb.cyl_y(hx, lz, yf - 0.0048, yf - 0.004, 0.0078, 20, 4)
            mb.box(hx - 0.0009, hx + 0.0009, yf - 0.0051, yf - 0.0048, lz - 0.0045, lz + 0.0025, 2)
    for z in (0.32, zt - 0.32):
        mb.cyl(-hw + 0.004, yf + 0.006, z - 0.04, z + 0.04, 0.0055, 10, 2)
    if kd.get("ajar_deg"):
        mb.rotate_z(k0, -math.radians(kd["ajar_deg"]), (-hw + 0.004, yf + 0.006, 0.0))
        rm.rotate_z(rk0, -math.radians(kd["ajar_deg"]), (-hw + 0.004, yf + 0.006, 0.0))
    yr = cd + 0.004                                                                  # split rear doors
    for s in (-1, 1):
        a, b = (-hw + 0.002, -0.001) if s < 0 else (0.001, hw - 0.002)
        mb.box(a, b, yr, yr + 0.014, zb, zb + 0.06, 0)
        (rm if tb else mb).box(a, b, yr, yr + 0.014, zt - 0.05, zt, 0)
        mb.box(a, a + 0.03, yr, yr + 0.014, zb, zt - 0.05 if tb else zt, 0)
        mb.box(b - 0.03, b, yr, yr + 0.014, zb, zt - 0.05 if tb else zt, 0)
        mb.box(a + 0.024, b - 0.024, yr + 0.006, yr + 0.0075, zb + 0.054, zt - 0.044, 1)
        hx = -0.018 if s < 0 else 0.018
        mb.box(hx - 0.007, hx + 0.007, yr + 0.014, yr + 0.028, 0.98, 1.12, 2)
    rm.obj(f"{rcoll.name}_top", mats, rcoll)
    mb.obj(f"{name}_body", mats, coll)
    bl, U = hl["bg_leds"], cfg["rack"]["U"]                                          # faint static standby lights
    lm, z = MB(), bl["z"][0]
    ly = (yf + 0.0055) if not kd.get("ajar_deg") else 0.0 - 0.0045
    if kd.get("equipment"):
        ly = -0.0045
    xs = kd.get("led_x", [bl["x"]])
    gq = bl.get("quad", 2.5)                                 # glow quad: this many times the lens, gaussian inside
    while xs and z < min(bl["z"][1], ch - 0.1):              # per device: a small cluster of 1-3 lights, uneven
        h = 2 if r.random() < bl["p2u"] else 1
        if r.random() >= bl["skip"]:
            zl = z + h * U - 0.012
            x = xs[r.randrange(len(xs))]
            for j in range(r.choice(bl.get("cluster", [1]))):
                xj = x + j * r.choice((0.009, 0.011, -0.01)) + r.uniform(-0.004, 0.004)
                zj = zl + r.uniform(-0.002, 0.002)
                a, b = r.uniform(0.0014, 0.0026), r.uniform(0.001, 0.0018)      # lens size: +-30 % in brightness
                s_, yq = gq * max(a, b), ly - 0.0002 * (j + 1)                   # each quad its own depth: no z-fight
                lm.quad([(xj - s_, yq, zj - s_), (xj + s_, yq, zj - s_), (xj + s_, yq, zj + s_), (xj - s_, yq, zj + s_)])
        z += h * U
    if lm.bm.verts:
        uvl = lm.bm.loops.layers.uv.new("UVMap")
        for fc in lm.bm.faces:
            for lp, uv in zip(fc.loops, ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
                lp[uvl].uv = uv
        lm.obj(f"{name}_leds", [M["led_glow"]], coll)
    else:
        lm.bm.free()
    return coll, rcoll


def build_hall(cfg, M, C):
    hl, T, rk = cfg["hall"], cfg["hall"]["trays"], cfg["rack"]
    x0, x1, y0, y1 = hl["floor"]
    tl = hl["tile"]                                  # raised floor on the 0.6 m grid, open where the vent tiles sit
    vents = [tuple(v) for v in hl["vent_tiles"]]    # (a centre test: round() on .5 grid indices is banker's rounding)
    xe = sorted({x0, x1} | {tl / 2 + tl * k for k in range(math.ceil((x0 - tl / 2) / tl), math.floor((x1 - tl / 2) / tl) + 1)})
    ye = sorted({y0, y1} | {tl * k for k in range(math.ceil(y0 / tl), math.floor(y1 / tl) + 1)})
    mb = MB()
    for xa, xb in zip(xe, xe[1:]):
        for ya, yb in zip(ye, ye[1:]):
            if not any(xa < cx < xb and ya < cy < yb for cx, cy in vents):
                mb.quad([(xa, ya, 0), (xb, ya, 0), (xb, yb, 0), (xa, yb, 0)])
    mb.obj("ENV_floor", [M["floor"]], C["hall"])
    t = tl / 2 - 0.004
    for i, (cx, cy) in enumerate(hl["vent_tiles"]):  # perforated tiles (holes >= 14 mm) over a dark plenum
        mb = MB()
        perf_sheet(mb, cx - t, cx + t, cy - t, cy + t, -0.0008, 0.0007, hl["vent_hole_mm"] / 2000.0, hl["vent_pitch_mm"] / 1000.0, 0)
        bmesh.ops.rotate(mb.bm, verts=mb.since(0), cent=(0.0, 0.0, 0.0), matrix=Matrix.Rotation(-PI / 2, 3, "X"))
        for (xa, xb, ya, yb) in ((cx - tl / 2, cx + tl / 2, cy - tl / 2, cy - t), (cx - tl / 2, cx + tl / 2, cy + t, cy + tl / 2),
                                 (cx - tl / 2, cx - t, cy - t, cy + t), (cx + t, cx + tl / 2, cy - t, cy + t)):
            mb.box(xa, xb, ya, yb, -0.004, 0.0, 1)       # the stringer seam round the tile
        mb.box(cx - tl / 2, cx + tl / 2, cy - tl / 2, cy + tl / 2, -0.32, -0.3, 1)
        for (xa, xb, ya, yb) in ((cx - tl / 2, cx + tl / 2, cy - tl / 2, cy - tl / 2 + 0.01), (cx - tl / 2, cx + tl / 2, cy + tl / 2 - 0.01, cy + tl / 2),
                                 (cx - tl / 2, cx - tl / 2 + 0.01, cy - tl / 2, cy + tl / 2), (cx + tl / 2 - 0.01, cx + tl / 2, cy - tl / 2, cy + tl / 2)):
            mb.box(xa, xb, ya, yb, -0.3, -0.004, 1)
        mb.obj(f"ENV_vent_tile_{i + 1}", [M["vent"], M["dark"]], C["hall"])
    # ENV_ceiling / MAT_ceiling are built with the wash fixtures in build_lights_cams (lights.wash.ceiling): the
    # area wash hangs below it, so it may cast shadows; the hanger rods end on its underside at trays.ceiling_z.
    M.setdefault("velcro", mat_p("MAT_velcro", (0.012, 0.012, 0.013), 0.95, 0.0, 1.0, 0.2)[0])
    M.setdefault("cable_grey", mat_p("MAT_cable_grey", (0.04, 0.041, 0.043), 0.6, 0.0, 1.0, 0.35)[0])
    kinds = {k: bg_cabinet(cfg, M, f"BG_cabinet_{k}", kd, f"bg_leds_{k}") for k, kd in hl["bg_kinds"].items()}
    cw, cd, ch = hl["cabinet"]
    pick = rng(cfg, "bg_pick")
    placed = []
    roofs = {}                                   # roofs as real meshes, one per row: a second instancer per cabinet
    def inst(name, kind, loc, rz):               # made EEVEE's hero frames differ by 1 level from run to run
        o = bpy.data.objects.new(name, None)
        o.instance_type = "COLLECTION"
        o.instance_collection = kinds[kind][0]
        o.location, o.rotation_euler = loc, (0.0, 0.0, rz)
        C["hall"].objects.link(o)
        row_ = name[len("ENV_row_"):].rsplit("_", 1)[0] if name.startswith("ENV_row_") else name[len("ENV_"):]
        me_ = kinds[kind][1].objects[0].data
        cz_, sz_ = math.cos(rz), math.sin(rz)
        V, Fs, Mi = roofs.setdefault(f"ENV_roof_{row_}", ([], [], []))
        b0 = len(V)
        V += [(loc[0] + v.co.x * cz_ - v.co.y * sz_, loc[1] + v.co.x * sz_ + v.co.y * cz_, loc[2] + v.co.z) for v in me_.vertices]
        Fs += [tuple(b0 + i for i in pg.vertices) for pg in me_.polygons]
        Mi += [pg.material_index for pg in me_.polygons]
        placed.append((name, kind, loc, rz))
    aw = hl["aisle_width"] / 2
    ajar = hl.get("ajar")
    for row in hl["rows"]:                     # [name, front x, facing (+1 = +x), count, y of the first front edge, kinds]
        nm, fx, fc, cnt, ys, pool = row
        rz = PI / 2 if fc > 0 else -PI / 2
        for k in range(cnt):
            kind = pool[pick.randrange(len(pool))]
            if ajar and ajar[0] == nm and ajar[1] == k:
                kind = ajar[2]
            inst(f"ENV_row_{nm}_{k:02d}", kind, (fx, ys - cw / 2 - cw * k, 0.0), rz)
    inst("ENV_end_L", hl["end_kinds"][0], (-cw, rk["front_y"], 0.0), 0.0)
    inst("ENV_end_R", hl["end_kinds"][1], (cw, rk["front_y"], 0.0), 0.0)
    rmats = kinds[next(iter(kinds))][1].objects[0].data.materials
    for nm_, (V, Fs, Mi) in sorted(roofs.items()):
        me_ = bpy.data.meshes.new(nm_)
        me_.from_pydata(V, [], Fs)
        me_.polygons.foreach_set("material_index", Mi)
        for m_ in rmats:
            me_.materials.append(m_)
        me_.update()
        ro_ = bpy.data.objects.new(nm_, me_)
        C["hall"].objects.link(ro_)
    track = cam_track(cfg)
    zc = T["z"] + 0.012                         # rung top
    def tray(name, axis, fixed, a0, a1, hangers=True, pitch=2.4):
        """Ladder tray: C-channel side rails, U-channel rungs, trapeze hangers on threaded rods (each rod its
        own object, spaced a little unevenly and kept clear of both cameras)."""
        mb = MB(); w, z, rh = T["width"] / 2, T["z"], T["rail_h"]
        def B(al0, al1, ac0, ac1, z0_, z1_, mi):
            if axis == "y":
                mb.box(ac0, ac1, al0, al1, z0_, z1_, mi)
            else:
                mb.box(al0, al1, ac0, ac1, z0_, z1_, mi)
        for s in (-1, 1):
            o = fixed + s * w
            B(a0, a1, o - 0.001, o + 0.001, z, z + rh, 0)                             # web
            B(a0, a1, min(o, o - s * 0.014), max(o, o - s * 0.014), z + rh - 0.002, z + rh, 0)   # top lip
            B(a0, a1, min(o, o - s * 0.022), max(o, o - s * 0.022), z, z + 0.002, 0)  # bottom lip
        for k in range(int((a1 - a0) / T["rung_pitch"]) + 1):
            a = a0 + k * T["rung_pitch"]
            B(a - 0.0125, a + 0.0125, fixed - w, fixed + w, z, z + 0.0015, 0)
            for e in (-1, 1):
                B(a + e * 0.0125 - 0.0008, a + e * 0.0125 + 0.0008, fixed - w, fixed + w, z, z + 0.012, 0)
        rods = []
        if hangers:
            rj = rng(cfg, f"hangers_{name}")
            a = a0 + 0.9 + rj.uniform(-0.3, 0.3)
            while a < a1 - 0.3:
                for tryk in range(8):            # a rod the camera would pass within 20 cm of is dropped: that
                    ok = [rod_clear(track, *((fixed + s * (w + 0.026), a) if axis == "y" else (a, fixed + s * (w + 0.026))),
                                    z - 0.06, T["ceiling_z"]) > 0.2 for s in (-1, 1)]
                    if any(ok):                  # hanger becomes a cantilever arm on a strut post
                        break
                    a += 0.17
                B(a - 0.0205, a + 0.0205, fixed - w - 0.06, fixed + w + 0.06, z - 0.041, z, 1)   # strut trapeze
                for s, keep in zip((-1, 1), ok):
                    if not keep:
                        continue
                    x_, y_ = (fixed + s * (w + 0.026), a) if axis == "y" else (a, fixed + s * (w + 0.026))
                    rods.append((x_, y_, all(ok)))
                    B(a - 0.009, a + 0.009, fixed + s * (w + 0.026) - 0.009, fixed + s * (w + 0.026) + 0.009,
                      z - 0.05, z - 0.041, 1)
                a += pitch + rj.uniform(-0.35, 0.35)
        mb.obj(name, [M["tray"], M["post"]], C["hall"])
        for i, (x_, y_, pair) in enumerate(rods):
            rm = MB()
            if pair:                                     # threaded rod
                rm.cyl(x_, y_, z - 0.06, T["ceiling_z"], 0.005, 8, 0)
            else:                                        # strut post carrying a cantilever arm
                rm.box(x_ - 0.0205, x_ + 0.0205, y_ - 0.0205, y_ + 0.0205, z - 0.06, T["ceiling_z"], 0)
            rm.box(x_ - 0.03, x_ + 0.03, y_ - 0.03, y_ + 0.03, T["ceiling_z"] - 0.006, T["ceiling_z"], 0)
            rm.obj(f"{name}_rod_{i + 1:02d}", [M["rod"]], C["hall"])
    ty0, ty1 = T["y"]
    for nm, x, a0, a1 in T["runs"]:
        tray(f"ENV_tray_{nm}", "y", x, a0, a1, pitch=T["hanger_pitch"])
    tray("ENV_tray_X", "x", T["cross_y"], T["rows_x"][0] - 0.15, T["rows_x"][1] + 0.15, pitch=T["cross_hanger_pitch"])
    # --- bundles: strapped about every 0.25 m by hand (seeded pitch, a few straps missing by config), resting on
    # the rungs, sagging between them by different amounts
    bm_ = {k: MB() for k in ["L", "R", "X"] + [t_[0] for t_ in T["runs"] if t_[0] not in ("L", "R")]}
    sp, rung0, rx0 = T["rung_pitch"], ty0, T["rows_x"][0] - 0.15
    gm = hl.get("strap_missing", [])
    gone = {tuple(g) for g in (gm if gm and isinstance(gm[0], list) else [gm] if gm else [])}
    st_p, st_j = T.get("strap_pitch", [0.25, 0.0])
    def straps(tag, P, phase):
        rs = rng(cfg, f"straps_{tag}")
        L, out, k, x = arclen(P)[-1], [], 0, phase
        while x < L - 0.05:
            if (tag, k) not in gone:
                out.append(x)
            k += 1
            x += st_p + rs.uniform(-st_j, st_j)
        return out
    def sag(P, z_rest, amount, axis, r0):
        out = []
        for p in P:
            u = (((p[1] if axis == "y" else p[0]) - r0) / sp) % 1.0
            out.append((p[0], p[1], p[2] - amount * 4 * u * (1 - u) if abs(p[2] - z_rest) < 1e-4 else p[2]))
        return out
    gx, gy, gw, gd = rk["grommet"]
    for side, sx, xt in (("R", 1, T["rows_x"][1]), ("L", -1, T["rows_x"][0])):
        endx = iter(T["end_drop_x"])
        for j, b in enumerate(T["bundles"]):
            dx, dz, R, n_out, r, mat, dest, lane = b
            if dest == "request" and side == "L":
                continue
            rr = rng(cfg, f"bundle_{side}{j}")
            wn = wander(rr, 48)
            if side == "L":                            # the left tray is not the right one mirrored
                n_out, R = max(5, n_out + rr.choice((-3, -2, 2, 3))), R * rr.uniform(0.85, 1.12)
            x = cfg["request"]["path_in"][0][0] if dest == "request" else xt + sx * dx
            yc, zr, zx = T["cross_y"] + lane, zc + dz + R, zc + R
            run = [(x + (0.0 if dest == "request" else 0.006 * wn(yy / 1.3)), yy, zr)
                   for yy in [ty0 + 0.2 + k * sp / 2 for k in range(int((0.25 - ty0) / (sp / 2)) + 1)]]
            sg0, sg1 = T.get("sag", [0.003, 0.005])
            run = sag(run, zr, 0.0 if dest == "request" else sg0 + (sg1 - sg0) * rr.random(), "y", rung0)
            if dest in T["grommet_drop_x"]:
                xd = sx * T["grommet_drop_x"][dest]
                tgt = [(xd, gy + 0.6 * (yc - gy), 2.45), (xd, gy + 0.006 * sx, rk["height"] + 0.02), (xd, gy, rk["height"] - 0.17)]
            else:
                xd, ey = sx * next(endx), 0.92 + rr.uniform(-0.02, 0.02)
                tgt = [(xd, lerp(yc, ey, 0.5), 2.35), (xd, ey, ch + 0.02), (xd, ey, ch - 0.12)]
            turn = fillet([run[-1], (x, yc, zx), (xd + sx * 0.09, yc, zx), (xd + sx * 0.015, yc, zx - 0.07)] + tgt, 0.12, 0.05)
            turn = sag(turn, zx, 0.003, "x", rx0)
            P = run + turn[1:]
            bundle((bm_[side], bm_["X"]), P, R, n_out, r, (3 if mat else 0, 1, 2), rr,
                   straps(f"{side}{j}", P, rr.uniform(0, 0.25)), 6, cut=len(run) - 1)
    for nm, x, a0, a1 in T["runs"]:                    # trays over the far rows: plain bundles, no straps
        if nm in ("L", "R"):
            continue
        rr = rng(cfg, f"far_{nm}")
        for dx, R in ((-0.075, 0.03), (0.0, 0.026), (0.075, 0.03)):
            if rr.random() < 0.25:
                continue
            wn = wander(rr, 48)
            P = [(x + dx + 0.008 * wn(yy / 1.3), yy, zc + R) for yy in [a0 + 0.2 + k * sp / 2 for k in range(int((a1 - a0 - 0.4) / (sp / 2)))]]
            bm_[nm].tube(sag(P, zc + R, 0.004, "y", a0), R, 10, 3 if rr.random() < 0.3 else 0)
    for k, mb in bm_.items():
        if mb.bm.verts:
            mb.obj(f"ENV_bundles_{k}", [M["cable"], M["dark"], M["velcro"], M["cable_grey"]], C["hall"])
        else:
            mb.bm.free()
    # --- drops from the trays through the roof brush strips into the row cabinets (seeded catenaries)
    rd, drops = rng(cfg, "row_drops"), {}
    for (name, kind, loc, rz) in placed:
        row = name[len("ENV_row_"):].rsplit("_", 1)[0] if name.startswith("ENV_row_") else None
        run = next((t_ for t_ in T["runs"] if t_[0] == row), None)
        if run is None or hl["bg_kinds"][kind].get("top", "grommet") != "grommet":
            continue
        mbd, top = drops.setdefault(row, MB()), hl["bg_kinds"][kind].get("h", ch)
        for d in range(1 if rd.random() < 0.55 else 2):
            X, Y = rd.uniform(-0.1, 0.1), cd - 0.28
            gxw, gyw = loc[0] + X * math.cos(rz) - Y * math.sin(rz), loc[1] + X * math.sin(rz) + Y * math.cos(rz)
            yy = run[2] + sp * (math.floor((gyw - run[2]) / sp) + 0.5)
            xa, R = run[1] + rd.uniform(-0.09, 0.09), rd.uniform(0.009, 0.016)
            P = fillet([(xa, yy, zc + 0.02), (xa, yy, zc - 0.06),
                        (lerp(xa, gxw, 0.5) + rd.uniform(-0.04, 0.04), lerp(yy, gyw, 0.5), lerp(zc, top, 0.55)),
                        (gxw, gyw, top + 0.04), (gxw, gyw, top - 0.1)], 0.1, 0.05)
            if row in ("L", "R"):
                bundle((mbd,), P, R, 7, R * 0.3, (0, 1, 2), rd, straps(f"d{name}{d}", P, rd.uniform(0.05, 0.2)), 6)
            else:
                mbd.tube(P, R, 8, 0)
    for row, mbd in drops.items():
        mbd.obj(f"ENV_drops_{row}", [M["cable"], M["dark"], M["velcro"]], C["hall"])
    rq = cfg["request"]
    cable("ENV_cable_request", fillet([(p[0], p[1], p[2] - rq["radius"] - 0.006) for p in rq["path_in"]], 0.04, 0.08),
          0.006, M["cable"], C["hall"])          # dense points: the trunk hugs the point's polyline (no arching)
    ro = rq.get("riser_offset", [0.02, 0.0])          # behind the point (+y): its lit length hides behind the bead
    rx, ry = rq["path_out"][0][0] + ro[0], rq["path_out"][0][1] + ro[1]
    cable("ENV_fibre_riser", [(rx, ry, zc + 0.03), (rx, ry, (zc + rq["riser_top"]) / 2), (rx, ry, rq["riser_top"])],
          0.004, M.get("riser") or M["cable"], C["hall"])
    if M.get("riser_fade"):                           # the same riser fading out with height (swapped in by bake)
        o = cable("ENV_fibre_riser_fade", [(rx, ry, zc + 0.03), (rx, ry, (zc + rq["riser_top"]) / 2),
                                           (rx, ry, rq["riser_top"])], 0.004, M["riser_fade"], C["hall"])
        o.hide_render = o.hide_viewport = True
    wl = hl.get("walls")                              # the room: painted walls where the floor and ceiling end, each
    if wl:                                            # its own object (camera clearance is checked per AABB)
        cz, t = cfg["lights"]["wash"]["ceiling_z"], 0.1
        for nm, on, wall, skirt in (
                ("end", wl.get("end", True), (x0 - t, x1 + t, y1, y1 + t), (x0, x1, y1 - 0.012, y1)),
                ("front", wl.get("front", True), (x0 - t, x1 + t, y0 - t, y0), (x0, x1, y0, y0 + 0.012)),
                ("L", wl.get("sides", True), (x0 - t, x0, y0, y1), (x0, x0 + 0.012, y0, y1)),
                ("R", wl.get("sides", True), (x1, x1 + t, y0, y1), (x1 - 0.012, x1, y0, y1))):
            if not on:
                continue
            mb = MB()
            mb.box(*wall, 0.0, cz + 0.06, 0)
            mb.box(*skirt, 0.0, 0.1, 1)                # a dark rubber skirting along its foot
            mb.obj(f"ENV_wall_{nm}", [M["wall"], M["dark"]], C["hall"])
    sv = hl.get("services")                           # ceiling services: a sprinkler main and strut runs, high up
    if sv:
        mb = MB()
        sx_, sz_, sr_ = sv["sprinkler"]
        mb.tube_ax("y", y0, y1, sx_, sz_, 0.0, sr_, 16, 0)
        yy = y0 + 1.7
        while yy < y1 - 0.5:                          # pipe hangers to the slab
            mb.box(sx_ - 0.004, sx_ + 0.004, yy - 0.004, yy + 0.004, sz_ + sr_, T["ceiling_z"], 1)
            mb.tube_ax("y", yy - 0.02, yy + 0.02, sx_, sz_, sr_, sr_ + 0.004, 16, 1)
            yy += 3.4
        for (xs_, zs_) in sv["struts"]:               # 41 mm strut channel, open side down
            for (xa, xb, za, zb) in ((xs_ - 0.0205, xs_ + 0.0205, zs_ + 0.0385, zs_ + 0.041),
                                     (xs_ - 0.0205, xs_ - 0.018, zs_, zs_ + 0.041), (xs_ + 0.018, xs_ + 0.0205, zs_, zs_ + 0.041)):
                mb.box(xa, xb, y0, y1, za, zb, 1)
            yy = y0 + 1.2
            while yy < y1 - 0.5:
                mb.box(xs_ - 0.005, xs_ + 0.005, yy - 0.005, yy + 0.005, zs_ + 0.041, T["ceiling_z"], 1)
                yy += 2.4
        mb.obj("ENV_services", [M["rod"], M["post"]], C["hall"])
    mb = MB(); mb.box(*hl["haze_box"])
    o = mb.obj("VOL_haze", [M["haze"]], C["hall"])
    o.display_type = "BOUNDS"
    o.color = (1.0, 1.0, 1.0, 1.0)
    if M.get("upper") and hl.get("upper_box"):       # the exit's ceiling fog (level keyed on color alpha; hidden at 0)
        mb = MB(); mb.box(*hl["upper_box"])
        o = mb.obj("VOL_upper", [M["upper"]], C["hall"])
        o.display_type = "BOUNDS"
        o.color = (1.0, 1.0, 1.0, 0.0)
        o.hide_render = o.hide_viewport = True


# ------------------------------------------------------------------ hero rack
def build_rack(cfg, M, C):
    """The end rack: bevelled frame, cage-hole rails, side panels, a top with a real ingress opening and rubber
    trim, a recessed plinth on levelling feet, vertical cable managers, and the front door: a framed, really
    perforated sheet (holes >= 14 mm) with a swing handle, hinged on the left (RIG_door)."""
    rk = cfg["rack"]
    W, D, top, pf, H, pl = rk["width"] / 2, rk["depth"], rk["top_z"], rk["post_front_y"], rk["height"], rk["plinth"]
    bv, U = rk.get("bevel_m", 0.0018), rk["U"]
    gx, gy, gw, gd = rk["grommet"]
    mb = MB()
    for xa, xb in ((-W, -W + 0.03), (W - 0.03, W)):                 # corner uprights
        for ya, yb in ((0.0, 0.02), (D - 0.02, D)):
            mb.box(xa, xb, ya, yb, pl, top, 0)
    mb.box(-W, W, 0.0, D, pl - 0.02, pl, 0)                          # base ring
    for s in (-1, 1):                                                # top frame: side, front and rear rails
        mb.box(s * W, s * (W - 0.04), 0.0, D, top, H - 0.002, 0)
    mb.box(-W + 0.04, W - 0.04, 0.0, 0.04, top, H - 0.002, 0)
    mb.box(-W + 0.04, W - 0.04, D - 0.04, D, top, H - 0.002, 0)
    x0g, x1g, y0g, y1g = gx - gw / 2, gx + gw / 2, gy - gd / 2, gy + gd / 2
    tm = MB()                                                        # top sheet: its own object (the bay light is
    for (xa, xb, ya, yb) in ((-W, W, 0.0, y0g), (-W, W, y1g, D), (-W, x0g, y0g, y1g), (x1g, W, y0g, y1g)):   # flagged off it)
        tm.box(xa, xb, ya, yb, H - 0.0019, H, 0)                     # open where the cables enter (0.1 mm off the rails)
    tm.bevel(0, 0.002, 2)
    tm.obj("HERO_rack_top", [M["top"]], C["rack"])
    mb.box(-W + 0.012, W - 0.012, PLINTH_RECESS, D - 0.02, PLINTH_FLOOR, pl - 0.02, 0)   # plinth, recessed 35 mm at the front
    mb.bevel(0, bv, 2)
    mb.box(-W + 0.03, W - 0.03, 0.036, 0.04, 0.025, pl - 0.03, 1)      # dark vent face of the plinth
    for x in (-W + 0.05, W - 0.05):                                  # levelling feet
        for y in (0.06, D - 0.06):
            mb.cyl(x, y, 0.0, 0.012, 0.018, 12, 1)
            mb.cyl(x, y, 0.012, 0.03, 0.006, 8, 1)
    mb.obj("HERO_rack_frame", [M["rack"], M["dark"], M["roof"]], C["rack"])
    mb = MB()                                                        # rubber trim round the ingress opening
    t = 0.012
    for (xa, xb, ya, yb) in ((x0g - t, x1g + t, y0g - t, y0g), (x0g - t, x1g + t, y1g, y1g + t),
                             (x0g - t, x0g, y0g, y1g), (x1g, x1g + t, y0g, y1g)):
        mb.box(xa, xb, ya, yb, H - 0.004, H + 0.005, 0)
    mb.bevel(0, 0.0015, 2)
    mb.obj("HERO_rack_grommet", [M["dark"]], C["rack"])
    for side, s in (("L", -1), ("R", 1)):
        mb = MB()
        mb.box(s * (W - 0.008), s * W, 0.02, D / 2 - 0.001, pl, top, 0)   # two side panels per side, a hairline apart
        mb.box(s * (W - 0.008), s * W, D / 2 + 0.001, D - 0.02, pl, top, 0)
        mb.bevel(0, bv, 2)
        mb.obj(f"HERO_rack_side_{side}", [M["rack"]], C["rack"])
    # posts: front rails are L profiles with square cage holes (3 per U, EIA-310) and one accessory slot per U
    mb = MB()
    z_holes = [rk["u1_z"] + k * U + o for k in range(rk["u_count"]) for o in (0.00635, 0.02223, 0.0381)]
    for s in (-1, 1):
        def X(a, b):
            return (s * a, s * b)
        fy0, fy1 = pf, pf + 0.0025
        mb.box(*X(0.2265, 0.2278), fy0, fy1, pl, top, 0)
        mb.box(*X(0.2372, 0.2465), fy0, fy1, pl, top, 0)
        mb.box(*X(0.2525, 0.2585), fy0, fy1, pl, top, 0)
        zp = pl
        for zh in z_holes:                                           # webs between the square holes
            mb.box(*X(0.2278, 0.2372), fy0, fy1, zp, zh - 0.00475, 0)
            zp = zh + 0.00475
        mb.box(*X(0.2278, 0.2372), fy0, fy1, zp, top, 0)
        zp = pl
        for k in range(rk["u_count"]):                               # webs between the accessory slots
            zm = rk["u1_z"] + k * U + U / 2
            mb.box(*X(0.2465, 0.2525), fy0, fy1, zp, zm - 0.005, 0)
            zp = zm + 0.005
        mb.box(*X(0.2465, 0.2525), fy0, fy1, zp, top, 0)
        mb.box(*X(0.2565, 0.2585), fy1, pf + 0.05, pl, top, 0)       # depth flange
        mb.box(*X(0.229, 0.2585), pf + 0.012, pf + 0.014, pl, top, 1)  # dark backing seen through the holes
        mb.box(*X(0.225, 0.255), D - 0.25, D - 0.2, pl, top, 0)      # rear post
    mb.obj("HERO_rack_posts", [M["post"], M["dark"]], C["rack"])
    mb = MB()                                                        # vertical managers: fingers in front, channel behind
    for s in (-1, 1):
        mb.box(s * 0.2595, s * 0.2615, 0.025, 0.088, pl, top, 0)
        mb.box(s * 0.286, s * 0.288, 0.025, 0.088, pl, top, 0)
        mb.box(s * 0.2595, s * 0.288, 0.086, 0.088, pl, top, 0)
        for k in range(rk["u_count"] + 1):
            z = rk["u1_z"] + k * U
            mb.box(s * 0.2615, s * 0.286, 0.025, 0.045, max(z - 0.003, pl), min(z + 0.003, top), 0)
    mb.obj("HERO_rack_fingers", [M["dark"]], C["rack"])
    # door: frame tube, a perforated sheet set 5.5 mm behind it, swing handle, hinges
    dr = rk["door"]
    rig = empty("RIG_door", C["rack"], loc=(-W, rk["front_y"] - 0.005, 0.0))
    rig["open"] = 0.0
    mb, dw = MB(), 2 * W
    mb.box(0.0, 0.03, -0.014, 0.0, pl, top, 0)
    mb.box(dw - 0.045, dw, -0.014, 0.0, pl, top, 0)
    mb.box(0.03, dw - 0.045, -0.014, 0.0, pl, pl + 0.035, 0)
    mb.box(0.03, dw - 0.045, -0.014, 0.0, top - 0.035, top, 0)
    hx = dw - 0.0225
    mb.box(hx - 0.012, hx + 0.012, -0.018, -0.014, 0.96, 1.17, 1)
    mb.box(hx - 0.0065, hx + 0.0065, -0.032, -0.018, 0.985, 1.13, 1)
    mb.bevel(0, bv, 2)
    mb.cyl_y(hx, 1.15, -0.022, -0.018, 0.0055, 14, 2)
    for z in (0.32, 1.0, 1.68):
        mb.cyl(0.004, -0.007, z - 0.04, z + 0.04, 0.0065, 12, 1)
    al = door_align(cfg)                                             # a hole in front of that status light at the hero's end
    door = mb.obj("HERO_rack_door", [M["rack"], M["dark"], M["post"]], C["rack"], parent=rig)
    # the sheet twice, on the same grid: really cut (holes with walls) while the door is shut at the hero's end,
    # and a solid sheet whose holes are band-limited alpha once it swings (bake swaps them: rack.door.cut_open),
    # so the edge-on door fades to its open fraction instead of aliasing into crawling stripes
    pm = MB()
    g = perf_sheet(pm, 0.022, dw - 0.037, pl + 0.027, top - 0.027, -0.0085, -0.007, dr["hole_mm"] / 2000.0,
                   dr["pitch_mm"] / 1000.0, 0, al)
    cut = pm.obj("HERO_rack_door_cut", [shade_powder(cfg, "rack", "MAT_door_cut", per_object=False)], C["rack"], parent=door)
    # the perforated shadow always comes from the real cut sheet: a shadow-only twin (same mesh, never seen), so
    # the swap between the cut sheet and the band-limited alpha sheet never changes a shadow, and the alpha sheet
    # casts none (its dithered transparent shadow cost ~20 s a frame)
    sh = bpy.data.objects.new("HERO_rack_door_shadow", cut.data)
    C["rack"].objects.link(sh)
    sh.parent = door
    setattr_safe(sh, "visible_camera", False)
    for ob_ in (sh,):
        for a_ in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter"):
            setattr_safe(ob_, a_, False)
    setattr_safe(cut, "visible_shadow", False)
    sm = MB()
    sm.box(0.022, dw - 0.037, -0.0085, -0.007, pl + 0.027, top - 0.027, 0)
    twin = {"hole_mm": dr["hole_mm"], "pitch_mm": dr["pitch_mm"], "origin": (g["xs"], g["zs"] - 0.5 * g["h"]),
            "cells": (g["xs"], g["zs"], g["h"], g["nr"], g["nc"]), "hole_color": dr.get("hole_color", [0.006, 0.0065, 0.007])}
    so = sm.obj("HERO_rack_door_sheet", [shade_powder(cfg, "rack", "MAT_door_sheet", alpha_perf=twin, per_object=False)],
                C["rack"], parent=door)
    setattr_safe(so, "visible_shadow", False)
    patch_cords(cfg, M, C["rack"])
    manager_bundles(cfg, M, C["rack"])


def manager_bundles(cfg, M, coll):
    """G2' R7: a velcro-strapped bundle in each vertical manager's channel (behind the fingers), from just under
    the switch's cord entry down the rack (rack.mgr_bundles: per side [z top, z bottom], radius, cables, strap
    pitch); the patch cords, the PDU's cords and the fixed servers' short cords end inside them."""
    mbc = cfg["rack"].get("mgr_bundles")
    if not mbc:
        return
    mb = MB()
    for s, key in ((-1, "L"), (1, "R")):
        z1, z0 = mbc[key]
        rr = rng(cfg, f"mgr_bundle_{key}")
        wn = wander(rr, 24)
        n = max(2, int((z1 - z0) / 0.05))
        P = [(s * (mbc.get("x", 0.2738) + 0.0012 * wn(k * 0.7)), mbc.get("y", 0.066) + 0.0015 * wn(k * 0.7 + 9.0),
              z1 - (z1 - z0) * k / n) for k in range(n + 1)]
        L_ = z1 - z0
        st = [x for x in [mbc.get("strap_first", 0.12) + i * mbc.get("strap_pitch", 0.24) + rr.uniform(-0.03, 0.03)
                          for i in range(40)] if x < L_ - 0.05]
        bundle((mb,), P, mbc.get("radius", 0.0105), mbc.get("cables", 9), mbc.get("cable_r", 0.0024), (0, 1, 2), rr, st, 6)
    mb.obj("HERO_rack_mgr_bundles", [M["cable"], M["dark"], M["velcro"]], coll)


def patch_cords(cfg, M, coll):
    """Dark patch cords from the switch's front ports, down between the top fingers of the panel below, along
    its channel and into the vertical managers. They follow the switch out on its rails: shape keys hold the
    cords at slide 1/4, 1/2, 3/4 and 1, keyed every frame as tent weights of the sled's eased travel."""
    pc = cfg["rack"].get("patch")
    if not pc:
        return
    ub = {u["id"]: u for u in resolved_units(cfg)}
    u, fin = ub[pc["unit"]], ub[pc["via"]]
    z0, fy, tr = slot_bot(cfg, u["u"]), cfg["rack"]["face_y"], u.get("travel", 0.0)
    zf = slot_bot(cfg, fin["u"]) + slot_hh(cfg, fin) / 2
    S = [0.0, 0.25, 0.5, 0.75, 1.0]
    rz = pc.get("rows_z", [0.018, 0.03])           # port-row centres above the slot bottom (interiors' cages)
    ports = pc["ports"]
    side_n, lanes = {}, []                           # G2' R7: lanes counted per side (3 x 3 grid in the channel)
    for (x, row, *gp) in ports:
        sg_ = 1 if (gp[0] if gp else x) > 0 else -1
        lanes.append(side_n.get(sg_, 0)); side_n[sg_] = side_n.get(sg_, 0) + 1
    rs_ = rng(cfg, "patch_slack")                    # uneven slack: each cord its own forward run and drop
    slack = [rs_.uniform(*pc.get("slack", [0.0, 0.0])) for _ in ports]
    grid = pc.get("lanes") == "grid"
    def cord(j, x, row, s, gap=None):
        sg = 1 if (gap if gap is not None else x) > 0 else -1
        jj = lanes[j] if grid else j % 4
        zr, yp = z0 + rz[row], fy - tr * s
        g = gap if gap is not None else sg * (0.025 + 0.05 * round((abs(x) - 0.025) / 0.05))
        if grid:
            c_, r_ = jj % 3, jj // 3
            oy, oz = 0.0505 + 0.0055 * c_, zf - 0.004 + 0.0055 * r_
            mx, my = sg * (0.2655 + 0.0055 * c_), 0.054 + 0.0055 * r_
            gx = g + sg * 0.006 * (c_ - 1)           # spread the cords sharing a finger gap
            tz = z0 + pc.get("tail_z", -0.33) - 0.012 * jj
        else:
            oy, oz = 0.0535 + 0.0058 * (jj % 2), zf - 0.003 + 0.0055 * (jj // 2)
            mx, my = sg * (0.267 + 0.0065 * (jj % 2)), 0.056 + 0.0065 * (jj // 2)
            gx, tz = g, z0 - 0.33 - 0.025 * jj
        sk = slack[j]
        boot = [(x, yp + 0.008, zr), (x, yp - 0.006, zr), (x, yp - 0.013, zr)]
        fw = pc.get("forward", 0.0) + 0.6 * sk      # run forward of the lip before turning down to the fingers
        head = [(x, yp - 0.013, zr), (x, yp - 0.024 - fw * 0.6, zr - 0.003), (x, yp - 0.031 - fw, zr - 0.02),
                (lerp(x, gx, 0.5), yp - 0.027 - fw * 0.8, zr - 0.042 - sk)]
        if s > 0:                                    # back under the sled, sagging a little more the further out
            head.append(((head[-1][0] + gx) / 2, lerp(head[-1][1], 0.048, 0.4), zr - 0.05 - sk - 0.1 * s))
        head += [(gx, 0.048, zf + 0.013), (gx, oy, oz + 0.005)]
        tail = fillet([(gx, oy, oz + 0.005), (gx + sg * 0.03, oy, oz), (sg * 0.245, oy, oz), (mx, my, oz - 0.006),
                       (mx, my, oz - 0.07), (mx, my, tz)], 0.02, 0.02)
        return boot + resample(fillet(head, 0.025, 0.008), 16)[1:] + resample(tail, 12)[1:]
    shapes = []
    for s in S:
        vs = []
        for j, (x, row, *gp) in enumerate(ports):
            pts = cord(j, x, row, s, *gp)
            for ring in tube_verts(pts, [0.0045, 0.0045, 0.0034] + [pc["radius"]] * (len(pts) - 3), 8):
                vs += ring
        shapes.append(vs)
    mb = MB()
    for j, (x, row, *gp) in enumerate(ports):
        pts = cord(j, x, row, 0.0, *gp)
        mb.tube(pts, [0.0045, 0.0045, 0.0034] + [pc["radius"]] * (len(pts) - 3), 8, 0, head=(3, 1))   # boot: moulded plastic
    o = mb.obj(f"CABLE_patch_{u['id']}", [M["cable"], M["dark"]], coll)
    o.shape_key_add(name="Basis", from_mix=False)
    for k in range(1, len(S)):
        kb = o.shape_key_add(name=f"slide_{k}", from_mix=False)
        kb.data.foreach_set("co", [c for v in shapes[k] for c in v])
    ft = film_table(cfg)
    F = list(range(ft[0]["a"], ft[-1]["b"] + 1))
    ks, win = rig_keys(cfg).get(u["id"], [(F[0], 0.0)]), u["windows"]["slide"]
    sv = [ease(pw_linear(ks, f), *win) for f in F]
    for k in range(1, len(S)):
        anim(o.data.shape_keys, f'key_blocks["slide_{k}"].value', -1, F,
             [max(0.0, 1.0 - abs(s_ * (len(S) - 1) - k)) for s_ in sv])


def fixed_front(cfg, M, coll, u, hh, z0):
    """Fronts of the hero rack's fixed units: blanks, brush and finger panels, 1U/2U servers, the PDU; every ear
    screwed to the rails (one blank is short a screw head), handles, drive carriers, and a static LED cluster."""
    rk, uid, kind = cfg["rack"], u["id"], u["kind"]
    kind = rk.get("front_kinds", {}).get(uid, kind)
    E, sbw, U = rk["ear_width"] / 2, rk["static_body_width"], rk["U"]
    r = rng(cfg, f"front_{uid}")
    mb, lm = MB(), MB()
    miss = rk.get("missing_screw", [None, 0, 0])
    above = next((v for v in resolved_units(cfg) if v["u"] == u["u"] + u["h"]), {})
    flush = above.get("mech") in ("door_carrier", "door_tray")       # a drop-down door rests against this face
    for k in range(u["h"]):                                          # ear screws in the middle hole of each U
        zc = k * U + 0.02223
        for s in (-1, 1):
            if miss[0] == uid and miss[1] == k and miss[2] == s:
                mb.box(s * 0.2325 - 0.0032, s * 0.2325 + 0.0032, -0.0004, 0.0, zc - 0.0048, zc + 0.0048, 4)
            elif flush:                                              # countersunk heads, flush with the ear
                mb.cyl_y(s * 0.2325, zc, -0.00025, 0.0, 0.0039, 12, 1)
            else:
                mb.cyl_y(s * 0.2325, zc, -0.0024, 0.0, 0.0039, 12, 1)
                mb.box(s * 0.2325 - 0.0026, s * 0.2325 + 0.0026, -0.0026, -0.0024, zc - 0.0004, zc + 0.0004, 4)
    if kind in ("blank", "brush", "finger"):
        mb.box(-E, E, 0.0, 0.003, 0.0004, hh, 0)
        if kind == "brush":
            mb.box(-0.19, 0.19, -0.004, 0.0, hh / 2 - 0.006, hh / 2 + 0.006, 4)
        if kind == "finger":                                         # top and bottom finger rows, channel between
            for i in range(9):
                x = -0.2 + i * 0.05
                for za, zb in ((hh - 0.009, hh - 0.001), (0.001, 0.009)):
                    mb.box(x - 0.006, x + 0.006, -0.045, 0.0, za, zb, 4)
            mb.box(-0.215, 0.215, -0.003, 0.0, 0.009, hh - 0.009, 4)
    else:
        mb.box(-E, E, 0.0, 0.01 if kind != "pdu" else 0.004, 0.0004, hh, 0)
        mb.box(-sbw / 2, sbw / 2, 0.01, u.get("depth", 0.7), 0.0014, hh - 0.001, 1)
        for s in (-1, 1):                                            # pull handles on both ears
            x = s * 0.2135
            for za, zb in ((0.006, 0.01), (hh - 0.01, hh - 0.006)):
                mb.box(x - 0.003, x + 0.003, -0.012, 0.0, za, zb, 4)
            mb.box(x - 0.0025, x + 0.0025, -0.015, -0.011, 0.006, hh - 0.006, 4)
        if kind == "server1u":
            for i in range(8):
                cx = -0.1685 + i * 0.043
                mb.box(cx - 0.0195, cx + 0.0195, -0.002, 0.0, 0.008, 0.034, 4)
                mb.box(cx - 0.016, cx + 0.008, -0.0035, -0.002, 0.009, 0.012, 1)
                if r.random() < 0.5:
                    lm.box(cx + 0.0125, cx + 0.0145, -0.0028, -0.002, 0.028, 0.03)
            nc_ = (rk.get("front_cords") or {}).get(uid, 0)
            if nc_:                                  # G2' R7: recessed ports (a dark surround, the jack set 3 mm in),
                fy_, cm_, rc_ = rk["face_y"], MB(), rng(cfg, f"front_cords_{uid}")   # short dark cords to the
                for i in range(3):                   # right manager, into its bundle
                    px = 0.161 + i * 0.0135
                    mb.box(px - 0.0062, px + 0.0062, -0.0008, 0.0, 0.010, 0.024, 4)
                    mb.box(px - 0.0048, px + 0.0048, -0.0009, -0.0008, 0.012, 0.022, 2)
                    if i >= nc_:
                        continue
                    zc, sk = z0 + 0.017, rc_.uniform(0.004, 0.022)
                    cm_.tube(fillet([(px, fy_ + 0.002, zc), (px, fy_ - 0.016, zc), (px + 0.004, fy_ - 0.03, zc - 0.006 - sk),
                                     (0.236 + 0.003 * i, fy_ - 0.036 + 0.004 * i, zc - 0.01 - sk), (0.262, 0.042, zc - 0.006),
                                     (0.27 + 0.003 * (i % 2), 0.062, zc - 0.012), (0.27 + 0.003 * (i % 2), 0.064, zc - 0.07 - 0.02 * i)],
                                    0.012, 0.01), [0.0045, 0.0045, 0.0034] + [0.0024] * 40, 8, 0, head=(3, 1))
                cm_.obj(f"CABLE_front_{uid}", [M["cable"], M["dark"]], coll)
            else:
                mb.box(0.155, 0.198, -0.0012, 0.0, 0.027, 0.031, 2)
                mb.cyl_y(0.175, 0.016, -0.003, 0.0, 0.003, 12, 1)
        elif kind == "server2u" and r.random() < rk.get("bezel_share", 0.4):
            mb.box(-0.205, 0.205, -0.014, 0.0, 0.004, hh - 0.004, 4)
            for za, zb in ((hh - 0.009, hh - 0.004), (0.004, 0.009)):
                mb.box(-0.205, 0.205, -0.0145, -0.014, za, zb, 0)
            mb.box(-0.17, 0.15, -0.0142, -0.014, 0.02, hh - 0.02, 2)
            lm.box(0.185, 0.188, -0.0147, -0.0142, hh - 0.016, hh - 0.0135)
        elif kind == "server2u":
            for c in range(4):
                for j in range(3):
                    cx, zc = -0.15 + c * 0.1, 0.0145 + j * 0.0295
                    mb.box(cx - 0.048, cx + 0.048, -0.002, 0.0, zc - 0.0135, zc + 0.0135, 4)
                    mb.box(cx - 0.044, cx + 0.03, -0.004, -0.002, zc - 0.011, zc - 0.0075, 1)
                    if r.random() < 0.4:
                        lm.box(cx + 0.038, cx + 0.0405, -0.0026, -0.002, zc + 0.007, zc + 0.0092)
        elif kind == "pdu":
            for i in range(8):
                cx = -0.17 + i * 0.04
                mb.box(cx - 0.011, cx + 0.011, -0.003, 0.0, 0.012, 0.031, 4)
                mb.box(cx - 0.008, cx + 0.008, -0.0032, -0.003, 0.015, 0.028, 2)
            mb.box(0.168, 0.196, -0.008, 0.0, 0.012, 0.031, 4)
            mb.box(0.176, 0.188, -0.014, -0.008, 0.018, 0.025, 1)
            lm.box(0.2, 0.2025, -0.0012, 0.0, 0.027, 0.0292)
            cm, fy = MB(), rk["face_y"]
            for j, i in enumerate(i for i in range(8) if r.random() < 0.7):
                cx = -0.17 + i * 0.04
                mb.box(cx - 0.0085, cx + 0.0085, -0.03, -0.003, 0.0135, 0.0295, 4)
                mx, my = -(0.267 + 0.0065 * (j % 2)), 0.056 + 0.0065 * ((j // 2) % 2)   # to the left managers
                zc = z0 + 0.0215
                cm.tube(fillet([(cx, fy - 0.03, zc), (cx, fy - 0.045, zc - 0.004), (cx - 0.03, fy - 0.05 + 0.004 * j, zc - 0.012 + 0.004 * j),
                                (-0.24, my, zc - 0.01 + 0.004 * j), (mx, my, zc), (mx, my, zc + 0.08), (mx, my, zc + 0.5 + 0.03 * j)], 0.02, 0.02),
                        0.0035, 6, 0)
            cm.obj(f"CABLE_pdu_{uid}", [M["cable"]], coll)
    o = mb.obj(f"UNIT_{uid}_{u['kind']}", unit_mats(M), coll, loc=(0.0, rk["face_y"], z0))
    if lm.bm.verts:
        lm.obj(f"LED_{uid}_cluster", [M["led_standby"]], coll, parent=o)
    else:
        lm.bm.free()
    return o


# ------------------------------------------------------------------ units
def unit_mats(M):
    return [M["bezel"], M["metal"], M["board"], M["rail"], M["dark"]]   # 0 bezel 1 metal 2 board 3 rail 4 dark


def add_led(M, coll, name, parent, loc, color):
    mb = MB(); mb.box(-0.002, 0.002, -0.001, 0.001, -0.0015, 0.0015)
    o = mb.obj(name, [M["led"]], coll, parent=parent, loc=loc)
    o.color = (*color, 1.0)
    return o


IMAT = ("cable", "heatsink", "latch", "seal", "case", "liner", "pcb", "epoxy", "zinc")   # unit slots 5..13 (after unit_mats' five)


def interior_mats(cfg, M):
    """Slots 5-9 of every unit mesh: rubber (MAT_cable_rubber), and four plain mat_p finishes for the interiors
    (interiors.materials: [r, g, b, roughness, metallic, specular level])."""
    names = {"heatsink": "MAT_heatsink_dark", "latch": "MAT_latch_grey", "seal": "MAT_seal_ring", "case": "MAT_case_dark",
             "liner": "MAT_tray_liner", "epoxy": "MAT_part_epoxy", "zinc": "MAT_screw_zinc"}
    for key, (r, g, b, rough, metal, spec) in cfg["interiors"]["materials"].items():
        if key not in M:
            M[key] = mat_p(names.get(key, f"MAT_{key}"), (r, g, b), rough, metal, 1.0, spec)[0]
    return [M[k] for k in IMAT]


def cables(name, splines, radius, mat, coll, parent=None, cyclic=False):
    """Several Bezier cables in one curve object (fan leads, jumpers, fibre loops)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = radius, 2, 10
    setattr_safe(cu, "use_fill_caps", True)
    for pts in splines:
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = "AUTO"
        sp.use_cyclic_u = cyclic
    cu.materials.append(mat)
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.parent = parent
    return o


# slots: 0 bezel 1 metal 2 board 3 rail 4 dark 5 cable 6 heatsink 7 latch 8 seal 9 case 10 liner 11 pcb 12 epoxy 13 zinc
def _screw(mb, x, y, z, r=0.0021, mi=13):
    """Pan-head screw seen from above: a low head and a dark socket."""
    mb.tube_ax("z", z, z + 0.0011, x, y, 0.0, r, 12, mi)
    mb.tube_ax("z", z + 0.0011, z + 0.0012, x, y, 0.0, r * 0.42, 6, 4)


def _fan_y(mb, fx, y0, y1, z0, s, R, closed=False):
    """Axial fan, axis along y, s square. Open: four corner posts and the venturi between them, seven blades and a
    dark hub inside, motor struts on the outlet side (the server's fan wall, seen on its outlet face). Closed: a
    chamfered housing block whose front face shows a flange ring, the blades and the hub (the switch's 1U fans,
    seen from above with their inlet face at a grazing angle)."""
    zc, ro = z0 + s / 2, s / 2 - 0.0004
    p = s * 0.16
    if closed:
        mb.cbox(fx - s / 2, fx + s / 2, y0 + 0.0026, y1, z0, z0 + s, 4, 0.0012, False)
        mb.tube_ax("y", y0, y0 + 0.0026, fx, zc, ro - 0.0022, ro, 28, 4)
        for sx in (-1, 1):
            for sz in (-1, 1):
                mb.box(fx + sx * s / 2, fx + sx * (s / 2 - p), y0, y0 + 0.0026, zc + sz * s / 2, zc + sz * (s / 2 - p), 4)
        mb.tube_ax("y", y0 + 0.0003, y0 + 0.0026, fx, zc, 0.0, s * 0.2, 16, 5)
        a0 = R.uniform(0, 2 * PI)
        for k in range(7):
            a = a0 + k * 2 * PI / 7
            mb.tube_ax("y", y0 + 0.0009, y0 + 0.0026, fx, zc, s * 0.19, ro - 0.0024, 4, 0, a, a + 0.5)
        return
    for sx in (-1, 1):
        for sz in (-1, 1):
            mb.cbox(fx + sx * s / 2, fx + sx * (s / 2 - p), y0, y1, zc + sz * s / 2, zc + sz * (s / 2 - p), 4, 0.0005, False)
    mb.tube_ax("y", y0 + 0.0015, y1 - 0.0015, fx, zc, ro - 0.0012, ro, 28, 4)
    mb.tube_ax("y", y0, y0 + 0.0015, fx, zc, ro - 0.0025, ro + 0.0004, 28, 4)
    mb.tube_ax("y", y1 - 0.0015, y1, fx, zc, ro - 0.0025, ro + 0.0004, 28, 4)
    ym, rh = (y0 + y1) / 2, s * 0.21
    mb.tube_ax("y", y0 + 0.002, y1 - 0.0025, fx, zc, 0.0, rh, 16, 5)
    a0 = R.uniform(0, 2 * PI)
    for k in range(7):
        a = a0 + k * 2 * PI / 7
        mb.tube_ax("y", ym - 0.003, ym + 0.003, fx, zc, rh * 0.95, ro - 0.0016, 4, 4, a, a + 0.55)
    for k in range(3):
        a = PI / 2 + k * 2 * PI / 3
        mb.tube_ax("y", y1 - 0.0022, y1 - 0.0008, fx, zc, rh * 0.9, ro - 0.0005, 2, 4, a - 0.06, a + 0.06)


def _rail_profile(mb, s, xa, xb, y0, y1, z0, z1, inset):
    """One telescoping slide member: a C channel (web on its outer side, a bottom flange and a rolled top lip), so
    from above each member shows its own round lip at its own height, and the round lip carries a thin glint."""
    t = 0.0007
    z0, z1 = z0 + inset, z1 - inset
    r = min(0.0011, (xb - xa) / 2)
    mb.box(s * (xb - t), s * xb, y0, y1, z0, z1 - r, 3)
    mb.tube_ax("y", y0, y1, s * (xa + xb) / 2, z1 - r, 0.0, r, 10, 3)
    mb.box(s * xa, s * xb, y0, y1, z0, z0 + t, 3)


def _board_blocks(mb, R, x0, x1, y0, y1, pz, side=1):
    """Functional groups of low dark board parts stacked along a board edge (x0..x1 strip, y0 -> y1), aligned the
    way a layout engineer places them: a regulator (inductors in a row with their capacitors), a controller with
    its decoupling, bulk capacitors, a header. Seeded; no repeat finer than 4 mm."""
    y, w = y0, x1 - x0
    xe = x0 if side < 0 else x1                       # the board edge the groups are justified against
    def X(off, a):                                    # x of a part of width a, off from the edge inward
        return (xe + off + a / 2) if side < 0 else (xe - off - a / 2)
    while True:
        k = R.random()
        if k < 0.35:                                  # regulator
            n, a = R.randint(2, 3), R.uniform(0.0055, 0.0075)
            h = n * (a + 0.0025)
            if y + h > y1: break
            for i in range(n):
                yy = y + i * (a + 0.0025)
                mb.cbox(X(0.002, a) - a / 2, X(0.002, a) + a / 2, yy, yy + a, pz, pz + 0.0042, 12, 0.0015)   # inductor
                c = 0.0016
                mb.cbox(X(0.004 + a, c) - c / 2, X(0.004 + a, c) + c / 2, yy + a / 2 - 0.0008, yy + a / 2 + 0.0008, pz, pz + 0.0008, 6, 0.0002)
            yy = y + h / 2
            mb.cbox(X(0.007 + a, 0.004) - 0.002, X(0.007 + a, 0.004) + 0.002, yy - 0.002, yy + 0.002, pz, pz + 0.0011, 12, 0.0003)
            y += h + R.uniform(0.004, 0.009)
        elif k < 0.6:                                 # controller and its decoupling
            a = R.uniform(0.006, 0.011)
            if y + a + 0.004 > y1: break
            xc = X(0.003, a)
            mb.cbox(xc - a / 2, xc + a / 2, y + 0.002, y + 0.002 + a, pz, pz + 0.0012, 12, 0.0004)
            for j in range(max(1, int(a / 0.0045))):
                xx = xc - a / 2 + 0.0015 + j * 0.0045
                mb.cbox(xx - 0.0008, xx + 0.0008, y + a + 0.0035, y + a + 0.0045, pz, pz + 0.0007, 6, 0.0002)
            y += a + 0.006 + R.uniform(0.004, 0.01)
        elif k < 0.85:                                # bulk capacitors in a row
            n, r = R.randint(1, 3), R.uniform(0.0025, 0.0038)
            if y + 2 * r > y1: break
            for i in range(n):
                xc = X(0.002 + i * (2 * r + 0.0025), 2 * r)
                if abs(xc - xe) > w - 0.001: break
                ht = R.uniform(0.006, 0.009)
                mb.tube_ax("z", pz, pz + ht, xc, y + r, 0.0, r, 16, 12)                  # sleeved can
                mb.tube_ax("z", pz + ht, pz + ht + 0.0002, xc, y + r, 0.0, r * 0.78, 16, 6)   # its aluminium top
                for ax_ in ((0.0006, r * 0.62), (r * 0.62, 0.0006)):                    # the scored vent cross
                    mb.box(xc - ax_[0], xc + ax_[0], y + r - ax_[1], y + r + ax_[1], pz + ht + 0.0002, pz + ht + 0.00028, 4)
                mb.tube_ax("z", pz, pz + 0.0004, xc, y + r, 0.0, r + 0.0007, 16, 2)
            y += 2 * r + R.uniform(0.004, 0.009)
        else:                                         # a header
            a, b = R.uniform(0.01, 0.018), 0.005
            if y + a > y1: break
            mb.cbox(X(0.003, b) - b / 2, X(0.003, b) + b / 2, y, y + a, pz, pz + 0.006, 12, 0.0005)
            y += a + R.uniform(0.005, 0.01)


def _int_switch(mb, u, hh, rin, D, pz, R, ex):
    tf = 0.0034                                                   # tray floor
    mb.box(-rin + 0.002, rin - 0.002, 0.012, 0.2525, pz - 0.0015, pz, 11)       # the board (solder mask, traces)
    for x, y in ((-0.207, 0.02), (0.207, 0.02), (-0.207, 0.135), (0.207, 0.135), (-0.207, 0.243), (0.207, 0.243)):
        _screw(mb, x, y, pz)
    # top band: six fans hard against the rear wall, the ASIC heat sink tight against them
    mb.box(-rin + 0.002, rin - 0.002, 0.2535, D - 0.0016, tf, tf + 0.0012, 4)   # fan tray
    fans = (-0.175, -0.105, -0.035, 0.035, 0.105, 0.175)
    s = 0.036
    leads = []
    for fx in fans:
        _fan_y(mb, fx, 0.2565, 0.2845, tf + 0.0012, s, R, closed=True)
        for sz in (-1, 1):
            mb.tube_ax("y", 0.2845, D - 0.0015, fx - s / 2 + 0.003, tf + 0.0012 + s / 2 + sz * (s / 2 - 0.003), 0.0, 0.0016, 8, 5)
            mb.tube_ax("y", 0.2845, D - 0.0015, fx + s / 2 - 0.003, tf + 0.0012 + s / 2 + sz * (s / 2 - 0.003), 0.0, 0.0016, 8, 5)
        hx = {0.035: 0.079, 0.105: 0.124, 0.175: 0.158}[round(abs(fx), 3)] * (1 if fx > 0 else -1)
        mb.cbox(hx - 0.0045, hx + 0.0045, 0.2445, 0.2505, pz, pz + 0.0055, 4, 0.0004)
        sx = 1 if hx > fx else -1
        leads.append([(fx + sx * (s / 2 - 0.004), 0.2562, tf + 0.006), (fx + sx * (s / 2 + 0.002), 0.2552, tf + 0.004 + R.uniform(0, 0.002)),
                      ((fx + hx) / 2 + sx * 0.004, 0.2544, pz + 0.002), (hx, 0.2508, pz + 0.004)])
    ex.append(("cables", "fan_leads", leads, 0.0008, "cable", False))
    mb.box(-0.028, 0.028, 0.2395, 0.2535, pz, pz + 0.0018, 4)                  # the ASIC package
    mb.cbox(-0.07, 0.07, 0.238, 0.2552, pz + 0.0018, pz + 0.0048, 6, 0.0006)   # heat sink base
    for i in range(28):                                                         # fins along the airflow, 5 mm pitch
        x = -0.0675 + i * 0.005
        mb.box(x - 0.0004, x + 0.0004, 0.2386, 0.2546, pz + 0.0048, 0.034, 6)
    for sx in (-1, 1):                                                          # push pins with springs
        mb.tube_ax("z", pz, pz + 0.0062, sx * 0.0735, 0.2466, 0.0, 0.0011, 8, 1)
        mb.tube_ax("z", pz + 0.0062, pz + 0.0078, sx * 0.0735, 0.2466, 0.0, 0.0024, 12, 4)
    # low dark parts in functional groups along the board's side edges only (the calm box is plain board): on the
    # left a narrow control card on standoffs and its memory, on the right the PHYs' small heat sink, each with
    # regulators and capacitors (storyboard section 2: x < 0.18 / > 0.82 of the hold frame)
    _board_blocks(mb, R, -0.2125, -0.174, 0.198, 0.236, pz, -1)
    _board_blocks(mb, R, 0.174, 0.2125, 0.058 + R.uniform(0, 0.006), 0.196, pz, 1)
    for g0 in (-0.022, 0.080):
        for xx in (g0 + 0.035, g0 + 0.083):
            mb.cbox(xx - 0.0035, xx + 0.0035, 0.051, 0.058, pz, pz + 0.001, 12, 0.0003)
            for j in range(3):
                mb.cbox(xx - 0.0042 + j * 0.0042 - 0.0008, xx - 0.0042 + j * 0.0042 + 0.0008, 0.0615, 0.0625, pz, pz + 0.0007, 6, 0.0002)
    # the front: two gangs of six double-height port cages (backs face the camera), PHYs behind them
    for g0 in (-0.022, 0.080):
        for c in range(6):
            x = g0 + c * 0.016
            mb.cbox(x + 0.0004, x + 0.0156, 0.0105, 0.041, pz, pz + 0.019, 6, 0.0005)
            mb.box(x + 0.0012, x + 0.0148, 0.041, 0.0414, pz + 0.0085, pz + 0.0105, 4)
            for i in range(2):
                for j in range(4):
                    hx, hy = x + 0.0055 + i * 0.005, 0.0195 + j * 0.0045
                    mb.box(hx - 0.0011, hx + 0.0011, hy - 0.0011, hy + 0.0011, pz + 0.019, pz + 0.01905, 5)
        for c in range(12):
            x = g0 + 0.008 + (c // 2) * 0.016 + (c % 2 - 0.5) * 0.007
            mb.tube_ax("y", 0.0105, 0.0405, x, pz + 0.0198, 0.0, 0.0008, 8, 4)
        mb.cbox(g0 + 0.012, g0 + 0.026, 0.047, 0.061, pz, pz + 0.0014, 4, 0.0004)
        mb.cbox(g0 + 0.060, g0 + 0.074, 0.047, 0.061, pz, pz + 0.0014, 4, 0.0004)
    for x0 in (-0.19, -0.153):                                      # management jacks: plastic, shielded tops
        mb.cbox(x0, x0 + 0.033, 0.0105, 0.033, pz, pz + 0.0138, 4, 0.0006)
        mb.cbox(x0 + 0.0005, x0 + 0.0325, 0.0105, 0.0315, pz + 0.0138, pz + 0.0145, 6, 0.0003)
    mb.cbox(-0.105, -0.085, 0.0105, 0.028, pz, pz + 0.008, 4, 0.0005)
    mx0, mx1, my0, my1 = -0.2105, -0.1745, 0.128, 0.192                             # control card, 36 x 64 mm
    for x in (mx0 + 0.004, mx1 - 0.004):
        for y in (my0 + 0.004, my1 - 0.004):
            mb.tube_ax("z", pz, pz + 0.003, x, y, 0.0, 0.0024, 10, 4)                 # standoffs
            _screw(mb, x, y, pz + 0.0045, 0.0019, 4)
    mb.cbox(mx0, mx1, my0, my1, pz + 0.003, pz + 0.0045, 11, 0.0005)                 # card substrate
    mb.cbox(mx0 + 0.008, mx1 - 0.008, my0 + 0.012, my1 - 0.012, pz + 0.0045, pz + 0.0062, 10, 0.0006)   # spreader
    for i in range(4):                                                                # its memory, 12 x 10 mm BGAs
        y = 0.062 + i * 0.0158
        mb.cbox(-0.2085, -0.1965, y, y + 0.010, pz, pz + 0.0012, 12, 0.0004)
    hx0, hy0 = 0.176, 0.201                                                           # PHY heat sink, 5 mm fins
    mb.cbox(hx0, hx0 + 0.0345, hy0, hy0 + 0.032, pz, pz + 0.0016, 12, 0.0004)
    mb.cbox(hx0 + 0.001, hx0 + 0.0335, hy0 + 0.001, hy0 + 0.031, pz + 0.0016, pz + 0.0032, 6, 0.0005)
    for i in range(6):
        x = hx0 + 0.0048 + i * 0.005
        mb.box(x - 0.0004, x + 0.0004, hy0 + 0.0015, hy0 + 0.0305, pz + 0.0032, pz + 0.0105, 6)


def _int_storage(mb, u, hh, rin, D, pz, R, ex):
    cols, rows = u.get("cols", 12), u.get("rows", 5)
    pitch = (2 * rin - 0.01) / cols
    pins = []
    for r_ in range(rows):
        y0 = 0.04 + r_ * 0.165
        for c in range(cols):
            x = -rin + 0.005 + (c + 0.5) * pitch
            dz, dy = R.uniform(-0.0005, 0.0001), R.uniform(-0.0006, 0.0006)
            t = pz + dz
            mb.cbox(x - 0.0155, x + 0.0155, y0 + dy, y0 + dy + 0.15, 0.0034, t, 4, 0.0009)      # carrier, near-black
            mb.cbox(x - 0.0118, x + 0.0118, y0 + dy + 0.018, y0 + dy + 0.141, t, t + 0.0007, 2, 0.0004)  # lever, flush
            mb.box(x - 0.0095, x + 0.0095, y0 + dy + 0.0045, y0 + dy + 0.0078, t, t + 0.001, 7)     # thin grey latch
            pins.append((x + 0.011, y0 + dy + 0.0118, t))
        if r_ < rows - 1:                                                       # cross member between rows (dark)
            mb.box(-rin + 0.002, rin - 0.002, y0 + 0.1515, y0 + 0.1635, pz - 0.013, pz - 0.0095, 9)
    ex.append(("pins", "pins", pins, 0.00035, tuple(u.get("pin_color", (0.004, 0.008, 0.016)))))


def _dimm(mb, x, y0, y1, pz):
    mb.box(x - 0.0028, x + 0.0028, y0 - 0.006, y1 + 0.006, pz, pz + 0.0065, 4)          # slot
    for yy in (y0 - 0.0065, y1 + 0.0005):                                                 # latches
        mb.cbox(x - 0.0021, x + 0.0021, yy, yy + 0.006, pz, pz + 0.017, 4, 0.0005)
    mb.box(x - 0.0006, x + 0.0006, y0, y1, pz + 0.0055, pz + 0.037, 2)                    # stick
    for j in range(9):
        yj = y0 + 0.004 + j * 0.0141
        for sx in (-1, 1):
            mb.box(x + sx * 0.0006, x + sx * 0.0014, yj, yj + 0.0106, pz + 0.013, pz + 0.0235, 4)


def _int_server(mb, u, hh, rin, D, pz, R, ex):
    tf = 0.0034
    mb.box(-rin + 0.002, rin - 0.002, 0.249, D - 0.003, pz - 0.0015, pz, 11)      # board behind the fan wall
    for cx in (-0.0875, 0.0875):          # sockets, heat sinks: fin mid-height lands at x 0.33 / 0.67 of the hold
        cy = 0.365
        mb.cbox(cx - 0.05, cx + 0.05, cy - 0.053, cy + 0.053, pz, pz + 0.003, 4, 0.0006)
        mb.cbox(cx - 0.0455, cx + 0.0455, cy - 0.0455, cy + 0.0455, pz + 0.003, pz + 0.0085, 6, 0.0008)
        for i in range(18):                                                       # 5 mm fin pitch
            x = cx - 0.0425 + i * 0.005
            mb.box(x - 0.0004, x + 0.0004, cy - 0.0405, cy + 0.0405, pz + 0.0085, pz + 0.048, 6)
        for sx in (-1, 1):
            for sy in (-1, 1):
                mb.tube_ax("z", pz + 0.0085, pz + 0.0125, cx + sx * 0.0405, cy + sy * 0.0432, 0.0, 0.0028, 12, 6)
                mb.tube_ax("z", pz + 0.0125, pz + 0.0127, cx + sx * 0.0405, cy + sy * 0.0432, 0.0, 0.0011, 6, 4)
        for sx in (-1, 1):                                                        # memory either side, 8.5 mm pitch
            for i in range(4):
                _dimm(mb, cx + sx * (0.053 + i * 0.0085), 0.3245, 0.4575, pz)
    for sx in (-1, 1):                                                            # regulators along the walls
        for i in range(7):
            y = 0.30 + i * 0.0155 + R.uniform(-0.001, 0.001)
            mb.cbox(sx * 0.2 - 0.0045, sx * 0.2 + 0.0045, y, y + 0.009, pz, pz + 0.0055, 4, 0.0006)
        for i in range(5):
            y = 0.31 + i * 0.022 + R.uniform(-0.002, 0.002)
            mb.tube_ax("z", pz, pz + 0.009, sx * 0.188, y, 0.0, 0.0032, 14, 4)
    for x0, x1 in ((-0.2135, -0.1265), (0.1265, 0.2135)):                         # power supplies, dark backs
        mb.cbox(x0, x1, 0.462, D - 0.0016, tf, tf + 0.040, 9, 0.0012)
        for yy in (0.49, 0.525, 0.555):
            mb.box(x0 + 0.003, x1 - 0.003, yy, yy + 0.0012, tf + 0.040, tf + 0.0403, 4)
        mb.box(x0 + 0.012, x1 - 0.012, 0.4605, 0.462, tf + 0.008, tf + 0.026, 4)
    mb.cbox(-0.115, 0.115, 0.472, D - 0.0016, tf, 0.078, 9, 0.0012)               # riser cage between them
    mb.box(-0.105, 0.105, 0.4705, 0.472, 0.02, 0.07, 2)
    bundles = []
    for sx in (-1, 1):
        for k in range(3):
            o = (k - 1) * 0.0055
            bundles.append([(sx * (0.19 + o), 0.461, tf + 0.02), (sx * (0.192 + o), 0.452, pz + 0.014),
                            (sx * (0.194 + o * 0.5), 0.4445, pz + 0.007)])
        mb.cbox(sx * 0.194 - 0.0105, sx * 0.194 + 0.0105, 0.436, 0.4445, pz, pz + 0.0085, 4, 0.0006)
    ex.append(("cables", "psu_leads", bundles, 0.0024, "cable", False))
    # bottom band: the fan wall (six hot-swap fans, dark hubs facing the board, no grilles), drive cage behind it
    for fx in (-0.175, -0.105, -0.035, 0.035, 0.105, 0.175):
        mb.cbox(fx - 0.033, fx + 0.033, 0.203, 0.2055, tf, tf + 0.064, 4, 0.0005)
        for sx in (-1, 1):
            mb.cbox(fx + sx * 0.033, fx + sx * 0.0305, 0.203, 0.245, tf, tf + 0.064, 4, 0.0005)
        mb.cbox(fx - 0.033, fx + 0.033, 0.203, 0.245, tf + 0.0615, tf + 0.0655, 9, 0.0008)      # module top: dark case
        mb.cbox(fx - 0.012, fx + 0.012, 0.209, 0.222, tf + 0.0655, tf + 0.0705, 9, 0.0012)
        _fan_y(mb, fx, 0.2055, 0.2445, tf + 0.0005, 0.06, R)
    mb.cbox(-rin + 0.001, rin - 0.001, 0.012, 0.198, hh - 0.0062, hh - 0.0042, 9, 0.0006)   # drive cage top
    mb.box(-0.205, 0.205, 0.196, 0.198, tf, hh - 0.0062, 2)                                # backplane
    for i in range(8):
        x = -0.18 + i * 0.0514
        mb.cbox(x - 0.01, x + 0.01, 0.198, 0.2015, 0.02, 0.03, 4, 0.0003)


def _int_fibre(mb, u, hh, rin, D, pz, R, ex):
    mb.box(-rin + 0.0016, rin - 0.0016, 0.0115, D - 0.0016, pz, pz + 0.0006, 10)   # black foam liner on the tray
    sy = 0.19                                                                     # the spool, 13 cm across
    mb.tube_ax("z", pz, pz + 0.0012, 0.0, sy, 0.0, 0.065, 56, 9)                # the spool: the dark case finish
    mb.tube_ax("z", pz, pz + 0.021, 0.0, sy, 0.026, 0.030, 40, 9)
    mb.tube_ax("z", pz, pz + 0.0016, 0.0, sy, 0.0, 0.026, 32, 2)
    for k in range(6):
        a = k * PI / 3 + 0.3
        mb.tube_ax("z", pz + 0.0195, pz + 0.0215, 0.0, sy, 0.0285, 0.041, 3, 9, a - 0.09, a + 0.09)
    loops = []
    for i in range(15):
        r = R.uniform(0.034, 0.058)
        ox, oy, z = R.uniform(-0.0015, 0.0015), R.uniform(-0.0015, 0.0015), pz + 0.0026 + R.uniform(0.0, 0.0145)
        ph = R.uniform(0, 2 * PI)
        loops.append([(ox + r * (1 + 0.02 * math.sin(3 * a + ph)) * math.cos(a),
                       sy + oy + r * (1 + 0.02 * math.sin(3 * a + ph)) * math.sin(a),
                       z + 0.0008 * math.sin(2 * a + ph)) for a in [2 * PI * j / 8 for j in range(8)]])
    ex.append(("cables", "fibre_coil", loops, 0.0012, "cable", True))
    # the adapter row: thirteen positions across x 0.20-0.80 of the hold frame, the middle one lit (LED_<id>_conn)
    mb.cbox(-0.19, 0.19, 0.0300, 0.0315, pz, pz + 0.022, 0, 0.0004)
    leads = []
    for k in range(-6, 7):
        x = k * 0.026875
        mb.cbox(x - 0.009, x + 0.009, 0.018, 0.044, pz + 0.003, pz + 0.0145, 4, 0.0006)
        if k == 0 or R.random() < 0.6:
            if k != 0:
                mb.cbox(x - 0.0062, x + 0.0062, 0.044, 0.0535, pz + 0.004, pz + 0.0128, 4, 0.0005)
            mb.cbox(x - 0.0042, x + 0.0042, 0.0535, 0.0605, pz + 0.0055, pz + 0.011, 5, 0.0008)
            side = -1 if (k < 0 or (k == 0 and R.random() < 0.5)) else 1
            xr = side * 0.142
            leads.append([(x, 0.0605, pz + 0.0083), (x + side * 0.004, 0.0585, pz + 0.007),
                          ((x + xr) / 2, 0.0565, pz + 0.004 + R.uniform(0, 0.003)), (xr, 0.075, pz + 0.004),
                          (side * 0.118, 0.15, pz + 0.004), (side * 0.062, sy, pz + 0.004 + R.uniform(0, 0.006))])
    ex.append(("cables", "fibre_leads", leads, 0.001, "cable", False))
    for sx in (-1, 1):                                                            # hinge knuckles of the cover
        mb.tube_ax("x", sx * 0.2, sx * 0.17, 0.004, 0.004, 0.0, 0.0025, 10, 1)
    # top band: the rear entry grommet, the trunk dropping in from the rack and breaking out to the spool
    gy = 0.2925
    mb.cbox(-0.032, 0.032, gy - 0.011, gy + 0.011, pz, pz + 0.0045, 5, 0.0018)
    mb.box(-0.025, 0.025, gy - 0.004, gy + 0.004, pz + 0.0045, pz + 0.0047, 4)
    ex.append(("cables", "trunk", [[(0.0, 0.55, 0.0405), (0.0, 0.40, 0.0405), (0.0, 0.33, 0.036),
                                    (0.002, 0.302, 0.022), (0.0, gy, pz + 0.006)]], 0.0026, "cable", False))
    brk = []
    for k in range(4):
        o = (k - 1.5) * 0.006
        brk.append([(o, gy - 0.008, pz + 0.004), (o * 2.5, 0.27, pz + 0.004), (o * 7, 0.248, pz + 0.006),
                    ((1 if o > 0 else -1) * 0.045, 0.228, pz + 0.008 + 0.002 * k)])
    ex.append(("cables", "fibre_breakout", brk, 0.0011, "cable", False))


def _int_ups(mb, u, hh, rin, D, pz, R, ex):
    mods, lead = [], []
    mxc, mhw, my0, my1 = ups_modules(u)            # fitted to the hold distance; hold_cy() centres C on them
    for sx in (-1, 1):                                                            # two modules at x 0.33 / 0.67
        xc = sx * mxc
        x0, x1, y0, y1 = xc - mhw, xc + mhw, my0, my1
        mb.cbox(x0 + 0.001, x1 - 0.001, y0 + 0.001, y1 - 0.001, 0.0125, 0.091, 9, 0.002, False)
        mb.cbox(x0, x1, y0, y1, 0.0905, pz, 9, 0.0016)                            # lid overlapping the case
        for yy in (y0 + 0.007, y1 - 0.007):
            for i in range(4):
                _screw(mb, xc - 0.066 + i * 0.044, yy, pz, 0.0017, 6)
        for hx in (xc - 0.032, xc + 0.032):                                       # front pull, folded strap
            mb.cbox(hx - 0.004, hx + 0.004, y0 - 0.011, y0, 0.072, 0.08, 4, 0.0008)
        mb.cbox(xc - 0.036, xc + 0.036, y0 - 0.0135, y0 - 0.0095, 0.072, 0.0815, 4, 0.0012)
        mb.cbox(xc - 0.021, xc + 0.021, y1, y1 + 0.02, 0.064, 0.094, 4, 0.0015)  # rear connector housing
        mb.box(xc - 0.016, xc + 0.016, y1 + 0.02, y1 + 0.021, 0.07, 0.088, 5)
        for o in (-0.009, 0.009):
            lead.append([(xc + o, y1 + 0.021, 0.079), (xc + o * 1.2, y1 + 0.04, 0.094 + R.uniform(0, 0.004)),
                         (xc * 0.62 + o, 0.33, 0.102 + R.uniform(-0.003, 0.003)), (xc * 0.45 + o, 0.352, 0.08),
                         (xc * 0.4 + o, 0.356, 0.05)])
    mb.cbox(-0.18, 0.18, 0.36, 0.46, 0.0125, 0.06, 9, 0.0015)                    # electronics at the rear (dark case)
    mb.cbox(-0.07, 0.07, 0.352, 0.36, 0.035, 0.058, 4, 0.001)                     # terminal block
    ex.append(("cables", "battery_leads", lead, 0.0052, "cable", False))


def _int_security(mb, u, hh, rin, D, pz, R, ex):
    mb.cbox(-rin, rin, 0.01, 0.0145, 0.0118, 0.03, 9, 0.0006)                     # the carrier's lip
    for sx in (-1, 1):                                                            # its two latches
        x = sx * 0.17
        mb.cbox(x - 0.013, x + 0.013, 0.003, 0.0102, 0.024, 0.0295, 4, 0.0008)
        mb.box(x - 0.008, x + 0.008, 0.0045, 0.0075, 0.0295, 0.0303, 7)
    n = u.get("cartridges", 4)
    cy = u.get("cart_y", 0.046)
    for k in range(n):                                                            # cradles and hinge blocks
        xk = (k - (n - 1) / 2.0) * 0.102
        for sx in (-1, 1):
            mb.cbox(xk + sx * 0.0462, xk + sx * 0.0492, cy - 0.008, cy + 0.052, 0.0138, 0.0178, 4, 0.0004)
            mb.cbox(xk + sx * 0.0462, xk + sx * 0.0505, cy - 0.006, cy + 0.006, 0.0138, 0.0205, 4, 0.0005)
        mb.tube_ax("x", xk - 0.0505, xk + 0.0505, cy, 0.0152, 0.0, 0.0012, 10, 6)
        mb.cbox(xk - 0.03, xk + 0.03, cy + 0.049, cy + 0.054, 0.0138, 0.0172, 5, 0.0008)


INTERIORS = {"switch": _int_switch, "storage": _int_storage, "server": _int_server, "fibre": _int_fibre,
             "ups": _int_ups, "security": _int_security}


def interior(mb, u, hh, rin, D, pz, R=None):
    """Each opened unit's inside, sled-local (x across, y from the front, z from the slot bottom); pz = subject
    plane above the slot bottom. Returns deferred extras (cables, pinpoints) to parent to the sled."""
    ex = []
    fn = INTERIORS.get(u["kind"])
    if fn:
        fn(mb, u, hh, rin, D, pz, R or random.Random(0), ex)
    return ex


def cartridge(mb):
    """Security cartridge, standing (face toward -y); tipped face-up on the carrier at the hold: a dark painted
    body and rim, a matte black face, one plain seal ring a shade lighter, a dark fabric pull tab."""
    mb.cbox(-0.045, 0.045, -0.0150, 0.0, 0.0, 0.046, 9, 0.0009, False)
    mb.box(-0.0405, 0.0405, -0.0156, -0.0150, 0.0045, 0.0415, 2)
    mb.tube_ax("y", -0.0163, -0.0156, 0.0, 0.0215, 0.0098, 0.0128, 40, 8)
    mb.box(-0.008, 0.008, -0.0166, -0.0156, 0.0345, 0.0405, 4)                  # the dark pull tab
    mb.tube_ax("x", -0.008, 0.008, -0.0166, 0.0345, 0.0, 0.001, 8, 4)


def unit_extras(M, coll, uid, sled, ex):
    for item in ex:
        if item[0] == "cables":
            _, nm, spl, rad, mk, cyc = item
            if spl:
                cables(f"UNIT_{uid}_{nm}", spl, rad, M[mk], coll, parent=sled, cyclic=cyc)
        elif item[0] == "pins":                                   # steady cool pinpoints, one mesh, never keyed
            _, nm, pts, h, col = item
            mb = MB()
            for x, y, z in pts:
                mb.box(x - h, x + h, y - h, y + h, z, z + 0.0003)
            o = mb.obj(f"LED_{uid}_{nm}", [M["led"]], coll, parent=sled)
            o.color = (*col, 1.0)


def _front_detail(mb, cfg, u, hh, E, R, ex):
    """The sled front of the units whose face is the sled (switch ports and jumpers, server drive bays, storage
    handles); the plate well and the status light keep their places (x -E+0.04..-E+0.21 or centred; x 0.2)."""
    kind = u["kind"]
    if kind == "switch":
        zr = (0.0072, 0.0248)
        ports = []
        for g0 in (-0.022, 0.080):
            for c in range(6):
                x = g0 + c * 0.016
                for z0 in zr:
                    mb.box(x + 0.0016, x + 0.0144, -0.0005, 0.0, z0, z0 + 0.0094, 5)
                    ports.append((x + 0.008, z0 + 0.0047))
        if (cfg["rack"].get("patch") or {}).get("unit") != u["id"]:      # else patch_cords() plugs into these ports
            jump = []
            for a, b in ((0, 13), (2, 15), (5, 19), (16, 23)):      # loopback jumpers between port pairs
                for q in (a, b):
                    xq, zq = ports[q]
                    mb.cbox(xq - 0.005, xq + 0.005, -0.022, -0.0005, zq - 0.0032, zq + 0.0032, 4, 0.0007, False)
                (xa, za), (xb, zb) = ports[a], ports[b]
                sag = R.uniform(0.022, 0.032)
                jump.append([(xa, -0.022, za), (xa, -0.04, za - 0.006), ((xa + xb) / 2 + R.uniform(-0.004, 0.004), -0.058,
                             min(za, zb) - sag), (xb, -0.04, zb - 0.006), (xb, -0.022, zb)])
            ex.append(("cables", "jumpers", jump, 0.0016, "cable", False))
    elif kind == "server":                                             # 2 x 4 bays of 3.5" carriers under the well
        for c in range(4):
            for r_ in range(2):
                x0, z0 = -0.206 + c * 0.103, 0.006 + r_ * 0.0262
                mb.cbox(x0, x0 + 0.101, -0.003, 0.0, z0, z0 + 0.0252, 4, 0.0006, False)
                mb.cbox(x0 + 0.006, x0 + 0.068, -0.0046, -0.003, z0 + 0.007, z0 + 0.018, 0, 0.0005, False)
                mb.box(x0 + 0.075, x0 + 0.084, -0.004, -0.003, z0 + 0.009, z0 + 0.016, 7)
                for k in range(3):                                     # light pipes, 6 mm apart
                    mb.box(x0 + 0.089, x0 + 0.0915, -0.0034, -0.003, z0 + 0.005 + k * 0.006, z0 + 0.0065 + k * 0.006, 5)
    elif kind == "storage":                                            # two pull handles
        for sx in (-1, 1):
            x = sx * 0.17
            for z in (hh * 0.33, hh * 0.67):
                mb.cbox(x - 0.006, x + 0.006, -0.03, 0.0, z - 0.006, z + 0.006, 1, 0.001, False)
            mb.tube_ax("z", hh * 0.3, hh * 0.7, x, -0.032, 0.0, 0.0058, 16, 1)


def build_units(cfg, M, C):
    rk, leds = cfg["rack"], cfg["leds"]
    E, sbw = rk["ear_width"] / 2, rk["static_body_width"]
    rin, rout = rk["body_width"] / 2, rk["rail_span"] / 2
    rt = (rout - rin) / 3.0                        # three telescoping members per side
    mats = unit_mats(M) + interior_mats(cfg, M)
    coll = C["units"]
    LEDP = led_positions(cfg)
    for u in resolved_units(cfg):
        uid, kind, mech = u["id"], u["kind"], u.get("mech", "none")
        hh, z0 = slot_hh(cfg, u), slot_bot(cfg, u["u"])
        if mech == "none":
            o = fixed_front(cfg, M, coll, u, hh, z0)
            if kind.startswith("server"):
                add_led(M, coll, f"LED_{uid}", o, (0.19, -0.001, hh / 2) if u["h"] == 1 else (0.2255, -0.0035, hh - 0.012),
                        leds["standby"])
            continue
        R = rng(cfg, f"interior:{uid}")
        rig = empty(f"RIG_{uid}", coll, loc=(0.0, rk["face_y"], z0))
        rig["open"] = 0.0
        D = u["depth"]
        sled_D = {"door_tray": u.get("tray_depth", D), "door_carrier": 0.26}.get(mech, D)
        pz = u["hold"]["plane_z"] - z0
        tz = {"door_tray": 0.0105, "door_carrier": 0.0118, "slide_cover": pz - 0.002}.get(mech, 0.0014)
        wall_top = sled_wall_top(cfg, u)
        rz0, rz1 = (0.012, 0.024) if mech == "door_carrier" else (hh / 2 - min(0.016, hh * 0.35), hh / 2 + min(0.016, hh * 0.35))
        objs = {}
        Lr = min(sled_D - 0.03, 0.72)
        for nm, xa, xb, ya, ins in (("rail_out", rin + 2 * rt, rout, 0.015, 0.0), ("rail_mid", rin + rt, rin + 2 * rt, 0.02, 0.0011)):
            mb = MB()
            for s in (-1, 1):
                _rail_profile(mb, s, xa, xb, ya, ya + Lr, rz0, rz1, ins)
                if nm == "rail_out":                                  # front bracket against the post, two screws
                    mb.cbox(s * (rout - 0.0012), s * (rout + 0.006), ya - 0.004, ya + 0.004, rz0 - 0.004, rz1 + 0.004, 3, 0.0006, False)
            objs[nm] = mb.obj(f"UNIT_{uid}_{nm}", mats, coll, parent=rig)
        if mech in ("door_carrier", "door_tray", "slide"):   # fixed chassis: top plate, back, fixed strip
            mb = MB()
            mb.box(-rin, rin, 0.022, D, hh - 0.002, hh, 1)
            mb.box(-rin, rin, 0.022, 0.0236, hh - 0.009, hh - 0.002, 1)          # the chassis lip, folded down
            mb.box(-rin, rin, D - 0.002, D, 0.0004, hh, 1)
            if "strip" in u:
                mb.cbox(-E, E, 0.0, 0.01, hh - u["strip"], hh, 0, 0.0008, False)
            objs["body"] = mb.obj(f"UNIT_{uid}_body", mats, coll, parent=rig)
        mb = MB()                                  # the sled: drawer, tray or carrier with its inner rails
        if mech in ("slide_lid", "slide_lid_aircover", "slide"):
            mb.cbox(-E, E, 0.0, 0.02 if mech == "slide" else 0.01, 0.0004, hh, 0, 0.0007, False)
        mb.box(-rin, rin, 0.01, sled_D, tz, tz + 0.002, 2 if mech in ("door_carrier", "door_tray", "slide_cover") else 1)
        for s in (-1, 1):
            mb.box(s * (rin - 0.0015), s * rin, 0.01, sled_D, tz, wall_top, 1)
            mb.box(s * (rin - HEM_IN), s * (rin - 0.0018), 0.012, sled_D - 0.002, wall_top - HEM_T, wall_top, 1)   # hem (wall_edge)
            mb.tube_ax("y", 0.012, sled_D - 0.002, s * (rin - 0.0011), wall_top - 0.0011, 0.0, 0.0011, 10, 1)   # rolled hem
            _rail_profile(mb, s, rin, rin + rt, 0.02, sled_D - 0.02, rz0, rz1, 0.0022)
            mb.box(s * rin, s * (rin + 0.0007), 0.02, sled_D - 0.02, rz0 + 0.0022, rz1 - 0.0022, 3)
        mb.box(-rin, rin, sled_D - 0.0015, sled_D, tz, wall_top, 1)
        ex = interior(mb, u, hh, rin, sled_D, pz, R)
        if face_part(u) == "sled":
            _front_detail(mb, cfg, u, hh, E, R, ex)
        objs["sled"] = mb.obj(f"UNIT_{uid}_sled", mats, coll, parent=rig)
        unit_extras(M, coll, uid, objs["sled"], ex)
        if mech in ("door_carrier", "door_tray", "slide_cover"):   # drop-down door or cover, hinged at its bottom
            top = hh - u.get("strip", 0.0) - 0.0008
            mb = MB()
            if mech == "slide_cover" or u.get("dark_inner"):   # the inner face (up once it drops): dark case
                mb.cbox(-E, E, 0.0, 0.0085, 0.0, top, 0, 0.0008, False)
                mb.box(-E + 0.001, E - 0.001, 0.0085, 0.01, 0.001, top - 0.001, 9)
            else:
                mb.cbox(-E, E, 0.0, 0.01, 0.0, top, 0, 0.0008, False)
            for x in (-0.205, 0.205):
                mb.box(x - 0.008, x + 0.008, -0.004, 0.0, top * 0.6, top * 0.85, 1)
                mb.cbox(x - 0.009, x + 0.009, 0.01, 0.0135, top * 0.8, top * 0.95, 4, 0.0006, False)   # latch hooks
            mb.tube_ax("x", -0.17, 0.17, 0.006, 0.0016, 0.0, 0.0016, 10, 1)                          # hinge line
            parent = objs["sled"] if part_parent(u, "front") == "sled" else rig
            objs["front"] = mb.obj(f"UNIT_{uid}_front", mats, coll, parent=parent, loc=part_rest(cfg, u, "front"))
        if mech in ("slide_lid", "slide_lid_aircover"):           # lid hinged on its rear top edge
            mb = MB(); mb.box(-rin, rin, -(D - 0.01), 0.0, -0.002, 0.0, 1)
            for s in (-1, 1):
                mb.box(s * (rin - 0.0009), s * rin, -(D - 0.01), -0.004, -0.007, -0.002, 1)
            mb.box(-rin, rin, -(D - 0.01), -(D - 0.0109), -0.007, -0.002, 1)
            for x in (-0.15, 0.15):
                mb.tube_ax("x", x - 0.03, x + 0.03, -0.0015, -0.0012, 0.0, 0.0018, 10, 1)
            objs["lid"] = mb.obj(f"UNIT_{uid}_lid", mats, coll, parent=objs["sled"], loc=part_rest(cfg, u, "lid"))
        if mech == "slide_lid_aircover":                          # black air cover over processors and memory
            mb = MB()
            mb.cbox(-0.175, 0.175, -0.15, 0.0, 0.0, 0.004, 4, 0.0012)
            for s in (-1, 1):
                mb.box(s * 0.173, s * 0.175, -0.15, 0.0, -0.05, 0.004, 4)
                mb.cbox(s * 0.058, s * 0.062, -0.146, -0.004, 0.004, 0.0065, 4, 0.0008)
            mb.box(-0.175, 0.175, -0.15, -0.147, -0.012, 0.0, 4)
            mb.box(-0.0012, 0.0012, -0.15, 0.0, -0.03, 0.0, 4)
            objs["aircover"] = mb.obj(f"UNIT_{uid}_aircover", mats, coll, parent=objs["sled"],
                                      loc=part_rest(cfg, u, "aircover"))
        if mech == "door_carrier":                                # four cartridges, pivot on the bottom-rear edge
            for k in range(u.get("cartridges", 4)):
                mb = MB()
                cartridge(mb)
                nm = f"cart{k + 1}"
                objs[nm] = mb.obj(f"UNIT_{uid}_{nm}", mats, coll, parent=objs["sled"], loc=part_rest(cfg, u, nm))
        fp = objs[face_part(u)]                    # label well (170 x 20 mm), status light and its tiny amber light
        zc = led_face_z(cfg, u)
        lx, ldz = LEDP.get(uid, (0.2, 0.0))
        xl, xr = (-0.085, 0.085) if kind == "storage" else (-E + 0.04, -E + 0.21)
        mb = MB(); mb.quad([(xl, -0.0003, zc - 0.01), (xr, -0.0003, zc - 0.01), (xr, -0.0003, zc + 0.01), (xl, -0.0003, zc + 0.01)])
        mb.obj(f"PLATE_{uid}_title", [M["plate"]], coll, parent=fp)
        add_led(M, coll, f"LED_{uid}", fp, (lx, -0.001, zc + ldz), leds["cool"])
        ld = bpy.data.lights.new(f"LGT_amber_{uid}", "POINT")
        ld.energy, ld.color, ld.shadow_soft_size = 0.0, tuple(leds["amber"]), 0.003
        lo = bpy.data.objects.new(f"LGT_amber_{uid}", ld)
        C["lights"].objects.link(lo)
        lo.parent, lo.location = fp, (lx, -0.02, zc + ldz)
        if kind == "fibre":                        # the one connector that turns amber: the middle plug's body
            mb = MB(); mb.cbox(-0.0062, 0.0062, 0.044, 0.0535, pz + 0.004, pz + 0.0128, 0, 0.0005)
            o = mb.obj(f"LED_{uid}_conn", [M["led"]], coll, parent=objs["sled"])
            o.color = (*leds["cool"], 1.0)


# ------------------------------------------------------------------ lights, cameras, request
def light_kelvin(ld, kelvin):
    """Physical colour temperature (Blender 5.x light.temperature); the RGB tint stays white."""
    if kelvin and setattr_safe(ld, "use_temperature", True):
        ld.temperature, ld.color = float(kelvin), (1.0, 1.0, 1.0)
    return tuple(getattr(ld, "temperature_color", ld.color))


def light_opts(ld, d):
    """Shared light options from config: spread, specular/volume factors, custom distance, jittered shadows."""
    if "spread_deg" in d:
        setattr_safe(ld, "spread", math.radians(d["spread_deg"]))
    for key, attr in (("specular", "specular_factor"), ("volume", "volume_factor"), ("diffuse", "diffuse_factor")):
        if key in d:
            setattr_safe(ld, attr, float(d[key]))
    if d.get("cutoff_m"):
        setattr_safe(ld, "use_custom_distance", True)
        setattr_safe(ld, "cutoff_distance", float(d["cutoff_m"]))
    if "shadow_res" in d:                              # world-space texel size: soft far lights need few pages
        setattr_safe(ld, "shadow_maximum_resolution", float(d["shadow_res"]))
    if "jitter" in d:
        setattr_safe(ld, "use_shadow_jitter", bool(d["jitter"]))
        setattr_safe(ld, "shadow_jitter_overblur", float(d.get("overblur", 0.0)))


def link_lights(lights, prefixes, state, name):
    """Light linking (EEVEE 5.2 honours it per object, and per instancer for collection instances): `lights`
    receive a shared collection of the objects named with `prefixes`, each EXCLUDEd (a gaffer's flag) or, with
    INCLUDE, the only objects they light."""
    lk_ = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for ob in bpy.data.objects:
        if ob.name.startswith(tuple(prefixes)) and (ob.type == "MESH" or ob.type == "CURVE" or
                                                    (ob.type == "EMPTY" and ob.instance_collection is not None)):
            if ob.name not in lk_.objects:
                lk_.objects.link(ob)
    for o in lights:
        o.light_linking.receiver_collection = lk_
    for co in lk_.collection_objects:
        co.light_linking.link_state = state
    return lk_


def _strip_profile(S, x, y, hx, hy, end, frame_m):
    """Emission across a linear diffuser (x, y measured from its centre; half sizes hx, hy, long axis y):
    1 at the centre falling to `end` at the caps, and a darker frame_m-wide border (no flat paper plate)."""
    t = S.math("DIVIDE", S.math("ABSOLUTE", y), hy)
    lon = S.mad(S.math("MULTIPLY", t, t), -(1.0 - end), 1.0)
    e = S.math("MINIMUM", S.math("SUBTRACT", hx, S.math("ABSOLUTE", x)), S.math("SUBTRACT", hy, S.math("ABSOLUTE", y)))
    return S.math("MULTIPLY", lon, S.mad(S.smooth(e, 0.0, frame_m), 0.65, 0.35))


def mat_wash_diffuser(name, color, strength, lx, y0, length, pitch, width, prof):
    """One wash line's diffusers: fixtures every `pitch` from y0 along a line at x = lx (object = world)."""
    m, p, nt = mat_p(name, (0.01, 0.01, 0.01), 0.35)
    p.inputs["Emission Color"].default_value = (*color, 1.0)
    S = SN(nt)
    x, y, _ = S.sep(S.out("tc", "Object"))
    c0 = y0 + length / 2
    dy = S.math("MULTIPLY", S.math("SUBTRACT", S.math("FRACT", S.math("ADD", S.math("DIVIDE", S.math("SUBTRACT", y, c0), pitch), 0.5)), 0.5), pitch)
    S.put(p.inputs["Emission Strength"], S.math("MULTIPLY", _strip_profile(S, S.math("SUBTRACT", x, lx), dy, width / 2,
                                                                         length / 2 - 0.02, prof["end"], prof["frame_m"]), strength))
    return m


def area_light(name, coll, size, energy, d, loc, rot=(0.0, 0.0, 0.0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape, ld.size, ld.size_y, ld.energy = "RECTANGLE", size[0], size[1], energy
    tc = light_kelvin(ld, d.get("kelvin"))
    light_opts(ld, d)
    o = bpy.data.objects.new(name, ld); coll.objects.link(o)
    o.location, o.rotation_euler = loc, rot
    return o, tc


def build_lights_cams(cfg, M, C):
    """The only lights (storyboard section 4): a dim 7000 K wash from linear fixtures hung over the aisles under a
    dark ceiling (real inverse-square falloff, nothing lit where a hall has no lamp), the 5500 K bay strip above
    the cabinet's front (a soft area source, no cone), a faint fill riding with the camera, and the amber
    request lights (tiny, shaped, cut off at a hand's width)."""
    L, hl = cfg["lights"], cfg["hall"]
    w, fx = L["wash"], L["wash"]["fixture"]
    x0, x1, y0, y1 = hl["floor"]
    cz = w["ceiling_z"]
    mc = mat_p("MAT_ceiling", tuple(w["ceiling"][:3]), w["ceiling"][3])[0]
    mb = MB(); mb.box(x0, x1, y0, y1, cz, cz + 0.06)
    mb.obj("ENV_ceiling", [mc], C["hall"])
    first, washes, ups = True, {}, []
    prof = fx.get("profile", {"end": 0.7, "frame_m": 0.01})
    for ln in w["lines"]:
        md = None
        mb, k, y = MB(), 0, ln["y"][0]
        z = ln["z"]
        while y + fx["length"] <= ln["y"][1] + 1e-6:
            cy = y + fx["length"] / 2
            name = "LGT_wash" if first else f"LGT_wash_{ln['name']}_{k:02d}"
            first = False
            o, tc = area_light(name, C["lights"], (fx["width"], fx["length"]), ln["energy"], w, (ln["x"], cy, z - 0.006))
            fl_ = ln.get("flag", w.get("exclude") if ln.get("flag_roofs", True) else None)
            if fl_:
                washes.setdefault(tuple(fl_), []).append(o)
            if fx.get("up", 0.0) > 0.0:                  # direct/indirect pendant: a share thrown up at the ceiling
                uo, _ = area_light(name + "_up" if name != "LGT_wash" else "LGT_wash_up", C["lights"],
                                   (fx["width"], fx["length"]), ln["energy"] * fx["up"], w, (ln["x"], cy, z + 0.062),
                                   (PI, 0.0, 0.0))
                setattr_safe(uo.data, "use_shadow", False)
                ups.append(uo)
            if md is None:
                md = mat_wash_diffuser(f"MAT_wash_diffuser_{ln['name']}", tc[:3], fx["emission"], ln["x"], ln["y"][0],
                                       fx["length"], fx["pitch"], fx["width"], prof)
            hw, hy = fx["width"] / 2 + 0.015, fx["length"] / 2
            mb.box(ln["x"] - hw, ln["x"] + hw, cy - hy, cy + hy, z + 0.003, z + 0.055, 0)          # housing
            mb.box(ln["x"] - fx["width"] / 2, ln["x"] + fx["width"] / 2, cy - hy + 0.02, cy + hy - 0.02,
                   z - 0.004, z + 0.003, 1)                                                          # diffuser
            for s in (-1, 1):                                                                        # hanger wires
                mb.box(ln["x"] - 0.002, ln["x"] + 0.002, cy + s * (hy - 0.15) - 0.002, cy + s * (hy - 0.15) + 0.002,
                       z + 0.055, cz, 2)
            y += fx["pitch"]
            k += 1
        mb.obj(f"ENV_wash_line_{ln['name']}", [M["rack"], md, M["post"]], C["lights"])
    for i_, (pre_, los_) in enumerate(sorted(washes.items())):   # aisle fixtures flagged off the cabinet roofs below
        link_lights(los_, list(pre_), "EXCLUDE", f"LINK_wash_flagged_{i_}")
    if fx.get("up_exclude") and ups:                   # the up-lights wash the slab, not the services hung under it
        link_lights(ups, fx["up_exclude"], "EXCLUDE", "LINK_up_flagged")
    b = L["bay"]
    rot = (math.radians(b.get("tilt_deg", 0.0)), 0.0, 0.0)
    if b.get("type", "AREA") == "SPOT":            # a soft, fully blended cone aimed at the cabinet front (EEVEE
        ld = bpy.data.lights.new("LGT_bay", "SPOT")  # ignores area spread): keeps the floor below out of the beam
        ld.energy, ld.spot_size, ld.spot_blend = 0.0, math.radians(b["size_deg"]), b["blend"]
        ld.shadow_soft_size = b["radius"]
        tc = light_kelvin(ld, b.get("kelvin"))
        light_opts(ld, b)
        o = bpy.data.objects.new("LGT_bay", ld); C["lights"].objects.link(o)
        o.location, o.rotation_euler = tuple(b["pos"]), rot
    else:
        o, tc = area_light("LGT_bay", C["lights"], tuple(b["size"]), 0.0, b, tuple(b["pos"]), rot)
    b["color"] = [round(c, 4) for c in tc[:3]]          # the fixture's keyed emission tint (bake)
    if b.get("exclude"):                               # flagged off the floor (light linking), as a gaffer would flag a
        link_lights([o], b["exclude"], "EXCLUDE", "LINK_bay_flagged")   # key off the set floor and the roofs
    bt_ = {k: v for k, v in b.items() if k not in ("jitter", "overblur", "shadow_res")}   # twins: the strip's light,
    ft_ = b.get("floor_twin")                          # plain shadows (jittered shadows only on the strip itself)
    if ft_:                                            # the same strip, lighting only the floor: a soft pool in front
        of, _ = area_light("LGT_bay_floor", C["lights"], tuple(b["size"]), 0.0, bt_, tuple(b["pos"]), rot)   # of the rack
        link_lights([of], ft_.get("include", ["ENV_floor", "ENV_vent_tile"]), "INCLUDE", "LINK_bay_floor")
    dt_ = b.get("door_twin")
    if dt_:                                            # the same strip, lighting only the hero door (G2' R2): the door
        od, _ = area_light("LGT_bay_door", C["lights"], tuple(b["size"]), 0.0, bt_, tuple(b["pos"]), rot)   # its own
        od.data.use_shadow = bool(dt_.get("shadow", False))   # share; it lights only the flat door sheet: no shadow maps
        link_lights([od], dt_.get("include", ["HERO_rack_door"]), "INCLUDE", "LINK_bay_door")

    bx, by, bz = b["pos"]
    sx, sy = b["size"][0] / 2, b["size"][1] / 2
    fnt = M["fixture"].node_tree                       # the strip's diffuser: brighter in the middle, a darker frame
    S_ = SN(fnt)
    fx_, fy_, _ = S_.sep(S_.out("tc", "Object"))
    bp = b.get("profile", prof)
    S_.put(next(n for n in fnt.nodes if n.type == "BSDF_PRINCIPLED").inputs["Emission Strength"],
           S_.math("MULTIPLY", _strip_profile(S_, S_.math("SUBTRACT", fy_, by), S_.math("SUBTRACT", fx_, bx), sy, sx,
                                              bp["end"], bp["frame_m"]), b["fixture_emission"]))
    mb = MB()                                          # a lamp: dark body, the diffuser recessed 15 mm inside a
    lt, lb, ec = 0.006, bz + 0.02, 0.025               # housing lip, end caps; the lip's bottom edge is the lowest
    mb.box(bx - sx - ec, bx + sx + ec, by - sy - lt, by + sy + lt, bz + 0.035, bz + 0.055, 0)          # body
    mb.box(bx - sx, bx + sx, by - sy, by + sy, bz + 0.033, bz + 0.035, 1)                                # diffuser
    for yy in ((by - sy - lt, by - sy), (by + sy, by + sy + lt)):                                       # long lips
        mb.box(bx - sx - ec, bx + sx + ec, yy[0], yy[1], lb, bz + 0.035, 0)
    for xx in ((bx - sx - ec, bx - sx), (bx + sx, bx + sx + ec)):                                       # end caps
        mb.box(xx[0], xx[1], by - sy, by + sy, lb, bz + 0.035, 0)
    fo = mb.obj("ENV_bay_fixture", [M["rack"], M["fixture"]], C["lights"])
    fo.color = (0.0, 0.0, 0.0, 1.0)
    for s in (-1, 1):                                  # hangers as their own objects (tight clearance boxes)
        mb = MB(); mb.box(bx + s * sx - 0.0015, bx + s * sx + 0.0015, by - 0.0015, by + 0.0015, bz + 0.055, cz)
        mb.obj(f"ENV_bay_hanger_{'LR'[s > 0]}", [M["dark"]], C["lights"])   # at the ends: outside the epilogue tail
    f = L["fill"]
    ld = bpy.data.lights.new("LGT_fill", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = f["energy"], (1.0, 1.0, 1.0), f.get("radius", 0.25)
    light_kelvin(ld, f.get("kelvin"))
    light_opts(ld, f)
    o = bpy.data.objects.new("LGT_fill", ld); C["lights"].objects.link(o)
    am = L["amber"]
    for o in [o for o in bpy.data.objects if o.name.startswith("LGT_amber_")]:
        ld = o.data                                     # status light: a tiny spot facing out of the unit's front
        ld.type = "SPOT"
        ld = o.data
        ld.spot_size, ld.spot_blend = math.radians(am["size_deg"]), am["blend"]
        ld.shadow_soft_size = am["radius"]
        light_opts(ld, am)
        o.rotation_euler = (math.radians(am["tilt_deg"]), 0.0, 0.0)
        o.location = (o.location[0], am["y"], o.location[2])
    aim = empty("AIM_main", C["camera"])
    lk = cfg["look"]
    for key in ("landscape", "portrait"):
        cc = cfg["cameras"][key]
        cd = bpy.data.cameras.new(cc["name"])
        cd.lens, cd.sensor_width, cd.sensor_fit = cc["lens_mm"], cc["sensor_mm"], "AUTO"
        cd.clip_start, cd.clip_end = 0.02, 80.0
        cd.dof.use_dof = bool(lk["dof"]["enabled"])
        cd.dof.focus_object = aim
        cd.dof.aperture_fstop = lk["dof"]["fstop_long"]
        o = bpy.data.objects.new(cc["name"], cd); C["camera"].objects.link(o)
        o.rotation_mode = "XYZ"
    bpy.context.scene.camera = O(cfg["cameras"]["landscape"]["name"])
    rq = cfg["request"]
    bm = bmesh.new()
    seg = rq.get("look", {}).get("segments", [16, 10])
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=rq["radius"])
    for fc in bm.faces:
        fc.smooth = True                                   # the emission profile reads N.V: no facets
    me = bpy.data.meshes.new("HERO_request"); bm.to_mesh(me); bm.free()
    me.materials.append(M["request"])
    o = bpy.data.objects.new("HERO_request", me); C["rack"].objects.link(o)
    setattr_safe(o, "visible_shadow", False)               # LGT_request sits inside the bead
    ld = bpy.data.lights.new("LGT_request", "POINT")
    ld.energy, ld.color, ld.shadow_soft_size = 0.0, tuple(cfg["leds"]["amber"]), rq["radius"]
    light_opts(ld, cfg["lights"]["request"])
    cut = rq.get("look", {}).get("light_cutoff_m")
    if cut:                                                # warms metal within a hand's width, no farther
        setattr_safe(ld, "use_custom_distance", True)
        setattr_safe(ld, "cutoff_distance", float(cut))
    lo = bpy.data.objects.new("LGT_request", ld); C["lights"].objects.link(lo)
    lo.parent = o
    if cfg["lights"]["request"].get("exclude"):            # the riser it climbs is flagged off it: no lit streak
        link_lights([lo], cfg["lights"]["request"]["exclude"], "EXCLUDE", "LINK_request_flagged")


# ------------------------------------------------------------------ baking keys
IPO = {"CONSTANT": 0, "LINEAR": 1, "BEZIER": 2}


def find_fcurve(idb, path, index):
    ad = idb.animation_data
    act, slot = ad.action, getattr(ad, "action_slot", None)
    fcs = None
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(act, slot)
        if cb is not None:
            fcs = cb.fcurves
    except Exception:
        fcs = None
    if fcs is None and hasattr(act, "layers"):
        for layer in act.layers:
            for strip in layer.strips:
                cb = strip.channelbag(slot)
                if cb is not None:
                    fcs = cb.fcurves
    if fcs is None:
        fcs = act.fcurves
    return fcs.find(path, index=index)


def anim(idb, path, index, frames, values, interp="LINEAR"):
    vals = [float(v) for v in values]
    n = len(vals)
    if interp == "CONSTANT":
        pts = [(f, v) for i, (f, v) in enumerate(zip(frames, vals)) if i == 0 or v != vals[i - 1]]
    else:
        pts = [(f, v) for i, (f, v) in enumerate(zip(frames, vals))
               if i == 0 or i == n - 1 or not (vals[i - 1] == v == vals[i + 1])]
    kw = {"frame": frames[0]}
    if index >= 0:
        kw["index"] = index
    idb.keyframe_insert(path, **kw)
    fc = find_fcurve(idb, path, max(index, 0))
    kps = fc.keyframe_points
    while len(kps):
        kps.remove(kps[0], fast=True)
    kps.add(len(pts))
    kps.foreach_set("co", [c for p in pts for c in p])
    try:
        kps.foreach_set("interpolation", [IPO[interp]] * len(pts))
    except Exception:
        for k in kps:
            k.interpolation = interp
    fc.update()
    return len(pts)


def anim_vec(idb, path, frames, vecs, interp="LINEAR", only_varying=False):
    n = 0
    for i in range(len(vecs[0])):
        col = [v[i] for v in vecs]
        if only_varying and max(col) - min(col) < 1e-12:
            continue
        n += anim(idb, path, i, frames, col, interp)
    return n


def bake(cfg):
    sc = bpy.context.scene
    ft = film_table(cfg)
    g0, g1 = ft[0]["a"], ft[-1]["b"]
    sc.frame_start, sc.frame_end = g0, g1
    F = list(range(g0, g1 + 1))
    path = build_path(cfg)
    P = [pose_at(cfg, path, f) for f in F]
    keys = 0
    cam, camp = O(cfg["cameras"]["landscape"]["name"]), O(cfg["cameras"]["portrait"]["name"])
    pos = [(p["x"], p["y"], p["z"]) for p in P]
    rot = [cam_euler(p["yaw"], p["pitch"]) for p in P]
    keys += anim_vec(cam, "location", F, pos) + anim_vec(cam, "rotation_euler", F, rot)
    keys += anim_vec(camp, "location", F, [portrait_of(p) for p in P]) + anim_vec(camp, "rotation_euler", F, rot)
    for cd, sx, sy in ((cam.data, "sx", "sy"), (camp.data, "psx", "psy")):
        keys += anim(cd, "shift_x", -1, F, [p[sx] for p in P]) + anim(cd, "shift_y", -1, F, [p[sy] for p in P])
        keys += anim(cd, "dof.aperture_fstop", -1, F, [p["fstop"] for p in P])
    keys += anim_vec(O("AIM_main"), "location", F,
                     [v_add(q, v_mul(cam_axes(p["yaw"], p["pitch"])[2], p["focus"])) for q, p in zip(pos, P)])
    keys += anim_vec(O("LGT_fill"), "location", F, [v_add(q, tuple(cfg["lights"]["fill"]["offset"])) for q in pos])
    fl_ = cfg["lights"]["fill"]                      # the fill rides the bay level: never more than a share of it;
    keys += anim(O("LGT_fill").data, "energy", -1, F,   # films may key a multiplier while the camera moves (`fill`)
                 [fl_["energy"] * (bay_level(cfg, f) if fl_.get("follow_bay") else 1.0) * fill_level(cfg, f) for f in F])
    ub = {u["id"]: u for u in resolved_units(cfg)}
    for rid, ks in rig_keys(cfg).items():
        opens = [pw_linear(ks, f) for f in F]
        keys += anim(O(f"RIG_{rid}"), '["open"]', -1, F, opens)
        if rid == "door":
            ang = math.radians(cfg["rack"]["door"]["open_deg"])
            keys += anim(O("HERO_rack_door"), "rotation_euler", 2, F, [-ang * ease(o, 0.0, 1.0) for o in opens])
            co = cfg["rack"]["door"].get("cut_open", 0.05)  # the cut sheet whenever the door is (nearly) shut: the hero
            swung = [o > co for o in opens]                 # end and the epilogue; the band-limited sheet while it swings
            for nm, hide in (("HERO_rack_door_cut", [1.0 if s else 0.0 for s in swung]),
                             ("HERO_rack_door_sheet", [0.0 if s else 1.0 for s in swung])):
                ob = bpy.data.objects.get(nm)
                if ob is not None:
                    keys += anim(ob, "hide_render", -1, F, hide, "CONSTANT") + anim(ob, "hide_viewport", -1, F, hide, "CONSTANT")
            continue
        u = ub[rid]
        for part in rig_parts(u):
            tr = [part_local(cfg, u, part, o) for o in opens]
            ob = O(f"UNIT_{rid}_{part}")
            keys += anim_vec(ob, "location", F, [t[0] for t in tr], only_varying=True)
            keys += anim_vec(ob, "rotation_euler", F, [t[1] for t in tr], only_varying=True)
    lc = cfg["leds"]
    ag = lc.get("amber_gain", 1.0)                    # amber lenses below the cool ones' strength: saturated, not cream
    cool, amber = (*lc["cool"], 1.0), (*[c * ag for c in lc["amber"]], 1.0)
    cg = lc.get("conn_gain", 1.0)                     # the lit connector is a 12 mm body, not a 4 mm lens: dimmer still
    for uid, gf in amber_frames(cfg).items():
        for nm, k_ in ((f"LED_{uid}", 1.0), (f"LED_{uid}_conn", cg)):
            ob = bpy.data.objects.get(nm)
            if ob is not None:
                keys += anim_vec(ob, "color", [g0, gf], [tuple(c * k_ for c in cool[:3]) + (1.0,),
                                                         tuple(c * k_ for c in amber[:3]) + (1.0,)], "CONSTANT")
        keys += anim(O(f"LGT_amber_{uid}").data, "energy", -1, [g0, gf], [0.0, lc["amber_light_w"]], "CONSTANT")
    lvl = [bay_level(cfg, f) for f in F]
    keys += anim(O("LGT_bay").data, "energy", -1, F, [cfg["lights"]["bay"]["energy"] * l for l in lvl])
    tw_ = cfg["lights"]["bay"].get("floor_twin")
    if tw_ and bpy.data.objects.get("LGT_bay_floor") is not None:
        tk = [tuple(k) for k in tw_["keys"]] if tw_.get("keys") else None     # share of the bay, keyed by scene frame
        keys += anim(O("LGT_bay_floor").data, "energy", -1, F, [cfg["lights"]["bay"]["energy"] * l *
                                                               (pw_eased(tk, f) if tk else tw_["share"] * (1.0 - ease(f, *tw_["off"])))
                                                               for f, l in zip(F, lvl)])
    dt_ = cfg["lights"]["bay"].get("door_twin")
    if dt_ and bpy.data.objects.get("LGT_bay_door") is not None:
        dk = [tuple(k) for k in dt_["keys"]]          # share of the bay on the hero door, keyed by scene frame
        keys += anim(O("LGT_bay_door").data, "energy", -1, F, [cfg["lights"]["bay"]["energy"] * l * pw_eased(dk, f)
                                                              for f, l in zip(F, lvl)])
    bc = cfg["lights"]["bay"]["color"]
    keys += anim_vec(O("ENV_bay_fixture"), "color", F, [(bc[0] * l, bc[1] * l, bc[2] * l, 1.0) for l in lvl])
    keys += anim(O("VOL_haze"), "color", 3, F, [haze_level(cfg, f) for f in F])
    vu = bpy.data.objects.get("VOL_upper")            # the exit's ceiling fog: level on color alpha, hidden while 0
    if vu is not None:
        ul = [upper_level(cfg, f) for f in F]
        keys += anim(vu, "color", 3, F, ul)
        keys += anim(vu, "hide_render", -1, F, [1.0 if l <= 0.0 else 0.0 for l in ul], "CONSTANT")
        keys += anim(vu, "hide_viewport", -1, F, [1.0 if l <= 0.0 else 0.0 for l in ul], "CONSTANT")
    rf_ = bpy.data.objects.get("ENV_fibre_riser_fade")   # the riser swaps to its height-faded twin (riser_fade_from)
    if rf_ is not None:
        on = [riser_fade_on(cfg, f) for f in F]
        for ob, hide in ((O("ENV_fibre_riser"), [1.0 if o else 0.0 for o in on]), (rf_, [0.0 if o else 1.0 for o in on])):
            keys += anim(ob, "hide_render", -1, F, hide, "CONSTANT") + anim(ob, "hide_viewport", -1, F, hide, "CONSTANT")
    uk = film_keys(cfg, "uplight")                    # the pendants' up-light share, eased while the camera moves
    if uk:
        for o in [o for o in bpy.data.objects if o.type == "LIGHT" and o.name.startswith("LGT_wash") and o.name.endswith("_up")]:
            keys += anim(o.data, "energy", -1, F, [o.data.energy * pw_eased(uk, f) for f in F])
    keys += anim(sc, "view_settings.exposure", -1, F, [exposure_at(cfg, f) for f in F])
    RS = [request_state(cfg, f) for f in F]
    req = O("HERO_request")
    keys += anim_vec(req, "location", F, [s[1] for s in RS])
    keys += anim_vec(req, "scale", F, [(max(s[2], 0.02) * request_grow(cfg, f),) * 3 for s, f in zip(RS, F)])
    keys += anim(req, "hide_render", -1, F, [0.0 if s[0] else 1.0 for s in RS], "CONSTANT")
    keys += anim(req, "hide_viewport", -1, F, [0.0 if s[0] else 1.0 for s in RS], "CONSTANT")
    mq = bpy.data.materials.get("MAT_request")         # the reply's glow lobe widens into a lamp (request.glow_width)
    if mq is not None and "REQ_glow_w" in mq.node_tree.nodes and any((fl.get("request") or {}).get("glow_width") for fl in ft):
        keys += anim(mq.node_tree, 'nodes["REQ_glow_w"].inputs[1].default_value', -1, F,
                     [-1.0 / request_glow_width(cfg, f) for f in F])
    if any(fl.get("request", {}).get("volume") for fl in ft):   # the lamp-in-fog halo (request.volume keys)
        keys += anim(O("LGT_request").data, "volume_factor", -1, F, [request_volume(cfg, f) for f in F])
    keys += bake_look(cfg, F)
    keys += key_request_gain(cfg, F, "landscape", path, P)    # the bead's gain and its light (per camera: render)
    sc.frame_set(ft[0]["b"])
    return {"keys": keys, "frames": [g0, g1]}


# ------------------------------------------------------------------ commands
REQUIRED = ["HERO_rack_frame", "UNIT_u40_sled", "RIG_u40", "ENV_floor", "CAM_main", "CAM_portrait", "AIM_main",
            "LGT_bay", "LGT_wash", "LGT_fill", "VOL_haze", "VOL_upper", "ENV_fibre_riser_fade", "PLATE_u40_title"]


def build(cfg, stage="all", blend_path=None):
    if stage in ("all", "geometry"):
        wipe()
        setup_scene(cfg)
        M = materials(cfg)
        C = {k: new_coll(n) for k, n in (("hall", "HALL"), ("rack", "RACK"), ("units", "UNITS"),
                                           ("lights", "LIGHTS"), ("camera", "CAMERA"))}
        build_hall(cfg, M, C)
        build_rack(cfg, M, C)
        build_units(cfg, M, C)
        build_lights_cams(cfg, M, C)
        build_compositor(cfg)
    out = {"stage": stage, "objects": len(bpy.data.objects), "missing": [n for n in REQUIRED if n not in bpy.data.objects]}
    if stage in ("all", "anim"):
        out["bake"] = bake(cfg)
    if not HOSTED and blend_path:
        # Local runs keep the built scene so check / preview / render / export open it instead of rebuilding.
        os.makedirs(os.path.dirname(blend_path), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
        out["blend"] = blend_path
    return out


def _aabb(ob, M):
    pts = [M @ Vector(c) for c in ob.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def _part_matrix(cfg, u, part, o):
    M = Matrix.Translation(O(f"RIG_{u['id']}").location)
    if part in ("rail_out", "body"):
        return M
    for p in ([part] if part_parent(u, part) == "rig" else ["sled", part]):
        loc, rot = part_local(cfg, u, p, o)
        M = M @ Matrix.Translation(loc) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    return M


def _overlap(a, b, tol=3e-4):
    return all(a[0][i] < b[1][i] - tol and b[0][i] < a[1][i] - tol for i in range(3))


def _local_box(ob):
    c = [Vector(v) for v in ob.bound_box]
    return [min(v[i] for v in c) for i in range(3)], [max(v[i] for v in c) for i in range(3)]


def _boxes(ob, M):
    """Oriented boxes (inverse matrix, local box): one per mesh, exact for rotated parts; one world-space box per
    Bezier segment of a curve (hull of its control points, padded by the bevel)."""
    if ob.type != "CURVE":
        return [(M.inverted(), _local_box(ob))]
    r, out, I = ob.data.bevel_depth, [], Matrix.Identity(4)
    for sp in ob.data.splines:
        bp = sp.bezier_points
        for a, b in zip(bp, bp[1:]):
            pts = [M @ v for v in (a.co, a.handle_right, b.handle_left, b.co)]
            out.append((I, ([min(q[i] for q in pts) - r for i in range(3)], [max(q[i] for q in pts) + r for i in range(3)])))
    return out


def _pt_box(p, bb):
    d = [max(bb[0][i] - p[i], 0.0, p[i] - bb[1][i]) for i in range(3)]
    return math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])


def clearance(cfg, path, extra=None):
    """Distance from each camera to every object's oriented box (curves: per-segment boxes) at every frame; `extra`
    {frame: [(label, position)]} adds more camera positions at a frame (the breathing tails, breath_positions)."""
    bpy.context.view_layer.update()
    ft = film_table(cfg)
    rk = rig_keys(cfg)
    skip = ("HERO_request", "VOL_haze", "VOL_upper", "LED_", "PLATE_", "LGT_", "CAM_", "AIM_")
    def rigged(o):
        while o is not None:
            if o.name.startswith("RIG_"):
                return True
            o = o.parent
        return False
    static = []
    for o in bpy.context.scene.objects:
        if o.name.startswith(skip) or rigged(o):
            continue
        if o.type in ("MESH", "CURVE"):
            static += [(o.name, bb) for bb in _boxes(o, o.matrix_world)]
        elif o.type == "EMPTY" and o.instance_collection is not None:
            for co in o.instance_collection.all_objects:
                static += [(o.name, bb) for bb in _boxes(co, o.matrix_world @ co.matrix_world)]
    moving = [(u, p) for u in opening_units(cfg) for p in rig_parts(u) + ["rail_out", "body"]
              if bpy.data.objects.get(f"UNIT_{u['id']}_{p}") is not None]
    door, drig = O("HERO_rack_door"), O("RIG_door")
    local = {o.name: _local_box(o) for o in [O(f"UNIT_{u['id']}_{p}") for u, p in moving] + [door]}
    ang = math.radians(cfg["rack"]["door"]["open_deg"])
    worst = {"landscape": (9.0, None, None), "portrait": (9.0, None, None)}
    bad = []
    for f in range(ft[0]["a"], ft[-1]["b"] + 1):
        p = pose_at(cfg, path, f)
        cams = {"landscape": (p["x"], p["y"], p["z"]), "portrait": portrait_of(p)}
        boxes = list(static)
        for u, part in moving:
            o = pw_linear(rk[u["id"]], f) if u["id"] in rk else 0.0
            ob = O(f"UNIT_{u['id']}_{part}")
            boxes.append((ob.name, (_part_matrix(cfg, u, part, o).inverted(), local[ob.name])))
        od = pw_linear(rk["door"], f) if "door" in rk else 0.0
        boxes.append(("HERO_rack_door", ((Matrix.Translation(drig.location) @ Matrix.Rotation(-ang * ease(od, 0, 1), 4, "Z")).inverted(), local[door.name])))
        for key, c in list(cams.items()) + list((extra or {}).get(f, [])):
            cv = Vector(c)
            for name, (Mi, bb) in boxes:
                d = _pt_box(Mi @ cv, bb)
                if d < worst.setdefault(key, (9.0, None, None))[0]:
                    worst[key] = (d, f, name)
                if d < cfg["hold"]["clearance_m"] and len(bad) < 40:
                    bad.append([key[0], f, name, round(d, 3)])
    return {k: {"min_m": round(v[0], 4), "frame": v[1], "object": v[2]} for k, v in worst.items()}, bad


def check(cfg, opts=None):
    opts = opts or {}
    issues, out = [], {}
    out["version"] = ".".join(str(v) for v in bpy.app.version[:3])
    if tuple(bpy.app.version[:2]) != (5, 2):
        issues.append(f"blender {out['version']} is not 5.2")
    fonts = [o.name for o in bpy.data.objects if o.type == "FONT"]
    texi = [f"{m.name}/{n.name}" for m in list(bpy.data.materials) + list(bpy.data.worlds) if m.node_tree
            for n in m.node_tree.nodes if n.type == "TEX_IMAGE"]
    texi += [f"{g.name}/{n.name}" for g in bpy.data.node_groups for n in g.nodes if n.type == "TEX_IMAGE"]
    if fonts: issues.append(f"FONT objects: {fonts}")
    if texi: issues.append(f"TEX_IMAGE nodes: {texi}")
    if any(i.source == "FILE" for i in bpy.data.images):
        issues.append("file images present")
    apply_look(cfg, bpy.context.scene, cfg["look"]["samples"]["final"])
    issues += check_compositor(cfg, bpy.context.scene)
    ng = comp_tree(bpy.context.scene)
    out["compositor"] = sorted(n.name for n in ng.nodes) if ng is not None else None
    units = resolved_units(cfg)
    occ = {}
    for u in units:
        for k in range(u["u"], u["u"] + u["h"]):
            if k in occ: issues.append(f"U{k} used by {occ[k]} and {u['id']}")
            if not 1 <= k <= cfg["rack"]["u_count"]: issues.append(f"{u['id']} outside 1..42")
            occ[k] = u["id"]
    out["u_used"] = sum(u["h"] for u in units)
    if out["u_used"] > cfg["rack"]["u_count"]: issues.append("more than 42U")
    dr_ = cfg["rack"]["door"]                      # G2': every status light frozen (rack-00...04 never move)
    loose = [u["id"] for u in opening_units(cfg) if u["id"] != dr_.get("align_led")
             and u["id"] not in (dr_.get("align_leds") or {}).get("fixed", {})]
    out["led_positions"] = {k: list(v) for k, v in led_positions(cfg).items()}
    if loose: issues.append(f"status lights not frozen in rack.door.align_leds.fixed: {loose}")
    out["missing"] = [n for n in REQUIRED if n not in bpy.data.objects]
    if out["missing"]: issues.append(f"missing {out['missing']}")
    E = cfg["rack"]["ear_width"] / 2
    at = {}
    for u in units:                                   # rest AABBs of every unit
        if u.get("mech", "none") == "none":
            ob = bpy.data.objects.get(f"UNIT_{u['id']}_{u['kind']}")
            if ob: at[u["id"]] = [_aabb(ob, Matrix.Translation(ob.location))]
        else:
            at[u["id"]] = [_aabb(O(f"UNIT_{u['id']}_{p}"), _part_matrix(cfg, u, p, 0.0))
                           for p in rig_parts(u) + ["rail_out", "body"] if p not in ("lid", "aircover")
                           and bpy.data.objects.get(f"UNIT_{u['id']}_{p}") is not None]
    sled = {}
    for u in opening_units(cfg):
        lo_z, hi_z = slot_bot(cfg, u["u"]), slot_bot(cfg, u["u"]) + u["h"] * cfg["rack"]["U"]
        nb = [v for v in units if v["u"] + v["h"] == u["u"] or v["u"] == u["u"] + u["h"]]
        res = {}
        for o in (0.0, 1.0):
            for p in rig_parts(u):
                bb = _aabb(O(f"UNIT_{u['id']}_{p}"), _part_matrix(cfg, u, p, o))
                if p in IN_SLOT and (bb[0][2] < lo_z - 3e-4 or bb[1][2] > hi_z + 3e-4 or bb[0][0] < -E - 3e-4 or bb[1][0] > E + 3e-4):
                    issues.append(f"{u['id']}.{p} leaves its slot at open={o:g}: z {bb[0][2]:.4f}..{bb[1][2]:.4f}")
                for v in nb:
                    for nbb in at.get(v["id"], []):
                        if _overlap(bb, nbb):
                            issues.append(f"{u['id']}.{p} hits {v['id']} at open={o:g}")
                if p == "sled":
                    res[f"y_front@{o:g}"] = round(bb[0][1], 4)
        sled[u["id"]] = res
    out["sleds"] = sled
    path = build_path(cfg)
    ft = film_table(cfg)
    ub = {u["id"]: u for u in units}
    tol, (cx, cy) = cfg["hold"]["tolerance"], cfg["hold"]["centre"]
    holds = {}
    for fl in ft:                                     # hold frames: the subject lands where the storyboard says
        p = pose_at(cfg, path, fl["b"])
        if fl.get("unit"):
            C, target = hold_centre(cfg, ub[fl["unit"]]), (cx, cy)
        elif fl["role"] == "hero":
            pf = cfg["poses"]["rack_front"]
            C, target = (0.0, cfg["rack"]["front_y"], pf["centre_z"]), (0.5, pf["frame_y"])
        else:
            C, target = tuple(cfg["request"]["path_out"][-1]), tuple(cfg["poses"]["point_end"]["screen"])
        row = {}
        for key, sxk, syk in (("landscape", "sx", "sy"), ("portrait", "psx", "psy")):
            pos = (p["x"], p["y"], p["z"]) if key == "landscape" else portrait_of(p)
            q = project(cfg["cameras"][key], pos, p["yaw"], p["pitch"], p[sxk], p[syk], C)
            row[key] = {"cam": [round(v, 3) for v in pos], "subject": [round(v, 4) for v in q],
                        "dist": round(v_len(v_sub(C, pos)), 4)}
            if abs(q[0] - target[0]) > tol or abs(q[1] - target[1]) > tol:
                issues.append(f"{fl['name']} {key}: subject at {q[0]:.4f},{q[1]:.4f} not {target}")
            if fl.get("unit"):                        # the walls (per-unit inner width at its own depth) in the band
                wl = hold_walls_x(cfg, ub[fl["unit"]], key, pos, p["yaw"], p["pitch"], p[sxk], p[syk])
                row[key].update({k: [round(v, 4) for v in xs] for k, xs in wl.items()})
                if not in_wall_band(cfg, key, wl["walls_x"]):
                    issues.append(f"{fl['name']} {key}: walls at {wl['walls_x'][0]:.4f}/{wl['walls_x'][1]:.4f}, "
                                  f"outside the band {cfg['hold']['wall_band'][key]}")
            elif fl["role"] == "hero":                # the rack, plinth to top, fills its share of the height
                hs = hero_height_share(cfg, key, pos, p["yaw"], p["pitch"], p[sxk], p[syk])
                row[key]["rack"] = {k: round(v, 4) for k, v in hs.items()}
                want = cfg["poses"]["rack_front"]["height_share"][key]
                if abs(hs["height"] - want) > 0.01:
                    issues.append(f"{fl['name']} {key}: rack fills {hs['height']:.3f} of the height, not {want}")
        speeds = []
        for key in ("landscape", "portrait"):
            def cpos(f):
                q = pose_at(cfg, path, f)
                return (q["x"], q["y"], q["z"]) if key == "landscape" else portrait_of(q)
            speeds.append(max(v_len(v_sub(cpos(f), cpos(f - 1))) for f in range(fl["b"] - 11, fl["b"] + 1)))
        row["rest_speed_m"] = round(max(speeds), 5)
        if max(speeds) > cfg["hold"]["rest_speed_m"] and fl["role"] != "hero":
            issues.append(f"{fl['name']}: camera moves {max(speeds) * 1000:.1f} mm/frame in its last 12 frames")
        moving_until = max([f for rid, ks in rig_keys(cfg).items() for f in range(fl["a"], fl["b"] + 1)
                            if abs(pw_linear(ks, f) - pw_linear(ks, f - 1)) > 1e-9] or [fl["a"]])
        row["mechanisms_settled_by"] = moving_until - fl["a"]
        if moving_until > fl["b"] - 10:
            issues.append(f"{fl['name']}: a mechanism moves at local f{moving_until - fl['a']} (< 10 frames before the end)")
        holds[fl["name"]] = row
    out["holds"] = holds
    named = {fl["name"]: fl for fl in ft}
    miss = [n for n in HAZE_FREE if n not in named]
    if miss: issues.append(f"haze test: films {miss} missing from the timeline")
    hz = [f for n in HAZE_FREE if n in named for f in range(named[n]["a"] + 1, named[n]["b"]) if haze_level(cfg, f) > 0]
    if hz: issues.append(f"haze present inside {HAZE_FREE[0]}..{HAZE_FREE[-1]} at {hz[:3]}")
    out["static_tails"] = {}
    for fl, a, b in static_tails(cfg):
        n = len({json.dumps(frame_state(cfg, path, f)) for f in range(a, b + 1)})
        out["static_tails"][fl["name"]] = [a - fl["a"], b - fl["a"], n]
        if n != 1:
            issues.append(f"{fl['name']}: static_tail f{a - fl['a']}-{b - fl['a']} not static ({n} states)")
    ex_ = exit_film(cfg)
    if ex_ is not None:                               # plan part five 3a: the exit's pure checks, then what the blend keys
        xc = exit_checks(cfg, path)
        out["exit"] = [("ok   " if ok_ else "FAIL ") + m_ for ok_, m_ in xc]
        issues += [m_ for ok_, m_ in xc if not ok_]
        def kv(idb, pth, f, idx=0):
            fc = find_fcurve(idb, pth, idx) if idb is not None and idb.animation_data and idb.animation_data.action else None
            return None if fc is None else fc.evaluate(f)
        vu, k0 = bpy.data.objects.get("VOL_upper"), film_keys(cfg, "upper")[0][0]
        tl_ = next(((x, y) for f_, x, y in static_tails(cfg) if f_["name"] == ex_["name"]), (ex_["b"], ex_["b"]))
        if vu is None:
            issues.append("VOL_upper missing")
        else:
            shown = [f for f in range(ft[0]["a"], k0 + 1) if (kv(vu, "hide_render", f) or 0.0) < 0.5]
            hidden_tail = [f for f in range(tl_[0], tl_[1] + 1) if (kv(vu, "hide_render", f) or 0.0) >= 0.5]
            out["vol_upper_hidden_to"] = k0
            if shown: issues.append(f"VOL_upper renders at {shown[:3]} (before the fog's first key {k0})")
            if hidden_tail: issues.append(f"VOL_upper hidden in the tail at {hidden_tail[:3]}")
        m_ = bpy.data.materials.get("MAT_request")
        ld_ = O("LGT_request").data
        gk = [kv(m_.node_tree, 'nodes["REQ_gain"].inputs[1].default_value', f) for f in range(tl_[0], tl_[1] + 1)]
        ek = [kv(ld_, "energy", f) for f in range(tl_[0], tl_[1] + 1)]
        gv, ev = request_gain_values(cfg, [tl_[1]], "landscape", path)
        ok_ = all(v is not None and math.isfinite(v) for v in gk + ek) and max(gk) - min(gk) < 1e-6 \
            and max(ek) - min(ek) < 1e-6 and abs(gk[-1] - gv[0]) <= 1e-4 * gv[0] and abs(ek[-1] - ev[0]) <= 1e-4 * ev[0]
        out["tail_gain_keyed"] = {"REQ_gain": gk[-1], "LGT_request_W": ek[-1], "pure": [gv[0], ev[0]]}
        if not ok_: issues.append(f"keyed reply gain over the tail not finite/constant/pure: {out['tail_gain_keyed']}")
        rv = [(f, kv(ld_, "volume_factor", f), request_volume(cfg, f)) for f in range(ex_["a"], ex_["b"] + 1, 6)]
        if any(v is None or abs(v - w) > 1e-5 for f, v, w in rv): issues.append(f"LGT_request volume keys != pure: {rv[:4]}")
        rz = bpy.data.objects.get("ENV_fibre_riser_fade")
        sw = [f for f in range(ft[0]["a"], ft[-1]["b"] + 1, 3)
              if rz is None or ((kv(rz, "hide_render", f) or 0.0) < 0.5) != riser_fade_on(cfg, f)
              or ((kv(O("ENV_fibre_riser"), "hide_render", f) or 0.0) >= 0.5) != riser_fade_on(cfg, f)]
        if sw: issues.append(f"riser / fade twin visibility wrong at {sw[:3]}")
    mx = mxa = 0.0
    prev = None
    for f in range(ft[0]["a"], ft[-1]["b"] + 1):
        p = pose_at(cfg, path, f)
        if prev:
            mx = max(mx, v_len(v_sub((p["x"], p["y"], p["z"]), (prev["x"], prev["y"], prev["z"]))))
            mxa = max(mxa, abs(p["pitch"] - prev["pitch"]), abs(p["yaw"] - prev["yaw"]))
        prev = p
    out["camera_max_step_m"], out["camera_max_step_deg"] = round(mx, 4), round(math.degrees(mxa), 3)
    T = exposure_targets(cfg)
    out["exposure"] = {fl["name"]: round(t, 3) for fl, t in zip(ft, T)}
    far = [fl["name"] for fl, t in zip(ft, T) if abs(t - cfg["look"]["exposure"]) > cfg["look"]["exposure_max_stops"] + 1e-6]
    if far:
        issues.append(f"exposure more than {cfg['look']['exposure_max_stops']} stops from the hero in {far}")
    out["breath"] = {fl["name"]: {k: breath_drift(cfg, path, fl, k, T) for k in cfg["cameras"]} for fl, T in breath_films(cfg)}
    lim = breath_cfg(cfg)["limits"]
    for nm, row in out["breath"].items():
        for k, d in row.items():
            if d["centre_px"] > lim["centre_px"] or d["edge_px"] > lim["edge_px"] or d["step_px"] > lim["step_px"]:
                issues.append(f"{nm} {k}: breath drift C {d['centre_px']} / edges {d['edge_px']} / step {d['step_px']} px")
    out["anchors"] = anchors_check(cfg, path)
    if out["anchors"]["max_err"] > 1e-3:
        issues.append(f"anchors: pure projection and world_to_camera_view differ by {out['anchors']['max_err']}")
    if not opts.get("no-clearance"):
        out["clearance"], bad = clearance(cfg, path, breath_positions(cfg, path))
        out["clearance_violations"] = bad
        if bad:
            issues.append(f"{len(bad)}+ camera-frames closer than {cfg['hold']['clearance_m']} m to an AABB")
    out["issues"], out["ok"] = issues, not issues
    return out


def _parse(argv):
    opts, i = {}, 0
    while i < len(argv):
        a = argv[i]
        if a.startswith("--"):
            if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                opts[a[2:]] = argv[i + 1]; i += 2
            else:
                opts[a[2:]] = True; i += 1
        else:
            opts.setdefault("_", []).append(a); i += 1
    return opts


def parse_frames(spec, film):
    if spec in (None, True):
        return list(range(film["a"], film["b"] + 1))
    out = []
    for part in str(spec).split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    if film:
        bad = [f for f in out if not film["a"] <= f <= film["b"]]
        if bad:
            raise ValueError(f"frames {bad} outside {film['name']} [{film['a']}, {film['b']}]")
    return out


def _repo_root():
    """The repository root: the nearest folder above this file holding films-src/ and scripts/ (so a frozen
    snapshot under films-src/rack/... finds the same root as scripts/films/rack/scene.py)."""
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "films-src")) and os.path.isdir(os.path.join(d, "scripts")):
            return d
        d = os.path.dirname(d)
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def render(cfg, opts):
    sc = bpy.context.scene
    ft = {f["name"]: f for f in film_table(cfg)}
    film = ft.get(opts.get("film")) if opts.get("film") else None
    camkey = opts.get("camera", "landscape")
    cc = cfg["cameras"][camkey]
    frames = parse_frames(opts.get("frames"), film)
    samples = int(opts.get("samples", cfg["look"]["samples"]["final"]))
    apply_look(cfg, sc, samples)
    sc.camera = O(cc["name"])
    comp_for_camera(cfg, sc, camkey)
    if bpy.data.objects.get("VOL_upper") is not None:   # the reply's fog gain differs per camera (its distance to the
        ft_ = film_table(cfg)                           # point): re-key the bead and its light for this camera
        key_request_gain(cfg, list(range(ft_[0]["a"], ft_[-1]["b"] + 1)), camkey)
    if opts.get("tail"):                          # part five §2e: a section hold's breathing tail (after any per-camera
        return render_tail(cfg, opts)             # setup above, which the tail shares with the masters)
    sc.render.resolution_x, sc.render.resolution_y = cc["res"]
    sc.render.resolution_percentage = int(round(float(opts.get("res-scale", 1.0)) * 100))
    bd = opts.get("border")                       # a region of the full frame, the compositor still sees the frame
    sc.render.use_border, sc.render.use_crop_to_border = bool(bd), False
    if bd:
        x0, x1, y0, y1 = (float(v) for v in str(bd).split(","))
        sc.render.border_min_x, sc.render.border_max_x = x0, x1
        sc.render.border_min_y, sc.render.border_max_y = 1.0 - y1, 1.0 - y0
    A = globals().get("artifacts")
    if A is None:
        outdir = opts.get("out") or os.path.join(_repo_root(), "films-src", "rack", "renders",
                                                 (film["name"] if film else "misc") + ("-p" if camkey == "portrait" else ""))
        os.makedirs(outdir, exist_ok=True)
    done = []
    # joins by construction: a film's first and last frames are the neighbouring films' last and first, so when the
    # neighbour's render of that frame exists it is byte-copied, never re-rendered (a re-render can differ by 1 LSB
    # in a few pixels, depending on what the process rendered before it)
    reuse = {}
    if film and A is None and not opts.get("out") and not opts.get("no-reuse"):
        base, suf = os.path.join(_repo_root(), "films-src", "rack", "renders"), ("-p" if camkey == "portrait" else "")
        for other in film_table(cfg):
            for f in (other["a"], other["b"]):
                pth = os.path.join(base, other["name"] + suf, f"f_{f:05d}.png")
                if other["name"] != film["name"] and f in (film["a"], film["b"]) and f in frames and os.path.exists(pth):
                    reuse[f] = pth
    todo = [f for f in frames if f not in reuse]
    if todo and cfg["look"]["dof"].get("jittered") and not opts.get("no-warmup"):
        # EEVEE's jittered depth of field leaves a 1-LSB difference in a pixel or two on the first render of a
        # process at a given camera / resolution; one discarded warm-up render makes every kept frame reproducible.
        sc.frame_set(todo[0])
        keep, sc.render.filepath = sc.render.filepath, os.path.join(tempfile.gettempdir(), "rack_warmup.png")
        for _ in range(int(opts.get("warmups", cfg["look"]["dof"].get("warmups", 1)))):   # the hazed hero frames need two
            bpy.ops.render.render(write_still=True)
        sc.render.filepath = keep
    for f in frames:
        name = f"f_{f:05d}.png"
        if f in reuse:
            import shutil
            shutil.copyfile(reuse[f], os.path.join(outdir, name))
            done.append({"frame": f, "file": os.path.join(outdir, name), "sec": 0.0, "copied_from": reuse[f]})
            continue
        sc.frame_set(f)
        tgt = None
        if A is not None:
            tgt = A.file(name=f"{camkey[0].upper()}_{name}", media_type="image/png")
            sc.render.filepath = str(tgt.path)
        else:
            sc.render.filepath = os.path.join(outdir, name)
        t = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        row = {"frame": f, "file": (tgt and f"{camkey[0].upper()}_{name}") or sc.render.filepath,
               "sec": round(time.perf_counter() - t, 2)}
        if opts.get("twice"):                           # determinism: the same frame rendered again, byte-compared
            first = open(sc.render.filepath, "rb").read()
            keep, sc.render.filepath = sc.render.filepath, os.path.join(tempfile.gettempdir(), f"twice_{name}")
            bpy.ops.render.render(write_still=True)
            row["identical_bytes"] = open(sc.render.filepath, "rb").read() == first
            ims = [bpy.data.images.load(pth, check_existing=False) for pth in (keep, sc.render.filepath)]
            row["identical_pixels"] = list(ims[0].pixels) == list(ims[1].pixels)
            for im in ims:
                bpy.data.images.remove(im)
            sc.render.filepath = keep
        if tgt is not None:
            tgt.publish()
        done.append(row)
    info = {"camera": cc["name"], "res": [sc.render.resolution_x * sc.render.resolution_percentage // 100,
                                          sc.render.resolution_y * sc.render.resolution_percentage // 100],
            "samples": samples, "frames": done}
    try:
        import gpu
        info["gpu"] = gpu.platform.renderer_get()
    except Exception as e:
        info["gpu"] = f"unavailable: {e}"[:120]
    return info


def _override_energy(name, value):
    """Set a light's energy for a query render, muting its keys; returns the undo."""
    ld = O(name).data
    fc = find_fcurve(ld, "energy", 0) if ld.animation_data and ld.animation_data.action else None
    old = ld.energy
    if fc is not None:
        fc.mute = True
    ld.energy = value
    def undo():
        ld.energy = old
        if fc is not None:
            fc.mute = False
    return undo


def meter(cfg, opts):
    """Light and exposure calibration (query only; nothing persists). Each frame is rendered three times to
    linear EXR (as keyed; wash off; wash and bay off) and split into wash, bay and rest; the sums
    kw*wash + kb*bay + rest, scaled by 2^ev, go through the scene's view transform at the keyed exposure and
    are measured as 8-bit Rec.709 luma: frame mean, p1, p99, and the calm box (x0,x1,y0,y1 from top) mean, p99."""
    import numpy as np
    sc = bpy.context.scene
    cc = cfg["cameras"][opts.get("camera", "landscape")]
    frames = parse_frames(opts.get("frames"), None)
    apply_look(cfg, sc, int(opts.get("samples", 4)))
    sc.camera = O(cc["name"])
    sc.render.resolution_x, sc.render.resolution_y = cc["res"]
    sc.render.resolution_percentage = int(round(float(opts.get("res-scale", 0.125)) * 100))
    nums = lambda k, d: [float(v) for v in str(opts.get(k, d)).split(",")]
    KW, KB, EV, box = nums("wash", "1"), nums("bay", "1"), nums("ev", "0"), nums("box", "0.12,0.88,0.18,0.80")
    ims, tmp = sc.render.image_settings, tempfile.gettempdir()
    out = {"camera": cc["name"], "rows": "kw, kb, ev: mean, p1, p99, calm mean, calm p99", "frames": {}}
    for f in frames:
        sc.frame_set(f)
        layers = []
        for k, off in enumerate(((), ("LGT_wash",), ("LGT_wash", "LGT_bay"))):
            undo = [_override_energy(o.name, 0.0) for n in off for o in bpy.data.objects
                    if o.type == "LIGHT" and (o.name == n or o.name.startswith(n + "_"))]
            sc.render.use_compositing = False             # linear layers: no bloom / black floor in the split
            ims.file_format, ims.color_mode, ims.color_depth = "OPEN_EXR", "RGB", "32"
            sc.render.filepath = os.path.join(tmp, f"meter_{f}_{k}.exr")
            bpy.ops.render.render(write_still=True)
            for u in undo:
                u()
            im = bpy.data.images.load(sc.render.filepath, check_existing=False)
            W, H, ch = im.size[0], im.size[1], im.channels
            a = np.empty(W * H * ch, np.float32)
            im.pixels.foreach_get(a)
            bpy.data.images.remove(im)
            layers.append(a.reshape(H, W, ch)[:, :, :3])
        wash, bay, rest = layers[0] - layers[1], layers[1] - layers[2], layers[2]
        apply_look(cfg, sc, int(opts.get("samples", 4)))          # back to PNG for the display-referred saves
        img = bpy.data.images.new("METER", W, H, alpha=False, float_buffer=True)
        buf = np.ones((H, W, 4), np.float32)
        y0, y1 = int((1 - box[3]) * H), int((1 - box[2]) * H)    # image rows run bottom-up
        x0, x1 = int(box[0] * W), int(box[1] * W)
        rows = []
        for kw in KW:
            for kb in KB:
                lin = kw * wash + kb * bay + rest
                for ev in EV:
                    buf[:, :, :3] = lin * (2.0 ** ev)
                    img.pixels.foreach_set(buf.ravel())
                    pth = os.path.join(tmp, "meter.png")
                    img.save_render(pth, scene=sc)
                    pm = bpy.data.images.load(pth, check_existing=False)
                    q = np.empty(W * H * pm.channels, np.float32)
                    pm.pixels.foreach_get(q)
                    q = q.reshape(H, W, pm.channels)
                    bpy.data.images.remove(pm)
                    Y = 255.0 * (0.2126 * q[:, :, 0] + 0.7152 * q[:, :, 1] + 0.0722 * q[:, :, 2])
                    cb = Y[y0:y1, x0:x1]
                    rows.append([kw, kb, ev, round(float(Y.mean()), 1), round(float(np.percentile(Y, 1)), 1),
                                 round(float(np.percentile(Y, 99)), 1), round(float(cb.mean()), 1),
                                 round(float(np.percentile(cb, 99)), 1)])
        bpy.data.images.remove(img)
        lum = lambda x: float((0.2126 * x[:, :, 0] + 0.7152 * x[:, :, 1] + 0.0722 * x[:, :, 2]).mean())
        out["frames"][str(f)] = {"exposure": round(sc.view_settings.exposure, 3), "res": [W, H],
                                 "linear": {"wash": round(lum(wash), 5), "bay": round(lum(bay), 5),
                                            "rest": round(lum(rest), 5)}, "rows": rows}
    return out


def plan(cfg, opts):
    """Per-frame state hashes (stub: camera, rigs, LEDs, lights, exposure, haze and the point; the
    frustum-object hashing of the plan comes with the detail stage). Every frame is reported stale."""
    ft = film_table(cfg)
    path = build_path(cfg)
    film = {f["name"]: f for f in ft}.get(opts.get("film"))
    frames = parse_frames(opts.get("frames"), film) if (film or opts.get("frames")) else \
        list(range(ft[0]["a"], ft[-1]["b"] + 1))
    hashes = {f: hashlib.sha1(json.dumps(frame_state(cfg, path, f), sort_keys=True).encode()).hexdigest()[:16]
              for f in frames}
    out = {"frames": len(frames), "range": [frames[0], frames[-1]], "stale": len(frames)}
    if opts.get("full"):
        out["hashes"] = hashes
    else:
        out["digest"] = hashlib.sha1("".join(hashes[f] for f in frames).encode()).hexdigest()[:16]
    return out


def timeline(cfg):
    fpv = cfg["frames_per_vh"]
    films = []
    for f in film_table(cfg):
        films.append({"name": f["name"], "role": f["role"], "section": f.get("section"), "unit": f.get("unit"),
                      "range": [f["a"], f["b"]], "frames": f["frames"] + 1, "segment": f["frames"],
                      "scrub_vh": round(f["frames"] / fpv, 4), "length": round(f["frames"] / fpv + 1, 4),
                      "hold_frame": f["b"],
                      "beats": [dict(b, range=[f["a"] + b["from"], f["a"] + b["to"]]) for b in f["beats"]]})
    page_anchors(cfg, films)                      # part five: tail and anchors (frame fractions) per film
    return {"schema": 1, "fps": cfg["fps"], "frames_per_vh": fpv, "frame_start": films[0]["range"][0],
            "frame_end": films[-1]["range"][1], "films": films,
            "amber": {k: v for k, v in sorted(amber_frames(cfg).items(), key=lambda kv: kv[1])},
            "cameras": {k: {"res": v["res"], "lens_mm": v["lens_mm"], "sensor_mm": v["sensor_mm"]}
                        for k, v in cfg["cameras"].items()}}


def export(cfg, opts):
    tl = timeline(cfg)
    hosted = globals().get("artifacts") is not None
    if bpy is not None and bpy.data.objects.get("RIG_u40") is not None and not opts.get("pure-anchors"):
        ub, rows, view = {u["id"]: u for u in resolved_units(cfg)}, {f["name"]: f for f in film_table(cfg)}, BpyView(cfg)
        for row in tl["films"]:                   # Blender: the anchors through world_to_camera_view, like the plates
            if row.get("anchors"):
                row["anchors"] = film_anchors(cfg, rows[row["name"]], ub[row["unit"]], view)
    out = {"timeline": tl} if hosted or opts.get("print") else \
        {"films": len(tl["films"]), "tails": {r["name"]: r["tail"] for r in tl["films"] if r.get("tail")},
         "anchors": {r["name"]: sorted(k for k, v in r["anchors"]["landscape"].items() if isinstance(v, dict)) + ["beats"]
                     for r in tl["films"] if r.get("anchors")},
         "anchors_by": "world_to_camera_view" if bpy is not None and not opts.get("pure-anchors") else "project"}
    d = None if hosted else (opts.get("out") or os.path.join(_repo_root(), "films-src", "rack", "export"))
    if opts.get("plates"):
        from bpy_extras.object_utils import world_to_camera_view
        sc = bpy.context.scene
        plates = {}
        for f in tl["films"]:
            if not f.get("unit"):
                continue
            pl = O(f"PLATE_{f['unit']}_title")
            per = {}
            for key, cc in cfg["cameras"].items():
                cam = O(cc["name"])
                sc.render.resolution_x, sc.render.resolution_y = cc["res"]
                track = []
                for fr in range(f["range"][0], f["range"][1] + 1):
                    sc.frame_set(fr)
                    cs = [world_to_camera_view(sc, cam, pl.matrix_world @ v.co) for v in pl.data.vertices]
                    track.append([fr] + [round(c, 5) for p in cs for c in (p.x, 1 - p.y, p.z)])
                per[key] = track
            plates[f["name"]] = per
        out["plates"] = {k: {c: len(v) for c, v in p.items()} for k, p in plates.items()}
        if d:
            os.makedirs(os.path.join(d, "plates"), exist_ok=True)
            for k, p in plates.items():
                with open(os.path.join(d, "plates", f"{k}.json"), "w") as fh:
                    json.dump(p, fh, separators=(",", ":"))
                with open(os.path.join(d, "plates", f"{k}-p.json"), "w") as fh:   # the portrait camera's own track
                    json.dump({"film": f"{k}-p", "portrait": p["portrait"]}, fh, separators=(",", ":"))
    if d:
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "rack.timeline.json"), "w") as fh:
            dump_timeline(tl, fh)
    return out


def _png_size(path):
    with open(path, "rb") as fh:
        h = fh.read(24)
    return int.from_bytes(h[16:20], "big"), int.from_bytes(h[20:24], "big")


def _mute(idb, path, n):
    """Mute idb's keyed channel `path` (indices 0..n-1; n = 0 for a scalar) so a value set directly is what renders;
    returns the muted fcurves (unmute them to restore the baked keys)."""
    out = []
    if not (idb.animation_data and idb.animation_data.action):
        return out
    for i in (range(n) if n else [0]):
        fc = find_fcurve(idb, path, i)
        if fc is not None and not fc.mute:
            fc.mute = True
            out.append(fc)
    return out


def tail_rig(cfg, camkey, p):
    """(apply(t), restore()) for camera `camkey` breathing about hold pose p: apply sets the camera's location,
    rotation and f-stop and the shared AIM_main (its DOF focus) to breath_cam(t) with their keys muted, so a render at
    the hold frame shows the virtual tail frame; nothing is keyed, so the baked keys are untouched. The shifts, the
    other camera, lights, haze, exposure, rigs and LEDs keep the hold frame's keyed values."""
    cam, aim = O(cfg["cameras"][camkey]["name"]), O("AIM_main")
    muted = (_mute(cam, "location", 3) + _mute(cam, "rotation_euler", 3) + _mute(cam.data, "dof.aperture_fstop", 0)
             + _mute(aim, "location", 3))
    keep = (tuple(cam.location), tuple(cam.rotation_euler), cam.data.dof.aperture_fstop, tuple(aim.location))
    def apply(t):
        c = breath_cam(cfg, p, camkey, t)
        cam.location, cam.rotation_euler = c["pos"], c["euler"]
        cam.data.dof.aperture_fstop = c["fstop"]
        aim.location = c["aim"]
        bpy.context.view_layer.update()
        return c
    def restore():
        cam.location, cam.rotation_euler, cam.data.dof.aperture_fstop, aim.location = keep
        for fc in muted:
            fc.mute = False
        bpy.context.view_layer.update()
    return apply, restore


def _parse_ks(spec, T):
    if spec in (None, True):
        return list(range(1, T + 1))
    out = []
    for part in str(spec).split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a), int(b or a) + 1))
    bad = [k for k in out if not 0 <= k <= T]
    if bad:
        raise ValueError(f"tail frames {bad} outside 0..{T}")
    return sorted(set(out))


def render_tail(cfg, opts):
    """part five §2e: `render --tail rack-0N --camera C [--frames T] [--ks 1-47] [--zero] [--master FILE|DIR]
    [--out DIR] [--res-scale s] [--samples N] [--no-link] [--no-warmup]`. Renders the film's virtual tail at its hold
    frame b: t_001 ... t_(T-1).png, and t_T.png as a hard link (os.link) of the film's f_b master, so the last tail
    frame is byte-identical to the hold key and the next film's first frame. --zero also renders k = 0 as t_000.png
    (the hold pose through the tail path: it must `cmp` equal to the master). The master must have the render's
    pixel size; without one, --no-link renders k = T instead (equal pose, but not the master's bytes)."""
    sc = bpy.context.scene
    ft = {f["name"]: f for f in film_table(cfg)}
    tails = {fl["name"]: T for fl, T in breath_films(cfg)}
    name = opts["tail"]
    if name not in ft or not ft[name].get("unit"):
        raise SystemExit(f"--tail {name}: not a film that ends on a unit's hold")
    fl = ft[name]
    camkey = opts.get("camera", "landscape")
    cc = cfg["cameras"][camkey]
    T = int(opts.get("frames") or tails.get(name) or breath_cfg(cfg)["frames"])
    ks = _parse_ks(opts.get("ks"), T)
    if opts.get("zero") and 0 not in ks:
        ks = [0] + ks
    suf = "-p" if camkey == "portrait" else ""
    renders = os.path.join(_repo_root(), "films-src", "rack", "renders")
    outdir = opts.get("out") or os.path.join(renders, f"{name}{suf}-tail")
    os.makedirs(outdir, exist_ok=True)
    samples = int(opts.get("samples", cfg["look"]["samples"]["final"]))
    apply_look(cfg, sc, samples)
    sc.camera = O(cc["name"])
    comp_for_camera(cfg, sc, camkey)
    sc.render.resolution_x, sc.render.resolution_y = cc["res"]
    sc.render.resolution_percentage = int(round(float(opts.get("res-scale", 1.0)) * 100))
    sc.render.use_border = False
    size = (sc.render.resolution_x * sc.render.resolution_percentage // 100,
            sc.render.resolution_y * sc.render.resolution_percentage // 100)
    master = opts.get("master") or os.path.join(renders, f"{name}{suf}")
    if master is not True and os.path.isdir(master):
        master = os.path.join(master, f"f_{fl['b']:05d}.png")
    link = T in ks and not opts.get("no-link")
    if link:
        if not os.path.isfile(master):
            raise SystemExit(f"no master {master} for the hard link t_{T:03d} (render f{fl['b']} first, or --no-link)")
        if _png_size(master) != size:
            raise SystemExit(f"master {master} is {_png_size(master)}, the tail renders at {size}")
    todo = [k for k in ks if not (k == T and link)]
    path = build_path(cfg)
    p = pose_at(cfg, path, fl["b"])
    sc.frame_set(fl["b"])
    apply, restore = tail_rig(cfg, camkey, p)
    done, info = [], {"film": name, "camera": cc["name"], "hold_frame": fl["b"], "frames": T, "res": list(size),
                      "samples": samples, "out": outdir}
    try:
        if todo and cfg["look"]["dof"].get("jittered") and not opts.get("no-warmup"):
            apply(todo[0] / T)                      # as render(): one discarded warm-up per process and camera
            keep, sc.render.filepath = sc.render.filepath, os.path.join(tempfile.gettempdir(), "rack_tail_warmup.png")
            for _ in range(int(opts.get("warmups", cfg["look"]["dof"].get("warmups", 1)))):
                bpy.ops.render.render(write_still=True)
            sc.render.filepath = keep
        for k in todo:
            c = apply(k / T)
            sc.render.filepath = os.path.join(outdir, f"t_{k:03d}.png")
            t0 = time.perf_counter()
            bpy.ops.render.render(write_still=True)
            done.append({"k": k, "b": round(c["b"], 5), "fstop": round(c["fstop"], 4), "file": sc.render.filepath,
                         "sec": round(time.perf_counter() - t0, 2)})
    finally:
        restore()
    if link:
        dst = os.path.join(outdir, f"t_{T:03d}.png")
        if os.path.lexists(dst):
            os.remove(dst)
        os.link(master, dst)
        done.append({"k": T, "file": dst, "hard_link_of": os.path.abspath(master), "sec": 0.0,
                     "same_inode": os.stat(dst).st_ino == os.stat(master).st_ino})
    info["tail"] = done
    secs = [r["sec"] for r in done if "hard_link_of" not in r]
    info["sec_per_frame"] = round(sum(secs) / len(secs), 2) if secs else None
    info["drift"] = breath_drift(cfg, path, fl, camkey, T)
    return info


class BpyView:
    """Projection for the page's anchors in Blender: the rig parts' matrix_world and world_to_camera_view, the same
    projection `export --plates` uses for the plate wells."""
    def __init__(self, cfg):
        from bpy_extras.object_utils import world_to_camera_view
        self.cfg, self.sc, self.w2cv = cfg, bpy.context.scene, world_to_camera_view

    def frame(self, f):
        self.sc.frame_set(f)

    def world(self, u, part, o, q):
        return tuple(O(f"UNIT_{u['id']}_{part}").matrix_world @ Vector(q))

    def proj(self, key, X):
        cc = self.cfg["cameras"][key]
        self.sc.render.resolution_x, self.sc.render.resolution_y = cc["res"]
        v = self.w2cv(self.sc, O(cc["name"]), Vector(X))
        return None if v.z <= 1e-9 else (v.x, 1 - v.y)


def dump_timeline(tl, fh):
    """rack.timeline.json as before (indent 1), with the anchors' points, rectangles and tracks on one line each."""
    held = []
    def walk(x, inside):
        if isinstance(x, dict):
            return {k: walk(v, inside or k == "anchors") for k, v in x.items()}
        if isinstance(x, list):
            if inside:
                held.append(json.dumps(x, separators=(",", ":")))
                return f"@@{len(held) - 1}@@"
            return [walk(v, inside) for v in x]
        return x
    txt = json.dumps(walk(tl, False), indent=1)
    for i, s in enumerate(held):
        txt = txt.replace(f'"@@{i}@@"', s, 1)
    fh.write(txt)


def anchors_check(cfg, path):
    """`check`: the page's anchors in pure maths (part_world + project) against Blender (matrix_world +
    world_to_camera_view) at two frames of every anchored film, and one breath frame through tail_rig against
    breath_cam's pure projection (C, the frame corners on the subject plane)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc, ub, rk = bpy.context.scene, {u["id"]: u for u in resolved_units(cfg)}, rig_keys(cfg)
    pv, bv = PureView(cfg, path), BpyView(cfg)
    worst, rows, frame0 = 0.0, {}, sc.frame_current     # restored at the end: clearance() reads the scene as it is
    for fl in film_table(cfg):
        u = ub.get(fl.get("unit") or "")
        if u is None or not anchor_parts(cfg, u):
            continue
        for f in (fl["a"] + fl["frames"] // 2, fl["b"]):
            o = pw_linear(rk[u["id"]], f) if u["id"] in rk else 0.0
            pts = [(part, q) for part, q in anchor_parts(cfg, u).values()] + [("sled", q) for q in unit_rect_corners(cfg, u)]
            pv.frame(f)
            bv.frame(f)
            for key in cfg["cameras"]:
                for part, q in pts:
                    a, b = pv.proj(key, pv.world(u, part, o, q)), bv.proj(key, bv.world(u, part, o, q))
                    d = 9.0 if (a is None) != (b is None) else 0.0 if a is None else max(abs(a[0] - b[0]), abs(a[1] - b[1]))
                    worst = max(worst, d)
                    rows[f"{fl['name']} f{f}"] = max(rows.get(f"{fl['name']} f{f}", 0.0), d)
    tail = {}
    for fl, T in breath_films(cfg)[:1]:
        p, u = pose_at(cfg, path, fl["b"]), ub[fl["unit"]]
        sc.frame_set(fl["b"])
        for key, cc in cfg["cameras"].items():
            sc.render.resolution_x, sc.render.resolution_y = cc["res"]
            apply, restore = tail_rig(cfg, key, p)
            try:
                c = apply(0.5)
                c0 = breath_cam(cfg, p, key, 0.0)
                C = hold_centre(cfg, u)
                X = [C] + [q for q in (unproject_ax(cc, c0["pos"], c0["axes"], c0["sx"], c0["sy"], fx, fy, C[2])
                                       for fx in (0.0, 1.0) for fy in (0.0, 1.0)) if q is not None]
                d = 0.0
                for x in X:
                    a = project_ax(cc, c["pos"], c["axes"], c["sx"], c["sy"], x)
                    v = world_to_camera_view(sc, O(cc["name"]), Vector(x))
                    d = max(d, abs(a[0] - v.x), abs(a[1] - (1 - v.y)))
                cam = O(cc["name"])
                fd = (Vector(c["aim"]) - cam.matrix_world.translation).dot(-cam.matrix_world.col[2].xyz.normalized())
                tail[f"{fl['name']} {key} k=T/2"] = {"proj_err": round(d, 7), "fstop": round(cam.data.dof.aperture_fstop, 4),
                                                     "focus_m": round(fd, 5)}
                worst = max(worst, d)
            finally:
                restore()
    sc.frame_set(frame0)
    return {"max_err": round(worst, 7), "frames": {k: round(v, 7) for k, v in rows.items()}, "tail": tail}


def selftest(cfg, opts=None):
    """Blender-free checks of the config, timeline, camera path, holds, rigs and amber frames (storyboard §3).
    Returns {"ok": bool, "pass": [...], "fail": [...]}; `python3 scene.py selftest` exits 1 on any failure."""
    opts = opts or {}
    P, F = [], []
    def chk(cond, msg):
        (P if cond else F).append(msg)
    rack, hold, cams = cfg["rack"], cfg["hold"], cfg["cameras"]
    # --- config and timeline
    units = resolved_units(cfg)
    occ = {}
    for u in units:
        for k in range(u["u"], u["u"] + u["h"]):
            occ.setdefault(k, []).append(u["id"])
    overlaps = {k: v for k, v in occ.items() if len(v) > 1}
    chk(not overlaps, f"U slots unique ({len(units)} units, {sum(u['h'] for u in units)} U)" if not overlaps
        else f"U overlap at {sorted(overlaps)[:6]}")
    chk(all(1 <= k <= rack["u_count"] for k in occ), "every unit inside 1..42U")
    chk(sum(u["h"] for u in units) <= rack["u_count"], "total height <= 42U")
    ft = film_table(cfg)
    want = [0, 216, 336, 432, 552, 648, 810]                      # plan part five: rack-05 is the exit (163 frames)
    got = [ft[0]["a"]] + [f["b"] for f in ft]
    chk(got == want, f"film boundaries {got}" + ("" if got == want else f" != storyboard {want}"))
    chk(cfg["frames_per_vh"] == 96, f"pace {cfg['frames_per_vh']} frames per viewport (G1: 96)")
    tl = timeline(cfg)
    lens = [f["length"] for f in tl["films"]]
    chk(all(abs(l - (f["frames"] / 96 + 1)) < 1e-6 for l, f in zip(lens, ft)), f"lengths = frames/96 + 1: {lens}")
    here_ = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else "."
    tlp = next((q for q in (os.path.join(here_, "export", "rack.timeline.json"),               # a snapshot's own export
                            os.path.join(os.path.dirname(here_), "export", "rack.timeline.json"),   # (src/ -> ../export)
                            os.path.join(_repo_root(), "films-src", "rack", "export", "rack.timeline.json"))
                if os.path.exists(q)), None)
    try:
        with open(opts.get("timeline") or tlp) as fh:
            same = timeline_same(json.load(fh), tl)
        chk(same, f"exported rack.timeline.json matches the config ({os.path.relpath(tlp, here_)})" if same else
            f"exported rack.timeline.json is stale (re-run export): {tlp}")
    except (OSError, TypeError):
        P.append("no exported timeline to compare (run export)")
    # --- camera path
    path = build_path(cfg)
    f0, f1 = ft[0]["a"], ft[-1]["b"]
    poses = {f: pose_at(cfg, path, f) for f in range(f0, f1 + 1)}
    nan = [f for f, p in poses.items() if any(math.isnan(p[c]) or math.isinf(p[c]) for c in CH)]
    chk(not nan, "no NaN/inf in the camera path" if not nan else f"NaN/inf at frames {nan[:8]}")
    rx, ry, rz = rack["width"] / 2, (rack["front_y"], rack["front_y"] + rack["depth"]), (0.0, rack["height"] + rack["plinth"])
    inside = [f for f, p in poses.items() if -rx < p["x"] < rx and ry[0] < p["y"] < ry[1] and rz[0] < p["z"] < rz[1]]
    chk(not inside, "camera never inside the rack's box" if not inside else f"camera inside the rack at {inside[:8]}")
    low = [f for f, p in poses.items() if p["z"] < 0.05]
    chk(not low, "camera always above the floor" if not low else f"camera below 5 cm at {low[:8]}")
    # portrait camera must also stay out of the rack and above the floor
    pin = [f for f, p in poses.items() if (lambda q: -rx < q[0] < rx and ry[0] < q[1] < ry[1] and rz[0] < q[2] < rz[1])(portrait_of(p))]
    chk(not pin, "portrait camera never inside the rack's box" if not pin else f"portrait camera inside the rack at {pin[:8]}")
    # rest at every segment end
    slow = []
    for fl in ft:
        b = fl["b"]
        sp = max(v_len(v_sub((poses[g]["x"], poses[g]["y"], poses[g]["z"]), (poses[g - 1]["x"], poses[g - 1]["y"], poses[g - 1]["z"])))
                 for g in range(b - 11, b + 1))
        if sp > hold["rest_speed_m"]:
            slow.append((fl["name"], round(sp * 1000, 2)))
    chk(not slow, "camera at rest (< 2 mm/frame) over the last 12 frames of every film" if not slow
        else f"camera still moving at the end of {slow}")
    # holds: square, centred by shift on both cameras, portrait rho
    ub = {u["id"]: u for u in units}
    for fl in ft:
        uid = fl.get("unit")
        if not uid:
            continue
        p, u = poses[fl["b"]], ub[uid]
        C = hold_centre(cfg, u)
        sq = abs(p["pitch"] + PI / 2) < 1e-6 and abs(p["yaw"]) < 1e-6
        chk(sq, f"{fl['name']} hold square (straight down, roll 0)" if sq else
            f"{fl['name']} hold not square: pitch {p['pitch']:.4f} yaw {p['yaw']:.4f}")
        pl = project(cams["landscape"], (p["x"], p["y"], p["z"]), p["yaw"], p["pitch"], p["sx"], p["sy"], C)
        pp = project(cams["portrait"], portrait_of(p), p["yaw"], p["pitch"], p["psx"], p["psy"], C)
        tol = hold["tolerance"]
        okl = pl and abs(pl[0] - hold["centre"][0]) <= tol and abs(pl[1] - hold["centre"][1]) <= tol
        okp = pp and abs(pp[0] - hold["centre"][0]) <= tol and abs(pp[1] - hold["centre"][1]) <= tol
        chk(bool(okl), f"{fl['name']} landscape centre at {tuple(round(c, 4) for c in pl) if pl else None}")
        chk(bool(okp), f"{fl['name']} portrait centre at {tuple(round(c, 4) for c in pp) if pp else None}")
        hp = hold_pose(cfg, u)
        rho = math.exp(p["lrho"])
        chk(abs(rho - math.exp(hp["lrho"])) < 1e-3 and abs(p["focus"] - hp["focus"]) < 1e-3,
            f"{fl['name']} distance {p['focus']:.3f} m, portrait x{rho:.3f}")
        hh = cfg["look"]["handheld"]
        chk(not hh.get("enabled") or handheld_weight(cfg, fl["b"]) == 0.0, f"{fl['name']} handheld zero at the hold")
        # storyboard §7: the walls inside the band on both cameras, at the unit's own inner width and depth
        for key, pos, sx, sy in (("landscape", (p["x"], p["y"], p["z"]), p["sx"], p["sy"]),
                                 ("portrait", portrait_of(p), p["psx"], p["psy"])):
            wx = hold_walls_x(cfg, u, key, pos, p["yaw"], p["pitch"], sx, sy)["walls_x"]
            chk(in_wall_band(cfg, key, wx), f"{fl['name']} {key} walls at {wx[0]:.4f} / {wx[1]:.4f} "
                f"(band {hold['wall_band'][key]} and its mirror; width {2 * hold_walls(cfg, u)[0]:.4f} m)")
        # a per-unit width is the walls' real innermost edge (wall_edge); a low tray (walls fitted below P, where the
        # default 0.43 m lands the hem ~0.01 inboard: G2) must carry one
        if "inner_width" in u["hold"] or u["hold"].get("wall_z", u["hold"]["plane_z"]) < u["hold"]["plane_z"]:
            (xw, wz), (xh, zh) = hold_walls(cfg, u), wall_edge(cfg, u)
            ok = abs(xw - xh) < 1e-6 and abs(wz - zh) < 1e-6
            chk(ok, f"{uid} hold.inner_width / wall_z = the hem's inner edge ({2 * xh:.4f} m at z {zh:.5f})" if ok else
                f"{uid} hold.inner_width {2 * xw:.4f} at z {wz:.5f} != the hem's inner edge {2 * xh:.4f} at z {zh:.5f}")
        if u["kind"] == "ups":                        # §2: the battery's C is the centre of its two modules
            mxc, mhw, y0, y1 = ups_modules(u)
            Cm = (0.0, rack["face_y"] - u["travel"] + (y0 + y1) / 2, u["hold"]["plane_z"])
            ok = max(abs(a - b) for a, b in zip(C, Cm)) < 1e-9
            ml = project(cams["landscape"], (p["x"], p["y"], p["z"]), p["yaw"], p["pitch"], p["sx"], p["sy"], Cm)
            mp = project(cams["portrait"], portrait_of(p), p["yaw"], p["pitch"], p["psx"], p["psy"], Cm)
            ok = ok and all(abs(q[0] - hold["centre"][0]) <= hold["tolerance"] and abs(q[1] - hold["centre"][1])
                            <= hold["tolerance"] for q in (ml, mp))
            chk(ok, f"{uid} C = the modules' centre (y {(y0 + y1) / 2:.4f} behind the tray front): landscape "
                f"({ml[0]:.4f}, {ml[1]:.4f}), portrait ({mp[0]:.4f}, {mp[1]:.4f})")
    # hero end (storyboard §3, §7): square-on, the rack (plinth to top) 82 % / 80 % of the height, centred at 0.45
    hb = ft[0]["b"]
    p, pf = poses[hb], cfg["poses"]["rack_front"]
    sq = abs(p["pitch"]) < 1e-9 and abs(p["yaw"]) < 1e-9
    chk(sq, f"{ft[0]['name']} end square-on" if sq else f"{ft[0]['name']} end pitch {p['pitch']:.4f} yaw {p['yaw']:.4f}")
    want_hs = {"landscape": 0.82, "portrait": 0.80}
    chk(pf.get("height_share") == want_hs, f"poses.rack_front.height_share {pf.get('height_share')} (storyboard {want_hs})")
    for key, pos, sx, sy in (("landscape", (p["x"], p["y"], p["z"]), p["sx"], p["sy"]),
                             ("portrait", portrait_of(p), p["psx"], p["psy"])):
        hs = hero_height_share(cfg, key, pos, p["yaw"], p["pitch"], sx, sy)
        qc = project(cams[key], pos, p["yaw"], p["pitch"], sx, sy, (0.0, rack["front_y"], pf["centre_z"]))
        chk(abs(hs["height"] - want_hs[key]) <= 0.01, f"{ft[0]['name']} end {key}: rack {100 * hs['height']:.1f} % of the "
            f"height (storyboard {100 * want_hs[key]:.0f} % +- 1), {100 * hs['width']:.1f} % of the width")
        ok = abs(qc[0] - 0.5) <= hold["tolerance"] and abs(qc[1] - pf["frame_y"]) <= hold["tolerance"]
        chk(ok and abs(hs["mid_y"] - pf["frame_y"]) <= 0.005, f"{ft[0]['name']} end {key}: centre_z at ({qc[0]:.4f}, "
            f"{qc[1]:.4f}), the rack's middle at y {hs['mid_y']:.4f} (frame_y {pf['frame_y']})")
    # rigs: monotonic in open, inside travel; mechanisms finish >= 10 frames before the segment ends
    for u in opening_units(cfg):
        for part in rig_parts(u):
            loc = [part_local(cfg, u, part, o / 100.0) for o in range(101)]
            chans = list(zip(*[(l[0][0], l[0][1], l[0][2], l[1][0]) for l in loc]))
            mono = all(all(b - a >= -1e-9 for a, b in zip(ch, ch[1:])) or all(b - a <= 1e-9 for a, b in zip(ch, ch[1:]))
                       for ch in chans)
            fin = all(math.isfinite(v) for ch in chans for v in ch)
            chk(mono and fin, f"{u['id']}.{part} monotonic in open" if mono and fin else f"{u['id']}.{part} not monotonic")
        if u.get("travel"):
            dy = min(part_local(cfg, u, "sled", o / 100.0)[0][1] for o in range(101)) if "sled" in rig_parts(u) else 0.0
            chk(abs(dy + u["travel"]) < 1e-6, f"{u['id']} sled travel {-dy:.3f} m")
    rk = rig_keys(cfg)
    late = []
    for fl in ft:                                   # storyboard section 4: the last 12 frames of every film are still
        for rid, keys in (fl.get("rigs") or []):
            done = max(fl["a"] + k[0] for k in keys if float(k[1]) == 1.0) if any(float(k[1]) == 1.0 for k in keys) else None
            if done is not None and done > fl["b"] - 11 and rid != "door":
                late.append((fl["name"], rid, done, fl["b"]))
    chk(not late, "every mechanism settled over its film's last 12 frames" if not late else f"late mechanisms {late}")
    st_ = static_tails(cfg)                         # every film's static_tail beat (not "the last film a+96")
    bad_ = {fl["name"]: n for fl, a, b in st_ for n in
            [len({json.dumps(frame_state(cfg, path, f), sort_keys=True) for f in range(a, b + 1)})] if n != 1}
    lbl_ = ", ".join(f"{fl['name']} f{a - fl['a']}-{b - fl['a']}" for fl, a, b in st_)
    chk(bool(st_) and not bad_, f"static_tail beats ({lbl_}): one frame state each (identical frames)" if st_ and not bad_
        else (f"static_tail beats with distinct states {bad_}" if bad_ else "no film has a static_tail beat"))
    # amber and the travelling point
    am = amber_frames(cfg)
    want_am = {"u40": 190, "u37": 362, "u31": 474, "u28": 584}     # U2 and U42 stay cool standby (plan part five)
    chk(am == want_am, f"amber frames {am}" if am == want_am else f"amber frames {am} != {want_am}")
    vis = [f for f in range(f0, f1 + 1) if request_state(cfg, f)[0]]
    first_in = vis[0] if vis else None
    ex_ = exit_film(cfg)
    out_vis = [f for f in vis if ex_ and f >= ex_["a"]]
    chk(first_in == 24, f"request point appears at frame {first_in} (storyboard 24)")
    chk(bool(out_vis) and out_vis[0] == 734, f"reply point appears at frame {out_vis[0] if out_vis else None} (plan: 734)")
    lens_ = {f["name"]: (f["range"], f["frames"]) for f in tl["films"]}
    chk(ex_ is not None and lens_.get(ex_["name"]) == ([648, 810], 163),
        f"exit film {ex_ and ex_['name']}: range/frames {lens_.get(ex_ and ex_['name'])} (plan: [648, 810], 163)")
    for ok_, msg_ in exit_checks(cfg, path):                # plan part five 3a: the reply's track, the fog, clearances
        chk(ok_, msg_)
    # invisible helpers (storyboard section 4): exposure within the stop limit of the hero, moving only while the
    # camera moves and never in a film's last 24 frames; bay and haze levels inside 0..1
    lk = cfg["look"]
    E = {f: exposure_at(cfg, f) for f in range(f0, f1 + 1)}
    far = [f for f, e in E.items() if abs(e - lk["exposure"]) > lk["exposure_max_stops"] + 1e-9]
    chk(not far, f"exposure within {lk['exposure_max_stops']} stops of the hero ({min(E.values()):.2f}..{max(E.values()):.2f})"
        if not far else f"exposure beyond the limit at {far[:4]}")
    tails = [fl["name"] for fl in ft if any(abs(E[f] - E[fl["b"]]) > 1e-9 for f in range(fl["b"] - 24, fl["b"] + 1))]
    chk(not tails, "exposure constant over every film's last 24 frames" if not tails else f"exposure moves late in {tails}")
    still = [f for f in range(f0 + 1, f1 + 1) if abs(E[f] - E[f - 1]) > 1e-9 and
             max(abs(poses[f][c] - poses[f - 1][c]) for c in ("x", "y", "z", "yaw", "pitch")) < 1e-7]
    chk(not still, "exposure changes only while the camera moves" if not still else f"exposure moves on a still camera at {still[:4]}")
    lv = [(bay_level(cfg, f), haze_level(cfg, f)) for f in range(f0, f1 + 1)]
    chk(all(0.0 <= b <= 1.0 and 0.0 <= h <= 1.0 for b, h in lv), "bay and haze levels inside 0..1")
    # --- part five §2e: breathing tails (k = 0 and k = T are the hold; drift inside the limits; clearance) and anchors
    bc = breath_cfg(cfg)
    lim, names = bc["limits"], [fl["name"] for fl in ft]
    miss = [n for n in bc["films"] if n not in names]
    chk(bool(bc["films"]) and not miss and int(bc["frames"]) >= 2, f"breath films {bc['films']} (T = {bc['frames']})"
        + (f": missing {miss}" if miss else ""))
    amp = {k: (_per_cam(bc["orbit_deg"], k), _per_cam(bc["dolly_mm"], k)) for k in cams}
    ok = all(o <= lim["orbit_deg"] + 1e-9 and d <= lim["dolly_mm"] + 1e-9 for o, d in amp.values()) and \
        0 <= bc["focus_mm"] <= lim["focus_mm"] + 1e-9
    chk(ok, f"breath amplitudes (orbit deg, dolly mm) {amp}, focus +{bc['focus_mm']} mm, f/{hold['fstop']} -> "
        f"{bc['fstop_mid']} (limits {lim['orbit_deg']} deg, {lim['dolly_mm']} mm, {lim['focus_mm']} mm)")
    rkb = rig_keys(cfg)
    for fl, T in breath_films(cfg):
        p, u = poses[fl["b"]], ub[fl["unit"]]
        C = hold_centre(cfg, u)
        sled_o = pw_linear(rkb[u["id"]], fl["b"]) if u["id"] in rkb else 0.0
        s0 = part_world(cfg, u, "sled", sled_o, (0.0, 0.0, 0.0))
        boxes = {"rack": ((-rx, ry[0], rz[0]), (rx, ry[1], rz[1])),
                 "sled": ((-rack["body_width"] / 2, s0[1], s0[2]), (rack["body_width"] / 2, s0[1] + sled_depth(u), s0[2] + slot_hh(cfg, u)))}
        for key in cams:
            pos, axes, sx, sy = cam_view(p, key)
            aim = v_add((p["x"], p["y"], p["z"]), v_mul(axes[2], p["focus"]))
            c0, cT = breath_cam(cfg, p, key, 0.0), breath_cam(cfg, p, key, 1.0)
            q0 = project_ax(cams[key], c0["pos"], c0["axes"], c0["sx"], c0["sy"], C)
            same = c0["pos"] == pos and c0["euler"] == cam_euler(p["yaw"], p["pitch"]) and c0["fstop"] == p["fstop"] \
                and c0["aim"] == aim and (c0["sx"], c0["sy"]) == (sx, sy)
            sq = abs(p["pitch"] + PI / 2) < 1e-6 and abs(p["yaw"]) < 1e-6
            ok = same and sq and q0 is not None and abs(q0[0] - hold["centre"][0]) <= hold["tolerance"] and \
                abs(q0[1] - hold["centre"][1]) <= hold["tolerance"]
            chk(ok, f"{fl['name']} {key} tail k=0 = the hold pose: C at ({q0[0]:.4f}, {q0[1]:.4f}), square {sq}")
            chk(cT == c0, f"{fl['name']} {key} tail k=T={T} = the hold pose (its file is a hard link of the f{fl['b']} master)")
            d = breath_drift(cfg, path, fl, key, T)
            ok = d["centre_px"] <= lim["centre_px"] and d["edge_px"] <= lim["edge_px"] and d["step_px"] <= lim["step_px"]
            chk(ok, f"{fl['name']} {key} breath drift at {d['width_px'][0]}x{d['width_px'][1]}: C {d['centre_px']} px, edges "
                f"{d['edge_px']} px, step {d['step_px']} px (limits {lim['centre_px']}/{lim['edge_px']}/{lim['step_px']}); "
                f"subject {d['subject_px']} px, floor parallax {d['floor_px']} px, camera {d['cam_shift_mm']} mm")
            near = min((_aabb_dist(breath_cam(cfg, p, key, k / T)["pos"], *bx), k, nm) for k in range(T + 1) for nm, bx in boxes.items())
            chk(near[0] >= hold["clearance_m"], f"{fl['name']} {key} breath clearance {near[0]:.3f} m (>= {hold['clearance_m']}; "
                f"{near[2]} box at k={near[1]}; every object in `check`)")
    for row in tl["films"]:
        A = row.get("anchors")
        if not A:
            continue
        fl = next(f for f in ft if f["name"] == row["name"])
        u = ub[row["unit"]]
        for key in cams:
            a = A[key]
            pts = {n: v for n, v in a.items() if isinstance(v, dict)}
            ok = all(len(v["track"]) == row["frames"] and v["rest"] == v["track"][-1] and v["rest"] is not None for v in pts.values())
            chk(ok, f"{row['name']} {key} anchors {sorted(pts)}: one row per film frame ({row['frames']}), rest = the hold")
            r = a["unit_rect"]
            ok = r is not None and in_wall_band(cfg, key, [r[0], r[2]]) and a["calm_box"] is not None and \
                abs(a["centre"][0] - hold["centre"][0]) <= hold["tolerance"] and abs(a["centre"][1] - hold["centre"][1]) <= hold["tolerance"]
            chk(ok, f"{row['name']} {key} unit_rect x {r[0] if r else None}..{r[2] if r else None} inside the wall band, "
                f"calm box {a['calm_box']}, C {a['centre']}")
            for stem, ax_, sgn in (("cartridge_", 0, 1), ("row_", 1, -1), ("heatsink_", 0, 1)):
                seq = [pts[n]["rest"][ax_] for n in sorted((n for n in pts if n.startswith(stem)), key=lambda n: int(n.split("_")[1]))]
                if len(seq) > 1:
                    mono = all(sgn * (b - a_) > 0 for a_, b in zip(seq, seq[1:]))
                    chk(mono, f"{row['name']} {key} {stem}k at rest in storyboard order ({'xy'[ax_]} "
                        f"{'rising' if sgn > 0 else 'falling'} with k): {seq}")
        bt = A["beats"]
        for stem in ("cartridge_", "row_"):
            seq = [bt[n] for n in sorted((n for n in bt if n.startswith(stem)), key=lambda n: int(n.split("_")[1]))]
            if seq:
                ok = all(b > a_ for a_, b in zip(seq, seq[1:])) and 0 <= seq[0] and seq[-1] <= fl["frames"] - 10
                want = u.get("cartridges", 4) if stem == "cartridge_" else u.get("rows", 5)
                chk(ok and len(seq) == want, f"{row['name']} beats {stem}k {seq}: one per {stem[:-1]}, in order, settled 10 frames "
                    "before the end")
    rep = {"ok": not F, "pass": P, "fail": F, "frames": f1 - f0 + 1, "films": [f["name"] for f in ft]}
    return rep


def main(argv):
    cfg = load_config()
    cmd = argv[0] if argv else "build"
    opts = _parse(argv[1:])
    if cmd == "build":
        return build(cfg, opts.get("stage", "all"), opts.get("save"))
    if cmd == "check":
        return check(cfg, opts)
    if cmd == "plan":
        return plan(cfg, opts)
    if cmd == "render":
        return render(cfg, opts)
    if cmd == "export":
        return export(cfg, opts)
    if cmd == "meter":
        return meter(cfg, opts)
    if cmd == "selftest":
        return selftest(cfg, opts)
    if cmd == "timeline":
        return timeline(cfg)
    raise SystemExit(f"unknown command {cmd}")


PURE_CMDS = ("plan", "export", "selftest", "timeline")   # run without Blender (export without --plates)

if __name__ == "__main__" and not HOSTED:
    _args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    if bpy is not None or (_args and _args[0] in PURE_CMDS):
        _out = main(_args)
        if _args and _args[0] == "selftest":
            for _m in _out["pass"]:
                print("  ok   " + _m)
            for _m in _out["fail"]:
                print("  FAIL " + _m)
            print(f"selftest: {len(_out['pass'])} passed, {len(_out['fail'])} failed over {_out['frames']} frames")
            sys.exit(0 if _out["ok"] else 1)
        print(json.dumps(_out, indent=1, default=str))
    elif bpy is None:
        sys.exit("this command needs Blender: blender -b --factory-startup --python scene.py -- " + " ".join(_args))

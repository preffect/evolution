#!/usr/bin/env python3
"""Decision ticket mockup: the engulf moment. One six-frame strip per option, 1600 x 500.

Each frame shows the predator (magenta, sheet 01 Magenta palette) and the prey (cyan) at play scale,
with the prey player's HUD cue (UI.md danger chip / death block) under the cells. The membrane
deformation numbers are sheet 03's (arms +62 % at +-30 deg sigma 16 deg, notch -10 %, seal bulge +60 %).

Usage: python3 strip.py <out-dir>
"""
import math
import sys

BG_DEEP, BG_FIELD = "#04070d", "#0b1626"
TEXT, MUTED, ACCENT = "#cfdbe6", "#7d8da1", "#7fe7f5"
DNA, GOLD, DANGER, OK = "#d36bff", "#ffe08a", "#ff5470", "#8dff6a"
PANEL, PANEL_RIM = "#0e1f33", "#173250"
PRED = dict(base="#d43fb0", rim="#ffb3ec", nuc="#f07ad2", dark="#291424")
PREY = dict(base="#22c1d6", rim="#a6f4ff", nuc="#6fdcef", dark="#102426")

W, H = 1600, 500
FRAME_W, FRAME_H, FRAME_GAP, FRAME_Y = 236, 232, 16, 92
FRAME_X0 = 40
PRED_R, PREY_R = 58, 30


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size=12, fill=TEXT, anchor="start", weight="normal", family="DejaVu Sans", opacity=1, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" opacity="{opacity}" {extra}>{esc(s)}</text>')


def gauss(deg, sigma):
    return math.exp(-0.5 * (deg / sigma) ** 2)


def wrap_deg(d):
    return (d + 180) % 360 - 180


def blob_path(cx, cy, R, toward_deg=0, arms=0.0, notch=0.0, seal=0.0, wobble=0.0, seed=1):
    """Closed smooth path: radius = R x (1 + arms at +-30 deg + seal bulge - notch), Catmull-Rom -> cubic."""
    pts = []
    n = 72
    for i in range(n):
        a = 360 * i / n
        d = wrap_deg(a - toward_deg)
        f = 1 + arms * (gauss(d - 30, 16) + gauss(d + 30, 16)) - notch * gauss(d, 10) + seal * gauss(d, 42)
        f += wobble * math.sin(math.radians(3 * a + seed * 40)) * 0.5
        r = R * f
        pts.append((cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))))
    path = f"M {pts[0][0]:.1f},{pts[0][1]:.1f} "
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        path += f"C {c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} "
    return path + "Z"


def cell(cx, cy, R, pal, gid, toward=0, arms=0, notch=0, seal=0, body_opacity=0.55, rim_dash=None, rim_opacity=1, nucleus=True, wobble=0.02, seed=1, organelles=3):
    o = []
    path = blob_path(cx, cy, R, toward, arms, notch, seal, wobble, seed)
    o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R * 1.4:.1f}" fill="{pal["rim"]}" opacity="{0.10 * rim_opacity:.2f}" filter="url(#blur8)"/>')
    o.append(f'<path d="{path}" fill="url(#{gid})" opacity="{body_opacity:.2f}"/>')
    o.append(f'<path d="{path}" fill="none" stroke="{pal["dark"]}" stroke-width="{max(1.2, R * 0.08):.1f}" opacity="0.55"/>')
    dash = f' stroke-dasharray="{rim_dash}"' if rim_dash else ""
    o.append(f'<path d="{path}" fill="none" stroke="{pal["rim"]}" stroke-width="{max(1.6, R * 0.055):.1f}" opacity="{rim_opacity:.2f}"{dash}/>')
    if nucleus:
        nx, ny = cx - R * 0.12, cy - R * 0.12
        o.append(f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="{R * 0.3:.1f}" fill="{pal["nuc"]}" opacity="{0.85 * rim_opacity:.2f}"/>')
        o.append(f'<circle cx="{nx - R * 0.08:.1f}" cy="{ny - R * 0.08:.1f}" r="{R * 0.08:.1f}" fill="#ffffff" opacity="{0.7 * rim_opacity:.2f}"/>')
    for k in range(organelles):
        a = math.radians(70 + 110 * k + seed * 33)
        ox, oy = cx + R * 0.55 * math.cos(a), cy + R * 0.55 * math.sin(a)
        o.append(f'<ellipse cx="{ox:.1f}" cy="{oy:.1f}" rx="{R * 0.11:.1f}" ry="{R * 0.06:.1f}" transform="rotate({30 * k} {ox:.1f} {oy:.1f})" fill="#ffb15a" opacity="{0.8 * rim_opacity:.2f}"/>')
    o.append(f'<ellipse cx="{cx - R * 0.45:.1f}" cy="{cy - R * 0.55:.1f}" rx="{R * 0.22:.1f}" ry="{R * 0.08:.1f}" transform="rotate(-35 {cx - R * 0.45:.1f} {cy - R * 0.55:.1f})" fill="#ffffff" opacity="{0.45 * rim_opacity:.2f}"/>')
    return "\n".join(o)


def chip(fx, fy, label, fill, progress=None, bar_colour=DANGER, two_sided=False, locked=False, opacity=1):
    """The prey's danger chip at the frame's top-centre (UI.md §3.1) with the 120 x 4 engulf bar."""
    o = []
    cx = fx + FRAME_W / 2
    w = max(120, len(label) * 6.4 + 24)
    o.append(f'<rect x="{cx - w / 2:.1f}" y="{fy + 10}" width="{w:.1f}" height="18" rx="9" fill="{fill}" opacity="{0.92 * opacity:.2f}"/>')
    o.append(text(cx, fy + 23, label, 9, "#ffffff", anchor="middle", weight="bold", opacity=opacity, extra='letter-spacing="0.6"'))
    if progress is not None:
        bx, by = cx - 60, fy + 33
        o.append(f'<rect x="{bx}" y="{by}" width="120" height="4" fill="{PANEL_RIM}"/>')
        if two_sided:
            o.append(f'<rect x="{bx + 60 - 60 * progress:.1f}" y="{by}" width="{60 * progress:.1f}" height="4" fill="{OK}"/>')
            o.append(f'<rect x="{bx + 60:.1f}" y="{by}" width="{60 * progress:.1f}" height="4" fill="{bar_colour}"/>')
            o.append(f'<rect x="{bx + 59}" y="{by - 2}" width="2" height="8" fill="{TEXT}"/>')
        else:
            o.append(f'<rect x="{bx}" y="{by}" width="{120 * progress:.1f}" height="4" fill="{bar_colour}"/>')
        if locked:
            o.append(f'<rect x="{bx - 2}" y="{by - 2}" width="124" height="8" fill="none" stroke="{DANGER}" stroke-width="1"/>')
    return "\n".join(o)


def death_block(fx, fy, killer="AMOEBOID", seconds="3", dim=0.55):
    o = [f'<rect x="{fx}" y="{fy}" width="{FRAME_W}" height="{FRAME_H}" fill="#000" opacity="{dim}"/>']
    cx = fx + FRAME_W / 2
    o.append(text(cx, fy + 96, f"ENGULFED BY {killer}", 12, DANGER, anchor="middle", weight="bold"))
    o.append(text(cx, fy + 118, f"Respawning in {seconds}", 15, TEXT, anchor="middle", weight="bold"))
    o.append(text(cx, fy + 134, "camera follows the killer", 9, MUTED, anchor="middle"))
    return "\n".join(o)


def helix_stream(x1, y1, x2, y2, k=3):
    o = []
    for i in range(k):
        t = 0.25 + 0.25 * i
        x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        o.append(f'<path d="M {x - 6:.1f},{y - 3:.1f} q 3,-4 6,0 t 6,0" fill="none" stroke="{DNA}" stroke-width="1.6" opacity="{0.9 - 0.2 * i:.2f}"/>')
        o.append(f'<path d="M {x - 6:.1f},{y + 3:.1f} q 3,4 6,0 t 6,0" fill="none" stroke="{DNA}" stroke-width="1.6" opacity="{0.9 - 0.2 * i:.2f}"/>')
    return "\n".join(o)


def wrap(words_text, limit):
    lines, cur = [], ""
    for w in words_text.split():
        if len(cur) + len(w) + 1 > limit and cur:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return lines


def frame(i, spec):
    fx = FRAME_X0 + i * (FRAME_W + FRAME_GAP)
    fy = FRAME_Y
    o = [f'<rect x="{fx}" y="{fy}" width="{FRAME_W}" height="{FRAME_H}" rx="10" fill="{PANEL}" opacity="0.9" stroke="{PANEL_RIM}"/>']
    o.append(f'<clipPath id="clip{i}"><rect x="{fx}" y="{fy}" width="{FRAME_W}" height="{FRAME_H}" rx="10"/></clipPath>')
    o.append(f'<g clip-path="url(#clip{i})">')
    # motes for scale
    for k in range(6):
        mx, my = fx + 20 + (k * 71) % (FRAME_W - 30), fy + 60 + (k * 53) % (FRAME_H - 80)
        o.append(f'<circle cx="{mx}" cy="{my}" r="2.2" fill="{OK}" opacity="0.5"/>')
    cy = fy + 128
    px, py = fx + spec["pred_x"], cy
    qx, qy = fx + spec["prey_x"], cy
    toward = 0 if qx >= px else 180
    if spec.get("ring"):
        o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{PRED_R + 12}" fill="none" stroke="{DANGER}" stroke-width="1.6" stroke-dasharray="6 5"/>')
        o.append(text(px, py - PRED_R - 18, "CAN ENGULF YOU", 8, DANGER, anchor="middle", weight="bold", extra='letter-spacing="1"'))
    if spec.get("prey_visible", True):
        o.append(cell(qx, qy, PREY_R, PREY, "gprey", nucleus=True, rim_dash=spec.get("prey_dash"), rim_opacity=spec.get("prey_opacity", 1), seed=2, organelles=1))
    o.append(cell(px, py, PRED_R, PRED, "gpred", toward=toward, arms=spec.get("arms", 0), notch=spec.get("notch", 0), seal=spec.get("seal", 0), body_opacity=spec.get("pred_opacity", 0.55), seed=1, organelles=3))
    if spec.get("stream"):
        o.append(helix_stream(qx, qy, px - PRED_R * 0.12, py - PRED_R * 0.12))
    if spec.get("sprint"):
        for k in range(3):
            o.append(f'<path d="M {qx - PREY_R - 8 - 9 * k:.1f},{qy - 10 + 4 * k:.1f} q -6,10 0,20" fill="none" stroke="{PREY["rim"]}" stroke-width="1.4" opacity="{0.7 - 0.2 * k:.1f}"/>')
        o.append(text(qx, qy + PREY_R + 16, "SPRINT", 8, PREY["rim"], anchor="middle", weight="bold", extra='letter-spacing="1"'))
    if spec.get("pred_speed") is not None:
        o.append(text(px, py + PRED_R + 16, f"predator {spec['pred_speed']}× speed", 8, PRED["rim"], anchor="middle"))
    if spec.get("chip"):
        o.append(chip(fx, fy, *spec["chip"], **spec.get("chip_kw", {})))
    if spec.get("death"):
        o.append(death_block(fx, fy, seconds=spec["death"]))
    o.append("</g>")
    if spec.get("gain"):
        o.append(text(fx + FRAME_W - 10, fy + 60, spec["gain"], 10, OK, anchor="end", weight="bold"))
    o.append(text(fx + 10, fy + 16, f"{i + 1:02d}", 9, MUTED))
    o.append(text(fx + FRAME_W - 10, fy + FRAME_H - 8, spec["t"], 9, MUTED, anchor="end"))
    o.append(text(fx, fy + FRAME_H + 20, spec["title"], 13, TEXT, weight="bold"))
    for k, line in enumerate(wrap(spec["line1"] + (" · " + spec["line2"] if spec.get("line2") else ""), 44)[:3]):
        o.append(text(fx, fy + FRAME_H + 34 + 13 * k, line, 9.5, MUTED))
    return "\n".join(o)


def window_bar(segments):
    """The escape window under the strip: (from_frame, to_frame, colour, label) in frame units."""
    o = []
    y = FRAME_Y + FRAME_H + 80
    x0 = FRAME_X0
    span = 6 * (FRAME_W + FRAME_GAP) - FRAME_GAP
    for a, b, col, label in segments:
        xa, xb = x0 + span * a / 6, x0 + span * b / 6
        o.append(f'<rect x="{xa:.1f}" y="{y}" width="{xb - xa:.1f}" height="10" rx="5" fill="{col}" opacity="0.35"/>')
        o.append(f'<rect x="{xa:.1f}" y="{y}" width="{xb - xa:.1f}" height="10" rx="5" fill="none" stroke="{col}" opacity="0.8"/>')
        o.append(text((xa + xb) / 2, y + 24, label, 10, col, anchor="middle"))
    return "\n".join(o)


def render(letter, opt):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    o.append('<defs>'
             f'<radialGradient id="bg" cx="0.3" cy="0.2" r="1.1"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>'
             f'<radialGradient id="gpred" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{PRED["rim"]}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{PRED["base"]}" stop-opacity="0.7"/><stop offset="1" stop-color="{PRED["dark"]}" stop-opacity="0.9"/></radialGradient>'
             f'<radialGradient id="gprey" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{PREY["rim"]}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{PREY["base"]}" stop-opacity="0.7"/><stop offset="1" stop-color="{PREY["dark"]}" stop-opacity="0.9"/></radialGradient>'
             '<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>'
             '</defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    o.append(text(40, 40, f"OPTION {letter} · {opt['name'].upper()}", 24, TEXT, weight="bold"))
    o.append(text(40, 62, opt["tagline"], 13, ACCENT))
    o.append(text(W - 40, 40, "EVOLUTION · decision: the engulf moment", 12, MUTED, anchor="end"))
    o.append(text(W - 40, 58, "predator (magenta) 1.25× the prey (cyan) · the chip is the prey player's HUD · sheet-03 deformation numbers", 10, MUTED, anchor="end"))
    for i, spec in enumerate(opt["frames"]):
        o.append(frame(i, spec))
    o.append(window_bar(opt["window"]))
    fy = 448
    o.append(f'<rect x="40" y="{fy - 14}" width="{W - 80}" height="58" rx="8" fill="{PANEL}" opacity="0.85" stroke="{PANEL_RIM}"/>')
    o.append(text(56, fy, "constants (absorption.ts unless noted)", 9, MUTED, extra='letter-spacing="1.5"'))
    parts = opt["constants"].split(" · ")
    half = (len(parts) + 1) // 2
    o.append(text(56, fy + 18, " · ".join(parts[:half]), 11, TEXT, family="DejaVu Sans Mono"))
    o.append(text(56, fy + 34, " · ".join(parts[half:]), 11, TEXT, family="DejaVu Sans Mono"))
    o.append("</svg>")
    return "\n".join(o)


PRED_X, PREY_X_CONTACT, PREY_X_IN = 96, 152, 118

OPTIONS = {
    "a": dict(
        name="Committed", tagline="the wrap can be broken by a sprint; the seal at half progress is the point of no return, for both players",
        frames=[
            dict(t="t = 0.00 s", title="Contact", line1="predator ≥ 1.25× and the prey's centre is covered:", line2="the wrap starts; predator drops to 0.6× speed",
                 pred_x=PRED_X, prey_x=PREY_X_CONTACT, arms=0.1, pred_speed="0.6", chip=("ENGULFED · SPRINT TO ESCAPE", DANGER, 0.0)),
            dict(t="t = 0.30 s", title="Wrap", line1="two arms +62 % reach around; prey is at 0.8× speed", line2="a sprint now breaks contact, progress decays at 2×",
                 pred_x=PRED_X, prey_x=PREY_X_IN + 14, arms=0.62, notch=0.1, pred_speed="0.6", sprint=True, chip=("ENGULFED · SPRINT TO ESCAPE", DANGER, 0.25)),
            dict(t="t = 0.60 s · SEAL", title="Seal — committed", line1="progress 0.5: the film closes; prey input is ignored", line2="chip goes solid, bar locks; predator back to full speed",
                 pred_x=PRED_X, prey_x=PREY_X_IN, seal=0.6, pred_speed="1.0", prey_opacity=0.8, chip=("ENGULFED", "#8a1f33", 0.5), chip_kw=dict(locked=True)),
            dict(t="t = 0.80 s", title="Dissolve", line1="prey rim becomes a dash, cytoplasm fades to 50 %", line2="the prey player already sees the death block fade in",
                 pred_x=PRED_X, prey_x=PREY_X_IN, seal=0.42, pred_speed="1.0", prey_dash="5 6", prey_opacity=0.5, chip=("ENGULFED", "#8a1f33", 0.67), chip_kw=dict(locked=True)),
            dict(t="t = 1.00 s", title="DNA streams", line1="three helix fragments run into the predator's nucleus", line2="",
                 pred_x=PRED_X, prey_x=PREY_X_IN, seal=0.22, prey_dash="5 6", prey_opacity=0.25, stream=True, chip=("ENGULFED", "#8a1f33", 0.83), chip_kw=dict(locked=True)),
            dict(t="t = 1.20 s · payout", title="Done · spectate 2.5 s", line1="predator +mass, +DNA, absorption +1; prey cell removed", line2="prey respawns 3.1 s after the seal it could not undo",
                 pred_x=PRED_X 
                 + 10, prey_x=PREY_X_IN, prey_visible=False, gain="+24 mass  +42 DNA", death="2.5"),
        ],
        window=[(0, 3, OK, "escape window: a sprint that breaks contact frees the prey (progress decays at 2×)"),
                (3, 6, DANGER, "committed: no input, no release; the seal is the moment")],
        constants="ENGULF_MASS_RATIO 1.25 · ENGULF_RELEASE_RATIO 1.10 (checked only before the seal) · ENGULF_BASE_DURATION_SECONDS 1.2 · ENGULF_SEAL_PROGRESS 0.5 (new) · ENGULF_MIN_DURATION_FACTOR 0.5 · ENGULF_ESCAPE_DECAY_MULTIPLIER 2 · ENGULF_PREDATOR_SPEED_FACTOR 0.6 (1.0 after the seal) · ENGULF_PREY_SPEED_FACTOR 0.8 (0 after) · RESPAWN_SPECTATE_SECONDS 2.5 (session.ts)",
    ),
    "b": dict(
        name="Contested", tagline="a struggle: steering away slows the wrap, a sprint pushes it back, and the prey can break out at any progress",
        frames=[
            dict(t="t = 0.00 s", title="Contact", line1="predator ≥ 1.30× and the prey's centre is covered", line2="predator drops to 0.5× for the whole process",
                 pred_x=PRED_X, prey_x=PREY_X_CONTACT, arms=0.1, pred_speed="0.5", chip=("ENGULFED · STEER AWAY · SPRINT", DANGER, 0.0), chip_kw=dict(two_sided=True)),
            dict(t="t = 0.40 s", title="Wrap, slowed", line1="prey steers straight away at full throttle:", line2="progress rises at 40 % rate (struggle factor 0.6)",
                 pred_x=PRED_X, prey_x=PREY_X_IN + 16, arms=0.62, notch=0.1, pred_speed="0.5", chip=("ENGULFED · STEER AWAY · SPRINT", DANGER, 0.13), chip_kw=dict(two_sided=True)),
            dict(t="t = 0.80 s", title="Sprint push-back", line1="a sprint knocks 0.35 off the progress and pulls", line2="the prey half out; the bar swings to the prey's side",
                 pred_x=PRED_X, prey_x=PREY_X_CONTACT + 4, arms=0.5, notch=0.06, pred_speed="0.5", sprint=True, chip=("ENGULFED · STEER AWAY · SPRINT", DANGER, 0.0), chip_kw=dict(two_sided=True)),
            dict(t="t = 1.20 s", title="Breakout", line1="contact broken; progress decays at 2×; the predator", line2="at 0.5× cannot re-cover a prey that runs at 1.0×",
                 pred_x=PRED_X - 6, prey_x=PREY_X_CONTACT + 40, arms=0.3, pred_speed="0.5", chip=("ENGULFED · STEER AWAY · SPRINT", DANGER, 0.0), chip_kw=dict(two_sided=True, opacity=0.6)),
            dict(t="t = 1.60 s", title="Free", line1="both cells free; the predator spent 1.6 s at half speed", line2="for nothing; the danger ring stays while it is 1.30×",
                 pred_x=PRED_X - 10, prey_x=PREY_X_CONTACT + 64, ring=True),
            dict(t="ratio 2.5× · t = 0.60 s", title="Same fight at 2.5×", line2="the struggle cannot reverse it; a heavy cell still eats", line1="duration 0.6 s at ratio ≥ 2.5×; sealed at 0.45 s;",
                 pred_x=PRED_X + 8, prey_x=PREY_X_IN, prey_visible=False, gain="+24 mass  +42 DNA", death="3"),
        ],
        window=[(0, 5, OK, "escape window, the whole process: steer away (slows), sprint (pushes back 0.35), break contact (decays 2×); only the mass ratio decides how long you have"),
                (5, 6, DANGER, "ratio ≥ 2.5×: 0.6 s, no contest")],
        constants="ENGULF_MASS_RATIO 1.30 · ENGULF_RELEASE_RATIO 1.10 · ENGULF_BASE_DURATION_SECONDS 1.2 · ENGULF_MIN_DURATION_FACTOR 0.5 · ENGULF_STRUGGLE_THROTTLE_FACTOR 0.6 (new) · ENGULF_SPRINT_PUSHBACK_PROGRESS 0.35 (new) · ENGULF_ESCAPE_DECAY_MULTIPLIER 2 · ENGULF_PREDATOR_SPEED_FACTOR 0.5 · ENGULF_PREY_SPEED_FACTOR 0.8 · RESPAWN_SPECTATE_SECONDS 3",
    ),
    "c": dict(
        name="Instant on ratio", tagline="no process: the tick a 1.25× predator covers the prey's centre, the prey is absorbed; the 1.2 s strip is a cosmetic effect",
        frames=[
            dict(t="t = −0.30 s", title="Approach", line1="the danger ring and chip warn while a 1.25× cell is", line2="on screen; escape means never being covered",
                 pred_x=PRED_X - 14, prey_x=PREY_X_CONTACT + 44, ring=True, chip=("⚠ AMOEBOID CAN ENGULF YOU", DANGER)),
            dict(t="t = 0.00 s · one tick", title="Cover = absorbed", line1="predator.radius − 0.5 × prey.radius reaches the prey's", line2="centre: cell removed this tick, payout now",
                 pred_x=PRED_X, prey_x=PREY_X_CONTACT - 6, arms=0.1, gain="+24 mass  +42 DNA", prey_opacity=0.7),
            dict(t="t = 0.00 s · prey's screen", title="Spectate at once", line1="the prey player is already watching the killer;", line2="nothing to press, nothing to read",
                 pred_x=PRED_X, prey_x=PREY_X_IN, prey_visible=False, death="3"),
            dict(t="t = 0.30 s", title="Wrap (cosmetic)", line1="the predator plays sheet 03's strip over a ghost of", line2="the prey; the outcome was decided at frame 2",
                 pred_x=PRED_X, prey_x=PREY_X_IN + 14, arms=0.62, notch=0.1, prey_opacity=0.35, prey_dash="5 6", death="2.7"),
            dict(t="t = 0.80 s", title="Dissolve (cosmetic)", line1="ghost fades, helix fragments stream", line2="",
                 pred_x=PRED_X, prey_x=PREY_X_IN, seal=0.42, prey_opacity=0.2, prey_dash="5 6", stream=True, death="2.2"),
            dict(t="t = 3.00 s", title="Respawn", line1="prey back at starting mass by safe placement;", line2="level, traits and stage kept",
                 pred_x=PRED_X - 30, prey_x=PREY_X_CONTACT + 60, prey_visible=True, gain=""),
        ],
        window=[(0, 1, OK, "escape window: before cover only"),
                (1, 6, DANGER, "decided in one tick: no hysteresis, no release, no slow factors; the animation is for the predator")],
        constants="ENGULF_MASS_RATIO 1.25 · ENGULF_COVERAGE_FRACTION 0.5 · ENGULF_BASE_DURATION_SECONDS 0 (absorb on the contact tick) · ENGULF_RELEASE_RATIO, speed factors, escape decay: removed · ENGULF_EFFECT_SECONDS 1.2 (client, cosmetic) · RESPAWN_SPECTATE_SECONDS 3",
    ),
}

if __name__ == "__main__":
    out_dir = sys.argv[1]
    for letter, opt in OPTIONS.items():
        slug = opt["name"].lower().replace(" ", "-")
        with open(f"{out_dir}/option-{letter}-{slug}.svg", "w") as f:
            f.write(render(letter.upper(), opt))
        print("wrote", slug)

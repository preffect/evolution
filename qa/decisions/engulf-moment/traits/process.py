#!/usr/bin/env python3
"""Decision #139 follow-up (#145): the engulf process cover -> wrap -> seal -> absorb with every
trait hook marked. Prey hooks above the strip (cyan), predator hooks below (magenta), the base-ratio
timeline underneath. Same palette and cell drawing as ../strip.py (sheet 01 / sheet 03).

Usage: python3 process.py <out-dir>   (writes process-with-trait-hooks.svg; render with rsvg-convert)
"""
import math
import sys

BG_DEEP, BG_FIELD = "#04070d", "#0b1626"
TEXT, MUTED = "#cfdbe6", "#7d8da1"
DANGER, OK, GOLD, DNA = "#ff5470", "#8dff6a", "#ffe08a", "#d36bff"
PANEL, PANEL_RIM = "#0e1f33", "#173250"
PRED = dict(base="#d43fb0", rim="#ffb3ec", nuc="#f07ad2", dark="#291424")
PREY = dict(base="#22c1d6", rim="#a6f4ff", nuc="#6fdcef", dark="#102426")

W, H = 1600, 900
COLS = 4
COL_W, COL_GAP, COL_X0 = 360, 26, 30
STRIP_Y, STRIP_H = 300, 250
PRED_R, PREY_R = 62, 32


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size=12, fill=TEXT, anchor="start", weight="normal", opacity=1, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="DejaVu Sans" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" opacity="{opacity}" {extra}>{esc(s)}</text>')


def gauss(deg, sigma):
    return math.exp(-0.5 * (deg / sigma) ** 2)


def wrap_deg(d):
    return (d + 180) % 360 - 180


def blob_path(cx, cy, R, toward_deg=0, arms=0.0, notch=0.0, seal=0.0, wobble=0.02, seed=1):
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


def cell(cx, cy, R, pal, gid, toward=0, arms=0, notch=0, seal=0, body_opacity=0.55, rim_dash=None,
         rim_opacity=1, seed=1, organelles=3, spines=0):
    o = []
    path = blob_path(cx, cy, R, toward, arms, notch, seal, 0.02, seed)
    o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R * 1.4:.1f}" fill="{pal["rim"]}" opacity="{0.10 * rim_opacity:.2f}" filter="url(#blur8)"/>')
    for k in range(spines):
        a = math.radians(360 * k / spines)
        o.append(f'<line x1="{cx + R * 0.8 * math.cos(a):.1f}" y1="{cy + R * 0.8 * math.sin(a):.1f}" x2="{cx + R * 1.35 * math.cos(a):.1f}" y2="{cy + R * 1.35 * math.sin(a):.1f}" stroke="{pal["rim"]}" stroke-width="2" opacity="{0.9 * rim_opacity:.2f}"/>')
    o.append(f'<path d="{path}" fill="url(#{gid})" opacity="{body_opacity:.2f}"/>')
    o.append(f'<path d="{path}" fill="none" stroke="{pal["dark"]}" stroke-width="{max(1.2, R * 0.08):.1f}" opacity="0.55"/>')
    dash = f' stroke-dasharray="{rim_dash}"' if rim_dash else ""
    o.append(f'<path d="{path}" fill="none" stroke="{pal["rim"]}" stroke-width="{max(1.6, R * 0.055):.1f}" opacity="{rim_opacity:.2f}"{dash}/>')
    nx, ny = cx - R * 0.12, cy - R * 0.12
    o.append(f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="{R * 0.3:.1f}" fill="{pal["nuc"]}" opacity="{0.85 * rim_opacity:.2f}"/>')
    o.append(f'<circle cx="{nx - R * 0.08:.1f}" cy="{ny - R * 0.08:.1f}" r="{R * 0.08:.1f}" fill="#ffffff" opacity="{0.7 * rim_opacity:.2f}"/>')
    for k in range(organelles):
        a = math.radians(70 + 110 * k + seed * 33)
        ox, oy = cx + R * 0.55 * math.cos(a), cy + R * 0.55 * math.sin(a)
        o.append(f'<ellipse cx="{ox:.1f}" cy="{oy:.1f}" rx="{R * 0.11:.1f}" ry="{R * 0.06:.1f}" transform="rotate({30 * k} {ox:.1f} {oy:.1f})" fill="#ffb15a" opacity="{0.8 * rim_opacity:.2f}"/>')
    o.append(f'<ellipse cx="{cx - R * 0.45:.1f}" cy="{cy - R * 0.55:.1f}" rx="{R * 0.22:.1f}" ry="{R * 0.08:.1f}" transform="rotate(-35 {cx - R * 0.45:.1f} {cy - R * 0.55:.1f})" fill="#ffffff" opacity="{0.45 * rim_opacity:.2f}"/>')
    return "\n".join(o)


def hook_box(x, y, w, lines, colour, title):
    """A rounded box of hook lines; bold `name:` prefix drawn in the side colour."""
    h = 22 + 15 * len(lines)
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{PANEL}" stroke="{colour}" stroke-opacity="0.6"/>']
    o.append(text(x + 10, y + 15, title, 9.5, colour, weight="bold", extra='letter-spacing="1"'))
    for k, line in enumerate(lines):
        yy = y + 30 + 15 * k
        if ":" in line:
            name, rest = line.split(":", 1)
            o.append(text(x + 10, yy, name + ":", 10, colour, weight="bold"))
            o.append(text(x + 10 + 7.0 * (len(name) + 1) + 4, yy, rest.strip(), 10, TEXT))
        else:
            o.append(text(x + 10, yy, line, 10, MUTED))
    return "\n".join(o), h


PHASES = [
    dict(name="COVER", band="progress 0 → 1/6", when="0 → 0.2 s at 1.25×  ·  0 → 0.1 s at ≥ 2.5×",
         what="the membrane lies over the prey's centre. No grip.",
         arms=0.0, notch=0.0, seal=0.0, prey_x=0.66, prey_speed="prey speed × 1", pred_speed="predator × 0.6",
         prey=["Leave: out of contact = free at once, nothing held",
               "Cytoskeleton, Paramecium: steering away slows the cover",
               "Cilia, Flagellum, Mitochondrion: faster out (emergent)"],
         pred=["Speed × 0.6 while it spreads",
               "no trait touches the cover, by design"],
         escape="steer or sprint out"),
    dict(name="WRAP", band="progress 1/6 → 0.5", when="0.2 → 0.6 s  ·  0.1 → 0.3 s",
         what="pseudopods close around the prey. Grip 0.8.",
         arms=0.62, notch=0.10, seal=0.0, prey_x=0.58, prey_speed="prey speed × 0.8 (held)", pred_speed="predator × 0.6",
         prey=["Break contact: progress decays 2× → free below 1/6",
               "Struggle: steer away = −50 % pace; Cytoskeleton +10/20/30 %,",
               "Paramecium +10/15/20 % (cap 90 %)",
               "Cilia: slip, held speed 0.85 / 0.90 / 0.95",
               "Flagellum, Mitochondrion: stronger sprint breaks contact",
               "Diatom: spines roll spit-out 0.4 / 0.7 / 1.0 per s",
               "Toxin: × 6 drain once wrapped → ratio ejects",
               "Cell Wall: harder to start and hold (+0.15/0.30/0.45)"],
         pred=["Amoeba: wrap × 0.85 / 0.75 / 0.65, grip +0.1/0.2/0.3",
               "(held speed 0.7 / 0.6 / 0.5)"],
         escape="break contact · struggle · spines · poison"),
    dict(name="SEAL", band="progress = 0.5", when="0.6 s  ·  0.3 s",
         what="the membrane closes. The prey is carried.",
         arms=0.45, notch=0.0, seal=0.6, prey_x=0.35, prey_speed="prey speed × 0 (carried)", pred_speed="predator × 1.0",
         prey=["Movement is over: input latched, speed cap 0",
               "chip: SEALED, bar locked"],
         pred=["The predator moves freely with its meal inside"],
         escape="no movement escape"),
    dict(name="ABSORB", band="progress 0.5 → 1", when="0.6 → 1.2 s  ·  0.3 → 0.6 s",
         what="digestion. Payout at 1.",
         arms=0.0, notch=0.0, seal=0.0, prey_x=0.1, prey_speed="prey dissolving", pred_speed="predator × 1.0",
         prey=["Cell Wall: dissolve × 1.2 / 1.4 / 1.6",
               "Diatom: dissolve × 1.4 / 1.8 / 2.2, spit-out rolls go on,",
               "spikes drain the predator",
               "Toxin: × 6 drain → ratio ejects even when sealed",
               "Nuclear Envelope: keeps 25/50/75 % progress on death"],
         pred=["Food Vacuole: dissolve × 0.80 / 0.64 / 0.51,",
               "yield +0.05 / 0.10 / 0.15",
               "Nucleoid: payout DNA × 1.05 / 1.10 / 1.15"],
         escape="spines · poison only"),
]

NONE_BY_DESIGN = "No engulf effect, by design: Ribosome Studs (digests motes, not prey), Chloroplast, Euglena Eyespot, Stentor Trumpet (its aura is outside the membrane). Nucleoid and Nuclear Envelope touch only the payout."


def column(i, ph):
    x = COL_X0 + i * (COL_W + COL_GAP)
    o = []
    # prey hooks (above)
    box, h = hook_box(x, 96, COL_W, ph["prey"], PREY["rim"], "PREY  ·  " + ph["escape"])
    o.append(box)
    # strip frame
    fy = STRIP_Y
    o.append(f'<rect x="{x}" y="{fy}" width="{COL_W}" height="{STRIP_H}" rx="10" fill="{PANEL}" opacity="0.9" stroke="{PANEL_RIM}"/>')
    o.append(f'<clipPath id="clip{i}"><rect x="{x}" y="{fy}" width="{COL_W}" height="{STRIP_H}" rx="10"/></clipPath>')
    o.append(f'<g clip-path="url(#clip{i})">')
    for k in range(7):
        mx, my = x + 18 + (k * 97) % (COL_W - 30), fy + 40 + (k * 61) % (STRIP_H - 60)
        o.append(f'<circle cx="{mx}" cy="{my}" r="2.2" fill="{OK}" opacity="0.45"/>')
    cy = fy + STRIP_H / 2 + 6
    px = x + COL_W * 0.42
    qx = px + PRED_R * ph["prey_x"] + PREY_R * 0.6
    prey_op = 0.45 if ph["name"] == "ABSORB" else 1
    o.append(cell(qx, cy, PREY_R, PREY, "gprey", rim_dash=("4 4" if ph["name"] == "ABSORB" else None), rim_opacity=prey_op, seed=2, organelles=1, spines=8))
    o.append(cell(px, cy, PRED_R, PRED, "gpred", toward=0, arms=ph["arms"], notch=ph["notch"], seal=ph["seal"], seed=1, organelles=3))
    if ph["name"] == "ABSORB":
        for k in range(3):
            t = 0.3 + 0.2 * k
            sx, sy = qx + (px - qx) * t, cy - 6
            o.append(f'<path d="M {sx - 6:.1f},{sy - 3:.1f} q 3,-4 6,0 t 6,0" fill="none" stroke="{DNA}" stroke-width="1.6" opacity="{0.9 - 0.2 * k:.2f}"/>')
    o.append("</g>")
    o.append(text(x + 12, fy + 22, f"{i + 1}  {ph['name']}", 15, TEXT, weight="bold"))
    o.append(text(x + COL_W - 12, fy + 22, ph["band"], 10, GOLD, anchor="end"))
    o.append(text(x + 12, fy + STRIP_H - 30, ph["prey_speed"], 10, PREY["rim"]))
    o.append(text(x + 12, fy + STRIP_H - 14, ph["pred_speed"], 10, PRED["rim"]))
    o.append(text(x + COL_W - 12, fy + STRIP_H - 14, ph["when"], 9, MUTED, anchor="end"))
    o.append(text(x, fy + STRIP_H + 20, ph["what"], 11, MUTED))
    # predator hooks (below)
    box, h = hook_box(x, fy + STRIP_H + 34, COL_W, ph["pred"], PRED["rim"], "PREDATOR")
    o.append(box)
    return "\n".join(o)


def timeline():
    y = 752
    x0, x1 = COL_X0, COL_X0 + COLS * COL_W + (COLS - 1) * COL_GAP
    span = x1 - x0
    marks = [(0, "0", "contact"), (1 / 6, "1/6", "wrap starts"), (0.5, "0.5", "SEAL"), (1, "1", "payout")]
    o = [text(x0, y - 14, "progress bar (the HUD's) — bands are the phases' shares of 1.2 s; every phase halves at mass ratio ≥ 2.5×", 10, MUTED)]
    segs = [(0, 1 / 6, PREY["base"], "cover: leave"), (1 / 6, 0.5, GOLD, "wrap: break contact / struggle / spines / poison"), (0.5, 1, DANGER, "absorb: spines / poison only")]
    for a, b, col, label in segs:
        xa, xb = x0 + span * a, x0 + span * b
        o.append(f'<rect x="{xa:.1f}" y="{y}" width="{xb - xa:.1f}" height="12" rx="6" fill="{col}" opacity="0.35"/>')
        o.append(f'<rect x="{xa:.1f}" y="{y}" width="{xb - xa:.1f}" height="12" rx="6" fill="none" stroke="{col}" opacity="0.8"/>')
        o.append(text((xa + xb) / 2, y + 30, label, 10, col, anchor="middle"))
    for p, lab, name in marks:
        xx = x0 + span * p
        o.append(f'<line x1="{xx:.1f}" y1="{y - 4}" x2="{xx:.1f}" y2="{y + 16}" stroke="{TEXT}" stroke-width="1.5"/>')
        o.append(text(xx, y + 48, f"{lab} · {name}", 9.5, TEXT, anchor="middle", weight="bold"))
    o.append(text(x0, y + 72, "at 1.25×: 0.2 s · 0.6 s · 1.2 s      at ≥ 2.5×: 0.1 s · 0.3 s · 0.6 s      reaction window before the seal at 5× (E11): plain sprint 13 ticks, Cytoskeleton III 17, vs Amoeba III 7", 10, MUTED))
    return "\n".join(o)


def render():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    o.append('<defs>'
             f'<radialGradient id="bg" cx="0.3" cy="0.2" r="1.1"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>'
             f'<radialGradient id="gpred" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{PRED["rim"]}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{PRED["base"]}" stop-opacity="0.7"/><stop offset="1" stop-color="{PRED["dark"]}" stop-opacity="0.9"/></radialGradient>'
             f'<radialGradient id="gprey" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{PREY["rim"]}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{PREY["base"]}" stop-opacity="0.7"/><stop offset="1" stop-color="{PREY["dark"]}" stop-opacity="0.9"/></radialGradient>'
             '<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>'
             '</defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    o.append(text(COL_X0, 36, "The engulf moment, trait-dependent: cover → wrap → seal → absorb", 22, TEXT, weight="bold"))
    o.append(text(COL_X0, 60, "Decision #139 direction, designed in #145. Prey hooks above (cyan), predator hooks below (magenta); tier I / II / III values. Diatom prey drawn for the spines.", 11, MUTED))
    o.append(text(W - COL_X0, 36, "ECOLOGY.md §6.1 · TRAITS.md §3.18", 11, GOLD, anchor="end"))
    for i, ph in enumerate(PHASES):
        o.append(column(i, ph))
        if i < COLS - 1:
            xa = COL_X0 + (i + 1) * (COL_W + COL_GAP) - COL_GAP + 4
            ya = STRIP_Y + STRIP_H / 2
            o.append(f'<path d="M {xa},{ya} l {COL_GAP - 8},0 m -6,-5 l 6,5 l -6,5" fill="none" stroke="{GOLD}" stroke-width="2"/>')
    o.append(timeline())
    o.append(text(COL_X0, H - 22, NONE_BY_DESIGN, 10, MUTED))
    o.append("</svg>")
    return "\n".join(o)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    with open(f"{out}/process-with-trait-hooks.svg", "w", encoding="utf-8") as f:
        f.write(render())

#!/usr/bin/env python3
"""HUD layout decision mockups: four 1280x800 frames over one dish view.

Frames: A as specified (UI.md), B lean, C diegetic, and B's trait-pick overlay.
Colours are VISUAL-STYLE.md §2 / §7 roles; type is §7's scale; layout is UI.md §1 / §3.
Everything is seeded so a re-run reproduces the PNGs byte for byte.
"""
import math
import random
import sys
from pathlib import Path

W, H = 1280, 800
CX, CY = 640, 400
R = 42  # own cell on-screen radius (mass 128 -> 45 wu at ~0.93 px/wu)
ZOOM = 0.93
EXCL = 120
MARGIN = 16

# --- palette (VISUAL-STYLE §2, sheet tables) ---------------------------------
DNA, DNA_DEEP = '#d36bff', '#6b2ea6'
GOLD, DANGER, ACCENT, WHITE = '#ffe08a', '#ff5470', '#7fe7f5', '#ffffff'
PANEL_TOP, PANEL_BOTTOM, PANEL_RIM = '#0e1f33', '#060e1a', '#173250'
TEXT, LABEL, MUTED = '#dfeaf2', '#8fb3c9', '#7f93a8'
CALLOUT = '#050c17'
ZONE_SHALLOWS, ZONE_VENT, ZONE_GEL = '#8dffb0', '#ff9a4d', '#b070ff'
FOOD_MOTE = '#8dff6a'
MITO_BASE, MITO_LIGHT = '#ffb15a', '#ffd58a'
CHLORO_BASE, CHLORO_LIGHT, CHLORO_DARK = '#4fbf5a', '#b8ff9a', '#2a7a34'
BACT_PLAIN, PROTO_FILM = '#cfefff', '#8fd3e3'
NUCLEOID_STRAND, NUCLEOID_GLOW, RIBOSOME, FLAGELLUM = '#e4faff', '#7fe7f5', '#a6f4ff', '#a6f4ff'
DNA_STRAND_LIGHT = '#f0b8ff'

# player palettes (index, name, base, rim, nuc)
PAL = {
    'cyan': ('#22c1d6', '#a6f4ff', '#6fe3f4', 0),
    'coral': ('#f06a5a', '#ffc2b8', '#f9a094', 1),
    'lime': ('#8ad63a', '#dcffb3', '#bdf57a', 2),
    'amber': ('#e0a12a', '#ffe7a3', '#f7cf6f', 4),
    'magenta': ('#d43fb0', '#ffb3ec', '#f07ad2', 6),
    'rose': ('#bc5768', '#ffb2bf', '#f47187', 7),
}

SANS = "Inter, 'Liberation Sans', 'DejaVu Sans', sans-serif"
MONO = "'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace"
# role: (px, face, weight, uppercase, tracking em)
ROLES = {
    'number': (28, MONO, 'bold', False, 0),
    'headline': (26, SANS, 'bold', False, 0),
    'clock': (24, MONO, 'bold', False, 0),
    'value': (20, MONO, 'normal', False, 0),
    'title': (22, SANS, 'bold', False, 0.02),
    'card_name': (16, SANS, 'bold', False, 0),
    'body': (14, SANS, 'normal', False, 0),
    'label': (12, SANS, 'bold', True, 0.08),
    'caption': (11, SANS, 'bold', True, 0.08),
}


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, role, fill, anchor='start', upper=None, opacity=1.0, weight=None, extra=''):
    px, face, w, up, tr = ROLES[role]
    if upper is None:
        upper = up
    if upper:
        s = s.upper()
    w = weight or w
    ls = f' letter-spacing="{tr * px:.2f}"' if tr else ''
    return (f'<text x="{x}" y="{y}" font-family="{face}" font-size="{px}" font-weight="{w}" fill="{fill}" '
            f'text-anchor="{anchor}"{ls} opacity="{opacity}" {extra}>{esc(s)}</text>')


def text_width(s, role):
    px = ROLES[role][0]
    up = ROLES[role][3]
    per = 0.62 if ROLES[role][1] == MONO else (0.66 if up else 0.55)
    return len(s) * px * per + ROLES[role][4] * px * len(s)


def arc(cx, cy, r, frac, start_deg=-90):
    """Clockwise arc as a path (frac of a full turn)."""
    frac = max(0.0001, min(0.9999, frac))
    a0 = math.radians(start_deg)
    a1 = a0 + 2 * math.pi * frac
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    large = 1 if frac > 0.5 else 0
    return f'M{x0:.2f},{y0:.2f} A{r},{r} 0 {large} 1 {x1:.2f},{y1:.2f}'


def defs():
    g = []
    g.append('<radialGradient id="bg-field" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#0b1626"/>'
             '<stop offset="1" stop-color="#04070d"/></radialGradient>')
    g.append('<radialGradient id="light-pool"><stop offset="0" stop-color="#7fe7f5" stop-opacity="0.10"/>'
             '<stop offset="0.5" stop-color="#7fe7f5" stop-opacity="0.03"/><stop offset="1" stop-color="#7fe7f5" stop-opacity="0"/></radialGradient>')
    g.append('<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72"><stop offset="0.55" stop-color="#000" stop-opacity="0"/>'
             '<stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>')
    for name, col in (('shallows', ZONE_SHALLOWS), ('vent', ZONE_VENT), ('gel', ZONE_GEL)):
        g.append(f'<radialGradient id="zone-{name}"><stop offset="0" stop-color="{col}" stop-opacity="0.15"/>'
                 f'<stop offset="0.55" stop-color="{col}" stop-opacity="0.06"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>')
    g.append(f'<radialGradient id="zone-shallows-ring"><stop offset="0.80" stop-color="{ZONE_SHALLOWS}" stop-opacity="0"/>'
             f'<stop offset="0.93" stop-color="{ZONE_SHALLOWS}" stop-opacity="0.14"/><stop offset="1" stop-color="{ZONE_SHALLOWS}" stop-opacity="0.05"/></radialGradient>')
    for sd in (1.5, 3, 6, 10, 16, 26):
        g.append(f'<filter id="blur-{str(sd).replace(".", "_")}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{sd}"/></filter>')
    g.append('<filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>'
             '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    g.append('<radialGradient id="mote-algal" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/>'
             f'<stop offset="0.35" stop-color="{FOOD_MOTE}"/><stop offset="1" stop-color="#3f9a2c"/></radialGradient>')
    g.append(f'<radialGradient id="halo-algal"><stop offset="0" stop-color="{FOOD_MOTE}" stop-opacity="0.22"/>'
             f'<stop offset="0.45" stop-color="{FOOD_MOTE}" stop-opacity="0.08"/><stop offset="1" stop-color="{FOOD_MOTE}" stop-opacity="0"/></radialGradient>')
    g.append('<radialGradient id="mote-lipid" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c88a2a"/>'
             '<stop offset="0.55" stop-color="#f2c94c"/><stop offset="1" stop-color="#ffe7a3"/></radialGradient>')
    g.append('<radialGradient id="halo-lipid"><stop offset="0" stop-color="#ffc857" stop-opacity="0.2"/>'
             '<stop offset="1" stop-color="#ffc857" stop-opacity="0"/></radialGradient>')
    g.append(f'<radialGradient id="halo-dna"><stop offset="0" stop-color="{DNA}" stop-opacity="0.28"/>'
             f'<stop offset="1" stop-color="{DNA}" stop-opacity="0"/></radialGradient>')
    g.append(f'<radialGradient id="halo-mito"><stop offset="0.3" stop-color="{MITO_BASE}" stop-opacity="0.30"/>'
             f'<stop offset="1" stop-color="{MITO_BASE}" stop-opacity="0"/></radialGradient>')
    g.append(f'<radialGradient id="halo-chloro"><stop offset="0.3" stop-color="{CHLORO_LIGHT}" stop-opacity="0.30"/>'
             f'<stop offset="1" stop-color="{CHLORO_LIGHT}" stop-opacity="0"/></radialGradient>')
    g.append(f'<linearGradient id="panel-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}" stop-opacity="0.86"/>'
             f'<stop offset="1" stop-color="{PANEL_BOTTOM}" stop-opacity="0.86"/></linearGradient>')
    g.append('<linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132a44"/><stop offset="1" stop-color="#08131f"/></linearGradient>')
    g.append('<linearGradient id="card-bg-hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3f5c"/><stop offset="1" stop-color="#0a1a2a"/></linearGradient>')
    g.append(f'<linearGradient id="gold-bar" x1="0" x2="1"><stop offset="0" stop-color="#c88a2a"/><stop offset="1" stop-color="{GOLD}"/></linearGradient>')
    g.append(f'<linearGradient id="dna-bar" x1="0" x2="1"><stop offset="0" stop-color="{DNA_DEEP}"/><stop offset="1" stop-color="{DNA}"/></linearGradient>')
    # spotlight mask for the picker dim: opaque black except a soft clear disc at the centre
    g.append(f'<radialGradient id="spot" gradientUnits="userSpaceOnUse" cx="{CX}" cy="{CY}" r="{EXCL + 40}">'
             f'<stop offset="{EXCL / (EXCL + 40):.3f}" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>')
    g.append(f'<mask id="spot-mask"><rect width="{W}" height="{H}" fill="url(#spot)"/></mask>')
    for name, (base, rim, nuc, _idx) in PAL.items():
        g.append(f'<radialGradient id="body-{name}" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{base}" stop-opacity="0.30"/>'
                 f'<stop offset="0.55" stop-color="{base}" stop-opacity="0.38"/><stop offset="0.86" stop-color="{base}" stop-opacity="0.55"/>'
                 f'<stop offset="1" stop-color="{rim}" stop-opacity="0.85"/></radialGradient>')
        g.append(f'<linearGradient id="rim-{name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>'
                 f'<stop offset="0.18" stop-color="{rim}" stop-opacity="0.95"/><stop offset="0.55" stop-color="{base}" stop-opacity="0.6"/>'
                 f'<stop offset="1" stop-color="{rim}" stop-opacity="0.6"/></linearGradient>')
        g.append(f'<radialGradient id="halo-{name}"><stop offset="0.62" stop-color="{rim}" stop-opacity="0.22"/>'
                 f'<stop offset="1" stop-color="{rim}" stop-opacity="0"/></radialGradient>')
        g.append(f'<radialGradient id="nuc-{name}" cx="0.38" cy="0.34" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>'
                 f'<stop offset="0.45" stop-color="{nuc}" stop-opacity="0.9"/><stop offset="1" stop-color="{base}" stop-opacity="0.95"/></radialGradient>')
    return '<defs>' + ''.join(g) + '</defs>'


# --- dish scene ---------------------------------------------------------------
VENT = (1000, 330)
DISH_R = 692


def field(rng):
    o = [f'<rect width="{W}" height="{H}" fill="url(#bg-field)"/>']
    o.append('<circle cx="340" cy="220" r="720" fill="url(#light-pool)"/>')
    # shallows annulus just inside the wall (left of the view), vent disc, one gel patch
    o.append(f'<circle cx="{VENT[0]}" cy="{VENT[1]}" r="{DISH_R}" fill="url(#zone-shallows-ring)"/>')
    o.append(f'<circle cx="{VENT[0]}" cy="{VENT[1]}" r="300" fill="url(#zone-vent)"/>')
    o.append('<circle cx="470" cy="650" r="150" fill="url(#zone-gel)"/>')
    # gel strands
    for _ in range(9):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(20, 110)
        x, y = 470 + d * math.cos(a), 650 + d * math.sin(a)
        l = rng.uniform(30, 70)
        b = a + rng.uniform(-0.6, 0.6)
        o.append(f'<path d="M{x:.1f},{y:.1f} q{l * 0.5 * math.cos(b + 0.7):.1f},{l * 0.5 * math.sin(b + 0.7):.1f} {l * math.cos(b):.1f},{l * math.sin(b):.1f}" '
                 f'fill="none" stroke="{ZONE_GEL}" stroke-opacity="0.16" stroke-width="1.2" filter="url(#blur-1_5)"/>')
    # vent fissure + glints
    o.append(f'<path d="M{VENT[0] - 70},{VENT[1] + 20} l22,-14 l18,10 l24,-18 l20,6 l26,-16" fill="none" stroke="{ZONE_VENT}" '
             'stroke-opacity="0.35" stroke-width="3" filter="url(#blur-3)"/>')
    o.append(f'<path d="M{VENT[0] - 70},{VENT[1] + 20} l22,-14 l18,10 l24,-18 l20,6 l26,-16" fill="none" stroke="#ffd7a8" '
             'stroke-opacity="0.55" stroke-width="1"/>')
    for _ in range(7):
        x = VENT[0] + rng.uniform(-90, 60)
        y = VENT[1] + rng.uniform(-30, 30)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rng.uniform(1, 2):.1f}" fill="#ffe2bd" opacity="{rng.uniform(0.4, 0.9):.2f}"/>')
    # dish wall: the one hard edge (arc on the left), with rim scatter
    o.append(f'<circle cx="{VENT[0]}" cy="{VENT[1]}" r="{DISH_R}" fill="none" stroke="#2e5f8a" stroke-width="4" opacity="0.5" filter="url(#blur-6)"/>')
    o.append(f'<circle cx="{VENT[0]}" cy="{VENT[1]}" r="{DISH_R}" fill="none" stroke="#7fc4ff" stroke-width="1.2" opacity="0.7"/>')
    o.append(f'<circle cx="{VENT[0]}" cy="{VENT[1]}" r="{DISH_R + 14}" fill="none" stroke="#1f3552" stroke-width="26" opacity="0.6"/>')
    # depth particles: far sharp, near blurred, bokeh
    for _ in range(140):
        o.append(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(0.5, 1.3):.1f}" fill="#9fc4de" opacity="{rng.uniform(0.08, 0.3):.2f}"/>')
    for _ in range(26):
        o.append(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(1.6, 3):.1f}" fill="#9fc4de" opacity="{rng.uniform(0.08, 0.18):.2f}" filter="url(#blur-1_5)"/>')
    for _ in range(16):
        col = rng.choice(['#7fc4ff', '#ffc857', DNA])
        o.append(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(12, 28):.1f}" fill="{col}" opacity="{rng.uniform(0.05, 0.1):.2f}" filter="url(#blur-16)"/>')
    return ''.join(o)


def in_box(x, y, pad=0):
    return abs(x - CX) < EXCL + pad and abs(y - CY) < EXCL + pad


def near_cells(x, y, cells, pad=12):
    return any(math.hypot(x - cx, y - cy) < r + pad for cx, cy, r in cells)


def motes(rng, cells):
    o = []
    placed = 0
    while placed < 48:
        x, y = rng.uniform(20, W - 20), rng.uniform(20, H - 20)
        if near_cells(x, y, cells):
            continue
        r = rng.uniform(3, 5)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 3:.1f}" fill="url(#halo-algal)"/>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="url(#mote-algal)"/>'
                 f'<circle cx="{x - r * 0.35:.1f}" cy="{y - r * 0.35:.1f}" r="{r * 0.28:.1f}" fill="#fff" opacity="0.7"/>')
        placed += 1
    placed = 0
    while placed < 14:
        x, y = rng.uniform(20, W - 20), rng.uniform(20, H - 20)
        if near_cells(x, y, cells):
            continue
        rot = rng.uniform(0, 180)
        o.append(f'<g transform="translate({x:.1f},{y:.1f}) rotate({rot:.0f})"><ellipse rx="14" ry="9" fill="url(#halo-lipid)"/>'
                 '<ellipse rx="6" ry="3.8" fill="url(#mote-lipid)" opacity="0.9"/><ellipse cx="-2" cy="-1.2" rx="1.6" ry="0.8" fill="#fff" opacity="0.6"/></g>')
        placed += 1
    # DNA fragments: helix of two strands + rungs in the tag colour
    tag_cols = ['#66ecff', MITO_BASE, '#b8ff9a', DANGER, '#d05cff', '#6a9bff']
    placed = 0
    while placed < 7:
        x, y = rng.uniform(40, W - 40), rng.uniform(40, H - 40)
        if near_cells(x, y, cells):
            continue
        rot = rng.uniform(0, 180)
        tag = rng.choice(tag_cols)
        pts_a = ' '.join(f'{t - 9:.1f},{3.2 * math.sin(t * 0.7):.1f}' for t in range(0, 19, 2))
        pts_b = ' '.join(f'{t - 9:.1f},{-3.2 * math.sin(t * 0.7):.1f}' for t in range(0, 19, 2))
        rungs = ''.join(f'<line x1="{t - 9}" y1="{3.2 * math.sin(t * 0.7):.1f}" x2="{t - 9}" y2="{-3.2 * math.sin(t * 0.7):.1f}" stroke="{tag}" stroke-width="1.2"/>'
                        for t in (2, 6, 10, 14))
        o.append(f'<g transform="translate({x:.1f},{y:.1f}) rotate({rot:.0f})"><circle r="16" fill="{tag}" opacity="0.18" filter="url(#blur-6)"/>'
                 f'<polyline points="{pts_a}" fill="none" stroke="{DNA_STRAND_LIGHT}" stroke-width="1.6"/>'
                 f'<polyline points="{pts_b}" fill="none" stroke="{DNA}" stroke-width="1.6"/>{rungs}</g>')
        placed += 1
    return ''.join(o)


def bacterium(x, y, heading, kind):
    L, Wd = 32 * ZOOM, 16 * ZOOM
    g = [f'<g transform="translate({x:.1f},{y:.1f}) rotate({heading:.0f})">']
    if kind == 'plain':
        g.append(f'<rect x="{-L / 2}" y="{-Wd / 2}" width="{L}" height="{Wd}" rx="{Wd / 2}" fill="{BACT_PLAIN}" fill-opacity="0.55" stroke="{PROTO_FILM}" stroke-width="1.2"/>')
    elif kind == 'aerobic':
        g.append(f'<ellipse rx="{L * 0.9}" ry="{Wd * 1.4}" fill="url(#halo-mito)"/>')
        g.append(f'<rect x="{-L / 2}" y="{-Wd / 2}" width="{L}" height="{Wd}" rx="{Wd / 2}" fill="{MITO_BASE}" fill-opacity="0.75" stroke="{MITO_LIGHT}" stroke-width="1.4"/>')
        for i in (-1, 0, 1):
            g.append(f'<path d="M{i * 7 - 3},-4 q3,4 0,8" fill="none" stroke="#c46b1e" stroke-width="1.2" opacity="0.8"/>')
    else:
        g.append(f'<ellipse rx="{L * 0.9}" ry="{Wd * 1.4}" fill="url(#halo-chloro)"/>')
        g.append(f'<rect x="{-L / 2}" y="{-Wd / 2}" width="{L}" height="{Wd}" rx="{Wd / 2}" fill="{CHLORO_BASE}" fill-opacity="0.8" stroke="{CHLORO_LIGHT}" stroke-width="1.4"/>')
        for i in (-1, 0, 1):
            g.append(f'<rect x="{i * 8 - 1.5}" y="{-Wd / 2 + 2}" width="3" height="{Wd - 4}" fill="{CHLORO_DARK}" opacity="0.8"/>')
    g.append(f'<ellipse cx="{-L * 0.28}" cy="{-Wd * 0.22}" rx="4" ry="1.6" fill="#fff" opacity="0.55" transform="rotate(-20)"/>')
    g.append('</g>')
    return ''.join(g)


def bacteria(rng):
    o = []
    # aerobic rods hug the vent; photosynthetic ones sit toward the shallows; plain ones drift
    for (x, y) in ((905, 440), (1085, 470), (1140, 250), (820, 205), (890, 110)):
        o.append(bacterium(x, y, rng.uniform(0, 180), 'aerobic'))
    for (x, y) in ((150, 470), (250, 300)):
        o.append(bacterium(x, y, rng.uniform(0, 180), 'photosynthetic'))
    for (x, y) in ((420, 130), (760, 690), (600, 200)):
        o.append(bacterium(x, y, rng.uniform(0, 180), 'plain'))
    return ''.join(o)


def blob_path(r, n=36, bumps=(), wobble=0.0, rng=None, stretch=(1.0, 1.0), rot=0.0):
    """Closed smooth loop: radius r with Gaussian bumps (amp_frac, centre_deg, sigma_deg)."""
    pts = []
    for i in range(n):
        a = math.tau * i / n
        rr = r
        for amp, c, s in bumps:
            d = (math.degrees(a) - c + 180) % 360 - 180
            rr += r * amp * math.exp(-(d * d) / (2 * s * s))
        if wobble and rng:
            rr += r * wobble * math.sin(2 * a + 0.4)
        x, y = rr * math.cos(a) * stretch[0], rr * math.sin(a) * stretch[1]
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts.append((x * c - y * s, x * s + y * c))
    d = f'M{pts[0][0]:.2f},{pts[0][1]:.2f}'
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{c1[0]:.2f},{c1[1]:.2f} {c2[0]:.2f},{c2[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}'
    return d + ' Z'


def seat_mark(r, idx, rim):
    n = idx + 1
    o = []
    br = max(2.0, r * 0.05)
    for i in range(n):
        a = math.radians(-135 + 360 * i / n)
        x, y = r * math.cos(a), r * math.sin(a)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{br * 2.2:.1f}" fill="{rim}" opacity="0.45"/>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{br:.1f}" fill="{WHITE}" opacity="0.92"/>')
    return ''.join(o)


def cell(x, y, r, pal, stage, rng, heading=0.0, speed=0.0, extra_inside='', self_ring=False, extra_after=''):
    base, rim, nuc, idx = PAL[pal]
    stretch = (1 + 0.22 * speed, 1 - 0.28 * speed * 0.5)
    o = [f'<g transform="translate({x:.1f},{y:.1f})">']
    o.append(f'<circle r="{r * 1.28:.1f}" fill="url(#halo-{pal})"/>')
    if stage == 'amoeba':
        path = blob_path(r, bumps=((0.32, heading, 22), (0.22, heading + 110, 18), (0.18, heading - 130, 20), (0.12, heading + 40, 14)), rng=rng)
    else:
        path = blob_path(r, wobble=0.02 if stage != 'protocell' else 0.08, rng=rng, stretch=stretch, rot=heading)
    o.append(f'<path d="{path}" fill="url(#body-{pal})"/>')
    # dark pool bottom-right, light pool top-left (volume without shadow)
    o.append(f'<ellipse cx="{r * 0.35:.1f}" cy="{r * 0.35:.1f}" rx="{r * 0.55:.1f}" ry="{r * 0.45:.1f}" fill="#02050a" opacity="0.32" filter="url(#blur-6)"/>')
    o.append(f'<ellipse cx="{-r * 0.35:.1f}" cy="{-r * 0.35:.1f}" rx="{r * 0.45:.1f}" ry="{r * 0.35:.1f}" fill="{rim}" opacity="0.14" filter="url(#blur-6)"/>')
    if stage in ('prokaryote', 'amoeba', 'euk'):
        # ribosome stipple (interior tell)
        for _ in range(int(r * 0.9)):
            a = rng.uniform(0, math.tau)
            d = rng.uniform(0.68, 0.9) * r
            o.append(f'<circle cx="{d * math.cos(a):.1f}" cy="{d * math.sin(a):.1f}" r="1.1" fill="{RIBOSOME}" opacity="{rng.uniform(0.35, 0.8):.2f}"/>')
    if stage == 'prokaryote':
        # nucleoid: one loose loop, strand on the palette-rim glow, no envelope
        o.append(f'<ellipse rx="{r * 0.36:.1f}" ry="{r * 0.30:.1f}" transform="rotate(22)" fill="none" stroke="{rim}" stroke-width="5" opacity="0.35" filter="url(#blur-3)"/>')
        o.append(f'<ellipse rx="{r * 0.34:.1f}" ry="{r * 0.28:.1f}" transform="rotate(22)" fill="none" stroke="{NUCLEOID_STRAND}" stroke-width="1.5" opacity="0.9"/>')
        o.append(f'<path d="M{-r * 0.3:.1f},{r * 0.05:.1f} q{r * 0.15:.1f},{-r * 0.25:.1f} {r * 0.3:.1f},{-r * 0.06:.1f}" fill="none" stroke="{NUCLEOID_STRAND}" stroke-width="1.2" opacity="0.7"/>')
    elif stage in ('amoeba', 'euk'):
        o.append(f'<circle cx="{-r * 0.12:.1f}" cy="{-r * 0.12:.1f}" r="{r * 0.42:.1f}" fill="{nuc}" opacity="0.22" filter="url(#blur-6)"/>')
        o.append(f'<circle cx="{-r * 0.12:.1f}" cy="{-r * 0.12:.1f}" r="{r * 0.30:.1f}" fill="url(#nuc-{pal})"/>')
        o.append(f'<circle cx="{-r * 0.12:.1f}" cy="{-r * 0.12:.1f}" r="{r * 0.31:.1f}" fill="none" stroke="{rim}" stroke-width="1.2" stroke-dasharray="2 1.6" opacity="0.8"/>')
        o.append(f'<circle cx="{-r * 0.17:.1f}" cy="{-r * 0.17:.1f}" r="{r * 0.07:.1f}" fill="#fff" opacity="0.9"/>')
        for i in range(3):
            a = math.radians(30 + 120 * i)
            d = r * 0.62
            o.append(f'<ellipse cx="{d * math.cos(a):.1f}" cy="{d * math.sin(a):.1f}" rx="{r * 0.16:.1f}" ry="{r * 0.08:.1f}" transform="rotate({30 + 120 * i} {d * math.cos(a):.1f} {d * math.sin(a):.1f})" fill="{MITO_BASE}" opacity="0.8"/>')
    elif stage == 'protocell':
        for _ in range(5):
            a = rng.uniform(0, math.tau)
            d = rng.uniform(0.2, 0.6) * r
            o.append(f'<circle cx="{d * math.cos(a):.1f}" cy="{d * math.sin(a):.1f}" r="{r * 0.055:.1f}" fill="#cfefff" opacity="0.6"/>')
    o.append(extra_inside)
    # inner edge, rim light, outline, glint
    o.append(f'<path d="{path}" fill="none" stroke="{rim}" stroke-width="{r * 0.11:.1f}" opacity="0.18"/>')
    o.append(f'<path d="{path}" fill="none" stroke="url(#rim-{pal})" stroke-width="{max(1.6, r * 0.05):.1f}"/>')
    o.append(f'<path d="{path}" fill="none" stroke="#020509" stroke-width="{max(0.8, r * 0.012):.1f}" opacity="0.5"/>')
    o.append(seat_mark(r, idx, rim))
    o.append(f'<ellipse cx="{-r * 0.55:.1f}" cy="{-r * 0.55:.1f}" rx="{r * 0.22:.1f}" ry="{r * 0.08:.1f}" transform="rotate(-40 {-r * 0.55:.1f} {-r * 0.55:.1f})" fill="#fff" opacity="0.5" filter="url(#blur-1_5)"/>')
    if self_ring:
        o.append(f'<circle r="{r * 1.12:.1f}" fill="none" stroke="{WHITE}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/>')
    o.append(extra_after)
    o.append('</g>')
    return ''.join(o)


def flagellum(x, y, r, heading_deg, amp_scale=1.0, ghost=False):
    """Tail from the rear point, 2 r long, two sine waves, trailing opposite the velocity."""
    a = math.radians(heading_deg + 180)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    pts = []
    for i in range(0, 41):
        t = i / 40
        d = r * 0.98 + t * 2 * r
        off = math.sin(t * 2 * math.tau) * r * 0.12 * amp_scale * (0.3 + t)
        pts.append(f'{x + ux * d + px * off:.1f},{y + uy * d + py * off:.1f}')
    poly = ' '.join(pts)
    if ghost:
        return (f'<polyline points="{poly}" fill="none" stroke="{ACCENT}" stroke-width="3" opacity="0.35" stroke-dasharray="4 3"/>')
    return (f'<polyline points="{poly}" fill="none" stroke="{FLAGELLUM}" stroke-width="3" opacity="0.7" stroke-linecap="round"/>'
            f'<polyline points="{poly}" fill="none" stroke="{WHITE}" stroke-width="1.1" opacity="0.9" stroke-linecap="round"/>')


PLAYER_HEADING = -28
OTHERS = [  # x, y, r, palette, stage, heading
    (960, 250, 70, 'magenta', 'amoeba', 200),
    (300, 250, 30, 'lime', 'euk', 150),
    (560, 640, 22, 'amber', 'prokaryote', 40),
    (1120, 620, 10, 'rose', 'protocell', 0),
]


def scene(rng, own_inside='', own_after='', tail_ghost=False):
    cells = [(x, y, r) for x, y, r, *_ in OTHERS] + [(CX, CY, R)]
    o = [field(rng), motes(rng, cells), bacteria(rng)]
    for x, y, r, pal, stage, hd in OTHERS:
        if stage == 'prokaryote':
            o.append(flagellum(x, y, r, hd))
        o.append(cell(x, y, r, pal, stage, rng, heading=hd, speed=0.3))
    # engulf warning ring around the amoeboid (renderer, DANGER dashed 6 5, 1.3 r)
    ax, ay, ar = OTHERS[0][:3]
    o.append(f'<circle cx="{ax}" cy="{ay}" r="{ar * 1.3:.0f}" fill="none" stroke="{DANGER}" stroke-width="2" stroke-dasharray="6 5" opacity="0.85" filter="url(#glow-soft)"/>')
    # own cell: prokaryote (nucleoid I, simple flagellum I, ribosomes I), cyan, moving up-right
    o.append(flagellum(CX, CY, R, PLAYER_HEADING))
    if tail_ghost:
        o.append(flagellum(CX, CY, R, PLAYER_HEADING, amp_scale=1.6, ghost=True))
    o.append(cell(CX, CY, R, 'cyan', 'prokaryote', rng, heading=PLAYER_HEADING, speed=0.55, extra_inside=own_inside, self_ring=True, extra_after=own_after))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    return ''.join(o)


# --- HUD pieces ------------------------------------------------------------------
def backing(x, y, w, h, rx=12, opacity=0.62):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{CALLOUT}" opacity="{opacity}"/>'


def panel(x, y, w, h, rx=8):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="url(#panel-bg)" stroke="{PANEL_RIM}"/>'


def level_ring(level, frac, cx=MARGIN + 36, cy=MARGIN + 36, flash=False):
    r = 33
    o = [f'<circle cx="{cx}" cy="{cy}" r="{r + 6}" fill="{CALLOUT}" opacity="0.7"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{PANEL_RIM}" stroke-width="6"/>']
    col = GOLD if flash else DNA
    o.append(f'<path d="{arc(cx, cy, r, frac)}" fill="none" stroke="{col}" stroke-width="6" stroke-linecap="round" filter="url(#glow-soft)"/>')
    o.append(text(cx, cy + 6, str(level), 'number', TEXT, 'middle'))
    o.append(text(cx, cy + 22, 'LEVEL', 'caption', LABEL, 'middle'))
    return ''.join(o)


def mass_readout(x, y, mass):
    return text(x, y, str(mass), 'number', TEXT) + text(x + text_width(str(mass), 'number') + 6, y, 'mass', 'label', MUTED, upper=False)


def swatch(cx, cy, pal, r=5):
    base, rim, _n, idx = PAL[pal]
    o = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{base}" stroke="{rim}" stroke-width="1"/>']
    n = idx + 1
    for i in range(n):
        a = math.radians(-135 + 360 * i / n)
        o.append(f'<circle cx="{cx + r * math.cos(a):.1f}" cy="{cy + r * math.sin(a):.1f}" r="1.1" fill="{WHITE}"/>')
    return ''.join(o)


BOARD = [  # rank, name, pal, level, score, own
    (1, 'Amoeboid', 'magenta', 7, 412, False),
    (2, 'Kelp', 'lime', 5, 260, False),
    (3, 'Moss', 'cyan', 4, 128, True),
    (4, 'Nib', 'amber', 3, 96, False),
    (5, 'Dot', 'rose', 2, 31, False),
]


def leaderboard():
    w, x, y = 240, W - MARGIN - 240, MARGIN
    h = 26 + 24 * len(BOARD)
    o = [panel(x, y, w, h)]
    o.append(text(x + 10, y + 17, 'LEADERBOARD', 'caption', LABEL))
    o.append(text(x + w - 10, y + 17, 'TAB', 'caption', MUTED, 'end'))
    for i, (rank, name, pal, lvl, score, own) in enumerate(BOARD):
        ry = y + 26 + 24 * i
        if own:
            o.append(f'<rect x="{x + 4}" y="{ry + 2}" width="{w - 8}" height="20" rx="4" fill="{PAL[pal][1]}" opacity="0.12"/>')
        col = TEXT if own else '#b9c8d6'
        o.append(text(x + 14, ry + 16, str(rank), 'body', MUTED, 'middle'))
        o.append(swatch(x + 32, ry + 12, pal))
        o.append(text(x + 44, ry + 16, name, 'body', col, weight='bold' if own else None))
        o.append(text(x + w - 64, ry + 16, f'L{lvl}', 'body', MUTED, 'end'))
        o.append(text(x + w - 10, ry + 16, str(score), 'body', col, 'end'))
    return ''.join(o)


def minimap():
    cx, cy, r = MARGIN + 60, H - MARGIN - 60, 60
    o = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{CALLOUT}" opacity="0.78" stroke="{PANEL_RIM}"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{r - 6}" fill="none" stroke="#2e5f8a" stroke-width="1.2"/>',
         f'<circle cx="{cx}" cy="{cy}" r="{r - 6}" fill="url(#zone-shallows-ring)"/>',
         f'<circle cx="{cx}" cy="{cy}" r="16" fill="url(#zone-vent)"/>']
    for (dx, dy) in ((-22, 26), (28, -20), (18, 30)):
        o.append(f'<circle cx="{cx + dx}" cy="{cy + dy}" r="9" fill="url(#zone-gel)"/>')
    # cells: own = identity ring colour (white) 4 px with a text-colour ring; others 3 px palette base
    scale = (r - 6) / DISH_R
    for x, y, _r, pal, *_ in OTHERS:
        mx, my = cx + (x - VENT[0]) * scale, cy + (y - VENT[1]) * scale
        o.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="3" fill="{PAL[pal][0]}"/>')
    ox, oy = cx + (CX - VENT[0]) * scale, cy + (CY - VENT[1]) * scale
    o.append(f'<circle cx="{ox:.1f}" cy="{oy:.1f}" r="4" fill="{WHITE}" stroke="{TEXT}" stroke-width="1"/>')
    return ''.join(o)


def glyph(kind, cx, cy, col, s=1.0):
    g = [f'<g transform="translate({cx},{cy}) scale({s})" fill="none" stroke="{col}" stroke-width="1.8" stroke-linecap="round">']
    if kind == 'nucleoid':
        g.append('<ellipse rx="8" ry="5.5" transform="rotate(20)"/><path d="M-6,1 q4,-7 11,-1"/>')
    elif kind == 'flagellum':
        g.append('<circle cx="-6" cy="0" r="4.5"/><path d="M-1.5,0 q4,-6 8,0 t8,0"/>')
    elif kind == 'ribosomes':
        g.append('<circle r="9"/>')
        for a in range(0, 360, 45):
            x, y = 6.5 * math.cos(math.radians(a)), 6.5 * math.sin(math.radians(a))
            g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.3" fill="{col}" stroke="none"/>')
    elif kind == 'mitochondrion':
        g.append('<ellipse rx="10" ry="5.5" transform="rotate(-25)"/>')
        for i in (-4, 0, 4):
            g.append(f'<path d="M{i - 1.5},-3 q2,3 0,6" transform="rotate(-25)"/>')
    elif kind == 'cell_wall':
        g.append('<circle r="9"/><circle r="6" stroke-width="2.6"/>')
    elif kind == 'chloroplast':
        g.append('<ellipse rx="9" ry="5.5" transform="rotate(30)"/>')
        for i in (-4, 0, 4):
            g.append(f'<circle cx="{i}" cy="-1.5" r="1.1" fill="{col}" stroke="none"/>')
    g.append('</g>')
    return ''.join(g)


def trait_strip(stage='PROKARYOTE', traits=(('nucleoid', 1), ('flagellum', 1), ('ribosomes', 1)), slots=5):
    slot, gap = 36, 8
    total = slots * slot + (slots - 1) * gap
    x0, y0 = CX - total / 2, H - MARGIN - slot
    o = [backing(x0 - 10, y0 - 22, total + 20, slot + 32, opacity=0.55)]
    o.append(text(CX, y0 - 8, stage, 'caption', LABEL, 'middle'))
    for i in range(slots):
        x = x0 + i * (slot + gap)
        if i < len(traits):
            kind, tier = traits[i]
            o.append(f'<rect x="{x}" y="{y0}" width="{slot}" height="{slot}" rx="8" fill="#0b1a2c" stroke="{ACCENT}" stroke-opacity="0.9"/>')
            o.append(glyph(kind, x + slot / 2, y0 + 15, ACCENT, 0.95))
            for t in range(tier):
                o.append(f'<circle cx="{x + slot / 2 + (t - (tier - 1) / 2) * 6:.1f}" cy="{y0 + slot - 6}" r="1.8" fill="{GOLD}"/>')
        else:
            o.append(f'<rect x="{x}" y="{y0}" width="{slot}" height="{slot}" rx="8" fill="#0b1a2c" fill-opacity="0.6" stroke="{MUTED}" stroke-opacity="0.5" stroke-dasharray="3 3"/>')
    return ''.join(o)


def round_clock(clock='07:42', with_hints=True, sprint=True):
    x = W - MARGIN
    o = [backing(x - 236, H - MARGIN - 76, 236 + 8, 76 + 8, opacity=0.55)]
    o.append(text(x, H - MARGIN - 40, clock, 'clock', TEXT, 'end'))
    o.append(text(x, H - MARGIN - 26, 'ROUND', 'caption', LABEL, 'end'))
    if sprint:
        o.append(f'<rect x="{x - 80}" y="{H - MARGIN - 18}" width="80" height="4" rx="2" fill="{PANEL_RIM}"/>')
        o.append(f'<rect x="{x - 80}" y="{H - MARGIN - 18}" width="80" height="4" rx="2" fill="{GOLD}"/>')
    if with_hints:
        o.append(text(x, H - MARGIN - 2, 'SPACE sprint · TAB board · ESC menu', 'caption', MUTED, 'end', upper=False))
    return ''.join(o)


def danger_chip(name='AMOEBOID'):
    s = f'⚠ {name} CAN ENGULF YOU'
    w = text_width(s, 'label') + 28
    x = CX - w / 2
    return (f'<rect x="{x:.0f}" y="{MARGIN}" width="{w:.0f}" height="26" rx="13" fill="{DANGER}"/>'
            + text(CX, MARGIN + 18, s, 'label', '#2a0a12', 'middle'))


def hint_pill(s, y):
    w = text_width(s, 'body') + 32
    return backing(CX - w / 2, y, w, 28, rx=14, opacity=0.75) + text(CX, y + 19, s, 'body', TEXT, 'middle')


def hud_a():
    o = [backing(8, 8, 350, 106)]
    o.append(level_ring(4, 0.62))
    o.append(mass_readout(MARGIN + 72 + 12, MARGIN + 30, 128))
    o.append(text(MARGIN + 72 + 12, MARGIN + 52, 'DNA 62 % · 18 to level 5', 'body', DNA))
    o.append(text(MARGIN + 72 + 12, MARGIN + 72, 'aerobic 2/5 · warm vent', 'label', LABEL, upper=False))
    o.append(text(MARGIN + 72 + 12, MARGIN + 88, 'photosynthetic 0/5 · shallows', 'label', LABEL, upper=False))
    o.append(danger_chip())
    o.append(leaderboard())
    o.append(minimap())
    o.append(hint_pill('Bigger cells engulf you · sprint away', H - MARGIN - 36 - 22 - 40))
    o.append(trait_strip())
    o.append(round_clock())
    return ''.join(o)


def rank_badge(rank=3, of=5, score=128):
    s_rank = f'{rank} / {of}'
    w = 20 + 12 + text_width(s_rank, 'value') + 10 + text_width('TAB BOARD', 'caption') + 18
    x = W - MARGIN - w
    y = MARGIN
    o = [panel(x, y, w, 32, rx=16)]
    o.append(swatch(x + 18, y + 16, 'cyan', r=6))
    o.append(text(x + 32, y + 22, s_rank, 'value', TEXT))
    o.append(text(x + w - 12, y + 20, 'TAB BOARD', 'caption', MUTED, 'end'))
    return ''.join(o)


def hud_b(level=4, frac=0.62, mass=128, transient_counter=True, threat=True):
    o = [backing(8, 8, 190, 88)]
    o.append(level_ring(level, frac))
    o.append(mass_readout(MARGIN + 72 + 12, MARGIN + 42, mass))
    if transient_counter:
        # moment-based: this chip appears for 4 s each time a counter changes (the player just ate an aerobic rod)
        s = 'aerobic 2/5'
        w = text_width(s, 'label') + 30
        y = MARGIN + 92
        o.append(backing(MARGIN, y, w, 24, rx=12, opacity=0.7))
        o.append(f'<rect x="{MARGIN + 10}" y="{y + 8}" width="10" height="7" rx="3.5" fill="{MITO_BASE}"/>')
        o.append(text(MARGIN + 26, y + 16, s, 'label', LABEL, upper=False))
    if threat:
        o.append(danger_chip())
    o.append(rank_badge())
    return ''.join(o)


def hud_c():
    o = [leaderboard(), round_clock(with_hints=False, sprint=False)]
    # world-anchored label above the engulf ring (sheet 03's language) replaces the danger chip
    ax, ay, ar = OTHERS[0][:3]
    o.append(text(ax, ay - ar * 1.3 - 10, 'CAN ENGULF YOU', 'caption', DANGER, 'middle'))
    return ''.join(o)


def diegetic_own_inside():
    """DNA ring as the nucleus halo, level inside the nucleoid, next-organelle ghosts with counter pips."""
    o = []
    rr = R * 0.52
    o.append(f'<circle r="{rr:.1f}" fill="none" stroke="{PAL["cyan"][1]}" stroke-width="3" opacity="0.15"/>')
    o.append(f'<path d="{arc(0, 0, rr, 0.62)}" fill="none" stroke="{DNA}" stroke-width="3" stroke-linecap="round" filter="url(#glow-soft)"/>')
    o.append(f'<text x="0" y="5" font-family="{MONO}" font-size="14" font-weight="bold" fill="{WHITE}" text-anchor="middle" opacity="0.92">4</text>')
    # mitochondrion ghost (aerobic 2/5) and chloroplast ghost (0/5), faint, dashed
    for (gx, gy, rot, col, lit, kind) in ((R * 0.55, R * 0.42, -25, MITO_BASE, 2, 'mito'), (-R * 0.5, R * 0.5, 30, CHLORO_LIGHT, 0, 'chloro')):
        o.append(f'<g transform="translate({gx:.1f},{gy:.1f})">')
        o.append(f'<ellipse rx="{R * 0.16:.1f}" ry="{R * 0.08:.1f}" transform="rotate({rot})" fill="{col}" fill-opacity="0.12" stroke="{col}" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>')
        for i in range(5):
            px = (i - 2) * 4.2
            fill = col if i < lit else 'none'
            o.append(f'<circle cx="{px:.1f}" cy="{R * 0.16:.1f}" r="1.5" fill="{fill}" stroke="{col}" stroke-width="0.8" opacity="0.85"/>')
        o.append('</g>')
    return ''.join(o)


# --- picker (option B) -------------------------------------------------------------
CARDS = [
    dict(kind='mitochondrion', cat='METABOLISM', name='Mitochondrion I', lines=('−15 % mass decay', '+10 % sprint speed'), rarity='UNCOMMON', col=MITO_BASE, rung=True),
    dict(kind='flagellum', cat='LOCOMOTION', name='Simple Flagellum', tier='I → II', lines=('+60 % sprint speed', '−1 s sprint cooldown'), rarity='UNCOMMON', col='#66ecff', hot=True),
    dict(kind='cell_wall', cat='MEMBRANE', name='Cell Wall I', lines=('+15 % engulf ratio', '−5 % speed'), rarity='COMMON', col='#e6ecf2'),
]
RARITY_COL = {'COMMON': MUTED, 'UNCOMMON': ACCENT, 'RARE': DNA}


def picker(level=5, remaining=6.5, total=10.0):
    o = [f'<rect width="{W}" height="{H}" fill="#000" opacity="0.55" mask="url(#spot-mask)"/>']
    title_y = CY + EXCL + MARGIN
    o.append(text(CX, title_y + 18, f'LEVEL {level} · CHOOSE A TRAIT', 'title', GOLD, 'middle'))
    bar_y = title_y + 22 + 12 - 4
    bar_x = CX - 235
    o.append(f'<rect x="{bar_x}" y="{bar_y}" width="470" height="4" rx="2" fill="{PANEL_RIM}"/>')
    o.append(f'<rect x="{bar_x}" y="{bar_y}" width="{470 * remaining / total:.0f}" height="4" rx="2" fill="url(#gold-bar)"/>')
    o.append(text(bar_x + 470 + 10, bar_y + 9, f'{remaining:.1f} s', 'value', GOLD))
    o.append(text(bar_x - 10, bar_y + 8, 'AT 0 S THE DISH PICKS FOR YOU', 'caption', MUTED, 'end'))
    card_y = bar_y + 4 + 12
    card_w, card_h, gap = 150, 184, 10
    x0 = CX - (3 * card_w + 2 * gap) / 2
    for i, c in enumerate(CARDS):
        x = x0 + i * (card_w + gap)
        y = card_y - (8 if c.get('hot') else 0)
        if c.get('hot'):
            o.append(f'<rect x="{x - 3}" y="{y - 3}" width="{card_w + 6}" height="{card_h + 6}" rx="14" fill="none" stroke="{ACCENT}" stroke-width="3" opacity="0.5" filter="url(#blur-3)"/>')
        o.append(f'<rect x="{x}" y="{y}" width="{card_w}" height="{card_h}" rx="12" fill="url(#card-bg{"-hot" if c.get("hot") else ""})" stroke="{ACCENT if c.get("hot") else PANEL_RIM}" stroke-width="{1.5 if c.get("hot") else 1}"/>')
        mcx, mcy = x + card_w / 2, y + 44
        o.append(f'<circle cx="{mcx}" cy="{mcy}" r="28" fill="#0b1a2c" stroke="{c["col"]}" stroke-opacity="0.8"/>')
        o.append(f'<circle cx="{mcx}" cy="{mcy}" r="24" fill="{c["col"]}" opacity="0.12" filter="url(#glow-soft)"/>')
        o.append(glyph(c['kind'], mcx, mcy, c['col'], 1.6))
        if c.get('rung'):
            o.append(f'<rect x="{x + 8}" y="{y + 8}" width="46" height="16" rx="4" fill="{GOLD}"/>')
            o.append(text(x + 31, y + 20, 'RUNG', 'caption', '#2a1e04', 'middle'))
        o.append(text(mcx, y + 88, c['cat'], 'caption', LABEL, 'middle'))
        o.append(text(mcx, y + 107, c['name'], 'card_name', TEXT, 'middle'))
        if c.get('tier'):
            o.append(text(mcx, y + 121, c['tier'], 'label', GOLD, 'middle', upper=False))
        ly = y + (136 if c.get('tier') else 128)
        for ln in c['lines']:
            o.append(text(mcx, ly, ln, 'label', '#b9c8d6', 'middle', upper=False))
            ly += 14
        rc = RARITY_COL[c['rarity']]
        rw = text_width(c['rarity'], 'caption') + 16
        o.append(f'<rect x="{mcx - rw / 2:.0f}" y="{y + card_h - 24}" width="{rw:.0f}" height="16" rx="8" fill="none" stroke="{rc}" stroke-opacity="0.8"/>')
        o.append(text(mcx, y + card_h - 12, c['rarity'], 'caption', rc, 'middle'))
        ky = card_y + card_h + 8
        o.append(f'<rect x="{mcx - 9}" y="{ky}" width="18" height="16" rx="4" fill="#0b1a2c" stroke="{ACCENT if c.get("hot") else MUTED}"/>')
        o.append(text(mcx, ky + 12, str(i + 1), 'caption', TEXT, 'middle'))
    return ''.join(o)


def frame(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs()}{body}</svg>')


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    frames = {
        'hud-a-as-specified': lambda: scene(random.Random(42)) + hud_a(),
        'hud-b-lean': lambda: scene(random.Random(42)) + hud_b(),
        'hud-c-diegetic': lambda: scene(random.Random(42), own_inside=diegetic_own_inside()) + hud_c(),
        'hud-b-trait-pick': lambda: scene(random.Random(42), tail_ghost=True) + hud_b(level=5, frac=0.06, mass=131, transient_counter=False) + picker(),
    }
    for name, build in frames.items():
        (out / f'{name}.svg').write_text(frame(build()), encoding='utf-8')
        print('wrote', out / f'{name}.svg')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

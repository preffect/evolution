#!/usr/bin/env python3
"""Legibility decision mockups (#321): three 1280x800 in-round frames over one dish view.

A: diegetic, stronger world and on-cell cues. B: a minimal stats strip. C: A plus a hold-Tab panel and a coach pill.
Reuses the #143 HUD-layout kit (palette, type roles, dish, cells) from qa/decisions/hud-layout/tools/render.py.
The scene: you are Moss (cyan eukaryote, level 5, mass 312, Mitochondrion I, Cytoskeleton III) in the warm vent,
touching a toxic cell, with 1:48 of bloom left. Seeded, so a re-run reproduces the PNGs.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'hud-layout' / 'tools'))
import render as kit  # noqa: E402

from render import (  # noqa: E402
    ACCENT, CALLOUT, DANGER, DNA, FOOD_MOTE, GOLD, LABEL, MITO_BASE, MUTED, PAL, PANEL_RIM, TEXT, WHITE, ZONE_VENT,
    CX, CY, H, MARGIN, W, arc, backing, panel, swatch, text, text_width,
)

TOXIN = '#d05cff'
R = 42
kit.VENT = (800, 300)  # the vent is the dish origin; the own cell sits inside it

OWN_MASS = 312
PREY_BELOW = 250  # 312 / 1.25
THREAT_ABOVE = 390  # 312 x 1.25

OTHERS = [  # x, y, r, palette, stage, heading, relation
    (1000, 560, 66, 'magenta', 'amoeba', 200, 'threat'),
    (430, 240, 40, 'lime', 'euk', 150, 'even'),
    (460, 590, 26, 'amber', 'prokaryote', 40, 'prey'),
    (880, 700, 12, 'rose', 'protocell', 0, 'prey'),
    (688, 440, 22, 'coral', 'euk', 120, 'toxic'),
]

BOARD = [  # rank, name, palette, level, score, mass, engulfs, own
    (1, 'Amoeboid', 'magenta', 7, 540, 1030, 4, False),
    (2, 'Moss', 'cyan', 5, 412, 312, 1, True),
    (3, 'Kelp', 'lime', 5, 388, 270, 0, False),
    (4, 'Nib', 'coral', 4, 260, 96, 2, False),
    (5, 'Dot', 'rose', 2, 96, 24, 0, False),
]


# --- small drawing helpers ------------------------------------------------------
def pill(cx, cy, s, role, fill, rim=None, anchor='middle', dot=None):
    width = text_width(s, role) + 20 + (12 if dot else 0)
    x = cx - width / 2 if anchor == 'middle' else cx
    o = [f'<rect x="{x:.1f}" y="{cy - 10:.1f}" width="{width:.1f}" height="20" rx="10" fill="{CALLOUT}" opacity="0.8"'
         + (f' stroke="{rim}" stroke-width="1.5"' if rim else '') + '/>']
    tx = x + 10
    if dot:
        o.append(f'<circle cx="{tx + 3:.1f}" cy="{cy:.1f}" r="4" fill="{dot}"/>')
        tx += 12
    o.append(text(round(tx, 1), round(cy + 4, 1), s, role, fill))
    return ''.join(o)


def floater(x, y, number, cause, col, opacity=1.0):
    """World-anchored mass or DNA change: the number in the mono face, then its cause."""
    num_w = text_width(number, 'value') * 0.72
    cause_w = text_width(cause, 'caption')
    width = num_w + cause_w + 22
    o = [f'<g opacity="{opacity}">',
         f'<rect x="{x - width / 2:.1f}" y="{y - 11:.1f}" width="{width:.1f}" height="22" rx="11" fill="{CALLOUT}" opacity="0.72"/>',
         f'<text x="{x - width / 2 + 9:.1f}" y="{y + 5:.1f}" font-family="{kit.MONO}" font-size="15" font-weight="bold" fill="{col}">{number}</text>',
         text(round(x - width / 2 + 13 + num_w, 1), round(y + 4, 1), cause, 'caption', col),
         '</g>']
    return ''.join(o)


def sparkline(x, y, w, h, col):
    samples = [250, 256, 263, 270, 279, 288, 296, 303, 311, 318, 324, 329, 333, 335, 336, 334, 332, 329, 327, 324, 321, 312]
    lo, hi = 240, 340
    pts = ' '.join(f'{x + w * i / (len(samples) - 1):.1f},{y + h - h * (v - lo) / (hi - lo):.1f}' for i, v in enumerate(samples))
    last = pts.split(' ')[-1].split(',')
    return (f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/>'
            f'<circle cx="{last[0]}" cy="{last[1]}" r="2.5" fill="{DANGER}"/>')


def icon(kind, cx, cy, col, s=1.0):
    """Effect glyphs the #143 kit lacks; the kit's own glyphs cover the organelles."""
    if kind in ('mitochondrion', 'chloroplast', 'cell_wall', 'flagellum', 'nucleoid', 'ribosomes'):
        return kit.glyph(kind, cx, cy, col, s)
    g = [f'<g transform="translate({cx},{cy}) scale({s})" fill="none" stroke="{col}" stroke-width="1.8" stroke-linecap="round">']
    if kind == 'vent':
        g.append('<path d="M-6,8 q-3,-6 0,-10 t0,-8"/><path d="M0,8 q-3,-6 0,-10 t0,-8"/><path d="M6,8 q-3,-6 0,-10 t0,-8"/>')
    elif kind == 'toxin':
        g.append('<path d="M0,-9 C5,-2 7,2 7,4 A7,7 0 0 1 -7,4 C-7,2 -5,-2 0,-9 Z"/>')
    elif kind == 'bloom':
        for a in range(0, 360, 60):
            g.append(f'<ellipse cx="{4.5 * math.cos(math.radians(a)):.1f}" cy="{4.5 * math.sin(math.radians(a)):.1f}" rx="3.2" ry="2" '
                     f'transform="rotate({a} {4.5 * math.cos(math.radians(a)):.1f} {4.5 * math.sin(math.radians(a)):.1f})"/>')
        g.append(f'<circle r="1.8" fill="{col}" stroke="none"/>')
    elif kind == 'cytoskeleton':
        g.append('<circle r="9"/><path d="M-6,-6 L6,6 M6,-6 L-6,6 M0,-9 L0,9 M-9,0 L9,0" stroke-width="1.2"/>')
    g.append('</g>')
    return ''.join(g)


def mito_bean(cx, cy, s=1.0):
    return icon('mitochondrion', cx, cy, MITO_BASE, s)


# --- the world -------------------------------------------------------------------
def heat_shimmer():
    """Vent decay: warm wisps lifting off the upper membrane."""
    o = []
    for i, a in enumerate((-150, -120, -95, -70, -40)):
        rad = math.radians(a)
        x, y = CX + R * 1.02 * math.cos(rad), CY + R * 1.02 * math.sin(rad)
        o.append(f'<path d="M{x:.1f},{y:.1f} q{-4 + i:.1f},-8 0,-15 t0,-13" fill="none" stroke="{ZONE_VENT}" stroke-width="2" '
                 f'stroke-linecap="round" opacity="0.55" filter="url(#blur-1_5)"/>')
    return ''.join(o)


def toxin_contact(x, y, r):
    """Toxin drain: a violet bleed on the side of the own cell that touches the toxic cell."""
    ang = math.atan2(y - CY, x - CX)
    mx, my = CX + R * math.cos(ang), CY + R * math.sin(ang)
    o = [f'<circle cx="{x}" cy="{y}" r="{r * 1.9:.1f}" fill="{TOXIN}" opacity="0.16" filter="url(#blur-10)"/>',
         f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="14" fill="{TOXIN}" opacity="0.35" filter="url(#blur-6)"/>']
    rng = random.Random(7)
    for _ in range(9):
        a = ang + rng.uniform(-0.9, 0.9)
        d = R * rng.uniform(0.8, 1.0)
        o.append(f'<circle cx="{CX + d * math.cos(a):.1f}" cy="{CY + d * math.sin(a):.1f}" r="{rng.uniform(1, 2):.1f}" fill="{TOXIN}" opacity="0.8"/>')
    return ''.join(o)


def relation_ring(x, y, r, relation, labelled):
    if relation == 'threat':
        o = [f'<circle cx="{x}" cy="{y}" r="{r * 1.3:.0f}" fill="none" stroke="{DANGER}" stroke-width="2" stroke-dasharray="6 5" '
             'opacity="0.9" filter="url(#glow-soft)"/>']
        o.append(pill(x, y - r * 1.3 - 16, 'AMOEBOID CAN ENGULF YOU', 'label', WHITE, rim=DANGER))
        return ''.join(o)
    if relation == 'prey':
        o = [f'<circle cx="{x}" cy="{y}" r="{max(r * 1.3, r + 7):.1f}" fill="none" stroke="{FOOD_MOTE}" stroke-width="1.6" opacity="0.8"/>']
        if labelled:
            o.append(pill(x, y + max(r * 1.3, r + 7) + 16, 'EDIBLE', 'label', WHITE, rim=FOOD_MOTE))
        return ''.join(o)
    if relation == 'toxic':
        o = [f'<circle cx="{x}" cy="{y}" r="{r * 1.35:.1f}" fill="none" stroke="{TOXIN}" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.9"/>']
        if labelled:
            o.append(pill(x + 34, y + 30, 'EDIBLE · TOXIC', 'label', WHITE, rim=TOXIN, anchor='start'))
        return ''.join(o)
    return ''


def own_indicators(active_glow):
    """Today's own-cell indicators (DNA ring, numeral), plus the trait glow on the mitochondria when it acts."""
    o = []
    if active_glow:
        for i in range(3):
            a = math.radians(30 + 120 * i)
            d = R * 0.62
            o.append(f'<circle cx="{d * math.cos(a):.1f}" cy="{d * math.sin(a):.1f}" r="{R * 0.22:.1f}" fill="{MITO_BASE}" opacity="0.55" filter="url(#blur-3)"/>')
    rr = 20
    o.append(f'<circle r="{rr}" fill="none" stroke="{CALLOUT}" stroke-width="7" opacity="0.55"/>')
    o.append(f'<path d="{arc(0, 0, rr, 0.62)}" fill="none" stroke="{DNA}" stroke-width="4" stroke-linecap="round"/>')
    o.append(f'<text x="0" y="6" font-family="{kit.MONO}" font-size="17" font-weight="bold" fill="{WHITE}" text-anchor="middle" '
             f'stroke="{CALLOUT}" stroke-width="3" paint-order="stroke">5</text>')
    return ''.join(o)


def world(cues):
    """cues: 'diegetic' adds floaters, shimmer, labels and the zone pill; 'strip' keeps today's world plus plain rings."""
    rng = random.Random(42)
    circles = [(x, y, r) for x, y, r, *_ in OTHERS] + [(CX, CY, R)]
    o = [kit.field(rng), kit.motes(rng, circles), kit.motes(random.Random(43), circles), kit.bacteria(rng)]
    for x, y, r, pal, stage, heading, relation in OTHERS:
        if relation == 'toxic':
            o.append(toxin_contact(x, y, r))
        if stage == 'prokaryote':
            o.append(kit.flagellum(x, y, r, heading))
        o.append(kit.cell(x, y, r, pal, stage, rng, heading=heading, speed=0.3))
    diegetic = cues == 'diegetic'
    if diegetic:
        o.append(heat_shimmer())
    o.append(kit.flagellum(CX, CY, R, -28))
    o.append(kit.cell(CX, CY, R, 'cyan', 'euk', rng, heading=-28, speed=0.4, self_ring=True,
                      extra_after=own_indicators(active_glow=diegetic)))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    labelled_prey = {(460, 590)}
    for x, y, r, _pal, _stage, _heading, relation in OTHERS:
        if relation == 'threat' or diegetic or relation != 'even':
            o.append(relation_ring(x, y, r, relation, labelled=diegetic and ((x, y) in labelled_prey or relation == 'toxic')))
    if diegetic:
        o.append(floater(716, 348, '+3', 'FOOD', FOOD_MOTE))
        o.append(floater(548, 336, '−1', 'VENT', ZONE_VENT))
        o.append(mito_bean(594, 312, 0.7))
        o.append(text(606, 316, '−15 %', 'caption', MITO_BASE, upper=False))
        o.append(floater(770, 404, '−9', 'TOXIN', TOXIN))
        o.append(floater(620, 262, '+5', 'DNA', DNA, opacity=0.9))
        o.append(pill(CX, 510, 'WARM VENT · DECAY ×1.5 · ORANGE RODS', 'label', WHITE, dot=ZONE_VENT))
        o.append(mass_chip(586, 470))
    return ''.join(o)


def mass_chip(cx, cy):
    """Own mass with its trend, beside the cell while the mass is changing."""
    width = 104
    return (f'<rect x="{cx - width / 2}" y="{cy - 12}" width="{width}" height="24" rx="12" fill="{CALLOUT}" opacity="0.8"/>'
            f'<text x="{cx - width / 2 + 10}" y="{cy + 6}" font-family="{kit.MONO}" font-size="16" font-weight="bold" fill="{TEXT}">{OWN_MASS}</text>'
            f'<path d="M{cx - 4},{cy - 4} l5,8 l5,-8 z" fill="{DANGER}"/>'
            f'<text x="{cx + 12}" y="{cy + 5}" font-family="{kit.MONO}" font-size="13" fill="{TEXT}">9/s</text>')


# --- the camera lever --------------------------------------------------------------------------
STRIP_W, STRIP_H = 1280, 660
VIEWPORT_HALF_PX = 400  # half of the 800 px reference viewport
SQRT_ZOOM_SCALE = 300 / math.sqrt(4 * math.sqrt(20))  # Z1: 300 wu half-height at the starting radius


def radius_wu(mass):
    return 4 * math.sqrt(mass)  # CELL_RADIUS_SCALE × √mass


def px_today(mass):
    r = radius_wu(mass)
    return r * VIEWPORT_HALF_PX / min(max(12 * r, 300), 1500)


def px_partial(mass):
    r = radius_wu(mass)
    return r * VIEWPORT_HALF_PX / min(max(SQRT_ZOOM_SCALE * math.sqrt(r), 300), 1500)


def px_slow(seconds, before=312, after=372, zoom_seconds=6.0):
    old_half, new_half = 12 * radius_wu(before), 12 * radius_wu(after)
    half = new_half + (old_half - new_half) * math.exp(-seconds / zoom_seconds)
    return radius_wu(after if seconds > 0 else before) * VIEWPORT_HALF_PX / half


def camera_strip():
    rng = random.Random(5)
    o = [f'<rect width="{STRIP_W}" height="{STRIP_H}" fill="url(#bg-field)"/>',
         text(24, 40, 'Own cell on screen at 1280 × 800 · dashed ring = 33 px, today', 'label', LABEL)]
    rows = [
        ('TODAY', 'zoom locked to size', [(f'mass {m}', px_today(m)) for m in (20, 80, 312, 900)]),
        ('Z1 · PARTIAL ZOOM', 'view grows with √radius', [(f'mass {m}', px_partial(m)) for m in (20, 80, 312, 900)]),
        ('Z2 · SLOW ZOOM', '6 s ease, lock kept', [('mass 312', px_slow(0)), ('+60 at 0.3 s', px_slow(0.3)),
                                                  ('3 s', px_slow(3)), ('10 s', px_slow(10))]),
    ]
    for row_index, (title, caption, tiles) in enumerate(rows):
        centre_y = 162 + row_index * 200
        o.append(text(24, centre_y - 4, title, 'label', TEXT))
        o.append(text(24, centre_y + 16, caption, 'body', MUTED, upper=False))
        for tile_index, (tile_caption, px) in enumerate(tiles):
            centre_x = 360 + tile_index * 240
            o.append(panel(centre_x - 110, centre_y - 92, 220, 184))
            o.append(f'<circle cx="{centre_x}" cy="{centre_y - 14}" r="33.3" fill="none" stroke="{MUTED}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>')
            o.append(kit.cell(centre_x, centre_y - 14, px, 'cyan', 'euk', rng, heading=-28, speed=0.2, self_ring=True))
            o.append(text(centre_x, centre_y + 80, f'{tile_caption} · {px:.0f} px', 'label', TEXT, 'middle', upper=False))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{STRIP_W}" height="{STRIP_H}" viewBox="0 0 {STRIP_W} {STRIP_H}">'
            f'{kit.defs()}{"".join(o)}</svg>')


# --- chrome ------------------------------------------------------------------------
def leaderboard(full=False, legend=False, tab_hint='TAB'):
    w = 360 if full else 240
    x, y = W - MARGIN - w, MARGIN
    rows = len(BOARD)
    h = 26 + 16 + 24 * rows + (22 if legend else 0)
    o = [panel(x, y, w, h)]
    o.append(text(x + 10, y + 17, 'LEADERBOARD', 'caption', LABEL))
    o.append(text(x + w - 10, y + 17, tab_hint, 'caption', MUTED, 'end'))
    cols = {'lv': x + 150, 'score': x + 204} if not full else {'lv': x + 150, 'score': x + 212, 'mass': x + 280, 'eng': x + 350}
    ly = y + 26 + 11
    o.append(text(cols['lv'], ly, 'LV', 'caption', LABEL, 'end'))
    o.append(text(cols['score'], ly, 'SCORE', 'caption', LABEL, 'end'))
    if full:
        o.append(text(cols['mass'], ly, 'MASS', 'caption', LABEL, 'end'))
        o.append(text(cols['eng'], ly, 'ENGULFS', 'caption', LABEL, 'end'))
    for i, (rank, name, pal, lvl, score, mass, eng, own) in enumerate(BOARD):
        ry = y + 26 + 16 + 24 * i
        if own:
            o.append(f'<rect x="{x + 4}" y="{ry + 2}" width="{w - 8}" height="20" rx="4" fill="{PAL[pal][1]}" opacity="0.12"/>')
        col = TEXT if own else '#b9c8d6'
        o.append(text(x + 14, ry + 16, str(rank), 'body', MUTED, 'middle'))
        o.append(swatch(x + 32, ry + 12, pal))
        o.append(text(x + 44, ry + 16, name, 'body', col, weight='bold' if own else None))
        o.append(text(cols['lv'], ry + 16, str(lvl), 'body', MUTED, 'end'))
        o.append(f'<text x="{cols["score"]}" y="{ry + 16}" font-family="{kit.MONO}" font-size="14" fill="{col}" text-anchor="end">{score}</text>')
        if full:
            o.append(f'<text x="{cols["mass"]}" y="{ry + 16}" font-family="{kit.MONO}" font-size="14" fill="{col}" text-anchor="end">{mass}</text>')
            o.append(f'<text x="{cols["eng"]}" y="{ry + 16}" font-family="{kit.MONO}" font-size="14" fill="{col}" text-anchor="end">{eng}</text>')
        if own and not full:
            o.append(text(cols['score'] + 6, ry + 16, '+5', 'caption', DNA))
    if legend:
        o.append(text(x + 10, y + h - 8, 'SCORE = DNA + 25 PER ENGULF · KEPT ON DEATH', 'caption', MUTED))
    return ''.join(o)


def round_clock(caption='BLOOM · DNA ×2'):
    x = W - MARGIN
    width = max(120, text_width(caption, 'label') + 24)
    o = [backing(x - width, H - MARGIN - 52, width + 8, 60, opacity=0.55)]
    o.append(text(x, H - MARGIN - 20, '1:48', 'clock', GOLD, 'end'))
    o.append(text(x, H - MARGIN - 4, caption, 'label', GOLD, 'end'))
    return ''.join(o)


# --- option B: the stats strip ----------------------------------------------------------
def stats_strip():
    x, y, w, h = MARGIN, MARGIN, 300, 118
    o = [panel(x, y, w, h)]
    o.append(f'<text x="{x + 12}" y="{y + 34}" font-family="{kit.MONO}" font-size="28" font-weight="bold" fill="{TEXT}">{OWN_MASS}</text>')
    o.append(text(x + 76, y + 32, 'MASS', 'caption', LABEL))
    o.append(f'<path d="M{x + 122},{y + 20} l7,10 l7,-10 z" fill="{DANGER}"/>')
    o.append(f'<text x="{x + 142}" y="{y + 31}" font-family="{kit.MONO}" font-size="16" font-weight="bold" fill="{TEXT}">9/s</text>')
    o.append(sparkline(x + 196, y + 12, 92, 24, ACCENT))
    causes = [('+1 food', FOOD_MOTE), ('−1 vent', ZONE_VENT), ('−9 toxin', TOXIN)]
    cx = x + 12
    for s, col in causes:
        o.append(f'<circle cx="{cx + 4}" cy="{y + 52}" r="4" fill="{col}"/>')
        o.append(text(cx + 12, y + 56, s, 'label', TEXT, upper=False))
        cx += text_width(s, 'label') * 0.8 + 30
    o.append(f'<line x1="{x + 10}" y1="{y + 68}" x2="{x + w - 10}" y2="{y + 68}" stroke="{PANEL_RIM}"/>')
    o.append(text(x + 12, y + 88, 'LV 5', 'label', TEXT))
    o.append(f'<rect x="{x + 52}" y="{y + 80}" width="110" height="6" rx="3" fill="{PANEL_RIM}"/>')
    o.append(f'<rect x="{x + 52}" y="{y + 80}" width="{110 * 0.62:.0f}" height="6" rx="3" fill="url(#dna-bar)"/>')
    o.append(text(x + 170, y + 88, 'DNA 62 %', 'label', DNA, upper=False))
    o.append(f'<circle cx="{x + 16}" cy="{y + 105}" r="4" fill="none" stroke="{FOOD_MOTE}" stroke-width="1.6"/>')
    o.append(text(x + 26, y + 109, f'eat < {PREY_BELOW}', 'label', TEXT, upper=False))
    o.append(f'<circle cx="{x + 110}" cy="{y + 105}" r="4" fill="none" stroke="{DANGER}" stroke-width="1.6" stroke-dasharray="2 2"/>')
    o.append(text(x + 120, y + 109, f'eats you > {THREAT_ABOVE}', 'label', TEXT, upper=False))
    return ''.join(o)


EFFECTS = [  # glyph, colour, caption
    ('vent', ZONE_VENT, 'DECAY ×1.5'),
    ('toxin', TOXIN, '−9/S'),
    ('bloom', GOLD, 'DNA ×2'),
    ('mitochondrion', MITO_BASE, '−15 %'),
    ('cytoskeleton', ACCENT, '+64 %'),
]


def effects_row(tooltip_index=4):
    slot, gap = 40, 30
    x0, y0 = MARGIN + 22, H - MARGIN - 60
    total = len(EFFECTS) * slot + (len(EFFECTS) - 1) * gap
    o = [backing(MARGIN - 4, y0 - 10, total + 24, 74, opacity=0.55)]
    for i, (kind, col, cap) in enumerate(EFFECTS):
        sx = x0 + i * (slot + gap)
        hot = i == tooltip_index
        o.append(f'<rect x="{sx}" y="{y0}" width="{slot}" height="{slot}" rx="8" fill="#0b1a2c" stroke="{col}" '
                 f'stroke-opacity="{1 if hot else 0.7}" stroke-width="{2 if hot else 1}"/>')
        o.append(icon(kind, sx + slot / 2, y0 + slot / 2, col, 1.05))
        o.append(text(sx + slot / 2, y0 + slot + 16, cap, 'caption', TEXT, 'middle'))
    tx = x0 + tooltip_index * (slot + gap) + slot / 2
    tip = 'Cytoskeleton III · +64 % acceleration'
    tw = text_width(tip, 'body') + 24
    tip_x = min(tx - tw / 2, W - MARGIN - tw)
    tip_x = max(tip_x, MARGIN)
    o.append(panel(round(tip_x, 1), y0 - 46, round(tw, 1), 30, rx=6))
    o.append(text(round(tip_x + 12, 1), y0 - 26, tip, 'body', TEXT))
    return ''.join(o)


# --- option C: hold-Tab panel and coach ---------------------------------------------------
def tab_panel():
    x, y, w = MARGIN, MARGIN, 330
    rows = []
    o = []

    def row(ry, dot, left, right, right_col=TEXT, glyph=None):
        parts = []
        if glyph:
            parts.append(icon(glyph[0], x + 20, ry - 4, glyph[1], 0.7))
        elif dot:
            parts.append(f'<circle cx="{x + 20}" cy="{ry - 4}" r="4" fill="{dot}"/>')
        parts.append(text(x + 34, ry, left, 'body', TEXT, upper=False))
        parts.append(f'<text x="{x + w - 12}" y="{ry}" font-family="{kit.MONO}" font-size="14" fill="{right_col}" text-anchor="end">{kit.esc(right)}</text>')
        return ''.join(parts)

    def heading(hy, s):
        return text(x + 12, hy, s, 'caption', LABEL)

    ry = y + 22
    rows.append(heading(ry, 'MASS'))
    rows.append(f'<text x="{x + 12}" y="{ry + 30}" font-family="{kit.MONO}" font-size="28" font-weight="bold" fill="{TEXT}">{OWN_MASS}</text>')
    rows.append(f'<path d="M{x + 80},{ry + 12} l7,10 l7,-10 z" fill="{DANGER}"/>')
    rows.append(f'<text x="{x + 100}" y="{ry + 24}" font-family="{kit.MONO}" font-size="16" font-weight="bold" fill="{TEXT}">9/s</text>')
    rows.append(sparkline(x + 180, ry + 4, 136, 26, ACCENT))
    ry += 58
    rows.append(row(ry, FOOD_MOTE, 'Food', '+1.1/s', FOOD_MOTE))
    ry += 22
    rows.append(row(ry, ZONE_VENT, 'Decay · vent ×1.5 · mito −15 %', '−0.7/s', ZONE_VENT))
    ry += 22
    rows.append(row(ry, TOXIN, 'Toxin · touching Nib', '−9.4/s', TOXIN))
    ry += 14
    rows.append(f'<line x1="{x + 10}" y1="{ry}" x2="{x + w - 10}" y2="{ry}" stroke="{PANEL_RIM}"/>')
    ry += 20
    rows.append(heading(ry, 'HERE'))
    ry += 22
    rows.append(row(ry, ZONE_VENT, 'Warm vent · orange rods', 'decay ×1.5'))
    ry += 22
    rows.append(row(ry, GOLD, 'Bloom · 1:48 left', 'food ×1.5 · DNA ×2', GOLD))
    ry += 14
    rows.append(f'<line x1="{x + 10}" y1="{ry}" x2="{x + w - 10}" y2="{ry}" stroke="{PANEL_RIM}"/>')
    ry += 20
    rows.append(heading(ry, 'SIZE'))
    ry += 22
    rows.append(row(ry, None, 'You eat', f'< {PREY_BELOW}', FOOD_MOTE, glyph=None) + f'<circle cx="{x + 20}" cy="{ry - 4}" r="5" fill="none" stroke="{FOOD_MOTE}" stroke-width="1.6"/>')
    ry += 22
    rows.append(row(ry, None, 'Eats you', f'> {THREAT_ABOVE}', DANGER) + f'<circle cx="{x + 20}" cy="{ry - 4}" r="5" fill="none" stroke="{DANGER}" stroke-width="1.6" stroke-dasharray="2 2"/>')
    ry += 22
    rows.append(row(ry, None, 'Speed', '−50 %') + f'<path d="M{x + 14},{ry - 4} h12 m-4,-4 l4,4 l-4,4" fill="none" stroke="{MUTED}" stroke-width="1.6"/>')
    ry += 14
    rows.append(f'<line x1="{x + 10}" y1="{ry}" x2="{x + w - 10}" y2="{ry}" stroke="{PANEL_RIM}"/>')
    ry += 20
    rows.append(heading(ry, 'TRAITS'))
    ry += 22
    rows.append(row(ry, None, 'Mitochondrion I', '−15 % decay', glyph=('mitochondrion', MITO_BASE)))
    ry += 22
    rows.append(row(ry, None, 'Cytoskeleton III', '+64 % accel', glyph=('cytoskeleton', ACCENT)))
    ry += 22
    rows.append(row(ry, None, 'World', 'ahead', ACCENT) + f'<circle cx="{x + 20}" cy="{ry - 4}" r="5" fill="none" stroke="{MUTED}" stroke-width="1.4"/>')
    h = ry + 14 - y
    o.append(panel(x, y, w, h))
    o.extend(rows)
    return ''.join(o)


def coach_pill(s):
    width = text_width(s, 'body') + 40
    y = H - MARGIN - 30
    return (backing(CX - width / 2, y, width, 30, rx=15, opacity=0.8)
            + f'<rect x="{CX - width / 2:.1f}" y="{y}" width="{width:.1f}" height="30" rx="15" fill="none" stroke="{ZONE_VENT}" stroke-opacity="0.6"/>'
            + text(CX, y + 20, s, 'body', TEXT, 'middle'))


# --- frames ----------------------------------------------------------------------------------
def frame_a():
    return world('diegetic') + leaderboard(tab_hint='HOLD TAB') + round_clock()


def frame_b():
    return world('strip') + stats_strip() + effects_row() + leaderboard(tab_hint='HOLD TAB') + round_clock()


def frame_c():
    return (world('diegetic') + tab_panel() + leaderboard(full=True, legend=True, tab_hint='TAB HELD')
            + coach_pill('The vent burns mass faster · eat or move on') + round_clock())


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    frames = {'legibility-a-diegetic': frame_a, 'legibility-b-strip': frame_b, 'legibility-c-coach-tab': frame_c}
    for name, build in frames.items():
        (out / f'{name}.svg').write_text(kit.frame(build()), encoding='utf-8')
        print('wrote', out / f'{name}.svg')
    (out / 'legibility-camera-lever.svg').write_text(camera_strip(), encoding='utf-8')
    print('wrote', out / 'legibility-camera-lever.svg')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

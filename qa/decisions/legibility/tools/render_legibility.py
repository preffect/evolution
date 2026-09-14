#!/usr/bin/env python3
"""Legibility decision mockups (#321): three 1280x800 in-round frames over one dish view, and a camera sheet.

A: diegetic, stronger world and on-cell cues. B: a minimal stats strip. C: A plus a hold-Tab panel and a coach pill.
Reuses the #143 HUD-layout kit (palette, type roles, dish, cells) from qa/decisions/hud-layout/tools/render.py.
The scene: you are Moss (cyan eukaryote, level 5, mass 312, Mitochondrion I, Cytoskeleton III) in the warm vent,
touching a toxic cell, with 1:48 of bloom left. Every text is set in a type role at its role size.
Cell sizes follow a camera: B at today's lock (Z0), A and C at partial zoom (Z1). Seeded, so a re-run reproduces
the PNGs.
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

# Colours beyond the §7 UI roles (danger, gold, DNA, accent) that the frames borrow; #324 lists them as new roles.
GAIN = FOOD_MOTE  # gain floaters, prey rings
ZONE_UI = ZONE_VENT  # the zone's tint as a UI dot or rim
ORGANELLE_UI = MITO_BASE  # an organelle's colour on its trait glyph, as the picker medallions do
TOXIN_WORLD = '#d05cff'  # Nib's own toxin glow: world art, never UI; the toxin cue is DANGER (palette §2)

kit.VENT = (800, 300)  # the vent is the dish origin; the own cell sits inside it
kit.ROLES.setdefault('figure', (14, kit.MONO, 'normal', False, 0))  # ui-type.md §7; the #143 kit predates the role

OWN_MASS = 312
PREY_BELOW = 250  # 312 / 1.25
THREAT_ABOVE = 390  # 312 x 1.25
HUD_PLAYER_EXCLUSION_PX = 120

# --- cameras (render/camera.ts and the Z1 proposal) ----------------------------------
VIEWPORT_HALF_PX = 400  # half of the 800 px reference viewport
SQRT_ZOOM_SCALE = 300 / math.sqrt(4 * math.sqrt(20))  # Z1: 300 wu half-height at the starting radius


def radius_wu(mass):
    return 4 * math.sqrt(mass)  # CELL_RADIUS_SCALE × √mass


def half_height_today(radius):
    return min(max(12 * radius, 300), 1500)  # CAMERA_VIEW_RADII × radius, clamped


def half_height_partial(radius):
    return min(max(SQRT_ZOOM_SCALE * math.sqrt(radius), 300), 1500)


HALF_HEIGHT = {'z0': half_height_today, 'z1': half_height_partial}


def zoom_for(camera):
    """px per wu while the own cell is at OWN_MASS."""
    return VIEWPORT_HALF_PX / HALF_HEIGHT[camera](radius_wu(OWN_MASS))


OTHERS = [  # name, x, y, mass, palette, stage, heading, relation; Nib's position is set by contact
    ('Amoeboid', 1000, 560, 1030, 'magenta', 'amoeba', 200, 'threat'),
    ('Kelp', 470, 230, 270, 'lime', 'euk', 150, 'even'),
    ('wild', 460, 600, 60, 'amber', 'prokaryote', 40, 'prey'),
    ('Dot', 880, 700, 24, 'rose', 'protocell', 0, 'prey'),
    ('Nib', None, None, 96, 'coral', 'euk', 120, 'toxic'),
]
NIB_CONTACT_DEG = 38

BOARD = [  # rank, name, palette, level, score, mass, engulfs, own
    (1, 'Amoeboid', 'magenta', 7, 540, 1030, 4, False),
    (2, 'Moss', 'cyan', 5, 412, 312, 1, True),
    (3, 'Kelp', 'lime', 5, 388, 270, 0, False),
    (4, 'Nib', 'coral', 4, 260, 96, 2, False),
    (5, 'Dot', 'rose', 2, 96, 24, 0, False),
]

BLOOM_CAPTION = 'BLOOM · FOOD ×1.5 · DNA DROPS ×2'
chrome_area_px = [0.0]  # DOM chrome drawn in the current frame, for the coverage figure


def placed_others(zoom, own_r):
    placed = []
    for name, x, y, mass, pal, stage, heading, relation in OTHERS:
        r = radius_wu(mass) * zoom
        if name == 'Nib':
            distance = own_r + r - 3
            x = CX + distance * math.cos(math.radians(NIB_CONTACT_DEG))
            y = CY + distance * math.sin(math.radians(NIB_CONTACT_DEG))
        placed.append((name, x, y, r, pal, stage, heading, relation))
    return placed


# --- small drawing helpers ------------------------------------------------------
def chrome_panel(x, y, w, h, rx=8):
    chrome_area_px[0] += w * h
    return panel(x, y, w, h, rx)


def chrome_backing(x, y, w, h, rx=12, opacity=0.62):
    chrome_area_px[0] += w * h
    return backing(x, y, w, h, rx, opacity)


def pill(cx, cy, s, rim=None, anchor='middle', dot=None):
    """The label pill: `label` role, WHITE, on the callout backing, with an optional role-colour rim or dot."""
    width = text_width(s, 'label') + 20 + (12 if dot else 0)
    x = cx - width / 2 if anchor == 'middle' else cx
    o = [f'<rect x="{x:.1f}" y="{cy - 11:.1f}" width="{width:.1f}" height="22" rx="11" fill="{CALLOUT}" opacity="0.82"'
         + (f' stroke="{rim}" stroke-width="2"' if rim else '') + '/>']
    tx = x + 10
    if dot:
        o.append(f'<circle cx="{tx + 3:.1f}" cy="{cy:.1f}" r="4" fill="{dot}"/>')
        tx += 12
    o.append(text(round(tx, 1), round(cy + 4, 1), s, 'label', WHITE))
    return ''.join(o)


def floater(x, y, number, cause, rim, glyph=None, note=None):
    """A mass or DNA change: the number in `value`, its cause in `label`, both WHITE; the rim carries the colour."""
    number_width = text_width(number, 'value')
    cause_width = text_width(cause, 'label')
    note_width = 22 + text_width(note, 'label') if glyph else 0
    width = number_width + 8 + cause_width + note_width + 24
    left = x - width / 2
    o = [f'<rect x="{left:.1f}" y="{y - 14:.1f}" width="{width:.1f}" height="28" rx="14" fill="{CALLOUT}" opacity="0.82" '
         f'stroke="{rim}" stroke-width="2"/>',
         text(round(left + 12, 1), round(y + 7, 1), number, 'value', WHITE),
         text(round(left + 20 + number_width, 1), round(y + 5, 1), cause, 'label', WHITE)]
    if glyph:
        glyph_x = left + 20 + number_width + cause_width + 14
        o.append(icon(glyph, round(glyph_x, 1), y, ORGANELLE_UI, 0.7))
        o.append(text(round(glyph_x + 12, 1), round(y + 5, 1), note, 'label', WHITE))
    return ''.join(o)


def sparkline(x, y, w, h, col):
    samples = [250, 256, 263, 270, 279, 288, 296, 303, 311, 318, 324, 329, 333, 335, 336, 334, 332, 329, 327, 324, 321, 312]
    lo, hi = 240, 340
    pts = ' '.join(f'{x + w * i / (len(samples) - 1):.1f},{y + h - h * (v - lo) / (hi - lo):.1f}' for i, v in enumerate(samples))
    last = pts.split(' ')[-1].split(',')
    return (f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/>'
            f'<circle cx="{last[0]}" cy="{last[1]}" r="2.5" fill="{DANGER}"/>')


def trend_down(x, y, size=10):
    return f'<path d="M{x},{y} l{size * 0.7:.1f},{size} l{size * 0.7:.1f},{-size}z" fill="{DANGER}"/>'


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
            ex, ey = 4.5 * math.cos(math.radians(a)), 4.5 * math.sin(math.radians(a))
            g.append(f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="3.2" ry="2" transform="rotate({a} {ex:.1f} {ey:.1f})"/>')
        g.append(f'<circle r="1.8" fill="{col}" stroke="none"/>')
    elif kind == 'cytoskeleton':
        g.append('<circle r="9"/><path d="M-6,-6 L6,6 M6,-6 L-6,6 M0,-9 L0,9 M-9,0 L9,0" stroke-width="1.2"/>')
    g.append('</g>')
    return ''.join(g)


# --- the world -------------------------------------------------------------------
def heat_shimmer(own_r):
    """Vent decay: warm wisps lifting off the upper membrane (world art in the zone's own tint)."""
    o = []
    for i, a in enumerate((-150, -120, -95, -70, -40)):
        rad = math.radians(a)
        x, y = CX + own_r * 1.02 * math.cos(rad), CY + own_r * 1.02 * math.sin(rad)
        o.append(f'<path d="M{x:.1f},{y:.1f} q{-4 + i:.1f},-8 0,-15 t0,-13" fill="none" stroke="{ZONE_VENT}" stroke-width="2" '
                 f'stroke-linecap="round" opacity="0.55" filter="url(#blur-1_5)"/>')
    return ''.join(o)


def toxin_contact(x, y, r, own_r, flash):
    """Nib's toxin glow (world art), and with `flash` the palette's toxin damage flash in DANGER on the own membrane."""
    o = [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 1.9:.1f}" fill="{TOXIN_WORLD}" opacity="0.14" filter="url(#blur-10)"/>']
    if not flash:
        return ''.join(o)
    ang = math.atan2(y - CY, x - CX)
    mx, my = CX + own_r * math.cos(ang), CY + own_r * math.sin(ang)
    o.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="14" fill="{DANGER}" opacity="0.38" filter="url(#blur-6)"/>')
    rng = random.Random(7)
    for _ in range(9):
        a = ang + rng.uniform(-0.9, 0.9)
        d = own_r * rng.uniform(0.8, 1.0)
        o.append(f'<circle cx="{CX + d * math.cos(a):.1f}" cy="{CY + d * math.sin(a):.1f}" r="{rng.uniform(1, 2):.1f}" fill="{DANGER}" opacity="0.8"/>')
    return ''.join(o)


def relation_ring(name, x, y, r, relation, labelled):
    if relation == 'threat':
        return (f'<circle cx="{x}" cy="{y}" r="{r * 1.3:.0f}" fill="none" stroke="{DANGER}" stroke-width="2" stroke-dasharray="6 5" '
                'opacity="0.9" filter="url(#glow-soft)"/>'
                + pill(x, y - r * 1.3 - 18, f'{name.upper()} CAN ENGULF YOU', rim=DANGER))
    if relation == 'prey':
        ring_r = max(r * 1.3, r + 7)
        o = [f'<circle cx="{x}" cy="{y}" r="{ring_r:.1f}" fill="none" stroke="{GAIN}" stroke-width="1.6" opacity="0.85"/>']
        if labelled:
            o.append(pill(x, y + ring_r + 18, 'EDIBLE', rim=GAIN))
        return ''.join(o)
    if relation == 'toxic':
        o = [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 1.35:.1f}" fill="none" stroke="{DANGER}" stroke-width="1.6" stroke-dasharray="2 3" opacity="0.9"/>']
        if labelled:
            o.append(pill(x + r * 1.35 + 8, y + r * 0.6, 'EDIBLE · TOXIC', rim=DANGER, anchor='start'))
        return ''.join(o)
    return ''


def own_indicators(own_r, active_glow):
    """Today's own-cell indicators (DNA ring with its 17 px floor, `value` numeral), plus the trait glow."""
    o = []
    if active_glow:
        for i in range(3):
            a = math.radians(30 + 120 * i)
            d = own_r * 0.62
            o.append(f'<circle cx="{d * math.cos(a):.1f}" cy="{d * math.sin(a):.1f}" r="{own_r * 0.22:.1f}" fill="{MITO_BASE}" opacity="0.55" filter="url(#blur-3)"/>')
    ring_r = max(0.44 * own_r, 17)
    o.append(f'<circle r="{ring_r:.1f}" fill="none" stroke="{CALLOUT}" stroke-width="7" opacity="0.55"/>')
    o.append(f'<path d="{arc(0, 0, ring_r, 0.62)}" fill="none" stroke="{DNA}" stroke-width="4" stroke-linecap="round"/>')
    o.append(text(0, 7, '5', 'value', WHITE, 'middle', weight='bold', extra=f'stroke="{CALLOUT}" stroke-width="3" paint-order="stroke"'))
    return ''.join(o)


def mass_chip(cx, cy):
    """Own mass and its trend in `value`, beside the cell while the mass is changing."""
    mass_width = text_width(str(OWN_MASS), 'value')
    rate_width = text_width('9/s', 'value')
    width = mass_width + rate_width + 50
    left = cx - width / 2
    return (f'<rect x="{left:.1f}" y="{cy - 14}" width="{width:.1f}" height="28" rx="14" fill="{CALLOUT}" opacity="0.82"/>'
            + text(round(left + 12, 1), cy + 7, str(OWN_MASS), 'value', WHITE)
            + trend_down(round(left + 20 + mass_width, 1), cy - 5)
            + text(round(left + 38 + mass_width, 1), cy + 7, '9/s', 'value', WHITE))


def world(cues, camera):
    """cues: 'diegetic' adds floaters, shimmer, labels, the mass chip and the zone pill; 'strip' keeps today's world
    plus plain rings. camera: 'z0' today's size lock, 'z1' partial zoom."""
    zoom = zoom_for(camera)
    own_r = radius_wu(OWN_MASS) * zoom
    others = placed_others(zoom, own_r)
    diegetic = cues == 'diegetic'
    rng = random.Random(42)
    circles = [(x, y, r) for _n, x, y, r, *_ in others] + [(CX, CY, own_r)]
    o = [kit.field(rng), kit.motes(rng, circles), kit.motes(random.Random(43), circles), kit.bacteria(rng)]
    for name, x, y, r, pal, stage, heading, relation in others:
        if relation == 'toxic':
            o.append(toxin_contact(x, y, r, own_r, flash=diegetic))
        if stage == 'prokaryote':
            o.append(kit.flagellum(x, y, r, heading))
        o.append(kit.cell(x, y, r, pal, stage, rng, heading=heading, speed=0.3))
    if diegetic:
        o.append(heat_shimmer(own_r))
    o.append(kit.flagellum(CX, CY, own_r, -28))
    o.append(kit.cell(CX, CY, own_r, 'cyan', 'euk', rng, heading=-28, speed=0.4, self_ring=True,
                      extra_after=own_indicators(own_r, active_glow=diegetic)))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    for name, x, y, r, _pal, _stage, _heading, relation in others:
        o.append(relation_ring(name, x, y, r, relation, labelled=diegetic and name in ('wild', 'Nib')))
    if diegetic:
        o.append(floater(640, 258, '+5', 'DNA', DNA))
        o.append(floater(724, 312, '+3', 'FOOD', GAIN))
        o.append(floater(516, 312, '−0.5/s', 'DECAY', MUTED, glyph='mitochondrion', note='−15 %'))
        o.append(floater(496, 360, '−0.25/s', 'VENT', ZONE_UI))
        o.append(floater(800, 380, '−9.4/s', 'TOXIN', DANGER))
        o.append(mass_chip(560, 478))
        o.append(pill(CX, 526, 'WARM VENT · DECAY ×1.5 · ORANGE RODS', dot=ZONE_UI))
    return ''.join(o)


# --- the camera sheet --------------------------------------------------------------------------
STRIP_W, STRIP_H = 1280, 660


def px_at(camera, mass):
    radius = radius_wu(mass)
    return radius * VIEWPORT_HALF_PX / HALF_HEIGHT[camera](radius)


def px_eased(seconds, zoom_seconds, before=312, after=372):
    """The own cell right after a +60 gain while the zoom eases: same peak whatever the time constant."""
    old_half, new_half = 12 * radius_wu(before), 12 * radius_wu(after)
    half = new_half + (old_half - new_half) * math.exp(-seconds / zoom_seconds)
    return radius_wu(after if seconds > 0 else before) * VIEWPORT_HALF_PX / half


def camera_strip():
    rng = random.Random(5)
    reference_px = px_at('z0', OWN_MASS)
    o = [f'<rect width="{STRIP_W}" height="{STRIP_H}" fill="url(#bg-field)"/>',
         text(24, 40, f'Own cell on screen at 1280 × 800 · solid gold ring = {reference_px:.0f} px, today', 'label', LABEL)]
    moments = [(0, 'mass 312'), (1e-6, '+60, just after'), (3, '3 s later'), (10, '10 s later')]
    rows = [
        ('TODAY · Z0', 'zoom locked to size', [(f'mass {m}', px_at('z0', m), None) for m in (20, 80, 312, 900)]),
        ('Z1 · PARTIAL ZOOM', 'view grows with √radius', [(f'mass {m}', px_at('z1', m), None) for m in (20, 80, 312, 900)]),
        ('Z2 · SLOW ZOOM', 'same peak, longer swell',
         [(label, px_eased(t, 6.0), f'today {px_eased(t, 0.6):.0f} px') for t, label in moments]),
    ]
    for row_index, (title, caption, tiles) in enumerate(rows):
        centre_y = 162 + row_index * 200
        o.append(text(24, centre_y - 4, title, 'label', TEXT))
        o.append(text(24, centre_y + 16, caption, 'body', MUTED, upper=False))
        for tile_index, (tile_caption, px, today) in enumerate(tiles):
            centre_x = 360 + tile_index * 240
            cell_y = centre_y - 20
            o.append(panel(centre_x - 110, centre_y - 92, 220, 184))
            o.append(kit.cell(centre_x, cell_y, px, 'cyan', 'euk', rng, heading=-28, speed=0.2, self_ring=True))
            o.append(f'<circle cx="{centre_x}" cy="{cell_y}" r="{reference_px:.1f}" fill="none" stroke="{GOLD}" stroke-width="1.2" opacity="0.9"/>')
            caption_y = centre_y + (62 if today else 80)
            o.append(text(centre_x, caption_y, f'{tile_caption} · {px:.0f} px', 'label', TEXT, 'middle', upper=False))
            if today:
                o.append(text(centre_x, caption_y + 18, today, 'label', TEXT, 'middle', upper=False))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{STRIP_W}" height="{STRIP_H}" viewBox="0 0 {STRIP_W} {STRIP_H}">'
            f'{kit.defs()}{"".join(o)}</svg>')


# --- chrome ------------------------------------------------------------------------
def leaderboard(full=False, legend=False, tab_hint='TAB'):
    w = 360 if full else 240
    x, y = W - MARGIN - w, MARGIN
    rows = len(BOARD)
    h = 26 + 16 + 24 * rows + (44 if legend else 0)
    o = [chrome_panel(x, y, w, h)]
    o.append(text(x + 10, y + 17, 'LEADERBOARD', 'caption', LABEL))
    o.append(text(x + w - 10, y + 17, tab_hint, 'caption', MUTED, 'end'))
    cols = {'lv': x + 170, 'score': x + 228} if not full else {'lv': x + 150, 'score': x + 212, 'mass': x + 280, 'eng': x + 350}
    label_y = y + 26 + 11
    o.append(text(cols['lv'], label_y, 'LV', 'caption', LABEL, 'end'))
    o.append(text(cols['score'], label_y, 'SCORE', 'caption', LABEL, 'end'))
    if full:
        o.append(text(cols['mass'], label_y, 'MASS', 'caption', LABEL, 'end'))
        o.append(text(cols['eng'], label_y, 'ENGULFS', 'caption', LABEL, 'end'))
    for i, (rank, name, pal, lvl, score, mass, eng, own) in enumerate(BOARD):
        ry = y + 26 + 16 + 24 * i
        if own:
            o.append(f'<rect x="{x + 4}" y="{ry + 2}" width="{w - 8}" height="20" rx="4" fill="{PAL[pal][1]}" opacity="0.12"/>')
        col = TEXT if own else '#b9c8d6'
        o.append(text(x + 14, ry + 16, str(rank), 'body', MUTED, 'middle'))
        o.append(swatch(x + 32, ry + 12, pal))
        o.append(text(x + 44, ry + 16, name, 'body', col, weight='bold' if own else None))
        o.append(text(cols['lv'], ry + 16, str(lvl), 'body', MUTED, 'end'))
        o.append(text(cols['score'], ry + 16, str(score), 'figure', col, 'end'))
        if full:
            o.append(text(cols['mass'], ry + 16, str(mass), 'figure', col, 'end'))
            o.append(text(cols['eng'], ry + 16, str(eng), 'figure', col, 'end'))
    if legend:
        o.append(text(x + 10, y + h - 26, 'SCORE = DNA + 25 PER ENGULF', 'label', TEXT))
        o.append(text(x + 10, y + h - 9, 'KEPT ON DEATH', 'label', TEXT))
    return ''.join(o)


def round_clock():
    x = W - MARGIN
    width = text_width(BLOOM_CAPTION, 'label') + 24
    o = [chrome_backing(x - width, H - MARGIN - 52, width + 8, 60, opacity=0.55)]
    o.append(text(x, H - MARGIN - 20, '1:48', 'clock', GOLD, 'end'))
    o.append(text(x, H - MARGIN - 4, BLOOM_CAPTION, 'label', GOLD, 'end'))
    return ''.join(o)


# --- option B: the stats strip ----------------------------------------------------------
def stats_strip():
    x, y, w, h = MARGIN, MARGIN, 340, 150
    o = [chrome_panel(x, y, w, h)]
    o.append(text(x + 12, y + 36, str(OWN_MASS), 'number', TEXT))
    o.append(text(x + 80, y + 34, 'MASS', 'label', LABEL))
    o.append(trend_down(x + 130, y + 22, 11))
    o.append(text(x + 150, y + 35, '9/s', 'value', TEXT))
    o.append(sparkline(x + 226, y + 14, 102, 24, ACCENT))
    causes = [(0, 0, '+1.1 food', GAIN), (1, 0, '−0.5 decay', MUTED), (0, 1, '−0.25 vent', ZONE_UI), (1, 1, '−9.4 toxin', DANGER)]
    for column, line, s, col in causes:
        cx, cy = x + 12 + column * 160, y + 60 + line * 20
        o.append(f'<circle cx="{cx + 4}" cy="{cy - 4}" r="4" fill="{col}"/>')
        o.append(text(cx + 14, cy, s, 'label', TEXT, upper=False))
    o.append(f'<line x1="{x + 10}" y1="{y + 92}" x2="{x + w - 10}" y2="{y + 92}" stroke="{PANEL_RIM}"/>')
    o.append(text(x + 12, y + 114, 'LV 5', 'label', TEXT))
    o.append(f'<rect x="{x + 56}" y="{y + 106}" width="130" height="6" rx="3" fill="{PANEL_RIM}"/>')
    o.append(f'<rect x="{x + 56}" y="{y + 106}" width="{130 * 0.62:.0f}" height="6" rx="3" fill="url(#dna-bar)"/>')
    o.append(text(x + 198, y + 114, 'DNA 62 %', 'label', TEXT, upper=False))
    o.append(f'<circle cx="{x + 16}" cy="{y + 134}" r="4" fill="none" stroke="{GAIN}" stroke-width="1.6"/>')
    o.append(text(x + 26, y + 138, f'eat < {PREY_BELOW}', 'label', TEXT, upper=False))
    o.append(f'<circle cx="{x + 136}" cy="{y + 134}" r="4" fill="none" stroke="{DANGER}" stroke-width="1.6" stroke-dasharray="2 2"/>')
    o.append(text(x + 146, y + 138, f'eats you > {THREAT_ABOVE}', 'label', TEXT, upper=False))
    return ''.join(o)


EFFECTS = [  # glyph, colour, label
    ('vent', ZONE_UI, 'DECAY ×1.5'),
    ('toxin', DANGER, '−9.4/S'),
    ('bloom', GOLD, 'DNA DROPS ×2'),
    ('mitochondrion', ORGANELLE_UI, '−15 % DECAY'),
    ('cytoskeleton', ACCENT, '+64 % ACCEL'),
]


def effects_row(tooltip_index=4):
    slot, pitch = 40, 118
    x0, y0 = MARGIN + 50, H - MARGIN - 64
    total = (len(EFFECTS) - 1) * pitch + slot + 100
    o = [chrome_backing(MARGIN, y0 - 10, total, 80, opacity=0.55)]
    for i, (kind, col, label) in enumerate(EFFECTS):
        sx = x0 + i * pitch
        hot = i == tooltip_index
        o.append(f'<rect x="{sx}" y="{y0}" width="{slot}" height="{slot}" rx="8" fill="#0b1a2c" stroke="{col}" '
                 f'stroke-opacity="{1 if hot else 0.7}" stroke-width="{2 if hot else 1}"/>')
        o.append(icon(kind, sx + slot / 2, y0 + slot / 2, col, 1.05))
        o.append(text(sx + slot / 2, y0 + slot + 20, label, 'label', TEXT, 'middle'))
    tx = x0 + tooltip_index * pitch + slot / 2
    tip = 'Cytoskeleton III · +64 % acceleration'
    tw = text_width(tip, 'body') + 24
    tip_x = max(min(tx - tw / 2, W - MARGIN - tw), MARGIN)
    o.append(panel(round(tip_x, 1), y0 - 50, round(tw, 1), 30, rx=6))
    o.append(text(round(tip_x + 12, 1), y0 - 30, tip, 'body', TEXT))
    return ''.join(o)


# --- option C: hold-Tab panel and coach ---------------------------------------------------
def tab_panel():
    x, y, w = MARGIN, MARGIN, 380
    rows = []

    def row(ry, left, right, marker):
        return marker + text(x + 34, ry, left, 'body', TEXT, upper=False) + text(x + w - 12, ry, right, 'figure', TEXT, 'end')

    def dot(ry, col):
        return f'<circle cx="{x + 20}" cy="{ry - 4}" r="4" fill="{col}"/>'

    def ring(ry, col, dashed=False):
        dash = ' stroke-dasharray="2 2"' if dashed else ''
        return f'<circle cx="{x + 20}" cy="{ry - 4}" r="5" fill="none" stroke="{col}" stroke-width="1.6"{dash}/>'

    def rule(ry):
        return f'<line x1="{x + 10}" y1="{ry}" x2="{x + w - 10}" y2="{ry}" stroke="{PANEL_RIM}"/>'

    def heading(ry, s):
        return text(x + 12, ry, s, 'caption', LABEL)

    ry = y + 22
    rows.append(heading(ry, 'MASS'))
    rows.append(text(x + 12, ry + 32, str(OWN_MASS), 'number', TEXT))
    rows.append(trend_down(x + 84, ry + 13, 11))
    rows.append(text(x + 104, ry + 30, '9/s', 'value', TEXT))
    rows.append(sparkline(x + 196, ry + 6, 170, 26, ACCENT))
    ry += 62
    for left, right, marker_col in (('Food', '+1.1/s', GAIN), ('Decay · mito −15 %', '−0.5/s', MUTED),
                                    ('Vent · decay ×1.5', '−0.25/s', ZONE_UI), ('Toxin · touching Nib', '−9.4/s', DANGER)):
        rows.append(row(ry, left, right, dot(ry, marker_col)))
        ry += 22
    rows.append(rule(ry - 8))
    ry += 12
    rows.append(heading(ry, 'HERE'))
    ry += 22
    rows.append(row(ry, 'Warm vent · orange rods', 'decay ×1.5', dot(ry, ZONE_UI)))
    ry += 22
    rows.append(row(ry, 'Bloom · 1:48', 'food ×1.5 · DNA drops ×2', dot(ry, GOLD)))
    ry += 14
    rows.append(rule(ry))
    ry += 20
    rows.append(heading(ry, 'SIZE'))
    ry += 22
    rows.append(row(ry, 'You eat', f'< {PREY_BELOW}', ring(ry, GAIN)))
    ry += 22
    rows.append(row(ry, 'Eats you', f'> {THREAT_ABOVE}', ring(ry, DANGER, dashed=True)))
    ry += 22
    rows.append(row(ry, 'Speed', '−50 %', f'<path d="M{x + 14},{ry - 4} h12 m-4,-4 l4,4 l-4,4" fill="none" stroke="{MUTED}" stroke-width="1.6"/>'))
    ry += 14
    rows.append(rule(ry))
    ry += 20
    rows.append(heading(ry, 'TRAITS'))
    ry += 22
    rows.append(row(ry, 'Mitochondrion I', '−15 % decay', icon('mitochondrion', x + 20, ry - 4, ORGANELLE_UI, 0.7)))
    ry += 22
    rows.append(row(ry, 'Cytoskeleton III', '+64 % accel', icon('cytoskeleton', x + 20, ry - 4, ACCENT, 0.7)))
    ry += 22
    rows.append(row(ry, 'World', 'ahead', ring(ry, MUTED)))
    h = ry + 14 - y
    return chrome_panel(x, y, w, h) + ''.join(rows)


def coach_pill(s):
    width = text_width(s, 'body') + 40
    y = H - MARGIN - 30
    return (chrome_backing(CX - width / 2, y, width, 30, rx=15, opacity=0.8)
            + f'<rect x="{CX - width / 2:.1f}" y="{y}" width="{width:.1f}" height="30" rx="15" fill="none" stroke="{ZONE_UI}" stroke-opacity="0.6"/>'
            + text(CX, y + 20, s, 'body', TEXT, 'middle'))


# --- frames ----------------------------------------------------------------------------------
def frame_a():
    return world('diegetic', 'z1') + leaderboard(tab_hint='HOLD TAB') + round_clock()


def frame_b():
    return world('strip', 'z0') + stats_strip() + effects_row() + leaderboard(tab_hint='HOLD TAB') + round_clock()


def frame_c():
    return (world('diegetic', 'z1') + tab_panel() + leaderboard(full=True, legend=True, tab_hint='TAB HELD')
            + coach_pill('The vent burns mass faster · eat or move on') + round_clock())


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    frames = {'legibility-a-diegetic': frame_a, 'legibility-b-strip': frame_b, 'legibility-c-coach-tab': frame_c}
    for name, build in frames.items():
        chrome_area_px[0] = 0.0
        (out / f'{name}.svg').write_text(kit.frame(build()), encoding='utf-8')
        print(f'wrote {out / name}.svg · DOM chrome {100 * chrome_area_px[0] / (W * H):.1f} % of the viewport')
    (out / 'legibility-camera-lever.svg').write_text(camera_strip(), encoding='utf-8')
    print('wrote', out / 'legibility-camera-lever.svg')
    for camera in ('z0', 'z1'):
        print(f'{camera}: own cell {radius_wu(OWN_MASS) * zoom_for(camera):.1f} px; exclusion box ±{HUD_PLAYER_EXCLUSION_PX} px')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

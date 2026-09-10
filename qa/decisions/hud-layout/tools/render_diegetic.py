#!/usr/bin/env python3
"""Option C (diegetic HUD) with the reading floor solved: own-cell indicators with screen-px floors.

Frames (1280x800, the decision frames' backdrop, seeded):
  own-cell-32px   own cell 32 px (1080p spawn size), respawned prokaryote L4 so the counters show at the small size
  own-cell-102px  own cell 102 px (mass cap), eukaryote L9, mitochondrion owned, sprint cooling
  own-cell-sizes  1:1 crops of the own cell at 24 / 32 / 45 / 102 px plus the being-engulfed state at 33 px

Geometry follows docs/UI.md section 3.1 (#146): every number below is a named constant there.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render as base  # noqa: E402  (the decision-frame primitives)

W, H, CX, CY = base.W, base.H, base.CX, base.CY

# --- UI.md section 3.1 constants (screen px unless stated) --------------------------
DNA_RING_RADIUS_FRACTION = 0.44  # of r_px: hugs the nucleus sprite's glow (0.40 r); organelle slots keep out below 0.56 r
DNA_RING_MIN_RADIUS_PX = 17  # floor: a 20 px mono two-digit level fits inside
DNA_RING_STROKE_PX = 4  # never scales; the chrome bars' width
DNA_RING_TRACK_ALPHA = 0.18
LEVEL_NUMERAL_OUTLINE_PX = 2
SELF_RING_RADIUS_FRACTION, SELF_RING_MIN_PX = 1.12, 7.5  # VISUAL-STYLE section 2
LADDER_ORBIT_GAP_PX = 8  # beyond the self ring
LADDER_GHOST_PX = 14  # long axis of a ghost organelle
LADDER_PIP_PX = 4  # pip diameter
LADDER_PIP_GAP_PX = 3
LADDER_ITEM_GAP_PX = 4  # ghost -> first pip
LADDER_ORBIT_ANGLE_SINGLE_DEG = 180  # clockwise from 12 o'clock
LADDER_ORBIT_ANGLES_PAIR_DEG = (225, 135)  # aerobic lower-left, photosynthetic lower-right
LADDER_BACKING_PX = 20  # width of the callout arc under an orbit item
ESCAPE_ARC_STROKE_PX = 4
THREAT_LABEL_GAP_PX = 6
ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX = 1.3, 24
REQUIRED = 5  # ENDOSYMBIOSIS_BACTERIA_REQUIRED

GHOST_COLOUR = {'mitochondrion': base.MITO_BASE, 'chloroplast': base.CHLORO_LIGHT}


def polar(radius, deg_clockwise_from_top):
    a = math.radians(deg_clockwise_from_top - 90)
    return radius * math.cos(a), radius * math.sin(a)


def dna_ring_radius_px(r_px):
    return max(DNA_RING_RADIUS_FRACTION * r_px, DNA_RING_MIN_RADIUS_PX)


def self_ring_radius_px(r_px):
    return max(SELF_RING_RADIUS_FRACTION * r_px, SELF_RING_MIN_PX)


def ladder_orbit_radius_px(r_px):
    return self_ring_radius_px(r_px) + LADDER_ORBIT_GAP_PX


def dna_ring(r_px, frac, level, rim, at_max=False):
    rr = dna_ring_radius_px(r_px)
    col = base.GOLD if at_max else base.DNA
    o = [f'<circle r="{rr:.1f}" fill="none" stroke="{rim}" stroke-width="{DNA_RING_STROKE_PX}" opacity="{DNA_RING_TRACK_ALPHA}"/>']
    if at_max:
        o.append(f'<circle r="{rr:.1f}" fill="none" stroke="{col}" stroke-width="{DNA_RING_STROKE_PX}" filter="url(#glow-soft)"/>')
    elif frac > 0.005:
        o.append(f'<path d="{base.arc(0, 0, rr, frac)}" fill="none" stroke="{col}" stroke-width="{DNA_RING_STROKE_PX}" '
                 'stroke-linecap="round" filter="url(#glow-soft)"/>')
    # level numeral: `value` role (20 px mono), WHITE, 2 px CALLOUT outline so it reads over a nucleus
    px = base.ROLES['value'][0]
    o.append(f'<text x="0" y="{px * 0.36:.1f}" font-family="{base.MONO}" font-size="{px}" fill="{base.WHITE}" text-anchor="middle" '
             f'stroke="{base.CALLOUT}" stroke-width="{LEVEL_NUMERAL_OUTLINE_PX * 2}" stroke-opacity="0.7" paint-order="stroke" '
             f'stroke-linejoin="round">{level}</text>')
    return ''.join(o)


def self_ring(r_px, sprint_fill=1.0, ready_flash=False):
    """The own cell's identity ring doubles as the sprint meter: full when ready, an arc while cooling."""
    rr = self_ring_radius_px(r_px)
    common = f'fill="none" stroke="{base.WHITE}" stroke-width="{2.5 if ready_flash else 1.5}" stroke-dasharray="6 4" opacity="{0.95 if ready_flash else 0.7}"'
    if sprint_fill >= 1.0:
        return f'<circle r="{rr:.1f}" {common}/>'
    return f'<path d="{base.arc(0, 0, rr, sprint_fill)}" {common}/>'


def ghost(kind, cx, cy, tangent_deg, colour):
    """Dashed silhouette of the organelle the rung will draw, LADDER_GHOST_PX long, tangent to the orbit."""
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({tangent_deg:.1f})">']
    half, short = LADDER_GHOST_PX / 2, LADDER_GHOST_PX / 4
    if kind in ('mitochondrion', 'chloroplast'):
        g.append(f'<ellipse rx="{half}" ry="{short}" fill="{colour}" fill-opacity="0.12" stroke="{colour}" stroke-width="1.2" stroke-dasharray="2.5 2" opacity="0.85"/>')
        if kind == 'mitochondrion':
            for i in (-3, 0, 3):
                g.append(f'<path d="M{i - 1},-2 q1.5,2 0,4" fill="none" stroke="{colour}" stroke-width="1" opacity="0.7"/>')
        else:
            for i in (-4, 0, 4):
                g.append(f'<circle cx="{i}" cy="0" r="1" fill="{colour}" opacity="0.8"/>')
    elif kind == 'nucleoid':
        g.append(f'<ellipse rx="{half}" ry="{half * 0.72:.1f}" fill="none" stroke="{colour}" stroke-width="1.2" stroke-dasharray="2.5 2" opacity="0.85"/>')
        g.append(f'<path d="M{-half * 0.7:.1f},1 q{half * 0.5:.1f},-6 {half * 1.3:.1f},-1" fill="none" stroke="{colour}" stroke-width="1" opacity="0.6"/>')
    elif kind == 'nuclear_envelope':
        g.append(f'<circle r="{half}" fill="none" stroke="{colour}" stroke-width="1.2" stroke-dasharray="2.5 2" opacity="0.85"/>')
        for a in range(0, 360, 60):
            x, y = half * math.cos(math.radians(a)), half * math.sin(math.radians(a))
            g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1" fill="{colour}" opacity="0.8"/>')
    else:  # a specialised form: the slipper outline
        g.append(f'<ellipse rx="{half}" ry="{short * 1.3:.1f}" fill="none" stroke="{colour}" stroke-width="1.2" stroke-dasharray="2.5 2" opacity="0.85"/>')
    g.append('</g>')
    return ''.join(g)


def orbit_backing(radius, start_deg, length_px):
    span_deg = math.degrees(length_px / radius)
    a0, a1 = start_deg - 6, start_deg + span_deg + 6
    x0, y0 = polar(radius, a0)
    x1, y1 = polar(radius, a1)
    large = 1 if a1 - a0 > 180 else 0
    return (f'<path d="M{x0:.1f},{y0:.1f} A{radius:.1f},{radius:.1f} 0 {large} 1 {x1:.1f},{y1:.1f}" fill="none" '
            f'stroke="{base.CALLOUT}" stroke-width="{LADDER_BACKING_PX}" stroke-linecap="round" opacity="0.45"/>')


def orbit_counter(r_px, centre_deg, kind, eaten, required=REQUIRED):
    """Ghost + `required` pips laid along the ladder orbit, centred on centre_deg."""
    radius = ladder_orbit_radius_px(r_px)
    colour = GHOST_COLOUR[kind]
    total = LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + required * LADDER_PIP_PX + (required - 1) * LADDER_PIP_GAP_PX
    start_deg = centre_deg - math.degrees((total / 2) / radius)
    o = [orbit_backing(radius, start_deg, total)]
    cursor = start_deg + math.degrees((LADDER_GHOST_PX / 2) / radius)
    gx, gy = polar(radius, cursor)
    o.append(ghost(kind, gx, gy, cursor, colour))
    cursor += math.degrees((LADDER_GHOST_PX / 2 + LADDER_ITEM_GAP_PX + LADDER_PIP_PX / 2) / radius)
    for i in range(required):
        px, py = polar(radius, cursor)
        lit = i < eaten
        o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{LADDER_PIP_PX / 2}" fill="{colour if lit else "none"}" '
                 f'stroke="{colour}" stroke-width="1" opacity="{0.95 if lit else 0.7}"/>')
        cursor += math.degrees((LADDER_PIP_PX + LADDER_PIP_GAP_PX) / radius)
    if eaten >= required:  # unlocked: the ghost fills solid gold until the offer arrives
        o.append(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{LADDER_GHOST_PX / 2 + 2}" fill="none" stroke="{base.GOLD}" stroke-width="1.5" opacity="0.9"/>')
    return ''.join(o)


def orbit_ghost(r_px, centre_deg, kind, colour):
    radius = ladder_orbit_radius_px(r_px)
    o = [orbit_backing(radius, centre_deg - math.degrees((LADDER_GHOST_PX / 2) / radius), LADDER_GHOST_PX)]
    gx, gy = polar(radius, centre_deg)
    o.append(ghost(kind, gx, gy, centre_deg, colour))
    return ''.join(o)


def escape_arc(r_px, engulf_progress):
    radius = ladder_orbit_radius_px(r_px)
    o = [f'<circle r="{radius:.1f}" fill="none" stroke="{base.DANGER}" stroke-width="{ESCAPE_ARC_STROKE_PX}" opacity="0.2"/>',
         f'<path d="{base.arc(0, 0, radius, 1 - engulf_progress)}" fill="none" stroke="{base.DANGER}" stroke-width="{ESCAPE_ARC_STROKE_PX}" '
         'stroke-linecap="round" filter="url(#glow-soft)"/>']
    s = 'SPRINT TO ESCAPE'
    w = base.text_width(s, 'label') + 16
    y = -radius - THREAT_LABEL_GAP_PX - 18
    o.append(f'<rect x="{-w / 2:.0f}" y="{y}" width="{w:.0f}" height="18" rx="9" fill="{base.CALLOUT}" opacity="0.75"/>')
    o.append(base.text(0, y + 13, s, 'label', base.DANGER, 'middle'))
    return ''.join(o)


def own_indicators(r_px, level, frac, stage, counters=(), sprint_fill=1.0, engulf=None, at_max=False, rim=None):
    """Everything drawn on the own cell, in the cell frame (translate to the cell centre first)."""
    rim = rim or base.PAL['cyan'][1]
    o = [dna_ring(r_px, frac, level, rim, at_max), self_ring(r_px, sprint_fill)]
    if engulf is not None:
        o.append(escape_arc(r_px, engulf))
        return ''.join(o)
    if stage == 'prokaryote':
        for (kind, eaten), angle in zip(counters, LADDER_ORBIT_ANGLES_PAIR_DEG):
            if eaten is not None:  # an owned endosymbiont's counter is hidden
                o.append(orbit_counter(r_px, angle, kind, eaten))
    elif stage == 'protocell':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'nucleoid', rim))
    elif stage == 'endosymbiosis':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'nuclear_envelope', rim))
    elif stage == 'eukaryote':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'form', rim))
    return ''.join(o)


def threat_label(x, y, r, name='AMOEBOID', own=(CX, CY)):
    """World-anchored on the warning ring, on the side facing the own cell: never off-screen, never in a corner panel."""
    ring = max(r * ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX)
    s = f'{name} CAN ENGULF YOU'
    w, h = base.text_width(s, 'label') + 16, 18
    dx, dy = own[0] - x, own[1] - y
    d = math.hypot(dx, dy) or 1.0
    cx, cy = x + dx / d * (ring + THREAT_LABEL_GAP_PX + h / 2), y + dy / d * (ring + THREAT_LABEL_GAP_PX + h / 2)
    return (f'<rect x="{cx - w / 2:.0f}" y="{cy - h / 2:.0f}" width="{w:.0f}" height="{h}" rx="9" fill="{base.CALLOUT}" opacity="0.75"/>'
            + base.text(cx, cy + 4.5, s, 'label', base.DANGER, 'middle'))


# --- scenes ------------------------------------------------------------------------
def motes_small(rng, cells, scale):
    """The decision frame's motes, radii scaled for a zoomed-out view (floor 2 px)."""
    o = []
    placed = 0
    while placed < 48:
        x, y = rng.uniform(20, W - 20), rng.uniform(20, H - 20)
        if base.near_cells(x, y, cells):
            continue
        r = max(2.0, rng.uniform(3, 5) * scale)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 3:.1f}" fill="url(#halo-algal)"/>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="url(#mote-algal)"/>')
        placed += 1
    return ''.join(o)


def scene(rng, own_r, own_stage, own_inside, own_after, other_scale=1.0, heading=base.PLAYER_HEADING, threat=True):
    others = [(x, y, max(8, r * other_scale), pal, st, hd) for x, y, r, pal, st, hd in base.OTHERS]
    cells = [(x, y, r) for x, y, r, *_ in others] + [(CX, CY, own_r)]
    o = [base.field(rng)]
    o.append(base.motes(rng, cells) if other_scale == 1.0 else motes_small(rng, cells, other_scale))
    if other_scale == 1.0:
        o.append(base.bacteria(rng))
    for x, y, r, pal, st, hd in others:
        if st == 'prokaryote' and r >= 20:
            o.append(base.flagellum(x, y, r, hd))
        o.append(base.cell(x, y, r, pal, st, rng, heading=hd, speed=0.3))
    if threat:
        ax, ay, ar = others[0][:3]
        ring = max(ar * ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX)
        o.append(f'<circle cx="{ax}" cy="{ay}" r="{ring:.0f}" fill="none" stroke="{base.DANGER}" stroke-width="2" stroke-dasharray="6 5" opacity="0.85" filter="url(#glow-soft)"/>')
        o.append(threat_label(ax, ay, ar))
    if own_stage == 'prokaryote':
        o.append(base.flagellum(CX, CY, own_r, heading))
    o.append(base.cell(CX, CY, own_r, 'cyan', own_stage, rng, heading=heading, speed=0.55, extra_inside=own_inside, self_ring=False, extra_after=own_after))
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    return ''.join(o)


def chrome():
    return base.leaderboard() + base.round_clock(with_hints=False, sprint=False)


def frame_32():
    rng = random.Random(42)
    ind = own_indicators(32, 4, 0.62, 'prokaryote', counters=(('mitochondrion', 2), ('chloroplast', 0)))
    return scene(rng, 32, 'prokaryote', '', ind) + chrome()


def frame_102():
    rng = random.Random(42)
    ind = own_indicators(102, 9, 0.40, 'prokaryote', counters=(('mitochondrion', None), ('chloroplast', 3)), sprint_fill=0.55)
    return scene(rng, 102, 'euk', '', ind, other_scale=0.4, threat=False) + chrome()  # nothing on screen can engulf a cell at the cap


def sizes_sheet():
    """1:1 tiles: the own cell at 24 (reference-viewport spawn), 32 (1080p spawn), 45 (most of a round), 102 (cap)
    and the being-engulfed state at 33 px (reference-viewport steady state)."""
    tiles = [
        (24, 'prokaryote', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0))), '24 px · respawned L4 · 1280×800 spawn'),
        (32, 'prokaryote', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0))), '32 px · respawned L4 · 1080p spawn'),
        (45, 'prokaryote', dict(level=5, frac=0.15, counters=(('mitochondrion', 5), ('chloroplast', 1))), '45 px · L5, aerobic 5/5 unlocked'),
        (102, 'euk', dict(level=12, frac=1.0, at_max=True, counters=(('mitochondrion', None), ('chloroplast', 3)), sprint_fill=0.55), '102 px · L12 max · sprint cooling'),
        (33, 'prokaryote', dict(level=4, frac=0.62, engulf=0.35), '33 px · being engulfed 35 %'),
    ]
    tile_w, tile_h, pad = 300, 320, 6
    sheet_w = len(tiles) * (tile_w + pad) + pad
    o = [f'<rect width="{sheet_w}" height="{tile_h + 2 * pad}" fill="#04070d"/>']
    for i, (r, stage, kw, caption) in enumerate(tiles):
        tx = pad + i * (tile_w + pad)
        cx, cy = tx + tile_w / 2, pad + 150
        rng = random.Random(7 + i)
        o.append(f'<rect x="{tx}" y="{pad}" width="{tile_w}" height="{tile_h}" rx="8" fill="url(#bg-field)" stroke="{base.PANEL_RIM}"/>')
        o.append(f'<g clip-path="inset(0)">')
        ind_stage = 'prokaryote' if stage == 'euk' else stage
        ind = own_indicators(r, kw.get('level'), kw.get('frac'), ind_stage, counters=kw.get('counters', ()),
                             sprint_fill=kw.get('sprint_fill', 1.0), engulf=kw.get('engulf'), at_max=kw.get('at_max', False))
        if stage == 'prokaryote':
            o.append(base.flagellum(cx, cy, r, base.PLAYER_HEADING))
        o.append(base.cell(cx, cy, r, 'cyan', stage, rng, heading=base.PLAYER_HEADING, speed=0.55, self_ring=False, extra_after=ind))
        o.append('</g>')
        o.append(base.text(cx, pad + tile_h - 14, caption, 'caption', base.LABEL, 'middle', upper=False))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{sheet_w}" height="{tile_h + 2 * pad}" viewBox="0 0 {sheet_w} {tile_h + 2 * pad}">{base.defs()}{"".join(o)}</svg>'


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    frames = {
        'own-cell-32px': lambda: base.frame(frame_32()),
        'own-cell-102px': lambda: base.frame(frame_102()),
        'own-cell-sizes': sizes_sheet,
    }
    for name, build in frames.items():
        (out / f'{name}.svg').write_text(build(), encoding='utf-8')
        print('wrote', out / f'{name}.svg')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

#!/usr/bin/env python3
"""Option C (diegetic HUD) with the reading floor solved: own-cell indicators with screen-px floors.

Frames (1280x800, the decision frames' backdrop, seeded):
  own-cell-32px   own cell 32 px (1080p spawn size), respawned prokaryote L4 so the counters show at the small size
  own-cell-102px  own cell 102 px (mass cap), eukaryote L9 (form ghost on the orbit), sprint cooling
  own-cell-sizes  1:1 crops of the own cell at 24 (cyan, then Mint with a 4-bead seat mark) / 32 / 45 / 102 px,
                  the escape arc in the cover phase and after the seal at 33 px, and the threat label's far-side rule

Geometry follows docs/UI.md section 3.1 (#146): every number below is a named constant in its section 9 table
(home `render/constants.ts`), VISUAL-STYLE section 2's (self ring, seat mark) or marked mock-only.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render as base  # noqa: E402  (the decision-frame primitives)

W, H, CX, CY = base.W, base.H, base.CX, base.CY

# --- UI.md section 9 constants (screen px unless stated) ------------------------------
DNA_RING_RADIUS_FRACTION = 0.44  # of r_px: hugs the nucleus sprite's glow (0.40 r)
DNA_RING_MIN_RADIUS_PX = 17  # floor: a two-digit `value` numeral fits inside
DNA_RING_STROKE_PX = 4  # never scales; the chrome bars' width
DNA_RING_TRACK_PAD_PX = 1  # the track is stroke + 2 x pad wide: it is also the ring's backing
DNA_RING_TRACK_ALPHA = 0.35  # CALLOUT on the body (dark on every palette; measured >= 1.5:1 against Mint)
DNA_RING_KEEP_OUT_FRACTION = 0.66  # organelle slot centres start here (cell frame; >= the floored ring edge from 31 px up)
DNA_RING_KEEP_OUT_PAD_PX = 1
LEVEL_NUMERAL_OUTLINE_PX = 2
LEVEL_NUMERAL_OUTLINE_ALPHA = 0.70
SELF_RING_RADIUS_FRACTION, SELF_RING_MIN_PX, SELF_RING_ALPHA = 1.12, 7.5, 0.70  # VISUAL-STYLE section 2
SELF_RING_TRACK_ALPHA = 0.18  # the un-recharged remainder of the ring: the identity tell never vanishes
SEAT_MARK_BEAD_RADIUS_FRACTION, SEAT_MARK_BEAD_MIN_PX, SEAT_MARK_HALO_RADII = 0.05, 2, 2.2  # VISUAL-STYLE section 2
LADDER_ORBIT_GAP_PX = 12  # beyond the self ring; clears the seat-mark halo at every r >= 12 px (UI.md section 3.1.3)
LADDER_SEAT_MARK_CLEARANCE_PX = 1  # backing inner edge to halo outer edge, the pinned inequality
LADDER_GHOST_PX = 14  # long axis of a ghost organelle
LADDER_PIP_PX = 4  # pip diameter
LADDER_PIP_GAP_PX = 3  # between pips and between rows
LADDER_PIP_ROW_MAX = 5  # pips per row; ENDOSYMBIOSIS_BACTERIA_REQUIRED 10 = two rows of five
LADDER_PIP_STROKE_PX = 1
LADDER_PIP_LIT_ALPHA, LADDER_PIP_UNLIT_ALPHA = 0.95, 0.70  # the countable / unlit tell
LADDER_ITEM_GAP_PX = 4  # ghost -> pip block
LADDER_BACKING_PX = 16  # width of the callout arc under an orbit item (ghost 14 across, pip block 11 across)
LADDER_BACKING_END_PAD_PX = 4  # beyond the first and last item, in px (the angle comes from the radius)
LADDER_BACKING_ALPHA = 0.45
LADDER_UNLOCK_RING_PAD_PX = 2  # level-gold ring around the ghost once the counter is full
LADDER_UNLOCK_RING_STROKE_PX = 1.5
LADDER_ORBIT_ANGLE_SINGLE_DEG = 180  # clockwise from 12 o'clock
LADDER_ORBIT_ANGLES_PAIR_DEG = (225, 135)  # aerobic lower-left, photosynthetic lower-right
ESCAPE_ARC_STROKE_PX = 4
ESCAPE_ARC_TRACK_ALPHA = 0.20  # DANGER track under the draining arc; solid once sealed
THREAT_LABEL_GAP_PX = 6
LABEL_PILL_HEIGHT_PX = 18  # the renderer's label pill (threat and escape labels)
LABEL_PILL_PAD_PX = 8
LABEL_PILL_ALPHA = 0.75
DANGER_LABEL_RIM_PX = 1  # DANGER rim on a CALLOUT pill; the text is WHITE (>= 7:1, UI.md section 6)
ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX = 1.3, 24
ENGULF_SEAL_PROGRESS = 0.5  # ECOLOGY section 6.1 (#151): movement helps only before the seal
REQUIRED = 10  # balance.ladder.ENDOSYMBIOSIS_BACTERIA_REQUIRED
# mock-only (the renderer's ghost is an atlas entry; these are how this SVG draws a dashed silhouette)
GHOST_DASH, GHOST_STROKE_PX, GHOST_FILL_ALPHA = '2.5 2', 1.2, 0.12

MINT = ('#24db98', '#b2ffe3', '#71f4c4', 3)  # VISUAL-STYLE section 2 slot 5, the brightest body, as seat index 3 (4 beads)
base.PAL['mint'] = MINT

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


def seat_mark_halo_px(r_px):
    return SEAT_MARK_HALO_RADII * max(SEAT_MARK_BEAD_RADIUS_FRACTION * r_px, SEAT_MARK_BEAD_MIN_PX)


def ladder_orbit_extent_px(r_px):
    return ladder_orbit_radius_px(r_px) + LADDER_BACKING_PX / 2


def dna_keep_out_px(r_px):
    return DNA_RING_KEEP_OUT_FRACTION * r_px


def counter_length_px(required=REQUIRED):
    rows = math.ceil(required / LADDER_PIP_ROW_MAX)
    per_row = min(required, LADDER_PIP_ROW_MAX)
    block_w = per_row * LADDER_PIP_PX + (per_row - 1) * LADDER_PIP_GAP_PX
    block_h = rows * LADDER_PIP_PX + (rows - 1) * LADDER_PIP_GAP_PX
    return LADDER_GHOST_PX + LADDER_ITEM_GAP_PX + block_w, block_w, block_h


def geometry_row(r_px):
    """The numbers UI.md section 3.1.3's table pins (all px / deg)."""
    orbit = ladder_orbit_radius_px(r_px)
    total, _, _ = counter_length_px()
    span = math.degrees(total / orbit)
    backing_span = span + 2 * math.degrees(LADDER_BACKING_END_PAD_PX / orbit)
    between = (LADDER_ORBIT_ANGLES_PAIR_DEG[0] - LADDER_ORBIT_ANGLES_PAIR_DEG[1]) - backing_span
    inner_edge = orbit - LADDER_BACKING_PX / 2
    halo_edge = r_px + seat_mark_halo_px(r_px)
    return dict(dna=dna_ring_radius_px(r_px), keep_out=dna_keep_out_px(r_px), ring_edge=dna_ring_radius_px(r_px) + DNA_RING_STROKE_PX / 2 + DNA_RING_KEEP_OUT_PAD_PX,
                self_ring=self_ring_radius_px(r_px), orbit=orbit, span=span, between=between,
                extent=ladder_orbit_extent_px(r_px), seat_gap=inner_edge - halo_edge)


def dna_ring(r_px, frac, level, rim, at_max=False):
    rr = dna_ring_radius_px(r_px)
    col = base.GOLD if at_max else base.DNA
    # the track is CALLOUT, stroke + 2 x pad wide: it shows where 100 % is and backs the fill over whatever is under it
    o = [f'<circle r="{rr:.1f}" fill="none" stroke="{base.CALLOUT}" stroke-width="{DNA_RING_STROKE_PX + 2 * DNA_RING_TRACK_PAD_PX}" opacity="{DNA_RING_TRACK_ALPHA}"/>']
    if at_max:
        o.append(f'<circle r="{rr:.1f}" fill="none" stroke="{col}" stroke-width="{DNA_RING_STROKE_PX}" filter="url(#glow-soft)"/>')
    elif frac > 0.005:
        o.append(f'<path d="{base.arc(0, 0, rr, frac)}" fill="none" stroke="{col}" stroke-width="{DNA_RING_STROKE_PX}" '
                 'stroke-linecap="round" filter="url(#glow-soft)"/>')
    # level numeral: `value` role, WHITE, a CALLOUT outline so it reads over a nucleus
    px = base.ROLES['value'][0]
    o.append(f'<text x="0" y="{px * 0.36:.1f}" font-family="{base.MONO}" font-size="{px}" fill="{base.WHITE}" text-anchor="middle" '
             f'stroke="{base.CALLOUT}" stroke-width="{LEVEL_NUMERAL_OUTLINE_PX * 2}" stroke-opacity="{LEVEL_NUMERAL_OUTLINE_ALPHA}" paint-order="stroke" '
             f'stroke-linejoin="round">{level}</text>')
    return ''.join(o)


def self_ring(r_px, sprint_fill=1.0):
    """The own cell's identity ring doubles as the sprint meter: the recharged part at SELF_RING_ALPHA, the rest as a
    track at SELF_RING_TRACK_ALPHA, so the dashed circle (the non-colour identity tell) is present at every fill."""
    rr = self_ring_radius_px(r_px)
    common = f'fill="none" stroke="{base.WHITE}" stroke-width="1.5" stroke-dasharray="6 4"'
    o = [f'<circle r="{rr:.1f}" {common} opacity="{SELF_RING_TRACK_ALPHA}"/>']
    if sprint_fill >= 1.0:
        o.append(f'<circle r="{rr:.1f}" {common} opacity="{SELF_RING_ALPHA}"/>')
    elif sprint_fill > 0.005:
        o.append(f'<path d="{base.arc(0, 0, rr, sprint_fill)}" {common} opacity="{SELF_RING_ALPHA}"/>')
    return ''.join(o)


def ghost(kind, cx, cy, tangent_deg, colour):
    """Dashed silhouette of the organelle the rung will draw, LADDER_GHOST_PX long, tangent to the orbit."""
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({tangent_deg:.1f})">']
    half, short = LADDER_GHOST_PX / 2, LADDER_GHOST_PX / 4
    if kind in ('mitochondrion', 'chloroplast'):
        g.append(f'<ellipse rx="{half}" ry="{short}" fill="{colour}" fill-opacity="{GHOST_FILL_ALPHA}" stroke="{colour}" stroke-width="{GHOST_STROKE_PX}" stroke-dasharray="{GHOST_DASH}" opacity="0.85"/>')
        if kind == 'mitochondrion':
            for i in (-3, 0, 3):
                g.append(f'<path d="M{i - 1},-2 q1.5,2 0,4" fill="none" stroke="{colour}" stroke-width="1" opacity="0.7"/>')
        else:
            for i in (-4, 0, 4):
                g.append(f'<circle cx="{i}" cy="0" r="1" fill="{colour}" opacity="0.8"/>')
    elif kind == 'nucleoid':
        g.append(f'<ellipse rx="{half}" ry="{half * 0.72:.1f}" fill="none" stroke="{colour}" stroke-width="{GHOST_STROKE_PX}" stroke-dasharray="{GHOST_DASH}" opacity="0.85"/>')
        g.append(f'<path d="M{-half * 0.7:.1f},1 q{half * 0.5:.1f},-6 {half * 1.3:.1f},-1" fill="none" stroke="{colour}" stroke-width="1" opacity="0.6"/>')
    elif kind == 'nuclear_envelope':
        g.append(f'<circle r="{half}" fill="none" stroke="{colour}" stroke-width="{GHOST_STROKE_PX}" stroke-dasharray="{GHOST_DASH}" opacity="0.85"/>')
        for a in range(0, 360, 60):
            x, y = half * math.cos(math.radians(a)), half * math.sin(math.radians(a))
            g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1" fill="{colour}" opacity="0.8"/>')
    else:  # a specialised form: the slipper outline
        g.append(f'<ellipse rx="{half}" ry="{short * 1.3:.1f}" fill="none" stroke="{colour}" stroke-width="{GHOST_STROKE_PX}" stroke-dasharray="{GHOST_DASH}" opacity="0.85"/>')
    g.append('</g>')
    return ''.join(g)


def orbit_backing(radius, start_deg, length_px):
    span_deg = math.degrees(length_px / radius)
    pad_deg = math.degrees(LADDER_BACKING_END_PAD_PX / radius)
    a0, a1 = start_deg - pad_deg, start_deg + span_deg + pad_deg
    x0, y0 = polar(radius, a0)
    x1, y1 = polar(radius, a1)
    large = 1 if a1 - a0 > 180 else 0
    return (f'<path d="M{x0:.1f},{y0:.1f} A{radius:.1f},{radius:.1f} 0 {large} 1 {x1:.1f},{y1:.1f}" fill="none" '
            f'stroke="{base.CALLOUT}" stroke-width="{LADDER_BACKING_PX}" stroke-linecap="round" opacity="{LADDER_BACKING_ALPHA}"/>')


def pip_block(cx, cy, tangent_deg, colour, eaten, required=REQUIRED):
    """One sprite in the renderer (an atlas entry per variant x eaten): `required` pips in rows of LADDER_PIP_ROW_MAX,
    straight along the tangent, the row nearest the cell first, lit clockwise."""
    _, block_w, block_h = counter_length_px(required)
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({tangent_deg:.1f})">']
    per_row = min(required, LADDER_PIP_ROW_MAX)
    for i in range(required):
        row, col = divmod(i, per_row)
        x = -block_w / 2 + LADDER_PIP_PX / 2 + col * (LADDER_PIP_PX + LADDER_PIP_GAP_PX)
        y = -block_h / 2 + LADDER_PIP_PX / 2 + row * (LADDER_PIP_PX + LADDER_PIP_GAP_PX)
        lit = i < eaten
        g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{LADDER_PIP_PX / 2}" fill="{colour if lit else "none"}" '
                 f'stroke="{colour}" stroke-width="{LADDER_PIP_STROKE_PX}" opacity="{LADDER_PIP_LIT_ALPHA if lit else LADDER_PIP_UNLIT_ALPHA}"/>')
    g.append('</g>')
    return ''.join(g)


def orbit_counter(r_px, centre_deg, kind, eaten, required=REQUIRED):
    """Ghost + the pip block laid along the ladder orbit, centred on centre_deg."""
    radius = ladder_orbit_radius_px(r_px)
    colour = GHOST_COLOUR[kind]
    total, block_w, _ = counter_length_px(required)
    start_deg = centre_deg - math.degrees((total / 2) / radius)
    o = [orbit_backing(radius, start_deg, total)]
    cursor = start_deg + math.degrees((LADDER_GHOST_PX / 2) / radius)
    gx, gy = polar(radius, cursor)
    o.append(ghost(kind, gx, gy, cursor, colour))
    cursor += math.degrees((LADDER_GHOST_PX / 2 + LADDER_ITEM_GAP_PX + block_w / 2) / radius)
    px, py = polar(radius, cursor)
    o.append(pip_block(px, py, cursor, colour, eaten, required))
    if eaten >= required:  # unlocked: a level-gold ring around the ghost until the offer arrives
        o.append(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{LADDER_GHOST_PX / 2 + LADDER_UNLOCK_RING_PAD_PX}" fill="none" '
                 f'stroke="{base.GOLD}" stroke-width="{LADDER_UNLOCK_RING_STROKE_PX}" opacity="0.9"/>')
    return ''.join(o)


def orbit_ghost(r_px, centre_deg, kind, colour):
    radius = ladder_orbit_radius_px(r_px)
    o = [orbit_backing(radius, centre_deg - math.degrees((LADDER_GHOST_PX / 2) / radius), LADDER_GHOST_PX)]
    gx, gy = polar(radius, centre_deg)
    o.append(ghost(kind, gx, gy, centre_deg, colour))
    return ''.join(o)


def label_pill(cx, cy, s):
    """The renderer's label pill: WHITE `label` text on CALLOUT with a DANGER rim (colour + text, never colour only)."""
    w, h = base.text_width(s, 'label') + 2 * LABEL_PILL_PAD_PX, LABEL_PILL_HEIGHT_PX
    return (f'<rect x="{cx - w / 2:.0f}" y="{cy - h / 2:.0f}" width="{w:.0f}" height="{h}" rx="{h / 2}" fill="{base.CALLOUT}" '
            f'fill-opacity="{LABEL_PILL_ALPHA}" stroke="{base.DANGER}" stroke-width="{DANGER_LABEL_RIM_PX}"/>'
            + base.text(cx, cy + 4.5, s, 'label', base.WHITE, 'middle'))


def escape_arc(r_px, engulf_progress, sealed=False):
    """Replaces the orbit while being_engulfed. Before the seal the arc is the escape window draining to empty at
    ENGULF_SEAL_PROGRESS; from the seal on the ring is solid and the label says so (ECOLOGY section 6.1)."""
    radius = ladder_orbit_radius_px(r_px)
    if sealed:
        o = [f'<circle r="{radius:.1f}" fill="none" stroke="{base.DANGER}" stroke-width="{ESCAPE_ARC_STROKE_PX}"/>']
        label = 'SEALED'
    else:
        fill = max(0.0, 1 - engulf_progress / ENGULF_SEAL_PROGRESS)
        o = [f'<circle r="{radius:.1f}" fill="none" stroke="{base.DANGER}" stroke-width="{ESCAPE_ARC_STROKE_PX}" opacity="{ESCAPE_ARC_TRACK_ALPHA}"/>',
             f'<path d="{base.arc(0, 0, radius, fill)}" fill="none" stroke="{base.DANGER}" stroke-width="{ESCAPE_ARC_STROKE_PX}" '
             'stroke-linecap="round" filter="url(#glow-soft)"/>']
        label = 'SPRINT TO ESCAPE'
    o.append(label_pill(0, -radius - THREAT_LABEL_GAP_PX - LABEL_PILL_HEIGHT_PX / 2, label))
    return ''.join(o)


def own_indicators(r_px, level, frac, stage, counters=(), sprint_fill=1.0, engulf=None, at_max=False, rim=None, sealed=False):
    """Everything drawn on the own cell, in the cell frame (translate to the cell centre first)."""
    rim = rim or base.PAL['cyan'][1]
    o = [dna_ring(r_px, frac, level, rim, at_max), self_ring(r_px, sprint_fill)]
    if engulf is not None:
        o.append(escape_arc(r_px, engulf, sealed))
        return ''.join(o)
    if stage == 'prokaryote':
        for (kind, eaten), angle in zip(counters, LADDER_ORBIT_ANGLES_PAIR_DEG):
            if eaten is not None:  # None = the endosymbiont is owned, so its counter is hidden; the other keeps its angle
                o.append(orbit_counter(r_px, angle, kind, eaten))
    elif stage == 'protocell':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'nucleoid', rim))
    elif stage == 'endosymbiosis':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'nuclear_envelope', rim))
    elif stage == 'eukaryote':
        o.append(orbit_ghost(r_px, LADDER_ORBIT_ANGLE_SINGLE_DEG, 'form', rim))
    return ''.join(o)  # 'specialised': no ladder


def threat_label(x, y, r, name='AMOEBOID', own=(CX, CY), own_r=24):
    """World-anchored on the warning ring, on the side facing the own cell (never off-screen, never in a corner
    panel); when that pill would overlap the own cell's orbit extent it moves to the far side of the ring instead."""
    ring = max(r * ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX)
    s = f'{name} CAN ENGULF YOU'
    w, h = base.text_width(s, 'label') + 2 * LABEL_PILL_PAD_PX, LABEL_PILL_HEIGHT_PX
    dx, dy = own[0] - x, own[1] - y
    d = math.hypot(dx, dy) or 1.0
    ux, uy = dx / d, dy / d
    offset = ring + THREAT_LABEL_GAP_PX + h / 2
    cx, cy = x + ux * offset, y + uy * offset
    if math.hypot(own[0] - cx, own[1] - cy) < ladder_orbit_extent_px(own_r) + math.hypot(w / 2, h / 2):
        cx, cy = x - ux * offset, y - uy * offset  # far side
    return label_pill(cx, cy, s)


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
        o.append(threat_label(ax, ay, ar, own_r=own_r))
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
    ind = own_indicators(102, 9, 0.40, 'eukaryote', sprint_fill=0.55)  # the next rung is a form: its ghost on the orbit
    return scene(rng, 102, 'euk', '', ind, other_scale=0.4, threat=False) + chrome()  # nothing on screen can engulf a cell at the cap


def sizes_sheet():
    """1:1 tiles: the own cell at 24 (reference-viewport spawn; cyan, then Mint with a 4-bead seat mark), 32 (1080p
    spawn), 45 (most of a round), 102 (cap), the escape arc before and after the seal at 33 px (reference-viewport
    steady state) and the threat label moved to the far side of a close predator's ring."""
    tiles = [
        (24, 'prokaryote', 'cyan', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0))), '24 px · respawned L4 · 1280×800 spawn'),
        (24, 'prokaryote', 'mint', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0))), '24 px · Mint, 4-bead seat mark'),
        (32, 'prokaryote', 'cyan', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0))), '32 px · respawned L4 · 1080p spawn'),
        (45, 'prokaryote', 'cyan', dict(level=5, frac=0.15, counters=(('mitochondrion', 10), ('chloroplast', 1))), '45 px · L5, aerobic 10/10 unlocked'),
        (102, 'euk', 'cyan', dict(level=12, frac=1.0, at_max=True, sprint_fill=0.55), '102 px · L12 max · sprint cooling'),
        (33, 'prokaryote', 'cyan', dict(level=4, frac=0.62, engulf=0.3), '33 px · engulfed 30 % · cover'),
        (33, 'prokaryote', 'cyan', dict(level=4, frac=0.62, engulf=0.65, sealed=True), '33 px · engulfed 65 % · sealed'),
        (24, 'prokaryote', 'cyan', dict(level=4, frac=0.62, counters=(('mitochondrion', 2), ('chloroplast', 0)), predator=(0, -88, 30)), '24 px · label on the far side'),
    ]
    tile_w, tile_h, pad = 300, 320, 6
    sheet_w = len(tiles) * (tile_w + pad) + pad
    o = [f'<rect width="{sheet_w}" height="{tile_h + 2 * pad}" fill="#04070d"/>']
    for i, (r, stage, pal, kw, caption) in enumerate(tiles):
        tx = pad + i * (tile_w + pad)
        cx, cy = tx + tile_w / 2, pad + 150
        rng = random.Random(7 + i)
        o.append(f'<rect x="{tx}" y="{pad}" width="{tile_w}" height="{tile_h}" rx="8" fill="url(#bg-field)" stroke="{base.PANEL_RIM}"/>')
        o.append(f'<clipPath id="tile-{i}"><rect x="{tx}" y="{pad}" width="{tile_w}" height="{tile_h}" rx="8"/></clipPath><g clip-path="url(#tile-{i})">')
        ind_stage = 'specialised' if stage == 'euk' else stage  # L12 max has no next rung
        ind = own_indicators(r, kw.get('level'), kw.get('frac'), ind_stage, counters=kw.get('counters', ()), rim=base.PAL[pal][1],
                             sprint_fill=kw.get('sprint_fill', 1.0), engulf=kw.get('engulf'), at_max=kw.get('at_max', False), sealed=kw.get('sealed', False))
        if 'predator' in kw:
            px, py, pr = kw['predator']
            ax, ay = cx + px, cy + py
            o.append(base.cell(ax, ay, pr, 'coral', 'amoeba', rng, heading=200, speed=0.2))
            ring = max(pr * ENGULF_WARNING_RING_RADII, ENGULF_WARNING_RING_MIN_PX)
            o.append(f'<circle cx="{ax}" cy="{ay}" r="{ring:.0f}" fill="none" stroke="{base.DANGER}" stroke-width="2" stroke-dasharray="6 5" opacity="0.85" filter="url(#glow-soft)"/>')
        if stage == 'prokaryote':
            o.append(base.flagellum(cx, cy, r, base.PLAYER_HEADING))
        o.append(base.cell(cx, cy, r, pal, stage, rng, heading=base.PLAYER_HEADING, speed=0.55, self_ring=False, extra_after=ind))
        if 'predator' in kw:
            px, py, pr = kw['predator']
            o.append(threat_label(cx + px, cy + py, pr, own=(cx, cy), own_r=r))
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
    for r_px in (24, 32, 45, 102):
        g = geometry_row(r_px)
        print(f"r={r_px:>3}: dna {g['dna']:.1f} keep-out {g['keep_out']:.1f} (ring edge+pad {g['ring_edge']:.1f}) self {g['self_ring']:.1f} "
              f"orbit {g['orbit']:.1f} span {g['span']:.0f}deg between-backings {g['between']:.0f}deg extent {g['extent']:.1f} seat-gap {g['seat_gap']:.1f}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

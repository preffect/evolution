#!/usr/bin/env python3
"""Encyclopedia and ESC menu mockups (#354): the first full UI surface and the kit it sets.

Frames, each at 1920x1080 (HUD scale 1.35) and 1280x800 (scale 1) unless noted:
  esc-menu              the ESC menu over the live round
  encyclopedia-a-trait  option A (atlas: rail, list, detail with a stage preview) on Mitochondrion
  encyclopedia-a-category  option A on the Food category's landing grid
  encyclopedia-b-trait  option B (eyepiece: a round lens preview beside the facts), 1920 only
  encyclopedia-c-trait  option C (codex: category tabs, a hero preview, no list column), 1920 only

Every size is a docs/ui/components-and-constants.md §10 / docs/ui/encyclopedia.md constant at scale 1; the UI layer is
drawn in scale-1 units inside one scale(s) group, as `calc(<px> * var(--ui-scale))` lays it out. Colours are
docs/visual-style roles, type is ui-type.md §7's roles. The trait facts are the shipped tier rows of
`packages/shared/src/constants/trait-modifiers.ts` run through the card label table (`trait-effects.ts`).
Reuses the #143 dish and cell kit (qa/decisions/hud-layout/tools/render.py). Seeded, so a re-run reproduces the SVGs.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'hud-layout' / 'tools'))
import render as kit  # noqa: E402

from render import (  # noqa: E402
    ACCENT, DANGER, DNA, GOLD, LABEL, MITO_BASE, MITO_LIGHT, MUTED, PANEL_BOTTOM, PANEL_RIM, PANEL_TOP, TEXT, WHITE,
    CHLORO_BASE, CHLORO_LIGHT, CHLORO_DARK, FOOD_MOTE, NUCLEOID_STRAND, ZONE_VENT, esc,
)

kit.ROLES.setdefault('figure', (14, kit.MONO, 'normal', False, 0))  # ui-type.md §7; the #143 kit predates the role
kit.ROLES.setdefault('label_mixed', (12, kit.SANS, 'normal', False, 0.08))  # measuring only: `label` without the uppercase
CALLOUT = '#04070d'  # CALLOUT_BACKING = BG_DEEP (principles-and-palette.md §2)
TAG_METABOLIC = '#ffb15a'

# ---- kit tokens (components-and-constants.md §10), px at scale 1 ----
SPACE_XS, SPACE_S, SPACE_M, SPACE_L, SPACE_XL = 4, 8, 12, 16, 24
RADIUS_CONTROL, RADIUS_PANEL = 4, 8
BUTTON_H, BUTTON_COMPACT_H = 40, 28
ROW_H, RAIL_ROW_H, MEDALLION = 40, 36, 24
SELECTION_BAR = 3
ROW_HOVER_ALPHA, ROW_SELECTED_ALPHA = 0.06, 0.12
WELL_ALPHA = 0.45
SCROLLBAR = 8
KEY_HINT_H = 18
CHIP_H = 20
PANEL_PAD = 24
FOCUS_RING = 2
SEARCH_W, SEARCH_H = 280, 32
MENU_SCRIM_ALPHA, ENCYCLOPEDIA_SCRIM_ALPHA = 0.5, 0.8

# ---- menu (overlays.md §3.5) ----
MENU_W = 400
MENU_TRAIT_ROW_H = 48
MENU_TRAIT_LINE_H = 16

# ---- encyclopedia (encyclopedia.md) ----
ENC_INSET, ENC_MAX_W, ENC_MAX_H = 32, 1360, 880
ENC_HEADER_H = 56
ENC_RAIL_W, ENC_LIST_W = 184, 280
ENC_PREVIEW_H = 220
ENC_PROSE_MAX_W = 640
ENC_TILE_W, ENC_TILE_H, ENC_TILE_PREVIEW_H = 168, 132, 96
ENC_TABS_H = 44
FACT_ROW_H = 26
ENC_LENS_D = 300

HUD_REFERENCE = (1280, 800)
SCALE_MIN, SCALE_MAX = 0.8, 1.5

CATEGORIES = [  # id, name, count; traits, evolution and world counts come from code (16 traits, 5 stages, 4 zones + 2)
    ('basics', 'Basics', 8), ('evolution', 'Evolution', 5), ('traits', 'Traits', 16), ('abilities', 'Abilities', 9),
    ('actions', 'Actions', 6), ('cells', 'Cells', 2), ('food', 'Food', 6), ('world', 'World', 6), ('hud', 'HUD', 7),
]

TRAIT_GROUPS = [  # catalog order, grouped by TRAIT_CATEGORY
    ('GENOME', [('nucleoid', 'Nucleoid Coil', 'I'), ('nuclear_envelope', 'Nuclear Envelope', None)]),
    ('LOCOMOTION', [('simple_flagellum', 'Simple Flagellum', 'I'), ('cytoskeleton', 'Cytoskeleton Lattice', None),
                    ('cilia', 'Cilia Fringe', None)]),
    ('MEMBRANE', [('cell_wall', 'Cell Wall', None)]),
    ('METABOLISM', [('ribosomes', 'Ribosome Studs', None), ('mitochondrion', 'Mitochondrion', 'I'),
                    ('chloroplast', 'Chloroplast', None), ('food_vacuole', 'Food Vacuole', None)]),
    ('OFFENSE', [('toxin_vacuole', 'Toxin Vacuole', None)]),
    ('FORM', [('amoeba_pseudopods', 'Amoeba Pseudopods', None), ('paramecium_cilia', 'Paramecium Cilia', None),
              ('euglena_eyespot', 'Euglena Eyespot', None), ('diatom_shell', 'Diatom Shell', None),
              ('stentor_trumpet', 'Stentor Trumpet', None)]),
]

# MITOCHONDRION_TIERS through MODIFIER_LABELS: decayMultiplier 0.85/0.70/0.55, sprintSpeedMultiplierBonus 0.1/0.2/0.3
MITO_EFFECTS = [('Mass decay', ['−15 %', '−30 %', '−45 %']), ('Sprint speed', ['+10 %', '+20 %', '+30 %'])]
MITO_FACTS = [('Unlock', 'Eat 10 aerobic bacteria', True), ('Offered from', 'Prokaryote', True),
              ('Climbs to', 'Endosymbiosis', True), ('DNA tag', 'Metabolic', False)]
MITO_PROSE = [
    [('The powerhouse. Surplus mass burns slower, and every sprint hits harder while the beans pulse.', False)],
    [('', False), ('Aerobic bacteria', True), (' cluster at the ', False), ('warm vent', True),
     ('. Eat 10 and Mitochondrion joins your next ', False), ('draft', True), ('.', False)],
]
SEE_ALSO = ['Chloroplast', 'Mass decay', 'Sprint', 'Endosymbiosis']

FOOD_TILES = [  # id, name, fact line: ALGAE_MASS/DNA, BACTERIUM_MASS/DNA, DETRITUS_MOTE_MASS, DNA_FRAGMENT_DNA
    ('algae', 'Algae mote', '+1 mass'), ('bacterium_plain', 'Bacterium', '+3 mass · +1 DNA'),
    ('bacterium_aerobic', 'Aerobic bacterium', '+3 mass · +1 DNA'),
    ('bacterium_photosynthetic', 'Photosynthetic bacterium', '+3 mass · +1 DNA'),
    ('detritus', 'Detritus', '+2 mass'), ('dna_fragment', 'DNA fragment', '+5 DNA'),
]


# ---------------------------------------------------------------------------------------------------------------------
# primitives (all in scale-1 units)

def t(x, y, s, role, fill, anchor='start', weight=None, upper=None, opacity=1.0):
    return kit.text(round(x, 1), round(y, 1), s, role, fill, anchor=anchor, upper=upper, opacity=opacity, weight=weight)


def tw(s, role, upper=None):
    is_upper = kit.ROLES[role][3] if upper is None else upper
    return kit.text_width(s, role) * (1.2 if is_upper else 1.0)


def rect(x, y, w, h, fill='none', rx=0, stroke=None, sw=1, opacity=1.0, fill_opacity=None, extra=''):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    fo = f' fill-opacity="{fill_opacity}"' if fill_opacity is not None else ''
    return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{fo}{st} '
            f'opacity="{opacity}" {extra}/>')


def hline(x1, x2, y, col=PANEL_RIM, sw=1, opacity=1.0):
    return f'<line x1="{x1:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y:.1f}" stroke="{col}" stroke-width="{sw}" opacity="{opacity}"/>'


def vline(x, y1, y2, col=PANEL_RIM, sw=1, opacity=1.0):
    return f'<line x1="{x:.1f}" y1="{y1:.1f}" x2="{x:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{sw}" opacity="{opacity}"/>'


def focus_ring(x, y, w, h, rx=RADIUS_CONTROL):
    """The kit focus ring: FOCUS_RING in the text colour, 2 px outside the control (never scaled in CSS)."""
    return rect(x - 2 * FOCUS_RING, y - 2 * FOCUS_RING, w + 4 * FOCUS_RING, h + 4 * FOCUS_RING, rx=rx + 3,
                stroke=TEXT, sw=FOCUS_RING)


def modal_panel(x, y, w, h):
    return (rect(x, y, w, h, fill='url(#ui-panel)', rx=RADIUS_PANEL, stroke=PANEL_RIM)
            + rect(x + 1, y + 1, w - 2, 1, fill=WHITE, opacity=0.05))


def keycap(x_right, cy, label):
    w = max(KEY_HINT_H, tw(label, 'caption') + 10)
    x = x_right - w
    return (rect(x, cy - KEY_HINT_H / 2, w, KEY_HINT_H, rx=3, stroke=PANEL_RIM, fill=CALLOUT, fill_opacity=0.5)
            + t(x + w / 2, cy + 4, label, 'caption', MUTED, anchor='middle')), w


def button(x, y, w, label, variant='secondary', hint=None, focused=False, hovered=False, h=BUTTON_H):
    fills = {'primary': (ACCENT, 0.16, ACCENT, 0.7), 'secondary': (TEXT, 0.04, PANEL_RIM, 1.0),
             'danger': (DANGER, 0.0, DANGER, 0.55), 'quiet': (TEXT, 0.0, None, 0)}
    fill, fop, rim, rop = fills[variant]
    if hovered:
        fop += ROW_HOVER_ALPHA
    o = [rect(x, y, w, h, fill=fill, fill_opacity=fop, rx=RADIUS_CONTROL)]
    if rim:
        o.append(rect(x + 0.5, y + 0.5, w - 1, h - 1, rx=RADIUS_CONTROL, stroke=rim, opacity=rop))
    o.append(t(x + SPACE_L, y + h / 2 + 5, label, 'body', TEXT, weight='bold' if variant == 'primary' else None))
    if hint:
        o.append(keycap(x + w - SPACE_M, y + h / 2, hint)[0])
    if focused:
        o.append(focus_ring(x, y, w, h))
    return ''.join(o)


def chip(x, y, label, dot=None, rim=PANEL_RIM, col=LABEL, fill=None):
    w = tw(label, 'label') + 2 * SPACE_S + (10 if dot else 0)
    o = [rect(x, y, w, CHIP_H, rx=CHIP_H / 2, stroke=rim, fill=fill or CALLOUT, fill_opacity=0.35)]
    tx = x + SPACE_S
    if dot:
        o.append(f'<circle cx="{tx + 3:.1f}" cy="{y + CHIP_H / 2:.1f}" r="3.5" fill="{dot}"/>')
        tx += 10
    o.append(t(tx, y + CHIP_H / 2 + 4.2, label, 'label', col))
    return ''.join(o), w


def link_chip(x, y, label):
    w = tw(label, 'body') + 2 * SPACE_M
    return (rect(x, y, w, 26, rx=RADIUS_CONTROL, stroke=PANEL_RIM, fill=TEXT, fill_opacity=0.03)
            + t(x + SPACE_M, y + 18, label, 'body', ACCENT)), w


def rich(x, y, parts, role='body'):
    px, face, weight, _up, _tr = kit.ROLES[role]
    spans = []
    for s, is_link in parts:
        if not s:
            continue
        if is_link:
            spans.append(f'<tspan fill="{ACCENT}" text-decoration="underline">{esc(s)}</tspan>')
        else:
            spans.append(f'<tspan fill="{TEXT}">{esc(s)}</tspan>')
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{face}" font-size="{px}" font-weight="{weight}" xml:space="preserve">'
            + ''.join(spans) + '</text>')


def wrap_parts(parts, max_w, role='body'):
    """Greedy word wrap over (text, is_link) runs; returns a list of lines of runs."""
    words = []
    for s, is_link in parts:
        for i, word in enumerate(s.split(' ')):
            words.append((word if i == 0 else ' ' + word, is_link))
    lines, cur, cur_w = [], [], 0.0
    for word, is_link in words:
        ww = tw(word, role)
        if cur and cur_w + ww > max_w:
            lines.append(cur)
            cur, cur_w = [(word.lstrip(' '), is_link)], tw(word.lstrip(' '), role)
        else:
            cur.append((word, is_link))
            cur_w += ww
    if cur:
        lines.append(cur)
    return lines


def effect_lines(effects, max_w, separator=' · '):
    """Effect runs joined by the separator, broken only between runs (overlays.md §3.5: wrap, never cut)."""
    lines, cur = [], ''
    for run in effects.split(separator):
        candidate = run if not cur else cur + separator + run
        if cur and tw(candidate, 'label_mixed') > max_w:
            lines.append(cur)
            cur = run
        else:
            cur = candidate
    return lines + [cur]


def scrollbar(x, y, h, thumb_from, thumb_frac):
    return (rect(x, y, SCROLLBAR - 2, h, rx=3, fill=CALLOUT, fill_opacity=0.4)
            + rect(x, y + h * thumb_from, SCROLLBAR - 2, h * thumb_frac, rx=3, fill=PANEL_RIM, opacity=1)
            + rect(x, y + h * thumb_from, SCROLLBAR - 2, h * thumb_frac, rx=3, fill=MUTED, opacity=0.35))


# ---------------------------------------------------------------------------------------------------------------------
# glyphs (the medallions are #312's trait glyphs; these stand in)

def glyph(kind, cx, cy, size=1.0):
    s = size
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) scale({s:.2f})">']
    if kind == 'mitochondrion':
        g.append(f'<ellipse rx="7.5" ry="4.2" transform="rotate(-25)" fill="{MITO_BASE}" stroke="{MITO_LIGHT}" stroke-width="1"/>'
                 '<path d="M-4,-1.2 q1.5,2.5 3,0 q1.5,-2.5 3,0 q1.5,2.5 2.4,0.6" transform="rotate(-25)" fill="none" stroke="#9a4d12" stroke-width="1"/>')
    elif kind == 'chloroplast':
        g.append(f'<ellipse rx="7.5" ry="4.5" transform="rotate(20)" fill="{CHLORO_BASE}" stroke="{CHLORO_LIGHT}" stroke-width="1"/>')
        for i in (-3, 0, 3):
            g.append(f'<rect x="{i - 0.8}" y="-2.6" width="1.6" height="5.2" transform="rotate(20)" fill="{CHLORO_DARK}"/>')
    elif kind in ('nucleoid', 'nuclear_envelope'):
        g.append(f'<ellipse rx="6.5" ry="5" transform="rotate(20)" fill="none" stroke="{NUCLEOID_STRAND}" stroke-width="1.3"/>'
                 f'<path d="M-4,1 q2,-5 6,-1" fill="none" stroke="{ACCENT}" stroke-width="1.1"/>')
        if kind == 'nuclear_envelope':
            g.append(f'<circle r="8.5" fill="none" stroke="{ACCENT}" stroke-width="1" stroke-dasharray="2 1.5"/>')
    elif kind in ('simple_flagellum', 'cilia', 'paramecium_cilia'):
        if kind == 'simple_flagellum':
            g.append(f'<circle cx="-3" r="4" fill="none" stroke="{ACCENT}" stroke-width="1.2"/>'
                     f'<path d="M1,0 q2,-3 4,0 q2,3 4,0" fill="none" stroke="{WHITE}" stroke-width="1.2"/>')
        else:
            g.append(f'<ellipse rx="{7 if kind == "paramecium_cilia" else 5}" ry="4.5" fill="none" stroke="{ACCENT}" stroke-width="1.2"/>')
            for i in range(12):
                a = math.tau * i / 12
                g.append(f'<line x1="{6.2 * math.cos(a):.1f}" y1="{5.6 * math.sin(a):.1f}" x2="{8.4 * math.cos(a):.1f}" '
                         f'y2="{7.6 * math.sin(a):.1f}" stroke="{WHITE}" stroke-width="0.8" opacity="0.8"/>')
    elif kind == 'cytoskeleton':
        for a in (0, 60, 120):
            g.append(f'<line x1="-7" y1="0" x2="7" y2="0" transform="rotate({a})" stroke="{ACCENT}" stroke-width="1.1"/>')
        g.append(f'<circle r="7.5" fill="none" stroke="{LABEL}" stroke-width="0.8"/>')
    elif kind == 'cell_wall':
        g.append(f'<circle r="7.5" fill="none" stroke="{WHITE}" stroke-width="1.2"/><circle r="5" fill="none" stroke="{ACCENT}" stroke-width="1.6"/>')
    elif kind == 'ribosomes':
        for i in range(10):
            a = math.tau * i / 10
            g.append(f'<circle cx="{6 * math.cos(a):.1f}" cy="{6 * math.sin(a):.1f}" r="1.2" fill="{ACCENT}"/>')
    elif kind in ('food_vacuole', 'toxin_vacuole'):
        col = '#d05cff' if kind == 'toxin_vacuole' else '#9fd9ff'
        g.append(f'<circle r="6.5" fill="{col}" fill-opacity="0.25" stroke="{col}" stroke-width="1.2"/><circle cx="-2" cy="-2" r="1.6" fill="#fff" opacity="0.7"/>')
    elif kind == 'amoeba_pseudopods':
        g.append(f'<path d="{kit.blob_path(6, bumps=((0.4, 0, 20), (0.3, 130, 20), (0.3, 240, 18)))}" fill="none" stroke="{ACCENT}" stroke-width="1.2"/>')
    elif kind == 'euglena_eyespot':
        g.append(f'<ellipse rx="8" ry="4" fill="none" stroke="{CHLORO_LIGHT}" stroke-width="1.1"/><circle cx="4" cy="-0.5" r="1.8" fill="{DANGER}"/>')
    elif kind == 'diatom_shell':
        pts = ' '.join(f'{7.5 * math.cos(math.tau * i / 6):.1f},{7.5 * math.sin(math.tau * i / 6):.1f}' for i in range(6))
        g.append(f'<polygon points="{pts}" fill="none" stroke="#e6ecf2" stroke-width="1.2"/><circle r="2.5" fill="none" stroke="#e6ecf2" stroke-width="0.8"/>')
    elif kind == 'stentor_trumpet':
        g.append(f'<path d="M-2,7 L-1,-1 Q-7,-6 -7,-7 L7,-7 Q7,-6 1,-1 L2,7 Z" fill="none" stroke="#d05cff" stroke-width="1.1"/>')
    g.append('</g>')
    return ''.join(g)


def medallion(cx, cy, kind, owned=False):
    r = MEDALLION / 2
    return (f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{CALLOUT}" fill-opacity="0.55" stroke="{GOLD if owned else PANEL_RIM}" '
            f'stroke-width="1"/>' + glyph(kind, cx, cy, 0.95))


def rail_icon(kind, cx, cy, col):
    o = [f'<g transform="translate({cx:.1f},{cy:.1f})" fill="none" stroke="{col}" stroke-width="1.3" stroke-linecap="round">']
    if kind == 'basics':
        o.append('<circle r="6.5"/><line x1="0" y1="-0.5" x2="0" y2="3.5"/><circle cy="-3.2" r="0.6" fill="currentColor"/>')
    elif kind == 'evolution':
        o.append('<polyline points="-7,6 -3,6 -3,1 1,1 1,-4 6,-4"/><polyline points="3,-6 6,-4 4,-1"/>')
    elif kind == 'traits':
        o.append('<ellipse rx="6.5" ry="3.8" transform="rotate(-25)"/><path d="M-3.5,-0.8 q1.4,2.2 2.8,0 q1.4,-2.2 2.8,0" transform="rotate(-25)"/>')
    elif kind == 'abilities':
        o.append('<path d="M1,-7 L-4,1 L0,1 L-1,7 L4,-1 L0,-1 Z"/>')
    elif kind == 'actions':
        o.append('<circle cx="-3" cy="2" r="3.2"/><polyline points="0,-1 6,-6"/><polyline points="2,-6 6,-6 6,-2"/>')
    elif kind == 'cells':
        o.append('<circle r="6.5"/><circle cx="-1" cy="-1" r="2.4"/>')
    elif kind == 'food':
        o.append('<circle cx="-3" cy="-2" r="2.2"/><circle cx="3" cy="-3" r="1.6"/><rect x="-3" y="2" width="8" height="3.4" rx="1.7"/>')
    elif kind == 'world':
        o.append('<circle r="6.5"/><path d="M-6.5,0 a6.5,6.5 0 0 0 13,0" stroke-dasharray="1.6 1.6"/><circle cx="1.5" cy="-1.5" r="1.6"/>')
    elif kind == 'hud':
        o.append('<circle r="6.5" stroke-dasharray="30 11"/><circle r="2.5"/>')
    o.append('</g>')
    return ''.join(o).replace('currentColor', col)


# ---------------------------------------------------------------------------------------------------------------------
# the live round behind the overlays

def game_background(vw, vh):
    """The #143 dish at its 1280x800 design size, scaled to cover the viewport, plus today's chrome."""
    k = max(vw / HUD_REFERENCE[0], vh / HUD_REFERENCE[1])
    dx, dy = (vw - HUD_REFERENCE[0] * k) / 2, (vh - HUD_REFERENCE[1] * k) / 2
    return f'<g transform="translate({dx:.1f},{dy:.1f}) scale({k:.4f})">{kit.scene(random.Random(42))}</g>'


def hud_chrome(uw, uh):
    """Compact leaderboard (hud.md §3.1.1) and the round clock, in scale-1 units."""
    x, y, w = uw - 16 - 240, 16, 240
    rows = [(1, 'Amoeboid', 'magenta', 7, 540), (2, 'Moss', 'cyan', 5, 412), (3, 'Kelp', 'lime', 5, 388),
            (4, 'Nib', 'coral', 4, 260), (5, 'Dot', 'rose', 2, 96)]
    o = [rect(x, y, w, 146, fill='url(#ui-panel)', rx=4, stroke=PANEL_RIM),
         t(x + 8, y + 17, 'Leaderboard', 'caption', LABEL), t(x + w - 8, y + 17, 'TAB', 'caption', MUTED, anchor='end'),
         hline(x, x + w, y + 26)]
    for i, (rank, name, pal, lv, score) in enumerate(rows):
        ry = y + 26 + i * 24
        if name == 'Moss':
            o.append(rect(x + 1, ry, w - 2, 24, fill=kit.PAL['cyan'][1], fill_opacity=0.12))
        o.append(t(x + 8, ry + 17, str(rank), 'body', LABEL))
        o.append(f'<circle cx="{x + 31}" cy="{ry + 12}" r="5" fill="{kit.PAL[pal][0]}" stroke="{kit.PAL[pal][1]}" stroke-width="1.2"/>')
        o.append(t(x + 44, ry + 17, name, 'body', TEXT))
        o.append(t(x + w - 52, ry + 17, f'L{lv}', 'body', LABEL, anchor='end'))
        o.append(t(x + w - 8, ry + 17, str(score), 'figure', TEXT, anchor='end'))
    o.append(rect(uw - 16 - 96, uh - 16 - 50, 96, 50, fill=CALLOUT, rx=10, opacity=0.62))
    o.append(t(uw - 24, uh - 16 - 22, '7:42', 'clock', TEXT, anchor='end'))
    o.append(t(uw - 24, uh - 16 - 6, 'ROUND', 'caption', MUTED, anchor='end'))
    return ''.join(o)


def scrim(uw, uh, alpha):
    return rect(0, 0, uw, uh, fill=CALLOUT, opacity=alpha)


# ---------------------------------------------------------------------------------------------------------------------
# ESC menu

OWNED = [('nucleoid', 'Nucleoid Coil I', '+5 % DNA'),
         ('simple_flagellum', 'Simple Flagellum I', '+5 % speed · +30 % sprint speed · −0.5 s sprint cooldown'),
         ('mitochondrion', 'Mitochondrion I', '−15 % mass decay · +10 % sprint speed')]


def esc_menu(uw, uh):
    text_w = MENU_W - 2 * PANEL_PAD - MEDALLION - SPACE_M - SPACE_L
    wrapped = [(kind, name, effect_lines(effects, text_w)) for kind, name, effects in OWNED]
    row_hs = [MENU_TRAIT_ROW_H + MENU_TRAIT_LINE_H * (len(lines) - 1) for _k, _n, lines in wrapped]
    h = PANEL_PAD + 22 + SPACE_S + 14 + 20 + 3 * BUTTON_H + 2 * SPACE_S + 20 + 1 + SPACE_L + 12 + SPACE_S \
        + sum(row_hs) + PANEL_PAD - SPACE_S
    x, y = (uw - MENU_W) / 2, (uh - h) / 2
    ix, iw = x + PANEL_PAD, MENU_W - 2 * PANEL_PAD
    o = [modal_panel(x, y, MENU_W, h)]
    cy = y + PANEL_PAD
    o.append(t(ix, cy + 18, 'Menu', 'title', TEXT))
    o.append(t(ix, cy + 22 + SPACE_S + 12, 'The dish keeps running.', 'body', MUTED))
    cy += 22 + SPACE_S + 14 + 20
    o.append(button(ix, cy, iw, 'Return to game', 'primary', hint='ESC', focused=True))
    cy += BUTTON_H + SPACE_S
    o.append(button(ix, cy, iw, 'Encyclopedia', 'secondary', hint='H'))
    cy += BUTTON_H + SPACE_S
    o.append(button(ix, cy, iw, 'Exit game', 'danger'))
    cy += BUTTON_H + 20
    o.append(hline(x, x + MENU_W, cy))
    cy += 1 + SPACE_L
    o.append(t(ix, cy + 10, 'Your traits', 'label', LABEL))
    o.append(t(ix + iw, cy + 10, str(len(OWNED)), 'label', MUTED, anchor='end'))
    cy += 12 + SPACE_S
    ry = cy
    for i, ((kind, name, lines), rh) in enumerate(zip(wrapped, row_hs)):
        if i == 2:  # the pointer rests on this row
            o.append(rect(ix - SPACE_S, ry, iw + 2 * SPACE_S, rh, fill=TEXT, fill_opacity=ROW_HOVER_ALPHA, rx=RADIUS_CONTROL))
        o.append(medallion(ix + MEDALLION / 2, ry + rh / 2, kind, owned=True))
        o.append(t(ix + MEDALLION + SPACE_M, ry + 20, name, 'body', TEXT, weight='bold'))
        for j, line in enumerate(lines):
            o.append(t(ix + MEDALLION + SPACE_M, ry + 37 + j * MENU_TRAIT_LINE_H, line, 'label', LABEL, upper=False, weight='normal'))
        o.append(t(ix + iw, ry + rh / 2 + 6, '›', 'card_name', MUTED if i != 2 else ACCENT, anchor='end'))
        ry += rh
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------
# encyclopedia pieces

def enc_frame(uw, uh):
    w = min(uw - 2 * ENC_INSET, ENC_MAX_W)
    h = min(uh - 2 * ENC_INSET, ENC_MAX_H)
    return (uw - w) / 2, (uh - h) / 2, w, h


def enc_header(x, y, w, alert=True):
    o = [hline(x, x + w, y + ENC_HEADER_H)]
    bx = x + SPACE_L
    o.append(button(bx, y + (ENC_HEADER_H - 32) / 2, 32, '', 'secondary', h=32))
    o.append(t(bx + 16, y + ENC_HEADER_H / 2 + 6, '‹', 'card_name', LABEL, anchor='middle'))
    o.append(t(bx + 32 + SPACE_M, y + ENC_HEADER_H / 2 + 8, 'Encyclopedia', 'title', TEXT))
    sx = x + SPACE_L + ENC_RAIL_W + ENC_LIST_W - SEARCH_W - SPACE_L
    sx = max(sx, bx + 32 + SPACE_M + tw('Encyclopedia', 'title') + SPACE_XL)
    sy = y + (ENC_HEADER_H - SEARCH_H) / 2
    o.append(rect(sx, sy, SEARCH_W, SEARCH_H, fill=CALLOUT, fill_opacity=0.55, rx=RADIUS_CONTROL, stroke=PANEL_RIM))
    o.append(f'<circle cx="{sx + 16}" cy="{sy + 15}" r="5" fill="none" stroke="{MUTED}" stroke-width="1.4"/>'
             f'<line x1="{sx + 19.5}" y1="{sy + 18.5}" x2="{sx + 23}" y2="{sy + 22}" stroke="{MUTED}" stroke-width="1.4"/>')
    o.append(t(sx + 30, sy + SEARCH_H / 2 + 5, 'Search', 'body', MUTED))
    o.append(keycap(sx + SEARCH_W - SPACE_S, sy + SEARCH_H / 2, '/')[0])
    cx = x + w - SPACE_L - 32
    o.append(button(cx, y + (ENC_HEADER_H - 32) / 2, 32, '', 'secondary', h=32))
    o.append(f'<path d="M{cx + 11},{y + 17} l10,10 M{cx + 21},{y + 17} l-10,10" stroke="{LABEL}" stroke-width="1.5"/>')
    kc, kw = keycap(cx - SPACE_S, y + ENC_HEADER_H / 2, 'ESC')
    o.append(kc)
    if alert:
        label = 'AMOEBOID CAN ENGULF YOU'
        aw = tw(label, 'label') + 2 * SPACE_M + 12
        ax = cx - SPACE_S - kw - SPACE_M - aw
        ay = y + (ENC_HEADER_H - 26) / 2
        o.append(rect(ax, ay, aw, 26, rx=13, fill=CALLOUT, fill_opacity=0.75, stroke=DANGER))
        o.append(f'<circle cx="{ax + SPACE_M + 3}" cy="{ay + 13}" r="4" fill="{DANGER}"/>')
        o.append(t(ax + SPACE_M + 12, ay + 17.5, label, 'label', WHITE))
    return ''.join(o)


def enc_rail(x, y, h, selected, focused=None):
    o = [rect(x, y, ENC_RAIL_W, h, fill=CALLOUT, fill_opacity=WELL_ALPHA), vline(x + ENC_RAIL_W, y, y + h)]
    ry = y + SPACE_M
    for cid, name, count in CATEGORIES:
        is_sel = cid == selected
        if is_sel:
            o.append(rect(x, ry, ENC_RAIL_W, RAIL_ROW_H, fill=ACCENT, fill_opacity=ROW_SELECTED_ALPHA))
            o.append(rect(x, ry, SELECTION_BAR, RAIL_ROW_H, fill=ACCENT))
        col = TEXT if is_sel else LABEL
        o.append(rail_icon(cid, x + SPACE_L + 8, ry + RAIL_ROW_H / 2, ACCENT if is_sel else LABEL))
        o.append(t(x + SPACE_L + 16 + SPACE_M, ry + RAIL_ROW_H / 2 + 5, name, 'body', col, weight='bold' if is_sel else None))
        o.append(t(x + ENC_RAIL_W - SPACE_L, ry + RAIL_ROW_H / 2 + 5, str(count), 'figure', MUTED, anchor='end'))
        if cid == focused:
            o.append(focus_ring(x + 4, ry + 2, ENC_RAIL_W - 8, RAIL_ROW_H - 4))
        ry += RAIL_ROW_H
    return ''.join(o)


def list_row(x, y, w, kind, name, trailing=None, state='rest'):
    o = []
    if state == 'selected':
        o.append(rect(x, y, w, ROW_H, fill=ACCENT, fill_opacity=ROW_SELECTED_ALPHA))
        o.append(rect(x, y, SELECTION_BAR, ROW_H, fill=ACCENT))
    elif state == 'hover':
        o.append(rect(x, y, w, ROW_H, fill=TEXT, fill_opacity=ROW_HOVER_ALPHA))
    o.append(medallion(x + SPACE_L + MEDALLION / 2, y + ROW_H / 2, kind, owned=trailing is not None))
    o.append(t(x + SPACE_L + MEDALLION + SPACE_M, y + ROW_H / 2 + 5, name, 'body', TEXT if state != 'rest' else TEXT,
               weight='bold' if state == 'selected' else None))
    if trailing:
        cw = tw(trailing, 'label') + 12
        cx = x + w - SPACE_L - cw
        o.append(rect(cx, y + ROW_H / 2 - 9, cw, 18, rx=9, stroke=GOLD, fill='none', opacity=0.9))
        o.append(t(cx + cw / 2, y + ROW_H / 2 + 4, trailing, 'label', GOLD, anchor='middle'))
    return ''.join(o)


def enc_trait_list(x, y, h, selected='mitochondrion', hovered='chloroplast'):
    o = [vline(x + ENC_LIST_W, y, y + h)]
    o.append(t(x + SPACE_L, y + SPACE_L + 10, 'Traits', 'label', LABEL))
    o.append(t(x + ENC_LIST_W - SPACE_L, y + SPACE_L + 10, '16', 'label', MUTED, anchor='end'))
    o.append(f'<clipPath id="list-clip"><rect x="{x}" y="{y + 40}" width="{ENC_LIST_W}" height="{h - 40}"/></clipPath>')
    o.append(f'<g clip-path="url(#list-clip)">')
    ry = y + 40
    for group, rows in TRAIT_GROUPS:
        o.append(t(x + SPACE_L, ry + 20, group, 'label', MUTED))
        ry += 28
        for tid, name, owned in rows:
            state = 'selected' if tid == selected else ('hover' if tid == hovered else 'rest')
            o.append(list_row(x, ry, ENC_LIST_W - SCROLLBAR, tid, name, trailing=owned, state=state))
            ry += ROW_H
    o.append('</g>')
    content_h = ry - (y + 40)
    frac = min(1.0, (h - 40) / content_h)
    o.append(scrollbar(x + ENC_LIST_W - SCROLLBAR, y + 44, h - 52, 0.0, frac))
    return ''.join(o)


def mito_cell(cx, cy, r, tier, rng):
    beans = []
    for i in range(tier):
        a = math.radians(40 + 115 * i)
        d = r * 0.58
        bx, by = d * math.cos(a), d * math.sin(a)
        rot = math.degrees(a) + 90
        beans.append(f'<g transform="translate({bx:.1f},{by:.1f}) rotate({rot:.0f})">'
                     f'<ellipse rx="{r * 0.26:.1f}" ry="{r * 0.34:.1f}" fill="url(#halo-mito)"/>'
                     f'<ellipse rx="{r * 0.2:.1f}" ry="{r * 0.1:.1f}" fill="{MITO_BASE}" stroke="{MITO_LIGHT}" stroke-width="1.2"/>'
                     f'<path d="M{-r * 0.13:.1f},{-r * 0.03:.1f} q{r * 0.04:.1f},{r * 0.07:.1f} {r * 0.08:.1f},0 q{r * 0.04:.1f},{-r * 0.07:.1f} {r * 0.08:.1f},0 '
                     f'q{r * 0.04:.1f},{r * 0.07:.1f} {r * 0.08:.1f},0" fill="none" stroke="#9a4d12" stroke-width="1.1"/></g>')
    return (kit.flagellum(cx, cy, r, 180) + kit.cell(cx, cy, r, 'cyan', 'prokaryote', rng, heading=0, speed=0.25,
                                                      extra_inside=''.join(beans)))


def preview_stage(x, y, w, h, tier=1, clip_id='stage-clip', round_lens=False, show_scale=True):
    rng = random.Random(7)
    cx, cy = x + w / 2, y + h / 2
    o = []
    if round_lens:
        r = w / 2
        o.append(f'<clipPath id="{clip_id}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>')
    else:
        o.append(f'<clipPath id="{clip_id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{RADIUS_PANEL}"/></clipPath>')
    o.append(f'<g clip-path="url(#{clip_id})">')
    o.append(rect(x, y, w, h, fill='url(#stage-field)'))
    o.append(f'<ellipse cx="{x + w * 0.2:.1f}" cy="{y + h * 0.18:.1f}" rx="{w * 0.5:.1f}" ry="{h * 0.8:.1f}" fill="url(#light-pool)"/>')
    for _ in range(40):
        o.append(f'<circle cx="{rng.uniform(x, x + w):.1f}" cy="{rng.uniform(y, y + h):.1f}" r="{rng.uniform(0.5, 1.2):.1f}" fill="#9fc4de" opacity="{rng.uniform(0.08, 0.28):.2f}"/>')
    for bx, by, hd in ((0.2, 0.3, 20), (0.8, 0.72, 160), (0.86, 0.26, 70), (0.14, 0.78, 110)):
        o.append(kit.bacterium(x + w * bx, y + h * by, hd, 'aerobic'))
    for mx, my in ((0.3, 0.7), (0.7, 0.2), (0.62, 0.85), (0.38, 0.15)):
        o.append(f'<circle cx="{x + w * mx:.1f}" cy="{y + h * my:.1f}" r="12" fill="url(#halo-algal)"/>'
                 f'<circle cx="{x + w * mx:.1f}" cy="{y + h * my:.1f}" r="4" fill="url(#mote-algal)"/>')
    r = min(h, w) * 0.27
    o.append(mito_cell(cx + (0 if round_lens else w * 0.04), cy, r, tier, rng))
    o.append('</g>')
    if round_lens:
        rr = w / 2
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="none" stroke="{PANEL_RIM}" stroke-width="6"/>'
                 f'<circle cx="{cx}" cy="{cy}" r="{rr - 3}" fill="none" stroke="{ACCENT}" stroke-width="1" opacity="0.35"/>')
        for i in range(24):
            a = math.tau * i / 24
            l = 10 if i % 6 == 0 else 5
            o.append(f'<line x1="{cx + (rr - 4) * math.cos(a):.1f}" y1="{cy + (rr - 4) * math.sin(a):.1f}" '
                     f'x2="{cx + (rr - 4 - l) * math.cos(a):.1f}" y2="{cy + (rr - 4 - l) * math.sin(a):.1f}" stroke="{LABEL}" stroke-width="1" opacity="0.6"/>')
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="url(#lens-vignette)"/>')
    else:
        o.append(rect(x + 0.5, y + 0.5, w - 1, h - 1, rx=RADIUS_PANEL, stroke=PANEL_RIM))
        if show_scale:
            o.append(scale_bar(x + SPACE_L, y + h - SPACE_L))
    return ''.join(o)


def scale_bar(x, y, units='50 u', px=56):
    return (f'<line x1="{x}" y1="{y}" x2="{x + px}" y2="{y}" stroke="{LABEL}" stroke-width="1.5"/>'
            f'<line x1="{x}" y1="{y - 4}" x2="{x}" y2="{y + 4}" stroke="{LABEL}" stroke-width="1.5"/>'
            f'<line x1="{x + px}" y1="{y - 4}" x2="{x + px}" y2="{y + 4}" stroke="{LABEL}" stroke-width="1.5"/>'
            + t(x + px + SPACE_S, y + 4, units, 'label', LABEL))


def tier_switch(x, y, selected=0):
    o = []
    labels = ['I', 'II', 'III']
    w = 36
    o.append(rect(x, y, w * 3, BUTTON_COMPACT_H, rx=RADIUS_CONTROL, fill=CALLOUT, fill_opacity=0.75, stroke=PANEL_RIM))
    for i, lab in enumerate(labels):
        if i == selected:
            o.append(rect(x + i * w + 2, y + 2, w - 4, BUTTON_COMPACT_H - 4, rx=3, fill=ACCENT, fill_opacity=0.22))
        o.append(t(x + i * w + w / 2, y + BUTTON_COMPACT_H / 2 + 4.5, lab, 'label', TEXT if i == selected else LABEL, anchor='middle'))
    return ''.join(o), w * 3


def stage_controls(x, y, w, h):
    sw_svg, _ = tier_switch(x + SPACE_M, y + SPACE_M)
    label = 'Play sprint'
    bw = tw(label, 'body') + 2 * SPACE_M + 14
    bx = x + w - SPACE_M - bw
    by = y + SPACE_M
    play = (rect(bx, by, bw, BUTTON_COMPACT_H, rx=RADIUS_CONTROL, fill=CALLOUT, fill_opacity=0.75, stroke=PANEL_RIM)
            + f'<path d="M{bx + SPACE_M},{by + 8} l8,6 l-8,6 z" fill="{LABEL}"/>'
            + t(bx + SPACE_M + 14, by + BUTTON_COMPACT_H / 2 + 5, label, 'body', TEXT))
    return sw_svg + play


def section_label(x, y, s):
    return t(x, y, s, 'label', LABEL)


def effects_table(x, y, w, owned_col=0):
    col_w = 64
    name_w = w - 3 * col_w
    o = [section_label(x, y + 10, 'Effects by tier')]
    ty = y + 22
    o.append(rect(x + name_w + owned_col * col_w, ty, col_w, FACT_ROW_H * (1 + len(MITO_EFFECTS)), fill=ACCENT, fill_opacity=0.08, rx=RADIUS_CONTROL))
    for i, lab in enumerate(['I', 'II', 'III']):
        colr = ACCENT if i == owned_col else MUTED
        o.append(t(x + name_w + i * col_w + col_w - SPACE_S, ty + 17, lab, 'label', colr, anchor='end'))
    o.append(t(x, ty + 17, 'You own I', 'label', MUTED, upper=False, weight='normal'))
    o.append(hline(x, x + w, ty + FACT_ROW_H))
    for r, (name, vals) in enumerate(MITO_EFFECTS):
        ry = ty + FACT_ROW_H * (r + 1)
        o.append(t(x, ry + 18, name, 'body', LABEL))
        for i, v in enumerate(vals):
            o.append(t(x + name_w + i * col_w + col_w - SPACE_S, ry + 18, v, 'figure', TEXT, anchor='end'))
        o.append(hline(x, x + w, ry + FACT_ROW_H, opacity=0.6))
    return ''.join(o), 22 + FACT_ROW_H * (1 + len(MITO_EFFECTS))


def facts_list(x, y, w, facts=MITO_FACTS, title='Unlock and ladder'):
    o = [section_label(x, y + 10, title)]
    ty = y + 22
    for r, (k, v, is_link) in enumerate(facts):
        ry = ty + r * FACT_ROW_H
        o.append(t(x, ry + 18, k, 'body', LABEL))
        if is_link:
            o.append(f'<text x="{x + w:.1f}" y="{ry + 18:.1f}" font-family="{kit.SANS}" font-size="14" fill="{ACCENT}" '
                     f'text-anchor="end" text-decoration="underline">{esc(v)}</text>')
        else:
            o.append(t(x + w, ry + 18, v, 'body', TEXT, anchor='end'))
        o.append(hline(x, x + w, ry + FACT_ROW_H, opacity=0.6))
    return ''.join(o), 22 + FACT_ROW_H * len(facts)


def prose(x, y, w):
    o = []
    ly = y
    for para in MITO_PROSE:
        for line in wrap_parts(para, w):
            o.append(rich(x, ly + 14, line))
            ly += 22
        ly += SPACE_S
    return ''.join(o), ly - y


def see_also(x, y, w):
    o = [section_label(x, y + 10, 'See also')]
    cx = x
    cy = y + 22
    for name in SEE_ALSO:
        svg, cw = link_chip(cx, cy, name)
        if cx + cw > x + w:
            cx = x
            cy += 26 + SPACE_S
            svg, cw = link_chip(cx, cy, name)
        o.append(svg)
        cx += cw + SPACE_S
    return ''.join(o), cy + 26 - y


def entry_title(x, y, crumb='Traits  ›  Metabolism', name='Mitochondrion', chips=True, owned=True, chips_below=False):
    o = [t(x, y + 10, crumb, 'label', MUTED)]
    o.append(t(x, y + 10 + SPACE_M + 24, name, 'headline', TEXT))
    cx = x if chips_below else x + tw(name, 'headline') * 1.08 + SPACE_L
    cy = y + 10 + SPACE_M + 24 + (SPACE_M if chips_below else -17)
    if chips:
        for label, dot, rim, col in (('Uncommon', None, ACCENT, ACCENT), ('Metabolic', TAG_METABOLIC, PANEL_RIM, LABEL),
                                     ('Prokaryote', None, PANEL_RIM, LABEL)):
            svg, w = chip(cx, cy, label, dot=dot, rim=rim, col=col)
            o.append(svg)
            cx += w + SPACE_S
        if owned:
            svg, w = chip(cx, cy, 'Owned · I', rim=GOLD, col=GOLD)
            o.append(svg)
    return ''.join(o), 10 + SPACE_M + 24 + (SPACE_M + CHIP_H if chips_below else SPACE_XS)


# ---------------------------------------------------------------------------------------------------------------------
# encyclopedia frames

def enc_shell(uw, uh, category, focused_rail=None, alert=True):
    x, y, w, h = enc_frame(uw, uh)
    o = [scrim(uw, uh, ENCYCLOPEDIA_SCRIM_ALPHA), modal_panel(x, y, w, h)]
    o.append(enc_header(x, y, w, alert=alert))
    body_y = y + ENC_HEADER_H + 1
    body_h = h - ENC_HEADER_H - 1
    o.append(f'<clipPath id="rail-clip"><rect x="{x}" y="{body_y}" width="{w}" height="{body_h}" rx="{RADIUS_PANEL}"/></clipPath>')
    o.append(f'<g clip-path="url(#rail-clip)">{enc_rail(x, body_y, body_h, category, focused=focused_rail)}</g>')
    return ''.join(o), (x, y, w, h, body_y, body_h)


def frame_a_trait(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'traits')
    o = [shell, enc_trait_list(x + ENC_RAIL_W, by, bh)]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    cy = by + PANEL_PAD - 4
    svg, th = entry_title(dx, cy)
    o.append(svg)
    cy += th + SPACE_L
    o.append(preview_stage(dx, cy, dw, ENC_PREVIEW_H, tier=1))
    o.append(stage_controls(dx, cy, dw, ENC_PREVIEW_H))
    cy += ENC_PREVIEW_H + SPACE_XL
    col_w = (dw - SPACE_XL) / 2
    svg, eh = effects_table(dx, cy, col_w)
    o.append(svg)
    svg, fh = facts_list(dx + col_w + SPACE_XL, cy, col_w)
    o.append(svg)
    cy += max(eh, fh) + SPACE_XL
    prose_w = min(dw, ENC_PROSE_MAX_W)
    svg, ph = prose(dx, cy, prose_w)
    o.append(svg)
    cy += ph + SPACE_S
    svg, _ = see_also(dx, cy, dw)
    o.append(svg)
    return ''.join(o)


def food_item(kind, cx, cy, s=2.2):
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) scale({s})">']
    if kind == 'algae':
        g.append('<circle r="14" fill="url(#halo-algal)"/><circle r="5" fill="url(#mote-algal)"/><circle cx="-1.8" cy="-1.8" r="1.4" fill="#fff" opacity="0.7"/>')
    elif kind.startswith('bacterium'):
        g.append(kit.bacterium(0, 0, -20, kind.split('_')[1]).replace('translate(0.0,0.0)', 'translate(0,0) scale(0.6)'))
    elif kind == 'detritus':
        g.append('<g transform="rotate(-20)"><ellipse rx="14" ry="9" fill="url(#halo-lipid)"/><ellipse rx="6" ry="3.8" fill="url(#mote-lipid)"/>'
                 '<ellipse cx="-2" cy="-1.2" rx="1.6" ry="0.8" fill="#fff" opacity="0.6"/></g>')
    elif kind == 'dna_fragment':
        pts_a = ' '.join(f'{v - 9:.1f},{3.2 * math.sin(v * 0.7):.1f}' for v in range(0, 19, 2))
        pts_b = ' '.join(f'{v - 9:.1f},{-3.2 * math.sin(v * 0.7):.1f}' for v in range(0, 19, 2))
        rungs = ''.join(f'<line x1="{v - 9}" y1="{3.2 * math.sin(v * 0.7):.1f}" x2="{v - 9}" y2="{-3.2 * math.sin(v * 0.7):.1f}" stroke="{TAG_METABOLIC}" stroke-width="1.2"/>'
                        for v in (2, 6, 10, 14))
        g.append(f'<g transform="rotate(-20)"><circle r="16" fill="{TAG_METABOLIC}" opacity="0.18" filter="url(#blur-6)"/>'
                 f'<polyline points="{pts_a}" fill="none" stroke="{kit.DNA_STRAND_LIGHT}" stroke-width="1.6"/>'
                 f'<polyline points="{pts_b}" fill="none" stroke="{DNA}" stroke-width="1.6"/>{rungs}</g>')
    g.append('</g>')
    return ''.join(g)


def food_list(x, y, h, hovered='bacterium_aerobic'):
    o = [vline(x + ENC_LIST_W, y, y + h), t(x + SPACE_L, y + SPACE_L + 10, 'Food', 'label', LABEL),
         t(x + ENC_LIST_W - SPACE_L, y + SPACE_L + 10, '6', 'label', MUTED, anchor='end')]
    ry = y + 40
    for fid, name, _fact in FOOD_TILES:
        state = 'hover' if fid == hovered else 'rest'
        if state == 'hover':
            o.append(rect(x, ry, ENC_LIST_W, ROW_H, fill=TEXT, fill_opacity=ROW_HOVER_ALPHA))
        o.append(f'<circle cx="{x + SPACE_L + MEDALLION / 2}" cy="{ry + ROW_H / 2}" r="{MEDALLION / 2}" fill="{CALLOUT}" fill-opacity="0.55" stroke="{PANEL_RIM}"/>')
        o.append(food_item(fid, x + SPACE_L + MEDALLION / 2, ry + ROW_H / 2, s=0.62))
        o.append(t(x + SPACE_L + MEDALLION + SPACE_M, ry + ROW_H / 2 + 5, name, 'body', TEXT))
        ry += ROW_H
    return ''.join(o)


def frame_a_category(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'food', focused_rail='food', alert=False)
    o = [shell, food_list(x + ENC_RAIL_W, by, bh)]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    cy = by + PANEL_PAD - 4
    o.append(t(dx, cy + 10, 'Encyclopedia  ›  Food', 'label', MUTED))
    o.append(t(dx, cy + 10 + SPACE_M + 24, 'Food', 'headline', TEXT))
    o.append(t(dx, cy + 10 + SPACE_M + 24 + SPACE_M + 16, 'What you swallow to grow, and where DNA comes from.', 'body', LABEL))
    cy += 10 + SPACE_M + 24 + SPACE_M + 16 + SPACE_XL
    per_row = max(1, int((dw + SPACE_M) // (ENC_TILE_W + SPACE_M)))
    for i, (fid, name, fact) in enumerate(FOOD_TILES):
        tx = dx + (i % per_row) * (ENC_TILE_W + SPACE_M)
        ty = cy + (i // per_row) * (ENC_TILE_H + SPACE_M)
        hovered = fid == 'bacterium_aerobic'
        o.append(rect(tx, ty, ENC_TILE_W, ENC_TILE_H, rx=RADIUS_PANEL, fill=TEXT, fill_opacity=0.03 + (ROW_HOVER_ALPHA if hovered else 0),
                      stroke=ACCENT if hovered else PANEL_RIM, opacity=1))
        o.append(f'<clipPath id="tile-{i}"><rect x="{tx + 1}" y="{ty + 1}" width="{ENC_TILE_W - 2}" height="{ENC_TILE_PREVIEW_H}" rx="{RADIUS_PANEL - 1}"/></clipPath>')
        o.append(f'<g clip-path="url(#tile-{i})">' + rect(tx, ty, ENC_TILE_W, ENC_TILE_PREVIEW_H + 1, fill='url(#stage-field)') + food_item(fid, tx + ENC_TILE_W / 2, ty + ENC_TILE_PREVIEW_H / 2) + '</g>')
        o.append(hline(tx, tx + ENC_TILE_W, ty + ENC_TILE_PREVIEW_H + 1))
        o.append(t(tx + SPACE_S + 2, ty + ENC_TILE_PREVIEW_H + 17, name if tw(name, 'body') < ENC_TILE_W - 16 else name.replace('Photosynthetic', 'Photosynth.'), 'body', TEXT))
        o.append(t(tx + SPACE_S + 2, ty + ENC_TILE_PREVIEW_H + 31, fact, 'label', LABEL, upper=False, weight='normal'))
        if i == 0:
            o.append(focus_ring(tx, ty, ENC_TILE_W, ENC_TILE_H, rx=RADIUS_PANEL))
    rows = math.ceil(len(FOOD_TILES) / per_row)
    cy += rows * (ENC_TILE_H + SPACE_M) + SPACE_L
    o.append(section_label(dx, cy + 10, 'Rules'))
    cy += 22
    # FOOD_CAP_BASE, FOOD_CAP_PER_PLAYER, FOOD_BLOOM_SPAWN_MULTIPLIER, DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER
    rules = [('Food cap', '600 + 100 per player'), ('Bloom', 'Food spawns ×1.5, DNA fragments ×2')]
    for r, (k, v) in enumerate(rules):
        ry = cy + r * 28
        o.append(t(dx, ry + 19, k, 'body', LABEL))
        o.append(t(dx + min(dw, ENC_PROSE_MAX_W), ry + 19, v, 'body', TEXT, anchor='end'))
        o.append(hline(dx, dx + min(dw, ENC_PROSE_MAX_W), ry + 28, opacity=0.6))
    return ''.join(o)


def frame_b_trait(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'traits')
    o = [shell, enc_trait_list(x + ENC_RAIL_W, by, bh)]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    cy = by + PANEL_PAD + 8
    o.append(preview_stage(dx, cy, ENC_LENS_D, ENC_LENS_D, tier=1, clip_id='lens-clip', round_lens=True))
    sw_svg, sww = tier_switch(dx + ENC_LENS_D / 2 - 54, cy + ENC_LENS_D + SPACE_L)
    o.append(sw_svg)
    rx = dx + ENC_LENS_D + 40
    rw = dw - ENC_LENS_D - 40
    svg, th = entry_title(rx, cy - 12, chips_below=True)
    o.append(svg)
    ty = cy - 12 + th + SPACE_XL
    svg, eh = effects_table(rx, ty, rw)
    o.append(svg)
    ty += eh + SPACE_XL
    svg, fh = facts_list(rx, ty, rw)
    o.append(svg)
    py = max(cy + ENC_LENS_D + SPACE_L + BUTTON_COMPACT_H, ty + fh) + SPACE_XL
    svg, ph = prose(dx, py, min(dw, ENC_PROSE_MAX_W + 120))
    o.append(svg)
    svg, _ = see_also(dx, py + ph + SPACE_S, dw)
    o.append(svg)
    return ''.join(o)


def frame_c_trait(uw, uh):
    x, y, w, h = enc_frame(uw, uh)
    o = [scrim(uw, uh, ENCYCLOPEDIA_SCRIM_ALPHA), modal_panel(x, y, w, h), enc_header(x, y, w)]
    ty = y + ENC_HEADER_H + 1
    o.append(rect(x + 1, ty, w - 2, ENC_TABS_H, fill=CALLOUT, fill_opacity=WELL_ALPHA))
    o.append(hline(x, x + w, ty + ENC_TABS_H))
    tx = x + PANEL_PAD
    for cid, name, count in CATEGORIES:
        sel = cid == 'traits'
        lw = tw(name, 'body') + 16 + SPACE_S + 2 * SPACE_M
        o.append(rail_icon(cid, tx + SPACE_M + 8, ty + ENC_TABS_H / 2, ACCENT if sel else LABEL))
        o.append(t(tx + SPACE_M + 16 + SPACE_S, ty + ENC_TABS_H / 2 + 5, name, 'body', TEXT if sel else LABEL, weight='bold' if sel else None))
        if sel:
            o.append(rect(tx, ty + ENC_TABS_H - SELECTION_BAR, lw, SELECTION_BAR, fill=ACCENT))
        tx += lw + SPACE_XS
    by = ty + ENC_TABS_H + 1
    dx, dw = x + PANEL_PAD, w - 2 * PANEL_PAD
    cy = by + PANEL_PAD
    hero_h = 300
    o.append(preview_stage(dx, cy, dw, hero_h, tier=1, clip_id='hero-clip', show_scale=False))
    o.append(rect(dx + 1, cy + hero_h - 110, dw - 2, 109, fill='url(#hero-fade)'))
    sw_svg, _ = tier_switch(dx + dw - SPACE_L - 108, cy + hero_h - SPACE_L - BUTTON_COMPACT_H)
    o.append(sw_svg)
    for side, label in (('left', '‹  Ribosome Studs'), ('right', 'Chloroplast  ›')):
        bw = tw(label, 'body') + 2 * SPACE_M
        bx = dx + SPACE_M if side == 'left' else dx + dw - SPACE_M - bw
        o.append(rect(bx, cy + SPACE_M, bw, BUTTON_COMPACT_H, rx=RADIUS_CONTROL, fill=CALLOUT, fill_opacity=0.75, stroke=PANEL_RIM))
        o.append(t(bx + SPACE_M, cy + SPACE_M + 19, label, 'body', TEXT))
    svg, _ = entry_title(dx + PANEL_PAD, cy + hero_h - 76)
    o.append(svg)
    cy += hero_h + SPACE_XL
    col_w = (dw - 2 * 40) / 3
    svg, _ = effects_table(dx, cy, col_w)
    o.append(svg)
    svg, _ = facts_list(dx + col_w + 40, cy, col_w)
    o.append(svg)
    px_ = dx + 2 * (col_w + 40)
    o.append(section_label(px_, cy + 10, 'About'))
    svg, ph = prose(px_, cy + 22, col_w)
    o.append(svg)
    svg, _ = see_also(px_, cy + 22 + ph, col_w)
    o.append(svg)
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------

def extra_defs():
    return ('<defs>'
            f'<linearGradient id="ui-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}"/><stop offset="1" stop-color="{PANEL_BOTTOM}"/></linearGradient>'
            '<radialGradient id="stage-field" cx="0.45" cy="0.4" r="0.8"><stop offset="0" stop-color="#0b1626"/><stop offset="1" stop-color="#04070d"/></radialGradient>'
            '<radialGradient id="lens-vignette"><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>'
            f'<linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{CALLOUT}" stop-opacity="0"/><stop offset="1" stop-color="{CALLOUT}" stop-opacity="0.85"/></linearGradient>'
            '</defs>')


def hud_scale(vw, vh):
    return min(SCALE_MAX, max(SCALE_MIN, min(vw / HUD_REFERENCE[0], vh / HUD_REFERENCE[1])))


def compose(vw, vh, ui):
    s = hud_scale(vw, vh)
    uw, uh = vw / s, vh / s
    body = game_background(vw, vh) + f'<g transform="scale({s:.4f})">' + hud_chrome(uw, uh) + ui(uw, uh) + '</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{vw}" height="{vh}" viewBox="0 0 {vw} {vh}">'
            f'{kit.defs()}{extra_defs()}{body}</svg>')


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    menu = lambda uw, uh: scrim(uw, uh, MENU_SCRIM_ALPHA) + esc_menu(uw, uh)  # noqa: E731
    frames = [
        ('esc-menu', menu, ((1920, 1080), (1280, 800))),
        ('encyclopedia-a-trait', frame_a_trait, ((1920, 1080), (1280, 800))),
        ('encyclopedia-a-category', frame_a_category, ((1920, 1080), (1280, 800))),
        ('encyclopedia-b-trait', frame_b_trait, ((1920, 1080),)),
        ('encyclopedia-c-trait', frame_c_trait, ((1920, 1080),)),
    ]
    for name, ui, sizes in frames:
        for vw, vh in sizes:
            path = out / f'{name}-{vw}x{vh}.svg'
            path.write_text(compose(vw, vh, ui), encoding='utf-8')
            print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

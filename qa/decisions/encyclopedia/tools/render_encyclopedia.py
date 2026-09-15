#!/usr/bin/env python3
"""Encyclopedia, ESC menu and UI kit mockups (#354): the first full UI surface and the kit it sets.

Frames (1920x1080 is UI scale 1.35, 1280x800 is scale 1):
  esc-menu                  the ESC menu over the live round                              1920, 1280
  esc-menu-alert            the menu with the offer alert strip up                        1280
  esc-menu-confirm          the menu with Exit game's confirm row, focus on Cancel        1280
  encyclopedia-a-trait      option A (atlas) on Mitochondrion                             1920, 1280
  encyclopedia-a-category   option A on the Cells & food landing                          1920, 1280
  encyclopedia-a-long-trait option A on Diatom Shell, scrolled to its end (sticky title)   1280
  encyclopedia-b-trait      option B (eyepiece)                                           1920, 1280
  encyclopedia-c-trait      option C (codex)                                              1920, 1280
  kit-states                every kit component in every state                            1280

Sizes are docs/ui/components-and-constants.md §10 and docs/ui/encyclopedia.md §11 constants at scale 1, drawn in
scale-1 units inside one scale(s) group. Colours are docs/visual-style roles, type is ui-type.md §7's roles. Text is
measured from the fallback faces the SVGs render in (Liberation Sans, DejaVu Sans Mono), so chips and buttons are
their content plus padding and cut text ends in an ellipsis. Trait facts are the shipped tier rows
(`trait-modifiers.ts`) through the card label table. Rows and tiles show code-drawn glyph medallions (build 1; stills
are #378). Reuses the #143 dish and cell kit (qa/decisions/hud-layout/tools/render.py). Seeded.
"""
import math
import random
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'hud-layout' / 'tools'))
import render as kit  # noqa: E402

from render import (  # noqa: E402
    ACCENT, DANGER, DNA, GOLD, LABEL, MITO_BASE, MITO_LIGHT, MUTED, PANEL_BOTTOM, PANEL_RIM, PANEL_TOP, TEXT, WHITE,
    CHLORO_BASE, CHLORO_LIGHT, CHLORO_DARK, NUCLEOID_STRAND, esc,
)

CALLOUT = '#04070d'  # CALLOUT_BACKING = BG_DEEP (principles-and-palette.md §2)
TAG_METABOLIC, TAG_ARMORED = '#ffb15a', '#e6ecf2'
SANS = "Inter, 'Liberation Sans', sans-serif"
MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace"
ROLES = {  # role: (px, face, weight, uppercase, tracking em) — ui-type.md §7
    'headline': (26, SANS, 'bold', False, 0), 'title': (22, SANS, 'bold', False, 0.02),
    'card_name': (16, SANS, 'bold', False, 0), 'body': (14, SANS, 'normal', False, 0),
    'figure': (14, MONO, 'normal', False, 0), 'label': (12, SANS, 'bold', True, 0.08),
    'label_mixed': (12, SANS, 'normal', False, 0.08), 'caption': (11, SANS, 'bold', True, 0.08),
    'clock': (24, MONO, 'bold', False, 0),
}


# ---------------------------------------------------------------------------------------------------------------------
# text measurement from the faces the SVGs render in

class Face:
    def __init__(self, path):
        data = Path(path).read_bytes()
        tables = {}
        for i in range(struct.unpack('>H', data[4:6])[0]):
            tag, _sum, offset, _len = struct.unpack('>4sIII', data[12 + 16 * i:28 + 16 * i])
            tables[tag.decode('latin-1')] = offset
        head, hhea, hmtx, cmap = tables['head'], tables['hhea'], tables['hmtx'], tables['cmap']
        self.units = struct.unpack('>H', data[head + 18:head + 20])[0]
        metrics = struct.unpack('>H', data[hhea + 34:hhea + 36])[0]
        self.advances = [struct.unpack('>H', data[hmtx + 4 * i:hmtx + 4 * i + 2])[0] for i in range(metrics)]
        self.glyphs = {}
        for i in range(struct.unpack('>H', data[cmap + 2:cmap + 4])[0]):
            platform, _enc, offset = struct.unpack('>HHI', data[cmap + 4 + 8 * i:cmap + 12 + 8 * i])
            sub = cmap + offset
            if platform != 3 or struct.unpack('>H', data[sub:sub + 2])[0] != 4:
                continue
            seg2 = struct.unpack('>H', data[sub + 6:sub + 8])[0]
            seg = seg2 // 2
            ends = struct.unpack(f'>{seg}H', data[sub + 14:sub + 14 + seg2])
            starts = struct.unpack(f'>{seg}H', data[sub + 16 + seg2:sub + 16 + 2 * seg2])
            deltas = struct.unpack(f'>{seg}h', data[sub + 16 + 2 * seg2:sub + 16 + 3 * seg2])
            range_at = sub + 16 + 3 * seg2
            ranges = struct.unpack(f'>{seg}H', data[range_at:range_at + seg2])
            for s in range(seg):
                for code in range(starts[s], min(ends[s], 0x3000) + 1):
                    if ranges[s] == 0:
                        glyph = (code + deltas[s]) & 0xFFFF
                    else:
                        at = range_at + 2 * s + ranges[s] + 2 * (code - starts[s])
                        glyph = struct.unpack('>H', data[at:at + 2])[0]
                        glyph = (glyph + deltas[s]) & 0xFFFF if glyph else 0
                    self.glyphs[code] = glyph
            break

    def width(self, text, px):
        last = len(self.advances) - 1
        return sum(self.advances[min(self.glyphs.get(ord(ch), 0), last)] for ch in text) * px / self.units


FONTS = '/usr/share/fonts/truetype'
FACES = {('sans', 'normal'): Face(f'{FONTS}/liberation/LiberationSans-Regular.ttf'),
         ('sans', 'bold'): Face(f'{FONTS}/liberation/LiberationSans-Bold.ttf'),
         ('mono', 'normal'): Face(f'{FONTS}/dejavu/DejaVuSansMono.ttf'),
         ('mono', 'bold'): Face(f'{FONTS}/dejavu/DejaVuSansMono-Bold.ttf')}


def tw(s, role, weight=None, upper=None):
    px, face, w, up, tr = ROLES[role]
    s = s.upper() if (up if upper is None else upper) else s
    return FACES[('mono' if face == MONO else 'sans', weight or w)].width(s, px) + tr * px * len(s)


def ellipsize(s, role, max_w, weight=None, upper=None):
    if tw(s, role, weight, upper) <= max_w:
        return s
    while s and tw(s + '…', role, weight, upper) > max_w:
        s = s[:-1]
    return s.rstrip() + '…'


def t(x, y, s, role, fill, anchor='start', weight=None, upper=None, opacity=1.0):
    px, face, w, up, tr = ROLES[role]
    if up if upper is None else upper:
        s = s.upper()
    ls = f' letter-spacing="{tr * px:.2f}"' if tr else ''
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{face}" font-size="{px}" font-weight="{weight or w}" '
            f'fill="{fill}" text-anchor="{anchor}"{ls} opacity="{opacity}" xml:space="preserve">{esc(s)}</text>')


# ---- kit tokens (components-and-constants.md §10.1), px at scale 1 ----
SPACE_XS, SPACE_S, SPACE_M, SPACE_L, SPACE_XL = 4, 8, 12, 16, 24
RADIUS_CONTROL, RADIUS_PANEL = 4, 8
BUTTON_H, BUTTON_COMPACT_H, BUTTON_PAD = 40, 28, 16
COMPACT_PAD = 12
ROW_H, RAIL_ROW_H, MEDALLION, MEDALLION_CARD = 40, 36, 24, 56
FACT_ROW_H, MARKER = 26, 8
SELECTION_BAR = 3
HOVER_ALPHA, SELECTED_ALPHA, PRESSED_ALPHA = 0.06, 0.12, 0.18
WELL_ALPHA, DISABLED_ALPHA, DANGER_RIM_ALPHA = 0.45, 0.45, 0.7
SCROLLBAR, SCROLL_FADE = 8, 16
KEY_HINT_H, CHIP_H, CHIP_PAD = 18, 20, 8
PANEL_PAD = 24
FOCUS_RING = 2
SEARCH_W, SEARCH_H = 280, 32
MENU_SCRIM_ALPHA, ENCYCLOPEDIA_SCRIM_ALPHA = 0.5, 0.8
SIDE_PANEL_W, SIDE_PANEL_ALPHA = 360, 0.86

# ---- menu (overlays.md §3.5) ----
MENU_W, MENU_TRAIT_ROW_H, MENU_TRAIT_LINE_H, ALERT_H = 400, 48, 16, 28

# ---- encyclopedia (encyclopedia.md §11.7) ----
ENC_INSET, ENC_MAX_W, ENC_MAX_H, ENC_HEADER_H = 32, 1360, 880, 56
ENC_RAIL_W, ENC_LIST_W = 184, 280
ENC_PREVIEW_W, ENC_PREVIEW_H = 704, 220
ENC_PROSE_MAX_W = 640
ENC_TILE_W, ENC_TILE_H, ENC_TILE_WELL_H = 168, 132, 96
ENC_TABS_H, ENC_LENS_D, ENC_HERO_H = 44, 300, 300
ENC_LENS_GAP, ENC_CONTENT_MAX_W, ENC_STICKY_H = 32, 884, 48  # option B (#368): encyclopedia.md §11.7

HUD_REFERENCE = (1280, 800)
SCALE_MIN, SCALE_MAX = 0.8, 1.5

CATEGORIES = [  # #358's six, labels and order from encyclopedia.md §11.2; counts illustrate entriesIn(category)
    ('basics', 'Basics', 13), ('entities', 'Cells & food', 10), ('evolutions', 'Evolution', 28),
    ('abilities', 'Abilities', 11), ('actions', 'Actions', 8), ('world', 'World', 8),
]

TRAIT_GROUPS = [  # catalog order under TRAIT_CATEGORY; stages sit above (scrolled past), DNA tags below
    ('GENOME', [('nucleoid', 'Nucleoid Coil'), ('nuclear_envelope', 'Nuclear Envelope')]),
    ('LOCOMOTION', [('simple_flagellum', 'Simple Flagellum'), ('cytoskeleton', 'Cytoskeleton Lattice'), ('cilia', 'Cilia Fringe')]),
    ('MEMBRANE', [('cell_wall', 'Cell Wall')]),
    ('METABOLISM', [('ribosomes', 'Ribosome Studs'), ('mitochondrion', 'Mitochondrion'), ('chloroplast', 'Chloroplast'),
                    ('food_vacuole', 'Food Vacuole')]),
    ('OFFENSE', [('toxin_vacuole', 'Toxin Vacuole')]),
    ('FORM', [('amoeba_pseudopods', 'Amoeba Pseudopods'), ('paramecium_cilia', 'Paramecium Cilia'),
              ('euglena_eyespot', 'Euglena Eyespot'), ('diatom_shell', 'Diatom Shell'), ('stentor_trumpet', 'Stentor Trumpet')]),
]
OWNED_TIERS = {'nucleoid': 'I', 'simple_flagellum': 'I', 'mitochondrion': 'I'}

MITO = {  # MITOCHONDRION_TIERS: decayMultiplier 0.85/0.70/0.55, sprintSpeedMultiplierBonus 0.1/0.2/0.3
    'id': 'mitochondrion', 'crumb': 'Evolution  ›  Metabolism', 'title': 'Mitochondrion', 'rarity': 'uncommon',
    'tags': [('Metabolic', TAG_METABOLIC)], 'stage': 'Prokaryote', 'owned': 1, 'tiers': 3,
    'effects': [('Mass decay', ['−15 %', '−30 %', '−45 %']), ('Sprint speed', ['+10 %', '+20 %', '+30 %'])],
    'facts': [('Unlock', 'Eat 10 aerobic bacteria', True), ('Offered from', 'Prokaryote', True),
              ('Climbs to', 'Endosymbiosis', True), ('DNA tag', 'Metabolic', False)],
    'prose': [[('The powerhouse. Surplus mass burns slower, and every sprint hits harder while the beans pulse.', False)],
              [('Aerobic bacteria', True), (' cluster at the ', False), ('warm vent', True),
               ('. Eat 10 and Mitochondrion joins your next ', False), ('draft', True), ('.', False)]],
    'see': ['Chloroplast', 'Mass decay', 'Sprint', 'Endosymbiosis'], 'preview': 'mito',
}
DIATOM = {  # DIATOM_SHELL_TIERS: absorbDurationMultiplierAsPrey 1.4/1.8/2.2, spikeDrain 0.02/0.04/0.06, speed 0.97/0.94/0.91
    'id': 'diatom_shell', 'crumb': 'Evolution  ›  Form', 'title': 'Diatom Shell', 'rarity': 'uncommon',
    'tags': [('Armored', TAG_ARMORED)], 'stage': 'Eukaryote', 'owned': None, 'tiers': 3,
    'effects': [('Time to absorb you', ['+40 %', '+80 %', '+120 %']), ('Spine drain', ['2 % / s', '4 % / s', '6 % / s']),
                ('Speed', ['−3 %', '−6 %', '−9 %'])],
    'facts': [('Requires', 'Cell Wall', True), ('Offered from', 'Eukaryote', True), ('Climbs to', 'Specialised', True),
              ('Body plan', 'One form per cell', False), ('DNA tag', 'Armored', False)],
    'prose': [[('A glass house bristling with spines. Whatever tries to swallow you takes far longer, and bleeds for '
                'it while it holds on.', False)],
              [('Only a cell that already grew a ', False), ('Cell Wall', True), (' can build one. It is a ', False),
               ('form', True), (', so it replaces any other body plan, and the weight of the glass costs a little ', False),
               ('speed', True), ('.', False)],
              [('Each tier grows more spines and a thicker wall. A predator that starts to ', False), ('engulf', True),
               (' you pays for every moment it holds on, so the shell turns a sure meal into a costly one, and a cell '
                'behind you thinks twice before it tries.', False)],
              [('Like every trait you own, the shell stays with you through a ', False), ('respawn', True),
               ('. Losing a fight costs mass and some DNA, never the glass you built.', False)]],
    'see': ['Cell Wall', 'Spines', 'Engulf', 'Specialised', 'Amoeba Pseudopods'], 'preview': 'diatom',
}

ENTITY_TILES = [  # (subject, title, facts[0]); CELL_STARTING_MASS, WILD_CELL_COUNT, the ecology masses and DNA
    ('cells', [('player_cell', 'Player cell', 'Starts at 20 mass'), ('wild_cell', 'Wild cell', '24 in the dish')]),
    ('food', [('food', 'Food', 'Cap 600 + 100 per player'), ('algae', 'Algae mote', '+1 mass'),
              ('bacterium', 'Bacterium', '+3 mass · +1 DNA'), ('bacterium_plain', 'Plain bacterium', '+3 mass · +1 DNA'),
              ('bacterium_aerobic', 'Aerobic bacterium', '+3 mass · +1 DNA'),
              ('bacterium_photosynthetic', 'Photosynthetic bacterium', '+3 mass · +1 DNA'),
              ('detritus', 'Detritus', '+2 mass'), ('dna_fragment', 'DNA fragment', '+5 DNA')]),
]


# ---------------------------------------------------------------------------------------------------------------------
# primitives (scale-1 units)

def rect(x, y, w, h, fill='none', rx=0, stroke=None, sw=1, opacity=1.0, fill_opacity=None, stroke_opacity=None):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    so = f' stroke-opacity="{stroke_opacity}"' if stroke_opacity is not None else ''
    fo = f' fill-opacity="{fill_opacity}"' if fill_opacity is not None else ''
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{fo}{st}{so} opacity="{opacity}"/>'


def hline(x1, x2, y, col=PANEL_RIM, opacity=1.0):
    return f'<line x1="{x1:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y:.1f}" stroke="{col}" stroke-width="1" opacity="{opacity}"/>'


def vline(x, y1, y2, col=PANEL_RIM):
    return f'<line x1="{x:.1f}" y1="{y1:.1f}" x2="{x:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="1"/>'


def focus_ring(x, y, w, h, rx=RADIUS_CONTROL, inside=False):
    """UI_FOCUS_RING_PX in the text colour, UI_FOCUS_RING_OFFSET_PX outside (inside where a scroll area clips)."""
    off = -FOCUS_RING / 2 - 2 if inside else FOCUS_RING / 2 + 2
    return rect(x - off, y - off, w + 2 * off, h + 2 * off, rx=rx + (0 if inside else 2), stroke=TEXT, sw=FOCUS_RING)


def modal_panel(x, y, w, h):
    return (rect(x, y, w, h, fill='url(#ui-panel)', rx=RADIUS_PANEL, stroke=PANEL_RIM)
            + rect(x + RADIUS_PANEL, y + 1, w - 2 * RADIUS_PANEL, 1, fill=WHITE, opacity=0.05))


def keycap(x, cy, label, anchor='end'):
    w = max(KEY_HINT_H, tw(label, 'caption') + 2 * 5)
    x0 = x - w if anchor == 'end' else x
    return (rect(x0, cy - KEY_HINT_H / 2, w, KEY_HINT_H, rx=3, stroke=PANEL_RIM, fill=CALLOUT, fill_opacity=WELL_ALPHA)
            + t(x0 + w / 2, cy + 4, label, 'caption', MUTED, anchor='middle')), w


BUTTON_TONES = {  # fill colour, fill alpha, rim colour, rim alpha, label colour, label weight
    'primary': (ACCENT, 0.16, ACCENT, 0.7, TEXT, 'bold'), 'secondary': (TEXT, 0.04, PANEL_RIM, 1.0, TEXT, None),
    'danger': (DANGER, 0.0, DANGER, DANGER_RIM_ALPHA, TEXT, None), 'quiet': (TEXT, 0.0, None, 0, LABEL, None),
    'icon': (TEXT, 0.04, PANEL_RIM, 1.0, LABEL, None),
}


def button_width(label, variant='secondary', hint=None, compact=False):
    pad = COMPACT_PAD if compact else BUTTON_PAD
    w = tw(label, 'body', weight=BUTTON_TONES[variant][5]) + 2 * pad
    if hint:
        w += SPACE_M + keycap(0, 0, hint)[1]
    return w


def button(x, y, label, variant='secondary', w=None, hint=None, state='rest', compact=False, icon=None):
    h = BUTTON_COMPACT_H if compact else BUTTON_H
    if variant == 'icon':
        w = h
    w = w or button_width(label, variant, hint, compact)
    fill, fop, rim, rop, col, weight = BUTTON_TONES[variant]
    o = [f'<g opacity="{DISABLED_ALPHA if state == "disabled" else 1}">', rect(x, y, w, h, fill=fill, fill_opacity=fop, rx=RADIUS_CONTROL)]
    if state in ('hover', 'pressed'):
        o.append(rect(x, y, w, h, fill=TEXT, fill_opacity=HOVER_ALPHA if state == 'hover' else PRESSED_ALPHA, rx=RADIUS_CONTROL))
    if rim:
        o.append(rect(x + 0.5, y + 0.5, w - 1, h - 1, rx=RADIUS_CONTROL, stroke=rim, stroke_opacity=rop))
    if icon == 'back':
        o.append(f'<path d="M{x + w / 2 + 3:.1f},{y + h / 2 - 6:.1f} l-6,6 l6,6" fill="none" stroke="{LABEL}" stroke-width="1.6" stroke-linecap="round"/>')
    elif icon == 'close':
        cx, cy = x + w / 2, y + h / 2
        o.append(f'<path d="M{cx - 5:.1f},{cy - 5:.1f} L{cx + 5:.1f},{cy + 5:.1f} M{cx + 5:.1f},{cy - 5:.1f} L{cx - 5:.1f},{cy + 5:.1f}" stroke="{LABEL}" stroke-width="1.6" stroke-linecap="round"/>')
    elif icon == 'play':
        o.append(f'<path d="M{x + w / 2 - 4:.1f},{y + h / 2 - 6:.1f} l10,6 l-10,6 z" fill="{LABEL}"/>')
    else:
        pad = COMPACT_PAD if compact else BUTTON_PAD
        o.append(t(x + pad, y + h / 2 + 5, label, 'body', col, weight=weight))
    if hint:
        o.append(keycap(x + w - SPACE_M, y + h / 2, hint)[0])
    o.append('</g>')
    if state == 'focus':
        o.append(focus_ring(x, y, w, h))
    return ''.join(o), w


RARITY_TONE = {'common': (MUTED, MUTED), 'uncommon': (LABEL, TEXT), 'rare': (DNA, DNA)}  # rim, text: never the accent


def chip(x, y, label, dot=None, rim=PANEL_RIM, col=LABEL):
    w = tw(label, 'label') + 2 * CHIP_PAD + (10 if dot else 0)
    o = [rect(x, y, w, CHIP_H, rx=CHIP_H / 2, stroke=rim, fill=CALLOUT, fill_opacity=0.35)]
    tx = x + CHIP_PAD
    if dot:
        o.append(f'<circle cx="{tx + 3.5:.1f}" cy="{y + CHIP_H / 2:.1f}" r="3.5" fill="{dot}"/>')
        tx += 10
    o.append(t(tx, y + CHIP_H / 2 + 4.2, label, 'label', col))
    return ''.join(o), w


def link_chip(x, y, label, state='rest'):
    w = tw(label, 'body') + 2 * COMPACT_PAD
    o = [rect(x, y, w, BUTTON_COMPACT_H, rx=RADIUS_CONTROL, stroke=PANEL_RIM, fill=TEXT, fill_opacity=0.03 + (HOVER_ALPHA if state == 'hover' else 0)),
         t(x + COMPACT_PAD, y + 19, label, 'body', ACCENT)]
    if state == 'focus':
        o.append(focus_ring(x, y, w, BUTTON_COMPACT_H))
    return ''.join(o), w


def alert_pill(x, y, words, seconds=None, tone=DANGER, w=None, keys=None):
    """The alert strip (encyclopedia.md §11.1): label WHITE, a tone dot and rim; a countdown in figure."""
    text_w = tw(words, 'label') + (SPACE_S + tw(seconds, 'figure') if seconds else 0)
    w = w or text_w + 2 * SPACE_M + 12
    o = [rect(x, y, w, ALERT_H, rx=ALERT_H / 2, fill=CALLOUT, fill_opacity=0.75, stroke=tone),
         f'<circle cx="{x + SPACE_M + 4:.1f}" cy="{y + ALERT_H / 2:.1f}" r="4" fill="{tone}"/>',
         t(x + SPACE_M + 14, y + ALERT_H / 2 + 4.5, words, 'label', WHITE)]
    if seconds:
        o.append(t(x + SPACE_M + 14 + tw(words, 'label') + SPACE_S, y + ALERT_H / 2 + 5, seconds, 'figure', WHITE))
    if keys:
        kx = x + w - SPACE_M
        for key in reversed(keys):
            svg, kw = keycap(kx, y + ALERT_H / 2, key)
            o.append(svg)
            kx -= kw + SPACE_XS
    return ''.join(o), w


def wrap_parts(parts, max_w, role='body'):
    """Word wrap over (text, is_link) runs, with text-wrap: pretty's no-orphan rule on the last line."""
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
    if len(lines) > 1 and sum(1 for w, _ in lines[-1] if w.strip(' .,')) <= 1:  # text-wrap: pretty, no orphan
        while lines[-2] and not lines[-2][-1][0].strip():
            lines[-2].pop()
        moved = lines[-2].pop()
        first, first_link = lines[-1][0]
        lines[-1] = [(moved[0].lstrip(' '), moved[1]), (first if first.startswith((' ', '.', ',')) else ' ' + first, first_link)] + lines[-1][1:]
    return lines


def rich(x, y, parts, role='body'):
    px, face, weight, _up, _tr = ROLES[role]
    spans = []
    for s, is_link in parts:
        if not s:
            continue
        if is_link:
            spans.append(f'<tspan fill="{ACCENT}" text-decoration="underline">{esc(s)}</tspan>')
        else:
            spans.append(f'<tspan fill="{TEXT}">{esc(s)}</tspan>')
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{face}" font-size="{px}" font-weight="{weight}" '
            f'xml:space="preserve">' + ''.join(spans) + '</text>')


def scrollbar(x, y, h, thumb_from, thumb_frac):
    return (rect(x + 1, y, SCROLLBAR - 2, h, rx=3, fill=CALLOUT, fill_opacity=0.4)
            + rect(x + 1, y + h * thumb_from, SCROLLBAR - 2, h * thumb_frac, rx=3, fill=PANEL_RIM)
            + rect(x + 1, y + h * thumb_from, SCROLLBAR - 2, h * thumb_frac, rx=3, fill=MUTED, opacity=0.35))


def fade(x, y, w, h, direction='down', colour=PANEL_BOTTOM):
    gid = f'fade-{direction}'
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="url(#{gid})"/>'.replace('PANEL', colour)


# ---------------------------------------------------------------------------------------------------------------------
# glyphs (code-drawn medallion marks; the trait glyphs are #312's, these stand in)

def trait_glyph(kind, cx, cy, size=1.0):
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) scale({size:.2f})">']
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
    elif kind == 'simple_flagellum':
        g.append(f'<circle cx="-3" r="4" fill="none" stroke="{ACCENT}" stroke-width="1.2"/>'
                 f'<path d="M1,0 q2,-3 4,0 q2,3 4,0" fill="none" stroke="{WHITE}" stroke-width="1.2"/>')
    elif kind in ('cilia', 'paramecium_cilia'):
        g.append(f'<ellipse rx="{7 if kind == "paramecium_cilia" else 5}" ry="4.5" fill="none" stroke="{ACCENT}" stroke-width="1.2"/>')
        for i in range(12):
            a = math.tau * i / 12
            g.append(f'<line x1="{6.2 * math.cos(a):.1f}" y1="{5.6 * math.sin(a):.1f}" x2="{8.4 * math.cos(a):.1f}" y2="{7.6 * math.sin(a):.1f}" stroke="{WHITE}" stroke-width="0.8" opacity="0.8"/>')
    elif kind == 'cytoskeleton':
        for a in (0, 60, 120):
            g.append(f'<line x1="-7" y1="0" x2="7" y2="0" transform="rotate({a})" stroke="{ACCENT}" stroke-width="1.1"/>')
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
        g.append(f'<polygon points="{pts}" fill="none" stroke="{TAG_ARMORED}" stroke-width="1.2"/><circle r="2.5" fill="none" stroke="{TAG_ARMORED}" stroke-width="0.8"/>')
    elif kind == 'stentor_trumpet':
        g.append('<path d="M-2,7 L-1,-1 Q-7,-6 -7,-7 L7,-7 Q7,-6 1,-1 L2,7 Z" fill="none" stroke="#d05cff" stroke-width="1.1"/>')
    g.append('</g>')
    return ''.join(g)


def entity_glyph(kind, cx, cy, size=1.0):
    """A subject glyph for the non-trait marks: the code-drawn look of the thing, at medallion scale."""
    g = [f'<g transform="translate({cx:.1f},{cy:.1f}) scale({size:.3f})">']
    if kind in ('player_cell', 'wild_cell'):
        g.append(kit.cell(0, 0, 7, 'cyan' if kind == 'player_cell' else 'amber', 'prokaryote', random.Random(3)))
    elif kind in ('algae', 'food'):
        g.append('<circle r="9" fill="url(#halo-algal)"/><circle r="3.6" fill="url(#mote-algal)"/>')
        if kind == 'food':
            g.append('<g transform="translate(5,4) rotate(-20)"><ellipse rx="3.2" ry="2" fill="url(#mote-lipid)"/></g>'
                     f'<rect x="-8" y="3" width="6" height="3" rx="1.5" fill="{MITO_BASE}" transform="rotate(-25)"/>')
    elif kind.startswith('bacterium'):
        variant = kind.split('_')[1] if '_' in kind else 'plain'
        fill, rim = {'plain': (kit.BACT_PLAIN, kit.PROTO_FILM), 'aerobic': (MITO_BASE, MITO_LIGHT),
                     'photosynthetic': (CHLORO_BASE, CHLORO_LIGHT)}[variant]
        g.append(f'<rect x="-8" y="-4" width="16" height="8" rx="4" transform="rotate(-20)" fill="{fill}" fill-opacity="0.8" stroke="{rim}" stroke-width="1"/>')
    elif kind == 'detritus':
        g.append('<g transform="rotate(-20)"><ellipse rx="10" ry="6" fill="url(#halo-lipid)"/><ellipse rx="5" ry="3.2" fill="url(#mote-lipid)"/></g>')
    elif kind == 'dna_fragment':
        a = ' '.join(f'{v - 7:.1f},{2.6 * math.sin(v * 0.9):.1f}' for v in range(0, 15, 2))
        b = ' '.join(f'{v - 7:.1f},{-2.6 * math.sin(v * 0.9):.1f}' for v in range(0, 15, 2))
        g.append(f'<g transform="rotate(-20)"><polyline points="{a}" fill="none" stroke="{kit.DNA_STRAND_LIGHT}" stroke-width="1.4"/>'
                 f'<polyline points="{b}" fill="none" stroke="{DNA}" stroke-width="1.4"/></g>')
    g.append('</g>')
    return ''.join(g)


def medallion(cx, cy, kind, size=MEDALLION):
    r = size / 2
    scale = size / MEDALLION
    mark = trait_glyph(kind, cx, cy, 0.95 * scale) if kind in OWNED_TIERS or any(kind == k for _g, rows in TRAIT_GROUPS for k, _n in rows) \
        else entity_glyph(kind, cx, cy, 0.95 * scale)
    return (f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{CALLOUT}" fill-opacity="0.6" stroke="{PANEL_RIM}" stroke-width="1"/>' + mark)


def rail_icon(kind, cx, cy, col):
    o = [f'<g transform="translate({cx:.1f},{cy:.1f})" fill="none" stroke="{col}" stroke-width="1.3" stroke-linecap="round">']
    o.append({
        'basics': f'<circle r="6.5"/><line x1="0" y1="-0.5" x2="0" y2="3.5"/><circle cy="-3.2" r="0.7" fill="{col}"/>',
        'entities': '<circle cx="-3" cy="-2" r="2.2"/><circle cx="3" cy="-3" r="1.6"/><rect x="-3" y="2" width="8" height="3.4" rx="1.7"/>',
        'evolutions': '<polyline points="-7,6 -3,6 -3,1 1,1 1,-4 6,-4"/><polyline points="3,-6 6,-4 4,-1"/>',
        'abilities': '<path d="M1,-7 L-4,1 L0,1 L-1,7 L4,-1 L0,-1 Z"/>',
        'actions': '<circle cx="-3" cy="2" r="3.2"/><polyline points="0,-1 6,-6"/><polyline points="2,-6 6,-6 6,-2"/>',
        'world': '<circle r="6.5"/><path d="M-6.5,0 a6.5,6.5 0 0 0 13,0" stroke-dasharray="1.6 1.6"/><circle cx="1.5" cy="-1.5" r="1.6"/>',
    }[kind])
    o.append('</g>')
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------
# kit pieces with states

def rail_item(x, y, w, cid, name, count, state='rest'):
    o = []
    selected = state in ('selected', 'selected_focus')
    if selected:
        o += [rect(x, y, w, RAIL_ROW_H, fill=ACCENT, fill_opacity=SELECTED_ALPHA), rect(x, y, SELECTION_BAR, RAIL_ROW_H, fill=ACCENT)]
    elif state in ('hover', 'pressed'):
        o.append(rect(x, y, w, RAIL_ROW_H, fill=TEXT, fill_opacity=HOVER_ALPHA if state == 'hover' else PRESSED_ALPHA))
    o.append(rail_icon(cid, x + SPACE_L + 8, y + RAIL_ROW_H / 2, ACCENT if selected else LABEL))
    o.append(t(x + SPACE_L + 16 + SPACE_M, y + RAIL_ROW_H / 2 + 5, name, 'body', TEXT if state != 'rest' else LABEL, weight='bold' if selected else None))
    o.append(t(x + w - SPACE_L, y + RAIL_ROW_H / 2 + 5, str(count), 'figure', MUTED if state == 'rest' else LABEL, anchor='end'))
    if state == 'selected_focus':
        o.append(focus_ring(x, y, w, RAIL_ROW_H, rx=0, inside=True))
    return ''.join(o)


def list_row(x, y, w, kind, name, trailing=None, state='rest'):
    o = []
    if state in ('selected', 'selected_focus'):
        o += [rect(x, y, w, ROW_H, fill=ACCENT, fill_opacity=SELECTED_ALPHA), rect(x, y, SELECTION_BAR, ROW_H, fill=ACCENT)]
    elif state in ('hover', 'pressed'):
        o.append(rect(x, y, w, ROW_H, fill=TEXT, fill_opacity=HOVER_ALPHA if state == 'hover' else PRESSED_ALPHA))
    o.append(medallion(x + SPACE_L + MEDALLION / 2, y + ROW_H / 2, kind))
    name_w = w - 2 * SPACE_L - MEDALLION - SPACE_M - (32 if trailing else 0)
    o.append(t(x + SPACE_L + MEDALLION + SPACE_M, y + ROW_H / 2 + 5, ellipsize(name, 'body', name_w), 'body', TEXT,
               weight='bold' if state.startswith('selected') else None))
    if trailing:
        svg, cw = chip(0, 0, trailing, rim=GOLD, col=GOLD)
        o.append(chip(x + w - SPACE_L - cw, y + (ROW_H - CHIP_H) / 2, trailing, rim=GOLD, col=GOLD)[0])
    if state in ('focus', 'selected_focus'):
        o.append(focus_ring(x, y, w, ROW_H, rx=0, inside=True))
    return ''.join(o)


def tier_switch(x, y, count=3, selected=0, hovered=None, focused=None):
    seg_w = 36
    numerals = ['I', 'II', 'III', 'IV', 'V'][:count]
    o = [rect(x, y, seg_w * count, BUTTON_COMPACT_H, rx=RADIUS_CONTROL, fill=CALLOUT, fill_opacity=0.75, stroke=PANEL_RIM)]
    for i, lab in enumerate(numerals):
        sx = x + i * seg_w
        if i == selected:
            o += [rect(sx + 1, y + 1, seg_w - 2, BUTTON_COMPACT_H - 2, fill=ACCENT, fill_opacity=SELECTED_ALPHA),
                  rect(sx + 1, y + BUTTON_COMPACT_H - 1 - SELECTION_BAR, seg_w - 2, SELECTION_BAR, fill=ACCENT)]
        elif i == hovered:
            o.append(rect(sx + 1, y + 1, seg_w - 2, BUTTON_COMPACT_H - 2, fill=TEXT, fill_opacity=HOVER_ALPHA))
        o.append(t(sx + seg_w / 2, y + BUTTON_COMPACT_H / 2 + 4.5, lab, 'label', TEXT if i == selected else LABEL, anchor='middle'))
        if i == focused:
            o.append(focus_ring(sx, y, seg_w, BUTTON_COMPACT_H))
    return ''.join(o), seg_w * count


def search_field(x, y, query=None, focused=False):
    o = [rect(x, y, SEARCH_W, SEARCH_H, fill=CALLOUT, fill_opacity=WELL_ALPHA + 0.1, rx=RADIUS_CONTROL, stroke=PANEL_RIM),
         f'<circle cx="{x + 16}" cy="{y + 15}" r="5" fill="none" stroke="{MUTED}" stroke-width="1.4"/>'
         f'<line x1="{x + 19.5}" y1="{y + 18.5}" x2="{x + 23}" y2="{y + 22}" stroke="{MUTED}" stroke-width="1.4"/>']
    if query:
        o.append(t(x + 30, y + SEARCH_H / 2 + 5, query, 'body', TEXT))
        cx = x + 30 + tw(query, 'body') + 1
        o.append(f'<line x1="{cx:.1f}" y1="{y + 9}" x2="{cx:.1f}" y2="{y + 23}" stroke="{TEXT}" stroke-width="1.2"/>')
    else:
        o.append(t(x + 30, y + SEARCH_H / 2 + 5, 'Search', 'body', MUTED))
        o.append(keycap(x + SEARCH_W - SPACE_S, y + SEARCH_H / 2, '/')[0])
    if focused:
        o.append(focus_ring(x, y, SEARCH_W, SEARCH_H))
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------
# the live round behind the overlays

def game_background(vw, vh):
    k = max(vw / HUD_REFERENCE[0], vh / HUD_REFERENCE[1])
    dx, dy = (vw - HUD_REFERENCE[0] * k) / 2, (vh - HUD_REFERENCE[1] * k) / 2
    return f'<g transform="translate({dx:.1f},{dy:.1f}) scale({k:.4f})">{kit.scene(random.Random(42))}</g>'


def hud_chrome(uw, uh):
    """Compact leaderboard (hud.md §3.1.1) and the round clock; shown under the menu, hidden under the encyclopedia."""
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


def effect_lines(effects, max_w, separator=' · '):
    lines, cur = [], ''
    for run in effects.split(separator):
        candidate = run if not cur else cur + separator + run
        if cur and tw(candidate, 'label_mixed') > max_w:
            lines.append(cur)
            cur = run
        else:
            cur = candidate
    return lines + [cur]


def esc_menu(uw, uh, alert=False, confirm=False):
    ix_pad = PANEL_PAD
    iw = MENU_W - 2 * PANEL_PAD
    text_w = iw - MEDALLION - SPACE_M - SPACE_L
    wrapped = [(kind, name, effect_lines(effects, text_w)) for kind, name, effects in OWNED]
    row_hs = [MENU_TRAIT_ROW_H + MENU_TRAIT_LINE_H * (len(lines) - 1) for _k, _n, lines in wrapped]
    h = (PANEL_PAD + 22 + SPACE_S + 14 + 20 + (ALERT_H + SPACE_L if alert else 0) + 3 * BUTTON_H + 2 * SPACE_S + 20 + 1
         + SPACE_L + 12 + SPACE_S + sum(row_hs) + PANEL_PAD - SPACE_S)
    x, y = (uw - MENU_W) / 2, (uh - h) / 2
    ix = x + ix_pad
    o = [modal_panel(x, y, MENU_W, h)]
    cy = y + PANEL_PAD
    o.append(t(ix, cy + 18, 'Menu', 'title', TEXT))
    o.append(t(ix, cy + 22 + SPACE_S + 12, 'The dish keeps running.', 'body', MUTED))
    cy += 22 + SPACE_S + 14 + 20
    if alert:
        o.append(alert_pill(ix, cy, 'LEVEL 5 · CHOOSE A TRAIT ·', seconds='6.5 s', tone=GOLD, w=iw, keys=['1', '2', '3'])[0])
        cy += ALERT_H + SPACE_L
    o.append(button(ix, cy, 'Return to game', 'primary', w=iw, hint='ESC', state='rest' if confirm else 'focus')[0])
    cy += BUTTON_H + SPACE_S
    o.append(button(ix, cy, 'Encyclopedia', 'secondary', w=iw, hint='H')[0])
    cy += BUTTON_H + SPACE_S
    if confirm:
        o.append(rect(ix + 0.5, cy + 0.5, iw - 1, BUTTON_H - 1, rx=RADIUS_CONTROL, stroke=DANGER, stroke_opacity=DANGER_RIM_ALPHA, fill=DANGER, fill_opacity=0.06))
        o.append(t(ix + BUTTON_PAD, cy + BUTTON_H / 2 + 5, 'Leave this round?', 'body', TEXT))
        cancel_w = button_width('Cancel', compact=True)
        exit_w = button_width('Exit', 'danger', compact=True)
        by = cy + (BUTTON_H - BUTTON_COMPACT_H) / 2
        cancel_x = ix + iw - SPACE_S - cancel_w
        o.append(button(cancel_x - SPACE_S - exit_w, by, 'Exit', 'danger', compact=True)[0])
        o.append(button(cancel_x, by, 'Cancel', 'secondary', compact=True, state='focus')[0])
    else:
        o.append(button(ix, cy, 'Exit game', 'danger', w=iw)[0])
    cy += BUTTON_H + 20
    o.append(hline(x, x + MENU_W, cy))
    cy += 1 + SPACE_L
    o.append(t(ix, cy + 10, 'Your traits', 'label', LABEL))
    o.append(t(ix + iw, cy + 10, str(len(OWNED)), 'label', LABEL, anchor='end'))
    cy += 12 + SPACE_S
    for i, ((kind, name, lines), rh) in enumerate(zip(wrapped, row_hs)):
        if i == 2 and not (alert or confirm):
            o.append(rect(ix - SPACE_S, cy, iw + 2 * SPACE_S, rh, fill=TEXT, fill_opacity=HOVER_ALPHA, rx=RADIUS_CONTROL))
        o.append(medallion(ix + MEDALLION / 2, cy + rh / 2, kind))
        o.append(t(ix + MEDALLION + SPACE_M, cy + 20, name, 'body', TEXT, weight='bold'))
        for j, line in enumerate(lines):
            o.append(t(ix + MEDALLION + SPACE_M, cy + 37 + j * MENU_TRAIT_LINE_H, line, 'label_mixed', LABEL))
        o.append(t(ix + iw, cy + rh / 2 + 6, '›', 'card_name', LABEL, anchor='end'))
        cy += rh
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------
# encyclopedia pieces

def enc_frame(uw, uh):
    w = min(uw - 2 * ENC_INSET, ENC_MAX_W)
    h = min(uh - 2 * ENC_INSET, ENC_MAX_H)
    return (uw - w) / 2, (uh - h) / 2, w, h


def enc_header(x, y, w, alert=True, back_enabled=True):
    o = [hline(x, x + w, y + ENC_HEADER_H)]
    by = y + (ENC_HEADER_H - BUTTON_COMPACT_H - 4) / 2
    bx = x + SPACE_L
    o.append(button(bx, by, '', 'icon', icon='back', state='rest' if back_enabled else 'disabled')[0].replace(
        f'height="{BUTTON_COMPACT_H}', f'height="{BUTTON_COMPACT_H}'))
    title_x = bx + BUTTON_H + SPACE_M
    o.append(t(title_x, y + ENC_HEADER_H / 2 + 8, 'Encyclopedia', 'title', TEXT))
    sx = max(x + ENC_RAIL_W + ENC_LIST_W - SEARCH_W, title_x + tw('Encyclopedia', 'title') + SPACE_XL)
    o.append(search_field(sx, y + (ENC_HEADER_H - SEARCH_H) / 2))
    cbx = x + w - SPACE_L - BUTTON_H
    o.append(button(cbx, y + (ENC_HEADER_H - BUTTON_H) / 2, '', 'icon', icon='close')[0])
    kc, kw = keycap(cbx - SPACE_S, y + ENC_HEADER_H / 2, 'ESC')
    o.append(kc)
    if alert:
        words = 'AMOEBOID CAN ENGULF YOU'
        aw = tw(words, 'label') + 2 * SPACE_M + 14
        o.append(alert_pill(cbx - SPACE_S - kw - SPACE_M - aw, y + (ENC_HEADER_H - ALERT_H) / 2, words, tone=DANGER)[0])
    return ''.join(o)


def enc_rail(x, y, h, selected, state='selected'):
    o = [rect(x, y, ENC_RAIL_W, h, fill=CALLOUT, fill_opacity=WELL_ALPHA), vline(x + ENC_RAIL_W, y, y + h)]
    ry = y + SPACE_M
    for cid, name, count in CATEGORIES:
        o.append(rail_item(x, ry, ENC_RAIL_W, cid, name, count, state if cid == selected else 'rest'))
        ry += RAIL_ROW_H
    return ''.join(o)


def enc_trait_list(x, y, h, selected, hovered=None):
    o = [vline(x + ENC_LIST_W, y, y + h), t(x + SPACE_L, y + SPACE_L + 10, 'Evolution', 'label', LABEL),
         t(x + ENC_LIST_W - SPACE_L, y + SPACE_L + 10, '28', 'label', MUTED, anchor='end')]
    clip = f'list-clip-{int(x)}-{int(y)}'
    o.append(f'<clipPath id="{clip}"><rect x="{x}" y="{y + 40}" width="{ENC_LIST_W}" height="{h - 40}"/></clipPath><g clip-path="url(#{clip})">')
    groups = TRAIT_GROUPS
    if selected == 'diatom_shell':  # scrolled down to FORM
        groups = TRAIT_GROUPS[2:]
    ry = y + 40
    for group, rows in groups:
        o.append(t(x + SPACE_L, ry + 20, group, 'label', MUTED))
        ry += 28
        for tid, name in rows:
            state = 'selected' if tid == selected else ('hover' if tid == hovered else 'rest')
            o.append(list_row(x, ry, ENC_LIST_W - SCROLLBAR, tid, name, trailing=OWNED_TIERS.get(tid), state=state))
            ry += ROW_H
    o.append('</g>')
    thumb_from = 0.52 if selected == 'diatom_shell' else 0.22
    o.append(scrollbar(x + ENC_LIST_W - SCROLLBAR, y + 44, h - 52, thumb_from, 0.42))
    return ''.join(o)


def mito_beans(r, tier):
    beans = []
    for i in range(tier):
        a = math.radians(40 + 115 * i)
        bx, by = r * 0.58 * math.cos(a), r * 0.58 * math.sin(a)
        beans.append(f'<g transform="translate({bx:.1f},{by:.1f}) rotate({math.degrees(a) + 90:.0f})">'
                     f'<ellipse rx="{r * 0.26:.1f}" ry="{r * 0.34:.1f}" fill="url(#halo-mito)"/>'
                     f'<ellipse rx="{r * 0.2:.1f}" ry="{r * 0.1:.1f}" fill="{MITO_BASE}" stroke="{MITO_LIGHT}" stroke-width="1.2"/></g>')
    return ''.join(beans)


def diatom_shell(r, tier):
    spines = 8 + 4 * (tier - 1)
    pts = ' '.join(f'{r * 1.06 * math.cos(math.tau * i / 6 + 0.3):.1f},{r * 1.06 * math.sin(math.tau * i / 6 + 0.3):.1f}' for i in range(6))
    o = [f'<polygon points="{pts}" fill="none" stroke="{TAG_ARMORED}" stroke-width="2" opacity="0.85"/>']
    for i in range(spines):
        a = math.tau * i / spines
        o.append(f'<line x1="{r * 1.02 * math.cos(a):.1f}" y1="{r * 1.02 * math.sin(a):.1f}" x2="{r * 1.38 * math.cos(a):.1f}" '
                 f'y2="{r * 1.38 * math.sin(a):.1f}" stroke="{TAG_ARMORED}" stroke-width="1.4" opacity="0.8"/>'
                 f'<circle cx="{r * 1.4 * math.cos(a):.1f}" cy="{r * 1.4 * math.sin(a):.1f}" r="1.6" fill="{WHITE}"/>')
    return ''.join(o)


def preview_box(x, y, w, h, entry, clip_id, round_lens=False, rods=None, controls=True):
    rng = random.Random(7)
    cx, cy = x + w / 2, y + h / 2
    shape = f'<circle cx="{cx}" cy="{cy}" r="{w / 2}"/>' if round_lens else f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{RADIUS_PANEL}"/>'
    o = [f'<clipPath id="{clip_id}">{shape}</clipPath><g clip-path="url(#{clip_id})">', rect(x, y, w, h, fill='url(#stage-field)'),
         f'<ellipse cx="{x + w * 0.2:.1f}" cy="{y + h * 0.18:.1f}" rx="{w * 0.5:.1f}" ry="{h * 0.8:.1f}" fill="url(#light-pool)"/>']
    for _ in range(40):
        o.append(f'<circle cx="{rng.uniform(x, x + w):.1f}" cy="{rng.uniform(y, y + h):.1f}" r="{rng.uniform(0.5, 1.2):.1f}" fill="#9fc4de" opacity="{rng.uniform(0.08, 0.28):.2f}"/>')
    for bx, by, hd in rods or ((0.2, 0.3, 20), (0.8, 0.72, 160), (0.86, 0.26, 70), (0.3, 0.8, 110)):
        o.append(kit.bacterium(x + w * bx, y + h * by, hd, 'aerobic'))
    for mx, my in ((0.36, 0.7), (0.7, 0.2), (0.62, 0.85), (0.4, 0.15)):
        o.append(f'<circle cx="{x + w * mx:.1f}" cy="{y + h * my:.1f}" r="12" fill="url(#halo-algal)"/><circle cx="{x + w * mx:.1f}" cy="{y + h * my:.1f}" r="4" fill="url(#mote-algal)"/>')
    r = min(h, w) * (0.24 if entry['preview'] == 'diatom' else 0.27)
    body_x = cx
    if round_lens and entry['preview'] == 'mito':
        # §12.7 framing: the body inside the 0.8 safe circle, the tail into the vignette band but inside the rim
        r = w * 0.18
        body_x = cx - w * 0.13
    if entry['preview'] == 'mito':
        o.append(kit.flagellum(body_x, cy, r, 180) + kit.cell(body_x, cy, r, 'cyan', 'prokaryote', rng, heading=0, speed=0.25, extra_inside=mito_beans(r, 1)))
    else:
        o.append(kit.cell(cx, cy, r, 'cyan', 'euk', rng, heading=0, speed=0.0, extra_after=diatom_shell(r, 1)))
    o.append('</g>')
    if round_lens:
        rr = w / 2
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="none" stroke="{PANEL_RIM}" stroke-width="6"/>')
        for i in range(24):
            a = math.tau * i / 24
            ln = 10 if i % 6 == 0 else 5
            o.append(f'<line x1="{cx + (rr - 4) * math.cos(a):.1f}" y1="{cy + (rr - 4) * math.sin(a):.1f}" x2="{cx + (rr - 4 - ln) * math.cos(a):.1f}" y2="{cy + (rr - 4 - ln) * math.sin(a):.1f}" stroke="{LABEL}" stroke-width="1" opacity="0.6"/>')
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="url(#lens-vignette)"/>')
    else:
        o.append(rect(x + 0.5, y + 0.5, w - 1, h - 1, rx=RADIUS_PANEL, stroke=PANEL_RIM))
        if controls:
            o.append(tier_switch(x + SPACE_M, y + SPACE_M, entry['tiers'], selected=(entry['owned'] or 1) - 1)[0])
    return ''.join(o)


def entry_title(x, y, entry, max_w, chips_below=False):
    o = [t(x, y + 10, entry['crumb'], 'label', MUTED)]
    baseline = y + 10 + SPACE_M + 24
    o.append(t(x, baseline, entry['title'], 'headline', TEXT))
    chips = []
    rim, col = RARITY_TONE[entry['rarity']]
    chips.append((entry['rarity'].capitalize(), None, rim, col))
    for tag, dot in entry['tags']:
        chips.append((tag, dot, PANEL_RIM, LABEL))
    chips.append((entry['stage'], None, PANEL_RIM, LABEL))
    if entry['owned']:
        chips.append((f"Owned · {'I' * entry['owned']}", None, GOLD, GOLD))
    cx = x if chips_below else x + tw(entry['title'], 'headline') + SPACE_L
    cy = baseline + SPACE_M if chips_below else baseline - 17
    height = 10 + SPACE_M + 24 + (SPACE_M + CHIP_H if chips_below else SPACE_XS)
    for label, dot, rim, colour in chips:
        _svg, cw = chip(0, 0, label, dot=dot)
        if cx + cw > x + max_w:
            cx = x
            cy += CHIP_H + SPACE_S
            height += CHIP_H + SPACE_S
        o.append(chip(cx, cy, label, dot=dot, rim=rim, col=colour)[0])
        cx += cw + SPACE_S
    return ''.join(o), height


def effects_table(x, y, w, entry):
    col_w = max(68, max(tw(v, 'figure') for _n, vals in entry['effects'] for v in vals) + 2 * SPACE_S)
    name_w = w - entry['tiers'] * col_w
    owned = entry['owned']
    rows = entry['effects']
    o = [t(x, y + 10, 'Effects by tier', 'label', LABEL)]
    ty = y + 22
    if owned:
        o.append(rect(x + name_w + (owned - 1) * col_w, ty, col_w, FACT_ROW_H * (1 + len(rows)), fill=ACCENT, fill_opacity=0.08, rx=RADIUS_CONTROL))
        o.append(t(x, ty + 17, f"You own {'I' * owned}", 'label_mixed', MUTED))
    for i in range(entry['tiers']):
        o.append(t(x + name_w + i * col_w + col_w - SPACE_S, ty + 17, 'I' * (i + 1), 'label', ACCENT if owned == i + 1 else MUTED, anchor='end'))
    o.append(hline(x, x + w, ty + FACT_ROW_H))
    for r, (name, vals) in enumerate(rows):
        ry = ty + FACT_ROW_H * (r + 1)
        o.append(t(x, ry + 18, name, 'body', LABEL))
        for i, v in enumerate(vals):
            o.append(t(x + name_w + i * col_w + col_w - SPACE_S, ry + 18, v, 'figure', TEXT, anchor='end'))
        o.append(hline(x, x + w, ry + FACT_ROW_H, opacity=0.6))
    return ''.join(o), 22 + FACT_ROW_H * (1 + len(rows))


def facts_list(x, y, w, entry):
    o = [t(x, y + 10, 'Unlock and ladder', 'label', LABEL)]
    ty = y + 22
    for r, (k, v, is_link) in enumerate(entry['facts']):
        ry = ty + r * FACT_ROW_H
        o.append(t(x, ry + 18, k, 'body', LABEL))
        if is_link:
            o.append(f'<text x="{x + w:.1f}" y="{ry + 18:.1f}" font-family="{SANS}" font-size="14" fill="{ACCENT}" text-anchor="end" text-decoration="underline">{esc(v)}</text>')
        else:
            o.append(t(x + w, ry + 18, v, 'body', TEXT, anchor='end'))
        o.append(hline(x, x + w, ry + FACT_ROW_H, opacity=0.6))
    return ''.join(o), 22 + FACT_ROW_H * len(entry['facts'])


def prose(x, y, w, entry):
    o, ly = [], y
    for para in entry['prose']:
        for line in wrap_parts(para, w):
            o.append(rich(x, ly + 14, line))
            ly += 22
        ly += SPACE_S
    return ''.join(o), ly - y


def see_also(x, y, w, entry):
    o = [t(x, y + 10, 'See also', 'label', LABEL)]
    cx, cy = x, y + 22
    for name in entry['see']:
        _svg, cw = link_chip(0, 0, name)
        if cx + cw > x + w:
            cx, cy = x, cy + BUTTON_COMPACT_H + SPACE_S
        o.append(link_chip(cx, cy, name)[0])
        cx += cw + SPACE_S
    return ''.join(o), cy + BUTTON_COMPACT_H - y


def entry_body(dx, cy, dw, entry, clip_id):
    """Preview, facts, prose and See also, from cy down; returns (svg, height)."""
    start = cy
    content_w = min(dw, ENC_PREVIEW_W)
    o = [preview_box(dx, cy, ENC_PREVIEW_W, ENC_PREVIEW_H, entry, clip_id)]
    cy += ENC_PREVIEW_H + SPACE_XL
    col_w = (content_w - SPACE_XL) / 2
    svg, eh = effects_table(dx, cy, col_w, entry)
    o.append(svg)
    svg, fh = facts_list(dx + col_w + SPACE_XL, cy, col_w, entry)
    o.append(svg)
    cy += max(eh, fh) + SPACE_XL
    svg, ph = prose(dx, cy, min(content_w, ENC_PROSE_MAX_W), entry)
    o.append(svg)
    cy += ph + SPACE_S
    svg, sh = see_also(dx, cy, content_w, entry)
    o.append(svg)
    return ''.join(o), cy + sh - start


def enc_shell(uw, uh, category, rail_state='selected', alert=True, back_enabled=True):
    x, y, w, h = enc_frame(uw, uh)
    o = [scrim(uw, uh, ENCYCLOPEDIA_SCRIM_ALPHA), modal_panel(x, y, w, h), enc_header(x, y, w, alert, back_enabled)]
    by, bh = y + ENC_HEADER_H + 1, h - ENC_HEADER_H - 1
    o.append(f'<clipPath id="body-clip"><rect x="{x}" y="{by}" width="{w}" height="{bh}" rx="{RADIUS_PANEL}"/></clipPath>')
    o.append(f'<g clip-path="url(#body-clip)">{enc_rail(x, by, bh, category, rail_state)}</g>')
    return ''.join(o), (x, y, w, h, by, bh)


def frame_a_trait(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'evolutions')
    o = [shell, enc_trait_list(x + ENC_RAIL_W, by, bh, 'mitochondrion', hovered='chloroplast')]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    cy = by + PANEL_PAD - 4
    svg, th = entry_title(dx, cy, MITO, dw)
    o.append(svg)
    svg, _ = entry_body(dx, cy + th + SPACE_L, dw, MITO, 'a-stage')
    o.append(svg)
    return ''.join(o)


def frame_a_long_trait(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'evolutions')
    lx = x + ENC_RAIL_W
    o = [shell, enc_trait_list(lx, by, bh, 'diatom_shell')]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    col_x = x + ENC_RAIL_W + ENC_LIST_W + 1
    col_w = w - ENC_RAIL_W - ENC_LIST_W - 1
    title_svg, th = entry_title(dx, 0, DIATOM, dw)
    sticky_h = PANEL_PAD - 4 + th + SPACE_M
    body_svg, body_h = entry_body(dx, 0, dw, DIATOM, 'long-stage')
    content_h = sticky_h + SPACE_XS + body_h + PANEL_PAD
    offset = content_h - bh  # scrolled to the end
    o.append(f'<clipPath id="detail-clip"><rect x="{col_x}" y="{by + sticky_h}" width="{col_w}" height="{bh - sticky_h}"/></clipPath>')
    o.append(f'<g clip-path="url(#detail-clip)"><g transform="translate(0,{by + sticky_h + SPACE_XS - offset:.1f})">{body_svg}</g></g>')
    o.append(f'<rect x="{col_x}" y="{by + sticky_h:.1f}" width="{col_w - SCROLLBAR}" height="{SCROLL_FADE}" fill="url(#fade-down)"/>')
    o.append(f'<clipPath id="sticky-clip"><rect x="{col_x}" y="{by}" width="{col_w}" height="{sticky_h}"/></clipPath>')
    o.append(f'<g clip-path="url(#sticky-clip)">' + rect(col_x, by, col_w, sticky_h, fill=PANEL_TOP) + '</g>')
    o.append(f'<g transform="translate(0,{by + PANEL_PAD - 4})">{title_svg}</g>')
    o.append(hline(col_x, x + w, by + sticky_h))
    visible = (bh - sticky_h) / (content_h - sticky_h)
    o.append(scrollbar(x + w - SCROLLBAR - 2, by + sticky_h + 4, bh - sticky_h - 8, 1 - visible, visible))
    return ''.join(o)


def entity_list(x, y, h, hovered='bacterium_aerobic'):
    o = [vline(x + ENC_LIST_W, y, y + h), t(x + SPACE_L, y + SPACE_L + 10, 'Cells & food', 'label', LABEL),
         t(x + ENC_LIST_W - SPACE_L, y + SPACE_L + 10, '10', 'label', MUTED, anchor='end')]
    ry = y + 40
    for group, rows in ENTITY_TILES:
        o.append(t(x + SPACE_L, ry + 20, group.upper(), 'label', MUTED))
        ry += 28
        for fid, name, _fact in rows:
            o.append(list_row(x, ry, ENC_LIST_W, fid, name, state='hover' if fid == hovered else 'rest'))
            ry += ROW_H
    return ''.join(o)


def tile(tx, ty, kind, name, fact, state='rest', clip_id='tile'):
    o = [rect(tx, ty, ENC_TILE_W, ENC_TILE_H, rx=RADIUS_PANEL, fill=TEXT, fill_opacity=0.03, stroke=PANEL_RIM)]
    o.append(f'<clipPath id="{clip_id}"><rect x="{tx + 1}" y="{ty + 1}" width="{ENC_TILE_W - 2}" height="{ENC_TILE_WELL_H}" rx="{RADIUS_PANEL - 1}"/></clipPath>')
    o.append(f'<g clip-path="url(#{clip_id})">' + rect(tx, ty, ENC_TILE_W, ENC_TILE_WELL_H + 1, fill='url(#stage-field)') + '</g>')
    o.append(medallion(tx + ENC_TILE_W / 2, ty + ENC_TILE_WELL_H / 2, kind, size=MEDALLION_CARD))
    o.append(hline(tx, tx + ENC_TILE_W, ty + ENC_TILE_WELL_H + 1))
    inner = ENC_TILE_W - 2 * SPACE_M
    o.append(t(tx + SPACE_M, ty + ENC_TILE_WELL_H + 18, ellipsize(name, 'body', inner), 'body', TEXT))
    o.append(t(tx + SPACE_M, ty + ENC_TILE_WELL_H + 32, ellipsize(fact, 'label_mixed', inner), 'label_mixed', LABEL))
    if state in ('hover', 'pressed'):
        o.append(rect(tx, ty, ENC_TILE_W, ENC_TILE_H, rx=RADIUS_PANEL, fill=TEXT, fill_opacity=HOVER_ALPHA if state == 'hover' else PRESSED_ALPHA))
    if state == 'focus':
        o.append(focus_ring(tx, ty, ENC_TILE_W, ENC_TILE_H, rx=RADIUS_PANEL))
    return ''.join(o)


def frame_a_category(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'entities', rail_state='selected_focus', alert=False, back_enabled=False)
    o = [shell, entity_list(x + ENC_RAIL_W, by, bh)]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    cy = by + PANEL_PAD - 4
    o.append(t(dx, cy + 10, 'Encyclopedia  ›  Cells & food', 'label', MUTED))
    o.append(t(dx, cy + 10 + SPACE_M + 24, 'Cells & food', 'headline', TEXT))
    o.append(t(dx, cy + 10 + SPACE_M + 24 + SPACE_M + 16, 'Who lives in the dish, what you swallow to grow, and where DNA comes from.', 'body', LABEL))
    cy += 10 + SPACE_M + 24 + SPACE_M + 16 + SPACE_XL
    per_row = max(1, int((dw + SPACE_M) // (ENC_TILE_W + SPACE_M)))
    tiles = [row for _g, rows in ENTITY_TILES for row in rows]
    for i, (fid, name, fact) in enumerate(tiles):
        tx = dx + (i % per_row) * (ENC_TILE_W + SPACE_M)
        ty = cy + (i // per_row) * (ENC_TILE_H + SPACE_M)
        o.append(tile(tx, ty, fid, name, fact, state='hover' if fid == 'bacterium_aerobic' else 'rest', clip_id=f'tile-{i}'))
    return ''.join(o)


def b_body(dx, cy, dw, entry, clip_id):
    """Option B's entry page from cy down: the lens and its control, the title and stacked tables beside it, then
    prose and See also across the content column. Returns (svg, height, title_height)."""
    start = cy
    content_w = dw  # the detail's inner width; the panel cap keeps it at most 848
    o = [preview_box(dx, cy, ENC_LENS_D, ENC_LENS_D, entry, clip_id, round_lens=True)]
    switch_w = 36 * entry['tiers']
    o.append(tier_switch(dx + ENC_LENS_D / 2 - switch_w / 2, cy + ENC_LENS_D + SPACE_M, entry['tiers'], selected=(entry['owned'] or 1) - 1)[0])
    rx = dx + ENC_LENS_D + ENC_LENS_GAP
    rw = content_w - ENC_LENS_D - ENC_LENS_GAP
    svg, th = entry_title(rx, cy, entry, rw, chips_below=True)
    o.append(svg)
    ty = cy + th + SPACE_L
    svg, eh = effects_table(rx, ty, rw, entry)
    o.append(svg)
    ty += eh + SPACE_L
    svg, fh = facts_list(rx, ty, rw, entry)
    o.append(svg)
    py = max(cy + ENC_LENS_D + SPACE_M + BUTTON_COMPACT_H, ty + fh) + SPACE_XL
    svg, ph = prose(dx, py, min(content_w, ENC_PROSE_MAX_W), entry)
    o.append(svg)
    svg, sh = see_also(dx, py + ph + SPACE_S, content_w, entry)
    o.append(svg)
    return ''.join(o), py + ph + SPACE_S + sh - start, th


def frame_b_trait(uw, uh):
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'evolutions')
    o = [shell, enc_trait_list(x + ENC_RAIL_W, by, bh, 'mitochondrion', hovered='chloroplast')]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    o.append(b_body(dx, by + PANEL_PAD - 4, dw, MITO, 'lens-clip')[0])
    return ''.join(o)


def frame_b_long_trait(uw, uh):
    """Diatom Shell under B, scrolled to its end: the condensed sticky title bar over the detail column."""
    shell, (x, y, w, h, by, bh) = enc_shell(uw, uh, 'evolutions')
    o = [shell, enc_trait_list(x + ENC_RAIL_W, by, bh, 'diatom_shell')]
    dx = x + ENC_RAIL_W + ENC_LIST_W + PANEL_PAD
    dw = w - ENC_RAIL_W - ENC_LIST_W - 2 * PANEL_PAD
    col_x = x + ENC_RAIL_W + ENC_LIST_W + 1
    col_w = w - ENC_RAIL_W - ENC_LIST_W - 1
    body_svg, body_h, _th = b_body(dx, 0, dw, DIATOM, 'long-lens')
    content_h = PANEL_PAD - 4 + body_h + PANEL_PAD
    offset = content_h - bh
    o.append(f'<clipPath id="detail-clip"><rect x="{col_x}" y="{by + ENC_STICKY_H}" width="{col_w}" height="{bh - ENC_STICKY_H}"/></clipPath>')
    o.append(f'<g clip-path="url(#detail-clip)"><g transform="translate(0,{by + PANEL_PAD - 4 - offset:.1f})">{body_svg}</g></g>')
    o.append(f'<rect x="{col_x}" y="{by + ENC_STICKY_H:.1f}" width="{col_w - SCROLLBAR}" height="{SCROLL_FADE}" fill="url(#fade-down)"/>')
    o.append(rect(col_x, by, col_w - 1, ENC_STICKY_H, fill=PANEL_TOP))
    o.append(t(dx, by + 20, DIATOM['crumb'], 'label', MUTED))
    o.append(t(dx, by + 39, DIATOM['title'], 'card_name', TEXT))
    o.append(hline(col_x, x + w, by + ENC_STICKY_H))
    visible = (bh - ENC_STICKY_H) / (content_h - ENC_STICKY_H)
    o.append(scrollbar(x + w - SCROLLBAR - 2, by + ENC_STICKY_H + 4, bh - ENC_STICKY_H - 8, 1 - visible, visible))
    return ''.join(o)


def frame_c_trait(uw, uh):
    x, y, w, h = enc_frame(uw, uh)
    o = [scrim(uw, uh, ENCYCLOPEDIA_SCRIM_ALPHA), modal_panel(x, y, w, h), enc_header(x, y, w)]
    ty = y + ENC_HEADER_H + 1
    o.append(rect(x + 1, ty, w - 2, ENC_TABS_H, fill=CALLOUT, fill_opacity=WELL_ALPHA))
    o.append(hline(x, x + w, ty + ENC_TABS_H))
    tx = x + PANEL_PAD
    for cid, name, _count in CATEGORIES:
        sel = cid == 'evolutions'
        lw = 16 + SPACE_S + tw(name, 'body', weight='bold') + 2 * SPACE_M
        if sel:
            o += [rect(tx, ty, lw, ENC_TABS_H, fill=ACCENT, fill_opacity=SELECTED_ALPHA), rect(tx, ty + ENC_TABS_H - SELECTION_BAR, lw, SELECTION_BAR, fill=ACCENT)]
        o.append(rail_icon(cid, tx + SPACE_M + 8, ty + ENC_TABS_H / 2, ACCENT if sel else LABEL))
        o.append(t(tx + SPACE_M + 16 + SPACE_S, ty + ENC_TABS_H / 2 + 5, name, 'body', TEXT if sel else LABEL, weight='bold' if sel else None))
        tx += lw + SPACE_XS
    dx, dw = x + PANEL_PAD, w - 2 * PANEL_PAD
    cy = ty + ENC_TABS_H + 1 + PANEL_PAD
    hero_rods = ((0.55, 0.22, 20), (0.86, 0.66, 160), (0.92, 0.3, 70), (0.66, 0.78, 110))  # clear of the title block
    o.append(preview_box(dx, cy, dw, ENC_HERO_H, MITO, 'hero-clip', rods=hero_rods, controls=False))
    o.append(rect(dx + 1, cy + ENC_HERO_H - 120, dw - 2, 119, fill='url(#hero-fade)'))
    o.append(tier_switch(dx + dw - SPACE_L - 108, cy + ENC_HERO_H - SPACE_L - BUTTON_COMPACT_H, 3, selected=0)[0])
    prev_label, next_label = '‹  Ribosome Studs', 'Chloroplast  ›'
    o.append(button(dx + SPACE_M, cy + SPACE_M, prev_label, 'secondary', compact=True)[0])
    o.append(button(dx + dw - SPACE_M - button_width(next_label, compact=True), cy + SPACE_M, next_label, 'secondary', compact=True)[0])
    svg, _ = entry_title(dx + PANEL_PAD, cy + ENC_HERO_H - 104, MITO, dw - 200, chips_below=True)
    o.append(svg)
    cy += ENC_HERO_H + SPACE_XL
    col_gap = 32
    col_w = (dw - 2 * col_gap) / 3
    o.append(effects_table(dx, cy, col_w, MITO)[0])
    o.append(facts_list(dx + col_w + col_gap, cy, col_w, MITO)[0])
    px_ = dx + 2 * (col_w + col_gap)
    o.append(t(px_, cy + 10, 'About', 'label', LABEL))
    svg, ph = prose(px_, cy + 22, col_w, MITO)
    o.append(svg)
    o.append(see_also(px_, cy + 22 + ph + SPACE_S, col_w, MITO)[0])
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------
# the kit states sheet

def kit_states(uw, uh):
    o = [rect(0, 0, uw, uh, fill='url(#ui-panel)')]
    o.append(t(32, 44, 'UI kit states', 'title', TEXT))
    o.append(t(32 + tw('UI kit states', 'title') + SPACE_L, 44, 'components-and-constants.md §10.2 · every state at scale 1', 'body', MUTED))
    states = ['rest', 'hover', 'pressed', 'focus', 'disabled']
    col_x = [150 + i * 104 for i in range(5)]
    y0 = 84
    for i, s in enumerate(states):
        o.append(t(col_x[i], y0, s.capitalize(), 'label', MUTED))
    for r, (variant, label) in enumerate([('primary', 'Return'), ('secondary', 'Browse'), ('danger', 'Exit game'), ('quiet', 'Skip'), ('icon', '')]):
        ry = y0 + 16 + r * 52
        o.append(t(32, ry + 25, variant.capitalize(), 'label', LABEL))
        for i, s in enumerate(states):
            o.append(button(col_x[i], ry, label, variant, w=None if variant == 'icon' else 92, state=s, icon='close' if variant == 'icon' else None)[0])
    # rail items and list rows
    y1 = y0 + 16 + 5 * 52 + 20
    o.append(t(32, y1, 'Rail item', 'label', LABEL))
    rail_states = ['rest', 'hover', 'selected', 'selected_focus']
    for i, s in enumerate(rail_states):
        rx = 32 + i * 158
        o.append(t(rx, y1 + 20, s.replace('_', ' + ').capitalize(), 'label_mixed', MUTED))
        o.append(rect(rx, y1 + 28, 150, RAIL_ROW_H, fill=CALLOUT, fill_opacity=WELL_ALPHA))
        o.append(rail_item(rx, y1 + 28, 150, 'basics', 'Basics', 13, s))
    y2 = y1 + 28 + RAIL_ROW_H + 24
    o.append(t(32, y2, 'List row', 'label', LABEL))
    for i, s in enumerate(['rest', 'hover', 'selected', 'focus']):
        rx = 32 + i * 158
        o.append(t(rx, y2 + 20, s.capitalize(), 'label_mixed', MUTED))
        o.append(list_row(rx, y2 + 28, 150, 'cell_wall', 'Cell Wall', state=s))
    y3 = y2 + 28 + ROW_H + 24
    o.append(t(32, y3, 'Tier switch', 'label', LABEL))
    o.append(t(32, y3 + 20, 'I selected, II hover, III focus', 'label_mixed', MUTED))
    o.append(tier_switch(32, y3 + 30, 3, selected=0, hovered=1, focused=2)[0])
    o.append(t(250, y3, 'Chips', 'label', LABEL))
    o.append(t(250, y3 + 20, 'Rarity, DNA tag, owned', 'label_mixed', MUTED))
    cx = 250
    for label, dot, tone in (('Common', None, 'common'), ('Uncommon', None, 'uncommon'), ('Rare', None, 'rare'), ('Metabolic', TAG_METABOLIC, None)):
        rim, col = RARITY_TONE[tone] if tone else (PANEL_RIM, LABEL)
        svg, cw = chip(cx, y3 + 34, label, dot=dot, rim=rim, col=col)
        o.append(svg)
        cx += cw + SPACE_S
    o.append(chip(cx, y3 + 34, 'Owned · I', rim=GOLD, col=GOLD)[0])
    y4 = y3 + 30 + BUTTON_COMPACT_H + 28
    o.append(t(32, y4, 'Link chip', 'label', LABEL))
    lx = 32
    for s in ('rest', 'hover', 'focus'):
        svg, lw = link_chip(lx, y4 + 12, 'Chloroplast', state=s)
        o.append(svg)
        lx += lw + SPACE_L
    o.append(t(32, y4 + 64, 'Back and Close in the header: rest, disabled (empty history)', 'label', LABEL))
    o.append(button(32, y4 + 76, '', 'icon', icon='back')[0])
    o.append(button(32 + BUTTON_H + SPACE_S, y4 + 76, '', 'icon', icon='back', state='disabled')[0])
    o.append(button(32 + 2 * (BUTTON_H + SPACE_S), y4 + 76, '', 'icon', icon='close')[0])
    # right column
    rx0 = 700
    o.append(t(rx0, y0, 'Alert strip', 'label', LABEL))
    ay = y0 + 12
    for words, secs, tone in (('AMOEBOID CAN ENGULF YOU', None, DANGER), ('SPRINT TO ESCAPE', None, DANGER), ('LEVEL 5 · CHOOSE A TRAIT ·', '6.5 s', GOLD)):
        svg, _w = alert_pill(rx0, ay, words, seconds=secs, tone=tone)
        o.append(svg)
        ay += ALERT_H + SPACE_S
    o.append(t(rx0, ay + 18, 'Search field: rest · focus with a query', 'label', LABEL))
    o.append(search_field(rx0, ay + 28))
    o.append(search_field(rx0 + SEARCH_W + SPACE_L, ay + 28, query='mito', focused=True))
    fy = ay + 28 + SEARCH_H + 28
    o.append(t(rx0, fy, 'Key hints', 'label', LABEL))
    kx = rx0 + 90
    for key in ('ESC', 'H', '/', '1'):
        svg, kw = keycap(kx, fy - 4, key, anchor='start')
        o.append(svg)
        kx += kw + SPACE_S
    # side panel sample (#356's hold-Tab panel uses this variant)
    sy = fy + 20
    sh = 268
    o.append(t(rx0, sy + 4, 'Side panel · sections, marker rows, scroll area', 'label', LABEL))
    py = sy + 16
    o.append(rect(rx0, py, SIDE_PANEL_W, sh - 16, rx=RADIUS_PANEL, fill='url(#ui-panel)', stroke=PANEL_RIM, fill_opacity=SIDE_PANEL_ALPHA))
    o.append(f'<clipPath id="side-clip"><rect x="{rx0}" y="{py}" width="{SIDE_PANEL_W}" height="{sh - 16}" rx="{RADIUS_PANEL}"/></clipPath><g clip-path="url(#side-clip)">')
    iy = py + SPACE_L
    sections = [('Mass', [('#8dff6a', 'Food', '+1.1/s'), ('#7f93a8', 'Decay', '−0.5/s'), (DANGER, 'Toxin', '−9.4/s')]),
                ('Here', [('#ff9a4d', 'Warm vent', 'decay ×1.5'), (GOLD, 'Bloom', '1:48')]),
                ('Traits', [(MITO_BASE, 'Mitochondrion I', '−15 %'), (ACCENT, 'Cytoskeleton III', '+64 %'), (LABEL, 'Cilia Fringe II', '+20 %')])]
    for s_i, (title, rows) in enumerate(sections):
        if s_i:
            o.append(hline(rx0, rx0 + SIDE_PANEL_W, iy))
            iy += SPACE_M
        o.append(t(rx0 + SPACE_L, iy + 10, title, 'label', LABEL))
        iy += 18
        for dot, name, value in rows:
            o.append(f'<circle cx="{rx0 + SPACE_L + MARKER / 2}" cy="{iy + FACT_ROW_H / 2}" r="{MARKER / 2}" fill="{dot}"/>')
            o.append(t(rx0 + SPACE_L + MARKER + SPACE_S, iy + 18, name, 'body', LABEL))
            o.append(t(rx0 + SIDE_PANEL_W - SPACE_L - SCROLLBAR, iy + 18, value, 'figure', TEXT, anchor='end'))
            iy += FACT_ROW_H
        iy += SPACE_XS
    o.append('</g>')
    o.append(f'<rect x="{rx0 + 1}" y="{py + sh - 16 - SCROLL_FADE - 1}" width="{SIDE_PANEL_W - 2 - SCROLLBAR}" height="{SCROLL_FADE}" fill="url(#fade-up)"/>')
    o.append(scrollbar(rx0 + SIDE_PANEL_W - SCROLLBAR - 2, py + 6, sh - 28, 0.0, 0.7))
    ty = py + sh - 16 + 28
    o.append(t(rx0, ty, 'Tiles: hover, focus (the name ends in an ellipsis)', 'label', LABEL))
    o.append(tile(rx0, ty + 12, 'algae', 'Algae mote', '+1 mass', state='hover', clip_id='st-tile-1'))
    o.append(tile(rx0 + ENC_TILE_W + SPACE_L + 4, ty + 12, 'bacterium_photosynthetic', 'Photosynthetic bacterium', '+3 mass · +1 DNA', state='focus', clip_id='st-tile-2'))
    return ''.join(o)


# ---------------------------------------------------------------------------------------------------------------------

def extra_defs():
    return ('<defs>'
            f'<linearGradient id="ui-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}"/><stop offset="1" stop-color="{PANEL_BOTTOM}"/></linearGradient>'
            '<radialGradient id="stage-field" cx="0.45" cy="0.4" r="0.8"><stop offset="0" stop-color="#0b1626"/><stop offset="1" stop-color="#04070d"/></radialGradient>'
            '<radialGradient id="lens-vignette"><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>'
            f'<linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{CALLOUT}" stop-opacity="0"/><stop offset="1" stop-color="{CALLOUT}" stop-opacity="0.9"/></linearGradient>'
            f'<linearGradient id="fade-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}" stop-opacity="0.95"/><stop offset="1" stop-color="{PANEL_TOP}" stop-opacity="0"/></linearGradient>'
            f'<linearGradient id="fade-up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_BOTTOM}" stop-opacity="0"/><stop offset="1" stop-color="{PANEL_BOTTOM}" stop-opacity="0.95"/></linearGradient>'
            '</defs>')


def hud_scale(vw, vh):
    return min(SCALE_MAX, max(SCALE_MIN, min(vw / HUD_REFERENCE[0], vh / HUD_REFERENCE[1])))


def compose(vw, vh, ui, background=True, chrome=True):
    s = hud_scale(vw, vh)
    uw, uh = vw / s, vh / s
    body = (game_background(vw, vh) if background else '') + f'<g transform="scale({s:.4f})">' + (hud_chrome(uw, uh) if chrome else '') + ui(uw, uh) + '</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{vw}" height="{vh}" viewBox="0 0 {vw} {vh}">{kit.defs()}{extra_defs()}{body}</svg>'


BOTH = ((1920, 1080), (1280, 800))
SMALL = ((1280, 800),)


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    frames = [  # name, ui, sizes, game background, HUD chrome
        ('esc-menu', lambda uw, uh: scrim(uw, uh, MENU_SCRIM_ALPHA) + esc_menu(uw, uh), BOTH, True, True),
        ('esc-menu-alert', lambda uw, uh: scrim(uw, uh, MENU_SCRIM_ALPHA) + esc_menu(uw, uh, alert=True), SMALL, True, True),
        ('esc-menu-confirm', lambda uw, uh: scrim(uw, uh, MENU_SCRIM_ALPHA) + esc_menu(uw, uh, confirm=True), SMALL, True, True),
        ('encyclopedia-a-trait', frame_a_trait, BOTH, True, False),
        ('encyclopedia-a-category', frame_a_category, BOTH, True, False),
        ('encyclopedia-a-long-trait', frame_a_long_trait, SMALL, True, False),
        ('encyclopedia-b-trait', frame_b_trait, BOTH, True, False),
        ('encyclopedia-b-long-trait', frame_b_long_trait, SMALL, True, False),
        ('encyclopedia-c-trait', frame_c_trait, BOTH, True, False),
        ('kit-states', kit_states, SMALL, False, False),
    ]
    for name, ui, sizes, background, chrome in frames:
        for vw, vh in sizes:
            path = out / f'{name}-{vw}x{vh}.svg'
            path.write_text(compose(vw, vh, ui, background, chrome), encoding='utf-8')
            print('wrote', path)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

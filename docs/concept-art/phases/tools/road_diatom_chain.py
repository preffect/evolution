#!/usr/bin/env python3
"""Sheet R3: the glass road, diatom chains and stars (Skeletonema, Chaetoceros, Asterionellopsis), for the diatom (ticket #782;
docs/game-design/phases.md §14.9.3)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PICK, SILICA, SILICA_L, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-diatom-chain.svg'
art = Sheet(1920, 1080, 7826, 'Evolution — phases concept R3: the glass road, diatom chains and stars',
            'Diatom colonies as a multicell path: one glass box, the division inside the box, a linked chain, a long horned chain, '
            'an Asterionellopsis star. With the break-the-chain mechanic and the real biology. All sea-water diatoms. Code-drawn.')
art.header('concept R3 — THE GLASS ROAD · linked boxes, chains and stars',
           'For the diatom. A colony, not a true many-celled body: every cell still does everything, but the chain is hard to eat. '
           'Drawn larger at each step, not to true scale.',
           'decided: tickets #785 A, #790 A · design: docs/game-design/phases.md §14.9.3', 'dark-field language of sheets 01 and 04 · zero raster')
art.panel(40, 90, 1840, 470, 'A · THE LADDER — seen from the side, where the glass box shows', None)
Y = 290


def box_cell(cx, cy, w, h, rot=0.0, horns=False, horn_len=60):
    """A diatom in girdle view: a lidded glass box, the two halves overlapping, gold plastids inside."""
    art.emit(f'<g transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})">')
    art.emit(f'<rect x="{cx - w / 2:.1f}" y="{cy - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h * 0.18:.1f}" fill="{SILICA_L}" '
             f'opacity="0.14" filter="url(#blur-3)"/>')
    art.emit(f'<rect x="{cx - w / 2:.1f}" y="{cy - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h * 0.18:.1f}" fill="url(#body-silica)"/>')
    for k in range(3):
        art.plastid(cx - w * 0.22 + k * w * 0.22, cy + (k % 2 - 0.5) * h * 0.25, w * 0.1, h * 0.12, 70)
    art.emit(f'<rect x="{cx - w / 2:.1f}" y="{cy - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{h * 0.18:.1f}" fill="none" '
             f'stroke="{SILICA_L}" stroke-width="1.6" opacity="0.9"/>')
    art.emit(f'<line x1="{cx - w / 2 + 2:.1f}" y1="{cy - h * 0.2:.1f}" x2="{cx + w / 2 - 2:.1f}" y2="{cy - h * 0.2:.1f}" stroke="{SILICA}" '
             f'stroke-width="1" opacity="0.7"/>')
    art.emit(f'<line x1="{cx - w / 2 + 2:.1f}" y1="{cy + h * 0.2:.1f}" x2="{cx + w / 2 - 2:.1f}" y2="{cy + h * 0.2:.1f}" stroke="{SILICA}" '
             f'stroke-width="1" opacity="0.7"/>')
    if horns:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x0, y0 = cx + sx * w * 0.42, cy + sy * h / 2
                art.emit(f'<path d="M{x0:.1f} {y0:.1f} q {sx * horn_len * 0.2:.1f} {sy * horn_len * 0.5:.1f} {sx * horn_len * 0.9:.1f} '
                         f'{sy * horn_len:.1f}" fill="none" stroke="{SILICA_L}" stroke-width="1.1" opacity="0.8"/>')
    art.emit('</g>')


# the six steps of phases.md §14.9.3: 1, 2, 4, 8, a 12-cell bristled chain, the 8-arm star


def tubes(x, y0, y1, offsets=(-14, -5, 5, 14)):
    """Skeletonema's rings of silica tubes joining two boxes."""
    for sx in offsets:
        art.emit(f'<line x1="{x + sx}" y1="{y0}" x2="{x + sx}" y2="{y1}" stroke="{SILICA_L}" stroke-width="1.2" opacity="0.8"/>')


# 1 · one diatom: valve view (the round lid) and girdle view (the box)
x = 120
art.diatom(x - 20, Y - 70, 40, 12)
box_cell(x + 5, Y + 70, 100, 56)
art.text(x - 20, Y - 132, 'from above', 10.5, MUTED, 400, 'middle')
art.text(x + 5, Y + 116, 'from the side', 10.5, MUTED, 400, 'middle')
art.stage_label(x, 470, '1 · One glass box', ['1 cell · 20–200 µm', 'a lid and a base', 'your diatom'])

# 2 · a linked pair (Skeletonema)
x = 320
box_cell(x, Y - 42, 104, 54)
box_cell(x, Y + 42, 98, 54)
tubes(x, Y - 15, Y + 15)
art.stage_label(x, 470, '2 · A linked pair', ['2 cells', 'Skeletonema: glass tubes', 'divide, and stay joined'], PICK)

# 3 · a chain of four (Skeletonema)
x = 510
for k in range(4):
    box_cell(x, Y - 108 + k * 72, 76, 52)
    if k < 3:
        tubes(x, Y - 82 + k * 72, Y - 56 + k * 72)
art.stage_label(x, 470, '3 · Chain of four', ['4 cells', 'Skeletonema', 'hard for small hunters'])

# 4 · a chain of eight, seen lying down
x = 740
for k in range(8):
    cx = x + (k - 3.5) * 30
    box_cell(cx, Y, 40, 24, rot=90)
art.stage_label(x, 470, '4 · Chain of eight', ['8 cells', 'Skeletonema, Thalassiosira', 'longer: safer, slower'])

# 5 · a bristled chain (Chaetoceros), gently curved
x = 1080
for k in range(12):
    t = k - 5.5
    box_cell(x + t * 26, Y + 0.0018 * (t * 26) ** 2 - 20, 30, 22, rot=90 + t * 2, horns=True, horn_len=38)
art.stage_label(x, 470, '5 · Bristled chain', ['12 cells · up to ~0.5 mm', 'Chaetoceros: locked setae', 'a rotifer cannot swallow it'])

# 6 · the star (Asterionellopsis)
x = 1560
for k in range(8):
    a = 2 * math.pi * k / 8 + 0.2
    x1, y1 = x + 12 * math.cos(a), Y - 10 + 12 * math.sin(a)
    x2, y2 = x + 125 * math.cos(a), Y - 10 + 125 * math.sin(a)
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" stroke-width="16" opacity="0.12" '
             f'stroke-linecap="round" filter="url(#blur-3)"/>')
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="url(#body-silica)" stroke-width="11" stroke-linecap="round"/>')
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" stroke-width="1.2" opacity="0.7"/>')
    for t in (0.35, 0.6):
        art.plastid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 9, 3.5, math.degrees(a))
    art.emit(f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="7" fill="{SILICA_L}" opacity="0.5"/>')
    art.emit(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="7" fill="{SILICA_L}" opacity="0.35"/>')
art.stage_label(x, 470, '6 · The star', ['8 arms · ~0.2 mm across', 'Asterionellopsis (sea)', 'stars and spirals; the apex'], GOOD)
for cx in (220, 415, 585, 875, 1320):
    art.chevron(cx, Y)
art.text(1790, 210, 'Every cell still', 12, TEXT, 600, 'middle')
art.text(1790, 228, 'eats, sees and', 12, TEXT, 600, 'middle')
art.text(1790, 246, 'divides alone:', 12, TEXT, 600, 'middle')
art.text(1790, 264, 'no jobs. The chain', 12, TEXT, 600, 'middle')
art.text(1790, 282, 'is armour, not a body.', 12, TEXT, 600, 'middle')

# ---------------------------------------------------------------- B · the trade-off: link or break
art.panel(40, 580, 700, 460, 'B · HOW YOU PLAY IT: LINK OR BREAK', 'the chain follows its lead cell like a train; one key snaps it')
# long chain vs small hunter
for k in range(6):
    box_cell(140 + k * 44, 720, 38, 30, rot=90, horns=True, horn_len=34)
art.amoeba(84, 760, 16, arms=3, pal='amber')
art.text(250, 812, 'LONG: small hunters can\'t swallow it', 11.5, GOOD, 700, 'middle')
art.text(250, 830, 'small hunters and young rotifers give up', 10.5, MUTED, 400, 'middle', mono=True)
# broken chain vs a big sieve
for k in range(6):
    box_cell(470 + (k % 3) * 70 + (k // 3) * 30, 690 + (k // 3) * 70 + (k % 2) * 16, 38, 30, rot=90 + k * 25)
art.emit(f'<polygon points="440,760 740,660 740,860" fill="{WARN}" opacity="0.06"/>')
art.text(580, 850, 'BROKEN: the copepod passes you by', 11.5, WARN, 700, 'middle')
art.text(580, 868, 'each piece is below its window, but small hunters bite', 10.5, MUTED, 400, 'middle', mono=True)
art.lines(60, 900, [
    '• Level-up: the next step (one card kept for it), Setae (spines) or a Resting spore.',
    '• Ability key (E): the chain snaps into single cells for 5 s, then re-forms.',
    '  While broken, small hunters can bite single pieces off.',
    '• A cell bitten off the end is lost; the chain keeps going.',
    '• The star (8 arms) is the last step: the hardest single thing in the',
    '  pool to eat. No jobs on this road: every cell still does everything.',
], 12, TEXT, 18)

# ---------------------------------------------------------------- C · the real story
art.note_panel(760, 580, 1120, 460, 'C · THE REAL STORY — a colony, with a lesson in glass', [
    '§ True',
    '• A diatom lives in a glass box of two halves that fit like a petri dish\'s lid and base.',
    '• When it divides, each daughter keeps one old half and builds a new, smaller one inside it,',
    '  so one line of the family shrinks each generation until sex resets the size.',
    '• Chain diatoms stay linked after dividing: Skeletonema by rings of glass tubes, Chaetoceros by locked',
    '  horns. In the sea, Asterionellopsis joins its cells at their bases into stars and spirals.',
    '• Chain length is a real trade-off: sea diatoms shorten their chains when copepods are about,',
    '  and long chains resist small grazers (Bergkvist et al., Limnology and Oceanography 2012).',
    '§ Caveats for the encyclopedia',
    '• These are colonies, not bodies: no cell gives up its own life for the group. That is why this road',
    '  ends at the star, and why the encyclopedia calls it "a colony".',
    '• Real diatoms cannot swim: they drift, sink, and some glide on surfaces. The game lets you steer, as it',
    '  already does for the diatom form.',
    '• Real chains shorten over days by growing shorter; the game\'s break is instant.',
    '~ Round, Crawford and Mann, "The Diatoms", Cambridge 1990',
], 'sources in docs/game-design/phases.md §14.16')
art.footer('R3 · the glass road · sizes are the real organisms\'; game numbers are §14.14 tuning values',
           'docs/concept-art/phases/road-diatom-chain.svg · 1920 × 1080')
art.save(OUT)

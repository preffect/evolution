#!/usr/bin/env python3
"""Sheet R3: the glass road, diatom chains and stars (Chaetoceros, Skeletonema, Asterionella), for the diatom (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PICK, SILICA, SILICA_L, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-diatom-chain.svg'
art = Sheet(1920, 1080, 7826, 'Evolution — phases concept R3: the glass road, diatom chains and stars',
            'Diatom colonies as a multicell path: one glass box, the division inside the box, a linked chain, a long horned chain, '
            'an Asterionella star. With the break-the-chain mechanic and the real biology. Code-drawn.')
art.header('concept R3 — THE GLASS ROAD · linked boxes, chains and stars',
           'For the diatom. A colony, not a true many-celled body: every cell still does everything, but the chain is hard to eat. '
           'Drawn larger at each step, not to true scale.',
           'ticket #782 · epic #761', 'dark-field language of sheets 01 and 04 · zero raster')
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


# 1 · one diatom: valve view (the round lid) and girdle view (the box)
x = 150
art.diatom(x - 30, Y - 60, 42, 12)
box_cell(x + 10, Y + 80, 110, 60)
art.text(x - 30, Y - 125, 'from above', 10.5, MUTED, 400, 'middle')
art.text(x + 10, Y + 128, 'from the side', 10.5, MUTED, 400, 'middle')
art.stage_label(x, 470, '1 · One glass box', ['1 cell · 20–200 µm', 'a lid and a base, like a dish', 'your form today'])

# 2 · division inside the box
x = 430
box_cell(x, Y - 45, 120, 58)
box_cell(x, Y + 45, 108, 58)
art.emit(f'<path d="M{x - 90} {Y} H{x + 90}" stroke="{PICK}" stroke-width="1.4" stroke-dasharray="5 4"/>')
art.text(x + 96, Y + 4, 'new halves', 10.5, PICK, 600)
art.stage_label(x, 470, '2 · Divide, and stay stuck', ['2 cells', 'each keeps one old half', 'the one with the base shrinks'], PICK)

# 3 · a linked chain (Skeletonema)
x = 730
for k in range(5):
    box_cell(x, Y - 150 + k * 72, 76, 52)
    if k < 4:
        for sx in (-18, -6, 6, 18):
            art.emit(f'<line x1="{x + sx}" y1="{Y - 124 + k * 72}" x2="{x + sx}" y2="{Y - 98 + k * 72}" stroke="{SILICA_L}" stroke-width="1.2" opacity="0.8"/>')
art.stage_label(x, 470, '3 · Linked chain', ['4–16 cells', 'Skeletonema: glass tubes', 'hard for small hunters'])

# 4 · a horned chain (Chaetoceros), gently curved
x = 1060
for k in range(6):
    t = k - 2.5
    box_cell(x + t * 58, Y + 0.0025 * (t * 58) ** 2 - 20, 50, 40, rot=90 + t * 4, horns=True, horn_len=55)
art.stage_label(x, 470, '4 · Horned chain', ['6–20 cells · up to ~0.5 mm', 'Chaetoceros: locked horns', 'a rotifer cannot swallow it'])

# 5 · the star (Asterionella)
x = 1480
for k in range(8):
    a = 2 * math.pi * k / 8 + 0.2
    x1, y1 = x + 12 * math.cos(a), Y - 10 + 12 * math.sin(a)
    x2, y2 = x + 130 * math.cos(a), Y - 10 + 130 * math.sin(a)
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" stroke-width="16" opacity="0.12" '
             f'stroke-linecap="round" filter="url(#blur-3)"/>')
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="url(#body-silica)" stroke-width="11" stroke-linecap="round"/>')
    art.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" stroke-width="1.2" opacity="0.7"/>')
    for t in (0.35, 0.6):
        art.plastid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 9, 3.5, math.degrees(a))
    art.emit(f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="7" fill="{SILICA_L}" opacity="0.5"/>')
    art.emit(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="7" fill="{SILICA_L}" opacity="0.35"/>')
art.stage_label(x, 470, '5 · The star', ['8 cells · ~0.2 mm across', 'Asterionella', 'spins as it floats; the apex'], GOOD)
for cx in (290, 600, 880, 1270):
    art.chevron(cx, Y)
art.text(1740, 200, 'Every cell still eats,', 12, TEXT, 600, 'middle')
art.text(1740, 218, 'sees and divides alone:', 12, TEXT, 600, 'middle')
art.text(1740, 236, 'no jobs. The chain is', 12, TEXT, 600, 'middle')
art.text(1740, 254, 'armour, not a body.', 12, TEXT, 600, 'middle')

# ---------------------------------------------------------------- B · the trade-off: link or break
art.panel(40, 580, 700, 460, 'B · HOW YOU PLAY IT: LINK OR BREAK', 'the chain follows its lead cell like a train; one key snaps it')
# long chain vs small hunter
for k in range(6):
    box_cell(140 + k * 44, 720, 38, 30, rot=90, horns=True, horn_len=34)
art.didinium(84, 760, 16, heading=0)
art.text(250, 812, 'LONG: small hunters can\'t swallow it', 11.5, GOOD, 700, 'middle')
art.text(250, 830, 'Didinium, rotifers, amoebae give up', 10.5, MUTED, 400, 'middle', mono=True)
# broken chain vs a big sieve
for k in range(6):
    box_cell(470 + (k % 3) * 70 + (k // 3) * 30, 690 + (k // 3) * 70 + (k % 2) * 16, 38, 30, rot=90 + k * 25)
art.emit(f'<polygon points="440,760 740,660 740,860" fill="{WARN}" opacity="0.06"/>')
art.text(580, 850, 'BROKEN: slip through a Daphnia sieve', 11.5, WARN, 700, 'middle')
art.text(580, 868, 'smaller pieces are less noticed', 10.5, MUTED, 400, 'middle', mono=True)
art.lines(60, 900, [
    '• Level-up "link": +1 cell to the chain (the new cell is a free, ready piece).',
    '• BREAK key: the chain snaps into single cells for a few seconds; they drift',
    '  back together and relink. Lose a piece while broken and it is gone.',
    '• A cell bitten off the end is lost; the chain keeps going.',
    '• The star (8 cells) is the capstone: it cannot break, it spins, and its',
    '  arms spread the load: the hardest single thing in the pond to eat.',
], 12, TEXT, 18)

# ---------------------------------------------------------------- C · the real story
art.note_panel(760, 580, 1120, 460, 'C · THE REAL STORY — a colony, with a lesson in glass', [
    '§ True',
    '• A diatom lives in a glass box of two halves that fit like a petri dish\'s lid and base.',
    '• When it divides, each daughter keeps one old half and builds a new, smaller one inside it,',
    '  so one line of the family shrinks each generation until sex resets the size.',
    '• Chain diatoms stay linked after dividing: Skeletonema by rings of glass tubes, Chaetoceros by locked',
    '  horns. Asterionella forms eight-armed stars in lakes.',
    '• Chain length is a real trade-off: some diatoms shorten their chains when big grazers are about,',
    '  and long chains resist small ones (Bergkvist et al., Limnology and Oceanography 2012).',
    '§ Caveats for the encyclopedia',
    '• These are colonies, not bodies: no cell gives up its own life for the group. That is why this road',
    '  ends at the star, and why the encyclopedia calls it "a colony".',
    '• Real diatoms cannot swim: they drift, sink, and some glide on surfaces. The game lets you steer, as it',
    '  already does for the diatom form.',
    '~ Round, Crawford and Mann, "The Diatoms", Cambridge 1990',
], 'sources in the proposal on ticket #782')
art.footer('R3 · the glass road · sizes are the real organisms\'; game numbers are proposals',
           'docs/concept-art/phases/road-diatom-chain.svg · 1920 × 1080')
art.save(OUT)

#!/usr/bin/env python3
"""Sheet R1: the light road (was the green road), one cell to a great Phaeocystis ball, for the euglena (ticket #782;
decided on ticket #790 A, docs/game-design/phases.md §14.9.1)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL, PICK, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-green-colony.svg'
art = Sheet(1920, 1080, 7824, 'Evolution — phases concept R1: the light road, from one cell to a great Phaeocystis ball',
            'The euglena\'s road in sea water: a stuck pair, then Phaeocystis, a sea-water colony of light-fed cells in a skin of '
            'mucus, from four cells to a ball centimetres across. With the body controls, damage and spare lives, and the real '
            'biology. Code-drawn.')
art.header('concept R1 — THE LIGHT ROAD · one cell to a great ball (was the green road)',
           'For the euglena. Volvox and its whole family live in fresh water, so on the kelp shore the road is Phaeocystis, a sea-water colony. '
           'Drawn larger at each step, not to true scale.',
           'decided: ticket #790 A · design: docs/game-design/phases.md §14.9.1', 'cell counts are game values · zero raster')

art.panel(40, 90, 1840, 470, 'A · THE LADDER — what you become, one level-up at a time', None)
Y = 290
GOLD = PALETTES['golden']

# 1 · your euglena
x = 130
art.euglena(x, Y, 120, heading=-60)
art.stage_label(x, 470, '1 · Your euglena', ['1 cell', 'Eutreptiella in the sea', 'your form, from 17:00'])

# 2 · the stuck pair (game step)
x = 350
art.jelly(x, Y, 66, 'golden')
art.euglena(x - 22, Y, 70, heading=-100)
art.euglena(x + 22, Y, 70, heading=-80)
art.stage_label(x, 470, '2 · Stuck pair', ['2 cells', 'a game step, not a species', 'divide, and stay together'], PICK)

# 3 · four in a skin of mucus
x = 580
art.jelly(x, Y, 70, 'golden')
for (dx, dy) in ((-22, -22), (22, -22), (-22, 22), (22, 22)):
    art.mini_cell(x + dx, Y + dy, 18, 'golden', halo=0.1)
art.stage_label(x, 470, '3 · Four in a skin', ['4 cells', 'a young Phaeocystis colony', 'a shared skin of mucus'])

# 4 · a small ball
x = 830
art.sphere_cells(x, Y, 62, 30, 13, pal='golden')
art.stage_label(x, 470, '4 · Small ball', ['16 cells', 'Phaeocystis', 'too big for ciliates'])

# 5 · a hollow ball, in the copepod's window
x = 1110
art.sphere_cells(x, Y, 92, 110, 7, pal='golden')
art.emit(f'<circle cx="{x}" cy="{Y}" r="112" fill="none" stroke="{WARN}" stroke-width="1.4" stroke-dasharray="8 6" opacity="0.7"/>')
art.stage_label(x, 470, '5 · Hollow ball', ['64 cells', 'Phaeocystis', 'in the copepod\'s window'], WARN)

# 6 · a great ball
x = 1550
art.sphere_cells(x, Y - 10, 160, 520, 4.2, pal='golden')
art.stage_label(x, 470, '6 · Great ball', ['256 cells', 'Phaeocystis: real ones to 3 cm', 'past the copepod'], GOOD)
for cx in (240, 465, 705, 960, 1260):
    art.chevron(cx, Y)

# ---------------------------------------------------------------- B · controls and the body map (mock HUD)
art.panel(40, 580, 620, 460, 'B · STEERING A BODY OF MANY CELLS', 'you steer the whole body with the pointer, as today; cells are slots')
BX, BY, BR = 210, 830, 118
art.emit(f'<circle cx="{BX}" cy="{BY}" r="{BR + 18}" fill="{PANEL}" stroke="{ACCENT}" stroke-opacity="0.3"/>')
jobs = {'light': '#b8ff9a', 'mucus': '#a9dcef', 'swarmer': PICK, 'plain': GOLD[2], 'empty': '#2a3440'}
ring = ['light', 'light', 'mucus', 'plain', 'mucus', 'plain', 'light', 'plain', 'mucus', 'plain', 'light', 'plain']
for k, job in enumerate(ring):
    a = -math.pi / 2 + 2 * math.pi * k / len(ring) - math.pi / 12
    art.emit(f'<circle cx="{BX + BR * math.cos(a):.1f}" cy="{BY + BR * math.sin(a):.1f}" r="17" fill="{jobs[job]}" '
             f'fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.5"/>')
inner = ['swarmer', 'plain', 'empty', 'empty']
for k, job in enumerate(inner):
    a = -math.pi / 4 + math.pi / 2 * k
    dash = ' stroke-dasharray="3 3"' if job == 'empty' else ''
    art.emit(f'<circle cx="{BX + 50 * math.cos(a):.1f}" cy="{BY + 50 * math.sin(a):.1f}" r="17" fill="{jobs[job]}" '
             f'fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.5"{dash}/>')
art.arrow(BX, BY - BR - 22, BX, BY - BR - 44, ACCENT, 1.6)
art.text(BX + 10, BY - BR - 30, 'heading', 10, ACCENT, 600)
legend = [('light cell', '#b8ff9a', 'grows faster in the light patch'), ('mucus cell', '#a9dcef', 'a thicker skin: harder to bite'),
          ('swarmer cell', PICK, 'a spare life: swims off, starts again'), ('plain cell', GOLD[2], 'no job yet'),
          ('empty slot', '#2a3440', 'a bitten cell, growing back')]
for i, (name, col, what) in enumerate(legend):
    ly = 690 + i * 44
    art.emit(f'<circle cx="{392}" cy="{ly - 4}" r="9" fill="{col}" fill-opacity="0.8" stroke="#ffffff" stroke-opacity="0.5"/>')
    art.text(410, ly, name, 12, TEXT, 700)
    art.text(410, ly + 16, what, 10.5, MUTED, 400, mono=True)
art.lines(60, 990, ['Level-up: the next step (one card is kept for it) or a job.', 'The body turns as one; a wider body turns slower.'], 11.5, TEXT, 17)

# ---------------------------------------------------------------- C · hurt, death, spare lives
art.note_panel(680, 580, 580, 460, 'C · GETTING HURT, AND SPARE LIVES', [
    '§ A bite takes a cell, not your life',
    '• Only a predator big enough to swallow the whole ball',
    '  can bite it; it takes one cell, and that cell\'s job.',
    '• Anything smaller cannot hurt you: the size refuge.',
    '• Down to one cell you are your euglena again: fragile.',
    '§ Swarmer cells are spare lives',
    '• When the body dies, a swarmer swims off and you go on',
    '  from there, one step smaller, with your jobs.',
    '§ The copepod\'s window',
    '• Single cells: ciliates eat them.',
    '• Mid-sized balls: the copepod eats them.',
    '• The great ball: too big for almost anything.',
], 'the colony\'s answer to the dish\'s "one hit and you respawn"')

# ---------------------------------------------------------------- D · the real story
art.note_panel(1280, 580, 600, 460, 'D · THE REAL STORY — and honest caveats', [
    '§ True',
    '• Phaeocystis swims as single cells of 4–6 µm and builds',
    '  colonies up to 3 cm across, big enough to see.',
    '• Grazers change it: ciliate smells bring more colonies,',
    '  copepod smells fewer (Long et al., PNAS 2007).',
    '• Copepods eat mid-sized colonies; the biggest are too big',
    '  for most grazers (Nejstgaard et al. 2007).',
    '§ Caveats for the encyclopedia',
    '• Euglena never did this, and Phaeocystis is no relative:',
    '  a golden-brown haptophyte, fed by light like you.',
    '• Volvox and all its family live in fresh water.',
    '• Real colonies drift with the water; in the game you steer.',
    '~ design: docs/game-design/phases.md §14.9.1',
], 'sources in docs/game-design/phases.md §14.16')
art.footer('R1 · the light road · real sizes are the organisms\'; cell counts and game numbers are §14.14 tuning values',
           'docs/concept-art/phases/road-green-colony.svg · 1920 × 1080')
art.save(OUT)

#!/usr/bin/env python3
"""Sheet R1: the green road, one cell to a Volvox ball (the volvocine ladder), for the euglena (ticket #782)."""
import math
import sys

from phase_art import ACCENT, EYESPOT, GOOD, MUTED, PALETTES, PANEL, PICK, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-green-colony.svg'
art = Sheet(1920, 1080, 7824, 'Evolution — phases concept R1: the green road, from one cell to a Volvox ball',
            'The volvocine ladder as a multicell path: Chlamydomonas, a stuck pair, Tetrabaena, Gonium, Pandorina, Eudorina, '
            'Volvox. With the body controls, damage and spare lives, and the real biology. Code-drawn.')
art.header('concept R1 — THE GREEN ROAD · one cell to a rolling ball',
           'For the euglena (and any green swimmer). Every step below is a real alga alive today, except the pair. '
           'Drawn larger at each step, not to true scale: the last is about 50× the first.',
           'ticket #782 · epic #761 · builds on the ticket #28 research', 'dark-field language of sheets 01 and 04 · zero raster')

art.panel(40, 90, 1840, 470, 'A · THE LADDER — what you become, one level-up at a time', None)
Y = 290
G = PALETTES['green']

# 1 · Chlamydomonas
x = 130
art.chlamy(x, Y, 30, heading=-90, detail=True)
art.stage_label(x, 470, '1 · Green swimmer', ['1 cell · ~10 µm', 'Chlamydomonas', 'how it starts: your cell'])

# 2 · the stuck pair (game step)
x = 350
art.jelly(x, Y, 62)
art.chlamy(x - 26, Y, 24, heading=-100)
art.chlamy(x + 26, Y, 24, heading=-80)
art.stage_label(x, 470, '2 · Stuck pair', ['2 cells', 'a game step, not a species', 'divide, and stay together'], PICK)

# 3 · Tetrabaena
x = 580
art.jelly(x, Y, 70)
for (dx, dy) in ((-22, -22), (22, -22), (-22, 22), (22, 22)):
    art.chlamy(x + dx, Y + dy, 21, heading=math.degrees(math.atan2(dy, dx)))
art.stage_label(x, 470, '3 · Square of four', ['4 cells · ~20 µm', 'Tetrabaena', 'too big for a paramecium'])

# 4 · Gonium plate (seen at a tilt)
x = 830
art.emit(f'<ellipse cx="{x}" cy="{Y}" rx="98" ry="62" fill="{G[1]}" opacity="0.07" stroke="{G[1]}" stroke-opacity="0.4" stroke-dasharray="3 3"/>')
cells = [(-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)]
for k in range(12):
    a = 2 * math.pi * k / 12 + 0.26
    cells.append((0.72 * math.cos(a), 0.72 * math.sin(a)))
for (u, v) in sorted(cells, key=lambda c: c[1]):
    cx, cy = x + 110 * u, Y + 68 * v
    if u * u + v * v > 0.3:
        art.whip(cx, cy, math.degrees(math.atan2(v * 0.62, u)) + 20, 26, waves=1, amp=4, width=1, colour=G[1], glow=False)
    art.mini_cell(cx, cy, 14, 'green', halo=0)
    art.speck(cx + 5, cy - 4, 2.2, EYESPOT, 0.8)
art.stage_label(x, 470, '4 · Rowing plate', ['16 cells · ~60 µm', 'Gonium', 'edge whips row together'])

# 5 · Pandorina ball
x = 1080
art.sphere_cells(x, Y, 58, 16, 20, jelly=True)
art.stage_label(x, 470, '5 · Tight ball', ['16 cells · ~80 µm', 'Pandorina', 'rolls: turns on the spot'])

# 6 · Eudorina hollow ball
x = 1320
art.sphere_cells(x, Y, 80, 36, 13, jelly=True)
art.stage_label(x, 470, '6 · Hollow ball', ['32 cells · ~150 µm', 'Eudorina', 'too big for a rotifer'])

# 7 · Volvox with daughters
x = 1640
art.sphere_cells(x, Y - 10, 138, 420, 4.2, jelly=True, front=-90, eyes=True)
for (dx, dy, dr) in ((-45, 20, 30), (40, -10, 34), (0, 70, 26), (60, 60, 20)):
    art.sphere_cells(x + dx, Y - 10 + dy, dr, 60, 2.6, jelly=True)
art.arrow(x + 150, Y - 120, x + 150, Y - 160, ACCENT, 1.6)
art.text(x + 160, Y - 150, 'front', 10.5, ACCENT, 600)
art.stage_label(x, 470, '7 · Volvox', ['500–50 000 cells · ~0.5 mm', 'babies grow inside', 'front cells see; spare lives'], GOOD)
for cx in (240, 465, 705, 955, 1200, 1460):
    art.chevron(cx, Y)

# ---------------------------------------------------------------- B · controls and the body map (mock HUD)
art.panel(40, 580, 620, 460, 'B · STEERING A BODY OF MANY CELLS', 'you steer the whole body with the pointer, as today; cells are slots')
BX, BY, BR = 210, 830, 118
art.emit(f'<circle cx="{BX}" cy="{BY}" r="{BR + 18}" fill="{PANEL}" stroke="{ACCENT}" stroke-opacity="0.3"/>')
jobs = {'whip': PICK, 'eye': EYESPOT, 'germ': GOOD, 'plain': G[0], 'empty': '#2a3440'}
ring = ['eye', 'eye', 'whip', 'plain', 'whip', 'plain', 'whip', 'plain', 'whip', 'plain', 'whip', 'eye']
for k, job in enumerate(ring):
    a = -math.pi / 2 + 2 * math.pi * k / len(ring) - math.pi / 12
    art.emit(f'<circle cx="{BX + BR * math.cos(a):.1f}" cy="{BY + BR * math.sin(a):.1f}" r="17" fill="{jobs[job]}" '
             f'fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.5"/>')
inner = ['germ', 'plain', 'empty', 'empty']
for k, job in enumerate(inner):
    a = -math.pi / 4 + math.pi / 2 * k
    dash = ' stroke-dasharray="3 3"' if job == 'empty' else ''
    art.emit(f'<circle cx="{BX + 50 * math.cos(a):.1f}" cy="{BY + 50 * math.sin(a):.1f}" r="17" fill="{jobs[job]}" '
             f'fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.5"{dash}/>')
art.arrow(BX, BY - BR - 22, BX, BY - BR - 44, ACCENT, 1.6)
art.text(BX + 10, BY - BR - 30, 'heading', 10, ACCENT, 600)
legend = [('whip cell', PICK, 'edge: +speed while it beats'), ('eye cell', EYESPOT, 'front: sees food and light farther'),
          ('germ cell', GOOD, 'inside: a spare life (a daughter)'), ('plain cell', G[0], 'feeds in light; armour by bulk'),
          ('empty slot', '#2a3440', 'the next level-up fills one')]
for i, (name, col, what) in enumerate(legend):
    ly = 690 + i * 44
    art.emit(f'<circle cx="{392}" cy="{ly - 4}" r="9" fill="{col}" fill-opacity="0.8" stroke="#ffffff" stroke-opacity="0.5"/>')
    art.text(410, ly, name, 12, TEXT, 700)
    art.text(410, ly + 16, what, 10.5, MUTED, 400, mono=True)
art.lines(60, 990, ['Level-up = pick a job for one more cell (3 cards, as today).', 'The body turns as one; a wider body turns slower.'], 11.5, TEXT, 17)

# ---------------------------------------------------------------- C · hurt, death, spare lives
art.note_panel(680, 580, 580, 460, 'C · GETTING HURT, AND SPARE LIVES', [
    '§ A bite takes a cell, not your life',
    '• A predator that catches your edge eats one cell.',
    '• You lose that cell\'s job (a whip cell lost = slower).',
    '• Below 4 cells you are a single cell again: fragile.',
    '§ Germ cells are spare lives (Volvox only)',
    '• Volvox grows daughter balls inside itself.',
    '• If your body dies, a daughter swims out and you',
    '  keep playing from there, smaller, with your jobs.',
    '§ Why it matters to the player',
    '• Many cells = hard to kill. That is the real reason',
    '  multicellular life won: it escaped its predators.',
    '• Size also brings a problem: the ball is slow to',
    '  turn, so small fast hunters still pick at the edge.',
], 'the colony\'s answer to the dish\'s "one hit and you respawn"')

# ---------------------------------------------------------------- D · the real story
art.note_panel(1280, 580, 600, 460, 'D · THE REAL STORY — and one honest caveat', [
    '§ True',
    '• Every alga on the ladder is alive today; together they',
    '  replay how this family went multicellular, ~200 million',
    '  years ago (Herron et al., PNAS 2009).',
    '• Volvox front cells have bigger eyespots and steer the',
    '  ball into light (Ueki et al., BMC Biology 2010).',
    '• In the lab, a single-cell green alga evolved clusters',
    '  within ~750 generations when a paramecium hunted it',
    '  (Herron et al., Scientific Reports 2019).',
    '§ Caveat for the encyclopedia',
    '• Euglena itself never did this. Its green look-alikes',
    '  (Chlamydomonas\'s family) did. The game gives the',
    '  euglena player their road and says so.',
    '~ also: Kirk, BioEssays 2005, "a twelve-step program"',
], 'sources in the proposal on ticket #782')
art.footer('R1 · the green road · cell counts and sizes are the real organisms\'; game numbers are proposals',
           'docs/concept-art/phases/road-green-colony.svg · 1920 × 1080')
art.save(OUT)

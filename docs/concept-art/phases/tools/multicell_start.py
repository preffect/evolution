#!/usr/bin/env python3
"""Sheet S2: where multicell starts, three options, plus a sketch of what could come after (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/multicell-start.svg'
art = Sheet(1920, 1080, 7829, 'Evolution — phases concept S2: where multicell starts, and what might come after',
            'Three options for where the many-celled era begins (in the pond after a big-protist chapter, straight from the dish, '
            'or in a third world), and a sketch of an animal era after it. Code-drawn.')
art.header('concept S2 — WHERE MULTICELL STARTS · and a sketch of what comes after',
           'Each row is one game, left to right. The icons are the player; the frames are the worlds.',
           'ticket #782 · epic #761', 'dark-field language of sheets 01 and 04 · zero raster')


def world(x, y, w, h, kind, label):
    art.emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{"#0d2a26" if kind == "pond" else "#0b1626"}" '
             f'stroke="{"#2fae8f" if kind == "pond" else ACCENT}" stroke-opacity="0.5"/>')
    art.text(x + 12, y + 20, label, 11, "#9fe8c8" if kind == 'pond' else ACCENT, 700, mono=True)


def protocell(x, y):
    art.mini_cell(x, y, 14, 'cyan', halo=0.35)


def row(y, title, colour, worlds, notes):
    art.text(40, y - 70, title, 15, colour, 700)
    for (x, w, kind, label, draw) in worlds:
        world(x, y - 50, w, 110, kind, label)
        draw(x, y + 10)
    for i, n in enumerate(notes):
        art.text(1420, y - 40 + i * 19, n, 11.5, TEXT if i else colour, 700 if not i else 400)


def dish_icons(x, y):
    protocell(x + 50, y)
    art.arrow(x + 72, y, x + 110, y, ACCENT, 1.2)
    art.euglena(x + 160, y, 70, heading=-15)


def pond_big(x, y):
    art.euglena(x + 60, y, 50, heading=-15)
    art.rotifer(x + 150, y - 5, 80, heading=-100)
    art.didinium(x + 230, y + 5, 14, heading=180)


def pond_colony(x, y):
    for (dx, dy) in ((-10, -10), (10, -10), (-10, 10), (10, 10)):
        art.chlamy(x + 50 + dx, y + dy, 8, heading=math.degrees(math.atan2(dy, dx)))
    art.arrow(x + 80, y, x + 108, y, ACCENT, 1.2)
    art.sphere_cells(x + 150, y, 26, 40, 4)
    art.arrow(x + 186, y, x + 214, y, ACCENT, 1.2)
    art.sphere_cells(x + 255, y, 34, 160, 2.6, eyes=True, front=-90)


# ---------------------------------------------------------------- A
row(230, 'A · In the pond, after a big-protist chapter   (recommended)', GOOD, [
    (60, 260, 'dish', 'DISH · 0–10 min', dish_icons),
    (360, 300, 'pond', 'POND · 10–17 min', pond_big),
    (700, 330, 'pond', 'SAME POND · 17–25 min', pond_colony),
], ['Forms get played for 7 minutes', 'the forms were reached at 9:40 and never used; the pond gives', 'them time, and gives their tier II and III upgrades a home.',
    'Colonies at 0.1–1 mm fit the pond\'s scale: no new world.', 'Cost: the pond is built once and used twice.'])

# ---------------------------------------------------------------- B
row(500, 'B · Straight from the dish into colonies', WARN, [
    (60, 260, 'dish', 'DISH · 0–10 min', dish_icons),
    (360, 330, 'pond', 'POND · colonies · 10–20 min', pond_colony),
], ['Shorter game (about 20 min)', 'the form you took at 9:40 divides at 10:00, so you barely play it;', 'the paramecium and the stentor have nothing to do.',
    'Fewer new creatures to build.', 'Cost: about 8 tickets fewer than A.'])

# ---------------------------------------------------------------- C
row(770, 'C · A third world for colonies', WARN, [
    (60, 260, 'dish', 'DISH · 0–10 min', dish_icons),
    (360, 300, 'pond', 'POND · 10–17 min', pond_big),
    (700, 330, 'pond', 'LAKE FLOOR · 17–25 min', pond_colony),
], ['A second pull-back at 17:00', 'more spectacle, but a second world and transition to build', 'for sizes the pond already holds (Volvox ~0.5 mm, a rotifer ~0.3 mm).',
    'Cost: about 6 tickets more than A.'])

# ---------------------------------------------------------------- after multicell (sketch)
art.panel(40, 880, 1840, 180, 'LATER, ONLY A SKETCH · the road to animals starts from a sixth cell, not from our five', None)
sx, sy = 140, 975
art.mini_cell(sx, sy, 16, 'rose', halo=0.3)
for k in range(10):
    a = -math.pi / 2 + (k - 4.5) * 0.12
    art.emit(f'<line x1="{sx + 16 * math.cos(a):.1f}" y1="{sy + 16 * math.sin(a):.1f}" x2="{sx + 30 * math.cos(a):.1f}" '
             f'y2="{sy + 30 * math.sin(a):.1f}" stroke="{PALETTES["rose"][1]}" stroke-width="1.1" opacity="0.8"/>')
art.whip(sx, sy - 30, -90, 30, waves=1, amp=4, width=1.2, colour=PALETTES['rose'][1], glow=False)
art.text(sx, sy + 48, 'collar cell', 11, TEXT, 600, 'middle')
art.chevron(215, sy)
rx = 300
for k in range(8):
    a = 2 * math.pi * k / 8
    art.mini_cell(rx + 24 * math.cos(a), sy + 24 * math.sin(a), 11, 'rose', halo=0)
art.text(rx, sy + 48, 'rosette colony', 11, TEXT, 600, 'middle')
art.chevron(375, sy)
art.emit(f'<path d="M430 {sy + 30} Q 440 {sy - 40} 470 {sy - 45} Q 500 {sy - 40} 510 {sy + 30} Z" fill="url(#body-rose)" '
         f'stroke="{PALETTES["rose"][1]}" stroke-opacity="0.6"/>')
art.text(470, sy + 48, 'sponge', 11, TEXT, 600, 'middle')
art.chevron(545, sy)
art.emit(f'<ellipse cx="630" cy="{sy}" rx="60" ry="22" fill="url(#body-rose)" stroke="{PALETTES["rose"][1]}" stroke-opacity="0.7"/>')
art.text(630, sy + 48, 'Trichoplax: a crawling flat disc', 11, TEXT, 600, 'middle')
art.chevron(725, sy)
art.rotifer(800, sy, 80, heading=-90)
art.text(800, sy + 48, 'a small animal', 11, TEXT, 600, 'middle')
art.lines(900, 940, [
    'Animals come from the collar flagellates (choanoflagellates), a sixth line that is none of our five forms:',
    'some of them make rosette colonies (King et al., Nature 2008). A fourth era would start from a new collar-cell form, with sponges',
    'and Trichoplax, the simplest animal, as steps. Not for now: it needs its own world, its own roads and its own decision.',
], 12, TEXT, 18)
art.save(OUT)

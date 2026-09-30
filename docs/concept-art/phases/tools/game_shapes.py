#!/usr/bin/env python3
"""Sheet S1: three whole-game shapes as round timelines (ticket #782)."""
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL_STROKE, PICK, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/game-shapes.svg'
art = Sheet(1920, 1080, 7828, 'Evolution — phases concept S1: three whole-game shapes',
            'A: one journey, the room moves on together. B: each player outgrows the dish on their own. C: chapters picked from the lobby. '
            'Timelines in minutes, with triggers, carry-over, the wild cells and the build cost.')
art.header('concept S1 — THREE WHOLE-GAME SHAPES · round timelines',
           'Minutes from the start of a game. Dish = today\'s 10-minute round, unchanged. Pond = the big-protist chapter. Colonies = the many-celled chapter.',
           'ticket #782 · epic #761 · picks up ticket #763', 'bars are proposals, not constants')

X0, X1 = 330, 1330
MAXMIN = 26
COL = {'dish': PALETTES['cyan'][0], 'pond': '#2fae8f', 'colony': PALETTES['green'][0], 'wait': '#2a3440'}


def xm(minute):
    return X0 + (X1 - X0) * minute / MAXMIN


def bar(y, m0, m1, kind, label, h=26):
    art.emit(f'<rect x="{xm(m0):.1f}" y="{y - h / 2:.1f}" width="{xm(m1) - xm(m0) - 3:.1f}" height="{h}" rx="6" fill="{COL[kind]}" '
             f'opacity="{0.35 if kind == "wait" else 0.8}"/>')
    art.text((xm(m0) + xm(m1)) / 2, y + 4.5, label, 11.5, '#04070d' if kind != 'wait' else MUTED, 700, 'middle')


def marker(y, minute, label, colour=PICK, above=True):
    x = xm(minute)
    art.emit(f'<path d="M{x:.1f} {y - 20:.1f} V{y + 20:.1f}" stroke="{colour}" stroke-width="2"/>')
    art.emit(f'<circle cx="{x:.1f}" cy="{y - 20 if above else y + 20:.1f}" r="4" fill="{colour}"/>')
    art.text(x, y - 28 if above else y + 36, label, 10.5, colour, 600, 'middle', mono=True)


def axis(y):
    art.emit(f'<line x1="{X0}" y1="{y}" x2="{X1}" y2="{y}" stroke="{PANEL_STROKE}" stroke-width="1"/>')
    for m in range(0, MAXMIN + 1, 5):
        art.emit(f'<line x1="{xm(m):.1f}" y1="{y - 4}" x2="{xm(m):.1f}" y2="{y + 4}" stroke="{MUTED}" stroke-width="1"/>')
        art.text(xm(m), y + 18, f'{m}:00', 10, MUTED, 400, 'middle', mono=True)


def facts(x, y, rows):
    for i, (k, v) in enumerate(rows):
        art.text(x, y + i * 19, k, 11, ACCENT, 700)
        art.text(x + 108, y + i * 19, v, 11, TEXT, 400)


# ---------------------------------------------------------------- A
art.panel(40, 90, 1840, 300, 'A · ONE JOURNEY: the room moves on together   (recommended)', 'the world clock turns the page for everyone; one continuous game of about 25 minutes', stroke=GOOD)
y = 190
bar(y, 0, 10, 'dish', 'DISH · single cell (today)')
bar(y, 10, 17, 'pond', 'POND · a big protist')
bar(y, 17, 25, 'colony', 'POND · colonies')
marker(y, 9.67, '9:40 fastest form')
marker(y, 10, '10:00 all move', ACCENT, above=False)
marker(y, 17, '17:00 colonies open', ACCENT, above=False)
marker(y, 25, '25:00 results', WARN)
axis(y + 60)
art.mini_cell(xm(5), 330, 14, 'cyan', halo=0.3)
art.text(xm(5) + 24, 335, 'a protocell climbs the ladder', 10.5, MUTED, 400)
art.euglena(xm(12.2), 330, 60, heading=-20)
art.text(xm(12.2) + 40, 335, 'a form among rotifers', 10.5, MUTED, 400)
art.sphere_cells(xm(19.6), 330, 26, 60, 3.2)
art.text(xm(19.6) + 36, 335, 'a colony, a slug or a chain', 10.5, MUTED, 400)
facts(1370, 162, [('trigger', 'the world clock at 10:00 and 17:00'), ('no form yet?', 'your DNA picks one for you at 10:00'),
                  ('carries over', 'form, traits, colour, name, score'), ('resets', 'size (you are small again)'),
                  ('wild cells', 'climb with the clock, as today'), ('feel', 'one camera pull-back (sheet P1)'),
                  ('cost', 'about 42 tickets · shape part: 4')])

# ---------------------------------------------------------------- B
art.panel(40, 400, 1840, 300, 'B · OUTGROW IT YOURSELF: each player leaves the dish when they are ready', 'your own form (plus a size) is the exit; the dish keeps running for the others')
for i, (name, exit_min, pal) in enumerate((('you', 9.67, 'cyan'), ('Mira', 12.5, 'magenta'), ('Juno', 16, 'green'))):
    yy = 468 + i * 44
    art.text(X0 - 12, yy + 4, name, 11.5, PALETTES[pal][1], 700, 'end')
    bar(yy, 0, exit_min, 'dish', 'dish', 22)
    bar(yy, exit_min, 21, 'pond', 'pond', 22)
    bar(yy, 21, 25, 'colony', 'colonies', 22)
    marker(yy, exit_min, '', PICK)
art.text(xm(12.5), 456, 'each exit is personal', 10.5, PICK, 600, 'middle', mono=True)
axis(640)
facts(1370, 472, [('trigger', 'your form, plus a size threshold'), ('laggards', 'stay in the dish; it gets emptier'),
                  ('carries over', 'form, traits, colour, name, score'), ('wild cells', 'two worlds, two clocks'),
                  ('feel', 'your own moment; friends split up'), ('cost', 'about 48 tickets · shape part: 10'),
                  ('risk', 'two worlds per room: server + camera')])

# ---------------------------------------------------------------- C
art.panel(40, 710, 1840, 300, 'C · CHAPTERS: pick the era in the lobby', 'three separate rounds; a "campaign" room can chain them with results screens between')
for i, (kind, label, m0, m1) in enumerate((('dish', 'Chapter 1 · DISH', 0, 10), ('pond', 'Chapter 2 · POND', 0, 10),
                                           ('colony', 'Chapter 3 · COLONIES', 0, 10))):
    yy = 780 + i * 44
    bar(yy, m0, m1, kind, label, 22)
    note = ('as today', 'its own room and leaderboard · you start as a form', 'its own room and leaderboard · you start as 4 cells')[i]
    art.text(xm(10.4), yy + 4, note, 10.5, MUTED, 400, mono=True)
axis(940)
facts(1370, 782, [('trigger', 'you choose; no in-game transition'), ('carries over', 'nothing (campaign: form + score)'),
                  ('wild cells', 'each chapter has its own clock'), ('feel', 'a menu, not a journey'),
                  ('cost', 'about 40 tickets · shape part: 2'), ('good for', 'a later "skip ahead" for veterans')])

art.text(40, 1040, 'Content is the same in all three (the pond, its creatures, three roads and the ciliate upgrades, about 38 tickets); '
         'the shapes differ in the part that moves players between worlds.', 11.5, MUTED)
art.save(OUT)

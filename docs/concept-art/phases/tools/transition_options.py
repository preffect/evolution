#!/usr/bin/env python3
"""Sheet S3: three ways the dish-to-pond move could feel, four frames each (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/transition-options.svg'
art = Sheet(1920, 1080, 7830, 'Evolution — phases concept S3: three ways the move to the pond could feel',
            'A: one continuous camera pull-back. B: a results screen, then a chapter card. C: seamless, the pond fades in around you '
            'while you keep playing. Four frames each. Code-drawn.')
art.header('concept S3 — HOW THE MOVE FEELS · three options, four frames each',
           'The same moment in each row: the dish era ends, and you arrive in the pond.',
           'ticket #782 · epic #761', 'dark-field language of sheets 01 and 04 · zero raster')
FW, FH = 330, 190
XS = (340, 730, 1120, 1510)


def dish_close(x, y):
    art.frame_open(x, y, FW, FH)
    for _ in range(14):
        art.mote(x + art.rng.uniform(10, FW - 10), y + art.rng.uniform(10, FH - 10), 2.4, 0.8)
    art.euglena(x + 150, y + 100, 150, heading=-20)
    art.emit(f'<circle cx="{x - 500}" cy="{y + 95}" r="790" fill="none" stroke="{ACCENT}" stroke-width="3" opacity="0.8"/>')


def pond_arrival(x, y):
    art.frame_open(x, y, FW, FH, 'pond')
    for _ in range(18):
        art.chlamy(x + art.rng.uniform(15, FW - 15), y + art.rng.uniform(15, FH - 15), 2.6, heading=art.rng.uniform(0, 360))
    art.rotifer(x + 260, y + 120, 110, heading=-140)
    art.euglena(x + 140, y + 95, 48, heading=-25)


def close(x, y, n, title, colour=ACCENT):
    art.frame_close(x, y, FW, FH, n, title, [], colour)


def row_label(y, letter, name, lines, colour):
    art.text(40, y + 30, f'{letter} · {name}', 16, colour, 700)
    art.lines(40, y + 56, lines, 11.5, TEXT, 17)


# ---------------------------------------------------------------- A · pull back
y = 110
row_label(y, 'A', 'Pull back', ['one continuous camera move', 'about 4 s without control', 'the storyboard (sheet P1)', 'recommended: it shows the', 'scale, which is the lesson'], GOOD)
dish_close(XS[0], y)
close(XS[0], y, 1, 'the rim glows')
art.frame_open(XS[1], y, FW, FH)
art.dish(XS[1] + 165, y + 95, 75)
close(XS[1], y, 2, 'the whole dish')
art.frame_open(XS[2], y, FW, FH, 'pond')
art.filament(XS[2] - 10, y + 140, 360, heading=-12, cell_len=36)
art.emit(f'<circle cx="{XS[2] + 165}" cy="{y + 100}" r="24" fill="url(#drop-g)"/>')
art.dish(XS[2] + 165, y + 100, 16, crowd=False, glow=1.0)
art.rotifer(XS[2] + 260, y + 90, 70, heading=-120)
close(XS[2], y, 3, 'one drop in a pond', GOOD)
pond_arrival(XS[3], y)
close(XS[3], y, 4, 'you, small again', GOOD)

# ---------------------------------------------------------------- B · chapter card
y = 420
row_label(y, 'B', 'Chapter card', ['results for the dish (20 s),', 'then a title card with one', 'real fact, then the pond', 'clear and calm, but a stop', 'in the middle of the game'], WARN)
dish_close(XS[0], y)
close(XS[0], y, 1, 'the dish era ends')
art.frame_open(XS[1], y, FW, FH)
art.emit(f'<rect x="{XS[1] + 40}" y="{y + 30}" width="250" height="130" rx="8" fill="{PANEL}" stroke="{ACCENT}" stroke-opacity="0.5"/>')
art.text(XS[1] + 165, y + 56, 'DISH RESULTS', 12, ACCENT, 700, 'middle')
for i, (name, pal) in enumerate((('Mira', 'magenta'), ('you', 'cyan'), ('Oskar', 'amber'))):
    art.emit(f'<circle cx="{XS[1] + 80}" cy="{y + 80 + i * 24}" r="5" fill="{PALETTES[pal][0]}"/>')
    art.text(XS[1] + 92, y + 84 + i * 24, f'{i + 1}  {name}', 11.5, TEXT, 500)
close(XS[1], y, 2, 'results, 20 s')
art.frame_open(XS[2], y, FW, FH, 'pond')
art.text(XS[2] + 165, y + 80, 'CHAPTER 2', 13, ACCENT, 700, 'middle')
art.text(XS[2] + 165, y + 106, 'The Pond', 22, TEXT, 700, 'middle')
art.text(XS[2] + 165, y + 134, 'Your dish was one drop of pond water.', 11, MUTED, 400, 'middle')
close(XS[2], y, 3, 'title card, 4 s')
pond_arrival(XS[3], y)
close(XS[3], y, 4, 'fade in')

# ---------------------------------------------------------------- C · seamless
y = 730
row_label(y, 'C', 'Seamless', ['you never stop playing: the', 'pond fades in around you and', 'the camera eases out', 'smooth, but the jump in scale', 'is easy to miss or misread'], WARN)
dish_close(XS[0], y)
close(XS[0], y, 1, 'play on')
for k, fade in ((1, 0.35), (2, 0.75)):
    x = XS[k]
    art.frame_open(x, y, FW, FH)
    art.emit(f'<rect x="{x}" y="{y}" width="{FW}" height="{FH}" fill="url(#bg-pond)" opacity="{fade}"/>')
    for _ in range(int(20 * fade)):
        art.chlamy(x + art.rng.uniform(15, FW - 15), y + art.rng.uniform(15, FH - 15), 2.6, heading=art.rng.uniform(0, 360))
    art.emit(f'<circle cx="{x - 500}" cy="{y + 95}" r="790" fill="none" stroke="{ACCENT}" stroke-width="3" opacity="{0.8 - fade:.2f}"/>')
    art.euglena(x + 160, y + 100, 150 - 70 * fade, heading=-20)
    close(x, y, k + 1, 'the rim dissolves' if k == 1 else 'the pond around you')
pond_arrival(XS[3], y)
close(XS[3], y, 4, 'already playing')
for yy in (110, 420, 730):
    for k in range(3):
        art.chevron(XS[k] + FW + 30, yy + FH / 2)
art.save(OUT)

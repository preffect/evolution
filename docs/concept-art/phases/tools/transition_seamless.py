#!/usr/bin/env python3
"""Sheet P1b: the chosen dish-to-pool move, seamless, six frames (ticket #786 C; docs/game-design/phases.md §14.4)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/transition-seamless.svg'
art = Sheet(1920, 1080, 7864, 'Evolution — phases concept P1b: the seamless move from the dish to the rock pool',
            'Six frames from the warning at 9:50 to playing in the rock pool at 10:12. The player keeps control throughout: '
            'the rim dissolves, the pool fades in and the camera eases out by ten, so the dish shrinks to a ring of crumbs '
            'beside a rotifer as big as it. Code-drawn.')
art.header('concept P1b — THE SEAMLESS MOVE · chosen on ticket #786 (C)',
           'You never stop steering. The size jump is read from the world around you: the dish shrinks to a tenth, its giants become crumbs, a rotifer as big as the old dish sits beside it.',
           'decided: ticket #786 C · design: docs/game-design/phases.md §14.4', 'timings are tuning values (§14.14) · zero raster')

FW, FH = 580, 330
COLS = (40, 670, 1300)
ROWS = (100, 575)


def pointer(x, y):
    """The player's steering pointer: they are steering in every frame."""
    art.emit(f'<path d="M{x} {y} l0 16 l4.5 -4 l3.5 7 l3 -1.5 l-3.5 -7 l6 0 Z" fill="{TEXT}" stroke="#04070d" stroke-width="1" opacity="0.9"/>')


def wild_cells(x, y, w, h, count, r_lo, r_hi, avoid):
    for _ in range(count):
        cx, cy = x + art.rng.uniform(20, w - 20), y + art.rng.uniform(20, h - 20)
        if math.hypot(cx - avoid[0], cy - avoid[1]) > avoid[2]:
            art.mini_cell(cx, cy, art.rng.uniform(r_lo, r_hi), 'amber', nucleus=True, halo=0.15)


def pool_overlay(x, y, strength):
    art.emit(f'<rect x="{x}" y="{y}" width="{FW}" height="{FH}" fill="url(#bg-pond)" opacity="{strength:.2f}"/>')
    for i in range(3):
        bx = x + FW * (0.12 + 0.28 * i)
        art.emit(f'<polygon points="{bx:.0f},{y} {bx + FW * 0.12:.0f},{y} {bx + FW * 0.3:.0f},{y + FH} {bx + FW * 0.16:.0f},{y + FH}" '
                 f'fill="url(#sunbeam)" opacity="{strength:.2f}"/>')


def green_specks(x, y, count, spread_x, spread_y, size=2.6):
    for _ in range(count):
        art.chlamy(x + art.rng.uniform(-spread_x, spread_x), y + art.rng.uniform(-spread_y, spread_y), size, heading=art.rng.uniform(0, 360))


def footprint(cx, cy, r, crumbs=True, opacity=0.8):
    art.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{ACCENT}" stroke-width="1.6" '
             f'stroke-dasharray="5 5" opacity="{opacity}"/>')
    if crumbs:
        for _ in range(int(14 + r * 0.1)):
            a, rr = art.rng.uniform(0, 2 * math.pi), r * math.sqrt(art.rng.uniform(0, 0.85))
            art.speck(cx + rr * math.cos(a), cy + rr * math.sin(a), min(3.2, max(1.4, r * 0.03)), '#8dff6a', 0.85)


def scale_bar(x, y, px, label):
    art.emit(f'<rect x="{x - 8}" y="{y - 24}" width="{px + 16:.0f}" height="44" rx="6" fill="#04070d" opacity="0.55"/>')
    art.scale_bar(x, y, px, label)


# ---------------------------------------------------------------- 1 · the warning
x, y = COLS[0], ROWS[0]
art.frame_open(x, y, FW, FH)
pool_overlay(x, y, 0.18)
for _ in range(24):
    art.mote(x + art.rng.uniform(10, FW - 10), y + art.rng.uniform(10, FH - 10), 3, 0.8)
wild_cells(x, y, FW, FH, 12, 9, 18, (x + 300, y + 170, 140))
art.emit(f'<circle cx="{x - 700}" cy="{y + 150}" r="1200" fill="none" stroke="{ACCENT}" stroke-width="12" opacity="0.25" filter="url(#blur-10)"/>')
art.emit(f'<circle cx="{x - 700}" cy="{y + 150}" r="1200" fill="none" stroke="{ACCENT}" stroke-width="1.6" opacity="0.95"/>')
art.euglena(x + 300, y + 165, 240, heading=-25)
pointer(x + 470, y + 90)
art.caption_banner(x + 290, y + 52, 'THE DISH IS BREAKING UP', 15)
art.frame_close(x, y, FW, FH, 1, '9:50 · The warning, and you keep playing',
                ['The rim thins and brightens; the pool\'s light already shows', 'through the dark field; the music swells. Ten seconds to go.'])

# ---------------------------------------------------------------- 2 · the rim dissolves
x = COLS[1]
art.frame_open(x, y, FW, FH)
pool_overlay(x, y, 0.5)
for _ in range(18):
    art.mote(x + art.rng.uniform(10, FW - 10), y + art.rng.uniform(10, FH - 10), 3, 0.6)
green_specks(x + 290, y + 165, 10, 260, 140)
rx, ry, rr = x - 700, y + 150, 1200
for k in range(16):
    a0 = -0.22 + k * 0.03
    drift = 6 + 4 * (k % 3)
    cx, cy = rx + (rr + drift) * math.cos(a0), ry + (rr + drift) * math.sin(a0)
    art.emit(f'<path d="M{cx:.1f} {cy - 11:.1f} L{cx + 3:.1f} {cy + 11:.1f}" stroke="{ACCENT}" stroke-width="2.4" '
             f'opacity="{0.35 + 0.04 * (k % 4):.2f}" stroke-linecap="round"/>')
art.euglena(x + 300, y + 165, 230, heading=-20)
pointer(x + 480, y + 70)
art.frame_close(x, y, FW, FH, 2, '10:00 · The rim dissolves; you are in the pool',
                ['One tick: the dish is now a disc at the pool\'s centre and everyone', 'arrives at the same small size. The wall drifts away in pieces.'], GOOD)

# ---------------------------------------------------------------- 3 · the camera starts to ease out
x = COLS[2]
art.frame_open(x, y, FW, FH, 'pond')
fx, fy, fr = x + 300, y + 175, 230
art.rotifer(fx + fr + 120, fy + 20, 300, heading=-150)
footprint(fx, fy, fr)
art.euglena(fx - 10, fy - 10, 110, heading=-25)
pointer(fx + 120, fy - 110)
art.caption_banner(x + 290, y + 34, 'YOUR DISH WAS ONE POCKET OF SLIME ON A KELP BLADE', 12)
scale_bar(x + 30, y + 300, 300, 'THE DISH')
art.frame_close(x, y, FW, FH, 3, '10:01 · The camera eases out by ten',
                ['It starts magnified so the dish\'s outline sits where the rim was,', 'then eases out over 4 s. The dish visibly shrinks while you steer.'], GOOD)

# ---------------------------------------------------------------- 4 · eased out: the footprint and the landmark
x, y = COLS[0], ROWS[1]
art.frame_open(x, y, FW, FH, 'pond')
fx, fy, fr = x + 290, y + 175, 46
art.cladophora(x + 340, y + 320, 260, heading=-60, cell_len=30)
green_specks(x + 110, y + 90, 16, 50, 30, 2.8)
green_specks(x + 470, y + 260, 12, 45, 30, 2.8)
footprint(fx, fy, fr)
art.rotifer(fx + 95, fy - 5, 100, heading=-115)
art.euglena(fx - 70, fy + 40, 44, heading=-30)
pointer(fx - 150, fy + 5)
art.text(fx, fy - fr - 12, 'your whole dish', 11.5, ACCENT, 600, 'middle')
art.text(fx + 130, fy + 82, 'a rotifer, just as big', 11.5, PALETTES['rose'][1], 600, 'start')
scale_bar(x + 30, y + 300, 30, '× 10')
art.frame_close(x, y, FW, FH, 4, '10:04 · The dish is a ring of crumbs',
                ['Its wild cells and giants are now the green specks inside the ring.', 'Beside it, the landmark: one rotifer, as wide as your old world.'], GOOD)

# ---------------------------------------------------------------- 5 · the grace ends
x = COLS[1]
art.frame_open(x, y, FW, FH, 'pond')
art.cladophora(x + 330, y + 40, 260, heading=40, cell_len=30)
green_specks(x + 160, y + 110, 20, 90, 50, 2.8)
footprint(x + 120, y + 250, 40, opacity=0.45)
art.didinium(x + 430, y + 230, 22, heading=200)
art.nematode(x + 40, y + 60, 200, heading=10, waves=1.4)
art.euglena(x + 300, y + 170, 46, heading=-30)
pointer(x + 380, y + 120)
art.mini_cell(x + 220, y + 250, 16, 'magenta', halo=0.4)
art.paramecium(x + 380, y + 280, 42, heading=-150, pal='cyan')
art.arrow(x + 410, y + 238, x + 395, y + 270, WARN, 1.4, dashed=True)
art.frame_close(x, y, FW, FH, 5, '10:08 · The grace ends',
                ['For 8 s nothing hunted you. Now the Didinium looks for ciliates,', 'the nematode thrashes past, and the rotifer\'s whirlpool turns on.'], GOOD)

# ---------------------------------------------------------------- 6 · already playing
x = COLS[2]
art.frame_open(x, y, FW, FH, 'pond')
art.cladophora(x + 10, y + 280, 320, heading=-25, cell_len=34)
green_specks(x + 380, y + 120, 26, 140, 70, 3)
art.rotifer(x + 480, y + 250, 120, heading=-150)
art.euglena(x + 260, y + 170, 56, heading=-30)
pointer(x + 330, y + 110)
art.chip(x + 40, y + 34, 'THE ROCK POOL · 14:48 LEFT', ACCENT)
art.frame_close(x, y, FW, FH, 6, '10:12 · The ring fades; you are just playing',
                ['Form, colour, traits and score came with you; size did not.', 'The era chip beside the timer says where you are.'], GOOD)

# ---------------------------------------------------------------- timing strip
TY = 1004
X0, X1, SPAN = 330, 1700, 22.0  # seconds from 9:50
art.text(40, TY + 4, 'TIMING (seconds from 9:50)', 11, ACCENT, 700)
art.emit(f'<line x1="{X0}" y1="{TY}" x2="{X1}" y2="{TY}" stroke="{MUTED}" stroke-width="1"/>')


def span(t0, t1, row, label, colour):
    xa, xb = X0 + (X1 - X0) * t0 / SPAN, X0 + (X1 - X0) * t1 / SPAN
    yy = TY - 18 + 12 * row
    art.emit(f'<rect x="{xa:.1f}" y="{yy - 5}" width="{max(3, xb - xa - 3):.1f}" height="10" rx="5" fill="{colour}" opacity="0.45"/>')
    art.text(xa + 4, yy - 8, label, 10, TEXT, 500, mono=True) if row == 0 else art.text(xb + 6, yy + 4, label, 10, TEXT, 500, mono=True)


span(0, 10, 0, 'warning 10 s', WARN)
span(10, 11.5, 0, 'rim 1.5 s', ACCENT)
span(10, 12, 1, 'pool fades in 2 s', ACCENT)
span(10, 14, 2, 'camera eases out 4 s', ACCENT)
span(10, 18, 3, 'grace 8 s', GOOD)
span(10, 22, 4, 'footprint ring 12 s', MUTED)
art.emit(f'<rect x="{X0}" y="{TY + 44}" width="{X1 - X0}" height="6" rx="3" fill="{GOOD}" opacity="0.7"/>')
art.text(X0 + (X1 - X0) / 2, TY + 40, 'input ON the whole time: no lock, no card', 10.5, GOOD, 700, 'middle', mono=True)
art.save(OUT)

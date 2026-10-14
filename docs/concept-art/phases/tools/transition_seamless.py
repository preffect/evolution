#!/usr/bin/env python3
"""Sheet P1b: the chosen dish-to-pool move, seamless, six frames (ticket #786 C; docs/game-design/phases.md §14.4)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/transition-seamless.svg'
art = Sheet(1920, 1080, 7864, 'Evolution — phases concept P1b: the seamless move from the dish to the rock pool',
            'Six frames from the warning at 9:50 to playing in the rock pool at 10:12. The player keeps control throughout: '
            'the rim dissolves, the pool fades in and the camera eases out about 6x until the whole dish fits on one screen, '
            'a ring of crumbs beside a rotifer as wide as it. Code-drawn.')
art.header('concept P1b — THE SEAMLESS MOVE · chosen on ticket #786 (C)',
           'You never stop steering. The camera eases out about 6× until the whole dish fits on one screen: its giants become crumbs, and a rotifer as wide as the old dish sits beside it.',
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
scale_bar(x + 30, y + 300, 232, 'THE DISH')
art.frame_close(x, y, FW, FH, 3, '10:01 · The camera eases out',
                ['It starts magnified so the dish\'s outline sits where the rim was,', 'then eases out over 4 s. The dish visibly shrinks while you steer.'], GOOD)

# ---------------------------------------------------------------- 4 · eased out: the footprint and the landmark
# Scale after the ease (phases.md §14.4.4): the view's half-height is ~395 pool wu = 165 px, so the footprint (300 wu)
# is a ring of radius ~125 px, about three quarters of the view's height, and the landmark (radius 300 wu, 650 wu east)
# is ~125 px wide at ~272 px from the ring's centre: cut off by the frame's right edge.
PX_PER_WU = (FH / 2) / 395
RING_R = 300 * PX_PER_WU
LANDMARK_DX = 650 * PX_PER_WU
x, y = COLS[0], ROWS[1]
art.frame_open(x, y, FW, FH, 'pond')
fx, fy = x + 290, y + 160
art.cladophora(x + 30, y + 250, 120, heading=-60, cell_len=26, depth=0)
green_specks(x + 70, y + 70, 10, 30, 22, 2.6)
footprint(fx, fy, RING_R)
art.rotifer(fx + LANDMARK_DX, fy, 2 * RING_R, heading=-90)
art.euglena(fx - 30, fy + 30, 30, heading=-30)
pointer(fx + 40, fy - 60)
art.text(fx, fy - RING_R - 8, 'your whole dish', 11.5, ACCENT, 600, 'middle')
art.text(x + FW - 66, y + FH - 14, 'the landmark, as wide as the dish', 11.5, PALETTES['rose'][1], 600, 'end')
scale_bar(x + 22, y + 306, 0.4 * FW, 'THE DISH')
art.frame_close(x, y, FW, FH, 4, '10:04 · The whole dish fits on one screen',
                ['Its wild cells and giants are now the green specks inside the ring.', 'Beside it, the landmark: one rotifer, as wide as your old world.'], GOOD)

# ---------------------------------------------------------------- 5 · the grace ends
x = COLS[1]
art.frame_open(x, y, FW, FH, 'pond')
fx, fy = x + 290, y + 175
footprint(fx, fy, RING_R, opacity=0.45)
art.rotifer(fx + LANDMARK_DX, fy, 2 * RING_R, heading=-90)
art.nematode(x + 30, y + 40, 200, heading=8, waves=1.4)
art.euglena(fx + 10, fy - 20, 30, heading=-30)
pointer(fx + 70, fy - 70)
art.paramecium(fx - 120, fy + 110, 32, heading=-150, pal='cyan')
art.didinium(fx - 50, fy + 130, 16, heading=200)
art.arrow(fx - 62, fy + 126, fx - 100, fy + 112, WARN, 1.4, dashed=True)
art.rotifer(x + 70, y + 250, 70, heading=-60)
for k in range(3):
    art.emit(f'<ellipse cx="{x + 92}" cy="{y + 222}" rx="{20 + 12 * k}" ry="{12 + 7 * k}" fill="none" stroke="{WARN}" '
             f'stroke-width="1" opacity="{0.4 - 0.1 * k:.2f}" stroke-dasharray="6 5" transform="rotate(-60 {x + 92} {y + 222})"/>')
art.frame_close(x, y, FW, FH, 5, '10:08 · The grace ends',
                ['For 8 s nothing hunted you. Now the Didinium looks for ciliates and the', 'roaming rotifers\' whirlpools turn on; the landmark never pulls.'], GOOD)

# ---------------------------------------------------------------- 6 · already playing
x = COLS[2]
art.frame_open(x, y, FW, FH, 'pond')
fx, fy = x + 290, y + 170
footprint(fx, fy, RING_R, crumbs=False, opacity=0.12)
art.cladophora(x + 10, y + 310, 220, heading=-20, cell_len=30, depth=1)
green_specks(x + 120, y + 100, 22, 70, 40, 3)
art.rotifer(fx + LANDMARK_DX, fy, 2 * RING_R, heading=-90)
art.euglena(fx + 60, fy + 10, 32, heading=-30)
pointer(fx + 120, fy - 50)
art.chip(x + 40, y + 34, 'THE ROCK POOL · 14:48 LEFT', ACCENT)
art.frame_close(x, y, FW, FH, 6, '10:12 · The ring fades; you are just playing',
                ['Form, colour, traits and score came with you; size did not.', 'The era chip beside the timer says where you are.'], GOOD)

# ---------------------------------------------------------------- timing strip
TY = 978
X0, X1, SPAN = 330, 1700, 22.0  # seconds from 9:50
art.text(40, TY + 34, 'TIMING (seconds from 9:50)', 11, ACCENT, 700)


def span(t0, t1, row, label, colour):
    """One bar per row; its label sits to the bar's left (the warning's inside its own bar)."""
    xa, xb = X0 + (X1 - X0) * t0 / SPAN, X0 + (X1 - X0) * t1 / SPAN
    yy = TY + 10 * row
    art.emit(f'<rect x="{xa:.1f}" y="{yy - 3.5}" width="{max(3, xb - xa - 3):.1f}" height="7" rx="3.5" fill="{colour}" opacity="0.5"/>')
    if xa <= X0:
        art.text(xa + 6, yy + 3.5, label, 9.5, TEXT, 600, mono=True)
    else:
        art.text(xa - 6, yy + 3.5, label, 9.5, TEXT, 500, 'end', mono=True)


span(0, 10, 0, 'warning 10 s', WARN)
span(10, 11.5, 1, 'rim dissolves 1.5 s', ACCENT)
span(10, 12, 2, 'pool fades in 2 s', ACCENT)
span(10, 14, 3, 'camera eases out 4 s', ACCENT)
span(10, 15, 4, 'caption 5 s', ACCENT)
span(10, 18, 5, 'grace 8 s', GOOD)
span(10, 22, 6, 'footprint ring 12 s', MUTED)
art.emit(f'<rect x="{X0}" y="{TY + 70}" width="{X1 - X0}" height="6" rx="3" fill="{GOOD}" opacity="0.7"/>')
art.text(X0 + (X1 - X0) / 2, TY + 92, 'input ON the whole time: no lock, no card', 10.5, GOOD, 700, 'middle', mono=True)
art.save(OUT)

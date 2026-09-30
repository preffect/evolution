#!/usr/bin/env python3
"""Sheet P1: the dish-to-pond transition storyboard, six frames (ticket #782, recommended shape A)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/transition-storyboard.svg'
art = Sheet(1920, 1080, 7822, 'Evolution — phases concept P1: outgrowing the dish, a storyboard',
            'Six frames from taking a form in the dish to arriving in the pond: the camera pulls back until the dish is one drop, '
            'the drop opens, and the player is small again. Code-drawn.')
art.header('concept P1 — OUTGROWING THE DISH · the transition, six frames',
           'Recommended shape A: the whole room moves on together when the dish era ends (10:00). One continuous camera move, no loading card. About 9 seconds.',
           'ticket #782 · epic #761 · a concept for a decision, not a spec', 'dark-field language of sheets 01 and 04 · zero raster')

FW, FH = 580, 330
COLS = (40, 670, 1300)
ROWS = (100, 575)


def wild_cells(x, y, w, h, count, r_lo, r_hi, pal='amber', avoid=None):
    for _ in range(count):
        cx, cy = x + art.rng.uniform(20, w - 20), y + art.rng.uniform(20, h - 20)
        if avoid and math.hypot(cx - avoid[0], cy - avoid[1]) < avoid[2]:
            continue
        art.mini_cell(cx, cy, art.rng.uniform(r_lo, r_hi), pal, nucleus=True, halo=0.15)


def motes(x, y, w, h, count, r):
    for _ in range(count):
        art.mote(x + art.rng.uniform(10, w - 10), y + art.rng.uniform(10, h - 10), r, 0.8)


def dish_rim_arc(cx, cy, r, glow):
    art.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{ACCENT}" stroke-width="{10 * glow:.1f}" '
             f'opacity="{0.25 * glow:.2f}" filter="url(#blur-10)"/>')
    art.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{ACCENT}" stroke-width="{2 + 2 * glow:.1f}" opacity="0.85"/>')


# ---------------------------------------------------------------- 1 · a form in the dish
x, y = COLS[0], ROWS[0]
art.frame_open(x, y, FW, FH)
motes(x, y, FW, FH, 26, 3)
wild_cells(x, y, FW, FH, 14, 9, 18, avoid=(x + 300, y + 170, 130))
dish_rim_arc(x - 700, y + 150, 1200, 0.2)
art.euglena(x + 300, y + 165, 250, heading=-25)
art.chip(x + 40, y + 305, 'NEW FORM: EUGLENA', GOOD)
art.frame_close(x, y, FW, FH, 1, '9:40 · You take a form, and fill the screen',
                ['The paramecium and the euglena are adult protists; the dish, its motes and', 'its wild cells stayed small. The rim is already in view.'])

# ---------------------------------------------------------------- 2 · the rim glows
x = COLS[1]
art.frame_open(x, y, FW, FH)
motes(x, y, FW, FH, 26, 3)
wild_cells(x, y, FW, FH, 14, 9, 18, avoid=(x + 300, y + 170, 130))
dish_rim_arc(x - 700, y + 150, 1200, 1.0)
art.euglena(x + 300, y + 165, 250, heading=-25)
art.caption_banner(x + 290, y + 60, 'You have outgrown the dish', 17)
art.emit(f'<rect x="{x + 30}" y="{y + 300}" width="520" height="8" rx="4" fill="{PALETTES["ghost"][2]}"/>')
art.emit(f'<rect x="{x + 30}" y="{y + 300}" width="490" height="8" rx="4" fill="{ACCENT}" opacity="0.8"/>')
art.text(x + 555, y + 294, '0:05', 11, ACCENT, 600, 'end', mono=True)
art.frame_close(x, y, FW, FH, 2, '9:55 · The dish era is ending, for the whole room',
                ['A five-second warning while you still play: the rim brightens,', 'the music swells. At 10:00 everyone moves on; nobody is left behind.'])

# ---------------------------------------------------------------- 3 · pull back: the whole dish
x = COLS[2]
art.frame_open(x, y, FW, FH)
dcx, dcy, dr = x + 290, y + 170, 140
art.dish(dcx, dcy, dr)
for (px, py, pal) in ((dcx + 10, dcy - 5, 'cyan'), (dcx - 60, dcy + 50, 'magenta'), (dcx + 70, dcy + 60, 'amber')):
    art.mini_cell(px, py, 8, pal, halo=0.5)
art.text(dcx + 22, dcy - 14, 'you', 11, ACCENT, 600)
art.arrow(dcx - 200, dcy - 110, dcx - 150, dcy - 70, ACCENT, 1.6)
art.arrow(dcx + 200, dcy + 110, dcx + 150, dcy + 70, ACCENT, 1.6)
art.frame_close(x, y, FW, FH, 3, 'Pull back · the dish shrinks to a disc',
                ['The camera zooms out about ten times in two seconds.', 'Every player is a dot; the dish glows like a lens.'])

# ---------------------------------------------------------------- 4 · the dish was one drop
x, y = COLS[0], ROWS[1]
art.frame_open(x, y, FW, FH, 'pond')
art.filament(x - 20, y + 250, 640, heading=-12, cell_len=60)
drop_x, drop_y = x + 300, y + 175
art.emit(f'<circle cx="{drop_x}" cy="{drop_y}" r="46" fill="url(#drop-g)"/>')
art.dish(drop_x, drop_y, 30, crowd=True, glow=1.0)
art.emit(f'<circle cx="{drop_x}" cy="{drop_y}" r="46" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.6"/>')
for (bx, by, br) in ((x + 90, y + 90, 14), (x + 470, y + 80, 20), (x + 500, y + 250, 12), (x + 150, y + 290, 9)):
    art.emit(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="url(#drop-g)" opacity="0.7"/>')
art.rotifer(x + 470, y + 190, 120, heading=-120)
for i in range(18):
    art.chlamy(x + 100 + 12 * math.cos(i) * (1 + i % 4), y + 170 + 10 * math.sin(i * 1.7) * (1 + i % 3), 3, heading=i * 40)
art.text(drop_x, drop_y + 66, 'your dish', 11.5, ACCENT, 600, 'middle')
art.frame_close(x, y, FW, FH, 4, 'Further · your dish was one drop in a pond',
                ['A drop of water clinging to an algal thread. Around it: the pond,', 'green swimmers, a rotifer the size of the dish itself.'], GOOD)

# ---------------------------------------------------------------- 5 · the drop opens
x = COLS[1]
art.frame_open(x, y, FW, FH, 'pond')
art.filament(x - 20, y + 250, 640, heading=-12, cell_len=60)
drop_x, drop_y = x + 290, y + 170
for k in range(10):
    a0 = 2 * math.pi * k / 10 + 0.2
    art.emit(f'<path d="M{drop_x + 70 * math.cos(a0):.1f} {drop_y + 70 * math.sin(a0):.1f} A70 70 0 0 1 '
             f'{drop_x + 70 * math.cos(a0 + 0.35):.1f} {drop_y + 70 * math.sin(a0 + 0.35):.1f}" fill="none" stroke="#ffffff" '
             f'stroke-width="1.6" opacity="0.55"/>')
for k in range(40):
    a0 = art.rng.uniform(0, 2 * math.pi)
    rr = art.rng.uniform(20, 120)
    art.speck(drop_x + rr * math.cos(a0), drop_y + rr * math.sin(a0), 1.6, art.rng.choice(('#8dff6a', '#ffd8a8', '#a6f4ff')), 0.8)
art.mini_cell(drop_x + 18, drop_y - 6, 10, 'cyan', halo=0.6)
art.arrow(drop_x + 60, drop_y - 90, drop_x + 25, drop_y - 30, ACCENT, 1.6)
art.text(drop_x + 64, drop_y - 96, 'you', 11, ACCENT, 600)
art.frame_close(x, y, FW, FH, 5, 'The drop opens into the pond',
                ['Its surface breaks; the dish spills out. The camera turns and', 'pushes in on you. Your wild rivals scatter as specks.'], GOOD)

# ---------------------------------------------------------------- 6 · the pond, you are 1× again
x = COLS[2]
art.frame_open(x, y, FW, FH, 'pond')
for i in range(40):
    art.chlamy(x + art.rng.uniform(20, FW - 20), y + art.rng.uniform(20, FH - 20), 3.2, heading=art.rng.uniform(0, 360))
art.filament(x + 330, y + 40, 300, heading=30, cell_len=34)
art.rotifer(x + 470, y + 230, 150, heading=-150)
art.didinium(x + 120, y + 250, 20, heading=-20)
art.euglena(x + 270, y + 160, 72, heading=-30)
art.chip(x + 44, y + 27, 'THE POND · CHAPTER 2', ACCENT)
art.text(x + 20, y + 318, 'the dish\'s wild cells are now the green specks you eat', 11, TEXT, 500)
art.frame_close(x, y, FW, FH, 6, '10:04 · The pond. You are small again, and hungry',
                ['Your form, colour, traits and score came with you; your size did not.', 'Rotifers and Didinium hunt here. Input returns; the pond clock starts.'], GOOD)

# ---------------------------------------------------------------- timing strip
TY = 1020
steps = [('2 · warning, still playing 5 s', 0, 5), ('3 · pull back 2 s', 5, 7), ('4 · the drop 1 s', 7, 8),
         ('5 · opens 1 s', 8, 9), ('6 · play', 9, 10)]
X0, X1 = 360, 1880
art.text(40, TY + 4, 'TIMING (seconds from 9:55)', 11, ACCENT, 700)
art.emit(f'<line x1="{X0}" y1="{TY}" x2="{X1}" y2="{TY}" stroke="{MUTED}" stroke-width="1"/>')
for name, t0, t1 in steps:
    xa = X0 + (X1 - X0) * t0 / 10
    xb = X0 + (X1 - X0) * t1 / 10
    art.emit(f'<rect x="{xa:.1f}" y="{TY - 6}" width="{max(3, xb - xa - 4):.1f}" height="12" rx="6" fill="{ACCENT}" opacity="0.35"/>')
    art.text(xa + 4, TY - 12, name, 10.5, TEXT, 500, mono=True)
art.text(X0 + (X1 - X0) * 0.7, TY + 22, 'input off for 4 s only (10:00 to 10:04) · the pull back is the reward, keep it short', 10.5, WARN, 500, 'middle', mono=True)
art.save(OUT)

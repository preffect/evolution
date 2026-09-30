#!/usr/bin/env python3
"""Mock P3: a game screen in the pond, the player's euglena to scale, with today's HUD chrome (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL, PICK, TEXT, WARN, Sheet, smooth_closed

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/pond-screen.svg'
art = Sheet(1920, 1080, 7823, 'Evolution — phases mock P3: a game screen in the pond',
            'The pond chapter at play scale: the player\'s euglena at the centre, green swimmers as food, a rotifer whirlpool, '
            'a Didinium, a nematode, a wild stentor on an algal thread, a Daphnia about to sweep a lane. Code-drawn.',
            background='pond')
W, H = 1920, 1080

# the muddy floor, bottom right, with its bacteria film (food carpet)
floor = [(700, 1080), (820, 1010), (1050, 975), (1350, 960), (1600, 930), (1920, 900), (1920, 1080)]
art.emit(f'<path d="M{floor[0][0]} {floor[0][1]} ' + ' '.join(f'L{x} {y}' for x, y in floor[1:]) + ' Z" fill="#2a2214" opacity="0.75"/>')
art.emit(f'<path d="M{floor[1][0]} {floor[1][1]} ' + ' '.join(f'L{x} {y}' for x, y in floor[2:-1]) + '" fill="none" stroke="#6c5a34" stroke-width="3" opacity="0.6"/>')
for _ in range(220):
    x = art.rng.uniform(820, 1920)
    y = art.rng.uniform(975 - (x - 820) * 0.07, 1075)
    art.speck(x, y, art.rng.uniform(1, 2.2), art.rng.choice(('#c9a2ff', '#b06cf0', '#8dff6a')), art.rng.uniform(0.3, 0.7))
art.text(1640, 1000, 'BACTERIA FILM · graze it', 10.5, '#d9b8ff', 600, 'middle', mono=True)

# the current: faint streaks drifting right
for i in range(14):
    y0 = 140 + i * 58
    x0 = art.rng.uniform(-100, 600)
    art.emit(f'<path d="M{x0:.0f} {y0} q 220 -18 440 0 t 440 0" fill="none" stroke="{ACCENT}" stroke-width="1" opacity="0.07"/>')
art.arrow(90, 120, 250, 112, ACCENT, 1.4, dashed=True)
art.text(90, 104, 'CURRENT', 10.5, ACCENT, 600, mono=True)

# algal threads with a wild stentor anchored on one
art.filament(-40, 330, 780, heading=12, cell_len=62, width=26)
art.filament(1380, -20, 520, heading=72, cell_len=58, width=24)
art.stentor(1520, 250, 150, lean=-0.12)
art.text(1520, 240, 'wild stentor', 10.5, MUTED, 500, 'middle')

# green swimmer swarms in the light (food)
for (sx, sy, n) in ((420, 210, 26), (1180, 300, 18), (700, 760, 14), (300, 620, 12)):
    for i in range(n):
        ang = i * 2.4
        rr = 6 + 5.5 * i ** 0.75
        art.chlamy(sx + rr * math.cos(ang), sy + rr * math.sin(ang) * 0.8, 5.5, heading=math.degrees(ang) + 30)

# rotifer with its whirlpool (danger ring)
rx, ry = 380, 860
for k in range(4):
    art.emit(f'<ellipse cx="{rx + 70}" cy="{ry - 125}" rx="{60 + 38 * k}" ry="{34 + 22 * k}" fill="none" stroke="{WARN}" '
             f'stroke-width="1.2" opacity="{0.35 - 0.07 * k:.2f}" stroke-dasharray="10 8" transform="rotate(-60 {rx + 70} {ry - 125})"/>')
art.rotifer(rx, ry, 300, heading=-60)
art.text(rx + 190, ry + 20, 'ROTIFER · its whirlpool pulls you in', 11, WARN, 600, mono=True)

# nematode thrashing along the floor
art.nematode(1080, 900, 520, heading=-6, waves=1.6, amp=34)

# Didinium closing in from the right
art.didinium(1330, 560, 44, heading=195)
art.arrow(1400, 585, 1320, 560, WARN, 1.4, dashed=True, warn=True)
art.text(1310, 628, 'DIDINIUM · hunts ciliates', 11, WARN, 600, 'middle', mono=True)

# another player (magenta paramecium) and a wild amoeba
art.paramecium(1180, 700, 150, heading=160, pal='magenta')
art.text(1180, 770, 'Mira', 12, PALETTES['magenta'][1], 700, 'middle')
art.amoeba(620, 470, 46, arms=3, pal='amber')
art.text(620, 540, 'wild amoeba', 10.5, MUTED, 500, 'middle')

# Daphnia sweep warning: a lane across the top right, the giant's edge in the corner
art.emit(f'<polygon points="900,0 1240,0 1920,520 1920,860" fill="{WARN}" opacity="0.05"/>')
art.emit(f'<path d="M900 0 L1920 860 M1240 0 L1920 520" stroke="{WARN}" stroke-width="1.4" stroke-dasharray="14 10" opacity="0.5"/>')
shell = [(1700, -80), (1980, -120), (2100, 200), (1960, 330), (1790, 250)]
art.emit(f'<path d="{smooth_closed(shell)}" fill="url(#body-ghost)" opacity="0.85"/>')
art.emit(f'<path d="{smooth_closed(shell)}" fill="none" stroke="{PALETTES["ghost"][1]}" stroke-width="2.4" opacity="0.6"/>')

# ---------------------------------------------------------------- the player: euglena at 1x, with own-cell indicators
px, py = 960, 520
art.euglena(px, py, 120, heading=-35)
art.emit(f'<circle cx="{px}" cy="{py}" r="78" fill="none" stroke="{ACCENT}" stroke-width="2.2" opacity="0.55"/>')
art.emit(f'<path d="M{px} {py - 78} A78 78 0 0 1 {px + 67.5} {py + 39}" fill="none" stroke="{PICK}" stroke-width="3.4" opacity="0.9"/>')
art.text(px, py + 104, 'POND LEVEL 2 · EUGLENA II', 11, ACCENT, 700, 'middle', mono=True)
art.text(px, py + 120, 'eyespot pulls green swimmers from 4 body-lengths', 10.5, MUTED, 400, 'middle', mono=True)

# ---------------------------------------------------------------- chrome: leaderboard top-right, clock bottom-right
LX, LY = W - 16 - 240, 16
art.emit(f'<rect x="{LX}" y="{LY}" width="240" height="{26 + 16 + 24 * 4}" rx="8" fill="{PANEL}" fill-opacity="0.82" stroke="#1a2a3b"/>')
art.text(LX + 12, LY + 18, 'LEADERBOARD', 10.5, MUTED, 700)
art.text(LX + 228, LY + 18, 'HOLD TAB', 10, MUTED, 400, 'end')
art.text(LX + 150, LY + 36, 'LV', 9.5, MUTED, 600, 'end')
art.text(LX + 228, LY + 36, 'SCORE', 9.5, MUTED, 600, 'end')
rows = [('1', 'Mira', 'magenta', 'P3', '1 412'), ('2', 'you', 'cyan', 'P2', '1 290'), ('3', 'Oskar', 'amber', 'P2', '1 105'),
        ('4', 'Juno', 'green', 'P1', '980')]
for i, (rank, name, pal, lv, score) in enumerate(rows):
    y = LY + 42 + 24 * i
    if name == 'you':
        art.emit(f'<rect x="{LX + 4}" y="{y + 2}" width="232" height="22" rx="4" fill="{ACCENT}" opacity="0.1"/>')
    art.text(LX + 16, y + 17, rank, 11.5, TEXT, 500)
    art.emit(f'<circle cx="{LX + 36}" cy="{y + 13}" r="5" fill="{PALETTES[pal][0]}" stroke="{PALETTES[pal][1]}"/>')
    art.text(LX + 48, y + 17, name, 11.5, TEXT, 500)
    art.text(LX + 150, y + 17, lv, 11.5, TEXT, 500, 'end', mono=True)
    art.text(LX + 228, y + 17, score, 11.5, TEXT, 500, 'end', mono=True)
art.text(W - 16, H - 40, '14:22', 30, TEXT, 600, 'end', mono=True)
art.text(W - 16, H - 18, 'THE POND · CHAPTER 2 OF 3 · COLONIES AT 17:00', 10.5, MUTED, 600, 'end')

# Daphnia warning chip, top centre
art.caption_banner(W / 2, 46, 'DAPHNIA SWEEPS THIS LANE IN 0:08 · small things get sieved', 14, WARN)

# field-note toast (the learning hook), bottom left
TX, TY = 16, H - 16 - 84
art.emit(f'<rect x="{TX}" y="{TY}" width="440" height="84" rx="8" fill="{PANEL}" fill-opacity="0.88" stroke="{GOOD}" stroke-opacity="0.6"/>')
art.text(TX + 14, TY + 22, 'NEW IN THE ENCYCLOPEDIA · ROTIFER', 11, GOOD, 700, mono=True)
art.text(TX + 14, TY + 44, 'A whole animal of about 1000 cells, smaller than a stentor.', 12, TEXT, 500)
art.text(TX + 14, TY + 62, 'Its crown of cilia spins a whirlpool that pulls food in.', 12, TEXT, 500)
art.text(TX + 426, TY + 76, 'H  read more', 10, MUTED, 600, 'end', mono=True)

# annotation callouts for the reader of the mock (outside the game look)
art.emit(f'<rect x="16" y="150" width="300" height="118" rx="8" fill="#000000" fill-opacity="0.55" stroke="{ACCENT}" stroke-opacity="0.4" stroke-dasharray="4 4"/>')
art.lines(28, 172, ['MOCK NOTES (not in game)', 'you = the cyan euglena at the centre, 1×', 'green specks = food (green swimmers)',
                    'orange = danger', "chrome = today's HUD: board and clock"], 11, TEXT, 17)
art.save(OUT)

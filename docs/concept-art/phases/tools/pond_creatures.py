#!/usr/bin/env python3
"""Sheet P2: who lives in the pond, sized against the player's five forms (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL_STROKE, TEXT, WARN, Sheet, smooth_closed

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/pond-creatures.svg'
art = Sheet(1920, 1080, 7821, 'Evolution — phases concept P2: the pond, its creatures to scale',
            'The five single-cell forms as the player arrives in the pond, next to the pond\'s food, threats and giants. Code-drawn.')
art.header('concept P2 — THE POND · who lives there, sized against you',
           'Game scale: your form is 1× on arrival (all five forms arrive at the same size, for fair play). Real sizes are in the chart below.',
           'ticket #782 · epic #761 · a concept for a decision, not a spec', 'dark-field language of sheets 01 and 04 · zero raster')

# ---------------------------------------------------------------- A · the lineup
art.panel(40, 90, 1840, 560, 'A · THE LINEUP — game scale, your form = 1×', 'a floor line, left to right by size · cyan = you · other colours = the pond')
FLOOR = 560
art.emit(f'<line x1="60" y1="{FLOOR}" x2="1860" y2="{FLOOR}" stroke="{PANEL_STROKE}" stroke-width="1.2"/>')
U = 80  # px for "1×", the length of an arriving form


def label(x, name, role, real, colour=TEXT):
    art.text(x, FLOOR + 22, name, 13, colour, 700, 'middle')
    art.text(x, FLOOR + 38, role, 10.5, MUTED, 400, 'middle')
    art.text(x, FLOOR + 53, real, 10.5, ACCENT, 500, 'middle', mono=True)


# food: a swarm of Chlamydomonas (the pond's motes)
for i in range(14):
    ang = i * 2.4
    rr = 6 + 3.2 * i ** 0.8
    art.chlamy(105 + rr * math.cos(ang), FLOOR - 40 + rr * math.sin(ang) * 0.8, 5, heading=math.degrees(ang) - 60)
label(105, 'Green swimmers', 'food: the new "motes"', 'real ~10 µm · 0.1×', GOOD)

# the five forms, player cyan, all 1×
art.amoeba(215, FLOOR - 50, 34, arms=4)
label(215, 'Amoeba', 'you', '1×')
art.paramecium(320, FLOOR - 40, U * 1.1, heading=-15)
label(320, 'Paramecium', 'you', '1×')
art.euglena(425, FLOOR - 45, U, heading=-40)
label(425, 'Euglena', 'you', '1×')
art.diatom(525, FLOOR - 45, 30, 12)
label(525, 'Diatom', 'you', '1×')
art.stentor(625, FLOOR - 118, U * 1.3, lean=0.05)
label(625, 'Stentor', 'you', '1×')
art.emit(f'<rect x="170" y="{FLOOR - 150}" width="505" height="150" rx="8" fill="none" stroke="{ACCENT}" stroke-opacity="0.35" stroke-dasharray="4 4"/>')
art.text(422, FLOOR - 158, 'YOUR FIVE FORMS ON ARRIVAL · all 1×', 11, ACCENT, 700, 'middle')

# Didinium, the ciliate hunter
art.didinium(760, FLOOR - 55, 38, heading=180)
label(760, 'Didinium', 'hunter of ciliates', '80–200 µm · 1.2×', WARN)

# rotifer, a whole animal
art.rotifer(915, FLOOR - 125, 230, heading=-90)
label(915, 'Rotifer', 'whirlpool feeder · an animal', '100–500 µm · 2.8×', WARN)

# Volvox, the wild colony of the later era
vx, vy, vr = 1080, FLOOR - 120, 110
art.emit(f'<circle cx="{vx}" cy="{vy}" r="{vr * 1.08}" fill="{PALETTES["green"][1]}" opacity="0.15" filter="url(#blur-10)"/>')
art.emit(f'<circle cx="{vx}" cy="{vy}" r="{vr}" fill="url(#body-green)" opacity="0.5"/>')
for i in range(150):
    z = -1 + 2 * (i + 0.5) / 150
    ph = i * 2.39996
    x, y = vx + vr * math.sqrt(1 - z * z) * math.cos(ph), vy + vr * z
    if math.sqrt(1 - z * z) * math.sin(ph) > -0.1:
        art.speck(x, y, 2.6, PALETTES['green'][1], 0.75)
for (dx, dy, dr) in ((-30, 20, 22), (35, -15, 26), (10, 45, 18)):
    art.mini_cell(vx + dx, vy + dy, dr, 'green', halo=0.15)
art.emit(f'<circle cx="{vx}" cy="{vy}" r="{vr}" fill="none" stroke="{PALETTES["green"][1]}" stroke-width="1.5" opacity="0.7"/>')
label(vx, 'Volvox (wild)', 'a colony · arrives later', 'real ~500 µm · 2.8×', GOOD)

# nematode, long and thin
art.nematode(1215, FLOOR - 80, 420, heading=-8, waves=1.4, amp=36)
label(1420, 'Nematode', 'thrasher · eats bacteria films', 'real 0.3–2 mm · 5× long', WARN)

# algal thread
art.filament(1230, FLOOR - 190, 380, heading=-4, cell_len=38)
art.text(1420, FLOOR - 232, 'Algal thread (Spirogyra) · cover and grazing', 10.5, MUTED, 400, 'middle')

# Daphnia, a giant cut off by the frame
dx, dy = 1850, FLOOR - 250
shell = [(dx - 170, dy - 180), (dx - 60, dy - 250), (dx + 40, dy - 240), (dx + 60, dy + 150), (dx - 40, dy + 230), (dx - 150, dy + 120)]

d = smooth_closed(shell)
art.emit(f'<clipPath id="lineup-clip"><rect x="40" y="90" width="1840" height="560" rx="10"/></clipPath>')
art.emit('<g clip-path="url(#lineup-clip)">')
art.emit(f'<path d="{d}" fill="{PALETTES["ghost"][1]}" opacity="0.08" filter="url(#blur-16)"/>')
art.emit(f'<path d="{d}" fill="url(#body-ghost)" opacity="0.8"/>')
art.emit(f'<path d="{d}" fill="none" stroke="{PALETTES["ghost"][1]}" stroke-width="2.4" opacity="0.7"/>')
art.emit(f'<circle cx="{dx - 120}" cy="{dy - 150}" r="26" fill="#1a2430" stroke="{PALETTES["ghost"][1]}" stroke-width="2"/>')
for k in range(5):
    art.emit(f'<path d="M{dx - 140 + k * 12} {dy - 20 + k * 28} q -60 10 -80 60" fill="none" stroke="{PALETTES["ghost"][1]}" '
             f'stroke-width="3" opacity="0.5" stroke-linecap="round"/>')
art.emit('</g>')
art.arrow(1700, FLOOR - 40, 1620, FLOOR - 20, WARN, 1.6, dashed=True, warn=True)
label(1745, 'Daphnia (water flea)', 'a passing giant: its legs sieve a lane', 'real 1–5 mm · 20×+', WARN)

art.scale_bar(80, 180, U, '1× = your form')

# ---------------------------------------------------------------- B · real sizes (log scale)
art.panel(40, 670, 1000, 370, 'B · REAL SIZES — the game evens the five forms out', 'bars span the usual adult length · log scale · µm = a thousandth of a millimetre')
bars = [
    ('Chlamydomonas (green swimmer)', 8, 12, 'green'),
    ('Euglena', 35, 60, 'cyan'),
    ('Diatom (a centric one)', 20, 200, 'silica'),
    ('Didinium', 80, 200, 'coral'),
    ('Paramecium', 170, 300, 'cyan'),
    ('Rotifer', 100, 500, 'rose'),
    ('Amoeba proteus', 250, 750, 'cyan'),
    ('Volvox colony', 350, 1000, 'green'),
    ('Stentor', 500, 2000, 'violet'),
    ('Nematode (free-living)', 300, 2000, 'sand'),
    ('Daphnia', 1000, 5000, 'ghost'),
]
X0, X1 = 320, 1010
lo, hi = math.log10(5), math.log10(6000)


def xs(v):
    return X0 + (math.log10(v) - lo) / (hi - lo) * (X1 - X0)


for tick in (10, 100, 1000):
    art.emit(f'<line x1="{xs(tick):.1f}" y1="728" x2="{xs(tick):.1f}" y2="1010" stroke="{PANEL_STROKE}" stroke-width="1"/>')
    art.text(xs(tick), 1026, f'{tick} µm' if tick < 1000 else '1 mm', 10.5, MUTED, 400, 'middle', mono=True)
for i, (name, a, b, pal) in enumerate(bars):
    y = 740 + i * 24
    art.text(X0 - 10, y + 9, name, 11, TEXT, 500, 'end')
    art.emit(f'<rect x="{xs(a):.1f}" y="{y}" width="{xs(b) - xs(a):.1f}" height="12" rx="6" fill="{PALETTES[pal][0]}" opacity="0.75"/>')
    art.text(xs(b) + 6, y + 10, f'{a}–{b} µm' if b < 1000 else f'{a / 1000:g}–{b / 1000:g} mm', 10, MUTED, 400, mono=True)

# ---------------------------------------------------------------- C · roles
art.panel(1060, 670, 820, 370, 'C · WHAT EACH DOES IN THE GAME — and the real fact behind it', 'every creature teaches one true thing the first time you meet it')
rows = [
    ('Green swimmers', 'food, in swarms that follow the light', 'the single cell every green colony started from'),
    ('Didinium', 'hunts ciliates: paramecium players beware', 'it swallows a paramecium whole (Gause, 1934)'),
    ('Rotifer', 'a whirlpool that sucks small things in', 'an animal of ~1000 cells, smaller than a stentor'),
    ('Nematode', 'thrashes through; knocks you aside', 'most pond worms graze bacteria, not cells'),
    ('Daphnia', 'a giant sweeps a lane; small things vanish', 'it sieves 1–50 µm food: big things are safe'),
    ('Algal thread', 'cover to hide in, a slow meal', 'Spirogyra: named for its spiral chloroplast'),
    ('Volvox', 'arrives with the colony era', 'too big for most grazers: the point of a colony'),
]
for i, (name, role, fact) in enumerate(rows):
    y = 740 + i * 42
    art.text(1080, y, name, 12.5, TEXT, 700)
    art.text(1230, y, role, 11.5, TEXT, 400)
    art.text(1230, y + 16, fact, 10.5, MUTED, 400, mono=True)

art.footer('P2 · pond creatures · sizes at game scale are proposals, not constants', 'docs/concept-art/phases/pond-creatures.svg · 1920 × 1080')
art.save(OUT)

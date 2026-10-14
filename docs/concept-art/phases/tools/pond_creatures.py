#!/usr/bin/env python3
"""Sheet P2: who lives in the pond, sized against the player's five forms (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PANEL_STROKE, TEXT, WARN, Sheet, smooth_closed

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/pond-creatures.svg'
art = Sheet(1920, 1080, 7821, 'Evolution — phases concept P2: the rock pool, its creatures to scale',
            'The five single-cell forms as the player arrives in the rock pool, next to the pool\'s food, threats and giants, all sea-water species. Code-drawn.')
art.header('concept P2 — THE ROCK POOL · who lives there, sized against you',
           'Game scale: your form is 1× on arrival (all five forms arrive at the same size, for fair play). Real sizes are in the chart below.',
           'decided: tickets #785 A, #790 A · design: docs/game-design/phases.md §14.6', 'sea-water cast: §14.12.3 · zero raster')

# ---------------------------------------------------------------- A · the lineup
art.panel(40, 90, 1840, 560, 'A · THE LINEUP — game scale, your form = 1×', 'a floor line, left to right by size · cyan = you · other colours = the pool')
FLOOR = 560
art.emit(f'<line x1="60" y1="{FLOOR}" x2="1860" y2="{FLOOR}" stroke="{PANEL_STROKE}" stroke-width="1.2"/>')
U = 80  # px for "1×", the length of an arriving form


def label(x, name, role, real, colour=TEXT):
    art.text(x, FLOOR + 22, name, 13, colour, 700, 'middle')
    art.text(x, FLOOR + 38, role, 10.5, MUTED, 400, 'middle')
    art.text(x, FLOOR + 53, real, 10.5, ACCENT, 500, 'middle', mono=True)


# food: a swarm of Dunaliella (the pool's green specks)
for i in range(14):
    ang = i * 2.4
    rr = 6 + 3.2 * i ** 0.8
    art.chlamy(105 + rr * math.cos(ang), FLOOR - 40 + rr * math.sin(ang) * 0.8, 5, heading=math.degrees(ang) - 60)
label(105, 'Green specks', 'food: Dunaliella swarms', '0.1×', GOOD)

# the five forms, player cyan, all 1×; the third line names the sea-water cousin (forams: a counterpart, not a relative)
art.amoeba(215, FLOOR - 50, 34, arms=4)
label(215, 'Amoeba', 'you · 1×', 'forams')
art.paramecium(320, FLOOR - 40, U * 1.1, heading=-15)
label(320, 'Paramecium', 'you · 1×', 'Frontonia')
art.euglena(425, FLOOR - 45, U, heading=-40)
label(425, 'Euglena', 'you · 1×', 'Eutreptiella')
art.diatom(525, FLOOR - 45, 30, 12)
label(525, 'Diatom', 'you · 1×', 'Coscinodiscus')
art.stentor(625, FLOOR - 118, U * 1.3, lean=0.05)
label(625, 'Stentor', 'you · 1×', 'folliculinids')
art.emit(f'<rect x="170" y="{FLOOR - 150}" width="505" height="150" rx="8" fill="none" stroke="{ACCENT}" stroke-opacity="0.35" stroke-dasharray="4 4"/>')
art.text(422, FLOOR - 158, 'YOUR FIVE FORMS ON ARRIVAL · all 1× · named by their sea-water cousins and counterparts', 11, ACCENT, 700, 'middle')

# Didinium, the ciliate hunter
art.didinium(760, FLOOR - 55, 38, heading=180)
label(760, 'Didinium', 'hunts ciliates only', '1.2×', WARN)

# rotifer, a whole animal
art.rotifer(915, FLOOR - 150, 210, heading=-90)
label(915, 'Rotifer', 'whirlpool · an animal', 'Brachionus · 2.8×', WARN)

# Phaeocystis, the wild colony of the later era (golden-brown, a haptophyte)
vx, vy, vr = 1080, FLOOR - 120, 105
art.sphere_cells(vx, vy, vr, 260, 3.4, pal='golden')
label(vx, 'Phaeocystis (wild)', 'a colony · from 17:00', 'grows past the copepod', GOOD)

# nematode, long and thin
art.nematode(1215, FLOOR - 80, 420, heading=-8, waves=1.4, amp=36)
label(1420, 'Nematode', 'thrasher · grazes the films', 'sea floor · 5× long', WARN)

# algal thread: Cladophora, branched
art.cladophora(1210, FLOOR - 170, 290, heading=-4, cell_len=36)
art.text(1230, FLOOR - 300, 'Algal thread (Cladophora) · cover from hunters', 10.5, MUTED, 400, 'start')

# the copepod, a giant cut off by the frame
art.emit(f'<clipPath id="lineup-clip"><rect x="40" y="90" width="1840" height="560" rx="10"/></clipPath>')
art.emit('<g clip-path="url(#lineup-clip)">')
art.copepod(1830, FLOOR - 300, 600, heading=185)
art.emit('</g>')
art.arrow(1700, FLOOR - 40, 1620, FLOOR - 20, WARN, 1.6, dashed=True, warn=True)
label(1745, 'Copepod (Tigriopus)', 'a passing giant: eats a lane', 'only what fits its mouth · 20×', WARN)

art.scale_bar(80, 180, U, '1× = your form')

# ---------------------------------------------------------------- B · real sizes (log scale)
art.panel(40, 670, 1000, 370, 'B · REAL SIZES — the game evens the five forms out', 'bars span the usual adult length, approximate · log scale · µm = a thousandth of a millimetre')
bars = [
    ('Dunaliella (green speck)', 5, 25, 'green'),
    ('Eutreptiella (sea euglena)', 20, 60, 'cyan'),
    ('Coscinodiscus (a diatom)', 30, 500, 'silica'),
    ('Didinium', 80, 200, 'coral'),
    ('Frontonia (sea paramecium)', 110, 600, 'cyan'),
    ('Brachionus (rotifer)', 100, 340, 'rose'),
    ('Forams (most)', 100, 1000, 'cyan'),
    ('Folliculinid (its case)', 150, 250, 'violet'),
    ('Nematode (sea floor)', 300, 2000, 'sand'),
    ('Tigriopus (copepod)', 900, 1300, 'scarlet'),
    ('Phaeocystis colony (to 3 cm)', 100, 6000, 'golden'),
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
    size = '→ 3 cm' if name.startswith('Phaeocystis') else (f'{a}–{b} µm' if b < 1000 else f'{a / 1000:g}–{b / 1000:g} mm')
    art.text(xs(b) + 6, y + 10, size, 10, MUTED, 400, mono=True)

# ---------------------------------------------------------------- C · roles
art.panel(1060, 670, 820, 370, 'C · WHAT EACH DOES IN THE GAME — and the real fact behind it', 'every creature teaches one true thing the first time you meet it')
rows = [
    ('Green specks', 'food, in swarms that follow the light', 'Dunaliella: its salt-loving cousin turns drying pools red'),
    ('Didinium', 'hunts ciliates: paramecium players beware', 'the classic paramecium hunter; vs harpoons: to be checked'),
    ('Rotifer', 'a whirlpool that pulls small things in', 'an animal; fish farms raise Brachionus by the billion'),
    ('Nematode', 'thrashes through; knocks you aside', 'roundworms are the commonest animals of the sea floor'),
    ('Copepod', 'crosses in a lane; eats what fits its mouth', 'Tigriopus lives in the high rock pools of this very coast'),
    ('Algal thread', 'cover to hide in from hunters', 'Cladophora: branched green threads of rock pools'),
    ('Phaeocystis', 'wild balls from 17:00', 'balls up to 3 cm across: too big for most grazers'),
]
for i, (name, role, fact) in enumerate(rows):
    y = 740 + i * 42
    art.text(1080, y, name, 12.5, TEXT, 700)
    art.text(1230, y, role, 11.5, TEXT, 400)
    art.text(1230, y + 16, fact, 10.5, MUTED, 400, mono=True)

art.footer('P2 · the rock pool\'s creatures · game sizes are §14.14 tuning values', 'docs/concept-art/phases/pond-creatures.svg · 1920 × 1080')
art.save(OUT)

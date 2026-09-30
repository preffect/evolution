#!/usr/bin/env python3
"""Sheet R2: the gathering road, amoebae stream into a slug and a fruiting stalk (Dictyostelium), for the amoeba (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PICK, TEXT, WARN, Sheet, smooth_closed, smooth_open

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-slime.svg'
art = Sheet(1920, 1080, 7825, 'Evolution — phases concept R2: the gathering road, amoebae into a slug and a stalk',
            'The social amoeba Dictyostelium as a multicell path: alone, the hunger call and the streams, the mound, the slug, '
            'the fruiting body. With the call mechanic, the co-op option and the real biology. Code-drawn.')
art.header('concept R2 — THE GATHERING ROAD · come together instead of staying together',
           'For the amoeba. The other way life went multicellular: separate cells crawl together into one body. '
           'Drawn larger at each step, not to true scale.',
           'ticket #782 · epic #761 · a strong fit for playing together (ticket #79)', 'dark-field language of sheets 01 and 04 · zero raster')
A = PALETTES['amber']
art.panel(40, 90, 1840, 470, 'A · THE LADDER — from a crowd of hungry cells to a tower', None)
Y = 290

# 1 · alone, feeding
x = 150
art.amoeba(x, Y, 34, arms=3, pal='cyan')
for i in range(9):
    ang = i * 0.7 + 0.3
    rr = 70 + 18 * (i % 3)
    art.amoeba(x + rr * math.cos(ang), Y + rr * math.sin(ang) * 0.9, 9, arms=3, pal='amber', detail=False)
for _ in range(30):
    art.speck(x + art.rng.uniform(-110, 110), Y + art.rng.uniform(-110, 110), 1.4, '#c9a2ff', 0.6)
art.stage_label(x, 470, '1 · Alone', ['each cell ~10 µm', 'wild amoebae eat bacteria', 'you are the big one'])

# 2 · the call: spiral waves and streams
x = 450
for k in range(5):
    art.emit(f'<circle cx="{x}" cy="{Y}" r="{24 + 26 * k}" fill="none" stroke="{PICK}" stroke-width="{6 - k}" opacity="{0.35 - 0.06 * k:.2f}"/>')
for s in range(6):
    base = 2 * math.pi * s / 6 + 0.2
    pts = []
    for i in range(9):
        t = i / 8
        rr = 140 * (1 - t) + 18
        a = base + 0.9 * t + 0.08 * math.sin(i * 1.3 + s)
        pts.append((x + rr * math.cos(a), Y + rr * math.sin(a)))
    art.emit(f'<path d="{smooth_open(pts)}" fill="none" stroke="{A[1]}" stroke-width="3" opacity="0.25"/>')
    for (px, py) in pts[:-1]:
        art.mini_cell(px, py, 6.5, 'amber', halo=0)
art.amoeba(x, Y, 22, arms=3, pal='cyan')
art.stage_label(x, 470, '2 · The hunger call', ['waves of a chemical signal', 'cells stream to the caller', 'your key: CALL'], PICK)

# 3 · the mound
x = 760
mound = []
for i in range(90):
    ang = art.rng.uniform(0, 2 * math.pi)
    rr = 70 * math.sqrt(art.rng.uniform(0, 1))
    mound.append((x + rr * math.cos(ang), Y + 20 + rr * math.sin(ang) * 0.55 - (70 - rr) * 0.6))
for (px, py) in sorted(mound, key=lambda p: p[1]):
    art.mini_cell(px, py, 8, 'amber', halo=0)
art.stage_label(x, 470, '3 · The mound', ['up to ~100 000 cells', 'a heap ~0.5 mm across', 'one body now'])

# 4 · the slug
x = 1090
slug = [(x - 150, Y + 30), (x - 120, Y + 5), (x - 40, Y - 10), (x + 60, Y - 18), (x + 130, Y - 14), (x + 158, Y + 2),
        (x + 140, Y + 22), (x + 60, Y + 30), (x - 40, Y + 36), (x - 130, Y + 42)]
d = smooth_closed(slug)
art.emit(f'<path d="{d}" fill="{A[1]}" opacity="0.18" filter="url(#blur-6)"/>')
art.emit('<linearGradient id="slug-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0a050" stop-opacity="0.8"/>'
         '<stop offset="0.78" stop-color="#f0a050" stop-opacity="0.8"/><stop offset="0.82" stop-color="#fff0d8" stop-opacity="0.85"/>'
         '<stop offset="1" stop-color="#fff0d8" stop-opacity="0.9"/></linearGradient>')
art.emit(f'<path d="{d}" fill="url(#slug-g)"/>')
cid = art.clip_for(d)
art.emit(f'<g clip-path="url(#{cid})">')
for _ in range(120):
    art.speck(x + art.rng.uniform(-150, 160), Y + art.rng.uniform(-20, 45), 3.2, '#ffffff', 0.18)
art.emit('</g>')
art.emit(f'<path d="{d}" fill="none" stroke="{A[1]}" stroke-width="2" opacity="0.8"/>')
art.emit(f'<path d="M{x - 160} {Y + 48} C {x - 260} {Y + 60} {x - 330} {Y + 52} {x - 380} {Y + 70}" fill="none" stroke="{A[1]}" '
         f'stroke-width="5" opacity="0.15"/>')
art.text(x + 60, Y - 30, 'front: becomes the stalk', 10.5, '#fff0d8', 600, 'middle')
art.text(x - 40, Y + 70, 'back: becomes spores', 10.5, A[1], 600, 'middle')
art.arrow(x + 120, Y - 60, x + 175, Y - 60, ACCENT, 1.6)
art.text(x + 182, Y - 56, 'light', 10.5, ACCENT, 600)
art.stage_label(x, 470, '4 · The slug', ['1–2 mm · crawls as one', 'heads for light and warmth', 'you steer it to the bank'])

# 5 · the fruiting body
x = 1500
art.emit(f'<path d="M{x - 90} {Y + 130} Q {x} {Y + 110} {x + 90} {Y + 130}" fill="none" stroke="#6c5a34" stroke-width="4"/>')
art.emit(f'<path d="M{x - 8} {Y + 122} L{x - 3} {Y - 70} L{x + 3} {Y - 70} L{x + 8} {Y + 122} Z" fill="#fff0d8" opacity="0.8"/>')
for k in range(12):
    art.emit(f'<line x1="{x - 5}" y1="{Y + 115 - k * 15}" x2="{x + 5}" y2="{Y + 115 - k * 15}" stroke="{A[2]}" stroke-width="1" opacity="0.5"/>')
art.emit(f'<circle cx="{x}" cy="{Y - 110}" r="48" fill="{A[1]}" opacity="0.2" filter="url(#blur-10)"/>')
for i in range(70):
    ang = art.rng.uniform(0, 2 * math.pi)
    rr = 42 * math.sqrt(art.rng.uniform(0, 1))
    art.mini_cell(x + rr * math.cos(ang), Y - 110 + rr * math.sin(ang), 5, 'amber', halo=0)
for i in range(10):
    art.speck(x + 55 + i * 13, Y - 120 + i * 4 + 8 * math.sin(i), 2.4, A[1], 0.7 - i * 0.05)
art.text(x + 120, Y - 60, 'spores drift off', 10.5, A[1], 600, 'middle')
art.stage_label(x, 470, '5 · The fruiting body', ['a stalk ~1–2 mm tall', 'the front 1 in 5 cells die as stalk', 'the finale: a big score payout'], GOOD)
for cx in (285, 610, 905, 1325):
    art.chevron(cx, Y)
art.text(1720, 200, 'The end of this road is', 12, TEXT, 600, 'middle')
art.text(1720, 218, 'a finish, not a fight:', 12, TEXT, 600, 'middle')
art.text(1720, 236, 'fruit at the bank before', 12, TEXT, 600, 'middle')
art.text(1720, 254, 'the pond clock runs out.', 12, TEXT, 600, 'middle')

# ---------------------------------------------------------------- B · the call
art.note_panel(40, 580, 600, 460, 'B · HOW YOU PLAY IT: THE CALL', [
    '§ You recruit cells instead of growing them',
    '• Press CALL: a ring of signal spreads from you.',
    '• Wild amoebae inside the ring stream in and join',
    '  your body; each one is +1 cell (the other roads',
    '  divide instead).',
    '• The call costs food; a bigger crowd needs more.',
    '§ Mound, then slug',
    '• At 16 cells you heap into a mound, at 32 a slug.',
    '• The slug crawls on the pond floor only; it is',
    '  slow to turn but nothing on the floor can eat it.',
    '§ Fruiting',
    '• Reach the bank and hold: your front fifth becomes',
    '  the stalk, the rest spores. Big score, then you',
    '  spectate or start again as one amoeba.',
], 'steer with the pointer, as today; one extra key')

# ---------------------------------------------------------------- C · together (ticket #79)
art.note_panel(660, 580, 600, 460, 'C · PLAYING TOGETHER — the co-op option', [
    '§ Real slime moulds mix: that makes co-op honest',
    '• Cells from different families answer the same',
    '  call and build one slug (a "chimera").',
    '• In the game: two amoeba players could merge. The',
    '  one with more cells steers; the other adds cells',
    '  and shares the fruiting score.',
    '§ And the real twist: cheaters',
    '• Some strains dodge the stalk and end up as spores',
    '  (Strassmann, Zhu and Queller, Nature 2000).',
    '• A game rule could echo it: whoever is at the back',
    '  when you fruit scores more.',
    '§ Status',
    '• Ticket #79 (co-op fusion) is "not yet" by your',
    '  call. This road works solo with wild amoebae; co-op',
    '  can be added later without redesign.',
], 'optional; the road stands without it')

# ---------------------------------------------------------------- D · the real story
art.note_panel(1280, 580, 600, 460, 'D · THE REAL STORY — and one honest caveat', [
    '§ True',
    '• Dictyostelium lives as single amoebae while food',
    '  lasts; when it runs out, cells relay pulses of a',
    '  signal (cyclic AMP) and stream together.',
    '• The slug moves toward light and warmth, then',
    '  stands up; about a fifth of the cells die to form',
    '  the stalk that lifts the spores.',
    '§ Caveat for the encyclopedia',
    '• The game\'s amoeba (Amoeba proteus, ~0.5 mm) never',
    '  does this. Its small cousins, the social amoebae',
    '  (~10 µm each), do. Both are amoebozoans.',
    '~ Bonner, "The Social Amoebae", Princeton 2009',
    '~ Kessin, "Dictyostelium", Cambridge 2001',
], 'sources in the proposal on ticket #782')
art.footer('R2 · the gathering road · sizes and fractions are the real organism\'s; game numbers are proposals',
           'docs/concept-art/phases/road-slime.svg · 1920 × 1080')
art.save(OUT)

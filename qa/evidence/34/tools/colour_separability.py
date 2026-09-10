#!/usr/bin/env python3
# usage: python3 qa/evidence/34/tools/colour_separability.py [qa/evidence/34/palette-separability.md]
"""Colour separability for VISUAL-STYLE.md §2 (ticket #34).

CIEDE2000 between every pair of player-palette bases and every pair of DNA tag colours, under normal
vision and under the Viénot / Brettel / Mollon (1999) dichromat simulation for deuteranopia and
protanopia (severity 1, linear-RGB matrices). Emits the markdown tables the doc quotes; #99 pins the
acceptance numbers in a test. Colours below mirror VISUAL-STYLE.md §2, which is their home.
"""
import itertools
import math
import sys

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def gam(c):
    c = max(0.0, min(1.0, c)); return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

# Viénot, Brettel, Mollon 1999: linear-RGB 3x3 matrices for dichromacy (severity 1)
PROTAN = [[0.11238, 0.88762, 0.0], [0.11238, 0.88762, 0.0], [0.00401, -0.00401, 1.0]]
DEUTAN = [[0.29275, 0.70725, 0.0], [0.29275, 0.70725, 0.0], [-0.02234, 0.02234, 1.0]]

def simulate(rgb, m):
    l = [lin(c) for c in rgb]
    return tuple(gam(sum(m[i][j] * l[j] for j in range(3))) for i in range(3))

def rgb2lab(rgb):
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))

def de2000(lab1, lab2):
    L1, a1, b1 = lab1; L2, a2, b2 = lab2
    C1 = math.hypot(a1, b1); C2 = math.hypot(a2, b2); Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    def hp(a, b):
        if a == 0 and b == 0: return 0.0
        h = math.degrees(math.atan2(b, a)); return h + 360 if h < 0 else h
    h1p, h2p = hp(a1p, b1), hp(a2p, b2)
    dLp = L2 - L1; dCp = C2p - C1p
    if C1p * C2p == 0: dhp = 0
    elif abs(h2p - h1p) <= 180: dhp = h2p - h1p
    elif h2p - h1p > 180: dhp = h2p - h1p - 360
    else: dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lpm = (L1 + L2) / 2; Cpm = (C1p + C2p) / 2
    if C1p * C2p == 0: hpm = h1p + h2p
    elif abs(h1p - h2p) <= 180: hpm = (h1p + h2p) / 2
    elif h1p + h2p < 360: hpm = (h1p + h2p + 360) / 2
    else: hpm = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm))
         + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63)))
    dth = 30 * math.exp(-((hpm - 275) / 25) ** 2)
    Rc = 2 * math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lpm - 50) ** 2 / math.sqrt(20 + (Lpm - 50) ** 2)
    Sc = 1 + 0.045 * Cpm; Sh = 1 + 0.015 * Cpm * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))

CONDS = [('normal', None), ('deutan', DEUTAN), ('protan', PROTAN)]

def de(h1, h2, m=None):
    c1, c2 = hex2rgb(h1), hex2rgb(h2)
    if m: c1, c2 = simulate(c1, m), simulate(c2, m)
    return de2000(rgb2lab(c1), rgb2lab(c2))

def contrast(h1, h2):
    def lum(h):
        r, g, b = (lin(c) for c in hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
    a, b = lum(h1), lum(h2); a, b = max(a, b), min(a, b); return (a + 0.05) / (b + 0.05)

def table(names, hexes):
    rows = []
    for (i, a), (j, b) in itertools.combinations(enumerate(names), 2):
        rows.append((a, b, [de(hexes[i], hexes[j], m) for _, m in CONDS]))
    return rows

def nearest(names, hexes):
    out = {}
    for i, a in enumerate(names):
        for k, (cn, m) in enumerate(CONDS):
            best = min(((de(hexes[i], hexes[j], m), names[j]) for j in range(len(names)) if j != i))
            out.setdefault(a, []).append(best)
    return out


PLAYER_PALETTES = [
    ('Cyan', '#22c1d6'), ('Coral', '#ff6b5c'), ('Lime', '#7ed321'), ('Violet', '#7b5cf0'),
    ('Amber', '#e0a12a'), ('Mint', '#24db98'), ('Magenta', '#d43fb0'), ('Rose', '#bc5768'),
]
PLAYER_RIMS = ['#a6f4ff', '#ffd0c8', '#dcffb0', '#d2c4ff', '#ffe7a3', '#b2ffe3', '#ffb3ec', '#ffb2bf']
DNA_TAGS = [
    ('motile', '#66ecff'), ('metabolic', '#ffb15a'), ('photic', '#b8ff9a'), ('predatory', '#ff5470'),
    ('toxic', '#d05cff'), ('sensory', '#6a9bff'), ('armored', '#e6ecf2'),
]
BG_FIELD = '#0b1626'
PALETTE_PAIR_MIN_NORMAL = 15  # acceptance: every base pair under normal vision
NEW_PALETTE_MIN_ALL = 15      # acceptance: Rose against every other, all three conditions
TAG_PAIR_MIN_NORMAL = 15      # acceptance: every tag pair under normal vision


def markdown(names, hexes):
    lines = ['| Pair | normal | deutan | protan |', '| --- | --- | --- | --- |']
    for a, b, v in table(names, hexes):
        lines.append(f'| {a}–{b} | {v[0]:.0f} | {v[1]:.0f} | {v[2]:.0f} |')
    lines += ['', '| Colour | nearest (normal) | nearest (deutan) | nearest (protan) |', '| --- | --- | --- | --- |']
    for n, vals in nearest(names, hexes).items():
        lines.append(f'| {n} | ' + ' | '.join(f'{d:.0f} ({w})' for d, w in vals) + ' |')
    return '\n'.join(lines)


def report():
    pn = [n for n, _ in PLAYER_PALETTES]; ph = [h for _, h in PLAYER_PALETTES]
    tn = [n for n, _ in DNA_TAGS]; th = [h for _, h in DNA_TAGS]
    rows = table(pn, ph)
    worst_normal = min(rows, key=lambda r: r[2][0])
    rose = min(min(v) for a, b, v in rows if 'Rose' in (a, b))
    tag_rows = table(tn, th)
    worst_tag = min(tag_rows, key=lambda r: r[2][0])
    out = ['# Colour separability (VISUAL-STYLE.md §2 evidence, #34)', '',
           'CIEDE2000, Viénot 1999 dichromat simulation at severity 1. Generated by `qa/evidence/34/tools/colour_separability.py`.', '',
           f'- Player bases, every pair, normal vision: min {worst_normal[2][0]:.0f} ({worst_normal[0]}–{worst_normal[1]}); acceptance ≥ {PALETTE_PAIR_MIN_NORMAL}.',
           f'- Rose (index 7) against every other base, all three conditions: min {rose:.0f}; acceptance ≥ {NEW_PALETTE_MIN_ALL}.',
           f'- DNA tags, every pair, normal vision: min {worst_tag[2][0]:.0f} ({worst_tag[0]}–{worst_tag[1]}); acceptance ≥ {TAG_PAIR_MIN_NORMAL}.',
           '', '## Player palette bases', '', markdown(pn, ph), '',
           '## Player palette rims (the far-dot colour)', '', markdown(pn, PLAYER_RIMS), '',
           '## Contrast against `BG_FIELD` (WCAG ratio)', '', '| Palette | base | rim |', '| --- | --- | --- |']
    for (n, h), r in zip(PLAYER_PALETTES, PLAYER_RIMS):
        out.append(f'| {n} | {contrast(h, BG_FIELD):.1f} | {contrast(r, BG_FIELD):.1f} |')
    out += ['', '## DNA tag colours', '', markdown(tn, th), '']
    return '\n'.join(out)


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'qa/evidence/34/palette-separability.md'
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(report())
    print(open(path, encoding='utf-8').read().split('## Player palette bases')[0])

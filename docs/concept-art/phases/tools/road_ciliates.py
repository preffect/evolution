#!/usr/bin/env python3
"""Sheet R4: the ciliates (paramecium and stentor), real dead ends for multicell: three options (ticket #782)."""
import math
import sys

from phase_art import ACCENT, GOOD, MUTED, PALETTES, PICK, TEXT, WARN, Sheet

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/phases/road-ciliates.svg'
art = Sheet(1920, 1080, 7827, 'Evolution — phases concept R4: the paramecium and the stentor, dead ends with three options',
            'Ciliates never became many-celled. Option A keeps them as the last great single cells with real upgrades '
            '(trichocysts, conjugation, anchored crowds, regrowth); B borrows a colonial ciliate; C switches road. Code-drawn.')
art.header('concept R4 — THE CILIATES · the paramecium and the stentor stay one cell',
           'In real life neither line ever became many-celled: they bet on one huge, complicated cell. Three ways to handle that in the game.',
           'ticket #782 · epic #761', 'dark-field language of sheets 01 and 04 · zero raster')

# ---------------------------------------------------------------- A · the last great single cells (recommended)
art.panel(40, 90, 1120, 600, 'A · STAY ONE CELL: the last great single cells   (recommended)', 'real upgrades from their own biology; they become the pond\'s specialists', stroke=GOOD)

# paramecium: trichocysts at a Didinium
px, py = 230, 290
art.paramecium(px, py, 230, heading=0)
for k in range(9):
    a = math.radians(-60 + k * 15)
    x0, y0 = px + 95 * math.cos(a), py + 45 * math.sin(a)
    art.emit(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x0 + 70 * math.cos(a):.1f}" y2="{y0 + 70 * math.sin(a):.1f}" stroke="{PICK}" '
             f'stroke-width="1.4" opacity="0.8"/>')
art.didinium(470, 250, 34, heading=170)
art.text(px, 400, 'Trichocysts: fires a burst of tiny harpoons', 12, TEXT, 700, 'middle')
art.text(px, 417, 'a real defence against Didinium · a new active ability', 10.5, MUTED, 400, 'middle', mono=True)

# paramecium conjugation pair
cx, cy = 230, 540
art.paramecium(cx - 10, cy - 28, 170, heading=8)
art.paramecium(cx + 10, cy + 28, 170, heading=-172, pal='magenta')
art.emit(f'<circle cx="{cx}" cy="{cy}" r="14" fill="{PICK}" opacity="0.35" filter="url(#blur-6)"/>')
art.text(cx, 630, 'Conjugation: pair up and swap one trait', 12, TEXT, 700, 'middle')
art.text(cx, 647, 'real sex in a single cell · co-op without a merged body', 10.5, MUTED, 400, 'middle', mono=True)

# stentor: the anchored crowd
sx, sy = 760, 150
art.filament(560, 360, 520, heading=-6, cell_len=52, width=22)
for (dx, lean, ln) in ((-160, -0.08, 140), (-50, 0.0, 160), (60, 0.05, 150), (170, 0.1, 135)):
    art.stentor(sx + dx, sy + 190 - ln + 10, ln, lean=lean)
for k in range(5):
    art.emit(f'<path d="M{520 + k * 10} {170 + k * 16} q 240 -{70 - k * 8} 480 0" fill="none" stroke="{ACCENT}" stroke-width="1.2" '
             f'opacity="0.35" stroke-dasharray="8 6" marker-end="url(#arrow)"/>')
art.text(sx + 10, 400, 'The anchored crowd: stentors that share a current', 12, TEXT, 700, 'middle')
art.text(sx + 10, 417, 'anchor, and nearby stentors pool their whirlpools: food from farther', 10.5, MUTED, 400, 'middle', mono=True)

# stentor: regrowth
rx, ry = 700, 560
art.stentor(rx - 130, ry + 20, 45, lean=0.0)
art.arrow(rx - 100, ry + 40, rx - 70, ry + 40, ACCENT, 1.4)
art.stentor(rx - 20, ry - 20, 85, lean=0.02)
art.arrow(rx + 20, ry + 40, rx + 50, ry + 40, ACCENT, 1.4)
art.stentor(rx + 110, ry - 70, 120, lean=0.03)
art.text(rx + 20, 630, 'Regrowth: a bitten stentor regrows from a piece', 12, TEXT, 700, 'middle')
art.text(rx + 20, 647, 'a real feat · the ciliate answer to the colony\'s spare lives', 10.5, MUTED, 400, 'middle', mono=True)

art.lines(930, 470, ['Also for both:', '• the tier-II and tier-III form', '  upgrades that no round reaches', '  today get a home in the pond',
                     '• the pond\'s specialists: fast', '  hunters of small colonies'], 11.5, TEXT, 17)

# ---------------------------------------------------------------- B · a borrowed colony road
art.panel(1180, 90, 700, 290, 'B · A BORROWED COLONY ROAD', 'the stentor grows a branching tree of bell-cells on one shared stalk')
tx, ty = 1400, 372
art.emit(f'<path d="M{tx} {ty} V{ty - 90} M{tx} {ty - 60} L{tx - 70} {ty - 150} M{tx} {ty - 90} L{tx + 60} {ty - 170} '
         f'M{tx - 40} {ty - 110} L{tx - 20} {ty - 190} M{tx + 30} {ty - 130} L{tx + 110} {ty - 150}" stroke="{PALETTES["violet"][1]}" '
         f'stroke-width="2.2" fill="none" opacity="0.7"/>')
for (bx, by) in ((tx - 70, ty - 150), (tx + 60, ty - 170), (tx - 20, ty - 190), (tx + 110, ty - 150), (tx, ty - 90)):
    art.stentor(bx, by - 22, 30, pal='violet')
art.lines(1560, 180, ['Real model: Zoothamnium,', 'a colonial bell ciliate.', 'But it is a different', 'family from the stentor,',
                      'and the paramecium has', 'no real road at all:', 'we would invent one.'], 11.5, TEXT, 17)

# ---------------------------------------------------------------- C · switch road
art.panel(1180, 400, 700, 290, 'C · SWITCH ROAD WHEN COLONIES ARRIVE', 'at 17:00 a ciliate player picks one of the three real roads')
art.paramecium(1300, 560, 120, heading=0)
for i, (label, pal, yy) in enumerate((('green road', 'green', 480), ('gathering road', 'amber', 560), ('glass road', 'silica', 640))):
    art.arrow(1370, 560, 1560, yy, ACCENT, 1.4)
    art.mini_cell(1590, yy, 16, pal, halo=0.3)
    art.text(1615, yy + 5, label, 12, TEXT, 600)
art.lines(1200, 470, ['Simple to build;', 'but you drop the', 'form you chose.'], 11, MUTED, 16)

# ---------------------------------------------------------------- D · the real story and recommendation
art.note_panel(40, 710, 1840, 330, 'D · THE REAL STORY, AND WHY A', [
    '§ True',
    '• Ciliates (paramecium, stentor) never evolved a many-celled body. Instead each is one of the most complex cells alive, with two kinds of nucleus.',
    '• Paramecium fires trichocysts, tiny harpoons, when Didinium attacks; it reproduces by splitting and has sex by conjugation, swapping nuclei with a partner.',
    '• Stentor coeruleus (up to ~2 mm) can regrow a whole cell from a small piece (Tartar, "The Biology of Stentor", 1961), and anchored stentors that settle close together',
    '  feed better by pooling their currents (Shekhar et al., Current Biology 2023).',
    '• The paramecium even shaped multicellular life: a green alga hunted by paramecia evolved clusters in the lab (Herron et al., Scientific Reports 2019).',
    '§ Recommendation: A',
    '• It is true to life, it teaches something ("not every line goes multicellular"), and it keeps the form the player chose. B invents biology; C throws the choice away.',
    '• The cost: the ciliates need their own pond upgrades (about 3 tickets), and the pond needs to make one big fast cell as viable as a colony (a balance job).',
], 'these are the forms that elongate: the paramecium slipper and the stentor trumpet (the euglena has the green road)')
art.footer('R4 · the ciliates · game numbers are proposals', 'docs/concept-art/phases/road-ciliates.svg · 1920 × 1080')
art.save(OUT)

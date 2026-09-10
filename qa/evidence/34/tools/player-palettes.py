#!/usr/bin/env python3
# usage: python3 qa/evidence/34/tools/player-palettes.py [qa/evidence/34/player-palettes.svg]   (byte-stable)
"""Generator for qa/evidence/34/player-palettes.svg (VISUAL-STYLE.md §2 evidence, ticket #34).

Draws the eight player palettes on the dark field at full LOD with their seat marks and the own cell's
self ring, then the same eight at the mid-LOD floor (20 px and 8 px) and as far dots. Everything is
code-drawn (gradients, blur / turbulence filters, layered circles); zero raster. Re-run after any palette
change, then `qa/evidence/34/tools/render.sh` renders the PNG and its dichromat simulations.

The constants below mirror VISUAL-STYLE.md §2 / §6 and concept sheet 01; the doc is the home of the values.
"""
import colorsys
import math
import sys

W, H = 1920, 1000
OUT: list[str] = []


def emit(s: str) -> None:
    OUT.append(s)


# ---------------------------------------------------------------- field, UI (sheet 02 / 03)
BG_DEEP, BG_FIELD = '#04070d', '#0b1626'
PANEL_RIM = '#173250'
TEXT, MUTED, DIM, ACCENT = '#cfdbe6', '#7d8da1', '#55657a', '#7fe7f5'
OUTLINE = '#020509'
SELF_RING = '#ffffff'
SEAT_MARK_CORE = '#ffffff'
MITO_BASE, MITO_LIGHT = '#ffb15a', '#ffd39a'

# ---------------------------------------------------------------- player palettes (VISUAL-STYLE.md §2)
# index, name, base, rim, nuc — six from sheet 01, Mint and Rose added by #34
PALETTES = [
    (0, 'Cyan', '#22c1d6', '#a6f4ff', '#6fdcef'),
    (1, 'Coral', '#ff6b5c', '#ffd0c8', '#ff9a8c'),
    (2, 'Lime', '#7ed321', '#dcffb0', '#b5ef62'),
    (3, 'Violet', '#7b5cf0', '#d2c4ff', '#a995ff'),
    (4, 'Amber', '#e0a12a', '#ffe7a3', '#f5c85c'),
    (5, 'Mint', '#24db98', '#b2ffe3', '#71f4c4'),
    (6, 'Magenta', '#d43fb0', '#ffb3ec', '#f07ad2'),
    (7, 'Rose', '#bc5768', '#ffb2bf', '#f47187'),
]
# seat mark: bead count per palette index (VISUAL-STYLE.md §2, SEAT_MARK_BEADS)
SEAT_MARK_BEADS = [1, 2, 3, 4, 5, 6, 7, 8]
SEAT_MARK_BEAD_RADIUS_FRACTION = 0.05
SEAT_MARK_BEAD_MIN_PX = 2.0
SEAT_MARK_ANCHOR_DEG = -135.0  # first bead at the light direction (top-left)
SELF_RING_RADIUS_FRACTION = 1.12
SELF_RING_MIN_PX = 7.5
CELL_FAR_DOT_MIN_PX = 3.0


def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip('#')
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(c: tuple[float, float, float]) -> str:
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)


def derive(base: str) -> dict[str, str]:
    """Sheet 01 HSL rule: edge L 42 %, cyto light L 55 %, cyto dark L 22 % / S × 0.55, nuc dark L 60 %."""
    r, g, b = hex_to_rgb(base)
    h, _l, s = colorsys.rgb_to_hls(r, g, b)
    mk = lambda ll, ss: rgb_to_hex(colorsys.hls_to_rgb(h, ll, ss))  # noqa: E731
    return {'edge': mk(0.42, s), 'cyto_l': mk(0.55, s), 'cyto_d': mk(0.22, s * 0.55), 'nuc_d': mk(0.60, s)}


def f(v: float) -> str:
    return f'{v:.1f}'.rstrip('0').rstrip('.')


# ---------------------------------------------------------------- drawing
def defs() -> None:
    emit('<defs>')
    emit(
        f'<radialGradient id="field" cx="0.3" cy="0.3" r="0.9"><stop offset="0" stop-color="{BG_FIELD}"/>'
        f'<stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>'
    )
    emit(
        '<filter id="blur12"><feGaussianBlur stdDeviation="6"/></filter>'
        '<filter id="blur3"><feGaussianBlur stdDeviation="1.5"/></filter>'
        '<filter id="blur1"><feGaussianBlur stdDeviation="0.8"/></filter>'
    )
    emit(
        '<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7"/>'
        '<feColorMatrix type="matrix" values="0 0 0 0 0.35 0 0 0 0 0.6 0 0 0 0 0.7 0 0 0 0.22 0"/></filter>'
    )
    for i, _n, base, rim, nuc in PALETTES:
        d = derive(base)
        emit(
            f'<radialGradient id="halo{i}"><stop offset="0.72" stop-color="{rim}" stop-opacity="0.34"/>'
            f'<stop offset="1" stop-color="{rim}" stop-opacity="0"/></radialGradient>'
        )
        emit(
            f'<radialGradient id="body{i}" cx="0.36" cy="0.34" r="0.78">'
            f'<stop offset="0" stop-color="{d["cyto_l"]}" stop-opacity="0.85"/>'
            f'<stop offset="0.55" stop-color="{d["cyto_d"]}" stop-opacity="0.6"/>'
            f'<stop offset="0.9" stop-color="{base}" stop-opacity="0.55"/>'
            f'<stop offset="1" stop-color="{rim}" stop-opacity="0.45"/></radialGradient>'
        )
        emit(
            f'<linearGradient id="rim{i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/>'
            f'<stop offset="0.25" stop-color="{rim}"/><stop offset="0.7" stop-color="{base}"/>'
            f'<stop offset="1" stop-color="{rim}"/></linearGradient>'
        )
        emit(
            f'<radialGradient id="nuc{i}" cx="0.4" cy="0.38" r="0.7"><stop offset="0" stop-color="{nuc}"/>'
            f'<stop offset="1" stop-color="{d["nuc_d"]}"/></radialGradient>'
        )
    emit('</defs>')


def seat_marks(cx: float, cy: float, r: float, index: int, rim: str) -> None:
    beads = SEAT_MARK_BEADS[index]
    br = max(SEAT_MARK_BEAD_MIN_PX, r * SEAT_MARK_BEAD_RADIUS_FRACTION)
    for k in range(beads):
        a = math.radians(SEAT_MARK_ANCHOR_DEG + 360 * k / beads)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        emit(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(br * 2.2)}" fill="{rim}" opacity="0.45" filter="url(#blur1)"/>')
        emit(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(br)}" fill="{SEAT_MARK_CORE}" opacity="0.92"/>')


def self_ring(cx: float, cy: float, r: float) -> None:
    rr = max(SELF_RING_MIN_PX, r * SELF_RING_RADIUS_FRACTION)
    emit(
        f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(rr)}" fill="none" stroke="{SELF_RING}" stroke-width="1.5" '
        f'stroke-opacity="0.7" stroke-dasharray="6 4"/>'
    )


def full_cell(cx: float, cy: float, r: float, index: int, own: bool) -> None:
    _i, _n, base, rim, _nuc = PALETTES[index]
    d = derive(base)
    emit(f'<circle cx="{cx}" cy="{cy}" r="{f(r * 1.28)}" fill="url(#halo{index})" filter="url(#blur12)"/>')
    emit(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#body{index})"/>')
    emit(
        f'<clipPath id="clip{index}"><circle cx="{cx}" cy="{cy}" r="{r}"/></clipPath>'
        f'<g clip-path="url(#clip{index})"><rect x="{f(cx - r)}" y="{f(cy - r)}" width="{f(2 * r)}" height="{f(2 * r)}" '
        f'fill="#8cc" filter="url(#noise)" opacity="0.5"/></g>'
    )
    emit(
        f'<ellipse cx="{f(cx + 0.3 * r)}" cy="{f(cy + 0.35 * r)}" rx="{f(0.6 * r)}" ry="{f(0.45 * r)}" '
        f'fill="#000" opacity="0.35" filter="url(#blur12)"/>'
    )
    emit(f'<circle cx="{cx}" cy="{cy}" r="{f(r * 0.945)}" fill="none" stroke="{d["edge"]}" stroke-width="{f(r * 0.11)}" opacity="0.55"/>')
    for k, (ox, oy, rot) in enumerate(((0.45, -0.2, 20), (-0.4, 0.35, 50), (0.15, 0.5, 80))):
        emit(
            f'<ellipse cx="{f(cx + ox * r)}" cy="{f(cy + oy * r)}" rx="{f(0.08 * r)}" ry="{f(0.04 * r)}" '
            f'transform="rotate({rot} {f(cx + ox * r)} {f(cy + oy * r)})" fill="{MITO_BASE}" stroke="{MITO_LIGHT}" stroke-width="0.8"/>'
        )
    nx, ny = cx - 0.12 * r, cy - 0.12 * r
    emit(f'<circle cx="{f(nx)}" cy="{f(ny)}" r="{f(0.48 * r)}" fill="{_nuc}" opacity="0.25" filter="url(#blur12)"/>')
    emit(f'<circle cx="{f(nx)}" cy="{f(ny)}" r="{f(0.30 * r)}" fill="url(#nuc{index})" stroke="{rim}" stroke-width="1.2" stroke-opacity="0.8"/>')
    emit(f'<circle cx="{f(nx - 0.06 * r)}" cy="{f(ny - 0.06 * r)}" r="{f(0.065 * r)}" fill="#ffffff" opacity="0.85"/>')
    emit(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="url(#rim{index})" stroke-width="{f(r * 0.05)}"/>')
    emit(f'<circle cx="{cx}" cy="{cy}" r="{f(r * 1.03)}" fill="none" stroke="{OUTLINE}" stroke-width="0.8" opacity="0.5"/>')
    emit(
        f'<ellipse cx="{f(cx - 0.45 * r)}" cy="{f(cy - 0.55 * r)}" rx="{f(0.22 * r)}" ry="{f(0.08 * r)}" '
        f'transform="rotate(-35 {f(cx - 0.45 * r)} {f(cy - 0.55 * r)})" fill="#fff" opacity="0.5" filter="url(#blur3)"/>'
    )
    seat_marks(cx, cy, r, index, rim)
    if own:
        self_ring(cx, cy, r)


def mid_cell(cx: float, cy: float, r: float, index: int, own: bool) -> None:
    """Mid LOD (8–20 px): halo, flat body, rim, outline, nucleus disc, seat marks, self ring; no interior."""
    _i, _n, base, rim, nuc = PALETTES[index]
    emit(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 1.28)}" fill="url(#halo{index})" filter="url(#blur3)"/>')
    emit(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{base}" opacity="0.6"/>')
    emit(f'<circle cx="{f(cx - 0.12 * r)}" cy="{f(cy - 0.12 * r)}" r="{f(max(1.5, 0.30 * r))}" fill="{nuc}" opacity="0.9"/>')
    emit(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="none" stroke="{rim}" stroke-width="{f(max(1.0, r * 0.05))}"/>')
    emit(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r + 0.6)}" fill="none" stroke="{OUTLINE}" stroke-width="0.6" opacity="0.5"/>')
    seat_marks(cx, cy, r, index, rim)
    if own:
        self_ring(cx, cy, r)


def far_dot(cx: float, cy: float, index: int) -> None:
    rim = PALETTES[index][3]
    emit(f'<circle cx="{cx}" cy="{cy}" r="{f(CELL_FAR_DOT_MIN_PX * 3)}" fill="{rim}" opacity="0.28" filter="url(#blur3)"/>')
    emit(f'<circle cx="{cx}" cy="{cy}" r="{f(CELL_FAR_DOT_MIN_PX)}" fill="{rim}"/>')


def swatches(cx: float, y: float, index: int) -> None:
    _i, _n, base, rim, nuc = PALETTES[index]
    d = derive(base)
    cols = [base, rim, nuc, d['edge'], d['cyto_l'], d['cyto_d'], d['nuc_d']]
    x0 = cx - (len(cols) * 26 - 4) / 2
    for k, c in enumerate(cols):
        emit(f'<rect x="{f(x0 + k * 26)}" y="{y}" width="22" height="14" rx="2" fill="{c}" stroke="{PANEL_RIM}"/>')


def label(x: float, y: float, text: str, size: int, fill: str, weight: str = 'normal', anchor: str = 'start', mono: bool = False) -> None:
    fam = ' font-family="DejaVu Sans Mono, monospace"' if mono else ''
    emit(f'<text x="{f(x)}" y="{f(y)}" text-anchor="{anchor}" fill="{fill}" font-size="{size}" font-weight="{weight}"{fam}>{text}</text>')


def main(path: str) -> None:
    emit(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="DejaVu Sans, sans-serif">')
    defs()
    emit(f'<rect width="{W}" height="{H}" fill="url(#field)"/>')
    label(40, 52, 'EVOLUTION · VISUAL-STYLE.md evidence — the eight player palettes (#34)', 30, TEXT, 'bold')
    label(
        40, 80,
        'palette index 0–7 = seat order · six hues from concept sheet 01, Mint (5) and Rose (7) added so PLAYER_PALETTE_COUNT = MAX_PLAYERS_PER_GAME = 8 · '
        'seat mark = 1–8 rim beads anchored top-left · own cell: dashed SELF_RING at 1.12 r',
        15, MUTED,
    )
    label(40, 100, 'separability: every base pair ΔE2000 ≥ 15 under normal vision; Rose ≥ 18 from all seven under normal, deutan and protan (qa/evidence/34/palette-separability.md)', 15, MUTED)

    # full LOD row (r = 52 px, the mid-round own-cell size band)
    r = 52
    for i, name, base, rim, nuc in PALETTES:
        cx = 140 + i * 233
        full_cell(cx, 290, r, i, own=(i == 0))
        label(cx, 384, f'{i} {name.upper()}', 18, TEXT, 'bold', 'middle')
        label(cx, 406, f'base {base} · rim {rim}', 12, MUTED, anchor='middle', mono=True)
        label(cx, 424, f'nuc {nuc} · {SEAT_MARK_BEADS[i]} bead{"s" if SEAT_MARK_BEADS[i] > 1 else ""}', 12, MUTED, anchor='middle', mono=True)
        swatches(cx, 438, i)
    label(
        960, 472,
        'swatches: base · rim · nucleus · edge (L 42 %) · cytoplasm light (L 55 %) · cytoplasm dark (L 22 %, S × 0.55) · nucleus dark (L 60 %) — derived from base in HSL, concept-art README sheet 01',
        12, DIM, anchor='middle',
    )

    # mid LOD strip: 20 px and 8 px
    emit(f'<rect x="40" y="500" width="1840" height="230" rx="10" fill="{BG_DEEP}" opacity="0.6" stroke="{PANEL_RIM}"/>')
    label(60, 526, 'MID LOD · 8–20 px on screen · halo, body, rim, outline, nucleus disc, seat marks (2 px bead floor) and the self ring survive; interior drops', 14, ACCENT, 'bold')
    for i, name, *_ in PALETTES:
        cx = 140 + i * 233
        mid_cell(cx, 590, 20, i, own=(i == 0))
        mid_cell(cx + 80, 590, 8, i, own=(i == 0))
        label(cx - 26, 660, '20 px', 12, DIM, anchor='middle')
        label(cx + 80, 660, '8 px', 12, DIM, anchor='middle')
        label(cx + 27, 690, f'{i} {name}', 13, MUTED, anchor='middle')

    # far LOD strip
    emit(f'<rect x="40" y="760" width="1840" height="110" rx="10" fill="{BG_DEEP}" opacity="0.6" stroke="{PANEL_RIM}"/>')
    label(60, 786, 'FAR LOD · &lt; 8 px · rim dot at the 3 px floor + halo, no interior, no seat mark: a presence tell, not an identity tell (the own cell never reaches this LOD in play)', 14, ACCENT, 'bold')
    for i, name, *_ in PALETTES:
        cx = 120 + i * 220
        far_dot(cx, 830, i)
        label(cx + 22, 835, f'{i} {name}', 13, MUTED)

    label(W - 40, H - 14, 'Evolution · qa/evidence/34/player-palettes.svg · generated by qa/evidence/34/tools/player-palettes.py', 12, DIM, anchor='end')
    emit('</svg>')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(OUT) + '\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'qa/evidence/34/player-palettes.svg')

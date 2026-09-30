"""Shared drawing kit for the phase concept sheets (ticket #782).

Every sheet under docs/concept-art/phases/ is emitted by a script in this folder that imports this module.
The visual language is sheet 01 / sheet 04's (docs/concept-art/README.md): dark-field microscopy, light from
the top-left, a translucent layered membrane, textured cytoplasm, zero raster. The helpers below are a
trimmed, palette-generic version of docs/concept-art/tools/origins-ladder.py's.

Usage from a sheet script:  art = Sheet(1920, 1080, seed, title, desc) ... art.save(path)
"""
import math
import random

# ---------------------------------------------------------------- palette (sheet 01 / sheet 04 constants)
BG_DEEP, BG_FIELD = '#04070d', '#0b1626'
PANEL, PANEL_STROKE = '#0a1422', '#1a2a3b'
TEXT, MUTED, ACCENT = '#cfdbe6', '#7d8da1', '#7fe7f5'
WARN, GOOD, PICK = '#ffb15a', '#8dff6a', '#ffd166'
OUTLINE = '#020509'
FOOD_MOTE, FOOD_MOTE_D = '#8dff6a', '#3f9a2c'
EYESPOT, EYESPOT_RIM = '#ff4d3a', '#ffb59e'
CHLORO_L, CHLORO, CHLORO_D = '#b8ff9a', '#63d64a', '#1f7a2b'
PLASTID_L, PLASTID_D = '#d7a441', '#8a5e14'
SILICA_L, SILICA, SILICA_D = '#eef9ff', '#a9dcef', '#2f6f8c'
POND_DEEP, POND_FIELD, POND_SUN = '#030a0a', '#0a1d1c', '#9fe8c8'
MONO = 'JetBrains Mono, DejaVu Sans Mono, Consolas, Menlo, monospace'
SANS = "Inter, 'Segoe UI', DejaVu Sans, Helvetica, Arial, sans-serif"

# name -> (base, rim, cytoplasm light, cytoplasm dark, inner edge, nucleus)
PALETTES = {
    'cyan': ('#22c1d6', '#a6f4ff', '#1d636c', '#102426', '#124e56', '#6fdcef'),  # the player (sheet 01)
    'magenta': ('#e0569b', '#ffb3d9', '#6c2448', '#220a18', '#561a3a', '#ff9ccb'),  # a second player
    'green': ('#63d64a', '#b8ff9a', '#2c6b2a', '#0f2412', '#1f5a24', '#c8ffb0'),  # green algae
    'silica': ('#a9dcef', '#eef9ff', '#2f6f8c', '#0d1e28', '#1d4a5c', '#cfeeff'),  # diatom glass
    'violet': ('#9b7cf0', '#d9c8ff', '#3a2a6c', '#140f26', '#2e2060', '#c4b0ff'),  # stentor
    'amber': ('#f0a050', '#ffd8a8', '#6c4020', '#26160a', '#5a3010', '#ffc890'),  # slime-mould amoebae
    'rose': ('#d890b8', '#ffd0ea', '#5c3050', '#1e1020', '#4a2040', '#f0b0d8'),  # rotifer (an animal)
    'coral': ('#ff7a5c', '#ffc0b0', '#6c2a1c', '#240c08', '#5a2010', '#ffb09c'),  # Didinium, the hunter
    'sand': ('#c8c0a0', '#f0ecd8', '#5a5440', '#1c1a12', '#48402c', '#e8e0c0'),  # nematode
    'ghost': ('#7d8da1', '#cfdbe6', '#2a3440', '#0c1016', '#222c38', '#a8b8c8'),  # greyed / locked
}


def wrap(dth):
    while dth > math.pi:
        dth -= 2 * math.pi
    while dth < -math.pi:
        dth += 2 * math.pi
    return dth


def bump(th, at, amp, width):
    return amp * math.exp(-(wrap(th - at) / width) ** 2)


def ellipse_fn(ax, by):
    return lambda th: 1 / math.sqrt((math.cos(th) / ax) ** 2 + (math.sin(th) / by) ** 2)


def polar_points(cx, cy, r, fn, n=72, rot=0.0):
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        rr = r * fn(th)
        pts.append((cx + rr * math.cos(th + rot), cy + rr * math.sin(th + rot)))
    return pts


def smooth_closed(pts, tension=1.0):
    n = len(pts)
    d = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    d.append('Z')
    return ' '.join(d)


def smooth_open(pts, tension=1.0):
    n = len(pts)
    d = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ' '.join(d)


def blur_id(sigma):
    for s in (1.5, 3, 6, 10, 16, 26):
        if sigma <= s * 1.35:
            return f'blur-{str(s).replace(".", "_")}'
    return 'blur-26'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Sheet:
    """One SVG document: `emit` appends markup; the helpers draw in the sheet-01 language."""

    def __init__(self, width, height, seed, title, desc, background='field'):
        self.w, self.h = width, height
        self.rng = random.Random(seed)
        self.out = []
        self._k = 0
        self.emit(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
                  f'viewBox="0 0 {width} {height}" font-family="{SANS}">')
        self.emit(f'<title>{esc(title)}</title>')
        self.emit(f'<desc>{esc(desc)}</desc>')
        self._defs()
        if background:
            self.backdrop(0, 0, width, height, background)

    # ------------------------------------------------------------ plumbing
    def emit(self, s):
        self.out.append(s)

    def uid(self, prefix):
        self._k += 1
        return f'{prefix}{self._k}'

    def save(self, path):
        self.emit('</svg>')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.out) + '\n')

    def _defs(self):
        e = self.emit
        e('<defs>')
        e(f'<radialGradient id="bg-field" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="{BG_FIELD}"/>'
          f'<stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>')
        e(f'<radialGradient id="bg-pond" cx="0.35" cy="0.2" r="0.95"><stop offset="0" stop-color="#123a33"/>'
          f'<stop offset="0.45" stop-color="{POND_FIELD}"/><stop offset="1" stop-color="{POND_DEEP}"/></radialGradient>')
        e('<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72"><stop offset="0.6" stop-color="#000000" stop-opacity="0"/>'
          '<stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>')
        e(f'<linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{ACCENT}" stop-opacity="0.07"/>'
          f'<stop offset="0.5" stop-color="{ACCENT}" stop-opacity="0"/></linearGradient>')
        e(f'<linearGradient id="sunbeam" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="{POND_SUN}" stop-opacity="0.16"/>'
          f'<stop offset="1" stop-color="{POND_SUN}" stop-opacity="0"/></linearGradient>')
        for s in (1.5, 3, 6, 10, 16, 26):
            e(f'<filter id="blur-{str(s).replace(".", "_")}" x="-60%" y="-60%" width="220%" height="220%">'
              f'<feGaussianBlur stdDeviation="{s}"/></filter>')
        e('<filter id="cyto-noise" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.045" '
          'numOctaves="3" seed="11" result="n"/><feColorMatrix in="n" type="matrix" '
          'values="0 0 0 0 0.62  0 0 0 0 0.93  0 0 0 0 1  1.6 0 0 0 -0.62"/></filter>')
        for name, (base, rim, cl, cd, _edge, nuc) in PALETTES.items():
            e(f'<radialGradient id="body-{name}" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{cl}" stop-opacity="0.45"/>'
              f'<stop offset="0.55" stop-color="{cd}" stop-opacity="0.58"/><stop offset="0.86" stop-color="{base}" stop-opacity="0.55"/>'
              f'<stop offset="1" stop-color="{rim}" stop-opacity="0.85"/></radialGradient>')
            e(f'<linearGradient id="rim-{name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>'
              f'<stop offset="0.18" stop-color="{rim}" stop-opacity="0.95"/><stop offset="0.55" stop-color="{base}" stop-opacity="0.55"/>'
              f'<stop offset="1" stop-color="{rim}" stop-opacity="0.55"/></linearGradient>')
            e(f'<radialGradient id="nuc-{name}" cx="0.38" cy="0.34" r="0.7"><stop offset="0" stop-color="{rim}" stop-opacity="0.95"/>'
              f'<stop offset="0.5" stop-color="{nuc}" stop-opacity="0.9"/><stop offset="1" stop-color="{cl}" stop-opacity="0.95"/></radialGradient>')
        e(f'<radialGradient id="chloro-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{CHLORO_L}"/>'
          f'<stop offset="0.45" stop-color="{CHLORO}"/><stop offset="1" stop-color="{CHLORO_D}"/></radialGradient>')
        e(f'<radialGradient id="plastid-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#f2d27a"/>'
          f'<stop offset="0.5" stop-color="{PLASTID_L}"/><stop offset="1" stop-color="{PLASTID_D}"/></radialGradient>')
        e(f'<radialGradient id="mote-g" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/>'
          f'<stop offset="0.35" stop-color="{FOOD_MOTE}"/><stop offset="1" stop-color="{FOOD_MOTE_D}"/></radialGradient>')
        e(f'<radialGradient id="eyespot-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{EYESPOT_RIM}"/>'
          f'<stop offset="0.5" stop-color="{EYESPOT}"/><stop offset="1" stop-color="#8a1a0e"/></radialGradient>')
        e(f'<radialGradient id="dish-g" cx="0.45" cy="0.4" r="0.6"><stop offset="0" stop-color="{BG_FIELD}"/>'
          f'<stop offset="0.9" stop-color="#0d2230"/><stop offset="1" stop-color="{ACCENT}" stop-opacity="0.6"/></radialGradient>')
        e(f'<radialGradient id="drop-g" cx="0.4" cy="0.35" r="0.65"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>'
          f'<stop offset="0.3" stop-color="{ACCENT}" stop-opacity="0.18"/><stop offset="0.9" stop-color="{ACCENT}" stop-opacity="0.12"/>'
          f'<stop offset="1" stop-color="#ffffff" stop-opacity="0.7"/></radialGradient>')
        e('<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
          f'<path d="M0 0 L10 5 L0 10 z" fill="{ACCENT}"/></marker>')
        e('<marker id="arrow-warn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
          f'<path d="M0 0 L10 5 L0 10 z" fill="{WARN}"/></marker>')
        e('</defs>')

    # ------------------------------------------------------------ backgrounds and layout
    def backdrop(self, x, y, w, h, kind='field', particles=None):
        grad = 'bg-pond' if kind == 'pond' else 'bg-field'
        self.emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#{grad})"/>')
        if kind == 'pond':
            for i in range(3):
                bx = x + w * (0.12 + 0.28 * i)
                self.emit(f'<polygon points="{bx:.0f},{y} {bx + w * 0.12:.0f},{y} {bx + w * 0.3:.0f},{y + h} {bx + w * 0.16:.0f},{y + h}" '
                          f'fill="url(#sunbeam)"/>')
        else:
            self.emit(f'<polygon points="{x},{y} {x + w * 0.55:.0f},{y} {x},{y + h * 0.7:.0f}" fill="url(#beam)"/>')
        count = particles if particles is not None else int(w * h / 26000)
        for _ in range(count):
            px, py = x + self.rng.uniform(0, w), y + self.rng.uniform(0, h)
            col = self.rng.choice(('#ffffff', '#9fe8f5', '#c4f0ff', '#7fb8ff'))
            if self.rng.random() < 0.7:
                self.emit(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{self.rng.choice((0.8, 1, 1.3))}" fill="{col}" '
                          f'opacity="{self.rng.uniform(0.07, 0.28):.2f}"/>')
            else:
                self.emit(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{self.rng.choice((2, 4, 7))}" fill="{col}" '
                          f'opacity="{self.rng.uniform(0.04, 0.12):.2f}" filter="url(#blur-3)"/>')

    def text(self, x, y, s, size=11, fill=MUTED, weight=400, anchor='start', mono=False, extra=''):
        fam = f' font-family="{MONO}"' if mono else ''
        self.emit(f'<text x="{x:.1f}" y="{y:.1f}" fill="{fill}" font-size="{size}" font-weight="{weight}" '
                  f'text-anchor="{anchor}"{fam}{extra}>{esc(s)}</text>')

    def lines(self, x, y, rows, size=11, fill=MUTED, step=None, mono=False, anchor='start', weight=400):
        step = step or size * 1.4
        for i, row in enumerate(rows):
            self.text(x, y + i * step, row, size, fill, weight, anchor, mono)

    def header(self, title, subtitle, right_top, right_bottom):
        self.text(40, 46, 'EVOLUTION', 26, TEXT, 800)
        self.text(214, 46, '· ' + title, 20, ACCENT, 500)
        self.text(40, 68, subtitle, 12, MUTED)
        self.text(self.w - 40, 46, right_top, 12, MUTED, 400, 'end')
        self.text(self.w - 40, 68, right_bottom, 12, MUTED, 400, 'end')

    def footer(self, left, right):
        self.text(40, self.h - 14, left, 10.5, MUTED, 400, mono=True)
        self.text(self.w - 40, self.h - 14, right, 10.5, MUTED, 400, 'end', mono=True)

    def panel(self, x, y, w, h, title=None, subtitle=None, stroke=PANEL_STROKE, fill_opacity=0.45):
        self.emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{PANEL}" fill-opacity="{fill_opacity}" '
                  f'stroke="{stroke}" stroke-width="1"/>')
        if title:
            self.text(x + 16, y + 26, title, 15, ACCENT, 700)
        if subtitle:
            self.text(x + 16, y + 44, subtitle, 11.5, MUTED)

    def chip(self, x, y, s, colour=ACCENT, size=10.5):
        wdt = 0.64 * size * len(s) + 22
        self.emit(f'<rect x="{x:.1f}" y="{y - 12:.1f}" width="{wdt:.0f}" height="18" rx="9" fill="{colour}" fill-opacity="0.12" '
                  f'stroke="{colour}" stroke-opacity="0.55" stroke-width="0.8"/>')
        self.text(x + 11, y + 1, s, size, colour, 600, mono=True)
        return wdt

    def arrow(self, x1, y1, x2, y2, colour=ACCENT, width=2.0, dashed=False, bend=0.0, warn=False):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        nx, ny = -(y2 - y1), (x2 - x1)
        ln = math.hypot(nx, ny) or 1
        cx, cy = mx + bend * nx / ln, my + bend * ny / ln
        dash = ' stroke-dasharray="6 5"' if dashed else ''
        marker = 'arrow-warn' if warn else 'arrow'
        self.emit(f'<path d="M{x1:.1f} {y1:.1f} Q{cx:.1f} {cy:.1f} {x2:.1f} {y2:.1f}" fill="none" stroke="{colour}" '
                  f'stroke-width="{width}" opacity="0.85"{dash} marker-end="url(#{marker})"/>')

    def leader(self, x1, y1, x2, y2):
        self.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ACCENT}" stroke-width="0.8" opacity="0.5"/>')
        self.emit(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="2" fill="{ACCENT}" opacity="0.9"/>')

    def scale_bar(self, x, y, px, label):
        self.emit(f'<path d="M{x} {y - 5} V{y} H{x + px:.1f} V{y - 5}" fill="none" stroke="{TEXT}" stroke-width="1.2" opacity="0.8"/>')
        self.text(x + px / 2, y + 14, label, 10.5, TEXT, 500, 'middle', mono=True)

    # ------------------------------------------------------------ cell stack (sheet 01)
    def clip_for(self, d):
        cid = self.uid('clip')
        self.emit(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
        return cid

    def cell(self, cx, cy, r, fn=lambda th: 1.0, rot=0.0, pal='cyan', n=72, detail=True, halo=0.3, inside=None,
             nucleus=True):
        """Halo, body, noise, volume shading, `inside` callback, rim, outline, glint. Returns (path, clip id)."""
        base, rim, _cl, _cd, edge, _nuc = PALETTES[pal]
        d = smooth_closed(polar_points(cx, cy, r, fn, n, rot))
        cid = self.clip_for(d)
        e = self.emit
        if halo:
            e(f'<path d="{d}" fill="{rim}" opacity="{halo}" filter="url(#{blur_id(0.12 * r)})" '
              f'transform="translate({cx:.1f} {cy:.1f}) scale(1.16) translate({-cx:.1f} {-cy:.1f})"/>')
        e(f'<path d="{d}" fill="url(#body-{pal})"/>')
        if detail and r > 14:
            s = 1.8 * r
            e(f'<g clip-path="url(#{cid})"><rect x="{cx - s:.1f}" y="{cy - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" '
              f'filter="url(#cyto-noise)" opacity="0.2"/></g>')
        e(f'<g clip-path="url(#{cid})">'
          f'<ellipse cx="{cx + 0.35 * r:.1f}" cy="{cy + 0.4 * r:.1f}" rx="{0.7 * r:.1f}" ry="{0.55 * r:.1f}" fill="{OUTLINE}" '
          f'opacity="0.28" filter="url(#{blur_id(0.2 * r)})"/>'
          f'<ellipse cx="{cx - 0.4 * r:.1f}" cy="{cy - 0.45 * r:.1f}" rx="{0.5 * r:.1f}" ry="{0.4 * r:.1f}" fill="{rim}" '
          f'opacity="0.14" filter="url(#{blur_id(0.2 * r)})"/></g>')
        if nucleus:
            self.nucleus(cx + 0.05 * r, cy + 0.04 * r, 0.28 * r, pal)
        if inside:
            inside(cid)
        if detail and r > 10:
            e(f'<g clip-path="url(#{cid})"><path d="{d}" fill="none" stroke="{edge}" stroke-width="{0.2 * r:.1f}" opacity="0.5"/></g>')
        e(f'<path d="{d}" fill="none" stroke="url(#rim-{pal})" stroke-width="{max(1.0, 0.05 * r):.1f}"/>')
        e(f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="{max(0.6, 0.012 * r):.1f}" opacity="0.5"/>')
        if r > 8:
            e(f'<ellipse cx="{cx - 0.5 * r:.1f}" cy="{cy - 0.55 * r:.1f}" rx="{0.2 * r:.1f}" ry="{0.07 * r:.1f}" '
              f'transform="rotate(-35 {cx - 0.5 * r:.1f} {cy - 0.55 * r:.1f})" fill="#ffffff" opacity="0.5" filter="url(#blur-1_5)"/>')
        return d, cid

    def nucleus(self, cx, cy, rn, pal='cyan'):
        rim = PALETTES[pal][1]
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn:.1f}" fill="url(#nuc-{pal})" opacity="0.85"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn:.1f}" fill="none" stroke="{rim}" stroke-width="{max(0.6, 0.06 * rn):.1f}" opacity="0.6"/>')
        self.emit(f'<circle cx="{cx - 0.2 * rn:.1f}" cy="{cy - 0.2 * rn:.1f}" r="{0.25 * rn:.1f}" fill="{rim}" opacity="0.8"/>')

    def chloroplast(self, x, y, rx, ry, rot=0.0):
        self.emit(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})" '
                  f'fill="url(#chloro-g)" opacity="0.9"/>')

    def plastid(self, x, y, rx, ry, rot=0.0):
        self.emit(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})" '
                  f'fill="url(#plastid-g)" opacity="0.9"/>')

    def eyespot(self, x, y, r):
        self.emit(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * 1.8:.1f}" fill="{EYESPOT}" opacity="0.35" filter="url(#{blur_id(0.6 * r)})"/>')
        self.emit(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="url(#eyespot-g)"/>')

    def whip(self, x0, y0, angle_deg, length, waves=2.0, amp=None, width=2.0, colour=None, phase=0.0, glow=True):
        colour = colour or PALETTES['cyan'][1]
        amp = amp if amp is not None else length * 0.09
        a = math.radians(angle_deg)
        pts = []
        for i in range(21):
            t = i / 20
            off = amp * math.sin(t * waves * 2 * math.pi + phase) * (0.3 + 0.7 * t)
            s = t * length
            pts.append((x0 + s * math.cos(a) - off * math.sin(a), y0 + s * math.sin(a) + off * math.cos(a)))
        d = smooth_open(pts)
        if glow:
            self.emit(f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width * 2.6:.1f}" opacity="0.25" '
                      f'filter="url(#blur-3)" stroke-linecap="round"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width:.1f}" opacity="0.9" stroke-linecap="round"/>')

    def fringe(self, cx, cy, r, fn, count, length, rot=0.0, colour=None, width=1.1, lean=0.5, opacity=0.7):
        colour = colour or PALETTES['cyan'][1]
        for i in range(count):
            th = 2 * math.pi * i / count
            rr = r * fn(th)
            a = th + rot
            px, py = cx + rr * math.cos(a), cy + rr * math.sin(a)
            ln = length * self.rng.uniform(0.85, 1.15)
            ex, ey = px + ln * math.cos(a + lean * 0.8), py + ln * math.sin(a + lean * 0.8)
            mx, my = px + ln * 0.55 * math.cos(a + lean * 0.3), py + ln * 0.55 * math.sin(a + lean * 0.3)
            self.emit(f'<path d="M{px:.1f} {py:.1f} Q{mx:.1f} {my:.1f} {ex:.1f} {ey:.1f}" fill="none" stroke="{colour}" '
                      f'stroke-width="{width}" stroke-linecap="round" opacity="{opacity}"/>')

    def mote(self, cx, cy, r, opacity=1.0):
        self.emit(f'<g opacity="{opacity}"><circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 1.5:.1f}" fill="{FOOD_MOTE}" opacity="0.3" '
                  f'filter="url(#{blur_id(0.35 * r)})"/><circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#mote-g)"/></g>')

    def speck(self, cx, cy, r, colour, opacity=0.8):
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{colour}" opacity="{opacity}"/>')

    def mini_cell(self, cx, cy, r, pal='green', nucleus=False, rot=0.0, fn=None, halo=0.25):
        """A cheap cell for colonies: no noise, a gradient body, a rim and a glint."""
        base, rim, _cl, _cd, _edge, _nuc = PALETTES[pal]
        if fn:
            d = smooth_closed(polar_points(cx, cy, r, fn, 36, rot))
            shape = f'<path d="{d}"'
        else:
            shape = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}"'
        if halo:
            self.emit(f'{shape} fill="{rim}" opacity="{halo}" filter="url(#{blur_id(0.2 * r)})"/>')
        self.emit(f'{shape} fill="url(#body-{pal})"/>')
        self.emit(f'{shape} fill="none" stroke="url(#rim-{pal})" stroke-width="{max(0.8, 0.07 * r):.1f}"/>')
        if nucleus:
            self.emit(f'<circle cx="{cx + 0.05 * r:.1f}" cy="{cy + 0.05 * r:.1f}" r="{0.3 * r:.1f}" fill="url(#nuc-{pal})" opacity="0.8"/>')
        self.emit(f'<ellipse cx="{cx - 0.45 * r:.1f}" cy="{cy - 0.5 * r:.1f}" rx="{0.22 * r:.1f}" ry="{0.09 * r:.1f}" '
                  f'transform="rotate(-35 {cx - 0.45 * r:.1f} {cy - 0.5 * r:.1f})" fill="#ffffff" opacity="0.5"/>')

    # ------------------------------------------------------------ creatures
    def chlamy(self, cx, cy, r, heading=-90.0, whips=True, pal='green', detail=False):
        """Chlamydomonas-style green cell: a cup chloroplast, a red eyespot, two front whips."""
        a = math.radians(heading)
        if whips:
            for side in (-1, 1):
                self.whip(cx + r * math.cos(a), cy + r * math.sin(a), heading + side * 35, r * 1.6, waves=1.2,
                          amp=r * 0.25, width=max(0.8, r * 0.07), colour=CHLORO_L, glow=False)
        fn = ellipse_fn(1.0, 0.86)
        rot = a

        def inside(_cid):
            bx, by = cx - 0.3 * r * math.cos(a), cy - 0.3 * r * math.sin(a)
            self.emit(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{0.62 * r:.1f}" fill="url(#chloro-g)" opacity="0.75"/>')
            self.eyespot(cx + 0.45 * r * math.cos(a + 0.9), cy + 0.45 * r * math.sin(a + 0.9), max(1.2, 0.13 * r))

        if detail:
            self.cell(cx, cy, r, fn, rot, pal, inside=inside, nucleus=False)
        else:
            self.mini_cell(cx, cy, r, pal, fn=fn, rot=rot)
            inside(None)

    def euglena(self, cx, cy, length, heading=-30.0, pal='cyan'):
        a = math.radians(heading)
        r = length / 2
        fn = lambda th: 1 / math.sqrt((math.cos(th)) ** 2 + (math.sin(th) / 0.3) ** 2) * (1 - 0.18 * math.cos(th))
        tip = (cx + r * 0.95 * math.cos(a), cy + r * 0.95 * math.sin(a))
        self.whip(tip[0], tip[1], heading, length * 0.9, waves=1.6, amp=length * 0.06, width=max(1.2, length * 0.02))

        def inside(_cid):
            for i in range(6):
                t = -0.45 + i * 0.17
                off = (0.1 if i % 2 else -0.1) * r
                self.chloroplast(cx + t * r * math.cos(a) - off * math.sin(a), cy + t * r * math.sin(a) + off * math.cos(a),
                                 0.12 * r, 0.06 * r, heading)
            self.eyespot(cx + 0.62 * r * math.cos(a), cy + 0.62 * r * math.sin(a), 0.06 * r)

        self.cell(cx, cy, r, fn, a, pal, inside=inside)

    def paramecium(self, cx, cy, length, heading=-20.0, pal='cyan'):
        a = math.radians(heading)
        r = length / 2
        fn = lambda th: (1 / math.sqrt(math.cos(th) ** 2 + (math.sin(th) / 0.42) ** 2)) * (1 - bump(th, 2.4, 0.12, 0.35))
        self.fringe(cx, cy, r, fn, 90, 0.07 * r, a, lean=0.9, opacity=0.6)

        def inside(_cid):
            gx, gy = cx + 0.1 * r * math.cos(a) + 0.18 * r * math.sin(a), cy + 0.1 * r * math.sin(a) - 0.18 * r * math.cos(a)
            self.emit(f'<ellipse cx="{gx:.1f}" cy="{gy:.1f}" rx="{0.35 * r:.1f}" ry="{0.07 * r:.1f}" '
                      f'transform="rotate({heading:.0f} {gx:.1f} {gy:.1f})" fill="{OUTLINE}" opacity="0.35"/>')

        self.cell(cx, cy, r, fn, a, pal, inside=inside)

    def amoeba(self, cx, cy, r, arms=4, pal='cyan', seed_angle=0.3, detail=True):
        angles = [seed_angle + 2 * math.pi * i / arms + self.rng.uniform(-0.3, 0.3) for i in range(arms)]
        fn = lambda th: 1 + sum(bump(th, at, 0.55, 0.28) for at in angles) - 0.06
        if detail:
            self.cell(cx, cy, r, fn, 0, pal, n=96)
        else:
            self.mini_cell(cx, cy, r, pal, fn=fn, nucleus=True)

    def diatom(self, cx, cy, r, spines=12, pal='silica'):
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 1.2:.1f}" fill="{SILICA_L}" opacity="0.18" filter="url(#{blur_id(0.15 * r)})"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#body-{pal})"/>')
        for i in range(24):
            ang = 2 * math.pi * i / 24
            self.emit(f'<line x1="{cx + 0.25 * r * math.cos(ang):.1f}" y1="{cy + 0.25 * r * math.sin(ang):.1f}" '
                      f'x2="{cx + 0.95 * r * math.cos(ang):.1f}" y2="{cy + 0.95 * r * math.sin(ang):.1f}" stroke="{SILICA_L}" '
                      f'stroke-width="{max(0.5, 0.012 * r):.1f}" opacity="0.4"/>')
        for i in range(4):
            ang = 2 * math.pi * i / 4 + 0.4
            self.plastid(cx + 0.45 * r * math.cos(ang), cy + 0.45 * r * math.sin(ang), 0.2 * r, 0.09 * r, math.degrees(ang))
        for i in range(spines):
            ang = 2 * math.pi * i / spines
            x1, y1 = cx + r * math.cos(ang), cy + r * math.sin(ang)
            x2, y2 = cx + 1.25 * r * math.cos(ang), cy + 1.25 * r * math.sin(ang)
            self.emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" '
                      f'stroke-width="{max(0.6, 0.025 * r):.1f}" opacity="0.8"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{SILICA_L}" stroke-width="{max(1, 0.05 * r):.1f}" opacity="0.9"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{0.8 * r:.1f}" fill="none" stroke="{SILICA}" stroke-width="{max(0.5, 0.015 * r):.1f}" opacity="0.6"/>')
        self.nucleus(cx, cy, 0.14 * r, 'silica')

    def stentor(self, cx, top, length, pal='violet', lean=0.0):
        """Trumpet: wide ciliated mouth at `top`, narrow foot at the bottom."""
        wmax, wmin = length * 0.32, length * 0.05
        pts_l, pts_r = [], []
        for i in range(21):
            t = i / 20
            w = wmin + (wmax - wmin) * (1 - t) ** 2.2
            x = cx + lean * length * t
            y = top + t * length
            pts_l.append((x - w, y))
            pts_r.append((x + w, y))
        d = smooth_open(pts_l) + ' L' + ' L'.join(f'{p[0]:.1f} {p[1]:.1f}' for p in reversed(pts_r)) + ' Z'
        base, rim, _cl, _cd, _edge, _nuc = PALETTES[pal]
        self.emit(f'<path d="{d}" fill="{rim}" opacity="0.25" filter="url(#{blur_id(0.04 * length)})"/>')
        self.emit(f'<path d="{d}" fill="url(#body-{pal})"/>')
        for i in range(7):
            t = 0.25 + i * 0.09
            self.emit(f'<circle cx="{cx + lean * length * t:.1f}" cy="{top + t * length:.1f}" r="{0.03 * length:.1f}" '
                      f'fill="url(#nuc-{pal})" opacity="0.8"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="url(#rim-{pal})" stroke-width="{max(1, 0.012 * length):.1f}"/>')
        self.emit(f'<ellipse cx="{cx:.1f}" cy="{top:.1f}" rx="{wmax:.1f}" ry="{wmax * 0.22:.1f}" fill="{OUTLINE}" opacity="0.4" '
                  f'stroke="{rim}" stroke-width="{max(1, 0.012 * length):.1f}"/>')
        for i in range(28):
            ang = math.pi + math.pi * i / 27
            x, y = cx + wmax * math.cos(ang), top + wmax * 0.22 * math.sin(ang)
            self.emit(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x + 0.04 * length * math.cos(ang):.1f}" '
                      f'y2="{y - 0.07 * length:.1f}" stroke="{rim}" stroke-width="0.9" opacity="0.7"/>')

    def rotifer(self, cx, cy, length, heading=-90.0, pal='rose'):
        """A wheel animal: two ciliated crowns (the 'wheels') on a trunk, a jaw inside, a forked foot."""
        a = math.radians(heading)
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        body = []
        for i in range(25):
            t = i / 24
            w = length * (0.2 * math.sin(math.pi * min(1, t * 1.15)) ** 0.7 + 0.04)
            s = length * (0.4 - t)
            body.append((cx + s * ux + w * px, cy + s * uy + w * py))
        for i in range(24, -1, -1):
            t = i / 24
            w = length * (0.2 * math.sin(math.pi * min(1, t * 1.15)) ** 0.7 + 0.04)
            s = length * (0.4 - t)
            body.append((cx + s * ux - w * px, cy + s * uy - w * py))
        d = smooth_closed(body)
        base, rim, _cl, _cd, _edge, _nuc = PALETTES[pal]
        self.emit(f'<path d="{d}" fill="{rim}" opacity="0.2" filter="url(#{blur_id(0.03 * length)})"/>')
        self.emit(f'<path d="{d}" fill="url(#body-{pal})"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="url(#rim-{pal})" stroke-width="{max(1, 0.01 * length):.1f}"/>')
        for side in (-1, 1):
            wx, wy = cx + 0.42 * length * ux + side * 0.12 * length * px, cy + 0.42 * length * uy + side * 0.12 * length * py
            wr = 0.1 * length
            self.emit(f'<circle cx="{wx:.1f}" cy="{wy:.1f}" r="{wr:.1f}" fill="{rim}" opacity="0.12"/>')
            for k in range(22):
                ang = 2 * math.pi * k / 22
                self.emit(f'<line x1="{wx + wr * math.cos(ang):.1f}" y1="{wy + wr * math.sin(ang):.1f}" '
                          f'x2="{wx + 1.4 * wr * math.cos(ang + 0.4):.1f}" y2="{wy + 1.4 * wr * math.sin(ang + 0.4):.1f}" '
                          f'stroke="{rim}" stroke-width="0.9" opacity="0.75"/>')
        jx, jy = cx + 0.12 * length * ux, cy + 0.12 * length * uy
        self.emit(f'<circle cx="{jx:.1f}" cy="{jy:.1f}" r="{0.06 * length:.1f}" fill="{base}" opacity="0.6"/>')
        self.emit(f'<circle cx="{jx:.1f}" cy="{jy:.1f}" r="{0.06 * length:.1f}" fill="none" stroke="{rim}" stroke-width="1" opacity="0.8"/>')
        fx, fy = cx - 0.62 * length * ux, cy - 0.62 * length * uy
        for side in (-1, 1):
            self.emit(f'<path d="M{cx - 0.55 * length * ux:.1f} {cy - 0.55 * length * uy:.1f} L{fx + side * 0.05 * length * px:.1f} '
                      f'{fy + side * 0.05 * length * py:.1f}" stroke="{rim}" stroke-width="{max(1, 0.02 * length):.1f}" '
                      f'stroke-linecap="round" opacity="0.8"/>')

    def didinium(self, cx, cy, r, heading=0.0, pal='coral'):
        """A barrel with two belts of cilia and a snout: the ciliate that swallows paramecia whole."""
        a = math.radians(heading)
        fn = ellipse_fn(1.0, 0.82)
        self.cell(cx, cy, r, fn, a, pal)
        for belt in (-0.35, 0.3):
            bx, by = cx + belt * r * math.cos(a), cy + belt * r * math.sin(a)
            for k in range(14):
                t = -1 + 2 * k / 13
                px, py = bx - t * 0.8 * r * math.sin(a), by + t * 0.8 * r * math.cos(a)
                self.emit(f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{px + 0.18 * r * math.cos(a + 2.6):.1f}" '
                          f'y2="{py + 0.18 * r * math.sin(a + 2.6):.1f}" stroke="{PALETTES[pal][1]}" stroke-width="1" opacity="0.7"/>')
        sx, sy = cx + 1.0 * r * math.cos(a), cy + 1.0 * r * math.sin(a)
        ex, ey = cx + 1.35 * r * math.cos(a), cy + 1.35 * r * math.sin(a)
        self.emit(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="{PALETTES[pal][1]}" '
                  f'stroke-width="{0.14 * r:.1f}" stroke-linecap="round" opacity="0.85"/>')

    def nematode(self, x0, y0, length, heading=0.0, waves=1.3, amp=None, pal='sand'):
        amp = amp if amp is not None else length * 0.08
        a = math.radians(heading)
        pts = []
        for i in range(41):
            t = i / 40
            off = amp * math.sin(t * waves * 2 * math.pi)
            s = t * length
            pts.append((x0 + s * math.cos(a) - off * math.sin(a), y0 + s * math.sin(a) + off * math.cos(a)))
        d = smooth_open(pts)
        base, rim, _cl, cd, _edge, _nuc = PALETTES[pal]
        w = length * 0.035
        self.emit(f'<path d="{d}" fill="none" stroke="{rim}" stroke-width="{w * 1.8:.1f}" opacity="0.2" filter="url(#blur-3)" stroke-linecap="round"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="{rim}" stroke-width="{w:.1f}" opacity="0.85" stroke-linecap="round"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="{cd}" stroke-width="{w * 0.78:.1f}" opacity="0.85" stroke-linecap="round"/>')
        self.emit(f'<path d="{d}" fill="none" stroke="{base}" stroke-width="{w * 0.25:.1f}" opacity="0.6" stroke-dasharray="{w * 0.6:.1f} {w * 0.4:.1f}"/>')

    def filament(self, x0, y0, length, heading=0.0, cell_len=None, width=None):
        """Spirogyra-style algal thread: a row of cylinders, each with a spiral green ribbon."""
        cell_len = cell_len or length / 10
        width = width or cell_len * 0.45
        a = math.radians(heading)
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        n = int(length / cell_len)
        g = self.uid('fil')
        self.emit(f'<g id="{g}">')
        for k in range(n):
            sx, sy = x0 + k * cell_len * ux, y0 + k * cell_len * uy
            quad = [(sx + width / 2 * px, sy + width / 2 * py), (sx + cell_len * ux + width / 2 * px, sy + cell_len * uy + width / 2 * py),
                    (sx + cell_len * ux - width / 2 * px, sy + cell_len * uy - width / 2 * py), (sx - width / 2 * px, sy - width / 2 * py)]
            pts = ' '.join(f'{p[0]:.1f},{p[1]:.1f}' for p in quad)
            self.emit(f'<polygon points="{pts}" fill="{CHLORO_D}" fill-opacity="0.25" stroke="{CHLORO_L}" stroke-opacity="0.5" stroke-width="0.8"/>')
            spiral = []
            for i in range(13):
                t = i / 12
                off = 0.38 * width * math.sin(t * 2 * math.pi * 1.2 + k)
                spiral.append((sx + t * cell_len * ux + off * px, sy + t * cell_len * uy + off * py))
            self.emit(f'<path d="{smooth_open(spiral)}" fill="none" stroke="{CHLORO}" stroke-width="{width * 0.16:.1f}" opacity="0.8"/>')
        self.emit('</g>')

    def dish(self, cx, cy, r, crowd=True, glow=0.5):
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 1.05:.1f}" fill="{ACCENT}" opacity="{0.25 * glow:.2f}" filter="url(#{blur_id(0.05 * r)})"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#dish-g)"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{ACCENT}" stroke-width="{max(1, 0.012 * r):.1f}" opacity="0.8"/>')
        if crowd:
            for _ in range(int(r * 0.5)):
                ang, rr = self.rng.uniform(0, 2 * math.pi), r * math.sqrt(self.rng.uniform(0, 0.92))
                self.speck(cx + rr * math.cos(ang), cy + rr * math.sin(ang), max(0.6, r * 0.008), FOOD_MOTE, 0.6)

    # ------------------------------------------------------------ storyboard frames
    def frame_open(self, x, y, w, h, kind='field'):
        """Start a clipped storyboard frame; draw inside it, then call frame_close."""
        fid = self.uid('frame')
        self.emit(f'<clipPath id="{fid}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/></clipPath>')
        self.emit(f'<g clip-path="url(#{fid})">')
        self.backdrop(x, y, w, h, kind, particles=int(w * h / 9000))

    def frame_close(self, x, y, w, h, number, title, lines, colour=ACCENT):
        self.emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#vignette)"/>')
        self.emit('</g>')
        self.emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="none" stroke="{PANEL_STROKE}" stroke-width="1.2"/>')
        self.emit(f'<circle cx="{x + 22}" cy="{y + 22}" r="13" fill="{PANEL}" stroke="{colour}" stroke-width="1.2"/>')
        self.text(x + 22, y + 27, str(number), 13, colour, 700, 'middle')
        self.text(x, y + h + 22, title, 14, TEXT, 700)
        self.lines(x, y + h + 40, lines, 11.5, MUTED, 16)

    def caption_banner(self, cx, cy, s, size=16, colour=TEXT):
        wdt = 0.6 * size * len(s) + 40
        self.emit(f'<rect x="{cx - wdt / 2:.1f}" y="{cy - size - 8:.1f}" width="{wdt:.1f}" height="{size * 1.9:.1f}" rx="{size * 0.95:.1f}" '
                  f'fill="{PANEL}" fill-opacity="0.8" stroke="{ACCENT}" stroke-opacity="0.6"/>')
        self.text(cx, cy + size * 0.1, s, size, colour, 600, 'middle')

    # ------------------------------------------------------------ colonies
    def sphere_cells(self, cx, cy, radius, count, cell_r, pal='green', front=None, jelly=True, eyes=False):
        """Cells on the surface of a hollow ball (a Fibonacci sphere, seen from the front). `front` (degrees) marks the
        swimming direction: cells on that side get bigger eyespots when `eyes` is set."""
        base, rim, _cl, _cd, _edge, _nuc = PALETTES[pal]
        if jelly:
            self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius * 1.12:.1f}" fill="{rim}" opacity="0.12" filter="url(#{blur_id(0.1 * radius)})"/>')
            self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius * 1.06:.1f}" fill="url(#body-{pal})" opacity="0.35"/>')
        pts = []
        for i in range(count):
            z = -1 + 2 * (i + 0.5) / count
            ph = i * 2.399963
            s = math.sqrt(1 - z * z)
            pts.append((s * math.cos(ph), z, s * math.sin(ph)))
        for (x, y, depth) in sorted(pts, key=lambda p: p[2]):
            px, py = cx + radius * x, cy + radius * y
            if depth < 0:
                self.speck(px, py, cell_r * 0.6, rim, 0.18)
                continue
            self.mini_cell(px, py, cell_r * (0.75 + 0.25 * depth), pal, halo=0)
            if eyes and front is not None:
                fa = math.radians(front)
                facing = x * math.cos(fa) + y * math.sin(fa)
                if facing > 0.2:
                    self.speck(px + 0.3 * cell_r * math.cos(fa), py + 0.3 * cell_r * math.sin(fa), cell_r * (0.2 + 0.35 * facing), EYESPOT, 0.9)
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{radius * 1.06:.1f}" fill="none" stroke="{rim}" stroke-width="1.2" opacity="0.55"/>')

    def jelly(self, cx, cy, r, pal='green'):
        rim = PALETTES[pal][1]
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{rim}" opacity="0.07"/>')
        self.emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{rim}" stroke-width="1" opacity="0.4" stroke-dasharray="3 3"/>')

    def stage_label(self, x, y, name, lines, colour=TEXT, width=None):
        self.text(x, y, name, 13.5, colour, 700, 'middle')
        for i, ln in enumerate(lines):
            self.text(x, y + 17 + 15 * i, ln, 10.5, ACCENT if i == 0 else MUTED, 500 if i == 0 else 400, 'middle', mono=(i == 0))

    def chevron(self, x, y):
        self.emit(f'<path d="M{x - 5} {y - 9} L{x + 5} {y} L{x - 5} {y + 9}" fill="none" stroke="{ACCENT}" stroke-width="2.2" '
                  f'stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>')

    def note_panel(self, x, y, w, h, title, paragraphs, subtitle=None, size=12, step=17):
        """A panel of short text rows; a row that starts with '• ' is a bullet, a row starting with '§ ' is a sub-heading."""
        self.panel(x, y, w, h, title, subtitle)
        ty = y + (64 if subtitle else 50)
        for row in paragraphs:
            if row.startswith('§ '):
                ty += 4
                self.text(x + 16, ty, row[2:], size, ACCENT, 700)
            elif row.startswith('• '):
                self.text(x + 20, ty, '•', size, ACCENT, 700)
                self.text(x + 34, ty, row[2:], size, TEXT, 400)
            elif row.startswith('~ '):
                self.text(x + 34, ty, row[2:], size - 1.5, MUTED, 400, mono=True)
            elif row.startswith('  '):
                self.text(x + 34, ty, row[2:], size, TEXT, 400)
            elif row == '':
                ty -= step / 2
            else:
                self.text(x + 16, ty, row, size, TEXT, 400)
            ty += step

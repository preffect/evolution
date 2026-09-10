#!/usr/bin/env python3
# usage: python3 docs/concept-art/tools/origins-ladder.py [docs/concept-art/origins-ladder.svg]   (seeded, byte-stable)
"""Generator for docs/concept-art/origins-ladder.svg (sheet 04, ticket #114).

The committed SVG is the artifact reviewers look at; this script is its maintainable source. Run it from the
repo root and it rewrites the SVG deterministically (seed 114), so a re-run on an unchanged script is a no-op.
Everything it emits is code-drawn: gradients, blur / turbulence filters, layered paths. Zero raster.
"""
import math
import random
import sys

W, H = 1920, 1080
OUT: list[str] = []


def emit(s: str) -> None:
    OUT.append(s)


# ---------------------------------------------------------------- palette (mirrors README table)
BG_DEEP, BG_FIELD = '#04070d', '#0b1626'
PANEL, PANEL_STROKE = '#0a1422', '#1a2a3b'
TEXT, MUTED, ACCENT = '#cfdbe6', '#7d8da1', '#7fe7f5'
OUTLINE = '#020509'
# cyan player palette (sheet 01)
BASE, RIM, NUC, EDGE, CYTO_L, CYTO_D, NUC_D = '#22c1d6', '#a6f4ff', '#6fdcef', '#124e56', '#1d636c', '#102426', '#167787'
# sheet 03 constants
PROTO_FILM, PROTO_FILM_LIGHT = '#8fd3e3', '#d8f6ff'
PROTO_GRANULE = '#cfefff'
NUCLEOID_STRAND, NUCLEOID_GLOW = '#e4faff', '#7fe7f5'
RIBOSOME = '#a6f4ff'
CELL_WALL, CELL_WALL_LIGHT = '#4fb1c4', '#bff2ff'
FLAGELLUM = '#a6f4ff'
PURPLE_L, PURPLE, PURPLE_D, PURPLE_HALO = '#ead7ff', '#b06cf0', '#4d1f8f', '#d9b8ff'
CHLORO_L, CHLORO, CHLORO_D = '#b8ff9a', '#63d64a', '#1f7a2b'
MITO_L, MITO, MITO_D = '#ffd39a', '#ffb15a', '#b85c16'
VAC, VAC_RIM = '#a8d8ff', '#dff0ff'
LIPID_L, LIPID = '#fff8d0', '#f2c94c'
FOOD_MOTE, FOOD_MOTE_D = '#8dff6a', '#3f9a2c'
ENVELOPE, PORE = '#dff8ff', '#7fe7f5'
CYTOSKELETON = '#7fe7f5'
CILIA = '#a6f4ff'
SILICA_L, SILICA, SILICA_D = '#eef9ff', '#a9dcef', '#2f6f8c'
DIATOM_PLASTID_L, DIATOM_PLASTID_D = '#d7a441', '#8a5e14'
EYESPOT, EYESPOT_RIM = '#ff4d3a', '#ffb59e'
SILHOUETTE = '#22c1d6'
MONO = "JetBrains Mono, DejaVu Sans Mono, Consolas, Menlo, monospace"

rng = random.Random(114)
_k = 0


def uid(prefix: str) -> str:
    global _k
    _k += 1
    return f'{prefix}{_k}'


# ---------------------------------------------------------------- geometry helpers
def polar_points(cx, cy, r, fn, n=72, rot=0.0):
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        rr = r * fn(th)
        a = th + rot
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
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


def wrap(dth):
    while dth > math.pi:
        dth -= 2 * math.pi
    while dth < -math.pi:
        dth += 2 * math.pi
    return dth


def bump(th, at, amp, width):
    d = wrap(th - at)
    return amp * math.exp(-(d / width) ** 2)


def ellipse_fn(ax, by):
    return lambda th: 1 / math.sqrt((math.cos(th) / ax) ** 2 + (math.sin(th) / by) ** 2)


def blur_id(sigma):
    for s in (1.5, 3, 6, 10, 16, 26):
        if sigma <= s * 1.35:
            return f'blur-{str(s).replace(".", "_")}'
    return 'blur-26'


# ---------------------------------------------------------------- text helpers
def text(x, y, s, size=11, fill=MUTED, weight=400, anchor='start', mono=False, extra=''):
    fam = f' font-family="{MONO}"' if mono else ''
    emit(f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{fam}{extra}>{s}</text>')


def label_block(x, y, title, lines, anchor='start'):
    text(x, y, title, 12.5, TEXT, 600, anchor)
    for i, ln in enumerate(lines):
        text(x, y + 15 + 14 * i, ln, 10.5, MUTED, 400, anchor, mono=True)


def leader(x1, y1, x2, y2):
    emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ACCENT}" stroke-width="0.8" opacity="0.5"/>')
    emit(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="2" fill="{ACCENT}" opacity="0.9"/>')


def panel(x, y, w, h, title, subtitle):
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{PANEL}" fill-opacity="0.45" stroke="{PANEL_STROKE}" stroke-width="1"/>')
    text(x + 16, y + 26, title, 15, ACCENT, 700)
    text(x + 16, y + 44, subtitle, 11.5, MUTED, 400)


def unlock_chip(x, y, s):
    wdt = 7.0 * len(s) + 22
    emit(f'<rect x="{x}" y="{y - 12}" width="{wdt:.0f}" height="18" rx="9" fill="{ACCENT}" fill-opacity="0.12" stroke="{ACCENT}" stroke-opacity="0.5" stroke-width="0.8"/>')
    text(x + 11, y + 1, s, 10.5, ACCENT, 600, mono=True)


def chevron(x, y, direction='right'):
    if direction == 'right':
        d = f'M{x - 5} {y - 9} L{x + 5} {y} L{x - 5} {y + 9}'
    else:
        d = f'M{x - 9} {y - 5} L{x} {y + 5} L{x + 9} {y - 5}'
    emit(f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>')


# ---------------------------------------------------------------- organelle / body helpers
def clip_for(d):
    cid = uid('clip')
    emit(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
    return cid


def halo(d, cx, cy, r, colour=RIM, opacity=0.3, scale=1.18):
    emit(f'<path d="{d}" fill="{colour}" opacity="{opacity}" filter="url(#{blur_id(0.12 * r)})" '
         f'transform="translate({cx:.1f} {cy:.1f}) scale({scale}) translate({-cx:.1f} {-cy:.1f})"/>')


def noise(cid, cx, cy, r, opacity=0.22, fine=0.18):
    s = 1.7 * r
    emit(f'<g clip-path="url(#{cid})">')
    emit(f'<rect x="{cx - s:.1f}" y="{cy - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" filter="url(#cyto-noise)" opacity="{opacity}"/>')
    emit(f'<rect x="{cx - s:.1f}" y="{cy - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" filter="url(#cyto-noise-fine)" opacity="{fine}"/>')
    emit('</g>')


def volume_shading(cid, cx, cy, r):
    """Dark pool bottom-right, light pool top-left (sheet 01 rule: volume from light, not opacity)."""
    emit(f'<g clip-path="url(#{cid})">')
    emit(f'<ellipse cx="{cx + 0.35 * r:.1f}" cy="{cy + 0.4 * r:.1f}" rx="{0.7 * r:.1f}" ry="{0.55 * r:.1f}" fill="{OUTLINE}" opacity="0.28" filter="url(#{blur_id(0.2 * r)})"/>')
    emit(f'<ellipse cx="{cx - 0.4 * r:.1f}" cy="{cy - 0.45 * r:.1f}" rx="{0.5 * r:.1f}" ry="{0.4 * r:.1f}" fill="{RIM}" opacity="0.14" filter="url(#{blur_id(0.2 * r)})"/>')
    emit('</g>')


def granules(cid, cx, cy, r, count, fn=lambda th: 1.0, colour=RIBOSOME, size=(1.4, 2.4), alpha=(0.25, 0.6)):
    emit(f'<g clip-path="url(#{cid})">')
    for _ in range(count):
        th = rng.uniform(0, 2 * math.pi)
        rr = r * fn(th) * math.sqrt(rng.uniform(0.05, 0.85))
        emit(f'<circle cx="{cx + rr * math.cos(th):.1f}" cy="{cy + rr * math.sin(th):.1f}" r="{rng.uniform(*size):.1f}" fill="{colour}" opacity="{rng.uniform(*alpha):.2f}"/>')
    emit('</g>')


def rim_layers(d, cid, r, inner=True, rim_w=0.05, edge_w=0.11, outline=True, rim_grad='rim-cyan'):
    if inner:
        emit(f'<g clip-path="url(#{cid})"><path d="{d}" fill="none" stroke="{EDGE}" stroke-width="{edge_w * 2 * r:.1f}" opacity="0.55"/></g>')
    emit(f'<path d="{d}" fill="none" stroke="{BASE}" stroke-width="{0.1 * r:.1f}" opacity="0.35" filter="url(#{blur_id(0.05 * r)})"/>')
    emit(f'<path d="{d}" fill="none" stroke="url(#{rim_grad})" stroke-width="{max(1.2, rim_w * r):.1f}"/>')
    if outline:
        emit(f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="{max(0.8, 0.012 * r):.1f}" opacity="0.5" '
             f'transform="translate(0 0)"/>')


def glint(cx, cy, r, scale=1.0):
    emit(f'<ellipse cx="{cx - 0.55 * r:.1f}" cy="{cy - 0.6 * r:.1f}" rx="{0.22 * r * scale:.1f}" ry="{0.08 * r * scale:.1f}" '
         f'transform="rotate(-35 {cx - 0.55 * r:.1f} {cy - 0.6 * r:.1f})" fill="#ffffff" opacity="0.5" filter="url(#blur-1_5)"/>')


def organelle(sym, x, y, size, rot=0, opacity=1.0):
    emit(f'<use href="#{sym}" x="{-size:.1f}" y="{-size:.1f}" width="{2 * size:.1f}" height="{2 * size:.1f}" '
         f'transform="translate({x:.1f} {y:.1f}) rotate({rot})" opacity="{opacity}"/>')


def nucleus(cx, cy, rn, envelope=False, pores=0, grad='nuc-cyan'):
    emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn * 1.25:.1f}" fill="{NUC}" opacity="0.35" filter="url(#{blur_id(0.25 * rn)})"/>')
    emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn:.1f}" fill="url(#{grad})"/>')
    # chromatin threads
    for i in range(4):
        a = rng.uniform(0, 2 * math.pi)
        pts = [(cx + rn * 0.6 * math.cos(a + t) * rng.uniform(0.6, 1.0), cy + rn * 0.6 * math.sin(a + t) * rng.uniform(0.6, 1.0)) for t in (0, 0.9, 1.8, 2.7)]
        emit(f'<path d="{smooth_open(pts)}" fill="none" stroke="{NUC_D}" stroke-width="{0.05 * rn:.1f}" opacity="0.55"/>')
    emit(f'<circle cx="{cx - 0.15 * rn:.1f}" cy="{cy - 0.12 * rn:.1f}" r="{0.22 * rn:.1f}" fill="{RIM}" opacity="0.85"/>')
    emit(f'<circle cx="{cx - 0.2 * rn:.1f}" cy="{cy - 0.2 * rn:.1f}" r="{0.1 * rn:.1f}" fill="#ffffff" opacity="0.6"/>')
    if envelope:
        emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn:.1f}" fill="none" stroke="{ENVELOPE}" stroke-width="{max(1, 0.05 * rn):.1f}" opacity="0.9"/>')
        emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn * 1.08:.1f}" fill="none" stroke="{ENVELOPE}" stroke-width="{max(0.8, 0.035 * rn):.1f}" opacity="0.55"/>')
        for i in range(pores):
            a = 2 * math.pi * i / pores + 0.2
            x1, y1 = cx + rn * 0.94 * math.cos(a), cy + rn * 0.94 * math.sin(a)
            x2, y2 = cx + rn * 1.14 * math.cos(a), cy + rn * 1.14 * math.sin(a)
            emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{BG_FIELD}" stroke-width="{max(2, 0.09 * rn):.1f}"/>')
            emit(f'<circle cx="{cx + rn * 1.04 * math.cos(a):.1f}" cy="{cy + rn * 1.04 * math.sin(a):.1f}" r="{max(1, 0.035 * rn):.1f}" fill="{PORE}" opacity="0.9"/>')
    else:
        emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rn:.1f}" fill="none" stroke="{RIM}" stroke-width="{max(0.8, 0.03 * rn):.1f}" opacity="0.6"/>')


def cell(cx, cy, r, fn=lambda th: 1.0, rot=0.0, n=72, body='body-cyan', pre=None, post=None,
         inner=True, granule_count=None, halo_opacity=0.3, do_noise=True, do_glint=True):
    """Standard sheet-01 layer stack around a polar shape. `pre`/`post` are callbacks drawing organelles."""
    d = smooth_closed(polar_points(cx, cy, r, fn, n, rot))
    cid = clip_for(d)
    halo(d, cx, cy, r, opacity=halo_opacity)
    emit(f'<path d="{d}" fill="url(#{body})"/>')
    if do_noise:
        noise(cid, cx, cy, r)
    volume_shading(cid, cx, cy, r)
    if pre:
        pre(cid)
    if granule_count:
        granules(cid, cx, cy, r, granule_count, fn)
    if post:
        post(cid)
    rim_layers(d, cid, r, inner=inner)
    if do_glint:
        glint(cx, cy, r)
    return d, cid


# ---------------------------------------------------------------- creatures
def flagellum(x0, y0, angle_deg, length, waves=2.5, amp=None, width=3.0, colour=FLAGELLUM, glow=True):
    amp = amp or length * 0.09
    a = math.radians(angle_deg)
    pts = []
    for i in range(25):
        t = i / 24
        s = t * length
        off = amp * math.sin(t * waves * 2 * math.pi) * (0.35 + 0.65 * t)
        pts.append((x0 + s * math.cos(a) - off * math.sin(a), y0 + s * math.sin(a) + off * math.cos(a)))
    d = smooth_open(pts)
    if glow:
        emit(f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width * 2.6:.1f}" opacity="0.28" filter="url(#blur-3)" stroke-linecap="round"/>')
    emit(f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width:.1f}" opacity="0.9" stroke-linecap="round"/>')
    emit(f'<path d="{d}" fill="none" stroke="#ffffff" stroke-width="{width * 0.35:.1f}" opacity="0.6" stroke-linecap="round"/>')


def nucleoid(cx, cy, r, glow=True):
    """Loose DNA loop: two tangled closed strands, no envelope."""
    fn1 = lambda th: 1 + 0.18 * math.cos(3 * th + 0.4) + 0.1 * math.cos(5 * th + 1.7)
    fn2 = lambda th: 1 + 0.22 * math.cos(2 * th + 1.1) + 0.12 * math.cos(4 * th + 0.3)
    d1 = smooth_closed(polar_points(cx, cy, r, fn1, 48, 0.3))
    d2 = smooth_closed(polar_points(cx + 0.1 * r, cy + 0.05 * r, r * 0.68, fn2, 40, 1.2))
    if glow:
        emit(f'<path d="{d1}" fill="none" stroke="{NUCLEOID_GLOW}" stroke-width="{0.12 * r:.1f}" opacity="0.35" filter="url(#{blur_id(0.1 * r)})"/>')
    for d in (d1, d2):
        emit(f'<path d="{d}" fill="none" stroke="{NUCLEOID_GLOW}" stroke-width="{0.06 * r:.1f}" opacity="0.5" filter="url(#blur-1_5)"/>')
        emit(f'<path d="{d}" fill="none" stroke="{NUCLEOID_STRAND}" stroke-width="{max(1.2, 0.028 * r):.1f}" opacity="0.92" stroke-dasharray="{0.16 * r:.1f} {0.04 * r:.1f}"/>')


def cilia_fringe(cx, cy, r, fn, count, length, rot=0.0, colour=CILIA, width=1.2, lean=0.5, opacity=0.75, normal=None):
    for i in range(count):
        th = 2 * math.pi * i / count + rng.uniform(-0.02, 0.02)
        rr = r * fn(th)
        a = th + rot
        px, py = cx + rr * math.cos(a), cy + rr * math.sin(a)
        if normal:
            nx, ny = normal(th)
            na = math.atan2(ny, nx) + rot
        else:
            na = a
        ln = length * rng.uniform(0.85, 1.15)
        ex = px + ln * math.cos(na + lean * 0.8)
        ey = py + ln * math.sin(na + lean * 0.8)
        mx = px + ln * 0.55 * math.cos(na + lean * 0.3)
        my = py + ln * 0.55 * math.sin(na + lean * 0.3)
        emit(f'<path d="M{px:.1f} {py:.1f} Q{mx:.1f} {my:.1f} {ex:.1f} {ey:.1f}" fill="none" stroke="{colour}" stroke-width="{width}" stroke-linecap="round" opacity="{opacity}"/>')


def cell_wall(d, cx, cy, r, scale=1.05):
    emit(f'<path d="{d}" fill="none" stroke="{CELL_WALL}" stroke-width="{0.045 * r:.1f}" opacity="0.95" '
         f'transform="translate({cx:.1f} {cy:.1f}) scale({scale}) translate({-cx:.1f} {-cy:.1f})"/>')
    emit(f'<path d="{d}" fill="none" stroke="{CELL_WALL_LIGHT}" stroke-width="{max(1, 0.012 * r):.1f}" opacity="0.7" '
         f'transform="translate({cx:.1f} {cy:.1f}) scale({scale + 0.025}) translate({-cx:.1f} {-cy:.1f})"/>')


def bacterium(cx, cy, rx, ry, rot=0, kind='purple', trail=False, flag=True):
    light, base, dark, halo_c = (PURPLE_L, PURPLE, PURPLE_D, PURPLE_HALO) if kind == 'purple' else (CHLORO_L, CHLORO, CHLORO_D, CHLORO_L)
    g = 'bact-purple' if kind == 'purple' else 'bact-green'
    emit(f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({rot})">')
    if trail:
        for i in range(3):
            emit(f'<ellipse cx="{rx * (1.3 + 0.55 * i):.1f}" cy="0" rx="{rx * 0.9:.1f}" ry="{ry * (0.8 - 0.2 * i):.1f}" fill="{base}" opacity="{0.16 - 0.045 * i:.2f}" filter="url(#blur-3)"/>')
    emit(f'<ellipse rx="{rx * 1.2:.1f}" ry="{ry * 1.3:.1f}" fill="{halo_c}" opacity="0.35" filter="url(#{blur_id(0.3 * ry)})"/>')
    emit(f'<rect x="{-rx:.1f}" y="{-ry:.1f}" width="{2 * rx:.1f}" height="{2 * ry:.1f}" rx="{ry:.1f}" fill="url(#{g})"/>')
    if kind == 'green':
        for i in range(4):
            x = -rx * 0.55 + i * rx * 0.37
            emit(f'<line x1="{x:.1f}" y1="{-ry * 0.55:.1f}" x2="{x:.1f}" y2="{ry * 0.55:.1f}" stroke="{light}" stroke-width="{0.1 * ry:.1f}" opacity="0.8"/>')
    else:
        for i in range(5):
            x = -rx * 0.6 + i * rx * 0.3
            emit(f'<circle cx="{x:.1f}" cy="{rng.uniform(-0.3, 0.3) * ry:.1f}" r="{0.13 * ry:.1f}" fill="{light}" opacity="0.7"/>')
    emit(f'<rect x="{-rx:.1f}" y="{-ry:.1f}" width="{2 * rx:.1f}" height="{2 * ry:.1f}" rx="{ry:.1f}" fill="none" stroke="{light}" stroke-width="{0.08 * ry:.1f}" opacity="0.85"/>')
    emit(f'<ellipse cx="{-rx * 0.45:.1f}" cy="{-ry * 0.5:.1f}" rx="{rx * 0.3:.1f}" ry="{ry * 0.16:.1f}" fill="#ffffff" opacity="0.5"/>')
    if flag:
        flagellum(rx, 0, 0, rx * 1.4, waves=1.6, amp=ry * 0.35, width=max(1, 0.08 * ry), colour=light, glow=False)
    emit('</g>')


def mote(cx, cy, r):
    emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 1.5:.1f}" fill="{FOOD_MOTE}" opacity="0.3" filter="url(#{blur_id(0.35 * r)})"/>')
    emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="url(#mote-g)"/>')
    emit(f'<circle cx="{cx - 0.35 * r:.1f}" cy="{cy - 0.35 * r:.1f}" r="{0.25 * r:.1f}" fill="#ffffff" opacity="0.7"/>')


def cytoskeleton(cid, cx, cy, r, nx, ny, rn, fn):
    emit(f'<g clip-path="url(#{cid})" opacity="0.5">')
    for i in range(11):
        a = 2 * math.pi * i / 11 + 0.15
        x0, y0 = nx + rn * 1.05 * math.cos(a), ny + rn * 1.05 * math.sin(a)
        rr = r * fn(a) * 0.98
        x1, y1 = cx + rr * math.cos(a), cy + rr * math.sin(a)
        bend = rng.uniform(-0.18, 0.18) * r
        mx, my = (x0 + x1) / 2 - bend * math.sin(a), (y0 + y1) / 2 + bend * math.cos(a)
        emit(f'<path d="M{x0:.1f} {y0:.1f} Q{mx:.1f} {my:.1f} {x1:.1f} {y1:.1f}" fill="none" stroke="{CYTOSKELETON}" stroke-width="1.1" opacity="0.55"/>')
        # cross-link
        if i % 2 == 0:
            a2 = a + 2 * math.pi / 11
            rr2 = r * 0.62
            emit(f'<line x1="{cx + rr * 0.62 * math.cos(a):.1f}" y1="{cy + rr * 0.62 * math.sin(a):.1f}" x2="{cx + rr2 * math.cos(a2):.1f}" y2="{cy + rr2 * math.sin(a2):.1f}" stroke="{CYTOSKELETON}" stroke-width="0.8" opacity="0.4"/>')
    emit('</g>')


# ================================================================ document
emit(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
     f'font-family="Inter, \'Segoe UI\', DejaVu Sans, Helvetica, Arial, sans-serif">')
emit('<title>Evolution — concept sheet 04: origins, the single-cell evolution ladder</title>')
emit('<desc>Protocell → prokaryote → endosymbiosis → eukaryote → specialised forms, in the dark-field microscopy language of cell-sheet.svg. '
     'Code-drawn SVG: gradients, blur and turbulence filters, layered paths, zero raster. Palette constants in docs/concept-art/README.md.</desc>')
emit('<defs>')
emit(f'<radialGradient id="bg-field" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>')
emit('<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72"><stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></radialGradient>')
emit(f'<linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{ACCENT}" stop-opacity="0.07"/><stop offset="0.5" stop-color="{ACCENT}" stop-opacity="0"/></linearGradient>')
for s in (1.5, 3, 6, 10, 16, 26):
    emit(f'<filter id="blur-{str(s).replace(".", "_")}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{s}"/></filter>')
emit('<filter id="cyto-noise" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="n"/>'
     '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.93  0 0 0 0 1  1.6 0 0 0 -0.62"/></filter>')
emit('<filter id="cyto-noise-fine" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="5" result="n"/>'
     '<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.8 0 0 0 -0.95"/></filter>')
# cyan body / rim / nucleus / halo (sheet 01)
emit(f'<radialGradient id="body-cyan" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{CYTO_L}" stop-opacity="0.42"/><stop offset="0.55" stop-color="{CYTO_D}" stop-opacity="0.55"/>'
     f'<stop offset="0.86" stop-color="{BASE}" stop-opacity="0.55"/><stop offset="1" stop-color="{RIM}" stop-opacity="0.85"/></radialGradient>')
emit(f'<radialGradient id="body-proto" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{CYTO_L}" stop-opacity="0.16"/><stop offset="0.6" stop-color="{CYTO_D}" stop-opacity="0.26"/>'
     f'<stop offset="0.9" stop-color="{BASE}" stop-opacity="0.3"/><stop offset="1" stop-color="{RIM}" stop-opacity="0.55"/></radialGradient>')
emit(f'<linearGradient id="rim-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.18" stop-color="{RIM}" stop-opacity="0.95"/>'
     f'<stop offset="0.55" stop-color="{BASE}" stop-opacity="0.55"/><stop offset="1" stop-color="{RIM}" stop-opacity="0.55"/></linearGradient>')
emit(f'<linearGradient id="rim-proto" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.2" stop-color="{PROTO_FILM_LIGHT}" stop-opacity="0.85"/>'
     f'<stop offset="0.55" stop-color="{PROTO_FILM}" stop-opacity="0.45"/><stop offset="1" stop-color="{PROTO_FILM_LIGHT}" stop-opacity="0.5"/></linearGradient>')
emit(f'<radialGradient id="nuc-cyan" cx="0.38" cy="0.34" r="0.7"><stop offset="0" stop-color="{RIM}" stop-opacity="0.95"/><stop offset="0.5" stop-color="{NUC}" stop-opacity="0.9"/><stop offset="1" stop-color="{NUC_D}" stop-opacity="0.95"/></radialGradient>')
emit(f'<radialGradient id="mito-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{MITO_L}"/><stop offset="0.5" stop-color="{MITO}"/><stop offset="1" stop-color="{MITO_D}"/></radialGradient>')
emit(f'<radialGradient id="vac-g" cx="0.5" cy="0.5" r="0.5"><stop offset="0.6" stop-color="{VAC}" stop-opacity="0.08"/><stop offset="1" stop-color="{VAC}" stop-opacity="0.45"/></radialGradient>')
emit(f'<radialGradient id="lipid-g" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="{LIPID_L}"/><stop offset="1" stop-color="{LIPID}"/></radialGradient>')
emit(f'<radialGradient id="chloro-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{CHLORO_L}"/><stop offset="0.45" stop-color="{CHLORO}"/><stop offset="1" stop-color="{CHLORO_D}"/></radialGradient>')
emit(f'<radialGradient id="mote-g" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="{FOOD_MOTE}"/><stop offset="1" stop-color="{FOOD_MOTE_D}"/></radialGradient>')
emit(f'<radialGradient id="bact-purple" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="{PURPLE_L}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{PURPLE}" stop-opacity="0.85"/><stop offset="1" stop-color="{PURPLE_D}" stop-opacity="0.95"/></radialGradient>')
emit(f'<radialGradient id="bact-green" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="{CHLORO_L}" stop-opacity="0.9"/><stop offset="0.5" stop-color="{CHLORO}" stop-opacity="0.85"/><stop offset="1" stop-color="{CHLORO_D}" stop-opacity="0.95"/></radialGradient>')
emit(f'<radialGradient id="silica-g" cx="0.4" cy="0.36" r="0.7"><stop offset="0" stop-color="{SILICA_D}" stop-opacity="0.35"/><stop offset="0.7" stop-color="{SILICA}" stop-opacity="0.35"/><stop offset="1" stop-color="{SILICA_L}" stop-opacity="0.75"/></radialGradient>')
emit(f'<radialGradient id="plastid-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#f2d27a"/><stop offset="0.5" stop-color="{DIATOM_PLASTID_L}"/><stop offset="1" stop-color="{DIATOM_PLASTID_D}"/></radialGradient>')
emit(f'<radialGradient id="eyespot-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{EYESPOT_RIM}"/><stop offset="0.5" stop-color="{EYESPOT}"/><stop offset="1" stop-color="#8a1a0e"/></radialGradient>')
emit(f'<radialGradient id="mito-purple-g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{PURPLE_L}"/><stop offset="0.5" stop-color="{PURPLE}"/><stop offset="1" stop-color="{PURPLE_D}"/></radialGradient>')
emit(f'<linearGradient id="ramp-purple-amber" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{PURPLE}"/><stop offset="1" stop-color="{MITO}"/></linearGradient>')
emit(f'<linearGradient id="ramp-green-chloro" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{CHLORO}"/><stop offset="1" stop-color="{CHLORO_L}"/></linearGradient>')
# organelle symbols (sheet 01)
emit('<symbol id="mito" viewBox="-1.3 -1.3 2.6 2.6" overflow="visible">'
     f'<ellipse rx="1.15" ry="0.6" fill="{MITO}" opacity="0.45" filter="url(#blur-1_5)"/><ellipse rx="1" ry="0.48" fill="url(#mito-g)"/>'
     f'<ellipse rx="1" ry="0.48" fill="none" stroke="{MITO_L}" stroke-width="0.07" opacity="0.85"/>'
     f'<path d="M-0.62 -0.3 q0.08 0.3 0 0.6 M-0.32 -0.36 q0.1 0.36 0 0.72 M0 -0.38 q-0.1 0.38 0 0.76 M0.32 -0.36 q0.1 0.36 0 0.72 M0.62 -0.3 q-0.08 0.3 0 0.6" fill="none" stroke="{MITO_L}" stroke-width="0.06" stroke-linecap="round" opacity="0.9"/>'
     '<ellipse cx="-0.45" cy="-0.22" rx="0.22" ry="0.09" fill="#ffffff" opacity="0.55"/></symbol>')
emit('<symbol id="mito-purple" viewBox="-1.3 -1.3 2.6 2.6" overflow="visible">'
     f'<ellipse rx="1.15" ry="0.6" fill="{PURPLE}" opacity="0.45" filter="url(#blur-1_5)"/><ellipse rx="1" ry="0.48" fill="url(#mito-purple-g)"/>'
     f'<ellipse rx="1" ry="0.48" fill="none" stroke="{PURPLE_L}" stroke-width="0.07" opacity="0.85"/>'
     f'<path d="M-0.62 -0.3 q0.08 0.3 0 0.6 M-0.32 -0.36 q0.1 0.36 0 0.72 M0 -0.38 q-0.1 0.38 0 0.76 M0.32 -0.36 q0.1 0.36 0 0.72 M0.62 -0.3 q-0.08 0.3 0 0.6" fill="none" stroke="{PURPLE_L}" stroke-width="0.06" stroke-linecap="round" opacity="0.9"/>'
     '<ellipse cx="-0.45" cy="-0.22" rx="0.22" ry="0.09" fill="#ffffff" opacity="0.55"/></symbol>')
emit('<symbol id="vacuole" viewBox="-1.2 -1.2 2.4 2.4" overflow="visible">'
     f'<circle r="1" fill="url(#vac-g)"/><circle r="1" fill="none" stroke="{VAC_RIM}" stroke-width="0.07" opacity="0.7"/>'
     '<ellipse cx="-0.4" cy="-0.42" rx="0.28" ry="0.14" transform="rotate(-35 -0.4 -0.42)" fill="#ffffff" opacity="0.5"/></symbol>')
emit('<symbol id="lipid" viewBox="-1.2 -1.2 2.4 2.4" overflow="visible">'
     f'<circle r="1.25" fill="{LIPID}" opacity="0.4" filter="url(#blur-1_5)"/><circle r="1" fill="url(#lipid-g)"/><circle cx="-0.35" cy="-0.35" r="0.22" fill="#ffffff" opacity="0.8"/></symbol>')
emit('<symbol id="granule" viewBox="-1.2 -1.2 2.4 2.4" overflow="visible">'
     f'<circle r="1.3" fill="{PROTO_GRANULE}" opacity="0.35" filter="url(#blur-1_5)"/><circle r="1" fill="{PROTO_GRANULE}" opacity="0.8"/><circle cx="-0.3" cy="-0.3" r="0.25" fill="#ffffff" opacity="0.8"/></symbol>')
emit('<symbol id="chloro" viewBox="-1.3 -1.3 2.6 2.6" overflow="visible">'
     f'<ellipse rx="1.2" ry="0.75" fill="{CHLORO}" opacity="0.45" filter="url(#blur-1_5)"/><ellipse rx="1" ry="0.6" fill="url(#chloro-g)"/>'
     f'<ellipse rx="1" ry="0.6" fill="none" stroke="{CHLORO_L}" stroke-width="0.07" opacity="0.8"/>'
     f'<path d="M-0.5 -0.22 h0.35 M-0.5 -0.08 h0.35 M-0.5 0.06 h0.35 M-0.5 0.2 h0.35 M0.1 -0.28 h0.35 M0.1 -0.14 h0.35 M0.1 0 h0.35 M0.1 0.14 h0.35" stroke="{CHLORO_L}" stroke-width="0.07" opacity="0.9"/>'
     '<ellipse cx="-0.45" cy="-0.3" rx="0.22" ry="0.1" fill="#ffffff" opacity="0.45"/></symbol>')
emit('<symbol id="plastid" viewBox="-1.3 -1.3 2.6 2.6" overflow="visible">'
     f'<ellipse rx="1.15" ry="0.55" fill="{DIATOM_PLASTID_L}" opacity="0.4" filter="url(#blur-1_5)"/><ellipse rx="1" ry="0.45" fill="url(#plastid-g)"/>'
     f'<ellipse rx="1" ry="0.45" fill="none" stroke="#f2d27a" stroke-width="0.06" opacity="0.7"/><ellipse cx="-0.45" cy="-0.2" rx="0.2" ry="0.08" fill="#ffffff" opacity="0.4"/></symbol>')
emit('<symbol id="cvac" viewBox="-1.4 -1.4 2.8 2.8" overflow="visible">'
     f'<circle r="0.55" fill="url(#vac-g)"/><circle r="0.55" fill="none" stroke="{VAC_RIM}" stroke-width="0.08" opacity="0.8"/>'
     f'<path d="M0 -0.55 v-0.6 M0 0.55 v0.6 M-0.55 0 h-0.6 M0.55 0 h0.6 M-0.39 -0.39 l-0.42 -0.42 M0.39 0.39 l0.42 0.42 M0.39 -0.39 l0.42 -0.42 M-0.39 0.39 l-0.42 0.42" stroke="{VAC_RIM}" stroke-width="0.07" stroke-linecap="round" opacity="0.7"/>'
     '</symbol>')
emit('<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
     f'<path d="M0 0 L10 5 L0 10 z" fill="{ACCENT}"/></marker>')
emit('</defs>')

# ---------------------------------------------------------------- background
emit('<!-- ===== dark-field background ===== -->')
emit(f'<rect width="{W}" height="{H}" fill="url(#bg-field)"/>')
emit(f'<polygon points="0,0 {W * 0.55:.0f},0 0,{H * 0.7:.0f}" fill="url(#beam)"/>')
emit('<g id="depth-particles">')
for _ in range(80):
    x, y = rng.uniform(0, W), rng.uniform(0, H)
    kind = rng.random()
    if kind < 0.55:
        emit(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rng.choice((0.8, 1, 1.3)):.1f}" fill="{rng.choice(("#ffffff", "#9fe8f5", "#c4f0ff", "#7fb8ff"))}" opacity="{rng.uniform(0.07, 0.28):.2f}"/>')
    elif kind < 0.85:
        emit(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rng.choice((1.8, 2.4)):.1f}" fill="{rng.choice(("#ffffff", "#9fe8f5", "#c4f0ff"))}" opacity="{rng.uniform(0.1, 0.28):.2f}" filter="url(#blur-1_5)"/>')
    else:
        emit(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rng.choice((4, 7, 11)):.0f}" fill="{rng.choice(("#ffffff", "#9fe8f5", "#c4f0ff", "#7fb8ff"))}" opacity="{rng.uniform(0.03, 0.08):.2f}" filter="url(#blur-3)"/>')
emit('</g>')

# ---------------------------------------------------------------- header
emit('<!-- ===== header ===== -->')
text(40, 46, 'EVOLUTION', 26, TEXT, 800)
text(216, 46, '· concept sheet 04 — ORIGINS · the single-cell ladder', 20, ACCENT, 500)
text(40, 66, 'You start as a bare protocell and evolve inside one cell: protocell → prokaryote → endosymbiosis → eukaryote → specialised forms · dark-field language of sheet 01 · 1 wu = 1 px at zoom 1.0', 12, MUTED)
text(1880, 46, 'ticket #114 · epic #2 · defines the level-1 look · DNA absorbed from prey unlocks each step', 12, MUTED, 400, 'end')
text(1880, 66, 'all shapes code-drawn: gradients, blur, turbulence · zero raster', 12, MUTED, 400, 'end')

ROW1_Y, ROW1_H = 90, 465
ROW2_Y, ROW2_H = 570, 480

# ================================================================ 1 · PROTOCELL
emit('<!-- ===== 1 · protocell ===== -->')
P1X, P1W = 40, 500
panel(P1X, ROW1_Y, P1W, ROW1_H, '1 · PROTOCELL — the start', 'r ≈ 10 wu · 10 px / wu · bilayer · 3–6 granules · no nucleus · drift + wobble')
unlock_chip(P1X + 16, ROW1_Y + 66, 'UNLOCK: none — the spawn form')

hx, hy, hr = 200, 300, 100
proto_fn = lambda th: 1 + 0.035 * math.cos(2 * th + 0.6) + 0.02 * math.cos(3 * th + 2.1)


def proto_body(cx, cy, r, fn, gran=True):
    d = smooth_closed(polar_points(cx, cy, r, fn, 72))
    cid = clip_for(d)
    halo(d, cx, cy, r, colour=PROTO_FILM_LIGHT, opacity=0.22, scale=1.2)
    emit(f'<path d="{d}" fill="url(#body-proto)"/>')
    noise(cid, cx, cy, r, opacity=0.12, fine=0.16)
    emit(f'<g clip-path="url(#{cid})"><ellipse cx="{cx - 0.4 * r:.1f}" cy="{cy - 0.45 * r:.1f}" rx="{0.5 * r:.1f}" ry="{0.4 * r:.1f}" fill="{RIM}" opacity="0.1" filter="url(#{blur_id(0.2 * r)})"/></g>')
    # bilayer: outer film + inner film 2.5 % r apart
    emit(f'<path d="{d}" fill="none" stroke="{PROTO_FILM}" stroke-width="{0.08 * r:.1f}" opacity="0.25" filter="url(#{blur_id(0.05 * r)})"/>')
    emit(f'<path d="{d}" fill="none" stroke="url(#rim-proto)" stroke-width="{max(1.2, 0.025 * r):.1f}"/>')
    emit(f'<path d="{d}" fill="none" stroke="{PROTO_FILM}" stroke-width="{max(0.8, 0.015 * r):.1f}" opacity="0.6" '
         f'transform="translate({cx:.1f} {cy:.1f}) scale(0.955) translate({-cx:.1f} {-cy:.1f})"/>')
    emit(f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="{max(0.8, 0.01 * r):.1f}" opacity="0.4"/>')
    return d, cid


d, cid = proto_body(hx, hy, hr, proto_fn)
# 5 granules: three pale lipid-bilayer vesicles, two amber lipid droplets
organelle('granule', hx - 0.3 * hr, hy + 0.15 * hr, 0.06 * hr)
organelle('granule', hx + 0.35 * hr, hy - 0.25 * hr, 0.05 * hr)
organelle('granule', hx + 0.1 * hr, hy + 0.45 * hr, 0.045 * hr)
organelle('lipid', hx - 0.15 * hr, hy - 0.4 * hr, 0.055 * hr)
organelle('lipid', hx + 0.45 * hr, hy + 0.3 * hr, 0.045 * hr)
granules(cid, hx, hy, hr, 10, proto_fn, colour=PROTO_GRANULE, size=(0.9, 1.6), alpha=(0.15, 0.4))
glint(hx, hy, hr, 0.9)

# annotations (right column)
AX = 340
label_block(AX, 168, 'Lipid bilayer', ['#ffffff → #d8f6ff → #8fd3e3', '2 films, 2.5% r apart'])
leader(AX - 6, 172, hx + 0.72 * hr, hy - 0.7 * hr)
label_block(AX, 232, 'Cytoplasm (faint)', ['#1d636c → #102426 @16–26%', 'noise 0.045 @12%, translucent'])
leader(AX - 6, 236, hx + 0.3 * hr, hy - 0.05 * hr)
label_block(AX, 296, 'Granules ×3–6', ['#cfefff vesicles 4.5–6% r', 'lipid #fff8d0→#f2c94c 5% r'])
leader(AX - 6, 300, hx + 0.45 * hr, hy + 0.3 * hr)
label_block(AX, 360, 'No nucleus · no organelles', ['halo #d8f6ff @22%, +20% r', 'outline #020509 1 px @40%'])
leader(AX - 6, 364, hx + 0.6 * hr, hy + 0.72 * hr)
text(AX, 410, 'Motion', 12.5, TEXT, 600)
text(AX, 425, 'drift 12 wu/s random walk', 10.5, MUTED, mono=True)
text(AX, 439, 'mode-2 wobble ±8% r at 0.7 Hz', 10.5, MUTED, mono=True)
text(AX, 453, 'eat: contact with any mote', 10.5, MUTED, mono=True)

# wobble states strip
text(56, 442, 'WOBBLE STATES', 11, ACCENT, 700)
text(56, 456, '4 px / wu · the same cell over one 0.7 Hz cycle', 10.5, MUTED)
wr = 40
for i, (wx, name, fn) in enumerate((
        (95, 'rest', lambda th: 1.0),
        (185, 'wobble +', lambda th: 1 + 0.08 * math.cos(2 * th + 0.5)),
        (275, 'wobble −', lambda th: 1 - 0.08 * math.cos(2 * th + 0.5)))):
    wy = 500
    d, cid = proto_body(wx, wy, wr, fn)
    organelle('granule', wx - 0.3 * wr, wy + 0.1 * wr, 0.06 * wr)
    organelle('lipid', wx + 0.25 * wr, wy - 0.3 * wr, 0.055 * wr)
    organelle('granule', wx + 0.3 * wr, wy + 0.35 * wr, 0.05 * wr)
    glint(wx, wy, wr, 0.8)
    text(wx, 550, name, 10.5, TEXT, 600, 'middle')
# contact eat: mote touching the third state
mote(275 + wr + 24, 500 + 8, 22)
emit(f'<path d="M{275 + wr - 2} {494} q 6 8 0 18" fill="none" stroke="{FOOD_MOTE}" stroke-width="1" opacity="0.5"/>')
text(275 + wr + 30, 550, 'contact · eat', 10.5, MUTED, 400, 'middle')
chevron(P1X + P1W + 8, ROW1_Y + ROW1_H / 2)

# ================================================================ 2 · PROKARYOTE
emit('<!-- ===== 2 · prokaryote ===== -->')
P2X, P2W = 556, 440
panel(P2X, ROW1_Y, P2W, ROW1_H, '2 · PROKARYOTE', 'r ≈ 14 wu · 7.5 px / wu · nucleoid · ribosomes · flagellum · wall')
unlock_chip(P2X + 16, ROW1_Y + 66, 'UNLOCK: level 2 · motile DNA (eat bacteria)')

px_, py_, pr_ = 690, 300, 105
pro_fn = ellipse_fn(1.06, 0.95)


def pro_organelles(cid):
    granules(cid, px_, py_, pr_, 40, pro_fn, size=(1.6, 2.8), alpha=(0.35, 0.8))
    nucleoid(px_ - 0.05 * pr_, py_ + 0.02 * pr_, 0.34 * pr_)


d, cid = cell(px_, py_, pr_, pro_fn, post=pro_organelles)
cell_wall(d, px_, py_, pr_)
flagellum(px_ + pr_ * 1.06 * math.cos(math.radians(-22)), py_ + pr_ * 0.98 * math.sin(math.radians(-22)), -20, 1.85 * pr_, waves=2.2, width=3.2)

AX2 = 816
label_block(AX2, 250, 'Flagellum (optional)', ['#a6f4ff 3 px, white core', '2 r long · 2 waves · motile'])
leader(AX2 - 6, 254, px_ + 1.45 * pr_, py_ - 0.62 * pr_)
label_block(AX2, 312, 'Nucleoid', ['#e4faff on #7fe7f5 glow', 'loop r 34% · no envelope'])
leader(AX2 - 6, 316, px_ + 0.25 * pr_, py_ - 0.1 * pr_)
label_block(AX2, 374, 'Ribosome speckle', ['#a6f4ff 2 px @35–80%', '~40 dots · 2× sheet 01'])
leader(AX2 - 6, 378, px_ + 0.55 * pr_, py_ + 0.3 * pr_)
label_block(AX2, 436, 'Cell wall (optional)', ['#4fb1c4 4.5% r + #bff2ff', 'rigid · +5% r · armored'])
leader(AX2 - 6, 440, px_ + 0.7 * pr_, py_ + 0.8 * pr_)

# variants
text(P2X + 16, 442, 'VARIANTS', 11, ACCENT, 700)
text(P2X + 16, 456, '4 px / wu', 10.5, MUTED)
vr = 40
for vx, name, wall, flag in ((640, 'soft · no wall', False, False), (760, 'walled · armored', True, False)):
    vy = 500

    def _post(cid, vx=vx, vy=vy):
        granules(cid, vx, vy, vr, 14, size=(1.2, 2), alpha=(0.35, 0.8))
        nucleoid(vx, vy, 0.34 * vr, glow=False)

    dd, cc = cell(vx, vy, vr, ellipse_fn(1.06, 0.95), post=_post, halo_opacity=0.25)
    if wall:
        cell_wall(dd, vx, vy, vr)
    text(vx, 550, name, 10.5, TEXT, 600, 'middle')
chevron(P2X + P2W + 8, ROW1_Y + ROW1_H / 2)

# ================================================================ 3 · ENDOSYMBIOSIS
emit('<!-- ===== 3 · endosymbiosis ===== -->')
P3X, P3W = 1012, 868
panel(P3X, ROW1_Y, P3W, ROW1_H, '3 · ENDOSYMBIOSIS', 'engulf the bacterium that already has the organelle · host r 18 wu, bacterium r 8 wu · 3.7 px / wu · before / during / after')
unlock_chip(P3X + 16, ROW1_Y + 66, 'UNLOCK: level 3 · metabolic DNA → mitochondrion · photic DNA → chloroplast')

HR = 66
COLS = (1280, 1516, 1752)
for cx, hdr in zip(COLS, ('BEFORE · approach', 'DURING · engulf', 'AFTER · organelle')):
    text(cx, 172, hdr, 11.5, ACCENT, 700, 'middle')

# Sheet 03 wrap frame (canonical engulf numbers): two pseudopod arms +62 % r at ±30° (σ 16°) with a −10 % notch
# between them. `bump` is exp(-(d / width)²), so a true Gaussian σ maps to width = σ·√2. The three Gaussians
# overlap, so the two amplitudes are solved so that the *outline* measures exactly +62 % at ±30° and −10 % at 0°.
ARM_REACH, ARM_ANGLE_DEG, ARM_SIGMA_DEG = 0.62, 30.0, 16.0
NOTCH_DEPTH, NOTCH_SIGMA_DEG = 0.10, 16.0
FILM_OPACITY, FILM_FADE_START, FILM_FADE_FULL, FILM_REACH = 0.55, 0.05, 0.5, 1.7  # fractions of the host radius


def gauss_bump(th, at_deg, amp, sigma_deg):
    return bump(th, math.radians(at_deg), amp, math.radians(sigma_deg) * math.sqrt(2))


def _solve_wrap_amplitudes():
    arm_at_arm = gauss_bump(math.radians(2 * ARM_ANGLE_DEG), 0, 1.0, ARM_SIGMA_DEG)  # other arm felt at this arm's peak
    arm_at_notch = gauss_bump(math.radians(ARM_ANGLE_DEG), 0, 1.0, ARM_SIGMA_DEG)  # each arm felt at 0°
    notch_at_arm = gauss_bump(math.radians(ARM_ANGLE_DEG), 0, 1.0, NOTCH_SIGMA_DEG)  # notch felt at the arm peaks
    # (1 + arm_at_arm) * A + notch_at_arm * N = ARM_REACH ;  2 * arm_at_notch * A + N = -NOTCH_DEPTH
    arm = (ARM_REACH + notch_at_arm * NOTCH_DEPTH) / (1 + arm_at_arm - 2 * arm_at_notch * notch_at_arm)
    return arm, -NOTCH_DEPTH - 2 * arm_at_notch * arm


ARM_AMP, NOTCH_AMP = _solve_wrap_amplitudes()


def wrap_frame_fn(th):
    return (1 + gauss_bump(th, ARM_ANGLE_DEG, ARM_AMP, ARM_SIGMA_DEG) + gauss_bump(th, -ARM_ANGLE_DEG, ARM_AMP, ARM_SIGMA_DEG)
            + gauss_bump(th, 0, NOTCH_AMP, NOTCH_SIGMA_DEG))


assert abs(wrap_frame_fn(math.radians(ARM_ANGLE_DEG)) - (1 + ARM_REACH)) < 1e-9 and abs(wrap_frame_fn(0) - (1 - NOTCH_DEPTH)) < 1e-9


# The film that covers the engulfed part of the prey fades in along x (no hard edge inside the host cytoplasm).
emit(f'<linearGradient id="film-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/>'
     f'<stop offset="{(FILM_FADE_FULL - FILM_FADE_START) / (FILM_REACH - FILM_FADE_START):.2f}" stop-color="#ffffff" stop-opacity="1"/></linearGradient>')


def endo_row(cy, kind, label_lines):
    light = PURPLE_L if kind == 'purple' else CHLORO_L
    text(P3X + 16, cy - 20, label_lines[0], 12.5, TEXT, 600)
    for i, ln in enumerate(label_lines[1:]):
        text(P3X + 16, cy - 5 + 14 * i, ln, 10, MUTED, 400, mono=True)
    # BEFORE
    cx = COLS[0] - 28

    def _b(cid):
        granules(cid, cx, cy, HR, 20, size=(1.2, 2), alpha=(0.3, 0.7))
        nucleoid(cx - 0.05 * HR, cy, 0.32 * HR, glow=False)

    cell(cx, cy, HR, ellipse_fn(1.04, 0.97), post=_b)
    bacterium(cx + HR + 46, cy + 6, 34, 20, rot=185, kind=kind, trail=True)
    before_right = cx + HR + 46 + 34
    # DURING
    cx = COLS[1] - 20
    during_left, during_right = cx - HR, cx + HR * 1.02 + 34
    hd = smooth_closed(polar_points(cx, cy, HR, wrap_frame_fn, 96))
    hcid = clip_for(hd)
    halo(hd, cx, cy, HR, opacity=0.3)
    emit(f'<path d="{hd}" fill="url(#body-cyan)"/>')
    noise(hcid, cx, cy, HR)
    volume_shading(hcid, cx, cy, HR)
    granules(hcid, cx, cy, HR, 20, size=(1.2, 2), alpha=(0.3, 0.7))
    nucleoid(cx - 0.2 * HR, cy, 0.3 * HR, glow=False)
    bacterium(cx + HR * 1.02, cy, 34, 20, rot=180, kind=kind, flag=False)
    # film over the engulfed part of the prey: clipped to the arms, faded in along x through a gradient mask
    fx, fw = cx + FILM_FADE_START * HR, (FILM_REACH - FILM_FADE_START) * HR
    fy, fh = cy - FILM_REACH * HR, 2 * FILM_REACH * HR
    emit(f'<mask id="film-{kind}" maskUnits="userSpaceOnUse" x="{fx:.0f}" y="{fy:.0f}" width="{fw:.0f}" height="{fh:.0f}">'
         f'<rect x="{fx:.0f}" y="{fy:.0f}" width="{fw:.0f}" height="{fh:.0f}" fill="url(#film-fade)"/></mask>')
    emit(f'<g clip-path="url(#{hcid})" mask="url(#film-{kind})"><rect x="{fx:.0f}" y="{fy:.0f}" width="{fw:.0f}" height="{fh:.0f}" fill="url(#body-cyan)" opacity="{FILM_OPACITY}"/></g>')
    rim_layers(hd, hcid, HR)
    glint(cx, cy, HR)
    # AFTER
    cx = COLS[2] - 10
    after_left = cx - 1.04 * HR

    def _a(cid):
        granules(cid, cx, cy, HR, 20, size=(1.2, 2), alpha=(0.3, 0.7))
        nucleoid(cx - 0.25 * HR, cy - 0.05 * HR, 0.3 * HR, glow=False)
        if kind == 'purple':
            organelle('mito-purple', cx + 0.38 * HR, cy + 0.12 * HR, 0.3 * HR, rot=-20, opacity=0.55)
            organelle('mito', cx + 0.38 * HR, cy + 0.12 * HR, 0.3 * HR, rot=-20, opacity=0.75)
        else:
            organelle('chloro', cx + 0.38 * HR, cy + 0.12 * HR, 0.3 * HR, rot=-20)

    cell(cx, cy, HR, ellipse_fn(1.04, 0.97), post=_a)
    # ramp swatch
    ramp = 'ramp-purple-amber' if kind == 'purple' else 'ramp-green-chloro'
    emit(f'<rect x="{cx - 30:.0f}" y="{cy + HR + 12:.0f}" width="60" height="7" rx="3.5" fill="url(#{ramp})"/>')
    text(cx - 40, cy + HR + 19, ('#b06cf0 → #ffb15a · 3 s' if kind == 'purple' else '#63d64a → #b8ff9a · 3 s'), 9.5, MUTED, 400, 'end', mono=True)
    # arrows between columns, centred in the gaps the shapes actually leave
    for ax in ((before_right + during_left) / 2, (during_right + after_left) / 2):
        emit(f'<line x1="{ax - 11:.0f}" y1="{cy:.0f}" x2="{ax + 11:.0f}" y2="{cy:.0f}" stroke="{ACCENT}" stroke-width="1.6" opacity="0.6" marker-end="url(#arrow)"/>')


endo_row(252, 'purple', ['Purple bacterium', '#b06cf0 · r 8 wu', '→ MITOCHONDRION', 'tag: metabolic', 'sprint · digest'])
endo_row(442, 'green', ['Cyanobacterium', '#63d64a · r 8 wu', '→ CHLOROPLAST', 'tag: photic', 'feeds in light'])
text(COLS[0], 547, 'drifts in at 20 wu/s', 10, MUTED, 400, 'middle', mono=True)
text(COLS[1], 547, 'arms +62% · notch −10% · 1.2 s (sheet 03)', 10, MUTED, 400, 'middle', mono=True)
text(COLS[2], 547, 'shrinks 44% → 30% r, recolours', 10, MUTED, 400, 'middle', mono=True)

# ================================================================ 4 · EUKARYOTE
emit('<!-- ===== 4 · eukaryote ===== -->')
panel(P1X, ROW2_Y, P1W, ROW2_H, '4 · EUKARYOTE', 'r ≈ 24 wu · 5 px / wu · envelope + pores · cytoskeleton → shape · vacuoles · cilia')
unlock_chip(P1X + 16, ROW2_Y + 66, 'UNLOCK: level 4 · predatory DNA (absorb a cell)')

ex, ey, er = 195, 830, 120
euk_fn = lambda th: 1 + 0.05 * math.cos(3 * th + 0.8) + 0.03 * math.cos(2 * th + 2.4)
nx, ny, nr = ex - 0.12 * er, ey - 0.12 * er, 0.3 * er


def euk_pre(cid):
    cytoskeleton(cid, ex, ey, er, nx, ny, nr, euk_fn)


def euk_post(cid):
    organelle('vacuole', ex + 0.5 * er, ey - 0.3 * er, 0.17 * er)
    organelle('vacuole', ex - 0.35 * er, ey + 0.5 * er, 0.14 * er)
    organelle('mito', ex + 0.4 * er, ey + 0.35 * er, 0.16 * er, rot=25)
    organelle('mito', ex - 0.55 * er, ey - 0.15 * er, 0.15 * er, rot=-60)
    organelle('lipid', ex + 0.1 * er, ey + 0.6 * er, 0.06 * er)
    organelle('lipid', ex - 0.05 * er, ey - 0.62 * er, 0.05 * er)
    nucleus(nx, ny, nr, envelope=True, pores=16)


cilia_fringe(ex, ey, er, euk_fn, 64, 0.12 * er, lean=0.55)
cell(ex, ey, er, euk_fn, pre=euk_pre, post=euk_post, granule_count=26)

AX4 = 350
label_block(AX4, 650, 'Nuclear envelope', ['#dff8ff ×2 lines · 16 pores', 'r 30% · gaps 3 px · #7fe7f5'])
leader(AX4 - 6, 654, nx + 0.9 * nr, ny - 0.75 * nr)
label_block(AX4, 716, 'Cytoskeleton', ['#7fe7f5 1.1 px @28%', '11 filaments, nucleus→rim'])
leader(AX4 - 6, 720, ex + 0.55 * er, ey - 0.02 * er)
label_block(AX4, 782, 'Vacuoles ×2', ['#a8d8ff @8–45%, rim #dff0ff', '14–17% r, rim-lit bubbles'])
leader(AX4 - 6, 786, ex + 0.5 * er, ey - 0.3 * er)
label_block(AX4, 848, 'Cilia fringe', ['#a6f4ff 1.2 px @75%', '64 hairs 12% r · lean 30°'])
leader(AX4 - 6, 852, ex + 0.9 * er, ey + 0.55 * er)
label_block(AX4, 914, 'Shape control', ['cytoskeleton lets the body', 'hold mode-3 ±5% r shapes'])
leader(AX4 - 6, 918, ex + 0.3 * er, ey + 0.97 * er)
text(AX4, 980, 'step-3 organelles stay', 10.5, MUTED, mono=True)
text(AX4, 994, 'sheet-01 L5 = this, grown', 10.5, MUTED, mono=True)
text(AX4, 1008, 'nucleus 30% r · parts ∝ r', 10.5, MUTED, mono=True)
chevron(P1X + P1W + 8, ROW2_Y + ROW2_H / 2)

# ================================================================ 5 · SPECIALISED FORMS
emit('<!-- ===== 5 · specialised forms ===== -->')
P5X, P5W = 556, 1324
panel(P5X, ROW2_Y, P5W, ROW2_H, '5 · SPECIALISED FORMS', 'level 6+ · top row: silhouette at 1 px / wu (what the zoom-1.0 camera sees) · bottom row: detail at 3 px / wu · each form unlocked by a pair of DNA tags')
unlock_chip(P5X + 16, ROW2_Y + 66, 'UNLOCK: level 6 · two tags each · form changes the silhouette first')
FCX = [700, 960, 1220, 1483, 1745]
SIL_Y, DET_Y = 668, 830


def silhouette(d, extra=''):
    emit(f'<path d="{d}" fill="{SILHOUETTE}" opacity="0.5" filter="url(#blur-3)"/>')
    emit(f'<path d="{d}" fill="{SILHOUETTE}"/>')
    if extra:
        emit(extra)


# ---- amoeba
amo_fn = lambda th: 0.72 + bump(th, -2.4, 0.7, 0.34) + bump(th, -0.9, 0.55, 0.28) + bump(th, 0.45, 0.85, 0.3) + bump(th, 2.1, 0.45, 0.36)
cx = FCX[0]
s = 3
ar = 26 * s
silhouette(smooth_closed(polar_points(cx + 10, SIL_Y, 26, amo_fn, 64)))
an = (cx - 0.15 * ar, DET_Y + 0.05 * ar)


def amo_pre(cid):
    # clear ectoplasm band
    dd = smooth_closed(polar_points(cx, DET_Y, ar, amo_fn, 96))
    emit(f'<g clip-path="url(#{cid})"><path d="{dd}" fill="none" stroke="{VAC_RIM}" stroke-width="{0.3 * ar:.1f}" opacity="0.14"/></g>')
    # streaming arrows in the lead pseudopod
    for i in range(3):
        t = 0.55 + 0.25 * i
        x, y = cx + ar * t * math.cos(0.45), DET_Y + ar * t * math.sin(0.45)
        emit(f'<path d="M{x - 6:.1f} {y - 5:.1f} L{x + 3:.1f} {y:.1f} L{x - 6:.1f} {y + 5:.1f}" fill="none" stroke="{RIM}" stroke-width="1" opacity="{0.5 - 0.1 * i:.2f}" transform="rotate(26 {x:.1f} {y:.1f})"/>')


def amo_post(cid):
    organelle('cvac', cx - 0.55 * ar, DET_Y - 0.35 * ar, 0.16 * ar)
    organelle('vacuole', cx + 0.35 * ar, DET_Y - 0.45 * ar, 0.13 * ar)
    mote(cx + 0.35 * ar, DET_Y - 0.45 * ar, 0.07 * ar)
    organelle('mito', cx + 0.3 * ar, DET_Y + 0.5 * ar, 0.13 * ar, rot=40)
    nucleus(an[0], an[1], 0.22 * ar, envelope=True, pores=10)


cell(cx, DET_Y, ar, amo_fn, pre=amo_pre, post=amo_post, granule_count=30, n=96)
text(cx, 960, 'AMOEBA', 13, TEXT, 700, 'middle')
text(cx, 976, 'pseudopods · core 26 wu → 1.6 r', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 990, 'ectoplasm #dff0ff @14% · food vac.', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 1004, 'unlock: predatory + metabolic', 10.5, ACCENT, 400, 'middle', mono=True)
text(cx, 1018, 'engulf reach +60% r · speed 0.7×', 10.5, MUTED, 400, 'middle', mono=True)

# ---- paramecium
cx = FCX[1]
pa, pb = 30, 12  # wu half-length / half-width
para_base = ellipse_fn(pa, pb)
para_fn = lambda th: para_base(th) * (1 + 0.06 * math.cos(th)) * (1 - 0.14 * math.exp(-(wrap(th - 0.75) / 0.3) ** 2))
para_norm = lambda th: (math.cos(th) / pa ** 2, math.sin(th) / pb ** 2)
ROT = math.radians(-28)
silhouette(smooth_closed(polar_points(cx + 8, SIL_Y, 1, para_fn, 80, ROT)),
           f'<path d="{smooth_closed(polar_points(cx + 8, SIL_Y, 1, para_fn, 80, ROT))}" fill="none" stroke="{SILHOUETTE}" stroke-width="3" opacity="0.5"/>')
pcx, pcy = cx, DET_Y
cilia_fringe(pcx, pcy, s, para_fn, 120, 9, rot=ROT, lean=0.6, width=1.1, normal=para_norm)


def para_post(cid):
    # oral groove furrow
    ox, oy = pcx + s * 0.75 * pa * math.cos(0.75 + ROT), pcy + s * 0.75 * pb * math.sin(0.75 + ROT)
    gx, gy = pcx + s * 0.05 * pa * math.cos(0.9 + ROT), pcy + s * 0.05 * pb * math.sin(0.9 + ROT)
    emit(f'<path d="M{ox:.1f} {oy:.1f} Q{(ox + gx) / 2 + 8:.1f} {(oy + gy) / 2 + 10:.1f} {gx:.1f} {gy:.1f}" fill="none" stroke="{EDGE}" stroke-width="4" opacity="0.7" stroke-linecap="round"/>')
    emit(f'<path d="M{ox:.1f} {oy:.1f} Q{(ox + gx) / 2 + 8:.1f} {(oy + gy) / 2 + 10:.1f} {gx:.1f} {gy:.1f}" fill="none" stroke="{RIM}" stroke-width="1" opacity="0.5" stroke-linecap="round"/>')
    for t, sz in ((-0.62, 0.14), (0.6, 0.13)):
        organelle('cvac', pcx + s * pa * t * math.cos(ROT), pcy + s * pa * t * math.sin(ROT), sz * s * pb * 1.4)
    for t, off in ((0.3, 0.5), (-0.25, -0.55), (0.05, 0.62)):
        vx = pcx + s * (pa * t * math.cos(ROT) - pb * off * math.sin(ROT))
        vy = pcy + s * (pa * t * math.sin(ROT) + pb * off * math.cos(ROT))
        organelle('vacuole', vx, vy, 0.11 * s * pb)
        mote(vx, vy, 0.05 * s * pb)
    # macronucleus (kidney) + micronucleus
    mx, my = pcx - 0.08 * s * pa * math.cos(ROT), pcy - 0.08 * s * pa * math.sin(ROT)
    emit(f'<g transform="translate({mx:.1f} {my:.1f}) rotate({math.degrees(ROT):.0f})">')
    emit(f'<ellipse rx="{0.28 * s * pa:.1f}" ry="{0.42 * s * pb:.1f}" fill="{NUC}" opacity="0.35" filter="url(#blur-6)"/>')
    emit(f'<path d="M{-0.28 * s * pa:.1f} 0 a{0.28 * s * pa:.1f} {0.38 * s * pb:.1f} 0 1 1 {0.56 * s * pa:.1f} 0 q{-0.2 * s * pa:.1f} {-0.12 * s * pb:.1f} {-0.56 * s * pa:.1f} 0z" fill="url(#nuc-cyan)"/>')
    emit(f'<circle cx="{0.05 * s * pa:.1f}" cy="{-0.55 * s * pb:.1f}" r="{0.12 * s * pb:.1f}" fill="url(#nuc-cyan)" stroke="{RIM}" stroke-width="0.8"/>')
    emit('</g>')


cell(pcx, pcy, s, para_fn, rot=ROT, post=para_post, granule_count=40, n=96, inner=True)
text(cx, 960, 'PARAMECIUM', 13, TEXT, 700, 'middle')
text(cx, 976, 'slipper 60 × 24 wu · 120 cilia 3 wu', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 990, 'oral groove · macro + micronucleus', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 1004, 'unlock: motile + sensory', 10.5, ACCENT, 400, 'middle', mono=True)
text(cx, 1018, 'top speed 1.4× · turn rate 1.6×', 10.5, MUTED, 400, 'middle', mono=True)

# ---- euglena
cx = FCX[2]
ea, eb = 25, 8
eug_base = ellipse_fn(ea, eb)
eug_fn = lambda th: eug_base(th) * (1 + 0.3 * math.cos(th)) * (1 - 0.1 * math.exp(-(wrap(th - math.pi) / 0.5) ** 2))
EROT = math.radians(-38)
sil_d = smooth_closed(polar_points(cx - 50, SIL_Y + 8, 1, eug_fn, 72, EROT))
fx0, fy0 = cx - 50 + ea * 1.2 * math.cos(EROT), SIL_Y + 8 + ea * 1.2 * math.sin(EROT)
silhouette(sil_d, f'<path d="M{fx0:.1f} {fy0:.1f} q10 -14 26 -20" fill="none" stroke="{SILHOUETTE}" stroke-width="1.5" opacity="0.9"/>')
ecx, ecy = cx - 14, DET_Y + 22


def eug_pre(cid):
    # pellicle stripes
    emit(f'<g clip-path="url(#{cid})" transform="translate({ecx:.1f} {ecy:.1f}) rotate({math.degrees(EROT):.0f})">')
    for i in range(-3, 4):
        y = i * s * eb * 0.25
        emit(f'<path d="M{-s * ea:.1f} {y:.1f} q{s * ea * 0.5:.1f} {-s * eb * 0.3:.1f} {s * ea:.1f} 0 t{s * ea:.1f} 0" fill="none" stroke="{CYTOSKELETON}" stroke-width="0.9" opacity="0.28"/>')
    emit('</g>')


def eug_post(cid):
    for t, off, rot in ((-0.55, 0.3, 10), (-0.4, -0.35, -15), (-0.1, 0.4, 20), (0.15, -0.35, -10), (0.45, 0.25, 15), (0.58, -0.2, 0)):
        vx = ecx + s * (ea * t * math.cos(EROT) - eb * off * math.sin(EROT))
        vy = ecy + s * (ea * t * math.sin(EROT) + eb * off * math.cos(EROT))
        organelle('chloro', vx, vy, 0.28 * s * eb, rot=math.degrees(EROT) + rot)
    nucleus(ecx + s * ea * 0.05 * math.cos(EROT), ecy + s * ea * 0.05 * math.sin(EROT), 0.42 * s * eb, envelope=True, pores=8)
    # eyespot + reservoir at the front (+x)
    exx = ecx + s * (ea * 0.72 * math.cos(EROT) - eb * 0.35 * math.sin(EROT))
    eyy = ecy + s * (ea * 0.72 * math.sin(EROT) + eb * 0.35 * math.cos(EROT))
    emit(f'<circle cx="{exx:.1f}" cy="{eyy:.1f}" r="{0.45 * s * eb:.1f}" fill="{EYESPOT}" opacity="0.45" filter="url(#blur-3)"/>')
    emit(f'<circle cx="{exx:.1f}" cy="{eyy:.1f}" r="{0.25 * s * eb:.1f}" fill="url(#eyespot-g)"/>')
    emit(f'<circle cx="{exx - 1.5:.1f}" cy="{eyy - 1.5:.1f}" r="{0.08 * s * eb:.1f}" fill="#ffffff" opacity="0.8"/>')
    rx_ = ecx + s * ea * 0.82 * math.cos(EROT)
    ry_ = ecy + s * ea * 0.82 * math.sin(EROT)
    organelle('vacuole', rx_, ry_, 0.3 * s * eb)


cell(ecx, ecy, s, eug_fn, rot=EROT, pre=eug_pre, post=eug_post, granule_count=16, n=96)
tipx, tipy = ecx + s * ea * 1.28 * math.cos(EROT), ecy + s * ea * 1.28 * math.sin(EROT)
flagellum(tipx, tipy, math.degrees(EROT) - 14, 40 * s, waves=1.4, amp=14, width=2.4)
text(cx, 960, 'EUGLENA', 13, TEXT, 700, 'middle')
text(cx, 976, 'spindle 50 × 16 wu · flagellum 40 wu', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 990, 'eyespot #ff4d3a · 6 chloroplasts', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 1004, 'unlock: photic + motile', 10.5, ACCENT, 400, 'middle', mono=True)
text(cx, 1018, 'sees light zones · feeds moving', 10.5, MUTED, 400, 'middle', mono=True)

# ---- diatom
cx = FCX[3]
DR = 26 * s
sil_r = 26
emit(f'<circle cx="{cx:.0f}" cy="{SIL_Y}" r="{sil_r}" fill="{SILHOUETTE}" opacity="0.5" filter="url(#blur-3)"/>')
emit(f'<circle cx="{cx:.0f}" cy="{SIL_Y}" r="{sil_r}" fill="{SILHOUETTE}"/>')
for i in range(12):
    a = math.pi * i / 6
    emit(f'<line x1="{cx + sil_r * 0.35 * math.cos(a):.1f}" y1="{SIL_Y + sil_r * 0.35 * math.sin(a):.1f}" x2="{cx + sil_r * 0.9 * math.cos(a):.1f}" y2="{SIL_Y + sil_r * 0.9 * math.sin(a):.1f}" stroke="{BG_FIELD}" stroke-width="1.2" opacity="0.6"/>')
dcx, dcy = cx, DET_Y
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{DR * 1.18:.0f}" fill="{SILICA}" opacity="0.28" filter="url(#blur-10)"/>')
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{DR}" fill="url(#silica-g)"/>')
dcid = uid('clip')
emit(f'<clipPath id="{dcid}"><circle cx="{dcx}" cy="{dcy}" r="{DR}"/></clipPath>')
noise(dcid, dcx, dcy, DR, opacity=0.1, fine=0.12)
volume_shading(dcid, dcx, dcy, DR)
for i, a in enumerate((0.3, 1.87, 3.44, 5.0)):
    organelle('plastid', dcx + 0.5 * DR * math.cos(a), dcy + 0.5 * DR * math.sin(a), 0.3 * DR, rot=math.degrees(a))
nucleus(dcx, dcy, 0.14 * DR, envelope=True, pores=8)
# striae + pores
for i in range(36):
    a = math.pi * i / 18
    x1, y1 = dcx + 0.28 * DR * math.cos(a), dcy + 0.28 * DR * math.sin(a)
    x2, y2 = dcx + 0.9 * DR * math.cos(a), dcy + 0.9 * DR * math.sin(a)
    emit(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{SILICA_L}" stroke-width="{1.4 if i % 2 == 0 else 0.8}" opacity="{0.6 if i % 2 == 0 else 0.35}"/>')
    if i % 2 == 1:
        for k in range(5):
            t = 0.36 + 0.12 * k
            emit(f'<circle cx="{dcx + t * DR * math.cos(a):.1f}" cy="{dcy + t * DR * math.sin(a):.1f}" r="1.3" fill="{SILICA_L}" opacity="0.5"/>')
for k in range(6):
    a = math.pi * k / 3
    emit(f'<circle cx="{dcx + 0.2 * DR * math.cos(a):.1f}" cy="{dcy + 0.2 * DR * math.sin(a):.1f}" r="2" fill="{SILICA_L}" opacity="0.7"/>')
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{0.86 * DR:.1f}" fill="none" stroke="{SILICA}" stroke-width="1.5" opacity="0.6"/>')
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{0.94 * DR:.1f}" fill="none" stroke="{SILICA_L}" stroke-width="1" opacity="0.5"/>')
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{DR}" fill="none" stroke="{SILICA_L}" stroke-width="3.5" opacity="0.9"/>')
emit(f'<circle cx="{dcx}" cy="{dcy}" r="{DR}" fill="none" stroke="{OUTLINE}" stroke-width="1" opacity="0.5"/>')
emit(f'<path d="M{dcx - 0.92 * DR * math.cos(0.9):.1f} {dcy - 0.92 * DR * math.sin(0.9):.1f} A{0.92 * DR:.1f} {0.92 * DR:.1f} 0 0 1 {dcx - 0.92 * DR * math.cos(0.25):.1f} {dcy - 0.92 * DR * math.sin(0.25):.1f}" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.6" stroke-linecap="round" filter="url(#blur-1_5)"/>')
text(cx, 960, 'DIATOM', 13, TEXT, 700, 'middle')
text(cx, 976, 'silica valve r 26 wu · 36 striae', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 990, '#eef9ff/#a9dcef/#2f6f8c · #d7a441', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 1004, 'unlock: armored + photic', 10.5, ACCENT, 400, 'middle', mono=True)
text(cx, 1018, 'engulf threshold 1.6× · sinks', 10.5, MUTED, 400, 'middle', mono=True)

# ---- stentor
cx = FCX[4]


def stentor_outline(cx, top, L, wmax, wmin):
    right, left = [], []
    for i in range(41):
        t = i / 40
        w = wmin + (wmax - wmin) * (1 - t) ** 1.7 + 0.16 * wmax * math.exp(-(t / 0.08) ** 2) + 0.18 * wmax * math.exp(-((t - 0.38) / 0.22) ** 2)
        y = top + t * L
        right.append((cx + w, y))
        left.append((cx - w, y))
    pts = right + [(cx, top + L + wmin * 0.8)] + left[::-1] + [(cx, top - wmax * 0.16)]
    return pts


def stentor_width(t, wmax, wmin):
    return wmin + (wmax - wmin) * (1 - t) ** 1.7 + 0.16 * wmax * math.exp(-(t / 0.08) ** 2) + 0.18 * wmax * math.exp(-((t - 0.38) / 0.22) ** 2)


sil_pts = stentor_outline(cx + 6, SIL_Y - 50, 70, 18, 4)
silhouette(smooth_closed(sil_pts, 0.8))
ST_S = 2.7  # the trumpet is 70 wu tall: at 3 px / wu it would not fit the detail slot
SL, SW, SWMIN = 70 * ST_S, 18 * ST_S, 4 * ST_S
stop = DET_Y - SL / 2 + 2
st_pts = stentor_outline(cx, stop, SL, SW, SWMIN)
st_d = smooth_closed(st_pts, 0.8)
st_cid = clip_for(st_d)
halo(st_d, cx, DET_Y, SW * 1.4, opacity=0.28, scale=1.1)
emit(f'<path d="{st_d}" fill="url(#body-cyan)"/>')
noise(st_cid, cx, DET_Y, SL / 2)
emit(f'<g clip-path="url(#{st_cid})"><ellipse cx="{cx + 0.3 * SW:.1f}" cy="{DET_Y + 0.2 * SL:.1f}" rx="{0.8 * SW:.1f}" ry="{0.5 * SL:.1f}" fill="{OUTLINE}" opacity="0.28" filter="url(#blur-16)"/>'
     f'<ellipse cx="{cx - 0.4 * SW:.1f}" cy="{stop + 0.2 * SL:.1f}" rx="{0.5 * SW:.1f}" ry="{0.25 * SL:.1f}" fill="{RIM}" opacity="0.14" filter="url(#blur-16)"/></g>')
# pigment stripes following the profile
emit(f'<g clip-path="url(#{st_cid})">')
for f in (-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8):
    pts = [(cx + f * stentor_width(i / 20, SW, SWMIN) * (1 - 0.15 * i / 20), stop + (i / 20) * SL) for i in range(21)]
    emit(f'<path d="{smooth_open(pts)}" fill="none" stroke="{CYTOSKELETON}" stroke-width="1" opacity="0.3"/>')
emit('</g>')
granules(st_cid, cx, DET_Y, SL / 2, 40, lambda th: 0.55, size=(1.2, 2.2), alpha=(0.3, 0.7))
# beaded macronucleus
for k in range(7):
    t = 0.14 + 0.1 * k
    bx = cx + 0.25 * stentor_width(t, SW, SWMIN) * math.sin(k * 1.3)
    by = stop + t * SL
    br = 0.22 * SW * (1 - 0.5 * t)
    emit(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{br * 1.3:.1f}" fill="{NUC}" opacity="0.3" filter="url(#blur-3)"/>')
    emit(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{br:.1f}" fill="url(#nuc-cyan)"/>')
    emit(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{br:.1f}" fill="none" stroke="{ENVELOPE}" stroke-width="0.8" opacity="0.7"/>')
    if k < 6:
        emit(f'<line x1="{bx:.1f}" y1="{by + br:.1f}" x2="{cx + 0.25 * stentor_width(t + 0.1, SW, SWMIN) * math.sin((k + 1) * 1.3):.1f}" y2="{stop + (t + 0.1) * SL - br * 0.9:.1f}" stroke="{ENVELOPE}" stroke-width="1.2" opacity="0.6"/>')
organelle('cvac', cx + 0.55 * SW, stop + 0.16 * SL, 0.2 * SW)
organelle('vacuole', cx - 0.45 * SW, stop + 0.32 * SL, 0.16 * SW)
mote(cx - 0.45 * SW, stop + 0.32 * SL, 0.07 * SW)
rim_layers(st_d, st_cid, SW * 1.2, edge_w=0.06, rim_w=0.045)
# oral field: the trumpet mouth ellipse + membranellar band of cilia
mouth_rx, mouth_ry = SW * 1.12, SW * 0.28
emit(f'<ellipse cx="{cx}" cy="{stop - SW * 0.1:.1f}" rx="{mouth_rx:.1f}" ry="{mouth_ry:.1f}" fill="{CYTO_D}" opacity="0.75"/>')
emit(f'<ellipse cx="{cx}" cy="{stop - SW * 0.1:.1f}" rx="{mouth_rx * 0.75:.1f}" ry="{mouth_ry * 0.65:.1f}" fill="{OUTLINE}" opacity="0.5" filter="url(#blur-3)"/>')
emit(f'<ellipse cx="{cx}" cy="{stop - SW * 0.1:.1f}" rx="{mouth_rx:.1f}" ry="{mouth_ry:.1f}" fill="none" stroke="url(#rim-cyan)" stroke-width="2.4"/>')
for i in range(44):
    a = 2 * math.pi * i / 44
    x0, y0 = cx + mouth_rx * math.cos(a), stop - SW * 0.1 + mouth_ry * math.sin(a)
    ln = 10 * rng.uniform(0.8, 1.2)
    emit(f'<path d="M{x0:.1f} {y0:.1f} q{ln * 0.5 * math.cos(a) + 3:.1f} {ln * 0.6 * math.sin(a) - 4:.1f} {ln * math.cos(a) + 5:.1f} {ln * math.sin(a) - 8:.1f}" fill="none" stroke="{CILIA}" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>')
# holdfast
fy = stop + SL + SWMIN * 0.8
for dx in (-14, -5, 5, 14):
    emit(f'<path d="M{cx} {fy - 4:.1f} q{dx * 0.5} 8 {dx} 14" fill="none" stroke="{RIM}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>')
glint(cx - 0.2 * SW, stop + 0.25 * SL, SW, 0.9)
text(cx, 960, 'STENTOR', 13, TEXT, 700, 'middle')
text(cx, 976, 'trumpet 70 wu · mouth 36 wu · 2.7 px/wu', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 990, '7-bead macronucleus · 44 membranelles', 10.5, MUTED, 400, 'middle', mono=True)
text(cx, 1004, 'unlock: sensory + predatory', 10.5, ACCENT, 400, 'middle', mono=True)
text(cx, 1018, 'anchors · pulls motes at 40 wu/s', 10.5, MUTED, 400, 'middle', mono=True)


# ---------------------------------------------------------------- footer + vignette
emit(f'<rect width="{W}" height="{H}" fill="url(#vignette)" pointer-events="none"/>')
text(1880, 1070, 'Evolution · docs/concept-art/origins-ladder.svg · 1920 × 1080', 10.5, MUTED, 400, 'end', mono=True)
text(40, 1070, 'ladder: 1 → 2 → 3 (top row) then 4 → 5 (bottom row) · every form keeps the sheet-01 layer stack: halo · body · noise · organelles · inner edge · rim · outline · glint', 10.5, MUTED, 400, 'start', mono=True)
emit('</svg>')

out = sys.argv[1] if len(sys.argv) > 1 else 'docs/concept-art/origins-ladder.svg'
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(OUT) + '\n')
print(f'wrote {out}: {len(OUT)} elements')

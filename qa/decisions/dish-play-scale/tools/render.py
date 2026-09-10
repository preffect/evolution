#!/usr/bin/env python3
# usage: python3 qa/decisions/dish-play-scale/tools/render.py   (seeded, byte-stable; writes option-{a,b,c}.svg next to it)
"""Decision mockups: how the dish reads at play scale (epic #96, M2).

Each option builds a whole dish from ECOLOGY.md's spawn model (kind -> zone -> point, bacteria as
clusters, caps at steady state for one player), then draws a 1920 x 1080 view at camera zoom 1.0
(1 px = 1 wu) from the protocell's spawn seat, plus an inset of the same seat at zoom 0.36 (the
camera ceiling, reached at CELL_MAX_MASS). Cell language: sheet 01 / sheet 04 (protocell); dish,
motes, wall, particles: sheet 02; palette: VISUAL-STYLE.md section 2. Code-drawn SVG, zero raster.
"""
import math
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

W, H = 1920, 1080
CX, CY = W / 2, H / 2

# ---------------------------------------------------------------- palette (VISUAL-STYLE.md section 2 and the sheet tables)
BG_DEEP, BG_FIELD = '#04070d', '#0b1626'
LIGHT_ACCENT = '#7fe7f5'
TEXT, MUTED, ACCENT = '#cfdbe6', '#7d8da1', '#7fe7f5'
OUTLINE, WHITE = '#020509', '#ffffff'
PANEL_TOP, PANEL_BOTTOM, PANEL_RIM = '#0e1f33', '#060e1a', '#173250'
ZONE_SHALLOWS, ZONE_VENT, ZONE_GEL = '#8dffb0', '#ff9a4d', '#b070ff'
FOOD_MOTE, FOOD_MOTE_EDGE, FOOD_MOTE_RIM = '#8dff6a', '#3f9a2c', '#dcffb0'
DNA_STRAND_LIGHT, DNA_STRAND, DNA = '#f0b8ff', '#d36bff', '#d36bff'
MITO_LIGHT, MITO_BASE = '#ffd39a', '#ffb15a'
CHLORO_LIGHT, CHLORO_BASE, CHLORO_DARK = '#b8ff9a', '#63d64a', '#1f7a2b'
BACTERIUM_PLAIN, PROTO_FILM, PROTO_FILM_LIGHT, PROTO_GRANULE = '#cfefff', '#8fd3e3', '#d8f6ff', '#cfefff'
NUCLEOID_STRAND, NUCLEOID_GLOW, RIBOSOME, FLAGELLUM = '#e4faff', '#7fe7f5', '#a6f4ff', '#a6f4ff'
LIPID_LIGHT, LIPID_BASE = '#fff8d0', '#f2c94c'
WALL_BAND, WALL_INNER, WALL_OUTER, WALL_OUTSIDE, WALL_SCRATCH = '#182c46', '#2a4a70', '#4a6a90', '#02040a', '#2a3d58'
DEPTH_FAR = ('#ffffff', '#c4f0ff', '#9fe8f5', '#7fb8ff')
DEPTH_NEAR = '#dff4ff'
DNA_TAG_COLOR = {'motile': '#66ecff', 'metabolic': '#ffb15a', 'photic': '#b8ff9a', 'predatory': '#ff5470',
                 'toxic': '#d05cff', 'sensory': '#6a9bff', 'armored': '#e6ecf2'}
# player palettes (sheet 01): base, rim, nuc, edge, cyto light, cyto dark, nuc dark
CYAN = ('#22c1d6', '#a6f4ff', '#6fdcef', '#124e56', '#1d636c', '#102426', '#167787')
CORAL = ('#ff6b5c', '#ffd0c8', '#ff9a8c', '#8a1307', '#ac2113', '#3b1511', '#a91c09')
MONO = "'JetBrains Mono', 'DejaVu Sans Mono', Consolas, Menlo, monospace"
SANS = "Inter, 'Liberation Sans', 'DejaVu Sans', Helvetica, Arial, sans-serif"

# ---------------------------------------------------------------- fixed ECOLOGY / GAME-DESIGN constants (not under decision)
FOOD_EDGE_MARGIN = 40
ALGAE_RADIUS, BACTERIUM_RADIUS, DNA_FRAGMENT_RADIUS = 6, 8, 9
BACTERIUM_CLUSTER_SIZE, BACTERIUM_CLUSTER_RADIUS = 5, 60
FOOD_KIND_WEIGHTS = {'algae': 0.75, 'bacterium': 0.25}
BACTERIUM_VARIANT_WEIGHTS_BY_ZONE = {
    'warm_vent': {'plain': 0.3, 'aerobic': 0.7, 'photosynthetic': 0.0},
    'sunlit_shallows': {'plain': 0.3, 'aerobic': 0.0, 'photosynthetic': 0.7},
    'open_broth': {'plain': 0.6, 'aerobic': 0.2, 'photosynthetic': 0.2},
}
DNA_FRAGMENT_TAG_TABLE_BY_ZONE = {
    'sunlit_shallows': {'photic': 0.5, 'sensory': 0.5},
    'warm_vent': {'predatory': 0.4, 'toxic': 0.3, 'metabolic': 0.3},
    'open_broth': {'motile': 0.5, 'armored': 0.5},
}
CELL_STARTING_MASS, CELL_MAX_MASS, CELL_RADIUS_SCALE = 20, 5000, 4
PROTOCELL_RADIUS = CELL_RADIUS_SCALE * math.sqrt(CELL_STARTING_MASS)  # 17.9 wu
MAX_MASS_RADIUS = CELL_RADIUS_SCALE * math.sqrt(CELL_MAX_MASS)  # 282.8 wu
SPAWN_ZOOM = 540 / 300  # CAMERA_MIN_VIEW_HALF_HEIGHT_WU 300 at 1080p -> 1.8 px / wu
CEILING_ZOOM = 540 / 1500  # CAMERA_MAX_VIEW_HALF_HEIGHT_WU 1500 -> 0.36 px / wu
PLAYERS = 1


@dataclass
class Option:
    code: str
    name: str
    subtitle: str
    zone_style: str  # 'soft' (sheet 02 alphas) or 'strong'
    DISH_RADIUS: int
    SHALLOWS_WIDTH: int
    VENT_RADIUS: int
    GEL_PATCH_COUNT: int
    GEL_PATCH_RADIUS: int
    GEL_PATCH_MIN_SPACING: int
    FOOD_CAP_BASE: int
    FOOD_CAP_PER_PLAYER: int
    FOOD_SPAWN_PER_SECOND_BASE: float
    FOOD_SPAWN_PER_SECOND_PER_PLAYER: float
    DNA_FRAGMENT_CAP_BASE: int
    DNA_FRAGMENT_CAP_PER_PLAYER: int
    DNA_FRAGMENT_SPAWN_PER_SECOND_BASE: float
    DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER: float
    algae_zone_weights: dict = field(default_factory=lambda: {'sunlit_shallows': 0.70, 'open_broth': 0.25, 'warm_vent': 0.05})
    bacterium_zone_weights: dict = field(default_factory=lambda: {'warm_vent': 0.60, 'open_broth': 0.30, 'sunlit_shallows': 0.10})
    dna_zone_weights: dict = field(default_factory=lambda: {'warm_vent': 0.40, 'open_broth': 0.40, 'sunlit_shallows': 0.20})
    seed: int = 96

    @property
    def food_cap(self):
        return self.FOOD_CAP_BASE + self.FOOD_CAP_PER_PLAYER * PLAYERS

    @property
    def dna_cap(self):
        return self.DNA_FRAGMENT_CAP_BASE + self.DNA_FRAGMENT_CAP_PER_PLAYER * PLAYERS

    @property
    def shallows_inner(self):
        return self.DISH_RADIUS - self.SHALLOWS_WIDTH


ECOLOGY_AS_WRITTEN = dict(DISH_RADIUS=3000, SHALLOWS_WIDTH=500, VENT_RADIUS=500, GEL_PATCH_COUNT=3, GEL_PATCH_RADIUS=350,
                          GEL_PATCH_MIN_SPACING=900, FOOD_CAP_BASE=600, FOOD_CAP_PER_PLAYER=100, FOOD_SPAWN_PER_SECOND_BASE=6,
                          FOOD_SPAWN_PER_SECOND_PER_PLAYER=1, DNA_FRAGMENT_CAP_BASE=30, DNA_FRAGMENT_CAP_PER_PLAYER=10,
                          DNA_FRAGMENT_SPAWN_PER_SECOND_BASE=0.5, DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER=0.1)

OPTIONS = [
    Option('A', 'SPARSE AND DARK', 'ECOLOGY.md as written: wide empty water between zones', 'soft', **ECOLOGY_AS_WRITTEN),
    Option('B', 'DENSE BROTH', 'smaller dish, 2x food cap (2.6x motes per screen), tighter zones, bacteria spread into the broth', 'soft',
           DISH_RADIUS=2600, SHALLOWS_WIDTH=420, VENT_RADIUS=450, GEL_PATCH_COUNT=3, GEL_PATCH_RADIUS=320, GEL_PATCH_MIN_SPACING=800,
           FOOD_CAP_BASE=1200, FOOD_CAP_PER_PLAYER=200, FOOD_SPAWN_PER_SECOND_BASE=12, FOOD_SPAWN_PER_SECOND_PER_PLAYER=2,
           DNA_FRAGMENT_CAP_BASE=60, DNA_FRAGMENT_CAP_PER_PLAYER=20, DNA_FRAGMENT_SPAWN_PER_SECOND_BASE=1.0,
           DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER=0.2,
           bacterium_zone_weights={'warm_vent': 0.45, 'open_broth': 0.45, 'sunlit_shallows': 0.10}),
    Option('C', 'ZONED STRONGLY', 'ECOLOGY.md densities, zones drawn as distinct biomes: strong tint, texture and edges', 'strong',
           **ECOLOGY_AS_WRITTEN),
]

# ---------------------------------------------------------------- emit helpers
OUT: list[str] = []
_k = 0


def emit(s):
    OUT.append(s)


def uid(prefix):
    global _k
    _k += 1
    return f'{prefix}{_k}'


def blur_id(sigma):
    for s in (1.5, 3, 6, 10, 16, 26, 40):
        if sigma <= s * 1.35:
            return f'blur-{str(s).replace(".", "_")}'
    return 'blur-40'


def polar_points(cx, cy, r, fn, n=36, rot=0.0):
    return [(cx + r * fn(2 * math.pi * i / n) * math.cos(2 * math.pi * i / n + rot),
             cy + r * fn(2 * math.pi * i / n) * math.sin(2 * math.pi * i / n + rot)) for i in range(n)]


def smooth_closed(pts):
    n = len(pts)
    d = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ' '.join(d) + ' Z'


def smooth_open(pts):
    n = len(pts)
    d = [f'M{pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}')
    return ' '.join(d)


def wrap(dth):
    while dth > math.pi:
        dth -= 2 * math.pi
    while dth < -math.pi:
        dth += 2 * math.pi
    return dth


def membrane_fn(rng, bumps=3, wobble=0.0):
    """Sheet 02 rule: radius = r x (1 + sum of Gaussian bumps of +-2.5-4 %, sigma 0.25-0.4 rad) + a mode-2 wobble."""
    bs = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.025, 0.04) * rng.choice((-1, 1)), rng.uniform(0.25, 0.4)) for _ in range(bumps)]
    phase = rng.uniform(0, math.pi)
    return lambda th: 1 + wobble * math.cos(2 * th + phase) + sum(a * math.exp(-(wrap(th - at) / s) ** 2) for at, a, s in bs)


def weighted(rng, table):
    r = rng.random() * sum(table.values())
    for k, w in table.items():
        r -= w
        if r <= 0:
            return k
    return next(reversed(table))


# ---------------------------------------------------------------- world model (ECOLOGY.md section 2 and 3)
@dataclass
class World:
    opt: Option
    seat: tuple
    gels: list
    algae: list  # (x, y)
    bacteria: list  # (x, y, variant, heading)
    fragments: list  # (x, y, tag)
    cells: list  # (x, y, r, palette, index)


def zone_of(opt, gels, x, y):
    d = math.hypot(x, y)
    if d >= opt.shallows_inner:
        return 'sunlit_shallows'
    if d <= opt.VENT_RADIUS:
        return 'warm_vent'
    for gx, gy in gels:
        if math.hypot(x - gx, y - gy) <= opt.GEL_PATCH_RADIUS:
            return 'viscous_gel'
    return 'open_broth'


def point_in_zone(rng, opt, gels, zone):
    """Uniform in the zone (gel patches spawn with the broth: the zone weights only name three zones)."""
    while True:
        if zone == 'sunlit_shallows':
            r = math.sqrt(rng.uniform(opt.shallows_inner ** 2, (opt.DISH_RADIUS - FOOD_EDGE_MARGIN) ** 2))
        elif zone == 'warm_vent':
            r = opt.VENT_RADIUS * math.sqrt(rng.random())
        else:
            r = math.sqrt(rng.uniform(opt.VENT_RADIUS ** 2, opt.shallows_inner ** 2))
        th = rng.uniform(0, 2 * math.pi)
        x, y = r * math.cos(th), r * math.sin(th)
        z = zone_of(opt, gels, x, y)
        if z == zone or (zone == 'open_broth' and z == 'viscous_gel'):
            return x, y


def build_world(opt):
    rng = random.Random(opt.seed)
    seat = (-(opt.DISH_RADIUS - 900), 0.0)  # the wall sits 900 wu left of the protocell in every option
    # gel patches: the first is placed so one patch is in the play-scale view, the rest uniform in the broth
    gels = [(seat[0] + 430, seat[1] - 290)]
    while len(gels) < opt.GEL_PATCH_COUNT:
        r = math.sqrt(rng.uniform((opt.VENT_RADIUS + opt.GEL_PATCH_RADIUS) ** 2, (opt.shallows_inner - opt.GEL_PATCH_RADIUS) ** 2))
        th = rng.uniform(0, 2 * math.pi)
        p = (r * math.cos(th), r * math.sin(th))
        if all(math.hypot(p[0] - g[0], p[1] - g[1]) >= opt.GEL_PATCH_MIN_SPACING for g in gels):
            gels.append(p)
    cells = [(seat[0], seat[1], PROTOCELL_RADIUS, CYAN, 0), (seat[0] + 330, seat[1] + 290, CELL_RADIUS_SCALE * math.sqrt(40), CORAL, 1)]

    def accepted(x, y):
        if math.hypot(x, y) > opt.DISH_RADIUS - FOOD_EDGE_MARGIN:
            return False
        return all(math.hypot(x - cx, y - cy) > cr for cx, cy, cr, _, _ in cells)

    event_weights = {'algae': FOOD_KIND_WEIGHTS['algae'], 'bacterium': FOOD_KIND_WEIGHTS['bacterium'] / BACTERIUM_CLUSTER_SIZE}
    algae, bacteria = [], []
    while len(algae) + len(bacteria) < opt.food_cap:
        kind = weighted(rng, event_weights)
        if kind == 'algae':
            x, y = point_in_zone(rng, opt, gels, weighted(rng, opt.algae_zone_weights))
            if accepted(x, y):
                algae.append((x, y))
        else:
            zone = weighted(rng, opt.bacterium_zone_weights)
            x, y = point_in_zone(rng, opt, gels, zone)
            variant = weighted(rng, BACTERIUM_VARIANT_WEIGHTS_BY_ZONE[zone])
            room = opt.food_cap - len(algae) - len(bacteria)
            for _ in range(min(BACTERIUM_CLUSTER_SIZE, room)):
                for _attempt in range(10):
                    rr, th = BACTERIUM_CLUSTER_RADIUS * math.sqrt(rng.random()), rng.uniform(0, 2 * math.pi)
                    bx, by = x + rr * math.cos(th), y + rr * math.sin(th)
                    if accepted(bx, by):
                        bacteria.append((bx, by, variant, rng.uniform(0, 360)))
                        break
    fragments = []
    while len(fragments) < opt.dna_cap:
        zone = weighted(rng, opt.dna_zone_weights)
        x, y = point_in_zone(rng, opt, gels, zone)
        if accepted(x, y):
            fragments.append((x, y, weighted(rng, DNA_FRAGMENT_TAG_TABLE_BY_ZONE[zone])))
    return World(opt, seat, gels, algae, bacteria, fragments, cells)


def in_view(world, x, y, half_w, half_h, margin=0):
    return abs(x - world.seat[0]) <= half_w + margin and abs(y - world.seat[1]) <= half_h + margin


def count_view(world, half_w, half_h):
    a = sum(in_view(world, x, y, half_w, half_h) for x, y in world.algae)
    b = sum(in_view(world, x, y, half_w, half_h) for x, y, _, _ in world.bacteria)
    f = sum(in_view(world, x, y, half_w, half_h) for x, y, _ in world.fragments)
    return a, b, f


# ---------------------------------------------------------------- SVG: defs
def defs(opt):
    emit('<defs>')
    emit(f'<radialGradient id="bg-field" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>')
    emit(f'<radialGradient id="light-pool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{LIGHT_ACCENT}" stop-opacity="0.09"/>'
         f'<stop offset="0.5" stop-color="{LIGHT_ACCENT}" stop-opacity="0.03"/><stop offset="1" stop-color="{LIGHT_ACCENT}" stop-opacity="0"/></radialGradient>')
    emit(f'<linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{LIGHT_ACCENT}" stop-opacity="0.07"/><stop offset="0.55" stop-color="{LIGHT_ACCENT}" stop-opacity="0"/></linearGradient>')
    emit('<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>')
    for s in (1.5, 3, 6, 10, 16, 26, 40):
        emit(f'<filter id="blur-{str(s).replace(".", "_")}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{s}"/></filter>')
    # zone clouds (sheet 02: fractal noise 0.003-0.004, three octaves, tinted)
    emit('<filter id="cloud-green" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="3" seed="3" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.55  0 0 0 0 1  0 0 0 0 0.69  0 0 0 1.6 -0.6"/></filter>')
    emit('<filter id="cloud-orange" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="9" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.72  0 0 0 0 0.4  0 0 0 1.6 -0.62"/></filter>')
    emit('<filter id="cloud-violet" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.003" numOctaves="3" seed="21" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.69  0 0 0 0 0.44  0 0 0 0 1  0 0 0 1.6 -0.6"/></filter>')
    # option C: a finer, denser second cloud so the zones carry texture, not just tint
    emit('<filter id="cloud-green-fine" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.72  0 0 0 0 1  0 0 0 0 0.8  0 0 0 1.4 -0.7"/></filter>')
    emit('<filter id="cloud-violet-fine" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="23" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.75  0 0 0 0 0.5  0 0 0 0 1  0 0 0 1.4 -0.7"/></filter>')
    # cytoplasm texture at 1 px / wu (sheet 02)
    emit('<filter id="cyto-noise" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.18" numOctaves="3" seed="11" result="n"/>'
         '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.93  0 0 0 0 1  1.6 0 0 0 -0.62"/></filter>')
    # motes (sheet 02 symbols)
    emit(f'<radialGradient id="halo-algal"><stop offset="0" stop-color="{FOOD_MOTE}" stop-opacity="0.22"/><stop offset="0.45" stop-color="{FOOD_MOTE}" stop-opacity="0.08"/><stop offset="1" stop-color="{FOOD_MOTE}" stop-opacity="0"/></radialGradient>')
    emit(f'<radialGradient id="mote-algal-g" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="{WHITE}"/><stop offset="0.35" stop-color="{FOOD_MOTE}"/><stop offset="1" stop-color="{FOOD_MOTE_EDGE}"/></radialGradient>')
    emit(f'<g id="mote-algal"><circle r="12" fill="url(#halo-algal)"/><circle r="6.5" fill="{FOOD_MOTE}" opacity="0.3" filter="url(#blur-3)"/>'
         f'<circle r="4" fill="url(#mote-algal-g)"/><circle r="4" fill="none" stroke="{FOOD_MOTE_RIM}" stroke-width="0.5" opacity="0.6"/>'
         f'<circle cx="-1.4" cy="-1.4" r="1.1" fill="{WHITE}" opacity="0.9"/></g>')
    # bacterium rods (VISUAL-STYLE section 2: 16 x 8 wu, inscribed in the r 8 collision circle)
    emit(f'<g id="bact-plain"><rect x="-8" y="-4" width="16" height="8" rx="4" fill="{BACTERIUM_PLAIN}" opacity="0.55"/>'
         f'<rect x="-8" y="-4" width="16" height="8" rx="4" fill="none" stroke="{PROTO_FILM}" stroke-width="0.9" opacity="0.9"/>'
         f'<ellipse cx="-3.5" cy="-2" rx="2.2" ry="0.8" fill="{WHITE}" opacity="0.6"/></g>')
    emit(f'<g id="bact-aerobic"><ellipse rx="11" ry="7" fill="{MITO_BASE}" opacity="0.3" filter="url(#blur-3)"/>'
         f'<rect x="-8" y="-4" width="16" height="8" rx="4" fill="{MITO_BASE}" opacity="0.9"/>'
         f'<rect x="-8" y="-4" width="16" height="8" rx="4" fill="none" stroke="{MITO_LIGHT}" stroke-width="1" opacity="0.95"/>'
         f'<ellipse cx="-3.5" cy="-2" rx="2.2" ry="0.8" fill="{WHITE}" opacity="0.6"/></g>')
    emit(f'<g id="bact-photo"><ellipse rx="11" ry="7" fill="{CHLORO_LIGHT}" opacity="0.3" filter="url(#blur-3)"/>'
         f'<rect x="-8" y="-4" width="16" height="8" rx="4" fill="{CHLORO_BASE}" opacity="0.9"/>'
         f'<path d="M-4 -3.2 v6.4 M0 -4 v8 M4 -3.2 v6.4" stroke="{CHLORO_DARK}" stroke-width="1" opacity="0.9"/>'
         f'<rect x="-8" y="-4" width="16" height="8" rx="4" fill="none" stroke="{CHLORO_LIGHT}" stroke-width="1" opacity="0.95"/>'
         f'<ellipse cx="-3.5" cy="-2" rx="2.2" ry="0.8" fill="{WHITE}" opacity="0.55"/></g>')
    # DNA fragment (sheet 02 helix; rungs and wide halo take the tag colour, VISUAL-STYLE section 2)
    for tag, col in DNA_TAG_COLOR.items():
        emit(f'<g id="dna-{tag}"><ellipse rx="16" ry="9" fill="{col}" opacity="0.2" filter="url(#blur-6)"/>'
             f'<ellipse rx="12" ry="5.5" fill="{DNA}" opacity="0.3" filter="url(#blur-3)"/>'
             f'<path d="M-9.5 -2.9 v5.8 M-6.5 -3.5 v7 M-0.5 -2.6 v5.2 M2.5 -3.5 v7 M7.5 -3.3 v6.6 M10 -1.6 v3.2" stroke="{col}" stroke-width="1" opacity="0.85"/>'
             f'<path d="M-11 0 C-9 -4.5 -5 -4.5 -3 0 C-1 4.5 3 4.5 5 0 C7 -4.5 10 -4.5 11 0" fill="none" stroke="{DNA_STRAND_LIGHT}" stroke-width="1.3" stroke-linecap="round"/>'
             f'<path d="M-11 0 C-9 4.5 -5 4.5 -3 0 C-1 -4.5 3 -4.5 5 0 C7 4.5 10 4.5 11 0" fill="none" stroke="{DNA_STRAND}" stroke-width="1.3" stroke-linecap="round"/>'
             f'<circle cx="-6.7" cy="-3.3" r="1" fill="{WHITE}" opacity="0.9"/><circle cx="4.6" cy="3.2" r="0.8" fill="{WHITE}" opacity="0.7"/></g>')
    # bubble against the glass (sheet 02, unit radius)
    emit(f'<radialGradient id="bubble-g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{BG_FIELD}" stop-opacity="0.15"/><stop offset="0.7" stop-color="#3d7fc4" stop-opacity="0.12"/><stop offset="1" stop-color="{CYAN[1]}" stop-opacity="0.55"/></radialGradient>')
    emit(f'<g id="bubble"><circle r="1.35" fill="{CYAN[1]}" opacity="0.16" filter="url(#blur-1_5)"/><circle r="1" fill="url(#bubble-g)"/>'
         f'<circle r="1" fill="none" stroke="{DEPTH_NEAR}" stroke-width="0.14" opacity="0.75"/><circle r="0.72" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="0.08" opacity="0.5"/>'
         f'<ellipse cx="-0.38" cy="-0.42" rx="0.26" ry="0.13" transform="rotate(-40 -0.38 -0.42)" fill="{WHITE}" opacity="0.85"/></g>')
    # cells (sheet 01 / 04 gradients)
    for name, p in (('cyan', CYAN), ('coral', CORAL)):
        base, rim, nuc, edge, cl, cd, nd = p
        emit(f'<radialGradient id="body-{name}" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{cl}" stop-opacity="0.42"/><stop offset="0.55" stop-color="{cd}" stop-opacity="0.55"/>'
             f'<stop offset="0.86" stop-color="{base}" stop-opacity="0.55"/><stop offset="1" stop-color="{rim}" stop-opacity="0.85"/></radialGradient>')
        emit(f'<linearGradient id="rim-{name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{WHITE}" stop-opacity="0.95"/><stop offset="0.18" stop-color="{rim}" stop-opacity="0.95"/>'
             f'<stop offset="0.55" stop-color="{base}" stop-opacity="0.55"/><stop offset="1" stop-color="{rim}" stop-opacity="0.55"/></linearGradient>')
        emit(f'<radialGradient id="nuc-{name}" cx="0.38" cy="0.34" r="0.7"><stop offset="0" stop-color="{rim}" stop-opacity="0.95"/><stop offset="0.5" stop-color="{nuc}" stop-opacity="0.9"/><stop offset="1" stop-color="{nd}" stop-opacity="0.95"/></radialGradient>')
    emit(f'<radialGradient id="body-proto" cx="0.42" cy="0.38" r="0.68"><stop offset="0" stop-color="{CYAN[4]}" stop-opacity="0.16"/><stop offset="0.6" stop-color="{CYAN[5]}" stop-opacity="0.26"/>'
         f'<stop offset="0.9" stop-color="{CYAN[0]}" stop-opacity="0.3"/><stop offset="1" stop-color="{CYAN[1]}" stop-opacity="0.55"/></radialGradient>')
    emit(f'<linearGradient id="rim-proto" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{WHITE}" stop-opacity="0.9"/><stop offset="0.2" stop-color="{PROTO_FILM_LIGHT}" stop-opacity="0.85"/>'
         f'<stop offset="0.55" stop-color="{PROTO_FILM}" stop-opacity="0.45"/><stop offset="1" stop-color="{PROTO_FILM_LIGHT}" stop-opacity="0.5"/></linearGradient>')
    emit(f'<radialGradient id="lipid-g" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="{LIPID_LIGHT}"/><stop offset="1" stop-color="{LIPID_BASE}"/></radialGradient>')
    emit(f'<linearGradient id="panel-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{PANEL_TOP}" stop-opacity="0.9"/><stop offset="1" stop-color="{PANEL_BOTTOM}" stop-opacity="0.9"/></linearGradient>')
    emit(f'<radialGradient id="inset-dish-bg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#0d2140"/><stop offset="0.7" stop-color="#081630"/><stop offset="1" stop-color="#040a18"/></radialGradient>')
    emit('</defs>')


# ---------------------------------------------------------------- SVG: the play-scale view
def to_screen(world, x, y):
    return CX + (x - world.seat[0]), CY + (y - world.seat[1])


def zones_play(world):
    opt = world.opt
    dcx, dcy = to_screen(world, 0, 0)
    strong = opt.zone_style == 'strong'
    R, inner = opt.DISH_RADIUS, opt.shallows_inner
    peak = 0.30 if strong else 0.16
    feather = 220 if strong else 300
    emit('<g id="zones">')
    # sunlit shallows: annulus, tint ramps up from the inner edge over the feather and holds to the wall
    gid = uid('shallows-g')
    emit(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R}">'
         f'<stop offset="{(inner - 60) / R:.4f}" stop-color="{ZONE_SHALLOWS}" stop-opacity="0"/>'
         f'<stop offset="{(inner + feather) / R:.4f}" stop-color="{ZONE_SHALLOWS}" stop-opacity="{peak}"/>'
         f'<stop offset="1" stop-color="{ZONE_SHALLOWS}" stop-opacity="{peak * 0.8:.3f}"/></radialGradient>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R}" fill="url(#{gid})"/>')
    mid = uid('shallows-m')
    emit(f'<mask id="{mid}"><radialGradient id="{mid}g" gradientUnits="userSpaceOnUse" cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R}">'
         f'<stop offset="{(inner - 120) / R:.4f}" stop-color="#000"/><stop offset="{(inner + 120) / R:.4f}" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></radialGradient>'
         f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R}" fill="url(#{mid}g)"/></mask>')
    emit(f'<g mask="url(#{mid})"><rect x="0" y="0" width="{W}" height="{H}" filter="url(#cloud-green)" opacity="{0.7 if strong else 0.4}"/>')
    if strong:
        emit(f'<rect x="0" y="0" width="{W}" height="{H}" filter="url(#cloud-green-fine)" opacity="0.35"/>')
        # light shafts: the condenser reaches the shallows, drawn as soft diagonal bands from the top-left
        for i, (x0, wdt, op) in enumerate(((-260, 90, 0.10), (-80, 60, 0.07), (120, 120, 0.06))):
            emit(f'<polygon points="{x0},0 {x0 + wdt},0 {x0 + wdt + 520},{H} {x0 + 520},{H}" fill="{ZONE_SHALLOWS}" opacity="{op}" filter="url(#blur-26)"/>')
    emit('</g>')
    if strong:
        # a lit inner edge: the shallows' boundary is a soft bright band the player can see from the broth
        emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{inner + 40}" fill="none" stroke="{ZONE_SHALLOWS}" stroke-width="80" opacity="0.10" filter="url(#blur-26)"/>')
        emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{inner}" fill="none" stroke="{ZONE_SHALLOWS}" stroke-width="1" opacity="0.12" stroke-dasharray="10 26"/>')
    # gel patches
    for gx, gy in world.gels:
        sx, sy = to_screen(world, gx, gy)
        gr = opt.GEL_PATCH_RADIUS
        if abs(sx - CX) > CX + gr or abs(sy - CY) > CY + gr:
            continue
        gid = uid('gel-g')
        a = 0.30 if strong else 0.14
        emit(f'<radialGradient id="{gid}"><stop offset="0" stop-color="{ZONE_GEL}" stop-opacity="{a}"/><stop offset="0.55" stop-color="{ZONE_GEL}" stop-opacity="{a * 0.45:.3f}"/><stop offset="1" stop-color="{ZONE_GEL}" stop-opacity="0"/></radialGradient>')
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{gr}" fill="url(#{gid})"/>')
        mid = uid('gel-m')
        emit(f'<mask id="{mid}"><radialGradient id="{mid}g"><stop offset="0" stop-color="#fff"/><stop offset="{0.72 if strong else 0.45}" stop-color="#fff" stop-opacity="0.8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
             f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{gr}" fill="url(#{mid}g)"/></mask>')
        emit(f'<g mask="url(#{mid})"><rect x="{sx - gr:.0f}" y="{sy - gr:.0f}" width="{2 * gr}" height="{2 * gr}" filter="url(#cloud-violet)" opacity="{0.7 if strong else 0.4}"/>')
        if strong:
            emit(f'<rect x="{sx - gr:.0f}" y="{sy - gr:.0f}" width="{2 * gr}" height="{2 * gr}" filter="url(#cloud-violet-fine)" opacity="0.4"/>')
        emit('</g>')
        if strong:
            emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{gr - 12}" fill="none" stroke="{ZONE_GEL}" stroke-width="24" opacity="0.12" filter="url(#blur-16)"/>')
        # mire strands (sheet 02: quadratic curves at 10-26 %; option C doubles the count and lifts them to 22-42 %)
        rng = random.Random(int(gx) * 7 + int(gy))
        n = 26 if strong else 12
        emit(f'<g fill="none" stroke="{ZONE_GEL}" stroke-linecap="round">')
        for _ in range(n):
            th, rr = rng.uniform(0, 2 * math.pi), gr * math.sqrt(rng.uniform(0.05, 0.9))
            x0, y0 = sx + rr * math.cos(th), sy + rr * math.sin(th)
            ln, ang = rng.uniform(60, 150), rng.uniform(0, 2 * math.pi)
            x1, y1 = x0 + ln * math.cos(ang), y0 + ln * math.sin(ang)
            bend = rng.uniform(-45, 45)
            qx, qy = (x0 + x1) / 2 - bend * math.sin(ang), (y0 + y1) / 2 + bend * math.cos(ang)
            lo, hi = (0.22, 0.42) if strong else (0.10, 0.26)
            emit(f'<path d="M{x0:.1f} {y0:.1f} Q{qx:.1f} {qy:.1f} {x1:.1f} {y1:.1f}" stroke-width="{rng.uniform(0.9, 2.1):.1f}" opacity="{rng.uniform(lo, hi):.2f}"/>')
        emit('</g>')
    emit('</g>')


def depth_particles(rng, layer):
    if layer == 'far':
        emit('<g id="depth-far">')
        for _ in range(260):
            emit(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(0.5, 1.3):.1f}" fill="{rng.choice(DEPTH_FAR)}" opacity="{rng.uniform(0.08, 0.28):.2f}"/>')
        emit('</g>')
    else:
        emit('<g id="depth-bokeh" filter="url(#blur-6)">')
        for _ in range(12):
            x, y, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(6, 14)
            col = rng.choice((DEPTH_NEAR, ZONE_SHALLOWS, ZONE_GEL))
            emit(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" opacity="{rng.uniform(0.05, 0.11):.2f}"/>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="none" stroke="{col}" stroke-width="1.5" opacity="{rng.uniform(0.08, 0.16):.2f}"/>')
        emit('</g><g id="depth-near" filter="url(#blur-3)">')
        for _ in range(46):
            emit(f'<circle cx="{rng.uniform(0, W):.1f}" cy="{rng.uniform(0, H):.1f}" r="{rng.uniform(2.2, 4.4):.1f}" fill="{DEPTH_NEAR}" opacity="{rng.uniform(0.05, 0.13):.2f}"/>')
        emit('</g>')


def motes_play(world, rng):
    emit('<g id="motes-algal">')
    for x, y in world.algae:
        if in_view(world, x, y, CX, CY, 20):
            sx, sy = to_screen(world, x, y)
            emit(f'<use href="#mote-algal" transform="translate({sx:.1f} {sy:.1f}) rotate({rng.randrange(360)}) scale({rng.uniform(0.85, 1.3):.2f})" opacity="{rng.uniform(0.8, 1):.2f}"/>')
    emit('</g><g id="motes-bacteria">')
    sym = {'plain': 'bact-plain', 'aerobic': 'bact-aerobic', 'photosynthetic': 'bact-photo'}
    for x, y, variant, heading in world.bacteria:
        if in_view(world, x, y, CX, CY, 20):
            sx, sy = to_screen(world, x, y)
            emit(f'<use href="#{sym[variant]}" transform="translate({sx:.1f} {sy:.1f}) rotate({heading:.0f})"/>')
    emit('</g><g id="dna-fragments">')
    for x, y, tag in world.fragments:
        if in_view(world, x, y, CX, CY, 30):
            sx, sy = to_screen(world, x, y)
            emit(f'<use href="#dna-{tag}" transform="translate({sx:.1f} {sy:.1f}) rotate({rng.randrange(360)}) scale({rng.uniform(0.9, 1.2):.2f})"/>')
    emit('</g>')


def clip_for(d):
    cid = uid('clip')
    emit(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
    return cid


def seat_mark(cx, cy, r, rim, index):
    """VISUAL-STYLE section 2: index + 1 beads on the outline at 1.0 r, first at -135 deg; 5 % r with a 2 px floor."""
    n, br = index + 1, max(2.0, 0.05 * r)
    for i in range(n):
        a = math.radians(-135 + 360 * i / n)
        bx, by = cx + r * math.cos(a), cy + r * math.sin(a)
        emit(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{2.2 * br:.1f}" fill="{rim}" opacity="0.45"/><circle cx="{bx:.1f}" cy="{by:.1f}" r="{br:.1f}" fill="{WHITE}" opacity="0.92"/>')


def self_ring(cx, cy, r):
    emit(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{max(7.5, 1.12 * r):.1f}" fill="none" stroke="{WHITE}" stroke-width="1.5" opacity="0.7" stroke-dasharray="6 4"/>')


def protocell(cx, cy, r, rng):
    """Sheet 04 protocell: halo, faint body, granules, double film, outline, glint; VISUAL-STYLE seat mark + self ring."""
    fn = membrane_fn(rng, 3, wobble=0.06)
    d = smooth_closed(polar_points(cx, cy, r, fn, 36))
    cid = clip_for(d)
    emit(f'<path d="{d}" fill="{PROTO_FILM_LIGHT}" opacity="0.22" filter="url(#{blur_id(0.12 * r)})" transform="translate({cx:.1f} {cy:.1f}) scale(1.2) translate({-cx:.1f} {-cy:.1f})"/>')
    emit(f'<path d="{d}" fill="url(#body-proto)"/>')
    s = 1.7 * r
    emit(f'<g clip-path="url(#{cid})"><rect x="{cx - s:.1f}" y="{cy - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" filter="url(#cyto-noise)" opacity="0.12"/>'
         f'<ellipse cx="{cx - 0.4 * r:.1f}" cy="{cy - 0.45 * r:.1f}" rx="{0.5 * r:.1f}" ry="{0.4 * r:.1f}" fill="{CYAN[1]}" opacity="0.1" filter="url(#blur-3)"/></g>')
    for _ in range(5):
        th, rr = rng.uniform(0, 2 * math.pi), r * math.sqrt(rng.uniform(0.05, 0.6))
        gx, gy, gr = cx + rr * math.cos(th), cy + rr * math.sin(th), r * rng.uniform(0.045, 0.06)
        lipid = rng.random() < 0.4
        emit(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{gr * 1.3:.1f}" fill="{LIPID_BASE if lipid else PROTO_GRANULE}" opacity="0.35" filter="url(#blur-1_5)"/>'
             f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{gr:.1f}" fill="{"url(#lipid-g)" if lipid else PROTO_GRANULE}" opacity="0.85"/>')
    emit(f'<path d="{d}" fill="none" stroke="{PROTO_FILM}" stroke-width="{0.08 * r:.1f}" opacity="0.25" filter="url(#blur-1_5)"/>')
    emit(f'<path d="{d}" fill="none" stroke="url(#rim-proto)" stroke-width="1.2"/>')
    emit(f'<path d="{d}" fill="none" stroke="{PROTO_FILM}" stroke-width="1" opacity="0.6" transform="translate({cx:.1f} {cy:.1f}) scale(0.955) translate({-cx:.1f} {-cy:.1f})"/>')
    emit(f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="0.8" opacity="0.4"/>')
    emit(f'<ellipse cx="{cx - 0.55 * r:.1f}" cy="{cy - 0.6 * r:.1f}" rx="{0.2 * r:.1f}" ry="{0.07 * r:.1f}" transform="rotate(-35 {cx - 0.55 * r:.1f} {cy - 0.6 * r:.1f})" fill="{WHITE}" opacity="0.5" filter="url(#blur-1_5)"/>')
    seat_mark(cx, cy, r, CYAN[1], 0)
    self_ring(cx, cy, r)


def prokaryote(cx, cy, r, palette, name, index, rng):
    """A rival at the prokaryote stage (sheet 01 stack, VISUAL-STYLE section 3): nucleoid loop, ribosomes, flagellum."""
    base, rim, nuc, edge, cl, cd, nd = palette
    heading = rng.uniform(0, 2 * math.pi)
    fn0 = membrane_fn(rng, 3)
    fn = lambda th: fn0(th) * (1 + 0.1 * math.cos(th - heading))  # a mild stretch along the heading
    d = smooth_closed(polar_points(cx, cy, r, fn, 36))
    cid = clip_for(d)
    emit(f'<path d="{d}" fill="{rim}" opacity="0.3" filter="url(#{blur_id(0.12 * r)})" transform="translate({cx:.1f} {cy:.1f}) scale(1.28) translate({-cx:.1f} {-cy:.1f})"/>')
    tail = 2 * r
    pts = []
    for i in range(20):
        t = i / 19
        s = t * tail
        off = 0.09 * tail * math.sin(t * 2 * 2 * math.pi) * (0.35 + 0.65 * t)
        a = heading + math.pi
        pts.append((cx + (r * 0.95 + s) * math.cos(a) - off * math.sin(a), cy + (r * 0.95 + s) * math.sin(a) + off * math.cos(a)))
    fd = smooth_open(pts)
    emit(f'<path d="{fd}" fill="none" stroke="{rim}" stroke-width="3" opacity="0.28" filter="url(#blur-3)" stroke-linecap="round"/>'
         f'<path d="{fd}" fill="none" stroke="{rim}" stroke-width="1.2" opacity="0.9" stroke-linecap="round"/>')
    emit(f'<path d="{d}" fill="url(#body-{name})"/>')
    s = 1.7 * r
    emit(f'<g clip-path="url(#{cid})"><rect x="{cx - s:.1f}" y="{cy - s:.1f}" width="{2 * s:.1f}" height="{2 * s:.1f}" filter="url(#cyto-noise)" opacity="0.22"/>'
         f'<ellipse cx="{cx + 0.35 * r:.1f}" cy="{cy + 0.4 * r:.1f}" rx="{0.7 * r:.1f}" ry="{0.55 * r:.1f}" fill="{OUTLINE}" opacity="0.28" filter="url(#blur-6)"/>'
         f'<ellipse cx="{cx - 0.4 * r:.1f}" cy="{cy - 0.45 * r:.1f}" rx="{0.5 * r:.1f}" ry="{0.4 * r:.1f}" fill="{rim}" opacity="0.14" filter="url(#blur-6)"/>')
    for _ in range(int(6 + r / 6)):
        th, rr = rng.uniform(0, 2 * math.pi), r * math.sqrt(rng.uniform(0.55, 0.9))
        emit(f'<circle cx="{cx + rr * math.cos(th):.1f}" cy="{cy + rr * math.sin(th):.1f}" r="{rng.uniform(1.2, 2.2) * r / 32:.1f}" fill="{rim}" opacity="{rng.uniform(0.35, 0.8):.2f}"/>')
    emit(f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="{0.22 * r:.1f}" opacity="0.55"/></g>')
    # nucleoid: a loose loop, no envelope
    nr = 0.34 * r
    nx, ny = cx - 0.2 * r * math.cos(heading), cy - 0.2 * r * math.sin(heading)
    loop = smooth_closed(polar_points(nx, ny, nr, lambda th: 1 + 0.18 * math.cos(3 * th + 0.4) + 0.1 * math.cos(5 * th + 1.7), 24, 0.3))
    emit(f'<path d="{loop}" fill="none" stroke="{NUCLEOID_GLOW}" stroke-width="{0.12 * nr:.1f}" opacity="0.35" filter="url(#blur-1_5)"/>'
         f'<path d="{loop}" fill="none" stroke="{NUCLEOID_STRAND}" stroke-width="1.2" opacity="0.92" stroke-dasharray="{0.16 * nr:.1f} {0.04 * nr:.1f}"/>')
    emit(f'<path d="{d}" fill="none" stroke="{base}" stroke-width="{0.1 * r:.1f}" opacity="0.35" filter="url(#blur-1_5)"/>')
    emit(f'<path d="{d}" fill="none" stroke="url(#rim-{name})" stroke-width="{max(1.2, 0.05 * r):.1f}"/>')
    emit(f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="{max(0.8, 0.012 * r):.1f}" opacity="0.5"/>')
    emit(f'<ellipse cx="{cx - 0.55 * r:.1f}" cy="{cy - 0.6 * r:.1f}" rx="{0.22 * r:.1f}" ry="{0.08 * r:.1f}" transform="rotate(-35 {cx - 0.55 * r:.1f} {cy - 0.6 * r:.1f})" fill="{WHITE}" opacity="0.5" filter="url(#blur-1_5)"/>')
    seat_mark(cx, cy, r, rim, index)


def cells_play(world, rng):
    emit('<g id="cells">')
    for x, y, r, palette, index in world.cells:
        sx, sy = to_screen(world, x, y)
        if index == 0:
            protocell(sx, sy, r, rng)
        else:
            prokaryote(sx, sy, r, palette, 'coral', index, rng)
    emit('</g>')


def wall_play(world, rng):
    opt = world.opt
    dcx, dcy = to_screen(world, 0, 0)
    R = opt.DISH_RADIUS
    emit('<g id="dish-wall">')
    emit(f'<path d="M0 0 H{W} V{H} H0 Z M{dcx + R:.0f} {dcy:.0f} A{R} {R} 0 1 0 {dcx - R:.0f} {dcy:.0f} A{R} {R} 0 1 0 {dcx + R:.0f} {dcy:.0f} Z" fill="{WALL_OUTSIDE}" fill-rule="evenodd" opacity="0.92"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R - 14}" fill="none" stroke="#000000" stroke-width="26" opacity="0.35" filter="url(#blur-10)"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 17}" fill="none" stroke="{WALL_BAND}" stroke-width="34"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 6}" fill="none" stroke="{WALL_INNER}" stroke-width="12" opacity="0.85"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 34}" fill="none" stroke="{WALL_OUTER}" stroke-width="1.4" opacity="0.6"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 2}" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="9" opacity="0.28" filter="url(#blur-6)"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 1}" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="2.5" opacity="0.55"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R}" fill="none" stroke="{WHITE}" stroke-width="1" opacity="0.7"/>')
    circ = 2 * math.pi * (R + 1)
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 1}" fill="none" stroke="{WHITE}" stroke-width="2.2" opacity="0.9" stroke-dasharray="220 {circ - 220:.0f}" stroke-linecap="round" filter="url(#blur-1_5)" transform="rotate(184 {dcx:.0f} {dcy:.0f})"/>')
    emit(f'<circle cx="{dcx:.0f}" cy="{dcy:.0f}" r="{R + 20}" fill="none" stroke="{CYAN[1]}" stroke-width="6" opacity="0.18" stroke-dasharray="160 {circ - 160:.0f}" stroke-linecap="round" filter="url(#blur-6)" transform="rotate(184.5 {dcx:.0f} {dcy:.0f})"/>')
    emit(f'<g fill="none" stroke="{WALL_SCRATCH}" stroke-linecap="round"><path d="M40 120 l-30 190" stroke-width="0.8" opacity="0.35"/><path d="M30 640 l-20 120" stroke-width="0.6" opacity="0.3"/><path d="M60 420 l10 60" stroke-width="0.6" opacity="0.25"/></g>')
    emit(f'<ellipse cx="-200" cy="{CY}" rx="400" ry="700" fill="{BG_FIELD}" opacity="0.5" filter="url(#blur-40)"/>')
    emit('</g><g id="edge-bubbles">')
    for _ in range(6):
        a = math.radians(rng.uniform(172, 188))
        rr = R - rng.uniform(14, 70)
        emit(f'<use href="#bubble" transform="translate({dcx + rr * math.cos(a):.1f} {dcy + rr * math.sin(a):.1f}) scale({rng.uniform(5, 16):.1f})"/>')
    emit('</g>')


# ---------------------------------------------------------------- SVG: annotations
def text(x, y, s, size=11, fill=MUTED, weight=400, anchor='start', mono=False):
    fam = f' font-family="{MONO}"' if mono else ''
    emit(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}"{fam}>{s}</text>')


def backing(x, y, w, h):
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{BG_DEEP}" opacity="0.66"/>')


def annotations(world, counts_full, counts_spawn):
    opt = world.opt
    # title block (top-left)
    backing(28, 22, 760, 128)
    text(44, 52, f'OPTION {opt.code} · {opt.name}', 24, TEXT, 700)
    text(44, 74, opt.subtitle, 12.5, ACCENT, 600)
    text(44, 96, f'camera zoom 1.0 · 1 px = 1 wu · protocell r {PROTOCELL_RADIUS:.1f} wu (mass {CELL_STARTING_MASS}) at spawn seat ({world.seat[0]:.0f}, {world.seat[1]:.0f}) · dish r {opt.DISH_RADIUS} wu · wall 900 wu to the left', 10.5, MUTED, mono=True)
    text(44, 112, f'DISH_RADIUS {opt.DISH_RADIUS} · SHALLOWS_WIDTH {opt.SHALLOWS_WIDTH} · VENT_RADIUS {opt.VENT_RADIUS} · GEL_PATCH {opt.GEL_PATCH_COUNT} × r {opt.GEL_PATCH_RADIUS}, spacing {opt.GEL_PATCH_MIN_SPACING}', 10.5, MUTED, mono=True)
    text(44, 128, f'FOOD_CAP {opt.FOOD_CAP_BASE}+{opt.FOOD_CAP_PER_PLAYER}/player · FOOD_SPAWN {opt.FOOD_SPAWN_PER_SECOND_BASE}+{opt.FOOD_SPAWN_PER_SECOND_PER_PLAYER}/s · DNA_CAP {opt.DNA_FRAGMENT_CAP_BASE}+{opt.DNA_FRAGMENT_CAP_PER_PLAYER} · DNA_SPAWN {opt.DNA_FRAGMENT_SPAWN_PER_SECOND_BASE}+{opt.DNA_FRAGMENT_SPAWN_PER_SECOND_PER_PLAYER}/s', 10.5, MUTED, mono=True)
    bw = opt.bacterium_zone_weights
    text(44, 144, f'bacterium zone weights vent {bw["warm_vent"]} / broth {bw["open_broth"]} / shallows {bw["sunlit_shallows"]} · zone tint peak {"30 %" if opt.zone_style == "strong" else "16 % (sheet 02)"}', 10.5, MUTED, mono=True)
    # counts block (top-right)
    backing(1440, 22, 452, 98)
    text(1456, 46, 'WHAT IS ON SCREEN', 12.5, ACCENT, 700)
    a, b, f = counts_full
    text(1456, 66, f'this frame, 1920 × 1080 wu: {a} algae · {b} bacteria · {f} DNA', 10.5, TEXT, mono=True)
    a, b, f = counts_spawn
    text(1456, 82, f'spawn camera, 1067 × 600 wu: {a} algae · {b} bacteria · {f} DNA', 10.5, TEXT, mono=True)
    text(1456, 98, f'whole dish at cap: {opt.food_cap} motes + {opt.dna_cap} fragments (1 player)', 10.5, MUTED, mono=True)
    text(1456, 112, 'steady state · ECOLOGY.md §3 spawn model · seed 96', 10.5, MUTED, mono=True)
    # spawn camera box
    hw, hh = 1067 / 2, 600 / 2
    emit(f'<rect x="{CX - hw:.0f}" y="{CY - hh:.0f}" width="1067" height="600" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="1" stroke-dasharray="6 5" opacity="0.5"/>')
    text(CX - hw + 8, CY - hh - 8, 'spawn camera · 1.8 px / wu · what a fresh protocell actually sees', 10.5, ACCENT, 600)
    # protocell callout
    sx, sy = to_screen(world, *world.seat)
    emit(f'<path d="M{sx + 30:.0f} {sy + 30:.0f} L{sx + 96:.0f} {sy + 70:.0f}" stroke="#4d6a80" stroke-width="1" fill="none"/>')
    backing(sx + 100, sy + 56, 236, 42)
    text(sx + 110, sy + 74, 'you · protocell · 17.9 px on screen', 12, TEXT, 600)
    text(sx + 110, sy + 90, 'self ring 1.12 r · 1 bead seat mark · double film', 10.5, MUTED, mono=True)
    # zone labels
    dcx, dcy = to_screen(world, 0, 0)
    ex = dcx - opt.shallows_inner  # inner edge on the y = CY line
    backing(ex - 30, 150, 300, 40)
    text(ex - 20, 168, 'SUNLIT SHALLOWS', 12.5, ACCENT, 700)
    text(ex - 20, 184, f'annulus {opt.shallows_inner}..{opt.DISH_RADIUS} wu · 70 % of algae spawn here', 10.5, MUTED, mono=True)
    gx, gy = to_screen(world, *world.gels[0])
    backing(gx - 125, gy + 4, 250, 40)
    text(gx - 115, gy + 22, 'VISCOUS GEL', 12.5, ACCENT, 700)
    text(gx - 115, gy + 38, f'disc r {opt.GEL_PATCH_RADIUS} wu · slows big cells', 10.5, MUTED, mono=True)
    text(16, H - 10, f'Evolution · qa/decisions/dish-play-scale/option-{opt.code.lower()}.svg · 1920 × 1080 · rsvg-convert', 10.2, MUTED, mono=True)


# ---------------------------------------------------------------- SVG: the zoom-0.36 inset (camera ceiling, CELL_MAX_MASS)
def inset(world, rng):
    opt = world.opt
    PW, PH = 560, 315
    PX, PY = W - PW - 24, H - PH - 24
    k = CEILING_ZOOM * PW / W  # px per wu inside the panel
    pcx, pcy = PX + PW / 2, PY + PH / 2

    def P(x, y):
        return pcx + (x - world.seat[0]) * k, pcy + (y - world.seat[1]) * k

    emit('<g id="inset">')
    emit(f'<rect x="{PX - 8}" y="{PY - 30}" width="{PW + 16}" height="{PH + 38}" rx="8" fill="{BG_DEEP}"/>')
    emit(f'<rect x="{PX - 8}" y="{PY - 30}" width="{PW + 16}" height="{PH + 38}" rx="8" fill="url(#panel-bg)" stroke="{PANEL_RIM}" stroke-width="1"/>')
    text(PX, PY - 12, 'SAME SEAT · ZOOM 0.36 · MASS CAP', 12.5, ACCENT, 700)
    text(PX + PW, PY - 12, f'r {MAX_MASS_RADIUS:.0f} wu → 102 px on screen · view 5333 × 3000 wu', 10.2, MUTED, anchor='end', mono=True)
    cid = uid('inset-clip')
    emit(f'<clipPath id="{cid}"><rect x="{PX}" y="{PY}" width="{PW}" height="{PH}"/></clipPath>')
    emit(f'<g clip-path="url(#{cid})">')
    emit(f'<rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" fill="{WALL_OUTSIDE}"/>')
    dcx, dcy = P(0, 0)
    R = opt.DISH_RADIUS * k
    emit(f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{R:.1f}" fill="url(#inset-dish-bg)"/>')
    # zones at twice the play-scale alpha, blurred (sheet 02 inset rule)
    strong = opt.zone_style == 'strong'
    a_sh, a_vent, a_gel = (0.5, 0.4, 0.5) if strong else (0.32, 0.26, 0.28)
    inner = opt.shallows_inner * k
    emit(f'<path d="M{dcx + R:.1f} {dcy:.1f} A{R:.1f} {R:.1f} 0 1 0 {dcx - R:.1f} {dcy:.1f} A{R:.1f} {R:.1f} 0 1 0 {dcx + R:.1f} {dcy:.1f} Z '
         f'M{dcx + inner:.1f} {dcy:.1f} A{inner:.1f} {inner:.1f} 0 1 0 {dcx - inner:.1f} {dcy:.1f} A{inner:.1f} {inner:.1f} 0 1 0 {dcx + inner:.1f} {dcy:.1f} Z" '
         f'fill="{ZONE_SHALLOWS}" fill-rule="evenodd" opacity="{a_sh}" filter="url(#blur-6)"/>')
    vr = opt.VENT_RADIUS * k
    emit(f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{vr:.1f}" fill="{ZONE_VENT}" opacity="{a_vent}" filter="url(#blur-6)"/>')
    emit(f'<ellipse cx="{dcx:.1f}" cy="{dcy:.1f}" rx="{vr * 0.35:.1f}" ry="{vr * 0.12:.1f}" transform="rotate(-18 {dcx:.1f} {dcy:.1f})" fill="{MITO_BASE}" opacity="0.7" filter="url(#blur-1_5)"/>')
    for gx, gy in world.gels:
        sx, sy = P(gx, gy)
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{opt.GEL_PATCH_RADIUS * k:.1f}" fill="{ZONE_GEL}" opacity="{a_gel}" filter="url(#blur-6)"/>')
    # motes at the 2 px core floor scaled into the panel (VISUAL-STYLE section 6: core >= 2 px, wide halo >= 6 px at zoom 0.36)
    core, halo = 2 * PW / W, 6 * PW / W
    emit(f'<g id="inset-algae">')
    for x, y in world.algae:
        sx, sy = P(x, y)
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{halo:.2f}" fill="{FOOD_MOTE}" opacity="0.16"/><circle cx="{sx:.1f}" cy="{sy:.1f}" r="{core:.2f}" fill="{FOOD_MOTE}" opacity="0.85"/>')
    emit('</g><g id="inset-bacteria">')
    col = {'plain': BACTERIUM_PLAIN, 'aerobic': MITO_BASE, 'photosynthetic': CHLORO_LIGHT}
    for x, y, variant, _ in world.bacteria:
        sx, sy = P(x, y)
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{halo:.2f}" fill="{col[variant]}" opacity="0.18"/><circle cx="{sx:.1f}" cy="{sy:.1f}" r="{core * 1.2:.2f}" fill="{col[variant]}" opacity="0.9"/>')
    emit('</g><g id="inset-dna">')
    for x, y, tag in world.fragments:
        sx, sy = P(x, y)
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{halo * 1.4:.2f}" fill="{DNA_TAG_COLOR[tag]}" opacity="0.25"/><circle cx="{sx:.1f}" cy="{sy:.1f}" r="{core * 1.3:.2f}" fill="{DNA_STRAND_LIGHT}" opacity="0.95"/>')
    emit('</g>')
    # other cells: far dots (rim colour, 3 px floor on screen), the rival grown to mass 400
    for x, y, r, palette, index in world.cells[1:]:
        sx, sy = P(x, y)
        rr = max(3 * PW / W, CELL_RADIUS_SCALE * math.sqrt(400) * k)
        emit(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{rr * 3:.1f}" fill="{palette[1]}" opacity="0.12" filter="url(#blur-1_5)"/>'
             f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{rr:.1f}" fill="{palette[5]}" stroke="{palette[1]}" stroke-width="0.8"/>')
    # you at CELL_MAX_MASS: mid-LOD stack (halo, flat body, rim, outline, nucleus disc, seat mark, self ring)
    sx, sy = P(*world.seat)
    pr = MAX_MASS_RADIUS * k
    fn = membrane_fn(rng, 3)
    d = smooth_closed(polar_points(sx, sy, pr, fn, 36))
    emit(f'<path d="{d}" fill="{CYAN[1]}" opacity="0.3" filter="url(#blur-3)" transform="translate({sx:.1f} {sy:.1f}) scale(1.28) translate({-sx:.1f} {-sy:.1f})"/>')
    emit(f'<path d="{d}" fill="url(#body-cyan)"/>')
    emit(f'<circle cx="{sx - 0.12 * pr:.1f}" cy="{sy - 0.12 * pr:.1f}" r="{0.3 * pr:.1f}" fill="url(#nuc-cyan)"/>')
    emit(f'<path d="{d}" fill="none" stroke="url(#rim-cyan)" stroke-width="{max(1.2, 0.05 * pr):.1f}"/><path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="0.8" opacity="0.5"/>')
    seat_mark(sx, sy, pr, CYAN[1], 0)
    self_ring(sx, sy, pr)
    # the play-scale frame above, to scale
    emit(f'<rect x="{pcx - W * k / 2:.1f}" y="{pcy - H * k / 2:.1f}" width="{W * k:.1f}" height="{H * k:.1f}" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.8"/>')
    # wall: 4 px band on screen, rim scatter, hairline
    emit(f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{R + 2:.1f}" fill="none" stroke="#1f3552" stroke-width="{4 * PW / W * 3:.1f}"/>')
    emit(f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{R:.1f}" fill="none" stroke="{LIGHT_ACCENT}" stroke-width="0.8" opacity="0.7"/>')
    emit(f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{R:.1f}" fill="none" stroke="{WHITE}" stroke-width="0.5" opacity="0.6"/>')
    emit('</g>')
    text(PX + 8, PY + PH - 8, 'dashed = the frame above · motes at the 2 px core floor · zones at 2× alpha', 10.2, MUTED, mono=True)
    emit('</g>')


# ---------------------------------------------------------------- assemble one option
def render(opt, out_dir):
    global OUT, _k
    OUT, _k = [], 0
    world = build_world(opt)
    rng = random.Random(opt.seed + 1)
    counts_full = count_view(world, CX, CY)
    counts_spawn = count_view(world, 1067 / 2, 300)
    emit(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{SANS}">')
    emit(f'<title>Evolution — dish at play scale, option {opt.code}: {opt.name.title()}</title>')
    emit(f'<desc>Decision mockup: {opt.subtitle}. 1920 x 1080 view at camera zoom 1.0 from the protocell spawn seat, built from ECOLOGY.md spawn model; inset at zoom 0.36. Code-drawn SVG, no raster content.</desc>')
    defs(opt)
    # 1. field + condenser light (sheet 02)
    emit(f'<rect width="{W}" height="{H}" fill="url(#bg-field)"/>')
    emit('<ellipse cx="380" cy="200" rx="980" ry="760" fill="url(#light-pool)"/><polygon points="0,0 1180,0 0,840" fill="url(#beam)"/>')
    emit(f'<g fill="none" stroke="{LIGHT_ACCENT}" opacity="0.05"><path d="M-40 620 C220 470 520 380 900 -40" stroke-width="3"/><path d="M-40 760 C260 590 620 470 1080 -40" stroke-width="2"/><path d="M120 1120 C420 840 760 640 1260 -40" stroke-width="1.5"/></g>')
    # 2-3. zones and their features
    zones_play(world)
    # 4. far depth, motes, fragments
    depth_particles(rng, 'far')
    motes_play(world, rng)
    # 5. cells
    cells_play(world, rng)
    # 6. near depth
    depth_particles(rng, 'near')
    # 7. wall + vignette
    wall_play(world, rng)
    emit(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    # 8. annotations + inset
    annotations(world, counts_full, counts_spawn)
    inset(world, rng)
    emit('</svg>')
    path = out_dir / f'option-{opt.code.lower()}.svg'
    path.write_text('\n'.join(OUT) + '\n')
    print(f'{path.name}: frame {counts_full} spawn-camera {counts_spawn} cap {opt.food_cap}+{opt.dna_cap} '
          f'gels {[(round(x), round(y)) for x, y in world.gels]}')


if __name__ == '__main__':
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    for o in OPTIONS:
        render(o, out)

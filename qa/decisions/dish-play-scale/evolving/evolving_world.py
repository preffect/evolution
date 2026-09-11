#!/usr/bin/env python3
"""Decision #141 follow-up (#147): the evolving world over a 10-minute round, 1600 x 680.

The world clock (ECOLOGY.md §3.1) is drawn as the world's average cell: its level (gold, dashed)
and its mass (cyan, dashed) with the wild-cell spread band. The player curve is decision #138
option A, computed by the same pace model that produced that ticket's mockups (`pace_model.py`,
copied verbatim from branch decisions/first-ten-minutes). The lunch / threat bands show where
that player can engulf every wild cell (mass ≥ ENGULF_MASS_RATIO × the top of the spread) and where
every wild cell can engulf it (mass ≤ the bottom of the spread / ENGULF_MASS_RATIO).

Usage: python3 evolving_world.py <out-dir>
"""
import sys

import pace_model as pm

# ---- palette (sheet 01 / 03 roles, as pace_model) ----
BG_DEEP, BG_FIELD = pm.BG_DEEP, pm.BG_FIELD
TEXT, MUTED, ACCENT = pm.TEXT, pm.MUTED, pm.ACCENT
DNA, GOLD, DANGER = pm.DNA, pm.GOLD, pm.DANGER
CYAN, CYAN_RIM = pm.CYAN, pm.CYAN_RIM
ALGAE, MITO = pm.ALGAE, pm.MITO
PANEL, PANEL_RIM = pm.PANEL, pm.PANEL_RIM
WILD = "#9fb3a6"  # wild cells: the field's own desaturated green-grey

W, H = 1600, 700
ROUND_S = pm.ROUND_S

# ---- the world clock (docs/ECOLOGY.md §3.1, constants/world-clock.ts) ----
WORLD_LEVEL_SECONDS = 180
WORLD_MASS_GAIN_PER_SECOND = 1.0
WILD_CELL_MASS_SPREAD = 0.3
WILD_CELL_COUNT = 24
ENGULF_MASS_RATIO = 1.25
ENTRY_MASS_FRACTION = 0.5  # PROGRESSION §6, decision #141 option B
ENTRY_MAX_MASS = 200
MAX_LEVEL = pm.MAX_LEVEL
STAGES = ["protocell", "prokaryote", "endosymbiosis", "eukaryote", "specialised"]
STAGE_COLOURS = [MUTED, CYAN_RIM, MITO, DNA, GOLD]


def world_level(t):
    return min(1 + t / WORLD_LEVEL_SECONDS, MAX_LEVEL)


def world_mass(t):
    return pm.CELL_STARTING_MASS + WORLD_MASS_GAIN_PER_SECOND * t


# stage of the world's own picks (ECOLOGY §3.1): build 0 picks nucleoid, endosymbiont, envelope, a form's
# prerequisite (still eukaryote), then the form; the index is by number of picks = floor(worldLevel) − 1
STAGE_INDEX_BY_PICKS = [0, 1, 2, 3, 3, 4]


def world_stage_index(t):
    return STAGE_INDEX_BY_PICKS[min(int(world_level(t)) - 1, len(STAGE_INDEX_BY_PICKS) - 1)]


# ---- layout ----
CHART_L, CHART_R, CHART_T, CHART_B = 90, 1250, 150, 470
LEVEL_MAX_AXIS = 6
MASS_MAX_AXIS = 1200


def x_of(t):
    return CHART_L + (CHART_R - CHART_L) * t / ROUND_S


def y_level(level):
    return CHART_B - (CHART_B - CHART_T) * (level - 1) / (LEVEL_MAX_AXIS - 1)


def y_mass(mass):
    return CHART_B - (CHART_B - CHART_T) * min(mass, MASS_MAX_AXIS) / MASS_MAX_AXIS


def text(*args, **kwargs):
    return pm.text(*args, **kwargs)


def render(sim):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    o.append('<defs>'
             f'<radialGradient id="bg" cx="0.3" cy="0.2" r="1.1"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>'
             '</defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    o.append(text(40, 44, "THE EVOLVING WORLD · one 10-minute round", 26, TEXT, weight="bold"))
    o.append(text(40, 68, "the dish starts at protocell scale and climbs the ladder on its own clock; the player's job is to stay ahead of it", 14, ACCENT))
    o.append(text(W - 40, 44, "EVOLUTION · decision #141 direction, designed in #147", 13, MUTED, anchor="end"))
    o.append(text(W - 40, 64, "player curve = decision #138 option A (pace model, ± 20 s); world = the world clock, exact", 11, MUTED, anchor="end"))

    # world stage lane
    lane_y = 100
    o.append(text(CHART_L - 8, lane_y + 4, "world stage", 11, MUTED, anchor="end"))
    for i, name in enumerate(STAGES):
        a = i * WORLD_LEVEL_SECONDS
        b = min((i + 1) * WORLD_LEVEL_SECONDS, ROUND_S)
        if a >= ROUND_S:
            continue
        o.append(f'<rect x="{x_of(a):.1f}" y="{lane_y - 9}" width="{x_of(b) - x_of(a):.1f}" height="18" rx="9" fill="{STAGE_COLOURS[i]}" opacity="0.28"/>')
        label = f"{name} · {pm.mmss(a)}–{pm.mmss(b)}" if x_of(b) - x_of(a) > 160 else name
        o.append(text((x_of(a) + x_of(b)) / 2, lane_y + 4, label, 11, STAGE_COLOURS[i], anchor="middle", weight="bold"))
    o.append(text(x_of(ROUND_S) + 8, lane_y + 4, "specialised at 15:00 (longer rounds only)", 10, MUTED))
    # what the stage drives, one line under the lane
    drives = [
        ("algae 0.75 · clusters plain in the broth · wild cells wander + flee", 0),
        ("algae 0.70 · broth clusters 20 % variant · wild cells grow a nucleoid", 180),
        ("algae 0.60 · 40 % variant · wild cells carry an endosymbiont and hunt", 360),
        ("algae 0.50 · 60 % variant · nucleus", 540),
    ]
    for label, a in drives:
        o.append(text(x_of(a) + 4, lane_y + 24, label, 9.5, MUTED))

    # grid + axes
    for minute in range(0, 11):
        x = x_of(minute * 60)
        o.append(f'<line x1="{x:.1f}" y1="{CHART_T}" x2="{x:.1f}" y2="{CHART_B}" stroke="{PANEL_RIM}" stroke-width="1"/>')
        o.append(text(x, CHART_B + 18, f"{minute}:00", 11, MUTED, anchor="middle"))
    for boundary in (180, 360, 540):
        x = x_of(boundary)
        o.append(f'<line x1="{x:.1f}" y1="{CHART_T - 6}" x2="{x:.1f}" y2="{CHART_B}" stroke="{ACCENT}" stroke-width="1" stroke-dasharray="2 4" opacity="0.7"/>')
        o.append(text(x + 4, CHART_T + 12, "world levels up", 9.5, ACCENT))
    x_bloom = x_of(pm.ROUND_BLOOM_START_FRACTION * ROUND_S)
    o.append(f'<rect x="{x_bloom:.1f}" y="{CHART_T}" width="{x_of(ROUND_S) - x_bloom:.1f}" height="{CHART_B - CHART_T}" fill="{DNA}" opacity="0.05"/>')
    o.append(text(x_bloom + 4, CHART_B - 6, "bloom", 10, DNA))
    o.append(text((CHART_L + CHART_R) / 2, CHART_B + 36, "round time (minutes)", 11, MUTED, anchor="middle"))
    for level in range(1, LEVEL_MAX_AXIS + 1):
        y = y_level(level)
        o.append(f'<line x1="{CHART_L - 4}" y1="{y:.1f}" x2="{CHART_L}" y2="{y:.1f}" stroke="{GOLD}"/>')
        o.append(text(CHART_L - 8, y + 4, str(level), 11, GOLD, anchor="end"))
    o.append(text(CHART_L - 8, CHART_T - 8, "level", 11, GOLD, anchor="end"))
    for m in (0, 300, 600, 900, 1200):
        y = y_mass(m)
        o.append(f'<line x1="{CHART_R}" y1="{y:.1f}" x2="{CHART_R + 4}" y2="{y:.1f}" stroke="{CYAN}"/>')
        o.append(text(CHART_R + 8, y + 4, str(m), 11, CYAN))
    o.append(text(CHART_R + 8, CHART_T - 8, "mass", 11, CYAN))

    # wild spread band (world mass × 0.7 .. 1.3)
    top = " ".join(f"{x_of(t):.1f},{y_mass(world_mass(t) * (1 + WILD_CELL_MASS_SPREAD)):.1f}" for t in range(0, ROUND_S + 1, 10))
    bottom = " ".join(f"{x_of(t):.1f},{y_mass(world_mass(t) * (1 - WILD_CELL_MASS_SPREAD)):.1f}" for t in range(ROUND_S, -1, -10))
    o.append(f'<polygon points="{top} {bottom}" fill="{WILD}" opacity="0.16"/>')
    # lunch / threat shares relative to the player: the wild spread is uniform on
    # [1 − spread, 1 + spread] × worldMass, so the share the player can engulf is the part of the
    # band below mass / ENGULF_MASS_RATIO and the share that can engulf it the part above
    # mass × ENGULF_MASS_RATIO.
    def clamp01(v):
        return max(0.0, min(1.0, v))

    band_y = CHART_B + 48
    band_h = 26
    o.append(text(CHART_L - 8, band_y + 10, "wild cells", 11, MUTED, anchor="end"))
    o.append(text(CHART_L - 8, band_y + 24, "you can eat", 9.5, ALGAE, anchor="end"))
    o.append(text(CHART_L - 8, band_y + 44, "that eat you", 9.5, DANGER, anchor="end"))
    for t in range(0, ROUND_S, 5):
        m = sim["masses"][t]
        w = world_mass(t)
        lunch = clamp01((m / ENGULF_MASS_RATIO / w - (1 - WILD_CELL_MASS_SPREAD)) / (2 * WILD_CELL_MASS_SPREAD))
        threat = clamp01(((1 + WILD_CELL_MASS_SPREAD) - m * ENGULF_MASS_RATIO / w) / (2 * WILD_CELL_MASS_SPREAD))
        x, wpx = x_of(t), x_of(t + 5) - x_of(t) + 0.3
        o.append(f'<rect x="{x:.1f}" y="{band_y + band_h - lunch * band_h:.1f}" width="{wpx:.1f}" height="{lunch * band_h:.1f}" fill="{ALGAE}" opacity="0.55"/>')
        o.append(f'<rect x="{x:.1f}" y="{band_y + band_h + 2:.1f}" width="{wpx:.1f}" height="{threat * band_h:.1f}" fill="{DANGER}" opacity="0.55"/>')
    for label_t in (60, 180, 360, 540):
        m, w = sim["masses"][label_t], world_mass(label_t)
        lunch = clamp01((m / ENGULF_MASS_RATIO / w - (1 - WILD_CELL_MASS_SPREAD)) / (2 * WILD_CELL_MASS_SPREAD))
        threat = clamp01(((1 + WILD_CELL_MASS_SPREAD) - m * ENGULF_MASS_RATIO / w) / (2 * WILD_CELL_MASS_SPREAD))
        o.append(text(x_of(label_t) + 4, band_y + 10, f"{int(lunch * WILD_CELL_COUNT)} of {WILD_CELL_COUNT}", 9.5, ALGAE))
        o.append(text(x_of(label_t) + 4, band_y + band_h + 22, f"{int(round(threat * WILD_CELL_COUNT))} of {WILD_CELL_COUNT}", 9.5, DANGER))
    o.append(text(CHART_R + 8, band_y + 24, "share of the 24 wild cells this player can engulf (mass ≥ 1.25 × theirs)", 9.5, ALGAE))
    o.append(text(CHART_R + 8, band_y + 44, "share that can engulf this player (theirs ≥ 1.25 × its mass)", 9.5, DANGER))

    # world mass and level (dashed)
    pts = " ".join(f"{x_of(t):.1f},{y_mass(world_mass(t)):.1f}" for t in range(0, ROUND_S + 1, 10))
    o.append(f'<polyline points="{pts}" fill="none" stroke="{CYAN}" stroke-width="2" stroke-dasharray="7 5" opacity="0.9"/>')
    pts = " ".join(f"{x_of(t):.1f},{y_level(world_level(t)):.1f}" for t in range(0, ROUND_S + 1, 10))
    o.append(f'<polyline points="{pts}" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="7 5" opacity="0.9"/>')

    # player mass and level (solid), from the #138 option A model
    pts = " ".join(f"{x_of(t):.1f},{y_mass(m):.1f}" for t, m in enumerate(sim["masses"]))
    o.append(f'<polyline points="{pts}" fill="none" stroke="{CYAN}" stroke-width="2.4"/>')
    lp, prev = [], 1
    for t, lv in enumerate(sim["levels"]):
        if lv != prev:
            lp.append(f"{x_of(t):.1f},{y_level(prev):.1f}")
            prev = lv
        lp.append(f"{x_of(t):.1f},{y_level(lv):.1f}")
    o.append(f'<polyline points="{" ".join(lp)}" fill="none" stroke="{GOLD}" stroke-width="2.8"/>')
    r = sim["rungs"]
    marks = [("nucleoid", "player: nucleoid", CYAN_RIM), ("endosymbiont", "player: endosymbiont", MITO),
             ("envelope", "player: nuclear envelope", DNA), ("form", "player: a form", GOLD)]
    for i, (key, label, col) in enumerate(marks):
        if key not in r:
            continue
        t = r[key]
        y = y_level(sim["levels"][t])
        o.append(f'<circle cx="{x_of(t):.1f}" cy="{y:.1f}" r="4.5" fill="{col}" stroke="{BG_DEEP}" stroke-width="1.5"/>')
        o.append(text(x_of(t) + 7, y - 6 - (i % 2) * 12, f"{pm.mmss(t)} {label}", 10.5, col))

    # legend
    ly = CHART_T + 30
    lx = CHART_L + 12
    o.append(f'<rect x="{lx - 8}" y="{ly - 14}" width="300" height="76" rx="6" fill="{PANEL}" opacity="0.85" stroke="{PANEL_RIM}"/>')
    o.append(f'<line x1="{lx}" y1="{ly}" x2="{lx + 26}" y2="{ly}" stroke="{GOLD}" stroke-width="2.8"/>')
    o.append(text(lx + 32, ly + 4, "player level (#138 A)", 11, GOLD))
    o.append(f'<line x1="{lx + 160}" y1="{ly}" x2="{lx + 186}" y2="{ly}" stroke="{GOLD}" stroke-width="2" stroke-dasharray="7 5"/>')
    o.append(text(lx + 192, ly + 4, "world level", 11, GOLD))
    o.append(f'<line x1="{lx}" y1="{ly + 20}" x2="{lx + 26}" y2="{ly + 20}" stroke="{CYAN}" stroke-width="2.4"/>')
    o.append(text(lx + 32, ly + 24, "player mass", 11, CYAN))
    o.append(f'<line x1="{lx + 160}" y1="{ly + 20}" x2="{lx + 186}" y2="{ly + 20}" stroke="{CYAN}" stroke-width="2" stroke-dasharray="7 5"/>')
    o.append(text(lx + 192, ly + 24, "world mass", 11, CYAN))
    o.append(f'<rect x="{lx}" y="{ly + 34}" width="26" height="12" fill="{WILD}" opacity="0.4"/>')
    o.append(text(lx + 32, ly + 44, f"wild-cell mass spread ± {int(WILD_CELL_MASS_SPREAD * 100)} % ({WILD_CELL_COUNT} wild cells)", 11, WILD))

    # footer: constants strip, four lines
    fy = 596
    o.append(f'<rect x="40" y="{fy - 20}" width="{W - 80}" height="110" rx="8" fill="{PANEL}" opacity="0.85" stroke="{PANEL_RIM}"/>')
    o.append(text(56, fy - 4, "world clock (constants/world-clock.ts) · wild cells (constants/wild-cells.ts) · entry floor (constants/progression.ts)", 10, MUTED, extra='letter-spacing="1.5"'))
    o.append(text(56, fy + 14, f"worldLevel = min(1 + elapsed / WORLD_LEVEL_SECONDS {WORLD_LEVEL_SECONDS}, MAX_LEVEL)   worldMass = CELL_STARTING_MASS + WORLD_MASS_GAIN_PER_SECOND {WORLD_MASS_GAIN_PER_SECOND:g} × elapsed", 12, TEXT, family="DejaVu Sans Mono"))
    o.append(text(56, fy + 32, f"worldStage = stageOf(WILD_CELL_BUILDS[0].slice(0, floor(worldLevel) − 1))   late joiners and respawns enter at the world's level, mass ENTRY_MASS_FRACTION {ENTRY_MASS_FRACTION} × worldMass ≤ ENTRY_MAX_MASS {ENTRY_MAX_MASS}", 12, TEXT, family="DejaVu Sans Mono"))
    o.append(text(56, fy + 50, f"WILD_CELL_COUNT {WILD_CELL_COUNT}   WILD_CELL_MASS_SPREAD {WILD_CELL_MASS_SPREAD}   wild cells hunt from the endosymbiosis era", 12, TEXT, family="DejaVu Sans Mono"))
    lead = {k: pm.mmss(v) for k, v in r.items() if k != "bacteria_met"}
    o.append(text(56, fy + 70, f"read-out: world level 2 at 3:00 · 3 at 6:00 · 4 at 9:00 · {world_level(600):.2f} at 10:00, mass {world_mass(180):.0f} / {world_mass(360):.0f} / {world_mass(540):.0f} / {world_mass(600):.0f}   |   #138 A player: nucleoid {lead.get('nucleoid')} · endosymbiont {lead.get('endosymbiont')} · envelope {lead.get('envelope')} · form {lead.get('form')} · mass {int(sim['masses'][-1])} at 10:00", 12, TEXT, family="DejaVu Sans Mono"))
    o.append("</svg>")
    return "\n".join(o)


if __name__ == "__main__":
    out_dir = sys.argv[1]
    sim = pm.simulate(pm.OPTIONS["a"])
    with open(f"{out_dir}/evolving-world-timeline.svg", "w") as f:
        f.write(render(sim))
    for t in (0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600):
        m = sim["masses"][t]
        print(f"{pm.mmss(t)} world level {world_level(t):.2f} stage {STAGES[world_stage_index(t)]:14s} mass {world_mass(t):6.0f} "
              f"spread {world_mass(t) * 0.7:5.0f}-{world_mass(t) * 1.3:5.0f} | player L{sim['levels'][t]} mass {m:6.0f} "
              f"eats wild ≤ {m / ENGULF_MASS_RATIO:5.0f}  eaten by wild ≥ {m * ENGULF_MASS_RATIO:5.0f}")

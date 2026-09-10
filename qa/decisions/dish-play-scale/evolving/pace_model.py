#!/usr/bin/env python3
"""Decision ticket mockup: the first ten minutes. One SVG per option, 1600 x 600.

A small pace model (1 s steps) drives the curves: DNA income from fragments and bacteria that grows
with the cell's sweep (radius), a vent / shallows trip after the first draft, absorptions once the
cell is heavy enough to hunt, mass decay, and the bloom. Ladder rungs follow the design rule: one
rung per level-up once its prerequisite is met (the rung card).

Usage: python3 timeline.py <out-dir>
"""
import math
import sys

# ---- palette (sheet 01 / 03 roles) ----
BG_DEEP, BG_FIELD = "#04070d", "#0b1626"
TEXT, MUTED, ACCENT = "#cfdbe6", "#7d8da1", "#7fe7f5"
DNA, GOLD, DANGER = "#d36bff", "#ffe08a", "#ff5470"
CYAN, CYAN_RIM = "#22c1d6", "#a6f4ff"
ALGAE, MITO, CHLORO = "#8dff6a", "#ffb15a", "#63d64a"
PANEL, PANEL_RIM = "#0e1f33", "#173250"

W, H = 1600, 600
ROUND_S = 600

# ---- ecology constants shared by every option (ECOLOGY.md) ----
CELL_STARTING_MASS = 20
CELL_RADIUS_SCALE = 4
MASS_DECAY_RATE_PER_SECOND = 0.002
ROUND_BLOOM_START_FRACTION = 0.8
FOOD_BLOOM_SPAWN_MULTIPLIER = 1.5
DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER = 2
DNA_FRAGMENT_DNA = 5
BACTERIUM_DNA = 1
ENGULF_DNA_BASE = 30
ENGULF_DNA_SHARE = 0.2
ENGULF_MASS_YIELD = 0.8
MAX_LEVEL = 12

# ---- pace model tunables (design estimates, ECOLOGY §3 "expected time to level 2") ----
FRAGMENTS_REACHED_PER_SECOND_AT_SPAWN = 1 / 14  # one fragment every 14 s for a starting cell (calibrated: level 2 at 0:45 under the current spec)
PLAIN_BACTERIA_PER_SECOND = 0.1
MOTES_EATEN_PER_SECOND_AT_SPAWN = 0.7
MEAN_MOTE_MASS = 1.5  # 0.75 algae x 1 + 0.25 bacterium x 3
SPAWN_FIND_SECONDS = 5  # the first seconds are spent finding anything
TRIP_DECIDE_SECONDS = 10  # after the first draft, decide to go to the vent / shallows
TRIP_TRAVEL_SECONDS = 25  # broth -> a cluster
CLUSTER_BACTERIA_PER_SECOND = 0.25  # eating a five-bacterium cluster: one every 4 s
CLUSTER_SIZE = 5
HUNT_MIN_MASS = 150  # heavy enough to find prey at >= 1.25x among the field
HUNT_INTERVAL_SECONDS = 150
PREY_MASS_FRACTION = 0.35
PREY_DNA_ESTIMATE = 60
SWEEP_EXPONENT = 0.25  # calibrated: an active player at level 8 by the bloom, mass ~1000 at 8:00


def radius(mass):
    return CELL_RADIUS_SCALE * math.sqrt(mass)


def sweep(mass):
    """How much faster a bigger cell finds food: area swept per second, speed loss folded in."""
    return (radius(mass) / radius(CELL_STARTING_MASS)) ** SWEEP_EXPONENT


def level_thresholds(base, per_level):
    """Cumulative DNA needed for level 2..MAX_LEVEL (PROGRESSION §2)."""
    out, cum = [], 0
    for level in range(1, MAX_LEVEL):
        cum += base + per_level * level
        out.append(cum)
    return out


def simulate(opt):
    thresholds = level_thresholds(opt["base"], opt["per_level"])
    frag_scale = opt["fragment_spawn"] / 0.5 * (opt["fill"] / 0.6) ** 0.5
    mass, dna, level, bacteria = float(CELL_STARTING_MASS), 0.0, 1, 0
    trip_start = None
    hunting_since = None
    last_hunt = -1e9
    rungs = {}  # name -> second
    doing = []  # (start, end, label, colour)
    masses, levels = [], []
    phase = "graze"
    phase_start = 0

    def set_phase(name, t):
        nonlocal phase, phase_start
        if phase != name:
            doing.append((phase_start, t, phase))
            phase, phase_start = name, t

    for t in range(ROUND_S + 1):
        masses.append(mass)
        levels.append(level)
        bloom = t >= ROUND_BLOOM_START_FRACTION * ROUND_S
        active = t >= SPAWN_FIND_SECONDS
        frag_rate = FRAGMENTS_REACHED_PER_SECOND_AT_SPAWN * frag_scale * sweep(mass) * (DNA_FRAGMENT_BLOOM_SPAWN_MULTIPLIER if bloom else 1)
        motes = MOTES_EATEN_PER_SECOND_AT_SPAWN * sweep(mass) * (FOOD_BLOOM_SPAWN_MULTIPLIER if bloom else 1)
        gain_dna = 0.0
        gain_mass = 0.0
        if active:
            gain_dna += frag_rate * DNA_FRAGMENT_DNA + PLAIN_BACTERIA_PER_SECOND * BACTERIUM_DNA
            gain_mass += motes * MEAN_MOTE_MASS
        # the trip: decided after the first draft, eat variant bacteria at the cluster
        if "nucleoid" in rungs and trip_start is None and t >= rungs["nucleoid"] + TRIP_DECIDE_SECONDS:
            trip_start = t
            set_phase("trip", t)
        if trip_start is not None and bacteria < opt["bacteria_required"]:
            clusters_done = bacteria // CLUSTER_SIZE
            arrive = trip_start + TRIP_TRAVEL_SECONDS * (clusters_done + 1) + clusters_done * CLUSTER_SIZE / CLUSTER_BACTERIA_PER_SECOND
            if t >= arrive:
                set_phase("cluster", t)
                if (t - int(arrive)) % int(1 / CLUSTER_BACTERIA_PER_SECOND) == 0:
                    bacteria += 1
                    gain_dna += BACTERIUM_DNA
                    gain_mass += 3
                    if bacteria == opt["bacteria_required"]:
                        rungs["bacteria_met"] = t
                        set_phase("hunt" if mass >= HUNT_MIN_MASS else "graze2", t)
        elif trip_start is None and "nucleoid" not in rungs:
            set_phase("graze", t)
        # hunting: an absorption every HUNT_INTERVAL_SECONDS once heavy enough
        if mass >= HUNT_MIN_MASS and bacteria >= opt["bacteria_required"] and phase in ("graze2", "hunt", "apex", "bloom"):
            if phase == "graze2":
                set_phase("hunt", t)
            if hunting_since is None:
                hunting_since = t
                last_hunt = t - HUNT_INTERVAL_SECONDS / 2
            if t - last_hunt >= HUNT_INTERVAL_SECONDS:
                last_hunt = t
                prey_mass = mass * PREY_MASS_FRACTION
                gain_mass += prey_mass * ENGULF_MASS_YIELD
                gain_dna += ENGULF_DNA_BASE + ENGULF_DNA_SHARE * PREY_DNA_ESTIMATE
        if "form" in rungs and phase == "hunt":
            set_phase("apex", t)
        if bloom and phase in ("apex", "hunt"):
            set_phase("bloom", t)
        mass = max(CELL_STARTING_MASS, mass + gain_mass - (mass - CELL_STARTING_MASS) * MASS_DECAY_RATE_PER_SECOND)
        dna += gain_dna
        # level-ups and the ladder (one rung per level-up once its prerequisite holds)
        while level < MAX_LEVEL and dna >= thresholds[level - 1]:
            level += 1
            if "nucleoid" not in rungs:
                rungs["nucleoid"] = t
            elif "endosymbiont" not in rungs and bacteria >= opt["bacteria_required"]:
                rungs["endosymbiont"] = t
            elif "endosymbiont" in rungs and "envelope" not in rungs:
                rungs["envelope"] = t
            elif "envelope" in rungs and "form" not in rungs:
                rungs["form"] = t
    doing.append((phase_start, ROUND_S, phase))
    return dict(masses=masses, levels=levels, rungs=rungs, doing=doing, thresholds=thresholds, final_dna=dna)


# ---- drawing ----
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size=13, fill=TEXT, anchor="start", weight="normal", family="DejaVu Sans", opacity=1, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" opacity="{opacity}" {extra}>{esc(s)}</text>')


def mmss(seconds):
    return f"{int(seconds) // 60}:{int(seconds) % 60:02d}"


CHART_L, CHART_R, CHART_T, CHART_B = 90, 1250, 112, 440
LEVEL_MAX_AXIS = 12
MASS_MAX_AXIS = 1500

DOING_LABEL = {
    "graze": ("drift · learn to steer · eat by contact", MUTED),
    "trip": ("decide: vent or shallows · travel", MITO),
    "cluster": ("eat the cluster", MITO),
    "graze2": ("back to the broth · grow", ALGAE),
    "hunt": ("hunt: lunch or threat, by mass", DANGER),
    "apex": ("apex: a heavy form rules the broth", GOLD),
    "bloom": ("bloom: two levels for the small", DNA),
}


def x_of(t):
    return CHART_L + (CHART_R - CHART_L) * t / ROUND_S


def y_level(level):
    return CHART_B - (CHART_B - CHART_T) * (level - 1) / (LEVEL_MAX_AXIS - 1)


def y_mass(mass):
    return CHART_B - (CHART_B - CHART_T) * min(mass, MASS_MAX_AXIS) / MASS_MAX_AXIS


def render(opt, sim, letter):
    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    o.append('<defs>'
             f'<radialGradient id="bg" cx="0.3" cy="0.2" r="1.1"><stop offset="0" stop-color="{BG_FIELD}"/><stop offset="1" stop-color="{BG_DEEP}"/></radialGradient>'
             f'<linearGradient id="massfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{CYAN}" stop-opacity="0.35"/><stop offset="1" stop-color="{CYAN}" stop-opacity="0.02"/></linearGradient>'
             '</defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
    # header
    o.append(text(40, 44, f"OPTION {letter} · {opt['name'].upper()}", 26, TEXT, weight="bold"))
    o.append(text(40, 68, opt["tagline"], 14, ACCENT))
    o.append(text(W - 40, 44, "EVOLUTION · decision: the first ten minutes", 13, MUTED, anchor="end"))
    o.append(text(W - 40, 64, "one active player who takes the trip at the first chance · pace model, not a simulation run", 11, MUTED, anchor="end"))

    # phase bands (GAME-DESIGN §5.1)
    for (a, b, name) in [(0, 120, "GRAZE"), (120, 300, "HUNT"), (300, 480, "APEX"), (480, 600, "BLOOM")]:
        o.append(f'<rect x="{x_of(a):.1f}" y="{CHART_T - 22}" width="{x_of(b) - x_of(a):.1f}" height="{CHART_B - CHART_T + 22}" fill="{ACCENT}" opacity="{0.03 if name in ("GRAZE", "APEX") else 0.06}"/>')
        o.append(text((x_of(a) + x_of(b)) / 2, CHART_T - 8, name + " (design phase)", 10, MUTED, anchor="middle", extra='letter-spacing="1.5"'))
    # grid + axes
    for minute in range(0, 11):
        x = x_of(minute * 60)
        o.append(f'<line x1="{x:.1f}" y1="{CHART_T}" x2="{x:.1f}" y2="{CHART_B}" stroke="{PANEL_RIM}" stroke-width="1"/>')
        o.append(text(x, CHART_B + 18, f"{minute}:00", 11, MUTED, anchor="middle"))
    o.append(text((CHART_L + CHART_R) / 2, CHART_B + 36, "round time (minutes)", 11, MUTED, anchor="middle"))
    for level in range(1, LEVEL_MAX_AXIS + 1, 1):
        y = y_level(level)
        o.append(f'<line x1="{CHART_L - 4}" y1="{y:.1f}" x2="{CHART_L}" y2="{y:.1f}" stroke="{GOLD}"/>')
        if level in (1, 2, 4, 6, 8, 10, 12):
            o.append(text(CHART_L - 8, y + 4, str(level), 11, GOLD, anchor="end"))
    o.append(text(CHART_L - 8, CHART_T - 8, "level", 11, GOLD, anchor="end"))
    for m in (0, 500, 1000, 1500):
        y = y_mass(m)
        o.append(f'<line x1="{CHART_R}" y1="{y:.1f}" x2="{CHART_R + 4}" y2="{y:.1f}" stroke="{CYAN}"/>')
        o.append(text(CHART_R + 8, y + 4, str(m), 11, CYAN))
    o.append(text(CHART_R + 8, CHART_T - 8, "mass", 11, CYAN))
    # mass area
    pts = " ".join(f"{x_of(t):.1f},{y_mass(m):.1f}" for t, m in enumerate(sim["masses"]))
    o.append(f'<polygon points="{x_of(0):.1f},{CHART_B} {pts} {x_of(ROUND_S):.1f},{CHART_B}" fill="url(#massfill)"/>')
    o.append(f'<polyline points="{pts}" fill="none" stroke="{CYAN}" stroke-width="2.2"/>')
    # level steps
    lp = []
    prev = 1
    for t, lv in enumerate(sim["levels"]):
        if lv != prev:
            lp.append(f"{x_of(t):.1f},{y_level(prev):.1f}")
            prev = lv
        lp.append(f"{x_of(t):.1f},{y_level(lv):.1f}")
    o.append(f'<polyline points="{" ".join(lp)}" fill="none" stroke="{GOLD}" stroke-width="2.6"/>')
    # stage lane above the chart: protocell / prokaryote / endosymbiosis / eukaryote / specialised
    lane_y = 84
    r = sim["rungs"]
    bounds = [0, r.get("nucleoid", ROUND_S), r.get("endosymbiont", ROUND_S), r.get("envelope", ROUND_S), r.get("form", ROUND_S), ROUND_S]
    stage_names = ["protocell", "prokaryote", "endosymbiosis", "eukaryote", "specialised"]
    stage_cols = [MUTED, CYAN_RIM, MITO, DNA, GOLD]
    for i, name in enumerate(stage_names):
        a, b = bounds[i], bounds[i + 1]
        if b <= a:
            continue
        o.append(f'<rect x="{x_of(a):.1f}" y="{lane_y - 9}" width="{max(2, x_of(b) - x_of(a)):.1f}" height="14" rx="7" fill="{stage_cols[i]}" opacity="0.28"/>')
        if x_of(b) - x_of(a) > 70:
            o.append(text((x_of(a) + x_of(b)) / 2, lane_y + 2, name, 10, stage_cols[i], anchor="middle", weight="bold"))
    o.append(text(CHART_L - 8, lane_y + 2, "stage", 11, MUTED, anchor="end"))
    # unlock markers
    marks = [
        ("nucleoid", "Nucleoid Coil · level 2 · first draft", CYAN_RIM),
        ("bacteria_met", f"{opt['bacteria_required']} variant bacteria eaten", MITO),
        ("endosymbiont", "mitochondrion / chloroplast", MITO),
        ("envelope", "nuclear envelope", DNA),
        ("form", "a form (amoeba, paramecium, ...)", GOLD),
    ]
    stagger = 0
    for key, label, col in marks:
        if key not in r:
            continue
        t = r[key]
        x = x_of(t)
        y_top = CHART_T + 6 + stagger * 22
        o.append(f'<line x1="{x:.1f}" y1="{y_top + 10}" x2="{x:.1f}" y2="{y_level(sim["levels"][t]):.1f}" stroke="{col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>')
        o.append(f'<circle cx="{x:.1f}" cy="{y_level(sim["levels"][t]):.1f}" r="4.5" fill="{col}" stroke="{BG_DEEP}" stroke-width="1.5"/>')
        o.append(text(x + 6, y_top + 8, f"{mmss(t)}  {label}", 11, col))
        stagger += 1
    missing = [label for key, label, _ in marks if key not in r and key != "bacteria_met"]
    if missing:
        o.append(text(CHART_R - 8, CHART_B - 12, "never reached in 10:00: " + ", ".join(missing), 11, DANGER, anchor="end", weight="bold"))
    # doing lane
    lane_y = CHART_B + 60
    o.append(text(CHART_L - 8, lane_y + 14, "doing", 11, MUTED, anchor="end"))
    for (a, b, name) in sim["doing"]:
        if b - a < 1:
            continue
        label, col = DOING_LABEL[name]
        o.append(f'<rect x="{x_of(a):.1f}" y="{lane_y}" width="{x_of(b) - x_of(a):.1f}" height="22" fill="{col}" opacity="0.18" stroke="{col}" stroke-opacity="0.5"/>')
        width = x_of(b) - x_of(a)
        if width > 36:
            shown = label if width > len(label) * 6.2 else label.split(" ·")[0].split(":")[0]
            o.append(text(x_of(a) + 6, lane_y + 15, shown, 11, col))
    # footer: constants strip and the read-out
    fy = 548
    o.append(f'<rect x="40" y="{fy - 20}" width="{W - 80}" height="64" rx="8" fill="{PANEL}" opacity="0.85" stroke="{PANEL_RIM}"/>')
    th = sim["thresholds"]
    o.append(text(56, fy - 4, "constants", 10, MUTED, extra='letter-spacing="1.5"'))
    o.append(text(56, fy + 14, f"LEVEL_UP_COST_BASE_DNA {opt['base']} + LEVEL_UP_COST_PER_LEVEL_DNA {opt['per_level']} × level  →  cumulative L2 {th[0]} · L3 {th[1]} · L4 {th[2]} · L6 {th[4]} · L12 {th[10]} DNA", 12, TEXT, family="DejaVu Sans Mono"))
    o.append(text(56, fy + 32, f"ENDOSYMBIOSIS_BACTERIA_REQUIRED {opt['bacteria_required']}   DNA_FRAGMENT_SPAWN_PER_SECOND_BASE {opt['fragment_spawn']}   DNA_FRAGMENT_INITIAL_FILL_FRACTION {opt['fill']}", 12, TEXT, family="DejaVu Sans Mono"))
    o.append(text(W - 56, fy - 4, "read-out", 10, MUTED, anchor="end", extra='letter-spacing="1.5"'))
    o.append(text(W - 56, fy + 14, f"protocell for {mmss(r.get('nucleoid', ROUND_S))} · endosymbiont at {mmss(r['endosymbiont']) if 'endosymbiont' in r else 'never'} · form at {mmss(r['form']) if 'form' in r else 'never'}", 12, TEXT, anchor="end", family="DejaVu Sans Mono"))
    o.append(text(W - 56, fy + 32, f"level {sim['levels'][300]} at 5:00 · level {sim['levels'][-1]} and mass {int(sim['masses'][-1])} at 10:00", 12, TEXT, anchor="end", family="DejaVu Sans Mono"))
    # legend
    o.append(f'<line x1="{CHART_R - 200}" y1="{CHART_B - 14}" x2="{CHART_R - 176}" y2="{CHART_B - 14}" stroke="{GOLD}" stroke-width="2.6"/>')
    o.append(text(CHART_R - 170, CHART_B - 10, "level (left axis)", 11, GOLD))
    o.append(f'<line x1="{CHART_R - 96}" y1="{CHART_B - 14}" x2="{CHART_R - 72}" y2="{CHART_B - 14}" stroke="{CYAN}" stroke-width="2.2"/>')
    o.append(text(CHART_R - 66, CHART_B - 10, "mass (right)", 11, CYAN))
    o.append("</svg>")
    return "\n".join(o)


OPTIONS = {
    "a": dict(name="Slow dawn", tagline="two to three minutes as a bare protocell; the ladder opens late and the top rungs fall outside a ten-minute round",
              base=40, per_level=20, bacteria_required=10, fragment_spawn=0.3, fill=0.6),
    "b": dict(name="Quick start", tagline="the current spec: first draft inside a minute, the trip pays a level later, a form by five minutes",
              base=10, per_level=10, bacteria_required=5, fragment_spawn=0.5, fill=0.6),
    "c": dict(name="Dawn, then the trip", tagline="a full minute as a protocell, then the ladder opens by what you eat: one cluster unlocks the endosymbiont at the very next draft",
              base=20, per_level=10, bacteria_required=3, fragment_spawn=0.5, fill=0.8),
}

if __name__ == "__main__":
    out_dir = sys.argv[1]
    for letter, opt in OPTIONS.items():
        sim = simulate(opt)
        with open(f"{out_dir}/option-{letter}-{opt['name'].lower().replace(', ', '-').replace(' ', '-')}.svg", "w") as f:
            f.write(render(opt, sim, letter.upper()))
        r = sim["rungs"]
        print(letter, {k: mmss(v) for k, v in r.items()}, "final level", sim["levels"][-1], "mass", int(sim["masses"][-1]), "dna", int(sim["final_dna"]),
              "L2 at", mmss(r.get("nucleoid", 600)), "levels at 2:00/5:00/8:00", sim["levels"][120], sim["levels"][300], sim["levels"][480])

// Organelle atlas, slots and sprite motion (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §3–§4).
// Sizes are fractions of the cell radius `r`.

import type { ValueOf } from '@evolution/shared';

/** The organelle kinds the atlas bakes one sprite for (RENDERING §3); the layout order joins with #215. */
export const ORGANELLE_KIND = {
  nucleus: 'nucleus',
  nucleoid: 'nucleoid',
  mitochondrion: 'mitochondrion',
  chloroplast: 'chloroplast',
  foodVacuole: 'food_vacuole',
  toxinVacuole: 'toxin_vacuole',
  lipid: 'lipid',
  protocellGranule: 'protocell_granule',
} as const;
export type OrganelleKind = ValueOf<typeof ORGANELLE_KIND>;

export const ORGANELLE_ATLAS_PX_PER_R = 128;
export const ORGANELLE_ATLAS_MAX_DPR = 2;
/** Every atlas sprite's halo reaches this far past its body, at this alpha; rims and glints as shares of the body. */
export const ORGANELLE_HALO_REACH = 1.6;
export const ORGANELLE_HALO_ALPHA = 0.35;
export const ORGANELLE_RIM_WIDTH_SHARE = 0.1;
export const ORGANELLE_GLINT_ALPHA = 0.55;
/** The mitochondrion's matrix (lighter inner bean) and cristae folds, as shares of the body. */
export const MITO_MATRIX = { widthShare: 0.92, heightShare: 0.85, liftShare: 0.08 } as const;
export const MITO_CRISTA = { widthShare: 0.06, heightShare: 1.2, alpha: 0.8 } as const;
/** The chloroplast's lit granules: radius and ring as shares of the body, on the light-side half turn. */
export const CHLORO_GRANULE = { radiusShare: 0.16, ringShare: 0.55, arcStartTurns: -0.375 } as const;
/** A vacuole's translucent fill: faint at the centre, denser at the rim. */
export const VACUOLE_FILL_ALPHA = { inner: 0.25, outer: 0.6 } as const;
/**
 * The nucleus ramp (#231, VISUAL-STYLE §3): the shader's three-stop disc under the nucleus sprite. The
 * focus and the reach are in nucleus radii (`r_n = NUCLEUS_RADIUS × r`), the focus toward `LIGHT_DIRECTION_DEG`;
 * the middle stop is where the ramp reaches the palette's nucleus colour on its way from rim to nucleus dark.
 */
export const NUCLEUS_RAMP_FOCUS_RADII = 0.4;
export const NUCLEUS_RAMP_REACH_RADII = 1.4;
export const NUCLEUS_RAMP_MID_STOP = 0.5;
export const NUCLEUS_RAMP_ALPHA = 0.92;
/** The chromatin spots: seeded around the ring, in angle, distance and size, as shares of the nucleus radius. */
export const NUCLEUS_CHROMATIN = {
  alpha: 0.25,
  ringShareMin: 0.42,
  ringShareMax: 0.64,
  radiusShareMin: 0.1,
  radiusShareMax: 0.17,
  angleJitterTurns: 0.12,
} as const;
export const NUCLEOLUS_HALO = { reach: 1.8, alpha: 0.5 } as const;
export const NUCLEUS_HIGHLIGHT_ALPHA = 0.6;
/** The nucleoid bake: a loop of thread wobbling on two incommensurate terms at seeded phases, a glow under it. */
export const NUCLEOID_BAKE = {
  loopTurns: 3,
  secondLoopTurns: 5,
  wobbleShare: 0.12,
  secondWobbleShare: 0.07,
  strandPx: 2,
  glowPx: 6,
  glowReach: 1.5,
  steps: 96,
} as const;
/**
 * Slot rejection sampling (§3): a slot centre stays inside `1 − max(0.08, sprite radius)` (the sprite
 * body never crosses the membrane, #243), outside the nucleus disc, this gap between sprites.
 */
export const ORGANELLE_MEMBRANE_MARGIN = 0.08;
export const ORGANELLE_MIN_GAP = 0.04;
export const ORGANELLE_SLOT_MAX_ATTEMPTS = 256;
/** #146's DNA ring keep-out: slots also reject `|q|` below this, for every cell. */
export const DNA_RING_KEEP_OUT_FRACTION = 0.66;
export const NUCLEUS_LAG = 0.2;
export const NUCLEUS_DRIFT_RADII = 0.02;
export const NUCLEUS_DRIFT_HZ = 0.2;

export const NUCLEUS_RADIUS = 0.3;
export const NUCLEUS_OFFSET_TOWARD_LIGHT = 0.12;
export const NUCLEUS_GLOW_RADIUS = 0.4;
export const NUCLEUS_GLOW_ALPHA = 0.35;
export const NUCLEUS_RIM_PX = 2.3;
export const NUCLEUS_RIM_ALPHA = 0.75;
export const NUCLEUS_CHROMATIN_SPOTS = 5;
export const NUCLEOLUS_FRACTION = 0.22;
export const NUCLEUS_HIGHLIGHT = { radiusX: 0.075, radiusY: 0.03 } as const;
export const NUCLEOID_RADIUS = 0.34;
export const NUCLEOID_ALPHA_MIN = 0.4;
export const NUCLEOID_ALPHA_MAX = 0.55;
export const ENVELOPE_PORES_BY_TIER = [16, 20, 24] as const;
export const ENVELOPE_BRIGHTNESS_BY_TIER = [1.0, 1.1, 1.2] as const;
export const ENVELOPE_PORE_GAP_PX = 3;
export const MITOCHONDRION = { length: 0.16, width: 0.08, cristae: 3, sprintScale: 1.15 } as const;
export const CHLOROPLAST = { radius: 0.17, granules: 6, shallowsGlowBoost: 0.4, membraneTint: 0.2 } as const;
/** A food vacuole grows from `growFromScale` to 1 over a cycle, rises `riseRadii`, and pops over the last `popShare`. */
export const FOOD_VACUOLE = {
  radius: 0.12,
  cycleSeconds: 2,
  riseRadii: 0.1,
  growFromScale: 0.5,
  popShare: 0.15,
} as const;
export const TOXIN_VACUOLE = { radius: 0.34, pulseScale: 1.08, pulseHz: 1, wispsByTier: [3, 5, 7] } as const;
export const LIPID_DROPLET = { radiusMin: 0.05, radiusMax: 0.07, count: 2 } as const;
export const PROTOCELL_GRANULE_COUNT = 3;
export const PROTOCELL_GRANULE_RADIUS_MIN = 0.045;
export const PROTOCELL_GRANULE_RADIUS_MAX = 0.06;
export const PROTOCELL_GRANULE_DRIFT_RADII = 0.06;
export const PROTOCELL_GRANULE_DRIFT_HZ = 0.15;
export const EYESPOT_RADIUS = 0.08;

/** Count per tier for the tiered organelles (VISUAL-STYLE §4). */
export const NUCLEOID_LOOPS_BY_TIER = [1, 2, 3] as const;
export const MITOCHONDRIA_BY_TIER = [1, 2, 3] as const;
export const CHLOROPLASTS_BY_TIER = [1, 2, 3] as const;
export const FOOD_VACUOLES_BY_TIER = [2, 3, 4] as const;
export const TOXIN_VACUOLES_BY_TIER = [1, 1, 1] as const;

// ---- flagella (VISUAL-STYLE §4, sheet 04) ----
export const FLAGELLUM_LENGTH_RADII = 2;
export const FLAGELLUM_WAVES = 2;
export const FLAGELLUM_CORE_PX = 3;
export const FLAGELLUM_OUTER_PX = 5;
export const FLAGELLUM_OUTER_ALPHA = 0.45;
export const FLAGELLUM_AMPLITUDE_RADII = 0.12;
export const FLAGELLUM_AMPLITUDE_BY_TIER = [1, 1.5, 2] as const;
export const FLAGELLUM_TAILS_BY_TIER = [1, 1, 2] as const;
export const FLAGELLUM_SPRINT_AMPLITUDE_SCALE = 2;
export const FLAGELLUM_WAVE_HZ = 3;
/** 16 per wave: with round joins the two waves read as sine curves, not kinks. */
export const FLAGELLUM_SEGMENTS = 32;
export const FLAGELLUM_TAIL_SPREAD_DEG = 18;

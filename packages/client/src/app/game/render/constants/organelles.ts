// Organelle atlas, slots and sprite motion (docs/RENDERING.md §3, docs/VISUAL-STYLE.md §3–§4).
// Sizes are fractions of the cell radius `r`.

export const ORGANELLE_ATLAS_PX_PER_R = 128;
export const ORGANELLE_ATLAS_MAX_DPR = 2;
/** Slot rejection sampling (§3): inside 1 − 0.08, outside the nucleus disc, this gap between sprites. */
export const ORGANELLE_MEMBRANE_MARGIN = 0.08;
export const ORGANELLE_MIN_GAP = 0.04;
export const ORGANELLE_SLOT_MAX_ATTEMPTS = 64;
/** #146's DNA ring keep-out: slots also reject `|q|` below this, for every cell. */
export const DNA_RING_KEEP_OUT_FRACTION = 0.56;
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
export const FOOD_VACUOLE = { radius: 0.12, cycleSeconds: 2, riseRadii: 0.1 } as const;
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
export const FLAGELLUM_SEGMENTS = 16;
export const FLAGELLUM_TAIL_SPREAD_DEG = 18;

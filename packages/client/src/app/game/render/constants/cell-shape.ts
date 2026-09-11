// The cell profile, bands and LOD numbers (docs/RENDERING.md §2, §5; docs/VISUAL-STYLE.md §3–§6).
// Sizes are fractions of the cell radius `r` unless the suffix says px or degrees.

// ---- quad and slots (§2, §2.1) ----
export const CELL_QUAD_EXTENT_RADII = 3.0;
/** Instance rows in the instance texture: the bench's 100 cells, their ghosts and a wide margin. */
export const CELL_INSTANCE_CAPACITY = 512;
/** The unit quad every cell instance is drawn on: four corners, two triangles. */
export const CELL_QUAD_POSITIONS = [-1, -1, 1, -1, 1, 1, -1, 1] as const;
export const CELL_QUAD_INDICES = [0, 1, 2, 0, 2, 3] as const;
export const MAX_SHAPE_BUMPS = 8;
/** Slots reserved for pseudopods (#121); the eat, contact and engulf bumps share the rest. */
export const PSEUDOPOD_SLOT_COUNT = 4;

// ---- rest motion (sheet 01 / 04, VISUAL-STYLE §5) ----
export const BREATH_AMPLITUDE = 0.02;
export const BREATH_HZ = 0.5;
export const PROTOCELL_WOBBLE_MODE = 2;
export const PROTOCELL_WOBBLE_AMPLITUDE = 0.08;
export const PROTOCELL_WOBBLE_HZ = 0.7;
export const FORM_WOBBLE_MODE = 3;
export const FORM_WOBBLE_AMPLITUDE = 0.05;
export const FORM_WOBBLE_HZ = 0.5;
/** With `cytoskeleton`: breathing, wobble and lobes halve. */
export const WOBBLE_TAUT_SCALE = 0.5;
export const JITTER_AMPLITUDE = 0.008;
export const REST_LOBE_COUNT_MIN = 5;
export const REST_LOBE_COUNT_MAX = 7;
export const REST_LOBE_AMPLITUDE_MIN = 0.025;
export const REST_LOBE_AMPLITUDE_MAX = 0.04;
export const REST_LOBE_SIGMA_RAD_MIN = 0.25;
export const REST_LOBE_SIGMA_RAD_MAX = 0.4;
/** Lobe centres sit evenly around the ring and stray by this share of the spacing, so they never pile up. */
export const REST_LOBE_CENTRE_JITTER = 0.2;
/** The jitter / lobes strip: samples per row, rows (one per cell variant), value-noise knots. */
export const NOISE_STRIP_WIDTH = 256;
export const NOISE_STRIP_ROWS = 16;
export const NOISE_STRIP_JITTER_KNOTS = 24;
/** The strip stores each signed value as a 16-bit pair (hi, lo) of a unit range scaled by these. */
export const NOISE_STRIP_JITTER_SCALE = 1;
export const NOISE_STRIP_LOBE_SCALE = 0.05;
export const NOISE_STRIP_VALUE_LEVELS = 65535;

// ---- stretch (sheet 01 motion, sheet 02, VISUAL-STYLE §5) ----
export const STRETCH_ALONG = 1.22;
export const STRETCH_TAPER = 0.72;
export const STRETCH_ACROSS_PER_ALONG = 0.6;
export const SPRINT_STRETCH_SCALE = 1.06;
export const SPRINT_RIM_BRIGHTNESS = 1.2;
/** Below this speed ratio the heading is held rather than read from the velocity. */
export const HEADING_HOLD_SPEED_RATIO = 0.02;

// ---- bumps (VISUAL-STYLE §5, sheet 03, RENDERING §2.1, §4) ----
export const CONTACT_DENT_AMPLITUDE = -0.12;
export const CONTACT_DENT_SIGMA_DEG = 22;
export const CONTACT_DENT_TAUT_SIGMA_DEG = 14;
export const EAT_DIMPLE_SIGMA_DEG = 22;
export const EAT_WRAP_SIGMA_DEG = 30;
export const ENGULF_ARM_OFFSET_DEG = 30;
export const ENGULF_ARM_SIGMA_DEG = 16;
export const ENGULF_NOTCH_SIGMA_DEG = 12;
export const ENGULF_SEAL_SIGMA_DEG = 42;

// ---- the palette texture (§2.3): one row per palette, one column per shade ----
export const PALETTE_SHADE = {
  base: 0,
  rim: 1,
  nucleus: 2,
  edge: 3,
  cytoLight: 4,
  cytoDark: 5,
  nucleusDark: 6,
  chloroBase: 7,
} as const;
export const PALETTE_SHADE_COUNT = Object.keys(PALETTE_SHADE).length;

// ---- light and halos (§2.2) ----
export const LIGHT_DIRECTION_DEG = -135;
export const HALO_FLAT_STOP = 0.62;
export const HALO_BLUR_RADII = 0.12;
export const HALO_OUTER_RADII = 1.28;
export const HALO_PEAK_ALPHA = 0.34;
export const TRAIT_HALO_OUTER_RADII = 1.39;
export const TRAIT_HALO_FLAT_STOP = 0.55;
export const TRAIT_HALO_PEAK_ALPHA = 0.42;
export const PROTOCELL_HALO_OUTER_RADII = 1.2;
export const PROTOCELL_HALO_PEAK_ALPHA = 0.22;
export const FAR_DOT_HALO_RADII = 3.0;
export const HALO_KIND = { default: 0, chloroplast: 1, toxin: 2, protocell: 3 } as const;

// ---- body ramp, pools, noise, speckle, filaments (§2.2) ----
export const BODY_RAMP_CENTRE_OFFSET_RADII = 0.3;
export const BODY_RAMP_CENTRE_ANGLE_DEG = -126;
export const BODY_RAMP_RADIUS_RADII = 1.36;
export const BODY_RAMP_STOPS = [0, 0.55, 0.86, 1.0] as const;
export const BODY_RAMP_ALPHAS = [0.42, 0.55, 0.55, 0.85] as const;
export const PROTOCELL_BODY_ALPHAS = [0.16, 0.2, 0.2, 0.26] as const;
export const POOL_BLUR_RADII = 0.125;
export const LIGHT_POOL = { alpha: 0.14, radiusX: 0.6, radiusY: 0.45, offset: 0.53, angleDeg: -131 } as const;
export const DARK_POOL = { alpha: 0.5, radiusX: 0.9, radiusY: 0.7, offset: 0.67, angleDeg: 48 } as const;
export const CYTO_NOISE_MAX_RADII = 0.89;
/** The noise band's soft outer edge, inside `CYTO_NOISE_MAX_RADII`. */
export const CYTO_NOISE_EDGE_BLUR_RADII = 0.05;
export const NOISE_TILE_SIZE_PX = 256;
export const NOISE_TILE_WU = 64;
/** The coarse mottle is white mixed this far toward the palette rim; the fine one is white (§2.2). */
export const CYTO_NOISE_COARSE = {
  octaves: 3,
  cycles: 12,
  alphaGain: 1.6,
  alphaBias: -0.62,
  alpha: 0.22,
  rimMix: 0.5,
} as const;
export const CYTO_NOISE_FINE = { octaves: 2, cycles: 29, alphaGain: 1.8, alphaBias: -0.95, alpha: 0.18 } as const;
export const RIBOSOME_BAND_MIN_RADII = 0.55;
export const RIBOSOME_BAND_MAX_RADII = 0.89;
export const RIBOSOME_DENSITY_BY_TIER = [20, 40, 60] as const;
export const RIBOSOME_RADIUS_RADII_MIN = 0.012;
export const RIBOSOME_RADIUS_RADII_MAX = 0.022;
export const RIBOSOME_MIN_PX = 2;
export const RIBOSOME_ALPHA_MIN = 0.35;
export const RIBOSOME_ALPHA_MAX = 0.8;
export const FILAMENT_COUNT_BY_TIER = [11, 15, 19] as const;
export const FILAMENT_WIDTH_PX = 1.1;
export const FILAMENT_ALPHA = 0.28;
export const FILAMENT_MASK_PX = 0.55;

// ---- membrane bands (§2.2) ----
export const INNER_EDGE_WIDTH_RADII = 0.11;
export const INNER_EDGE_ALPHA = 0.55;
export const SOFT_RIM_INNER_RADII = 0.9;
export const SOFT_RIM_OUTER_RADII = 1.1;
export const SOFT_RIM_BLUR_RADII = 0.08;
export const SOFT_RIM_ALPHA = 0.35;
export const RIM_LIGHT_HALF_WIDTH_RADII = 0.025;
export const RIM_LIGHT_STOPS = [0, 0.18, 0.55, 1] as const;
export const RIM_LIGHT_ALPHAS = [0.95, 0.95, 0.55, 0.55] as const;
export const OUTLINE_MIN_PX = 0.8;
export const OUTLINE_WIDTH_RADII = 0.012;
export const OUTLINE_ALPHA = 0.5;
export const PROTOCELL_OUTLINE_ALPHA = 0.4;
export const PROTOCELL_FILM_GAP_RADII = 0.025;
export const PROTOCELL_FILM_ALPHA = 0.55;
export const PROTOCELL_FILM_LIGHT_ALPHA = 0.7;
export const CELL_WALL_INNER_RADII = 1.05;
export const CELL_WALL_HAIRLINE_RADII = 1.075;
export const CELL_WALL_OUTER_RADII = 1.095;
export const CELL_WALL_SCALE_BY_TIER = [1.5, 2, 2.5] as const;
export const CILIA_OUTER_RADII = 1.12;
export const CILIA_LEAN_DEG = 30;
export const CILIA_WAVE_COUNT = 3;
export const CILIA_WAVE_AMPLITUDE_DEG = 12;
export const CILIA_BEAT_HZ = 2.0;
export const CILIA_BEAT_IDLE_HZ = 0.5;
export const CILIA_WIDTH_PX = 1.2;
export const CILIA_ALPHA = 0.75;
export const CILIA_MID_ALPHA = 0.4;
export const CILIA_COUNT_BY_TIER = [24, 36, 48] as const;
export const GLINT_RADII_X = 0.22;
export const GLINT_RADII_Y = 0.08;
export const GLINT_OFFSET_RADII = 0.74;
export const GLINT_ANGLE_DEG = -132;
export const GLINT_ROTATION_DEG = -40;
export const GLINT_EDGE_PX = 1.5;
export const GLINT_ALPHA = 0.5;
export const PREY_UNDER_FILM_ALPHA = 0.62;
/** The nucleus highlight's centre, in cell radii toward the light: inside the `NUCLEUS_RADIUS` 0.30 body. */
export const NUCLEUS_HIGHLIGHT_OFFSET_RADII = 0.16;
export const NUCLEUS_HIGHLIGHT_ANGLE_DEG = -136;

// ---- player tells (VISUAL-STYLE §2, §5) ----
export const SEAT_MARK_ANCHOR_DEG = -135;
export const SEAT_MARK_BEAD_RADIUS_FRACTION = 0.05;
export const SEAT_MARK_BEAD_MIN_PX = 2;
export const SEAT_MARK_CORE_ALPHA = 0.92;
export const SEAT_MARK_HALO_ALPHA = 0.45;
export const SEAT_MARK_HALO_SCALE = 2.2;
export const SELF_RING_ALPHA = 0.7;
export const SELF_RING_WIDTH_PX = 1.5;
export const SELF_RING_DASH_PX = [6, 4] as const;
export const SELF_RING_RADIUS_FRACTION = 1.12;
export const SELF_RING_MIN_PX = 7.5;
export const SELF_RING_ROTATION_DEG_PER_SECOND = 20;
export const ENGULF_WARNING_RING_RADII = 1.3;
export const ENGULF_WARNING_RING_MIN_PX = 24;
export const WARNING_RING_STROKE_PX = 2;
export const WARNING_RING_DASH_PX = [6, 5] as const;
export const WARNING_RING_ROTATION_DEG_PER_SECOND = 12;

// ---- LOD (VISUAL-STYLE §6, RENDERING §5) ----
export const CELL_LOD_FULL_MIN_PX = 20;
export const CELL_LOD_FAR_MAX_PX = 8;
export const LOD_FADE_BAND_PX = 6;
export const CELL_FAR_DOT_MIN_PX = 3;
export const MOTE_CORE_MIN_PX = 2;
export const MOTE_WIDE_HALO_MIN_PX = 6;
export const MOTE_SMALL_VARIANT_MAX_ZOOM = 0.5;

// The dish, food, depth, effects, layer order and camera numbers (docs/VISUAL-STYLE.md §1, §2, §5,
// §8; sheet 02; docs/RENDERING.md §6). Units: wu unless the suffix says px, seconds or degrees.
// Slice D (#208) adds the bench scene and the frame-budget numbers of docs/RENDERING.md §7 here.

// ---- layer order (docs/ARCHITECTURE.md §6) ----
export const LAYER_Z = {
  dish: 0,
  depthFar: 1,
  food: 2,
  fragments: 3,
  cells: 4,
  depthNear: 5,
  effects: 6,
  debug: 7,
} as const;
export type LayerName = keyof typeof LAYER_Z;
/** Every layer in `LAYER_Z` order; `layers.spec.ts` pins it complete. */
export const LAYER_NAMES: readonly LayerName[] = [
  'dish',
  'depthFar',
  'food',
  'fragments',
  'cells',
  'depthNear',
  'effects',
  'debug',
];

// ---- field and dish (sheet 02) ----
export const FIELD_TEXTURE_PX = 2048;
export const LIGHT_POOL_ALPHA = 0.09;
export const LIGHT_POOL_SIZE_WU = { width: 980, height: 760 } as const;
export const LIGHT_POOL_OFFSET_FRACTION = 0.3;
export const CAUSTIC_ALPHA = 0.05;
export const CAUSTIC_ARCS = 3;
export const ZONE_TINT_ALPHA = { shallows: 0.16, vent: 0.13, gel: 0.14 } as const;
export const ZONE_CLOUD_ALPHA = 0.36;
export const ZONE_CLOUD_OCTAVES = 3;
export const ZONE_CLOUD_CYCLES = 9;
export const MIRE_STRAND_ALPHA_MIN = 0.1;
export const MIRE_STRAND_ALPHA_MAX = 0.26;
export const MIRE_STRANDS_PER_PATCH = 9;
export const WALL_INNER_SHADOW_WU = 26;
export const WALL_INNER_SHADOW_ALPHA = 0.35;
export const WALL_GLASS_WU = 34;
export const WALL_GLASS_INNER_WU = 12;
export const WALL_RIM_SCATTER_WU = 2.5;
export const WALL_RIM_SCATTER_ALPHA = 0.55;
export const WALL_RIM_GLOW_WU = 9;
export const WALL_RIM_GLOW_ALPHA = 0.28;
export const WALL_HAIRLINE_WU = 1;
export const WALL_HAIRLINE_ALPHA = 0.7;
export const OUTSIDE_DISH_ALPHA = 0.92;
export const VIGNETTE_ALPHA = 0.55;
export const VIGNETTE_RADIUS_FRACTION = 0.72;
export const VIGNETTE_TEXTURE_PX = 512;
export const VENT_FISSURE_SIZE_WU = { length: 190, width: 60 } as const;
export const VENT_FISSURE_ROTATION_DEG = -18;
export const VENT_HEAT_POOL_ALPHA = 0.2;
export const VENT_SEAM_ALPHA = 0.55;
export const VENT_CRUST_ALPHA = 0.72;
export const VENT_SHIMMER_SCALE_PX = 6;
export const VENT_SHIMMER_SPEED_WU_PER_SECOND = 40;
export const VENT_SPRITE_PADDING_WU = 80;
export const VENT_GLINT_HZ_MIN = 6;
export const VENT_GLINT_HZ_MAX = 9;

// ---- depth particles (sheet 02, VISUAL-STYLE §5) ----
export const DEPTH_FAR = { count: 260, radiusMin: 0.5, radiusMax: 1.3, alphaMin: 0.08, alphaMax: 0.28 } as const;
export const DEPTH_NEAR_PARTICLES = {
  count: 46,
  radiusMin: 2.2,
  radiusMax: 4.4,
  alphaMin: 0.05,
  alphaMax: 0.13,
} as const;
export const DEPTH_BOKEH = { count: 12, radiusMin: 6, radiusMax: 14, alphaMin: 0.05, alphaMax: 0.11 } as const;
export const DEPTH_DRIFT_WU_PER_SECOND_MIN = 2;
export const DEPTH_DRIFT_WU_PER_SECOND_MAX = 4;
/** The particle field tiles over this window (a 1080p view at zoom 1) and repeats with the camera. */
export const DEPTH_FIELD_WU = { width: 1920, height: 1080 } as const;
export const DEPTH_PARALLAX = { far: 0.85, near: 1.1, bokeh: 1.25 } as const;

// ---- motes and fragments (sheet 02, VISUAL-STYLE §2, §5) ----
export const MOTE_ATLAS_PX_PER_WU = 4;
export const MOTE_SMALL_VARIANT_PX_PER_WU = 1;
export const ALGAE_GLOW = { soft: 1.6, softAlpha: 0.3, wide: 3, wideAlpha: 0.22 } as const;
export const DETRITUS_GLOW = { soft: 1.4, softAlpha: 0.3, wide: 2.8, wideAlpha: 0.2 } as const;
export const DETRITUS_ASPECT = 0.85;
export const DETRITUS_FADE_FRACTION = 0.2;
export const BACTERIUM_BODY_ALPHA = 0.55;
export const BACTERIUM_HALO_ALPHA = 0.3;
export const BACTERIUM_BANDS = 3;
export const MOTE_BREATH_AMPLITUDE = 0.06;
export const MOTE_BREATH_HZ_MIN = 0.3;
export const MOTE_BREATH_HZ_MAX = 0.6;
export const MOTE_SCALE_MIN = 0.7;
export const MOTE_SCALE_MAX = 1.5;
export const BACTERIUM_TUMBLE_DEG = 15;
export const BACTERIUM_TUMBLE_HZ = 0.8;
export const DNA_FRAGMENT_SIZE_WU = { length: 22, height: 9 } as const;
export const DNA_FRAGMENT_RUNGS = 5;
export const DNA_FRAGMENT_RUNG_PX = 2;
export const DNA_FRAGMENT_ROTATION_DEG_PER_SECOND = 20;
export const DNA_FRAGMENT_HALO = { radius: 14, alpha: 0.2, innerRadius: 12, innerAlpha: 0.3 } as const;

// ---- glow atlas (ASSET-GENERATION §1.5) ----
export const GLOW_TEXTURE_PX = 128;
export const GLOW_LAYERS = { core: 0.18, soft: 0.45, wide: 1.0, glintOffset: -0.32, glintRadius: 0.07 } as const;
export const GLOW_LAYER_ALPHAS = { core: 1, soft: 0.5, wide: 0.22, glint: 0.7 } as const;
export const RING_TEXTURE_PX = 256;
export const RING_WIDTH_FRACTION = 0.06;
export const RAY_TEXTURE_PX = { width: 16, height: 128 } as const;

// ---- effects (sheet 03, VISUAL-STYLE §5) ----
export const LEVEL_UP_RAYS = 16;
export const LEVEL_UP_RAY_WIDTH_RADII = 0.08;
export const LEVEL_UP_RIPPLES = 3;
export const EFFECT_RING_ALPHA = 0.6;
export const EFFECT_HALO_ALPHA = 0.5;
export const ABSORBED_STREAMS = 3;
export const ABSORBED_STREAM_SPREAD_DEG = 25;
export const ABSORBED_RIM_DASH_PX = [5, 6] as const;
export const RETICLE_RADIUS_PX = 10;
export const RETICLE_DOT_SPACING_PX = 10;
export const RETICLE_DOT_RADIUS_PX = 1.5;
export const RETICLE_ALPHA = 0.55;
export const ZONE_ENTRY_BRIGHTEN = 0.2;
export const ZONE_ENTRY_SECONDS = 0.3;
/** After an eat effect the halo sprite fades over the clip's last tween. */
export const EAT_HALO_FADE_START = 0.55;

// ---- camera (render side of GAME-DESIGN §7) ----
export const CAMERA_REFERENCE_VIEWPORT_HEIGHT_PX = 1080;
export const CAMERA_CULL_MARGIN_RADII = 1;

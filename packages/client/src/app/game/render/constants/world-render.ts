// The dish, food, depth, effects, layer order and camera numbers (docs/VISUAL-STYLE.md §1, §2, §5,
// §8; sheet 02; docs/RENDERING.md §6). Units: wu unless the suffix says px, seconds or degrees.
// The bench scene and the frame-budget numbers of docs/RENDERING.md §7 are the `bench.ts` page.

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
export const CAUSTIC_ALPHA = 0.05;
export const ZONE_TINT_ALPHA = { shallows: 0.16, vent: 0.13, gel: 0.14 } as const;
export const ZONE_CLOUD_ALPHA = 0.36;
export const ZONE_CLOUD_OCTAVES = 3;
export const ZONE_CLOUD_CYCLES = 9;
export const MIRE_STRAND_ALPHA_MIN = 0.1;
export const MIRE_STRAND_ALPHA_MAX = 0.26;
export const MIRE_STRANDS_PER_PATCH = 12;
export const WALL_INNER_SHADOW_WU = 26;
export const WALL_INNER_SHADOW_ALPHA = 0.35;
export const WALL_INNER_SHADOW_BLUR_WU = 10;
export const WALL_GLASS_WU = 34;
export const WALL_GLASS_INNER_WU = 12;
export const WALL_GLASS_OUTER_WU = 1.5;
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
export const VENT_SHIMMER_SCALE_PX = 6;
export const VENT_SHIMMER_SPEED_WU_PER_SECOND = 40;
export const VENT_GLINT_HZ_MIN = 6;
export const VENT_GLINT_HZ_MAX = 9;

// ---- the field bake (sheet 02 field, zone and dish-wall tables; docs/RENDERING.md §6) ----
/** The light pool's middle stop (sheet 02 `light-pool`: 9 % → 3 % at half the radius → 0). */
export const LIGHT_POOL_MID = { stop: 0.5, alpha: 0.03 } as const;

// ---- the condenser light pool, anchored to the view (docs/VISUAL-STYLE.md §1, docs/RENDERING.md §6.1) ----
/** The pool's centre as fractions of the viewport's width and height: sheet 02's (380, 200) in its 1920 × 1080 scene. */
export const LIGHT_POOL_VIEW_CENTRE = { x: 0.2, y: 0.185 } as const;
/** The pool's radii as fractions of the viewport's width and height: sheet 02's 980 × 760 wu at zoom 1. */
export const LIGHT_POOL_VIEW_RADII = { x: 0.51, y: 0.7 } as const;
/** The pool bake's square edge in texels; its half-size is the pool's radius on each axis. */
export const LIGHT_POOL_TEXTURE_PX = 1024;
/** Sheet 02's ellipse radii in wu: the frame `CAUSTIC_SWEEPS` are drawn in, mapped per axis onto the bake's half-size. */
export const LIGHT_POOL_SHEET_RADII_WU = { x: 980, y: 760 } as const;
/** The caustics (sheet 02): three open cubic sweeps across the pool, control points in wu from its centre. */
export const CAUSTIC_SWEEPS = [
  {
    widthWu: 3,
    start: { x: -420, y: 420 },
    control1: { x: -160, y: 270 },
    control2: { x: 140, y: 180 },
    end: { x: 520, y: -240 },
  },
  {
    widthWu: 2,
    start: { x: -420, y: 560 },
    control1: { x: -120, y: 390 },
    control2: { x: 240, y: 270 },
    end: { x: 700, y: -240 },
  },
  {
    widthWu: 1.5,
    start: { x: -260, y: 920 },
    control1: { x: 40, y: 640 },
    control2: { x: 380, y: 440 },
    end: { x: 880, y: -240 },
  },
] as const;
/** A stroke thinner than this many field texels is drawn this wide: sub-texel coverage fades it out. */
export const FIELD_MIN_STROKE_TEXELS = 1;
/** A zone disc's tint decays through this stop (sheet 02 zone gradients) to 0 at the zone radius. */
export const ZONE_TINT_MID_STOP = 0.55;
export const ZONE_TINT_MID_ALPHA = { shallows: 0.07, vent: 0.06, gel: 0.06 } as const;
/** The shallows annulus feathers over this share of its width on the broth side. */
export const SHALLOWS_FEATHER_SHARE = 0.35;
/** Mire strands (sheet 02 `mire-filaments`): gentle short curves scattered over the patch, 0.9–2.1 wu wide. */
export const MIRE_STRAND = {
  widthWuMin: 0.9,
  widthWuMax: 2.1,
  rootShareMax: 0.85,
  lengthShareMin: 0.12,
  lengthShareMax: 0.3,
  bendShare: 0.5,
} as const;
/** The stage scratches outside the wall (sheet 02 dish-wall table): short faint lines, seeded, this many glass widths out. */
export const STAGE_SCRATCHES = {
  count: 24,
  innerMarginGlass: 2,
  lengthWuMin: 40,
  lengthWuMax: 200,
  widthWu: 0.8,
  alphaMin: 0.25,
  alphaMax: 0.35,
} as const;
/** The field texture reaches past the wall by this many glass widths so the stage shows around it. */
export const FIELD_OUTSIDE_MARGIN_GLASS = 3;

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
/** The specular glint on every baked body (VISUAL-STYLE §1): toward the light, as shares of the body radius. */
export const BAKE_GLINT = { offsetShare: 0.45, lengthShare: 0.35, widthShare: 0.16, rotationTurns: -0.125 } as const;
/** The algae and detritus bakes: edge and rim as shares of the radius, the lipid centre, the glint. */
export const MOTE_BAKE = {
  edgeWidthShare: 0.18,
  rimWidthShare: 0.08,
  lipidCentreShare: 0.45,
  glintAlpha: 0.7,
} as const;
/** The bacterium rod bakes: halo reach, rim, bands, the plain rod's film halo and the sheen along its top. */
export const BACTERIUM_BAKE = {
  haloReach: 2.2,
  rimWidthShare: 0.12,
  bandWidthShare: 0.16,
  bandAlpha: 0.7,
  glintAlpha: 0.7,
  plainHaloAlpha: 0.12,
  sheen: { liftShare: 0.22, lengthShare: 0.7, widthShare: 0.12, alpha: 0.18 },
} as const;
/** The DNA fragment bake: helix turns over the length, strand width and the strand / rung alphas. */
export const FRAGMENT_BAKE = { helixTurns: 2, strandPx: 2, strandAlpha: 0.95, rungAlpha: 0.85 } as const;
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
/** A bacterium that moved less than this between two frames is still: its rod keeps the heading it had (docs/RENDERING.md §1). */
export const BACTERIUM_HEADING_STILL_WU = 0.05;
/** Clear texels between two sprites of a packed atlas, so linear sampling never bleeds a neighbour in. */
export const ATLAS_PADDING_PX = 2;

// ---- glow atlas (ASSET-GENERATION §1.5) ----
export const GLOW_TEXTURE_PX = 128;
export const GLOW_LAYERS = { core: 0.18, soft: 0.45, wide: 1.0, glintOffset: -0.32, glintRadius: 0.07 } as const;
export const GLOW_LAYER_ALPHAS = { core: 1, soft: 0.5, wide: 0.22, glint: 0.7 } as const;
export const RING_TEXTURE_PX = 256;
export const RING_WIDTH_FRACTION = 0.06;
/** The ring feathers over this many ring widths on its inner side. */
export const RING_INNER_FEATHER_WIDTHS = 2;
export const RAY_TEXTURE_PX = { width: 16, height: 128 } as const;
export const RAY_BASE_ALPHA = 0.9;
export const RAY_GRADIENT_STOPS = 3;

// ---- effects (sheet 03, VISUAL-STYLE §5) ----
export const LEVEL_UP_RAYS = 16;
export const LEVEL_UP_RAY_WIDTH_RADII = 0.08;
/** The rays sit outside the body (sheet 03 strip C frame 03): base at the rim, the `rayRadii` track is the tip. */
export const LEVEL_UP_RAY_BASE_RADII = 1.2;
/** Three concentric dish ripples at these radii (sheet 03 strip C, RENDERING §4), pushed outward by the `rippleRadii` track. */
export const LEVEL_UP_RIPPLE_RADII = [1.7, 2.1, 2.5] as const;
export const LEVEL_UP_RIPPLES = LEVEL_UP_RIPPLE_RADII.length;
export const EFFECT_RING_ALPHA = 0.6;
export const EFFECT_HALO_ALPHA = 0.5;
export const ABSORBED_STREAMS = 3;
export const ABSORBED_STREAM_SPREAD_DEG = 25;
export const ABSORBED_RIM_DASH_PX = [5, 6] as const;
export const RETICLE_RADIUS_PX = 10;
export const RETICLE_DOT_SPACING_PX = 10;
export const RETICLE_DOT_RADIUS_PX = 1.5;
export const RETICLE_ALPHA = 0.55;
/** The dotted line from the own cell to the pointer stops here: enough for a pointer at the far corner of a 1080p view. */
export const RETICLE_LINE_MAX_DOTS = 120;
/** The DNA streams of an absorption, as a share of the prey's radius (sheet 03 strip B). */
export const ABSORBED_STREAM_RADII = 0.5;
/** Each ripple of a level-up is this share of the previous one's alpha (sheet 03 strip C: three fading ripples). */
export const LEVEL_UP_RIPPLE_FALLOFF = 0.6;
/** The eat strip's halo (sheet 03 A frame 04 "rim flare, halo"): a soft glow at the pulse and a ring that fades at settle. */
export const EAT_HALO_ALPHA = 0.5;
export const EAT_HALO_RING_ALPHA = 0.6;
/**
 * A running effect whose cell was never drawn (a respawn off screen) sizes its sprites on this radius (wu):
 * a little under the level-1 protocell (mass 20 → 17.9 wu at the default radius scale), so an unseen bloom
 * never reads larger than the cell it announces.
 */
export const EFFECT_FALLBACK_RADIUS_WU = 12;
export const ZONE_ENTRY_BRIGHTEN = 0.2;
export const ZONE_ENTRY_SECONDS = 0.3;
/** After an eat effect the halo sprite fades over the clip's last tween. */
export const EAT_HALO_FADE_START = 0.55;

// ---- camera (render side of GAME-DESIGN §7) ----
export const CAMERA_REFERENCE_VIEWPORT_HEIGHT_PX = 1080;
export const CAMERA_CULL_MARGIN_RADII = 1;

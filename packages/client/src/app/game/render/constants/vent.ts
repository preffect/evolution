// The vent sprite (sheet 02 vent table, back → front; docs/RENDERING.md §6): one page of
// render/constants.ts. Units: wu unless the suffix says px; alphas are shares of 1.
// Baked on its own canvas so its hairlines survive zoom 1.8 (the field is 0.33 px/wu). Positions are
// wu in the fissure's frame (rotated `VENT_FISSURE_ROTATION_DEG`, −y rising); a `blurWu` is the
// sheet's blur, drawn as a feather that far past the shape's rim.
export const VENT_SPRITE_PX_PER_WU = 2;
/** Where the sprite sits: the vent disc is at the origin (ECOLOGY §2, `VENT_RADIUS`). */
export const VENT_CENTRE_WU = { x: 0, y: 0 } as const;
export const VENT_SPRITE_PADDING_WU = 80;
export const VENT_FISSURE_SIZE_WU = { length: 190, width: 60 } as const;
export const VENT_FISSURE_ROTATION_DEG = -18;
export const VENT_HEAT_POOL = { radiusX: 170, radiusY: 80, alpha: 0.2, blurWu: 40 } as const;
export const VENT_HOT_COLUMN = { x: 6, y: -70, radiusX: 60, radiusY: 120, alpha: 0.1, blurWu: 40 } as const;
export const VENT_SEAM_BED = { radiusX: 64, radiusY: 18, alpha: 0.5, blurWu: 10 } as const;
export const VENT_CRUST_SHADOW = { radiusX: 118, radiusY: 34, alpha: 0.5, blurWu: 16 } as const;
/** Each basalt plate: a wavy seam-side edge this far from the seam, an elliptical far edge. */
export const VENT_CRUST_PLATE = {
  halfLengthWu: 94,
  gapWu: 6,
  thicknessWu: 20,
  waves: 3,
  waveAmplitudeWu: 6,
  edgeSteps: 36,
  alpha: 0.72,
  blurWu: 1.5,
} as const;
export const VENT_CRUST_RIM_LINE = { widthWu: 1.2, alpha: 0.7 } as const;
/** The plume-coloured rim where the seam lights the crust: dashes over the seam-side edge. */
export const VENT_CRUST_GLOW_LINE = { widthWu: 0.8, alpha: 0.45, segments: 3, segmentShare: 0.2 } as const;
/** Branching hairline cracks off the seam: two segments each, the second fading. */
export const VENT_CRACKS = {
  count: 7,
  rootShare: 0.6,
  segmentWuMin: 10,
  segmentWuMax: 18,
  spreadTurns: 0.12,
  widthWuMin: 0.9,
  widthWuMax: 1.1,
  alphaMin: 0.35,
  alphaMax: 0.5,
  fadeShare: 0.6,
} as const;
/** The molten seam: a wavy line, its glow, hot line and white core, the core over a shorter span. */
export const VENT_SEAM = { halfLengthWu: 58, coreHalfLengthWu: 46, waves: 1.5, amplitudeWu: 4, steps: 24 } as const;
export const VENT_SEAM_GLOW = { widthWu: 9, alpha: 0.55, blurWu: 6 } as const;
export const VENT_SEAM_HOT_LINE = { widthWu: 3.2, alpha: 0.95, blurWu: 1.5 } as const;
export const VENT_SEAM_CORE = { widthWu: 1.1, alpha: 0.9 } as const;
/** The two hottest points, as shares of the seam half-length (the in-game 6–9 Hz flicker is the shimmer's). */
export const VENT_SEAM_GLINTS = [
  { share: -0.38, radiusWu: 1.6, alpha: 0.9 },
  { share: 0.31, radiusWu: 1.3, alpha: 0.85 },
] as const;
/** Refraction arcs climbing off the seam, first to last: wider, fainter, thinner as they rise. */
export const VENT_SHIMMER_ARCS = {
  count: 4,
  riseWuFirst: 30,
  riseWuLast: 120,
  halfWidthWuFirst: 50,
  halfWidthWuLast: 106,
  sagittaShare: 0.35,
  widthWuFirst: 1.3,
  widthWuLast: 1,
  alphaFirst: 0.2,
  alphaLast: 0.05,
} as const;
/** Rim-lit bubbles rising off the seam, shrinking and fading with height; positions seeded. */
export const VENT_BUBBLES = {
  count: 8,
  radiusWuMin: 2,
  radiusWuMax: 4.2,
  riseWuMin: 18,
  riseWuMax: 126,
  spreadWu: 34,
  alphaNear: 1,
  alphaFar: 0.4,
} as const;
/** The plume (sheet 02 `vent-plume`): soft motes drifting up in the world frame, fading with height. */
export const VENT_PLUME_MOTES = {
  count: 24,
  radiusWuMin: 1.8,
  radiusWuMax: 3.6,
  riseWuMin: 70,
  riseWuMax: 340,
  spreadWuNear: 40,
  spreadWuFar: 170,
  alphaNear: 0.46,
  alphaFar: 0.08,
  blurWu: 1.5,
} as const;
/** A bubble (sheet 02 `bubble`), as shares of its radius: halo, fill ramp, rim, inner ring, glint. */
export const BUBBLE_BAKE = {
  haloReach: 1.35,
  haloAlpha: 0.16,
  fillCentreAlpha: 0.15,
  fillMidStop: 0.7,
  fillMidAlpha: 0.12,
  fillRimAlpha: 0.55,
  rimWidthShare: 0.14,
  rimAlpha: 0.75,
  innerRingShare: 0.72,
  innerRingWidthShare: 0.08,
  innerRingAlpha: 0.5,
  glintAlpha: 0.85,
} as const;
/** A soft stroke is this many concentric strokes, widest first, compositing to its alpha at the centre. */
export const SOFT_STROKE_LAYERS = 6;

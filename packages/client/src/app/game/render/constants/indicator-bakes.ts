// How the own-cell indicator bakes are painted (docs/rendering/own-cell-indicators.md §10, docs/ASSET-GENERATION.md §1):
// the shares, alphas and px details that turn docs/ui/components-and-constants.md §9's sizes into layered, shaded sprites —
// the ghost silhouettes, the pip blocks, the label pill — the arc primitive's row layout, and the two
// BitmapFont installs. §9 (`own-cell.ts`) owns every size a player reads; this page owns only what is painted
// inside those sizes, the way `organelles.ts` does for the organelle atlas. Px are CSS px.

import { BACTERIUM_VARIANT } from '@evolution/shared';
import { CHLORO_BASE, CHLORO_LIGHT, MITO_BASE, MITO_DARK, MITO_LIGHT, WHITE } from './colours';

/** The bakes rasterise at the device pixel ratio rounded up and capped, so a sprite at its px size never upsamples. */
export const INDICATOR_BAKE_MAX_DPR = 2;

// ---- the arc primitive (docs/rendering/own-cell-indicators.md §10, `effects/arc-mesh.ts`) ----
/**
 * Arc rows one frame draws: at most six (the DNA track and fill, two orbit backings, two unlock rings), with
 * room for two more. The escape track and arc replace the orbit, so they never add to it.
 */
export const ARC_INSTANCE_CAPACITY = 8;
/** RGBA float texels per arc row. */
export const ARC_INSTANCE_TEXELS = 3;
/** Each field's float offset in a row, four per texel: centre, radius, half stroke | start, sweep, cap | colour, alpha. */
export const ARC_INSTANCE_FIELD = {
  x: 0,
  y: 1,
  radius: 2,
  halfStroke: 3,
  startRadians: 4,
  sweepRadians: 5,
  isRoundCap: 6,
  red: 8,
  green: 9,
  blue: 10,
  alpha: 11,
} as const;
/** The quad's margin past the stroke in screen px: room for the one-px anti-aliased edge. */
export const ARC_EDGE_FEATHER_PX = 1;

/** A three-tone ramp: `tone` is the colour the item reads as, `light` faces the light, `dark` the far side. */
export interface IndicatorRamp {
  readonly light: string;
  readonly tone: string;
  readonly dark: string;
}

/**
 * Each counter's organelle colour (ui/hud.md §3.1.2), keyed by the bacterium variant it tallies: the
 * aerobic counter is the mitochondrion's orange, the photosynthetic one the chloroplast's light green.
 */
export const INDICATOR_VARIANT_RAMP = {
  [BACTERIUM_VARIANT.aerobic]: { light: MITO_LIGHT, tone: MITO_BASE, dark: MITO_DARK },
  [BACTERIUM_VARIANT.photosynthetic]: { light: WHITE, tone: CHLORO_LIGHT, dark: CHLORO_BASE },
} as const satisfies Readonly<Record<string, IndicatorRamp>>;

/** The nucleus parts' ghosts bake white and take the player's rim colour as a tint (ui/hud.md §3.1.2). */
export const INDICATOR_RIM_TINTED_RAMP: IndicatorRamp = { light: WHITE, tone: WHITE, dark: WHITE };

/** Every ghost's layers, inside `LADDER_GHOST_PX`: halo, lit wash, faint trace, dashed rim, detail, glint. */
export const GHOST_BAKE = {
  /** The halo reaches this share of the half-length past the silhouette. */
  haloReach: 1.45,
  haloAlpha: 0.32,
  washAlpha: 0.3,
  /** The continuous trace under the dashes, so the outline reads between them. */
  traceAlpha: 0.28,
  strokePx: 1.2,
  dashPx: 2.5,
  dashGapPx: 2,
  dashAlpha: 0.95,
  detailPx: 1,
  detailAlpha: 0.8,
  glintAlpha: 0.65,
} as const;

/** Each silhouette's half-height as a share of its half-length (the long axis lies along the orbit). */
export const GHOST_ASPECT = { bean: 0.5, lens: 0.5, loop: 0.72, envelope: 1, slipper: 0.62 } as const;

/** The bean's cristae: folds across the bean, spread over a share of its half-length, each a share of its half-height. */
export const GHOST_CRISTAE = { count: 3, spreadShare: 0.86, heightShare: 0.7, bendShare: 0.6 } as const;
/** The lens's granules: dots along its long axis, spread over a share of its half-length. */
export const GHOST_GRANULES = { count: 3, spreadShare: 1.14, radiusPx: 1 } as const;
/** The nucleoid loop: a closed curve wobbling on `lobes` terms. */
export const GHOST_LOOP = { steps: 48, lobes: 3, wobbleShare: 0.08 } as const;
/** The envelope's pores: evenly round the rim from the light direction, each with a small glow. */
export const GHOST_PORES = { count: 6, radiusPx: 1, glowReach: 2.2, glowAlpha: 0.45 } as const;

/** One cubic segment in shares of the half-length (x) and half-height (y): control 1, control 2, end. */
export type ShareSegment = readonly [number, number, number, number, number, number];
/** A path in those shares: a start point, then cubic segments. */
export interface SharePath {
  readonly start: readonly [number, number];
  readonly segments: readonly ShareSegment[];
}

/** The chloroplast's lens: two arcs meeting at pointed tips (4/3 controls peak the curve at the half-height). */
export const GHOST_LENS_PATH: SharePath = {
  start: [-1, 0],
  segments: [
    [-0.35, -1.33, 0.35, -1.33, 1, 0],
    [0.35, 1.33, -0.35, 1.33, -1, 0],
  ],
};

/** The form's slipper: the narrow tail at −x, the blunt nose at +x and the oral notch in its belly. */
export const GHOST_SLIPPER_PATH: SharePath = {
  start: [-1, 0.05],
  segments: [
    [-1, -0.55, -0.45, -1, 0.35, -1],
    [0.8, -1, 1, -0.6, 1, -0.1],
    [1, 0.5, 0.8, 0.95, 0.45, 0.95],
    [0.25, 0.95, 0.2, 0.45, 0.05, 0.45],
    [-0.25, 0.45, -1, 0.7, -1, 0.05],
  ],
};

/** The slipper's oral groove: from mid-body into the notch. */
export const GHOST_SLIPPER_GROOVE_PATH: SharePath = {
  start: [0.55, 0.1],
  segments: [[0.35, 0.2, 0.2, 0.3, 0.05, 0.45]],
};

/** The nucleoid's coiled thread across the loop. */
export const GHOST_LOOP_THREAD_PATH: SharePath = {
  start: [-0.55, 0.25],
  segments: [
    [-0.3, -0.6, 0, 0.6, 0.25, -0.1],
    [0.4, -0.45, 0.5, -0.2, 0.6, 0.15],
  ],
};

/**
 * A pip block's layers. A lit pip: a contact shadow away from the light, a halo, a body ramp whose
 * light focus sits toward the light (a share of the pip's radius), a glint. An unlit pip: a faint
 * wash and its outline.
 */
export const PIP_BAKE = {
  haloPx: 1.5,
  haloAlpha: 0.4,
  shadowOffsetPx: 0.6,
  shadowAlpha: 0.5,
  focusShare: 0.4,
  glintAlpha: 0.75,
  unlitWashAlpha: 0.14,
} as const;

/** The label pill: a danger glow, a lit-top body, a top highlight and the danger rim; stretched only across its middle. */
export const LABEL_PILL_BAKE = {
  glowPx: 3,
  glowAlpha: 0.3,
  highlightAlpha: 0.14,
  highlightInsetPx: 3,
  /** The stretchable middle column of the bake. */
  stretchPx: 2,
} as const;

/** The two BitmapFont installs (visual-style/ui-type.md §7 roles): one shared install each, named for `BitmapText`. */
export const INDICATOR_FONT = {
  value: {
    name: 'evolution-indicator-value',
    weight: 'normal',
    // The numeral, and the legibility cues' amounts and rates: `+3`, `−9.4/s` (docs/ui/hud.md §3.1.5).
    chars: '0123456789+−./s',
  },
  label: {
    name: 'evolution-indicator-label',
    weight: 'bold',
    // Pre-rendered set; a player name with other glyphs adds them on first use (DynamicBitmapFont). The cues add the
    // signs of `−15 %` and `×1.5`.
    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ·'-.!?−+%×/",
  },
} as const;
/** Glyph padding in the font atlas, so the numeral's outline is never clipped. */
export const INDICATOR_FONT_PADDING_PX = 4;

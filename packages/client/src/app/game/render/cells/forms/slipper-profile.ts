// The paramecium's slipper (#193; docs/rendering/cells.md §2.4, sheet 04): `B(Δ)` is the polar ellipse of the tier's
// aspect (length : width 1.6 / 1.8 / 2.0), fuller at the blunt front, notched by the oral groove on one flank, and
// scaled to unit area so mass ∝ area holds. The GLSL twin (`slipperAt`, `cell-shader-slipper.ts`) reads the same
// aspect and scale per tier.

import { RADIANS_PER_FULL_TURN, tierEntryOf, type TraitTier } from '@evolution/shared';
import {
  FORM_AREA_SAMPLES,
  SLIPPER_ASPECT_BY_TIER,
  SLIPPER_FRONT_BLUNTNESS,
  SLIPPER_ORAL_GROOVE_DEG,
  SLIPPER_ORAL_GROOVE_DEPTH,
  SLIPPER_ORAL_GROOVE_SIGMA_DEG,
} from '../../constants';
import { degreesToRadians, gaussianBump, wrapAngle } from '../../geometry';
import type { FormProfile } from '../radial-profile';

const GROOVE_CENTRE = degreesToRadians(SLIPPER_ORAL_GROOVE_DEG);
const GROOVE_SIGMA = degreesToRadians(SLIPPER_ORAL_GROOVE_SIGMA_DEG);

/** One tier's slipper: its aspect and the scale that brings its area to the unit disc's. */
export interface SlipperShape {
  readonly aspect: number;
  readonly areaScale: number;
}

/** The unscaled slipper at `delta` and its derivative: ellipse × blunt front × oral groove. */
function rawSlipperAt(aspect: number, delta: number): { readonly value: number; readonly derivative: number } {
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const ellipse = 1 / Math.sqrt((cos * cos) / aspect + aspect * sin * sin);
  const ellipseDerivative = -ellipse * ellipse * ellipse * sin * cos * (aspect - 1 / aspect);
  const front = 1 + SLIPPER_FRONT_BLUNTNESS * cos;
  const frontDerivative = -SLIPPER_FRONT_BLUNTNESS * sin;
  const notch = gaussianBump(SLIPPER_ORAL_GROOVE_DEPTH, wrapAngle(delta - GROOVE_CENTRE), GROOVE_SIGMA);
  const groove = 1 - notch.value;
  return {
    value: ellipse * front * groove,
    derivative:
      ellipseDerivative * front * groove + ellipse * frontDerivative * groove - ellipse * front * notch.derivative,
  };
}

/** `1 / sqrt(∫ raw² dΔ / 2π)`: the scale that gives the slipper the unit disc's area. */
function areaScaleOf(aspect: number): number {
  let sum = 0;
  for (let index = 0; index < FORM_AREA_SAMPLES; index += 1) {
    const value = rawSlipperAt(aspect, (index / FORM_AREA_SAMPLES) * RADIANS_PER_FULL_TURN - Math.PI).value;
    sum += value * value;
  }
  return 1 / Math.sqrt(sum / FORM_AREA_SAMPLES);
}

/** The three tiers' slippers, in tier order. */
export const SLIPPER_SHAPES: readonly SlipperShape[] = SLIPPER_ASPECT_BY_TIER.map((aspect) => ({
  aspect,
  areaScale: areaScaleOf(aspect),
}));

const [SLIPPER_TIER_I_SHAPE] = SLIPPER_SHAPES as [SlipperShape];

/** The slipper at `tier`; past the table, tier I's. */
export function slipperShapeAt(tier: TraitTier): SlipperShape {
  return tierEntryOf(SLIPPER_SHAPES, tier) ?? SLIPPER_TIER_I_SHAPE;
}

function slipperProfileOf(shape: SlipperShape): FormProfile {
  return {
    evaluate: (delta) => {
      const raw = rawSlipperAt(shape.aspect, delta);
      return { value: shape.areaScale * raw.value, derivative: shape.areaScale * raw.derivative };
    },
    // The ellipse and the blunt front both peak at the nose and the groove only takes away: an exact bound.
    peak: shape.areaScale * Math.sqrt(shape.aspect) * (1 + SLIPPER_FRONT_BLUNTNESS),
  };
}

const SLIPPER_PROFILES: readonly FormProfile[] = SLIPPER_SHAPES.map(slipperProfileOf);
const [SLIPPER_TIER_I_PROFILE] = SLIPPER_PROFILES as [FormProfile];

/** `B(Δ)` of the slipper at `tier`. */
export function slipperProfileAt(tier: TraitTier): FormProfile {
  return tierEntryOf(SLIPPER_PROFILES, tier) ?? SLIPPER_TIER_I_PROFILE;
}

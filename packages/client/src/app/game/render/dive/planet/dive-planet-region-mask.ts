// Where the planet draws the Salish region's own land over the world's biomes (docs/rendering/opening-dive.md §4,
// ticket #817): a rounded box, its edge moved inward by noise, ending inside the region's box. The mockup feathered
// the box itself, so from about 2,300 km down to 1,000 km the region's relief and its dry side read as a soft
// rectangle against the world's green. The mask is written once (`regionDetailMaskOf`) over a few operations:
// over numbers it is `diveRegionDetailMask`, which a spec pins the shape of, and over GLSL text it is the shader's
// `regionDetailMask` return, so the two cannot drift apart. Only the edge noise is the shader's alone.

import { DIVE_PLANET_REGION_DETAIL_MASK } from '../../constants';
import { HALF, smoothstep } from '../../geometry';
import { glslFloat } from '../../cells/cell-shader-source';

const MASK = DIVE_PLANET_REGION_DETAIL_MASK;
/** The fine octave's offset from the broad one, so the two never line up. */
const FINE_WARP_OFFSET = 3.7;

/** The operations the mask is written in, over numbers or over GLSL expressions. */
export interface MaskArithmetic<Term> {
  constant(value: number): Term;
  add(left: Term, right: Term): Term;
  subtract(left: Term, right: Term): Term;
  multiply(left: Term, right: Term): Term;
  divide(left: Term, right: Term): Term;
  absolute(value: Term): Term;
  power(base: Term, exponent: Term): Term;
  /** 1 at `from` down to 0 at `until` (`from` > `until`), smoothstepped: the shader's `smoothFall`. */
  smoothFall(from: Term, until: Term, value: Term): Term;
}

export const NUMBER_ARITHMETIC: MaskArithmetic<number> = {
  constant: (value) => value,
  add: (left, right) => left + right,
  subtract: (left, right) => left - right,
  multiply: (left, right) => left * right,
  divide: (left, right) => left / right,
  absolute: (value) => Math.abs(value),
  power: (base, exponent) => Math.pow(base, exponent),
  smoothFall: (from, until, value) => 1 - smoothstep(until, from, value),
};

export const GLSL_ARITHMETIC: MaskArithmetic<string> = {
  constant: glslFloat,
  add: (left, right) => `(${left} + ${right})`,
  subtract: (left, right) => `(${left} - ${right})`,
  multiply: (left, right) => `(${left} * ${right})`,
  divide: (left, right) => `(${left} / ${right})`,
  absolute: (value) => `abs(${value})`,
  power: (base, exponent) => `pow(${base}, ${exponent})`,
  smoothFall: (from, until, value) => `smoothFall(${from}, ${until}, ${value})`,
};

/**
 * The region's detail weight at the box unit (`unitX`, `unitY`: 0 → 1 across the region's box, each way) with the
 * edge noise `warp` (0 → 1): a superellipse round the box's middle, its edge moved inward by the noise.
 */
export function regionDetailMaskOf<Term>(math: MaskArithmetic<Term>, unitX: Term, unitY: Term, warp: Term): Term {
  const half = math.constant(HALF);
  const roundness = math.constant(MASK.roundness);
  const reachOf = (unit: Term): Term =>
    math.power(math.divide(math.absolute(math.subtract(unit, half)), half), roundness);
  const radius = math.power(math.add(reachOf(unitX), reachOf(unitY)), math.constant(1 / MASK.roundness));
  const warped = math.add(radius, math.multiply(math.constant(MASK.edgeWarp), warp));
  return math.smoothFall(math.constant(MASK.goneFrom), math.constant(MASK.fullWithin), warped);
}

/**
 * The region's detail weight at `boxUnit` (0 → 1 across the region's box, each way) with the edge noise `warpNoise`
 * (0 → 1): 1 well inside, 0 from before the box's edge whatever the noise.
 */
export function diveRegionDetailMask(boxUnit: readonly [number, number], warpNoise: number): number {
  return regionDetailMaskOf(NUMBER_ARITHMETIC, boxUnit[0], boxUnit[1], warpNoise);
}

/** The shader's mask over its box unit `ru` and its edge noise `warp`: the return of `regionDetailMask`. */
export const DIVE_REGION_DETAIL_MASK_EXPRESSION = regionDetailMaskOf(GLSL_ARITHMETIC, 'ru.x', 'ru.y', 'warp');

/** The shader's `regionDetailMask(ru, ld)`: the box unit `ru` and the place in degrees `ld` for its edge noise. */
export const DIVE_REGION_DETAIL_MASK_SOURCE = /* glsl */ `
float regionDetailMask(vec2 ru, vec2 ld) {
  float warp = ${glslFloat(MASK.warpShares.broad)} * valueNoise(ld / ${glslFloat(MASK.warpDegrees.broad)}) +
               ${glslFloat(MASK.warpShares.fine)} * valueNoise(ld / ${glslFloat(MASK.warpDegrees.fine)} + ${glslFloat(FINE_WARP_OFFSET)});
  return ${DIVE_REGION_DETAIL_MASK_EXPRESSION};
}
`;

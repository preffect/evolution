// Where the planet draws the Salish region's own land over the world's biomes (docs/rendering/opening-dive.md §4,
// ticket #817): a rounded box, its edge moved inward by noise, ending inside the region's box. The mockup feathered
// the box itself, so from about 2,300 km down to 1,000 km the region's relief and its dry side read as a soft
// rectangle against the world's green. `diveRegionDetailMask` is the shader's `regionDetailMask` term for term, with
// its noise given as a number, so a spec can pin the shape; the GLSL is made from the same constants.

import { DIVE_PLANET_REGION_DETAIL_MASK } from '../../constants';
import { HALF, smoothstep } from '../../geometry';
import { glslFloat } from '../../cells/cell-shader-source';

const MASK = DIVE_PLANET_REGION_DETAIL_MASK;
/** The fine octave's offset from the broad one, so the two never line up. */
const FINE_WARP_OFFSET = 3.7;

/**
 * The region's detail weight at `boxUnit` (0 → 1 across the region's box, each way) with the edge noise `warpNoise`
 * (0 → 1): 1 well inside, 0 from before the box's edge whatever the noise.
 */
export function diveRegionDetailMask(boxUnit: readonly [number, number], warpNoise: number): number {
  const fromMiddle = boxUnit.map((unit) => Math.abs(unit - HALF) / HALF);
  const radius = Math.pow(
    fromMiddle.reduce((sum, distance) => sum + Math.pow(distance, MASK.roundness), 0),
    1 / MASK.roundness,
  );
  return 1 - smoothstep(MASK.fullWithin, MASK.goneFrom, radius + MASK.edgeWarp * warpNoise);
}

/** The shader's `regionDetailMask(ru, ld)`: the box unit `ru` and the place in degrees `ld` for its edge noise. */
export const DIVE_REGION_DETAIL_MASK_SOURCE = /* glsl */ `
float regionDetailMask(vec2 ru, vec2 ld) {
  vec2 fromMiddle = abs(ru - ${glslFloat(HALF)}) / ${glslFloat(HALF)};
  float radius = pow(pow(fromMiddle.x, ${glslFloat(MASK.roundness)}) + pow(fromMiddle.y, ${glslFloat(MASK.roundness)}), ${glslFloat(1 / MASK.roundness)});
  float warp = ${glslFloat(MASK.warpShares.broad)} * valueNoise(ld / ${glslFloat(MASK.warpDegrees.broad)}) +
               ${glslFloat(MASK.warpShares.fine)} * valueNoise(ld / ${glslFloat(MASK.warpDegrees.fine)} + ${glslFloat(FINE_WARP_OFFSET)});
  return smoothFall(${glslFloat(MASK.goneFrom)}, ${glslFloat(MASK.fullWithin)}, radius + ${glslFloat(MASK.edgeWarp)} * warp);
}
`;

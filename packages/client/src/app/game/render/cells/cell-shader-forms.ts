// The form term `B(Δ)` in GLSL (docs/rendering/cells.md §2.4): each silhouette's own helpers spliced in, then
// `formAt`, the switch over the instance's `formId` that radial-profile.ts's `FormProfile` mirrors.

import { AMOEBA_CORE_SCALE, FORM_ID } from '../constants';
import { glslFloat } from './cell-shader-source';
import { CELL_SHADER_SLIPPER } from './cell-shader-slipper';
import { CELL_SHADER_SPINDLE } from './cell-shader-spindle';

export const CELL_SHADER_FORMS = /* glsl */ `
${CELL_SHADER_SLIPPER}
${CELL_SHADER_SPINDLE}
/**
 * 'B(Δ)' per form with dB/dΔ (radial-profile.ts FormProfile): the amoeba's core (#192), the slipper (#193), the
 * spindle (#194); the blob for the rest until #195–#196.
 */
vec2 formAt(Instance inst, float delta) {
  if (abs(inst.formId - ${glslFloat(FORM_ID.amoeba)}) < HALF) return vec2(${glslFloat(AMOEBA_CORE_SCALE)}, 0.0);
  if (abs(inst.formId - ${glslFloat(FORM_ID.slipper)}) < HALF) return slipperAt(inst.formTier, delta);
  if (abs(inst.formId - ${glslFloat(FORM_ID.spindle)}) < HALF) return spindleAt(delta);
  return vec2(1.0, 0.0);
}
`;

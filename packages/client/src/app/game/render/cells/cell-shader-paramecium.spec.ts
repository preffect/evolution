// @vitest-environment node
// The paramecium in the cell shader (#193): the slipper in `formAt` and the cilia tufts in pass B must be the same
// shapes the TypeScript references bound and test (`slipper-profile.ts`, `paramecium-cilia.ts`). The GLSL is a string
// here, so what a string can prove is pinned: the baked tables, the gates and the order in the pass.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { glslFunction } from '../../../../testing/cell-glsl';
import {
  CILIA_TUFT_COUNT,
  CILIA_TUFT_REACH_RADII,
  CILIA_TUFT_ROOT_WIDTH_RADII,
  CILIA_TUFT_TIP_WIDTH_RADII,
  FORM_ID,
} from '../constants';
import { glslFloat } from './cell-shader-source';
import { SLIPPER_SHAPES } from './forms/slipper-profile';

describe('the paramecium in the cell shader', () => {
  it('draws the slipper in formAt at the instance’s form tier', () => {
    expect(glslFunction('vec2 formAt(Instance inst, float delta) {')).toContain(
      `if (abs(inst.formId - ${glslFloat(FORM_ID.slipper)}) < HALF) return slipperAt(inst.formTier, delta);`,
    );
  });

  it('bakes every tier’s aspect and unit-area scale from the TypeScript slipper', () => {
    const table = glslFunction('vec2 slipperShape(float tier) {');
    for (const shape of SLIPPER_SHAPES) {
      expect(table).toContain(`vec2(${glslFloat(shape.aspect)}, ${glslFloat(shape.areaScale)})`);
    }
  });

  it('paints the tufts in pass B on the slipper only, after the hairs and under the prey film', () => {
    const pass = glslFunction('vec4 membranePass(Instance inst, Frame frame) {');
    expect(pass.indexOf('acc = cilia(inst, frame, acc);')).toBeLessThan(
      pass.indexOf('acc = ciliaTufts(inst, frame, acc);'),
    );
    expect(pass.indexOf('ciliaTufts(')).toBeLessThan(pass.indexOf('acc *= inst.passBAlpha;'));
    expect(glslFunction('vec4 ciliaTufts(Instance inst, Frame frame, vec4 acc) {')).toContain(
      `if (abs(inst.formId - ${glslFloat(FORM_ID.slipper)}) > HALF || frame.rho < 1.0) return acc;`,
    );
  });

  it('tints the tufts with the cell’s own rim colour, never the shared CILIA (#745)', () => {
    const tufts = glslFunction('vec4 ciliaTufts(Instance inst, Frame frame, vec4 acc) {');
    expect(tufts).toContain('return over(acc, rimColour(inst), best.x * alpha * tip);');
    expect(tufts).not.toContain('uCilia');
    expect(glslFunction('vec3 shade(Instance inst, int column) {')).toContain(
      'texelFetch(uPalette, ivec2(column, int(inst.palette + HALF)), 0)',
    );
  });

  it('spaces, sizes and tapers the tufts with the TypeScript reference’s numbers', () => {
    const tuft = glslFunction('vec3 ciliaTuftAt(float index, float stretch, Instance inst) {');
    expect(tuft).toContain(`wrapAngle((index + HALF) * ${glslFloat(RADIANS_PER_FULL_TURN / CILIA_TUFT_COUNT)})`);
    expect(tuft).toContain(`${glslFloat(CILIA_TUFT_REACH_RADII)} * extension`);
    expect(glslFunction('vec3 tuftCoverage(vec3 tuft, vec3 place, float feather) {')).toContain(
      `mix(${glslFloat(CILIA_TUFT_ROOT_WIDTH_RADII)}, ${glslFloat(CILIA_TUFT_TIP_WIDTH_RADII)}, offset / tuft.y)`,
    );
  });
});

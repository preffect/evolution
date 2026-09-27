// @vitest-environment node
// The euglena in the cell shader (#194): the spindle in `formAt`, and the eyespot and the whip in pass B, must be the
// shapes the TypeScript references bound and test (`spindle-profile.ts`, `euglena-eyespot.ts`,
// `euglena-flagellum.ts`). The GLSL is a string here, so what a string can prove is pinned: the baked numbers, the
// gates, the colours and the order in the pass.

import { describe, expect, it } from 'vitest';
import {
  EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII,
  EUGLENA_FLAGELLUM_TIP_WIDTH_RADII,
  EUGLENA_FLAGELLUM_WAVES,
  FORM_ID,
  HALO_OUTER_RADII,
} from '../constants';
import { CELL_FRAGMENT_SOURCE } from './cell-shader';
import { CELL_UNIFORM, glslFloat } from './cell-shader-source';
import { EUGLENA_FLAGELLUM_LENGTH_RADII } from './forms/euglena-flagellum';
import { SPINDLE_AREA_SCALE, SPINDLE_EXPONENT_SWING, SPINDLE_HALF_LENGTH } from './forms/spindle-profile';

/** The source of the GLSL function whose signature starts `signature`, to its closing brace. */
function glslFunction(signature: string): string {
  const start = CELL_FRAGMENT_SOURCE.indexOf(signature);
  if (start < 0) throw new Error(`${signature} is not in the fragment source`);
  return CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
}

describe('the euglena in the cell shader', () => {
  it('draws the spindle in formAt', () => {
    expect(glslFunction('vec2 formAt(Instance inst, float delta) {')).toContain(
      `if (abs(inst.formId - ${glslFloat(FORM_ID.spindle)}) < HALF) return spindleAt(delta);`,
    );
  });

  it('bakes the spindle’s axes, exponent swing and unit-area scale from the TypeScript profile', () => {
    const spindle = glslFunction('vec2 spindleAt(float delta) {');
    expect(spindle).toContain(glslFloat(SPINDLE_HALF_LENGTH));
    expect(spindle).toContain(glslFloat(SPINDLE_EXPONENT_SWING));
    expect(spindle).toContain(`return ${glslFloat(SPINDLE_AREA_SCALE)} * vec2(value, value * logSlope);`);
  });

  it('paints the eyespot over the sprites and the whip after the tufts, both under the prey film', () => {
    const pass = glslFunction('vec4 membranePass(Instance inst, Frame frame) {');
    expect(pass.indexOf('acc = eyespot(inst, frame, acc);')).toBeLessThan(pass.indexOf('acc = cellWall('));
    expect(pass.indexOf('acc = ciliaTufts(')).toBeLessThan(pass.indexOf('acc = euglenaFlagellum(inst, frame, acc);'));
    expect(pass.indexOf('euglenaFlagellum(')).toBeLessThan(pass.indexOf('acc *= inst.passBAlpha;'));
    expect(glslFunction('vec4 euglenaFlagellum(Instance inst, Frame frame, vec4 acc) {')).toContain(
      'if (!isSpindle(inst) || frame.rho < 1.0) return acc;',
    );
  });

  it('wears the cell’s own rim colour on the whip and EYESPOT on the dot (#646 rule 6)', () => {
    expect(glslFunction('vec4 euglenaFlagellum(Instance inst, Frame frame, vec4 acc) {')).toContain('rimColour(inst)');
    expect(glslFunction('vec4 eyespot(Instance inst, Frame frame, vec4 acc) {')).toContain('uEyespot');
  });

  it('sizes and waves the whip with the TypeScript reference’s numbers', () => {
    const whip = glslFunction('vec2 flagellumDistance(vec2 place, float offset, float beat) {');
    expect(whip).toContain(`TAU * (${glslFloat(EUGLENA_FLAGELLUM_WAVES)} * share - beat)`);
    expect(whip).toContain(`min(offset / ${glslFloat(EUGLENA_FLAGELLUM_LENGTH_RADII)}, 1.0)`);
    expect(whip).toContain(
      `mix(${glslFloat(EUGLENA_FLAGELLUM_ROOT_WIDTH_RADII)}, ${glslFloat(EUGLENA_FLAGELLUM_TIP_WIDTH_RADII)}, share)`,
    );
  });

  /** PR #765 review: the ramp, pools, glint and halo wrap the spindle's tips instead of capping them flat. */
  it('lays the body ramp, the pools, the glint and the halo in the body frame over the form’s B', () => {
    expect(glslFunction('Frame frameAt(Instance inst) {')).toContain(
      'frame.pF = frame.p / (inst.r * inst.pulse * formAt(inst, wrapAngle(frame.theta - inst.heading)).x);',
    );
    expect(glslFunction('vec4 bodyRamp(Instance inst, Frame frame, float inside, vec4 acc) {')).toContain(
      'vec2 q = frame.pF - centre;',
    );
    expect(glslFunction('float poolMask(Frame frame, vec2 centre, vec2 radii) {')).toContain('(frame.pF - centre)');
    expect(glslFunction('vec4 glint(Instance inst, Frame frame, vec4 acc) {')).toContain('vec2 q = frame.pF - centre;');
    expect(glslFunction('vec4 haloBand(Instance inst, Frame frame, vec4 acc) {')).toContain(
      `haloAlpha(frame.rhoF, ${glslFloat(HALO_OUTER_RADII)}`,
    );
  });

  it('names the eyespot uniforms', () => {
    expect(CELL_UNIFORM.eyespot).toBe('uEyespot');
    expect(CELL_UNIFORM.eyespotRim).toBe('uEyespotRim');
  });
});

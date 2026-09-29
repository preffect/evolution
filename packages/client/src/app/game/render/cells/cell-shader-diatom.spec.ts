// @vitest-environment node
// The diatom in the cell shader (#195): the valve in pass A and the girdle and the spines in pass B must be the marks
// the TypeScript references test (`diatom-pattern.ts`, `diatom-spines.ts`). The GLSL is a string here, so what a string
// can prove is pinned: the baked numbers, the gates, the colours, the frame and the order in each pass.

import { describe, expect, it } from 'vitest';
import { glslFunction } from '../../../../testing/cell-glsl';
import {
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_SPACING_RADII,
  DIATOM_SPINE_COUNT_BY_TIER,
  DIATOM_SPINE_ROOT_INSET_RADII,
  DIATOM_SPINE_ROOT_WIDTH_RADII,
  DIATOM_SPINE_TIP_WIDTH_RADII,
  DIATOM_STRIA_INNER_RADII,
  DIATOM_STRIA_OUTER_RADII,
  FORM_ID,
} from '../constants';
import { CELL_UNIFORM, glslFloat } from './cell-shader-source';
import { DIATOM_FINE_STRIA_TURN, DIATOM_RIB_COUNT } from './forms/diatom-pattern';
import { DIATOM_SPINE_LENGTH_RADII } from './forms/diatom-spines';

describe('the diatom in the cell shader', () => {
  it('gates every mark on the diatom form, the spines outside the membrane only', () => {
    expect(glslFunction('bool isDiatom(Instance inst) {')).toContain(`abs(inst.formId - ${glslFloat(FORM_ID.diatom)})`);
    expect(glslFunction('vec4 diatomValve(Instance inst, Frame frame, float inside, vec4 acc) {')).toContain(
      'if (!isDiatom(inst) || inst.lodBlend <= 0.0) return acc;',
    );
    expect(glslFunction('vec4 diatomSpines(Instance inst, Frame frame, vec4 acc) {')).toContain(
      'if (!isDiatom(inst) || frame.rho < 1.0) return acc;',
    );
  });

  it('lays the valve under the nucleus disc in pass A, the girdle over the rim and the spines after the whip in pass B', () => {
    const body = glslFunction('vec4 bodyPass(Instance inst, Frame frame) {');
    expect(body.indexOf('acc = cytoskeletonFilaments(')).toBeLessThan(body.indexOf('acc = diatomValve('));
    expect(body.indexOf('acc = diatomValve(')).toBeLessThan(body.indexOf('return nucleusRamp('));
    const membrane = glslFunction('vec4 membranePass(Instance inst, Frame frame) {');
    expect(membrane.indexOf('acc = rimLight(')).toBeLessThan(membrane.indexOf('acc = diatomGirdle('));
    expect(membrane.indexOf('acc = cellWall(')).toBeLessThan(membrane.indexOf('acc = diatomSpines('));
    expect(membrane.indexOf('acc = euglenaFlagellum(')).toBeLessThan(membrane.indexOf('acc = diatomSpines('));
    expect(membrane.indexOf('acc = diatomSpines(')).toBeLessThan(membrane.indexOf('acc *= inst.passBAlpha;'));
  });

  /** The shell turns as one piece: the valve in the body frame turned with the heading, the spines off the heading. */
  it('turns the valve and the spines with the heading', () => {
    expect(glslFunction('vec2 valvePlace(Instance inst, Frame frame) {')).toContain(
      'vec2 axis = vec2(cos(inst.heading), sin(inst.heading));',
    );
    expect(glslFunction('vec2 valvePlace(Instance inst, Frame frame) {')).toContain('dot(frame.pF, axis)');
    const spines = glslFunction('vec4 diatomSpines(Instance inst, Frame frame, vec4 acc) {');
    expect(spines).toContain('floor(wrapAngle(frame.theta - inst.heading) / spacing + HALF)');
    expect(spines).toContain('inst.heading + (slot + float(neighbour)) * spacing');
  });

  it('bakes the valve’s striae, pores and span from the TypeScript reference', () => {
    const valve = glslFunction('vec4 diatomValve(Instance inst, Frame frame, float inside, vec4 acc) {');
    expect(valve).toContain(`spokeDistancePx(${glslFloat(DIATOM_RIB_COUNT)}, angle, rho * radiusPx)`);
    expect(valve).toContain(`angle - ${glslFloat(DIATOM_FINE_STRIA_TURN)} * TAU`);
    expect(valve).toContain(glslFloat(DIATOM_STRIA_INNER_RADII));
    expect(valve).toContain(glslFloat(DIATOM_STRIA_OUTER_RADII));
    const pore = glslFunction('float valvePore(vec2 place, float radiusPx) {');
    expect(pore).toContain(glslFloat(DIATOM_PORE_FIRST_RADII));
    expect(pore).toContain(glslFloat(DIATOM_PORE_SPACING_RADII));
  });

  it('counts the spines by tier and sizes them with the TypeScript reference’s numbers', () => {
    expect(glslFunction('float diatomSpineCount(Instance inst) {')).toContain(
      `(${DIATOM_SPINE_COUNT_BY_TIER.map(glslFloat).join(', ')})`,
    );
    const spine = glslFunction('vec3 spineCoverage(vec2 place, float angle, float membrane, float feather) {');
    expect(spine).toContain(`along - (membrane - ${glslFloat(DIATOM_SPINE_ROOT_INSET_RADII)})`);
    expect(spine).toContain(
      `mix(${glslFloat(DIATOM_SPINE_ROOT_WIDTH_RADII)}, ${glslFloat(DIATOM_SPINE_TIP_WIDTH_RADII)}, offset / ${glslFloat(DIATOM_SPINE_LENGTH_RADII)})`,
    );
  });

  it('wears the cell’s rim colour on the spines and silica on the valve (#646 rule 6)', () => {
    const spines = glslFunction('vec4 diatomSpines(Instance inst, Frame frame, vec4 acc) {');
    expect(spines).toContain('over(acc, rimColour(inst),');
    expect(spines).toContain('over(acc, uWhite,');
    expect(glslFunction('vec4 diatomValve(Instance inst, Frame frame, float inside, vec4 acc) {')).toContain(
      'uSilicaLight',
    );
    expect(glslFunction('vec4 diatomGirdle(Instance inst, Frame frame, vec4 acc) {')).toContain('uSilica,');
    expect(CELL_UNIFORM.silica).toBe('uSilica');
    expect(CELL_UNIFORM.silicaLight).toBe('uSilicaLight');
  });
});

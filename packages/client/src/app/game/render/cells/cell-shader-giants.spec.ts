// @vitest-environment node
// The giants' detail in the cell shader (#828): the marks `forms/giant-detail.ts` tests, painted only on a giant of
// the right species, under the nucleus disc in pass A, and faded with the interior. The GLSL is a string here, so what
// a string can prove is pinned: the gates, the baked numbers, the colours and the order in the pass.

import { describe, expect, it } from 'vitest';
import { GIANT_SPECIES } from '@evolution/shared';
import { glslFunction } from '../../../../testing/cell-glsl';
import {
  CILIA_TUFT_STRAND_PITCH_PX,
  GIANT_AMOEBA_VACUOLE,
  GIANT_DIATOM_RING_PORE_SPACING_RADII,
  GIANT_PARAMECIUM_VACUOLES,
  GIANT_SPECIES_ID,
  GIANT_VACUOLE_CYCLE_SECONDS,
} from '../constants';
import { HALF } from '../geometry';
import { glslFloat } from './cell-shader-source';
import { oralGrooveArc } from './forms/giant-detail';

const DETAIL = 'vec4 giantDetail(Instance inst, Frame frame, vec4 acc) {';
const vec2 = (point: { readonly x: number; readonly y: number }) =>
  `vec2(${glslFloat(point.x)}, ${glslFloat(point.y)})`;
const vec3 = (point: { readonly x: number; readonly y: number }, phase: number) =>
  `vec3(${glslFloat(point.x)}, ${glslFloat(point.y)}, ${glslFloat(phase)})`;

describe('the giants’ detail in the cell shader', () => {
  it('paints nothing on a cell that is not a giant, nor below the interior LOD', () => {
    expect(glslFunction(DETAIL)).toContain('if (inst.giantSpeciesId < HALF || inst.lodBlend <= 0.0) return acc;');
    expect(glslFunction('float interiorFade(Instance inst, Frame frame) {')).toContain(
      'return (1.0 - smoothstep(-frame.aa, frame.aa, frame.d)) * inst.lodBlend;',
    );
  });

  it('gives each species its own marks, by its id', () => {
    const detail = glslFunction(DETAIL);
    const paramecium = detail.indexOf(`isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.paramecium])})`);
    const amoeba = detail.indexOf(`isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.amoeba])})`);
    const diatom = detail.indexOf(`isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.diatom])})`);
    expect(Math.min(paramecium, amoeba, diatom)).toBeGreaterThan(0);
    const [front, rear] = GIANT_PARAMECIUM_VACUOLES;
    expect(detail.slice(paramecium, amoeba)).toContain('acc = oralGroove(inst, frame, acc);');
    expect(detail.slice(paramecium, amoeba)).toContain(`contractileVacuole(inst, frame, ${vec3(front, 0)}, acc)`);
    expect(detail.slice(paramecium, amoeba)).toContain(`contractileVacuole(inst, frame, ${vec3(rear, HALF)}, acc)`);
    expect(detail.slice(amoeba, diatom)).toContain(
      `contractileVacuole(inst, frame, ${vec3(GIANT_AMOEBA_VACUOLE, 0)}, acc)`,
    );
    expect(detail.slice(diatom)).toContain('ringPore(valvePlace(inst, frame), frame.rPx * inst.pulse)');
  });

  it('lays the detail over the valve and under the nucleus disc in pass A', () => {
    const body = glslFunction('vec4 bodyPass(Instance inst, Frame frame) {');
    expect(body.indexOf('acc = diatomValve(')).toBeLessThan(body.indexOf('acc = giantDetail('));
    expect(body.indexOf('acc = giantDetail(')).toBeLessThan(body.indexOf('return nucleusRamp('));
    expect(glslFunction('vec4 membranePass(Instance inst, Frame frame) {')).not.toContain('giantDetail(');
  });

  it('bakes the oral groove’s arc from the TypeScript reference, in membrane radii', () => {
    const arc = oralGrooveArc();
    const groove = glslFunction('vec4 oralGroove(Instance inst, Frame frame, vec4 acc) {');
    expect(groove).toContain(`vec2 fromCentre = place - ${vec2(arc.centre)};`);
    expect(groove).toContain(`- ${glslFloat(arc.notchAngle)}) / ${glslFloat(arc.sweep)};`);
    expect(groove).toContain(`(length(fromCentre) - ${glslFloat(arc.radius)}) * membranePx`);
    expect(glslFunction('vec2 membranePlace(Instance inst, Frame frame) {')).toContain(
      'return frame.rho * vec2(cos(delta), sin(delta));',
    );
  });

  it('pumps the vacuoles on the room clock, each at its own cell’s seed, sited through the deformed outline', () => {
    expect(glslFunction('float vacuoleScale(float phase) {')).toContain(
      `fract(uTimeSeconds / ${glslFloat(GIANT_VACUOLE_CYCLE_SECONDS)} + phase)`,
    );
    const vacuole = glslFunction('vec4 contractileVacuole(');
    expect(vacuole).toContain('vacuoleScale(pump.z + inst.speckleSeed)');
    expect(vacuole).toContain(`if (isGiant(inst, ${glslFloat(GIANT_SPECIES_ID[GIANT_SPECIES.paramecium])})) {`);
    expect(vacuole).toContain('uVacuole');
    expect(vacuole).toContain('uVacuoleRim');
    expect(glslFunction('vec2 giantSlot(Instance inst, vec2 place) {')).toContain('profileAt(inst, angle).x');
  });

  it('spaces the ring pores from the TypeScript reference', () => {
    expect(glslFunction('float ringPore(vec2 place, float radiusPx) {')).toContain(
      `floor(TAU * ring / ${glslFloat(GIANT_DIATOM_RING_PORE_SPACING_RADII)})`,
    );
  });

  it('gives a tuft a strand per pitch of its root once it is wider than three (paramecium-cilia.ts tuftStrandCount)', () => {
    expect(glslFunction('float tuftStrandCount(Frame frame) {')).toContain(
      `/ ${glslFloat(CILIA_TUFT_STRAND_PITCH_PX)}`,
    );
    expect(glslFunction('vec4 ciliaTufts(Instance inst, Frame frame, vec4 acc) {')).toContain(
      'tuftStrands(best.y, halfWidth, pxRadii, tuftStrandCount(frame))',
    );
  });
});

// The GLSL is a string until a WebGL context compiles it (the Playwright smoke does); here we pin
// what a string can prove: every instance field is read from the column the packing puts it in,
// every uniform the mesh sets is declared, both passes assemble, and float literals are floats.
import { describe, expect, it } from 'vitest';
import { instanceFieldLocation, instanceScalarFields } from './cell-instance';
import { CELL_FRAGMENT_SOURCE, CELL_VERTEX_SOURCE } from './cell-shader';
import { CELL_UNIFORM, glslFloat, instanceRead } from './cell-shader-source';

describe('cell shader source', () => {
  it('reads every instance field from the column the packing puts it in', () => {
    const [texel, channel] = instanceFieldLocation('beadCount');
    expect(instanceRead('beadCount')).toBe(`texelFetch(uInstances, ivec2(${texel}, vInstance), 0).${'xyzw'[channel]}`);
    for (const field of instanceScalarFields()) expect(CELL_FRAGMENT_SOURCE).toContain(instanceRead(field));
    expect(CELL_VERTEX_SOURCE).toContain(instanceRead('quadExtentRadii'));
  });

  it('declares every uniform the mesh sets, in one of the two stages', () => {
    const sources = CELL_VERTEX_SOURCE + CELL_FRAGMENT_SOURCE;
    for (const name of Object.values(CELL_UNIFORM)) expect(sources).toMatch(new RegExp(`uniform \\w+ ${name};`));
    expect(CELL_VERTEX_SOURCE).toContain('uniform mat3 uProjectionMatrix;');
  });

  it('assembles both passes behind uPass and writes a premultiplied colour', () => {
    expect(CELL_FRAGMENT_SOURCE).toContain('uPass < 0.5 ? bodyPass(inst, frame) : membranePass(inst, frame)');
    expect(CELL_FRAGMENT_SOURCE).toContain('fragColour = acc * inst.alpha;');
    expect(CELL_FRAGMENT_SOURCE.startsWith('#version 300 es')).toBe(true);
    expect(CELL_VERTEX_SOURCE.startsWith('#version 300 es')).toBe(true);
  });

  it('writes float literals with a decimal point or an exponent', () => {
    expect(glslFloat(3)).toBe('3.0');
    expect(glslFloat(0.5)).toBe('0.5');
    expect(glslFloat(1e-9)).toBe('1e-9');
    expect(glslFloat(-135)).toBe('-135.0');
  });
});

// The GLSL is a string until a WebGL context compiles it (the Playwright smoke does); here we pin
// what a string can prove: every instance field is read from the column the packing puts it in,
// every uniform the mesh sets is declared, both passes assemble, and float literals are floats.
import { describe, expect, it } from 'vitest';
import {
  CELL_WALL_HAIRLINE_RADII,
  CELL_WALL_INNER_RADII,
  CELL_WALL_OUTER_RADII,
  CELL_WALL_SCALE_BY_TIER,
  CILIA_WIDTH_PX,
  FILAMENT_MASK_PX,
  NUCLEUS_RAMP_ALPHA,
  NUCLEUS_RAMP_FOCUS_RADII,
  NUCLEUS_RAMP_MID_STOP,
  NUCLEUS_RAMP_REACH_RADII,
  PALETTE_SHADE,
  SPECKLE_HASH_SALT,
} from '../constants';
import { HALF } from '../geometry';
import { instanceFieldLocation, instanceScalarFields } from './cell-instance';
import { CELL_FRAGMENT_SOURCE, CELL_VERTEX_SOURCE } from './cell-shader';
import { CELL_UNIFORM, glslFloat, instanceRead } from './cell-shader-source';

/** The body of one GLSL function in the fragment source, from its signature to its closing brace. */
function functionBody(name: string): string {
  const match = new RegExp(`vec4 ${name}\\(Instance inst, Frame frame[^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(
    CELL_FRAGMENT_SOURCE,
  );
  if (match === null) throw new Error(`${name} is not in the fragment source`);
  return match[1]!;
}

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

  it('defines the nucleus and nucleus-dark shade columns from the palette table (#231)', () => {
    expect(CELL_FRAGMENT_SOURCE).toContain(`#define SHADE_NUCLEUS ${PALETTE_SHADE.nucleus}`);
    expect(CELL_FRAGMENT_SOURCE).toContain(`#define SHADE_NUCLEUS_DARK ${PALETTE_SHADE.nucleusDark}`);
  });

  it('paints the nucleus ramp last in pass A: rim → nucleus → nucleus dark, anti-aliased, no lodBlend, gone at radius 0', () => {
    const band = functionBody('nucleusRamp');
    expect(band).toContain('if (inst.nucleusDiscRadii <= 0.0) return acc;');
    expect(band).toContain('inst.nucleusDiscRadii * inst.r * inst.pulse');
    expect(band).toContain('inst.nucleus * inst.r');
    expect(band).toContain('smoothstep(discWu - frame.aa, discWu + frame.aa, length(fromNucleus))');
    expect(band).toContain(`${glslFloat(NUCLEUS_RAMP_FOCUS_RADII)} * discWu`);
    expect(band).toContain(`${glslFloat(NUCLEUS_RAMP_REACH_RADII)} * discWu`);
    expect(band).toContain(
      `mix(rimColour(inst), shade(inst, SHADE_NUCLEUS), smoothstep(0.0, ${glslFloat(NUCLEUS_RAMP_MID_STOP)}, t))`,
    );
    expect(band).toContain(`shade(inst, SHADE_NUCLEUS_DARK), smoothstep(${glslFloat(NUCLEUS_RAMP_MID_STOP)}, 1.0, t)`);
    expect(band).toContain(`disc * ${glslFloat(NUCLEUS_RAMP_ALPHA)}`);
    expect(band).not.toContain('lodBlend');
    const bodyPass = functionBody('bodyPass');
    expect(bodyPass.trim().endsWith('return nucleusRamp(inst, frame, acc);')).toBe(true);
    expect(bodyPass.indexOf('cytoskeletonFilaments')).toBeLessThan(bodyPass.indexOf('nucleusRamp'));
    expect(bodyPass.indexOf('return farDot')).toBeLessThan(bodyPass.indexOf('nucleusRamp'));
  });

  it('salts the ribosome speckle with the cell’s own seed, never the palette or the strip row (#243)', () => {
    const speckle = functionBody('ribosomeSpeckle');
    expect(speckle).toContain(`vec2 salt = cell + inst.speckleSeed * ${glslFloat(SPECKLE_HASH_SALT.seed)};`);
    expect(speckle).not.toContain('inst.palette *');
    expect(speckle).not.toContain('inst.stripRow');
  });

  it('masks the filaments and the cilia as px bands with a ±0.5 px feather, so 1.1 px reads 1.1 px (#243)', () => {
    expect(functionBody('cytoskeletonFilaments')).toContain(
      `float mask = band(spokePx, 0.0, ${glslFloat(FILAMENT_MASK_PX)}, HALF);`,
    );
    expect(FILAMENT_MASK_PX).toBeCloseTo(0.55, 12);
    const cilia = functionBody('cilia');
    expect(cilia).toContain(`float halfWidth = ${glslFloat(CILIA_WIDTH_PX)} * HALF;`);
    expect(cilia).toContain('float hair = band(s, 0.0, halfWidth, HALF);');
    expect(CELL_FRAGMENT_SOURCE).toContain(`#define HALF ${glslFloat(HALF)}`);
  });

  it('scales the cell wall band from the 1.05 inner edge per tier: tier I reads 1.05 → 1.1175 with the hairline at 1.0875 (#243)', () => {
    const wall = functionBody('cellWall');
    expect(wall).toContain(`float inner = ${glslFloat(CELL_WALL_INNER_RADII - 1)};`);
    expect(wall).toContain(
      `float thickness = ${glslFloat(CELL_WALL_OUTER_RADII - CELL_WALL_INNER_RADII)} * inst.wallScale;`,
    );
    expect(wall).toContain(
      `float hairline = inner + ${glslFloat(CELL_WALL_HAIRLINE_RADII - CELL_WALL_INNER_RADII)} * inst.wallScale;`,
    );
    const thickness = CELL_WALL_OUTER_RADII - CELL_WALL_INNER_RADII;
    const hairline = CELL_WALL_HAIRLINE_RADII - CELL_WALL_INNER_RADII;
    const outerByTier = CELL_WALL_SCALE_BY_TIER.map((scale) => CELL_WALL_INNER_RADII + thickness * scale);
    const hairlineByTier = CELL_WALL_SCALE_BY_TIER.map((scale) => CELL_WALL_INNER_RADII + hairline * scale);
    expect(outerByTier.map((value) => Number(value.toFixed(4)))).toEqual([1.1175, 1.14, 1.1625]);
    expect(hairlineByTier.map((value) => Number(value.toFixed(4)))).toEqual([1.0875, 1.1, 1.1125]);
  });

  it('never names a variable after a GLSL reserved word (the jsdom tier cannot compile the source)', () => {
    // The ES 3.00 keywords a template string is likely to reach for; a match failed a real compile once ('flat').
    const reserved = [
      'flat',
      'smooth',
      'filter',
      'sample',
      'input',
      'output',
      'precision',
      'switch',
      'default',
      'invariant',
      'centroid',
      'patch',
      'common',
      'partition',
      'active',
      'class',
      'union',
      'enum',
      'typedef',
      'template',
      'this',
      'resource',
      'goto',
      'inline',
      'noinline',
      'public',
      'static',
      'extern',
      'external',
      'interface',
      'long',
      'short',
      'double',
      'half',
      'fixed',
      'unsigned',
      'superp',
      'sizeof',
      'cast',
      'namespace',
      'using',
      'asm',
      'volatile',
      'packed',
      'noperspective',
      'subroutine',
      'coherent',
      'restrict',
      'readonly',
      'writeonly',
      'precise',
    ];
    const declaration = new RegExp(`\\b(?:float|int|bool|vec[234]|ivec[234]|mat[234])\\s+(${reserved.join('|')})\\b`);
    expect(CELL_FRAGMENT_SOURCE).not.toMatch(declaration);
    expect(CELL_VERTEX_SOURCE).not.toMatch(declaration);
    expect('float flat = 1.0;').toMatch(declaration);
  });

  it('writes float literals with a decimal point or an exponent', () => {
    expect(glslFloat(3)).toBe('3.0');
    expect(glslFloat(0.5)).toBe('0.5');
    expect(glslFloat(1e-9)).toBe('1e-9');
    expect(glslFloat(-135)).toBe('-135.0');
  });
});

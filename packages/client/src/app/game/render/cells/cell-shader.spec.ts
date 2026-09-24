// @vitest-environment node
// The GLSL is a string until a WebGL context compiles it (the Playwright smoke does); here we pin
// what a string can prove: every instance field is read from the column the packing puts it in,
// every uniform the mesh sets is declared, both passes assemble, and float literals are floats.
import { describe, expect, it } from 'vitest';
import {
  CELL_WALL_HAIRLINE_RADII,
  CELL_WALL_INNER_RADII,
  CELL_WALL_OUTER_RADII,
  CELL_WALL_SCALE_BY_TIER,
  AMOEBA_CORE_SCALE,
  CILIA_WIDTH_PX,
  ECTOPLASM_ALPHA,
  ECTOPLASM_DEPTH_RADII,
  FORM_ID,
  EDIBLE_RING_ALPHA,
  FILAMENT_MASK_PX,
  NUCLEUS_RAMP_ALPHA,
  NUCLEUS_RAMP_FOCUS_RADII,
  NUCLEUS_RAMP_MID_STOP,
  NUCLEUS_RAMP_REACH_RADII,
  PALETTE_SHADE,
  RELATION_RING_LINE_PITCH_PX,
  RELATION_RING_STROKE_PX,
  SELF_RING_ALPHA,
  SELF_RING_TRACK_ALPHA,
  SPECKLE_HASH_SALT,
  TOXIC_RING_ALPHA,
} from '../constants';
import { HALF } from '../geometry';
import { BUMP_TEXEL_START, instanceFieldLocation, instanceScalarFields } from './cell-instance';
import { CELL_FRAGMENT_SOURCE, CELL_VERTEX_SOURCE } from './cell-shader';
import { CELL_UNIFORM, glslFloat, instanceRead } from './cell-shader-source';
import { AMOEBA_CORE_PROFILE } from './forms/amoeba-pseudopods';
import { FULL_SELF_RING, TWELVE_O_CLOCK_TURNS } from './self-ring';

/** The body of one GLSL function in the fragment source, from its signature to its closing brace. */
function functionBody(name: string): string {
  const match = new RegExp(`(?:vec4|float) ${name}\\(Instance inst, Frame frame[^)]*\\) \\{([\\s\\S]*?)\\n\\}`).exec(
    CELL_FRAGMENT_SOURCE,
  );
  if (match === null) throw new Error(`${name} is not in the fragment source`);
  return match[1]!;
}

describe('cell shader source', () => {
  it('reads every instance field from the column the packing puts it in', () => {
    const [texel, channel] = instanceFieldLocation('beadCount');
    expect(instanceRead('beadCount')).toBe(`instanceTexel${texel}.${'xyzw'[channel]}`);
    expect(CELL_FRAGMENT_SOURCE).toContain(
      `vec4 instanceTexel${texel} = texelFetch(uInstances, ivec2(${texel}, vInstance), 0);`,
    );
    for (const field of instanceScalarFields()) expect(CELL_FRAGMENT_SOURCE).toContain(instanceRead(field));
    expect(CELL_VERTEX_SOURCE).toContain(instanceRead('quadExtentRadii'));
  });

  it('fetches each scalar instance texel once per fragment, and the vertex stage its one texel once (#302)', () => {
    const fetchesOf = (source: string, texelIndex: number): number =>
      source.split(`texelFetch(uInstances, ivec2(${texelIndex}, vInstance), 0)`).length - 1;
    for (let texelIndex = 0; texelIndex < BUMP_TEXEL_START; texelIndex += 1) {
      expect(fetchesOf(CELL_FRAGMENT_SOURCE, texelIndex), `texel ${texelIndex}`).toBe(1);
    }
    expect(CELL_VERTEX_SOURCE.split('texelFetch(uInstances').length - 1).toBe(1);
    expect(CELL_FRAGMENT_SOURCE.split('readInstance()').length - 1, 'the definition and the one call in main').toBe(2);
  });

  it('declares every instance texel local a stage reads, before GL compile would say so', () => {
    for (const source of [CELL_VERTEX_SOURCE, CELL_FRAGMENT_SOURCE]) {
      const read = new Set([...source.matchAll(/instanceTexel(\d+)\./g)].map((match) => match[1]));
      const declared = new Set([...source.matchAll(/vec4 instanceTexel(\d+) = /g)].map((match) => match[1]));
      expect([...read].filter((texel) => !declared.has(texel))).toEqual([]);
    }
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

  /**
   * B2 on PR #640: the TypeScript profile the bounds and the organelle mapping read and the GLSL the GPU draws must be
   * the same amoeba, so the shader's core is pinned to the profile's value and its use in `profileAt`.
   */
  it('shrinks the amoeba’s core in formAt to the TypeScript profile’s value, and nothing else (#192)', () => {
    const start = CELL_FRAGMENT_SOURCE.indexOf('vec2 formAt(Instance inst, float delta) {');
    const body = CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
    expect(start).toBeGreaterThan(-1);
    expect(AMOEBA_CORE_PROFILE.evaluate(1).value).toBe(AMOEBA_CORE_SCALE);
    expect(body).toContain(
      `if (abs(inst.formId - ${glslFloat(FORM_ID.amoeba)}) < HALF) return vec2(${glslFloat(AMOEBA_CORE_PROFILE.peak)}, 0.0);`,
    );
    expect(body.trim().endsWith('return vec2(1.0, 0.0);')).toBe(true);
    expect(CELL_FRAGMENT_SOURCE).toContain('vec2 form = formAt(inst, delta);');
  });

  it('lines the amoeba’s membrane with the VAC_RIM ectoplasm in pass B, under the soft rim (#192)', () => {
    const band = functionBody('ectoplasm');
    expect(band).toContain(`if (abs(inst.formId - ${glslFloat(FORM_ID.amoeba)}) > HALF) return acc;`);
    expect(band).toContain(`float depth = ${glslFloat(ECTOPLASM_DEPTH_RADII)};`);
    expect(band).toContain(`return over(acc, uEctoplasm, inside * fade * ${glslFloat(ECTOPLASM_ALPHA)});`);
    const pass = functionBody('membranePass');
    expect(pass).toContain('acc = ectoplasm(inst, frame, acc);');
    expect(pass.indexOf('innerEdge(')).toBeLessThan(pass.indexOf('ectoplasm('));
    expect(pass.indexOf('ectoplasm(')).toBeLessThan(pass.indexOf('softRim('));
    expect(CELL_UNIFORM.ectoplasm).toBe('uEctoplasm');
  });

  it('draws the self ring as the sprint ring: recharged clockwise from 12 o’clock, the rest a track (#295)', () => {
    // The turn is the TypeScript reference's (self-ring.ts): atan(y, x) in a y-down frame plus a quarter turn.
    expect(CELL_FRAGMENT_SOURCE).toContain('frame.theta = atan(vLocal.y, vLocal.x);');
    const alpha = functionBody('selfRingAlpha');
    expect(alpha).toContain(`float turns = fract(frame.theta / TAU + ${glslFloat(TWELVE_O_CLOCK_TURNS)});`);
    expect(alpha).toContain('float endPx = (inst.selfRingFill - turns) * TAU * radiusWu * uZoom;');
    expect(alpha).toContain('float recharged = smoothstep(-HALF, HALF, endPx);');
    expect(alpha).toContain(`if (inst.selfRingFill >= ${glslFloat(FULL_SELF_RING)}) recharged = 1.0;`);
    expect(alpha).toContain('if (inst.selfRingFill <= 0.0) recharged = 0.0;');
    expect(alpha).toContain('float lit = min(inst.selfRingBrightness * inst.rimBrightness, 1.0);');
    expect(alpha).toContain(`return mix(${glslFloat(SELF_RING_TRACK_ALPHA)}, lit, recharged);`);
    const ring = functionBody('selfRing');
    expect(ring).toContain('return over(acc, uWhite, mask * selfRingAlpha(inst, frame, radiusWu));');
    expect(ring).not.toContain(glslFloat(SELF_RING_ALPHA));
    expect(CELL_FRAGMENT_SOURCE.indexOf('float selfRingAlpha(')).toBeLessThan(
      CELL_FRAGMENT_SOURCE.indexOf('vec4 selfRing('),
    );
  });

  it('draws the relation ring solid and still: one GAIN line, or a DANGER double line one pitch apart (#538)', () => {
    const ring = functionBody('relationRing');
    expect(ring).toContain('if (inst.relationRingPx <= 0.0) return acc;');
    expect(ring).toContain(`float halfStroke = ${glslFloat(RELATION_RING_STROKE_PX)} * HALF / uZoom;`);
    expect(ring).toContain(`return over(acc, uGain, lines * ${glslFloat(EDIBLE_RING_ALPHA)});`);
    expect(ring).toContain(`float outerWu = radiusWu + ${glslFloat(RELATION_RING_LINE_PITCH_PX)} / uZoom;`);
    expect(ring).toContain(`return over(acc, uDanger, lines * ${glslFloat(TOXIC_RING_ALPHA)});`);
    expect(ring).not.toContain('dash(');
    expect(ring).not.toContain('uTimeSeconds');
    const membrane = functionBody('membranePass');
    expect(membrane.indexOf('warningRing(inst, frame, acc)')).toBeLessThan(
      membrane.indexOf('relationRing(inst, frame, acc)'),
    );
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

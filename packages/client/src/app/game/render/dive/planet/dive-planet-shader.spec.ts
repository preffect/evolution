// The GLSL is a string until a WebGL context compiles it (the dive's evidence run in the browser does); here we pin
// what a string can prove: GLSL ES 3.00 throughout, every uniform the mesh sets is declared and set, every function
// called is defined, and the signed distance is read back as `signed-distance.ts` reads it.

import { describe, expect, it } from 'vitest';
import { DIVE_SDF_LEVELS_PER_TEXEL, DIVE_SDF_TRUSTED_TEXELS, DIVE_SDF_ZERO_LEVEL } from '../../constants';
import { glslFloat } from '../../cells/cell-shader-source';
import { DivePlanetMesh } from './dive-planet-mesh';
import {
  DIVE_PLANET_FRAGMENT_SOURCE,
  DIVE_PLANET_UNIFORM,
  DIVE_PLANET_UNIFORM_GROUP,
  DIVE_PLANET_VERTEX_SOURCE,
} from './dive-planet-shader';

const SAMPLERS: readonly string[] = [
  DIVE_PLANET_UNIFORM.worldSdf,
  DIVE_PLANET_UNIFORM.worldPreviewSdf,
  DIVE_PLANET_UNIFORM.regionSdf,
];
const GLSL_BUILT_INS = new Set(
  'abs acos asin atan clamp cos dot exp floor fract length log2 max min mix mod normalize pow sin smoothstep sqrt step texture vec2 vec3 vec4 mat2 mat3 float int if for return while'.split(
    ' ',
  ),
);

describe('the planet shader source', () => {
  it('is GLSL ES 3.00 in both stages, with none of WebGL 1’s names left', () => {
    for (const source of [DIVE_PLANET_VERTEX_SOURCE, DIVE_PLANET_FRAGMENT_SOURCE]) {
      expect(source.startsWith('#version 300 es\n')).toBe(true);
      expect(source).not.toMatch(/texture2D|gl_FragColor|\battribute\b|\bvarying\b/);
    }
  });

  it('declares every uniform and sampler the mesh sets, and the mesh sets every one', () => {
    const mesh = new DivePlanetMesh({ west: 0, south: 0, east: 1, north: 1 });
    for (const name of Object.values(DIVE_PLANET_UNIFORM)) {
      expect(DIVE_PLANET_FRAGMENT_SOURCE, name).toMatch(new RegExp(`uniform [a-zA-Z0-9]+ [^;]*\\b${name}\\b`));
      if (!SAMPLERS.includes(name)) expect(mesh.uniformValue(name), name).toBeDefined();
    }
    expect(DIVE_PLANET_UNIFORM_GROUP).not.toMatch(/^u[A-Z]/);
    mesh.destroy();
  });

  it('defines every function it calls', () => {
    const defined = new Set(
      [...DIVE_PLANET_FRAGMENT_SOURCE.matchAll(/^\s*(?:float|vec2|vec3|void) (\w+)\(/gm)].map((match) => match[1]),
    );
    const called = new Set([...DIVE_PLANET_FRAGMENT_SOURCE.matchAll(/\b([a-z]\w*)\(/g)].map((match) => match[1]!));
    for (const name of called) if (!GLSL_BUILT_INS.has(name)) expect(defined.has(name), name).toBe(true);
  });

  it('never calls smoothstep with its edges reversed, which GLSL leaves undefined (smoothFall falls instead)', () => {
    for (const match of DIVE_PLANET_FRAGMENT_SOURCE.matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)) {
      expect(Number(match[1]), match[0]).toBeLessThan(Number(match[2]));
    }
    expect(DIVE_PLANET_FRAGMENT_SOURCE).not.toMatch(/smoothstep\(([\w.]+) \+ ([^,]+), \1 - \2,/);
  });

  it('reads the signed distance back with the bake’s own encoding', () => {
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(glslFloat(DIVE_SDF_ZERO_LEVEL));
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(`/ ${glslFloat(DIVE_SDF_LEVELS_PER_TEXEL.red)}`);
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(`/ ${glslFloat(DIVE_SDF_LEVELS_PER_TEXEL.blue)}`);
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(`abs(red) < ${glslFloat(DIVE_SDF_TRUSTED_TEXELS.red)}`);
    expect(DIVE_PLANET_FRAGMENT_SOURCE).toContain(`abs(green) < ${glslFloat(DIVE_SDF_TRUSTED_TEXELS.green)}`);
  });
});

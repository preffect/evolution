// The kelp band's shaders (docs/rendering/opening-dive.md §4): the GLSL is a string until a WebGL context compiles it
// (the dive's evidence run in the browser does); here we pin what a string can prove for each of the five programs:
// GLSL ES 3.00 in both stages, every uniform it declares held by its uniform group or bound as a sampler and every
// one the group holds declared, every function it calls defined, no `smoothstep` with reversed literal edges; and the
// helpers that write a uniform and bind a texture.

import { Texture, type UniformGroup } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  KELP_UNIFORM_GROUP,
  bindTexture,
  createBulbProgram,
  createFloorProgram,
  createLensProgram,
  createRibbonProgram,
  createRockProgram,
  uniformVector,
  type KelpProgram,
} from './kelp-programs';
import { KELP_BULB_FRAGMENT_SOURCE } from './kelp-shader-bulb';
import { KELP_WORLD_VERTEX_SOURCE } from './kelp-shader-common';
import { KELP_FLOOR_FRAGMENT_SOURCE, KELP_FLOOR_VERTEX_SOURCE } from './kelp-shader-floor';
import { KELP_LENS_FRAGMENT_SOURCE, KELP_LENS_VERTEX_SOURCE } from './kelp-shader-lens';
import { KELP_RIBBON_FRAGMENT_SOURCE, KELP_RIBBON_VERTEX_SOURCE } from './kelp-shader-ribbon';
import { KELP_ROCK_FRAGMENT_SOURCE } from './kelp-shader-rock';
import { KELP_ROCK_JOINT_VECTORS, KELP_ROCK_UNIFORM } from './kelp-shader-rock-surface';

const PIXI_MATRICES = new Set(['uProjectionMatrix', 'uWorldTransformMatrix', 'uTransformMatrix']);
const GLSL_BUILT_INS = new Set(
  'abs atan clamp cos dot exp floor fract length log max min mix mod pow sign sin smoothstep sqrt step texture vec2 vec3 vec4 mat3 float int uint ivec2 bool if for return while'.split(
    ' ',
  ),
);

/** Each program, made, with the GLSL it is made of (Pixi rewrites its own copy as it compiles). */
const PROGRAMS: readonly (readonly [string, () => KelpProgram, string, string])[] = [
  ['rock', createRockProgram, KELP_WORLD_VERTEX_SOURCE, KELP_ROCK_FRAGMENT_SOURCE],
  ['ribbons', createRibbonProgram, KELP_RIBBON_VERTEX_SOURCE, KELP_RIBBON_FRAGMENT_SOURCE],
  ['bulb', createBulbProgram, KELP_WORLD_VERTEX_SOURCE, KELP_BULB_FRAGMENT_SOURCE],
  ['floor', createFloorProgram, KELP_FLOOR_VERTEX_SOURCE, KELP_FLOOR_FRAGMENT_SOURCE],
  ['lenses', createLensProgram, KELP_LENS_VERTEX_SOURCE, KELP_LENS_FRAGMENT_SOURCE],
];

describe.each(PROGRAMS)('the kelp’s %s program', (_name, create, vertex, fragment) => {
  const program = create();

  it('is GLSL ES 3.00 in both stages, with none of WebGL 1’s names left', () => {
    for (const source of [vertex, fragment]) {
      expect(source.startsWith('#version 300 es\n')).toBe(true);
      expect(source).not.toMatch(/texture2D|gl_FragColor|\battribute\b|\bvarying\b/);
      expect(source).toMatch(/void main\(\)/);
    }
  });

  it('holds every uniform it declares, and declares every uniform it holds', () => {
    const group = program.shader.resources[KELP_UNIFORM_GROUP] as UniformGroup;
    const declared = [...`${vertex}${fragment}`.matchAll(/uniform (\w+) (\w+)/g)]
      .map((match) => ({ type: match[1]!, name: match[2]! }))
      .filter((uniform) => !PIXI_MATRICES.has(uniform.name));
    for (const { type, name } of declared) {
      if (type === 'sampler2D') expect(program.shader.resources[name], name).toBe(Texture.EMPTY.source);
      else expect(group.uniforms[name], name).toBeInstanceOf(Float32Array);
    }
    for (const name of Object.keys(group.uniforms)) {
      expect(
        declared.some((uniform) => uniform.name === name),
        name,
      ).toBe(true);
    }
  });

  it('defines every function it calls', () => {
    for (const source of [vertex, fragment]) {
      const defined = new Set(
        [...source.matchAll(/^\s*(?:float|vec2|vec3|vec4|void|bool) (\w+)\(/gm)].map((match) => match[1]),
      );
      const called = new Set([...source.matchAll(/\b([a-z]\w*)\(/g)].map((match) => match[1]!));
      for (const name of called) if (!GLSL_BUILT_INS.has(name)) expect(defined.has(name), name).toBe(true);
    }
  });

  it('never calls smoothstep with reversed literal edges, which GLSL leaves undefined', () => {
    for (const match of fragment.matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)) {
      expect(Number(match[1]), match[0]).toBeLessThan(Number(match[2]));
    }
  });
});

describe('the programs’ helpers', () => {
  it('sizes a uniform array to the vectors it holds, and binds a texture by identity', () => {
    const rock = createRockProgram();
    expect(uniformVector(rock, KELP_ROCK_UNIFORM.joints)).toHaveLength(KELP_ROCK_JOINT_VECTORS * 4);
    const source = Texture.WHITE.source;
    bindTexture(rock, KELP_ROCK_UNIFORM.foamTile, source);
    expect(rock.shader.resources[KELP_ROCK_UNIFORM.foamTile]).toBe(source);
    expect(KELP_UNIFORM_GROUP).not.toMatch(/^u[A-Z]/);
  });
});

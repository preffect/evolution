// The slime band's shaders (docs/rendering/opening-dive.md §4, ticket #803): the GLSL is a string until a WebGL context
// compiles it (the dive's evidence run in the browser does); here we pin what a string can prove for each program:
// GLSL ES 3.00 in both stages, every uniform it declares held by its uniform group or bound as a sampler and every one
// the group holds declared, every function it calls defined, no `smoothstep` with reversed literal edges, and no
// local named after a built-in.

import { Texture, type UniformGroup } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { SLIME_ORGANISMS } from '../../constants/dive-slime-plankton';
import { KELP_FLOOR_VERTEX_SOURCE } from '../kelp/kelp-shader-floor';
import { createSlimePrograms, everySlimeProgram, type SlimeProgram } from './slime-programs';
import {
  SLIME_BACTERIA_FRAGMENT_SOURCE,
  SLIME_MOTE_VERTEX_SOURCE,
  SLIME_ROD_VERTEX_SOURCE,
} from './slime-shader-bacteria';
import { SLIME_CLOUD_FRAGMENT_SOURCE, SLIME_CLOUD_VERTEX_SOURCE } from './slime-shader-clouds';
import { SLIME_UNIFORM_GROUP } from './slime-shader-common';
import { SLIME_DIATOM_FRAGMENT_SOURCE, SLIME_DIATOM_VERTEX_SOURCE } from './slime-shader-diatoms';
import { SLIME_FLOOR_FRAGMENT_SOURCE } from './slime-shader-floor';
import { SLIME_PENNATE_FRAGMENT_SOURCE, SLIME_PENNATE_VERTEX_SOURCE } from './slime-shader-pennate';
import {
  SLIME_OUTSIDE_FRAGMENT_SOURCE,
  SLIME_POCKET_FRAGMENT_SOURCE,
  SLIME_QUAD_VERTEX_SOURCE,
  SLIME_SKIN_FRAGMENT_SOURCE,
} from './slime-shader-pocket';
import { SLIME_STROKE_FRAGMENT_SOURCE, SLIME_STROKE_VERTEX_SOURCE } from './slime-shader-strokes';

const PIXI_MATRICES = new Set(['uProjectionMatrix', 'uWorldTransformMatrix', 'uTransformMatrix']);
const GLSL_BUILT_INS = new Set(
  'abs any atan clamp cos dot exp floor fract greaterThan length lessThan log max min mix mod pow sign sin smoothstep sqrt step texture textureSize vec2 vec3 vec4 mat3 float int uint ivec2 bool if for return while'.split(
    ' ',
  ),
);
const BUILT_IN_NAMES = ['distance', 'length', 'step', 'mix', 'texture'];

const programs = createSlimePrograms();

/** Each program, with the GLSL it is made of (Pixi rewrites its own copy as it compiles). */
const PROGRAMS: readonly (readonly [string, SlimeProgram, string, string])[] = [
  ['floor', programs.floor, KELP_FLOOR_VERTEX_SOURCE, SLIME_FLOOR_FRAGMENT_SOURCE],
  ['clouds', programs.clouds, SLIME_CLOUD_VERTEX_SOURCE, SLIME_CLOUD_FRAGMENT_SOURCE],
  ['diatoms', programs.diatoms, SLIME_DIATOM_VERTEX_SOURCE, SLIME_DIATOM_FRAGMENT_SOURCE],
  ['pocket', programs.pocket, SLIME_QUAD_VERTEX_SOURCE, SLIME_POCKET_FRAGMENT_SOURCE],
  ['outside', programs.outside, KELP_FLOOR_VERTEX_SOURCE, SLIME_OUTSIDE_FRAGMENT_SOURCE],
  ['rods', programs.rods, SLIME_ROD_VERTEX_SOURCE, SLIME_BACTERIA_FRAGMENT_SOURCE],
  ['motes', programs.motes, SLIME_MOTE_VERTEX_SOURCE, SLIME_BACTERIA_FRAGMENT_SOURCE],
  ['skin', programs.skin, SLIME_QUAD_VERTEX_SOURCE, SLIME_SKIN_FRAGMENT_SOURCE],
  ['strokes', programs.strokes, SLIME_STROKE_VERTEX_SOURCE, SLIME_STROKE_FRAGMENT_SOURCE],
  ['pennate', programs.pennates[0]!, SLIME_PENNATE_VERTEX_SOURCE, SLIME_PENNATE_FRAGMENT_SOURCE],
];

describe.each(PROGRAMS)('the slime’s %s program', (_name, program, vertex, fragment) => {
  it('is GLSL ES 3.00 in both stages, with none of WebGL 1’s names left', () => {
    for (const source of [vertex, fragment]) {
      expect(source.startsWith('#version 300 es\n')).toBe(true);
      expect(source).not.toMatch(/texture2D|gl_FragColor|\battribute\b|\bvarying\b/);
      expect(source).toMatch(/void main\(\)/);
    }
  });

  it('holds every uniform it declares, and declares every uniform it holds', () => {
    const group = program.shader.resources[SLIME_UNIFORM_GROUP] as UniformGroup;
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

  it('defines every function it calls, and names no local after a built-in', () => {
    for (const source of [vertex, fragment]) {
      const defined = new Set(
        [...source.matchAll(/^\s*(?:float|vec2|vec3|vec4|void|bool|int) (\w+)\(/gm)].map((match) => match[1]),
      );
      const called = new Set([...source.matchAll(/\b([a-z]\w*)\(/g)].map((match) => match[1]!));
      for (const name of called) if (!GLSL_BUILT_INS.has(name)) expect(defined.has(name), name).toBe(true);
      for (const name of BUILT_IN_NAMES) expect(source).not.toMatch(new RegExp(`(?:float|vec\\d|int) ${name}\\b`));
    }
  });

  it('never calls smoothstep with reversed literal edges, which GLSL leaves undefined', () => {
    for (const match of fragment.matchAll(/smoothstep\((-?[\d.]+), (-?[\d.]+),/g)) {
      expect(Number(match[1]), match[0]).toBeLessThan(Number(match[2]));
    }
  });
});

describe('createSlimePrograms', () => {
  it('makes one pennate program for each big pennate among the plankton, and lists every program once', () => {
    const pennates = SLIME_ORGANISMS.filter((organism) => organism.kind === 'pennate');
    expect(programs.pennates).toHaveLength(pennates.length);
    const listed = everySlimeProgram(programs);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toContain(programs.floor);
    expect(listed).toContain(programs.pennates.at(-1));
  });
});

// @vitest-environment node
// A starving wild cell's two shader terms (#635, visual-style/motion-and-legibility.md §5 "Starving"), pinned as
// strings the way cell-shader.spec.ts pins the rest: every palette shade withers by the instance's wither, and the
// outline crinkles by the strip jitter at the wrinkle octave, its slope carrying the octave as the TypeScript
// profile's does (radial-profile.spec.ts pins that one against a central difference).
import { describe, expect, it } from 'vitest';
import {
  GLINT_ALPHA,
  STARVING_DESATURATION,
  STARVING_GLINT_DIM,
  STARVING_DULL_VALUE,
  STARVING_SALLOW_SHARE,
  STARVING_WRINKLE_OCTAVE,
} from '../constants';
import { CELL_FRAGMENT_SOURCE } from './cell-shader';
import { CELL_UNIFORM, glslFloat } from './cell-shader-source';

describe('cell shader source: a starving cell', () => {
  it('withers every palette shade of a starving cell toward its sallowed, dimmed grey by the wither (#635)', () => {
    const shadeStart = CELL_FRAGMENT_SOURCE.indexOf('vec3 shade(Instance inst, int column) {');
    const shade = CELL_FRAGMENT_SOURCE.slice(shadeStart, CELL_FRAGMENT_SOURCE.indexOf('\n}', shadeStart));
    expect(shade).toContain('return withered(texelFetch(uPalette');
    expect(shade).toContain('inst.wither);');
    const start = CELL_FRAGMENT_SOURCE.indexOf('vec3 withered(vec3 colour, float wither) {');
    const body = CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
    expect(body).toContain(
      `mix(vec3(luma), uSallow, ${glslFloat(STARVING_SALLOW_SHARE)}) * ${glslFloat(STARVING_DULL_VALUE)}`,
    );
    expect(body).toContain(`return mix(colour, dull, wither * ${glslFloat(STARVING_DESATURATION)});`);
    expect(CELL_UNIFORM.sallow).toBe('uSallow');
  });

  it('dims a starving cell’s glint by its wither, so a cell about to burst loses its crisp highlight (#635)', () => {
    const start = CELL_FRAGMENT_SOURCE.indexOf('vec4 glint(Instance inst, Frame frame, vec4 acc) {');
    const body = CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain(
      `float lit = ${glslFloat(GLINT_ALPHA)} * (1.0 - inst.wither * ${glslFloat(STARVING_GLINT_DIM)});`,
    );
    expect(body).toContain('* lit);');
  });

  it('crinkles a starving cell’s outline with the strip jitter at the wrinkle octave, slope and all (#635)', () => {
    const start = CELL_FRAGMENT_SOURCE.indexOf('vec2 surfaceAt(Instance inst, float theta) {');
    const body = CELL_FRAGMENT_SOURCE.slice(start, CELL_FRAGMENT_SOURCE.indexOf('\n}', start));
    expect(body).toContain(`float octave = ${glslFloat(STARVING_WRINKLE_OCTAVE)};`);
    expect(body).toContain('vec4 wrinkle = stripSample(inst, octave * theta / TAU + inst.stripPhase);');
    expect(body).toContain('surface += inst.wrinkleAmplitude * wrinkle.x;');
    expect(body).toContain('surfaceD += inst.wrinkleAmplitude * octave * wrinkle.z;');
  });
});

// What the kelp's shaders leave undrawn, and why it changes no pixel (docs/rendering/opening-dive.md §4, PR #812's
// review): a barnacle looked at only within its own reach (its shadow's offset and radius, its shell's widest
// corner) and only when it covers a pixel, a neighbouring cell only within the largest barnacle's reach of the shared
// edge; the blade floor left undrawn inside the drop, whose lens over it is opaque; the rock under a blade drawn
// plain and nothing more. The GLSL is a string here, so these pin the numbers it is built with.

import { describe, expect, it } from 'vitest';
import { KELP_BARNACLE_LOOK, KELP_BARNACLE_MIN_PX, KELP_CLOSE_BARNACLES } from '../../constants/dive-kelp';
import { KELP_BARNACLE_SOURCE } from './kelp-shader-barnacle';
import { KELP_FLOOR_FRAGMENT_SOURCE, KELP_FLOOR_UNIFORM } from './kelp-shader-floor';
import { KELP_ROCK_FRAGMENT_SOURCE } from './kelp-shader-rock';

const LOOK = KELP_BARNACLE_LOOK;
const SHADOW_REACH = Math.hypot(LOOK.shadow.x, LOOK.shadow.y) + Math.max(LOOK.shadow.radiusX, LOOK.shadow.radiusY);
const SHELL_REACH = LOOK.shell.base + LOOK.shell.wobble;
const LARGEST_RADIUS = KELP_CLOSE_BARNACLES.radiusM.min + KELP_CLOSE_BARNACLES.radiusM.span;

function captured(source: string, pattern: RegExp): number {
  const match = source.match(pattern);
  expect(match, String(pattern)).not.toBeNull();
  return Number(match![1]);
}

describe('the barnacles’ culling', () => {
  it('skips a barnacle only beyond everything it paints: its shadow and its shell', () => {
    const reach = captured(KELP_BARNACLE_SOURCE, /length\(world - centre\) > radius \* ([\d.]+) \+ margin\) continue;/);
    expect(reach).toBeGreaterThanOrEqual(SHADOW_REACH);
    expect(reach).toBeGreaterThanOrEqual(SHELL_REACH);
    expect(reach).toBeLessThan(SHADOW_REACH + 0.01);
  });

  it('looks at a neighbouring cell only within the largest barnacle’s reach of the shared edge', () => {
    const near = captured(KELP_BARNACLE_SOURCE, /inCell\.x < ([\d.]+) \+ margin \? -1 : 0/);
    expect(near).toBeCloseTo(LARGEST_RADIUS * Math.max(SHADOW_REACH, SHELL_REACH), 12);
    const far = captured(KELP_BARNACLE_SOURCE, /inCell\.x > ([\d.]+) - margin \? 1 : 0/);
    expect(far).toBeCloseTo(KELP_CLOSE_BARNACLES.cellM - near, 12);
  });

  it('draws no barnacle that would cover under a pixel', () => {
    expect(captured(KELP_BARNACLE_SOURCE, /if \(radius \* pixelsPerMetre\(\) < ([\d.]+)\) continue;/)).toBe(
      KELP_BARNACLE_MIN_PX,
    );
  });
});

describe('the floor and the rock left undrawn under what covers them', () => {
  it('leaves the blade floor undrawn a device px inside the drop, while the drop draws', () => {
    expect(KELP_FLOOR_FRAGMENT_SOURCE).toContain(
      `if (drop.w > 0.5 && length(vWorld - drop.xy) < drop.z - px(1.0) / uView.w) discard;`,
    );
    expect(KELP_FLOOR_FRAGMENT_SOURCE).toContain(`vec4 drop = ${KELP_FLOOR_UNIFORM.drop};`);
  });

  it('draws the rock plain under a blade, with no rim light, waterline or barnacles after it', () => {
    const plain = KELP_ROCK_FRAGMENT_SOURCE.indexOf('if (isPlain) {');
    expect(plain).toBeGreaterThan(0);
    const after = KELP_ROCK_FRAGMENT_SOURCE.slice(plain);
    expect(after.indexOf('return;')).toBeLessThan(after.indexOf('rimLight(world, inside)'));
    expect(after.indexOf('return;')).toBeLessThan(after.indexOf('barnacles(vec4(0.0)'));
    expect(KELP_ROCK_FRAGMENT_SOURCE).toContain('if (isPlain || radius *');
  });
});

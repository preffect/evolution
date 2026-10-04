// The kelp blade's grain tile (docs/rendering/opening-dive.md §4, the mockup's `BAKES.blade`): streaks and mottling
// on the golden-olive ramp, a few bright specks, a little translucent, a few rows a step. Over a recording canvas and
// a flat noise: what is checked is the bake's own colouring, not the lattice (`shore-noise.spec.ts`).

import { describe, expect, it } from 'vitest';
import { KELP_BLADE_TILE } from '../../constants/dive-kelp-drop';
import { createFakeShoreCanvasFactory, type FakeShoreCanvas } from '../../../../../testing/fake-shore-canvas';
import { KELP_BAKE_TEST_TIMEOUT_MS } from '../../../../../testing/kelp-builder';
import { rgb255 } from '../shore/shore-pixels';
import { coordinateHash, type PeriodicNoise } from '../shore/shore-noise';
import { bakeBladeTile } from './kelp-blade-tile';

const MIDDLE = 0.5;
const flatNoise = { fbm: () => MIDDLE } as unknown as PeriodicNoise;

function baked(): { canvas: FakeShoreCanvas; slices: number } {
  const bake = bakeBladeTile({ factory: createFakeShoreCanvasFactory(), noise: flatNoise });
  let slices = 0;
  for (;;) {
    const step = bake.next();
    if (step.done === true) return { canvas: step.value as FakeShoreCanvas, slices };
    slices += 1;
  }
}

describe('bakeBladeTile', () => {
  it(
    'paints every pixel on the ramp’s middle at the tile’s alpha, lifted where a speck falls, a few rows a step',
    () => {
      const { canvas, slices } = baked();
      expect([canvas.width, canvas.height]).toEqual([KELP_BLADE_TILE.sizePx, KELP_BLADE_TILE.sizePx]);
      expect(slices).toBeGreaterThan(KELP_BLADE_TILE.sizePx / 16);
      const pixels = canvas.context.puts[0]!.data;
      const middle = rgb255(KELP_BLADE_TILE.ramp[1]);
      const counts = { specks: 0, wrong: 0 };
      for (let y = 0; y < KELP_BLADE_TILE.sizePx; y += 1) {
        for (let x = 0; x < KELP_BLADE_TILE.sizePx; x += 1) {
          const offset = (y * KELP_BLADE_TILE.sizePx + x) * 4;
          const isSpeck = coordinateHash(x, y, KELP_BLADE_TILE.speck.salt) > KELP_BLADE_TILE.speck.above;
          if (isSpeck) counts.specks += 1;
          const isRight = isSpeck
            ? pixels[offset]! > middle[0]
            : pixels[offset] === middle[0] && pixels[offset + 1] === middle[1] && pixels[offset + 2] === middle[2];
          if (!isRight || pixels[offset + 3] !== KELP_BLADE_TILE.alpha) counts.wrong += 1;
        }
      }
      expect(counts.wrong).toBe(0);
      expect(counts.specks).toBeGreaterThan(0);
    },
    KELP_BAKE_TEST_TIMEOUT_MS,
  );
});

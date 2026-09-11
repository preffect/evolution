import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { NUCLEOID_BAKE, NUCLEOID_RADIUS, NUCLEUS_CHROMATIN_SPOTS, NUCLEUS_GLOW_RADIUS } from '../constants';
import { bakeNucleoidSprite, bakeNucleusSprite } from './nucleus-bake';

const PX_PER_RADIUS = 100;

describe('bakeNucleusSprite', () => {
  const sprite = bakeNucleusSprite(createFakeBakeCanvasFactory(), PX_PER_RADIUS);
  const context = fakeContextOf(sprite.canvas);

  it('spans the glow radius and reports its width in cell radii', () => {
    expect(sprite.canvas.width).toBe(NUCLEUS_GLOW_RADIUS * 2 * PX_PER_RADIUS);
    expect(sprite.widthRadii).toBeCloseTo(NUCLEUS_GLOW_RADIUS * 2, 9);
  });

  it('layers glow, body ramp, chromatin spots, rim, nucleolus halo and disc, and the highlight', () => {
    const fixedLayers = 6;
    expect(context.paintCount).toBe(fixedLayers + NUCLEUS_CHROMATIN_SPOTS);
    expect(context.gradients[0]!.stops.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
    expect(context.count('ellipse')).toBe(1);
    expect(context.count('stroke')).toBe(1);
  });

  it('bakes white only, so the palette tints it', () => {
    for (const gradient of context.gradients) {
      for (const stop of gradient.stops) expect(stop.colour).toMatch(/^rgba\(255, 255, 255, /);
    }
  });
});

describe('bakeNucleoidSprite', () => {
  const sprite = bakeNucleoidSprite(createFakeBakeCanvasFactory(), PX_PER_RADIUS);
  const context = fakeContextOf(sprite.canvas);

  it('draws a glow under two strokes of the same closed wobbling loop', () => {
    expect(context.paintCount).toBe(3);
    expect(context.count('stroke')).toBe(2);
    expect(context.count('closePath')).toBe(2);
    expect(context.count('lineTo')).toBe(NUCLEOID_BAKE.steps * 2);
    expect(context.lineCap).toBe('round');
  });

  it('spans the glow reach around the nucleoid radius', () => {
    expect(sprite.widthRadii).toBeCloseTo(NUCLEOID_RADIUS * NUCLEOID_BAKE.glowReach * 2, 9);
    expect(sprite.canvas.width).toBe(Math.ceil(sprite.widthRadii * PX_PER_RADIUS));
  });
});

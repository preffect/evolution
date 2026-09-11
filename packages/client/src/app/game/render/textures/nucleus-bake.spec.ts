import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  NUCLEOID_BAKE,
  NUCLEOID_RADIUS,
  NUCLEUS_BAKE,
  NUCLEUS_CHROMATIN_SPOTS,
  NUCLEUS_GLOW_RADIUS,
  NUCLEUS_HIGHLIGHT,
  NUCLEUS_HIGHLIGHT_OFFSET_RADII,
  NUCLEUS_RADIUS,
} from '../constants';
import { bakeNucleoidSprite, bakeNucleusSprite } from './nucleus-bake';

const PX_PER_RADIUS = 100;

function random(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

/** The `arc` radii a bake draws, in order (the fake logs the op; this wraps it to keep the radius). */
function arcRadii(bake: (factory: ReturnType<typeof createFakeBakeCanvasFactory>) => void): number[] {
  const factory = createFakeBakeCanvasFactory();
  const radii: number[] = [];
  const originalCreate = factory.create.bind(factory);
  factory.create = (width, height) => {
    const canvas = originalCreate(width, height);
    canvas.context.arc = (_centreX, _centreY, radius) => radii.push(radius);
    return canvas;
  };
  bake(factory);
  return radii;
}

describe('bakeNucleusSprite', () => {
  const sprite = bakeNucleusSprite(createFakeBakeCanvasFactory(), PX_PER_RADIUS, random());
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

  it('bakes white only, below full alpha, so the palette tints it and the highlight reads', () => {
    for (const gradient of context.gradients) {
      for (const stop of gradient.stops) expect(stop.colour).toMatch(/^rgba\(255, 255, 255, /);
    }
    expect(NUCLEUS_BAKE.bodyAlpha).toBeLessThan(1);
    expect(NUCLEUS_BAKE.darkAlpha).toBeLessThan(NUCLEUS_BAKE.bodyAlpha);
  });

  it('keeps the highlight inside the nucleus disc', () => {
    expect(NUCLEUS_HIGHLIGHT_OFFSET_RADII + NUCLEUS_HIGHLIGHT.radiusX).toBeLessThan(NUCLEUS_RADIUS);
  });

  it('scatters the chromatin from the stream: same seed, same spots; another seed, other spots', () => {
    const spots = (seed: number) =>
      arcRadii((factory) => bakeNucleusSprite(factory, PX_PER_RADIUS, random(seed))).slice(
        2,
        2 + NUCLEUS_CHROMATIN_SPOTS,
      );
    expect(spots(1)).toEqual(spots(1));
    expect(spots(1)).not.toEqual(spots(2));
    expect(new Set(spots(1)).size).toBeGreaterThan(1);
  });
});

describe('bakeNucleoidSprite', () => {
  const sprite = bakeNucleoidSprite(createFakeBakeCanvasFactory(), PX_PER_RADIUS, random());
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

  it('breaks the loop symmetry with two incommensurate wobble terms at seeded phases', () => {
    expect(NUCLEOID_BAKE.secondLoopTurns % NUCLEOID_BAKE.loopTurns).not.toBe(0);
    const loop = (seed: number) => {
      const points: number[] = [];
      const factory = createFakeBakeCanvasFactory();
      const originalCreate = factory.create.bind(factory);
      factory.create = (width, height) => {
        const canvas = originalCreate(width, height);
        canvas.context.lineTo = (x, y) => points.push(x, y);
        return canvas;
      };
      bakeNucleoidSprite(factory, PX_PER_RADIUS, random(seed));
      return points;
    };
    expect(loop(1)).toEqual(loop(1));
    expect(loop(1)).not.toEqual(loop(2));
  });
});

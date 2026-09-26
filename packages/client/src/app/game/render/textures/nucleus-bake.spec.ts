import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  NUCLEOID_BAKE,
  NUCLEOID_RADIUS,
  NUCLEUS_CHROMATIN,
  NUCLEUS_CHROMATIN_SPOTS,
  NUCLEUS_GLOW_RADIUS,
  NUCLEUS_HIGHLIGHT,
  NUCLEUS_HIGHLIGHT_OFFSET_RADII,
  NUCLEUS_RADIUS,
} from '../constants';
import { bakeNucleoidSprite, bakeNucleusSprite } from './nucleus-bake';

const PX_PER_RADIUS = 100;
/** Float slack for a spot drawn exactly at a band edge. */
const ROUNDING = 1e-9;

function random(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

interface Arc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** The `arc`s a bake draws, in order (the fake logs the op; this wraps it to keep the centre and radius). */
function arcs(bake: (factory: ReturnType<typeof createFakeBakeCanvasFactory>) => void): Arc[] {
  const factory = createFakeBakeCanvasFactory();
  const drawn: Arc[] = [];
  const originalCreate = factory.create.bind(factory);
  factory.create = (width, height) => {
    const canvas = originalCreate(width, height);
    canvas.context.arc = (x, y, radius) => drawn.push({ x, y, radius });
    return canvas;
  };
  bake(factory);
  return drawn;
}

/** The chromatin spots of one bake: the arcs after the glow and its disc cut. */
function chromatinSpots(seed: number): Arc[] {
  const glowAndCut = 2;
  return arcs((factory) => bakeNucleusSprite(factory, PX_PER_RADIUS, random(seed))).slice(
    glowAndCut,
    glowAndCut + NUCLEUS_CHROMATIN_SPOTS,
  );
}

describe('bakeNucleusSprite', () => {
  const sprite = bakeNucleusSprite(createFakeBakeCanvasFactory(), PX_PER_RADIUS, random());
  const context = fakeContextOf(sprite.canvas);

  it('spans the glow radius and reports its width in cell radii', () => {
    expect(sprite.canvas.width).toBe(NUCLEUS_GLOW_RADIUS * 2 * PX_PER_RADIUS);
    expect(sprite.widthRadii).toBeCloseTo(NUCLEUS_GLOW_RADIUS * 2, 9);
  });

  it('layers glow, its disc cut, chromatin spots, rim, nucleolus halo and disc, and the highlight', () => {
    const fixedLayers = 6;
    expect(context.paintCount).toBe(fixedLayers + NUCLEUS_CHROMATIN_SPOTS);
    expect(context.count('ellipse')).toBe(1);
    expect(context.count('stroke')).toBe(1);
  });

  it('cuts the glow out inside the disc right after painting it, so the halo is an outer glow only (#231)', () => {
    const paints = context.ops.filter((operation) => operation === 'fill' || operation.startsWith('composite:'));
    expect(paints.slice(0, 3)).toEqual(['fill', 'composite:destination-out', 'fill']);
    expect(context.argumentsOf('arc')[1]![2]).toBe(NUCLEUS_RADIUS * PX_PER_RADIUS);
    expect(context.count('composite:destination-out')).toBe(1);
  });

  it('bakes no disc fill (#231): the only gradients are the two halos, so the shader ramp shows through', () => {
    const halos = 2;
    expect(context.gradients).toHaveLength(halos);
    for (const gradient of context.gradients) expect(gradient.stops.at(-1)!.colour).toBe('rgba(255, 255, 255, 0)');
  });

  it('bakes white only, below full alpha, so the palette tints it and the highlight reads', () => {
    for (const gradient of context.gradients) {
      for (const stop of gradient.stops) expect(stop.colour).toMatch(/^rgba\(255, 255, 255, /);
    }
  });

  it('keeps the highlight inside the nucleus disc', () => {
    expect(NUCLEUS_HIGHLIGHT_OFFSET_RADII + NUCLEUS_HIGHLIGHT.radiusX).toBeLessThan(NUCLEUS_RADIUS);
  });

  it('scatters the chromatin from the stream: same seed, same spots; another seed, other spots', () => {
    const spots = (seed: number) => chromatinSpots(seed).map((spot) => spot.radius);
    expect(spots(1)).toEqual(spots(1));
    expect(spots(1)).not.toEqual(spots(2));
    expect(new Set(spots(1)).size).toBeGreaterThan(1);
  });

  it("keeps sheet 01 panel A's spots (#252): inside the ring band, never overlapping, so no pair doubles the wash", () => {
    const seeds = 64;
    const nucleusPx = NUCLEUS_RADIUS * PX_PER_RADIUS;
    const centre = sprite.canvas.width / 2;
    for (let seed = 1; seed <= seeds; seed += 1) {
      const spots = chromatinSpots(seed);
      for (const [index, spot] of spots.entries()) {
        const distance = Math.hypot(spot.x - centre, spot.y - centre) / nucleusPx;
        expect(distance).toBeGreaterThanOrEqual(NUCLEUS_CHROMATIN.ringShareMin - ROUNDING);
        expect(distance).toBeLessThanOrEqual(NUCLEUS_CHROMATIN.ringShareMax + ROUNDING);
        expect(spot.radius / nucleusPx).toBeLessThanOrEqual(NUCLEUS_CHROMATIN.radiusShareMax + ROUNDING);
        for (const other of spots.slice(index + 1)) {
          expect(Math.hypot(spot.x - other.x, spot.y - other.y)).toBeGreaterThan(spot.radius + other.radius);
        }
      }
    }
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

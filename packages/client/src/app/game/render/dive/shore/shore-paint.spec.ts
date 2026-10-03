// What a snapshot is drawn with (docs/rendering/opening-dive.md §4): the view's sizes, a tile laid at its true size
// (shrunk first when it is drawn far under its baked size), its mean colour fading into its pattern, two octaves of a
// self-similar tile, and the sea's path.

import { describe, expect, it } from 'vitest';
import { SHORE_OCTAVE, SHORE_TRUE_TILE_PX } from '../../constants/dive-shore';
import { testShorePaint } from '../../../../../testing/shore-paint-builder';
import type { FakeShorePattern } from '../../../../../testing/fake-shore-canvas';
import {
  eachOctave,
  fillOctaves,
  isInView,
  paintTrue,
  placedPattern,
  pxToMetres,
  seaPath,
  trueTileWeight,
  worldUnitPx,
} from './shore-paint';

describe('the view', () => {
  const paint = testShorePaint(1.5);

  it('turns screen px into metres at the level’s own zoom', () => {
    expect(pxToMetres(paint.view, paint.view.screenPixelsPerMetre)).toBeCloseTo(1, 9);
  });

  it('knows what touches the view', () => {
    expect(isInView(paint.view, { x: 0, y: 0 }, 0)).toBe(true);
    expect(isInView(paint.view, { x: paint.view.halfWidthM * 3, y: 0 }, 1)).toBe(false);
    expect(isInView(paint.view, { x: paint.view.halfWidthM + 1, y: 0 }, 2)).toBe(true);
  });
});

describe('placedPattern', () => {
  it('lays a tile at its true size, turned and offset', () => {
    const paint = testShorePaint(1.5);
    const tileM = 64 / worldUnitPx(paint.view);
    const pattern = placedPattern(paint, 'rock', {
      tileM,
      turn: Math.PI / 2,
      offsetX: 3,
      offsetY: 4,
    }) as FakeShorePattern;
    const placement = pattern.transforms.at(-1)!;
    expect(placement.a).toBeCloseTo(0, 9);
    expect(placement.b).toBeCloseTo(tileM / 64, 9);
    expect([placement.e, placement.f]).toEqual([3, 4]);
  });

  it('shrinks a tile drawn far under its baked size first, and keeps that pattern for the snapshot', () => {
    const paint = testShorePaint(1.5);
    const tinyM = 8 / worldUnitPx(paint.view);
    const shrunk = placedPattern(paint, 'rock', { tileM: tinyM }) as FakeShorePattern;
    expect(shrunk.image).toEqual({ width: 8, height: 8 });
    expect(placedPattern(paint, 'rock', { tileM: tinyM })).toBe(shrunk);
    const full = placedPattern(paint, 'rock', { tileM: 64 / worldUnitPx(paint.view) }) as FakeShorePattern;
    expect(full.image).toEqual({ width: 64, height: 64 });
  });
});

describe('true-size tiles', () => {
  it('come up from their mean colour between 40 and 90 px on screen', () => {
    expect(trueTileWeight(1, SHORE_TRUE_TILE_PX.from)).toBe(0);
    expect(trueTileWeight(1, SHORE_TRUE_TILE_PX.to)).toBe(1);
  });

  it('paint the mean colour, then the pattern, at weights that add to the alpha', () => {
    const paint = testShorePaint(1.5);
    const midM = (SHORE_TRUE_TILE_PX.from + SHORE_TRUE_TILE_PX.to) / 2 / paint.view.screenPixelsPerMetre;
    paint.context.beginPath();
    paintTrue(paint, 'foam', { tileM: midM, alpha: 0.8, isStroke: true });
    expect(paint.context.count('stroke')).toBe(2);
    expect(paint.context.globalAlpha).toBe(1);
  });
});

describe('octaves', () => {
  it('draws two neighbouring octaves, the finer weighted by how far the zoom is between them', () => {
    const paint = testShorePaint(1.5);
    const drawn: [number, number][] = [];
    eachOctave(paint.view, { tileM: 8, targetPx: SHORE_OCTAVE.targetPx }, (tileM, weight) =>
      drawn.push([tileM, weight]),
    );
    expect(drawn).toHaveLength(2);
    expect(drawn[0]![0] / drawn[1]![0]).toBeCloseTo(SHORE_OCTAVE.ratio, 9);
    expect(drawn[0]![1]).toBe(1);
  });

  it('fills the current path twice, and leaves the alpha as it found it', () => {
    const paint = testShorePaint(1.5);
    paint.context.beginPath();
    fillOctaves(paint, 'rock', { tileM: 8, alpha: 0.5 });
    expect(paint.context.count('fill')).toBe(2);
    expect(paint.context.globalAlpha).toBe(1);
  });
});

describe('seaPath', () => {
  it('is the view and its margin with the land cut out', () => {
    const paint = testShorePaint(2.5);
    seaPath(paint);
    expect(paint.context.count('rect')).toBe(1);
    expect(paint.context.count('closePath')).toBe(paint.coast.rings.length);
  });
});

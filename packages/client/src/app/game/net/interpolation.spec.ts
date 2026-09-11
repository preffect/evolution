import { describe, expect, it } from 'vitest';
import { INTERPOLATION_DELAY_TICKS, MAX_EXTRAPOLATION_TICKS, TICK_INTERVAL_MS, entityId } from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import {
  ServerTickEstimator,
  extrapolateCell,
  interpolateCell,
  interpolateCells,
  interpolateFragments,
  interpolatePosition,
  interpolationWeight,
  renderTickFor,
} from './interpolation';

describe('ServerTickEstimator', () => {
  it('knows nothing before the first snapshot and then tracks the server tick against the clock', () => {
    const estimator = new ServerTickEstimator();
    expect(estimator.serverTickAt(0)).toBeNull();
    estimator.observe(60, 1000);
    expect(estimator.serverTickAt(1000)).toBeCloseTo(60, 9);
    expect(estimator.serverTickAt(1000 + TICK_INTERVAL_MS * 3)).toBeCloseTo(63, 9);
  });

  it('smooths later arrivals toward the measured offset and forgets on reset', () => {
    const estimator = new ServerTickEstimator();
    estimator.observe(60, 1000);
    estimator.observe(63, 1000 + TICK_INTERVAL_MS * 3 + 30);
    const estimate = estimator.serverTickAt(1000 + TICK_INTERVAL_MS * 3 + 30)!;
    expect(estimate).toBeGreaterThan(63);
    expect(estimate).toBeLessThan(63 + 30 / TICK_INTERVAL_MS);
    estimator.reset();
    expect(estimator.serverTickAt(0)).toBeNull();
  });
});

describe('renderTickFor', () => {
  it('draws the interpolation delay behind the server tick', () => {
    expect(renderTickFor(100, 60, 99)).toBe(100 - INTERPOLATION_DELAY_TICKS);
  });

  it('never runs before the oldest snapshot nor past the extrapolation cap', () => {
    expect(renderTickFor(50, 60, 63)).toBe(60);
    expect(renderTickFor(500, 60, 63)).toBe(63 + MAX_EXTRAPOLATION_TICKS);
  });
});

describe('interpolationWeight', () => {
  it('runs 0 → 1 across the bracket, clamped, and is 1 on a degenerate bracket', () => {
    expect(interpolationWeight(60, 63, 61.5)).toBeCloseTo(0.5, 9);
    expect(interpolationWeight(60, 63, 59)).toBe(0);
    expect(interpolationWeight(60, 63, 70)).toBe(1);
    expect(interpolationWeight(63, 63, 63)).toBe(1);
  });
});

describe('interpolateCell', () => {
  it('lerps position, velocity and radius and takes everything else from the newer view', () => {
    const older = createTestCellView({ x: 0, y: 0, velocityX: 0, velocityY: 10, radius: 10, mass: 20 });
    const newer = createTestCellView({ x: 10, y: 20, velocityX: 4, velocityY: 0, radius: 12, mass: 30 });
    const mid = interpolateCell(older, newer, 0.5);
    expect(mid).toMatchObject({ x: 5, y: 10, velocityX: 2, velocityY: 5, radius: 11, mass: 30 });
  });
});

describe('extrapolateCell', () => {
  it('carries the cell forward with its velocity, capped at the extrapolation limit', () => {
    const cell = createTestCellView({ x: 0, y: 0, velocityX: 60, velocityY: -60 });
    expect(extrapolateCell(cell, 1)).toMatchObject({ x: 1, y: -1 });
    expect(extrapolateCell(cell, 100)).toMatchObject({ x: MAX_EXTRAPOLATION_TICKS, y: -MAX_EXTRAPOLATION_TICKS });
    expect(extrapolateCell(cell, -5)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('interpolateCells and fragments', () => {
  it('matches by id, keeps a newborn as is and drops a vanished cell', () => {
    const older = [createTestCellView({ id: entityId('a'), x: 0 }), createTestCellView({ id: entityId('gone'), x: 0 })];
    const newer = [createTestCellView({ id: entityId('a'), x: 10 }), createTestCellView({ id: entityId('new'), x: 7 })];
    const cells = interpolateCells(older, newer, 0.25);
    expect(cells.map((cell) => [cell.id, cell.x])).toEqual([
      ['a', 2.5],
      ['new', 7],
    ]);
  });

  it('lerps fragment positions the same way', () => {
    const older = [{ id: entityId('f'), x: 0, y: 0, tag: 'motile' as const }];
    const newer = [
      { id: entityId('f'), x: 4, y: 8, tag: 'motile' as const },
      { id: entityId('g'), x: 1, y: 1, tag: 'photic' as const },
    ];
    expect(interpolateFragments(older, newer, 0.5)).toEqual([
      { id: 'f', x: 2, y: 4, tag: 'motile' },
      { id: 'g', x: 1, y: 1, tag: 'photic' },
    ]);
  });

  it('lerps a bacterium position between two reports', () => {
    const position = interpolatePosition({ id: entityId('m'), x: 0, y: 10 }, { id: entityId('m'), x: 10, y: 0 }, 0.3);
    expect(position).toEqual({ id: 'm', x: 3, y: 7 });
  });
});

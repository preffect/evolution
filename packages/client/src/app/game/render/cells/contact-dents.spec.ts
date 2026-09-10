import { describe, expect, it } from 'vitest';
import { createTestCellView, entityId } from '@evolution/shared';
import { computeContactDents } from './contact-dents';

const cell = (id: string, x: number, y: number, radius: number) =>
  createTestCellView({ id: entityId(id), x, y, radius });

describe('computeContactDents', () => {
  it('dents two touching cells toward each other and leaves separated cells alone', () => {
    const dents = computeContactDents([cell('a', 0, 0, 20), cell('b', 30, 0, 20), cell('c', 200, 0, 20)]);
    expect(dents.size).toBe(2);
    expect(dents.get(entityId('a'))!.centre).toBeCloseTo(0, 9);
    expect(Math.abs(dents.get(entityId('b'))!.centre)).toBeCloseTo(Math.PI, 9);
    expect(dents.get(entityId('a'))!.amplitude).toBe(-0.12);
  });

  it('keeps the deepest overlap when a cell touches two neighbours', () => {
    const dents = computeContactDents([cell('a', 0, 0, 20), cell('b', 35, 0, 20), cell('c', 0, -25, 20)]);
    expect(dents.get(entityId('a'))!.centre).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('never dents a predator against its prey or coincident centres', () => {
    const predator = createTestCellView({ id: entityId('p'), x: 0, y: 0, radius: 40, engulfingCellId: entityId('q') });
    const prey = createTestCellView({ id: entityId('q'), x: 20, y: 0, radius: 15, engulfedByCellId: entityId('p') });
    expect(computeContactDents([predator, prey]).size).toBe(0);
    expect(computeContactDents([cell('a', 0, 0, 20), cell('b', 0, 0, 20)]).size).toBe(0);
  });
});

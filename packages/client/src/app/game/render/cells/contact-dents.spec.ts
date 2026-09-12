// docs/RENDERING.md §9: the contact dent from a visible-cell scan; VISUAL-STYLE §5's σ per trait.

import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { createTestCellView } from '../../../../testing/builders';
import { CONTACT_DENT_AMPLITUDE, CONTACT_DENT_FULL_OVERLAP_RADII } from '../constants';
import { degreesToRadians } from '../geometry';
import { REST_DEFORMATION } from './cell-deformation';
import { computeContactDents, contactDentBump, withContactDent } from './contact-dents';

const cell = (id: string, x: number, y: number, radius: number) =>
  createTestCellView({ id: entityId(id), x, y, radius });

describe('computeContactDents', () => {
  it('dents two touching cells toward each other and leaves separated cells alone', () => {
    const dents = computeContactDents([cell('a', 0, 0, 20), cell('b', 30, 0, 20), cell('c', 200, 0, 20)]);
    expect(dents.size).toBe(2);
    expect(dents.get(entityId('a'))!.angle).toBeCloseTo(0, 9);
    expect(dents.get(entityId('a'))!.overlap).toBe(10);
    expect(dents.get(entityId('a'))!.depth).toBe(1);
    expect(Math.abs(dents.get(entityId('b'))!.angle)).toBeCloseTo(Math.PI, 9);
  });

  it('keeps the deepest overlap when a cell touches two neighbours', () => {
    const dents = computeContactDents([cell('a', 0, 0, 20), cell('b', 35, 0, 20), cell('c', 0, -25, 20)]);
    expect(dents.get(entityId('a'))!.angle).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('never dents a predator against its prey or coincident centres', () => {
    const predator = createTestCellView({ id: entityId('p'), x: 0, y: 0, radius: 40, engulfingCellId: entityId('q') });
    const prey = createTestCellView({ id: entityId('q'), x: 20, y: 0, radius: 15, engulfedByCellId: entityId('p') });
    expect(computeContactDents([predator, prey]).size).toBe(0);
    expect(computeContactDents([cell('a', 0, 0, 20), cell('b', 0, 0, 20)]).size).toBe(0);
  });
});

describe('contactDentBump and withContactDent', () => {
  const dent = { overlap: 4, angle: 1, depth: 1 };

  it('eases in with the press: a grazing touch is a shallow dent, a quarter-radius overlap the full one', () => {
    const grazing = computeContactDents([cell('a', 0, 0, 20), cell('b', 39.9, 0, 20)]).get(entityId('a'))!;
    expect(grazing.depth).toBeCloseTo(0.1 / (CONTACT_DENT_FULL_OVERLAP_RADII * 20), 9);
    expect(contactDentBump(grazing, false).amplitude).toBeCloseTo(CONTACT_DENT_AMPLITUDE * grazing.depth, 9);
    const pressed = computeContactDents([cell('a', 0, 0, 20), cell('b', 30, 0, 40)]).get(entityId('a'))!;
    expect(pressed.depth).toBe(1);
  });

  it('is −12 % r at the neighbour with σ 22°, sharpened to 14° when taut', () => {
    expect(contactDentBump(dent, false)).toEqual({
      amplitude: CONTACT_DENT_AMPLITUDE,
      centre: 1,
      sigma: degreesToRadians(22),
    });
    expect(contactDentBump(dent, true).sigma).toBeCloseTo(degreesToRadians(14), 12);
  });

  it('appends the dent to the deformation and drops it while the cell is engulfing', () => {
    const base = { bumps: [{ amplitude: 0.1, centre: 0, sigma: 0.3 }], pulse: 1.05, alpha: 1 };
    const dented = withContactDent(base, dent, { isTaut: false, isEngulfing: false });
    expect(dented.bumps).toHaveLength(2);
    expect(dented.pulse).toBe(1.05);
    expect(withContactDent(base, dent, { isTaut: false, isEngulfing: true })).toBe(base);
    expect(withContactDent(REST_DEFORMATION, undefined, { isTaut: true, isEngulfing: false })).toBe(REST_DEFORMATION);
  });
});

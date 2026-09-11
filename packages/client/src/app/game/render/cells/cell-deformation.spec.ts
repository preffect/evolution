import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { NO_DEFORMATIONS, REST_DEFORMATION, deformationOf, type CellDeformation } from './cell-deformation';

describe('deformationOf', () => {
  it('rests every cell that has no entry: no bumps, pulse 1, alpha 1', () => {
    expect(deformationOf(NO_DEFORMATIONS, entityId('c-1'))).toBe(REST_DEFORMATION);
    expect(REST_DEFORMATION).toEqual({ bumps: [], pulse: 1, alpha: 1 });
  });

  it('returns the cell’s own record when a source wrote one', () => {
    const dented: CellDeformation = { bumps: [{ amplitude: -0.12, centre: 1, sigma: 0.4 }], pulse: 1.09, alpha: 0.5 };
    const deformations = new Map([[entityId('c-2'), dented]]);
    expect(deformationOf(deformations, entityId('c-2'))).toBe(dented);
    expect(deformationOf(deformations, entityId('c-1'))).toBe(REST_DEFORMATION);
  });
});

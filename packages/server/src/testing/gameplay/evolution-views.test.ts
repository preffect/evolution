import { describe, expect, it } from 'vitest';
import { createTestCellView, createTestSnapshot, playerId } from '@evolution/shared';
import { locateCellInSnapshot } from './evolution-views.js';

describe('locateCellInSnapshot', () => {
  const alice = playerId('alice');
  const snapshot = createTestSnapshot({
    cells: [createTestCellView({ playerId: alice, x: 12.5, y: -3, radius: 17.9 })],
  });

  it("answers the player's centre and radius", () => {
    expect(locateCellInSnapshot(snapshot, alice)).toEqual({ x: 12.5, y: -3, radiusWu: 17.9 });
  });

  it('answers undefined for a player without a cell', () => {
    expect(locateCellInSnapshot(snapshot, playerId('bob'))).toBeUndefined();
  });
});

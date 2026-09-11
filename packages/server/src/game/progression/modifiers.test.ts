// docs/TRAITS.md §2, docs/ARCHITECTURE.md §2: the step-1 refresh of a cell's derived state.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, DEFAULT_CELL_MODIFIERS } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedState } from './modifiers.js';

describe('refreshCellDerivedState', () => {
  it('folds the player traits, mirrors them and the membrane bonus, and recomputes the stage', () => {
    const world = createTestWorld();
    const player = world.players[0]!;
    const cell = world.cells[0]!;
    player.ownedTraits = [
      { traitId: 'nucleoid', tier: 2 },
      { traitId: 'cell_wall', tier: 1 },
    ];
    refreshCellDerivedState(cell, player, DEFAULT_BALANCE);
    expect(cell.modifiers.dnaGainMultiplier).toBe(1.1);
    expect(cell.modifiers.membraneRatioBonus).toBe(0.15);
    expect(cell.membraneRatioBonus).toBe(0.15);
    expect(cell.stage).toBe(CELL_STAGE.prokaryote);
    expect(cell.traits).toEqual(player.ownedTraits);
    expect(cell.traits).not.toBe(player.ownedTraits);
  });

  it('is the identity for a fresh protocell and follows the mass for the radius', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    cell.mass = 80;
    refreshCellDerivedState(cell, world.players[0]!, DEFAULT_BALANCE);
    expect(cell.modifiers).toEqual(DEFAULT_CELL_MODIFIERS);
    expect(cell.stage).toBe(CELL_STAGE.protocell);
    expect(cell.radius).toBeCloseTo(35.78, 2);
  });
});

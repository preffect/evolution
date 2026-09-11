// docs/ARCHITECTURE.md §3.2 step 1, docs/GAME-DESIGN.md §6 (G7, T9) and docs/TRAITS.md §2.
import { describe, expect, it } from 'vitest';
import { createTestGameInput, DEFAULT_BALANCE, secondsToTicks } from '@evolution/shared';
import { queueOffer, shownOffer } from '../progression/offers.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { applyInputs, sprintCooldownTicks, tryStartSprint } from './inputs.js';
import { setCellMass } from './cell-mass.js';

const { controls, growth } = DEFAULT_BALANCE;

function fixture() {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  const player = world.players[0]!;
  const context = createTestStepContext(world);
  return { world, cell, player, context };
}

describe('tryStartSprint', () => {
  it('G7: starts a sprint, pays 5 % of the mass and arms the cooldown', () => {
    const { cell } = fixture();
    setCellMass(cell, 100, DEFAULT_BALANCE);
    expect(tryStartSprint(cell, DEFAULT_BALANCE)).toBe(true);
    expect(cell.mass).toBeCloseTo(95, 12);
    expect(cell.sprintRemainingTicks).toBe(secondsToTicks(controls.SPRINT_DURATION_SECONDS));
    expect(cell.sprintCooldownRemainingTicks).toBe(secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS));
  });

  it('floors the sprint cost at the starting mass', () => {
    const { cell } = fixture();
    tryStartSprint(cell, DEFAULT_BALANCE);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
  });

  it('refuses while on cooldown', () => {
    const { cell } = fixture();
    tryStartSprint(cell, DEFAULT_BALANCE);
    cell.sprintRemainingTicks = 0;
    expect(tryStartSprint(cell, DEFAULT_BALANCE)).toBe(false);
  });

  it('T9: the flagellum shortens the cooldown, floored at SPRINT_COOLDOWN_FLOOR_SECONDS', () => {
    const { cell } = fixture();
    cell.modifiers.sprintCooldownSecondsDelta = -0.5;
    expect(sprintCooldownTicks(cell, DEFAULT_BALANCE)).toBe(150);
    cell.modifiers.sprintCooldownSecondsDelta = -100;
    expect(sprintCooldownTicks(cell, DEFAULT_BALANCE)).toBe(
      secondsToTicks(DEFAULT_BALANCE.traits.SPRINT_COOLDOWN_FLOOR_SECONDS),
    );
  });
});

describe('applyInputs', () => {
  it('latches the target, records the sequence and clears the pending slot', () => {
    const { world, cell, player, context } = fixture();
    player.pendingInput = createTestGameInput({ sequence: 7, targetX: 123, targetY: -45 });
    applyInputs(world, context);
    expect(cell.targetX).toBe(123);
    expect(cell.targetY).toBe(-45);
    expect(player.appliedInputSequence).toBe(7);
    expect(player.pendingInput).toBeNull();
  });

  it('keeps the latched target when no input is pending', () => {
    const { world, cell, context } = fixture();
    cell.targetX = 9;
    applyInputs(world, context);
    expect(cell.targetX).toBe(9);
  });

  it('starts a sprint from the one-shot and counts a sprint on cooldown', () => {
    const { world, cell, player, context } = fixture();
    player.pendingInput = createTestGameInput({ sequence: 1, shouldSprint: true });
    applyInputs(world, context);
    expect(cell.sprintRemainingTicks).toBeGreaterThan(0);
    expect(context.rejections.sprintOnCooldown).toBe(0);
    player.pendingInput = createTestGameInput({ sequence: 2, shouldSprint: true });
    applyInputs(world, context);
    expect(context.rejections.sprintOnCooldown).toBe(1);
  });

  it('routes a stale trait choice to the rejection counter', () => {
    const { world, player, context } = fixture();
    player.pendingInput = createTestGameInput({ sequence: 1, traitChoice: { offerId: 99, cardIndex: 0 } });
    applyInputs(world, context);
    expect(context.rejections.staleTraitChoice).toBe(1);
  });

  it('shows a queued offer before the input applies, so a pick in the same tick lands', () => {
    const { world, player, context } = fixture();
    world.tick = 5;
    queueOffer(player);
    player.pendingInput = createTestGameInput({ sequence: 1, traitChoice: { offerId: 1, cardIndex: 0 } });
    applyInputs(world, context);
    expect(player.ownedTraits).toHaveLength(1);
    expect(shownOffer(player)).toBeUndefined();
  });

  it('refreshes the fold: a fixture-granted cilia I gives speedMultiplier 1.1', () => {
    const { world, cell, player, context } = fixture();
    player.ownedTraits.push({ traitId: 'cilia', tier: 1 });
    applyInputs(world, context);
    expect(cell.modifiers.speedMultiplier).toBeCloseTo(1.1, 12);
    expect(cell.traits).toEqual([{ traitId: 'cilia', tier: 1 }]);
  });

  it('applies an input for a spectating player without a cell and still records the sequence', () => {
    const { world, player, context } = fixture();
    world.cells = [];
    player.pendingInput = createTestGameInput({ sequence: 3, shouldSprint: true });
    applyInputs(world, context);
    expect(player.appliedInputSequence).toBe(3);
    expect(context.rejections.sprintOnCooldown).toBe(0);
  });
});

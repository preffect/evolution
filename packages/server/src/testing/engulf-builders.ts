// The E9 pair every engulf test starts from (docs/ECOLOGY.md §8: A at 100, B at 20, centres 10 wu
// apart) and the step driver that walks it. Shared so `engulf.test.ts`, `engulf-spit-out.test.ts`
// and `movement.test.ts` state the same setup once (docs/TESTING.md §8: builders live here).

import { DEFAULT_BALANCE, EFFECT_KIND, playerId, type GameEffect } from '@evolution/shared';
import { setCellMass } from '../game/simulation/cell-mass.js';
import { runEngulfs } from '../game/simulation/engulf.js';
import type { CellRecord } from '../game/world/entities.js';
import type { StepContext, WorldState } from '../game/world/world-state.js';
import { BROTH_POINT } from './gameplay/placement.js';
import { createTestStepContext, createTestWorld } from './world-builders.js';

/** E9 / E11: A at 100 covers B at 20 with their centres 10 wu apart, paying out on tick 36. */
export const ENGULF_PREDATOR_MASS = 100;
export const ENGULF_PREY_MASS = 20;
export const ENGULF_CENTRE_DISTANCE_WU = 10;
export const E9_PAYOUT_TICK = 36;
export const E9_COVER_TICKS = 6;
export const E9_SEAL_TICK = 18;

export interface EngulfFixture {
  world: WorldState;
  context: StepContext;
  predator: CellRecord;
  prey: CellRecord;
  /** A third cell, placed clear of the pair, for the chain and three-cell rows. */
  third: CellRecord;
}

export interface EngulfPairOptions {
  readonly predatorMass?: number;
  readonly preyMass?: number;
  readonly centreDistanceWu?: number;
}

/** Two placed cells at the E9 masses, plus a spare, with the gel patches cleared and nothing seeded. */
export function createEngulfFixture(options: EngulfPairOptions = {}): EngulfFixture {
  const world = createTestWorld({
    players: [
      { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
      { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
      { playerId: playerId('c'), playerName: 'C', avatarIndex: 2 },
    ],
  });
  world.gelPatches = [];
  const [predator, prey, third] = world.cells as [CellRecord, CellRecord, CellRecord];
  for (const [cell, mass, offset] of [
    [predator, options.predatorMass ?? ENGULF_PREDATOR_MASS, 0],
    [prey, options.preyMass ?? ENGULF_PREY_MASS, options.centreDistanceWu ?? ENGULF_CENTRE_DISTANCE_WU],
  ] as const) {
    cell.x = BROTH_POINT.x + offset;
    cell.y = BROTH_POINT.y;
    cell.targetX = cell.x;
    cell.targetY = cell.y;
    setCellMass(cell, mass, DEFAULT_BALANCE);
  }
  return { world, context: createTestStepContext(world), predator, prey, third };
}

/** `ticks` engulf steps with the tick counter advanced as `stepWorld` advances it. */
export function stepEngulf(fixture: EngulfFixture, ticks = 1): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    fixture.world.tick += 1;
    runEngulfs(fixture.world, fixture.context);
  }
}

/** Every `cell_released` reason in an effect list, in order. */
export function releaseReasonsOf(effects: readonly GameEffect[]): string[] {
  return effects
    .filter((effect) => effect.kind === EFFECT_KIND.cellReleased)
    .map((effect) => (effect.kind === EFFECT_KIND.cellReleased ? effect.reason : ''));
}

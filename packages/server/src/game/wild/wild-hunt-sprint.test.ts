// docs/ecology/wild-cells.md §3.3.3, the hunt sprint's two tests (the #594 review): a sprint that cannot reach the
// prey within its duration is not taken, nor one whose cost would leave the hunter under the engulf ratio, nor one at
// a prey it already covers; and the flee sprint mirrored: taken only when the threat's own sprint could reach.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, radiusForMass } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { doesHuntSprintReachPrey, isFleeSprintWorthwhile, isHuntSprintWorthwhile } from './wild-hunt-sprint.js';

const { absorption, growth } = DEFAULT_BALANCE;
const HUNTER_MASS = 100;
const PREY_MASS = 20;
/** Fast enough away that no 0.5 s sprint closes 2 hunter radii on it (the hunter's sprint cap is about 150 wu/s). */
const OUTRUNNING_SPEED_WU_S = 400;

interface Chase {
  readonly world: WorldState;
  readonly hunter: CellRecord;
  readonly prey: CellRecord;
}

/** Two cells on the x axis in an empty dish, the prey `atRadii` hunter radii east of the hunter, both at rest. */
function chase(atRadii: number, hunterMass = HUNTER_MASS): Chase {
  const world = createTestWorld();
  const hunter = world.cells[0]!;
  const prey: CellRecord = { ...hunter, id: 'c-prey' as CellRecord['id'] };
  world.cells.push(prey);
  setCellMass(hunter, hunterMass, world.balance);
  setCellMass(prey, PREY_MASS, world.balance);
  hunter.x = 0;
  hunter.y = 0;
  prey.x = radiusForMass(hunterMass, growth) * atRadii;
  prey.y = 0;
  return { world, hunter, prey };
}

describe('isHuntSprintWorthwhile', () => {
  it('sprints at a resting prey 2 radii away: the sprint reaches engulf contact in time', () => {
    const { world, hunter, prey } = chase(2);
    expect(doesHuntSprintReachPrey(hunter, prey, world, DEFAULT_BALANCE)).toBe(true);
    expect(isHuntSprintWorthwhile(hunter, prey, world, DEFAULT_BALANCE)).toBe(true);
  });

  it('does not sprint when the prey outruns the sprint: it cannot close the gap', () => {
    const { world, hunter, prey } = chase(2);
    prey.velocityX = OUTRUNNING_SPEED_WU_S;
    expect(isHuntSprintWorthwhile(hunter, prey, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('does not sprint when paying for it leaves the hunter under the engulf ratio', () => {
    const atTheRatio = PREY_MASS * absorption.ENGULF_MASS_RATIO;
    const { world, hunter, prey } = chase(2, atTheRatio);
    expect(doesHuntSprintReachPrey(hunter, prey, world, DEFAULT_BALANCE)).toBe(true);
    expect(isHuntSprintWorthwhile(hunter, prey, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('does not sprint at a prey it already covers: the engulf starts this tick', () => {
    const { world, hunter, prey } = chase(0.25);
    expect(isHuntSprintWorthwhile(hunter, prey, world, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('isFleeSprintWorthwhile', () => {
  it('sprints from a resting threat whose own sprint would reach it', () => {
    const { world, hunter: threat, prey: self } = chase(2);
    expect(isFleeSprintWorthwhile(self, threat, world, DEFAULT_BALANCE)).toBe(true);
  });

  it('flees at normal speed when it is already outrunning the threat', () => {
    const { world, hunter: threat, prey: self } = chase(2);
    self.velocityX = OUTRUNNING_SPEED_WU_S;
    expect(isFleeSprintWorthwhile(self, threat, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('sprints when the threat already covers it: the engulf would start this tick', () => {
    const { world, hunter: threat, prey: self } = chase(0.25);
    expect(isFleeSprintWorthwhile(self, threat, world, DEFAULT_BALANCE)).toBe(true);
  });
});

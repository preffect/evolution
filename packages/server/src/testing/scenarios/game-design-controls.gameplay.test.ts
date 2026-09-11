// docs/GAME-DESIGN.md §13, the control rows (G4–G7), each run twice and hash-compared. The
// session and world-clock rows are game-design-session.gameplay.test.ts.

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_HZ, radiusForMass, secondsToTicks } from '@evolution/shared';
import type { EvolutionScenarioSnapshot } from '../gameplay/evolution-adapter.js';
import { cellOf, massOf, speedOf } from '../gameplay/evolution-views.js';
import { combineScripts, player, sprint, targetPoint, targetRadiiEast, type PlayerScript } from '../gameplay/index.js';
import {
  FULL_THROTTLE_RADII,
  MASS_TOLERANCE,
  SPEED_TOLERANCE_WU_PER_SECOND,
  decayed,
  placedSolo,
  seededSolo,
} from './shared-setups.js';

const { growth, world: dish, controls } = DEFAULT_BALANCE;
/** G6 starts inside the shallows, 100 wu short of the wall, aiming past it. */
const G6_START_X = 2900;
const G6_TARGET_X = 4000;
/** G7 presses sprint again on tick 100, inside the cooldown. */
const G7_COOLDOWN_PRESS_TICK = 100;

describe('GAME-DESIGN §13: controls', () => {
  it('G4: full throttle east reaches 216.5 wu/s in a second', () => {
    // The row's number is the starting cell's speed cap: on the seeded world the cell of seed 42
    // eats an algae on its way east (mass 21, cap 217.4), so the row runs placed at the starting mass.
    const blend = 1 / (growth.CELL_ACCELERATION_SECONDS * TICK_HZ);
    placedSolo('G4')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS })
      .from(1, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .advance(60)
      .expect('velocity x', (view) => cellOf(view, 0)?.velocityX)
      .atTick(60)
      .toBeCloseTo(growth.CELL_BASE_SPEED * (1 - (1 - blend) ** 60), SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('velocity y', (view) => cellOf(view, 0)?.velocityY)
      .atTick(60)
      .toBe(0)
      .runDeterministic();
  });

  it('G5: a target inside the dead zone moves nothing', () => {
    const insideDeadZone: PlayerScript<EvolutionScenarioSnapshot> = (context) =>
      context.cell === undefined
        ? null
        : {
            targetX: context.cell.x + (controls.STEER_DEAD_ZONE_RADII / 2) * context.cell.radius,
            targetY: context.cell.y,
          };
    seededSolo('G5')
      .from(1, player(0).does(insideDeadZone))
      .advance(60)
      .expect('speed', (view) => speedOf(view, 0))
      .atTick(60)
      .toBe(0)
      .runDeterministic();
  });

  it('G6: the wall clamps the centre and zeroes the outward velocity', () => {
    placedSolo('G6')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: { x: G6_START_X, y: 0 } })
      .from(1, player(0).does(targetPoint(G6_TARGET_X, 0)))
      .advance(120)
      .expect('centre x', (view) => cellOf(view, 0)?.x)
      .atTick(120)
      .toBeCloseTo(dish.DISH_RADIUS - radiusForMass(growth.CELL_STARTING_MASS, growth), MASS_TOLERANCE)
      .expect('velocity x', (view) => cellOf(view, 0)?.velocityX)
      .atTick(120)
      .toBe(0)
      .runDeterministic();
  });

  it('G7: the sprint costs 5 % once, lasts half a second and honours its cooldown', () => {
    const sprintTicks = secondsToTicks(controls.SPRINT_DURATION_SECONDS);
    const cooldownTicks = secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS);
    const sprintEast = combineScripts([sprint(), targetRadiiEast(FULL_THROTTLE_RADII)]);
    placedSolo('G7')
      .placeCell({ playerIndex: 0, mass: 100 })
      .from(1, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .atTick(1, player(0).does(sprintEast))
      .atTick(G7_COOLDOWN_PRESS_TICK, player(0).does(sprintEast))
      .atTick(cooldownTicks + 1, player(0).does(sprintEast))
      .advance(cooldownTicks + 1)
      .expect('mass after the cost and two ticks of decay', (view) => massOf(view, 0))
      .atTick(2)
      .toBeCloseTo(decayed(100 * (1 - controls.SPRINT_MASS_COST_FRACTION), 2), MASS_TOLERANCE)
      .expect('sprint active', (view) => cellOf(view, 0)?.sprintRemainingTicks)
      .atTick(2)
      .toBeGreaterThan(0)
      .expect('sprint over', (view) => cellOf(view, 0)?.sprintRemainingTicks)
      .atTick(sprintTicks + 1)
      .toBe(0)
      .expect('sprint on cooldown is ignored', (view) => cellOf(view, 0)?.sprintRemainingTicks)
      .atTick(G7_COOLDOWN_PRESS_TICK)
      .toBe(0)
      .expect('cooldown still running at 100', (view) => cellOf(view, 0)?.sprintCooldownRemainingTicks)
      .atTick(G7_COOLDOWN_PRESS_TICK)
      .toBeGreaterThan(0)
      .expect('sprint accepted at 181', (view) => cellOf(view, 0)?.sprintRemainingTicks)
      .atTick(cooldownTicks + 1)
      .toBeGreaterThan(0)
      .runDeterministic();
  });
});

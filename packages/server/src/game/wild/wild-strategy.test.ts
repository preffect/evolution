// docs/ecology/wild-cells.md §3.3.3 and docs/ecology/acceptance.md §8.1 W6, W7, W13, W14: the cadence, and each
// decision branch with a seat that takes it and one that does not (escape, flee, hunt, graze), the wander fallback,
// and the `wildCells` stream as the only randomness. The sprint rules are wild-strategy-sprint.test.ts.
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  FOOD_KIND,
  SERVER_RANDOM_STREAM_LABELS,
  RANDOM_STREAM,
  radiusForMass,
  secondsToTicks,
} from '@evolution/shared';
import {
  HUNTING_TICK,
  JUST_PAST_RADII,
  JUST_PAST_WU,
  LUNCH_MASS,
  PROTOCELL_TICK,
  SECOND_PLAYER,
  THREAT_MASS,
  arena,
  targetOf,
} from '../../testing/wild-arena.js';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { TEST_PLAYER, createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import { findCell } from '../world/lookups.js';
import type { StepContext } from '../world/world-state.js';
import { wildSightRange } from './wild-perception.js';
import { decideWildTargets, decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';
import { pointAlongHeading } from './wild-wander.js';

const { wildCells, controls, growth } = DEFAULT_BALANCE;
const INTERVAL_TICKS = secondsToTicks(wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS);
describe('ticksUntilDecision', () => {
  it('counts to the next tick ≡ seat (mod interval) strictly after the given one', () => {
    expect(ticksUntilDecision(0, 0, INTERVAL_TICKS)).toBe(INTERVAL_TICKS); // seat 0 of a fresh world: tick 30
    expect(ticksUntilDecision(0, 1, INTERVAL_TICKS)).toBe(1);
    expect(ticksUntilDecision(0, 24, INTERVAL_TICKS)).toBe(24);
    expect(ticksUntilDecision(36, 0, INTERVAL_TICKS)).toBe(24); // W4: absorbed on tick 36, the next is 60
    expect(ticksUntilDecision(HUNTING_TICK - 1, 0, INTERVAL_TICKS)).toBe(1); // W6: placed before tick 21 600
    expect(ticksUntilDecision(HUNTING_TICK, 0, INTERVAL_TICKS)).toBe(INTERVAL_TICKS);
  });

  it('reads the interval from the balance', () => {
    expect(decisionIntervalTicks(DEFAULT_BALANCE)).toBe(INTERVAL_TICKS);
  });
});

describe('decideWildTargets: cadence', () => {
  it('leaves a fresh seat 0 without a target through 29 ticks and latches one on the 30th, restarting the countdown', () => {
    const world = createTestWorld({ hasWildSeats: true });
    const context = createTestStepContext(world);
    const seat = world.wildSeats[0]!;
    const cell = findCell(world, seat.cellId!)!;
    expect(seat.decideInTicks).toBe(INTERVAL_TICKS);
    for (let tick = 1; tick < INTERVAL_TICKS; tick += 1) {
      world.tick = tick;
      decideWildTargets(world, context);
    }
    expect(targetOf(cell)).toEqual({ x: null, y: null });
    world.tick = INTERVAL_TICKS;
    decideWildTargets(world, context);
    expect(cell.targetX).not.toBeNull();
    expect(seat.decideInTicks).toBe(INTERVAL_TICKS);
  });

  it('staggers by seat: seat 1 decides on tick 1', () => {
    const world = createTestWorld({ hasWildSeats: true });
    world.tick = 1;
    decideWildTargets(world, createTestStepContext(world));
    expect(findCell(world, world.wildSeats[1]!.cellId!)!.targetX).not.toBeNull();
    expect(findCell(world, world.wildSeats[0]!.cellId!)!.targetX).toBeNull();
  });

  it('skips a vacant seat without touching its countdown', () => {
    const world = createTestWorld({ hasWildSeats: true });
    const seat = world.wildSeats[0]!;
    seat.cellId = null;
    seat.decideInTicks = 1;
    decideWildTargets(world, createTestStepContext(world));
    expect(seat.decideInTicks).toBe(1);
  });
});

describe('decideWildTargets: flee (W7)', () => {
  it('flees a player that can engulf it within WILD_CELL_FLEE_RANGE_RADII: STEER_FULL_THROTTLE_RADII radii straight away', () => {
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: 5 });
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: -controls.STEER_FULL_THROTTLE_RADII * wild.radius, y: 0 });
  });

  it('does not flee the same player one radius past the range: it wanders instead', () => {
    const outside = wildCells.WILD_CELL_FLEE_RANGE_RADII + 1;
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: outside });
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual(pointAlongHeading(world.wildSeats[0]!, wild, world.balance));
    expect(targetOf(wild)).not.toEqual({ x: -controls.STEER_FULL_THROTTLE_RADII * wild.radius, y: 0 });
  });

  it('wins over a hunt: a threat north and a lunch east at the hunting stage, the seat runs south', () => {
    const { world, context, wild } = arena({
      wildMass: THREAT_MASS,
      playerMass: LUNCH_MASS,
      playerAtRadii: 3,
      tick: HUNTING_TICK,
      players: [TEST_PLAYER, SECOND_PLAYER],
    });
    const threat = world.cells[1]!;
    setCellMass(threat, THREAT_MASS * 2, world.balance);
    threat.x = 0;
    threat.y = -wild.radius * 5;
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: 0, y: controls.STEER_FULL_THROTTLE_RADII * wild.radius });
  });
});

describe('decideWildTargets: hunt (W6)', () => {
  it('hunts a player it can engulf in sight from the hunting stage on: the target is its centre, no sprint at 5 radii', () => {
    const { world, context, wild, player } = arena({
      wildMass: THREAT_MASS,
      playerMass: LUNCH_MASS,
      playerAtRadii: 5,
      tick: HUNTING_TICK,
    });
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: player.x, y: player.y });
    expect(wild.sprintRemainingTicks).toBe(0);
    expect(wild.sprintCooldownRemainingTicks).toBe(0);
  });

  it('does not hunt the same player before the hunting stage, nor one just out of sight', () => {
    const early = arena({ wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: 5, tick: PROTOCELL_TICK });
    decideWildTargets(early.world, early.context);
    expect(targetOf(early.wild)).not.toEqual({ x: early.player.x, y: early.player.y });
    const threatRadius = radiusForMass(THREAT_MASS, growth);
    const outside = wildSightRange(threatRadius, DEFAULT_BALANCE) / threatRadius + JUST_PAST_RADII;
    const far = arena({ wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: outside, tick: HUNTING_TICK });
    decideWildTargets(far.world, far.context);
    expect(targetOf(far.wild)).not.toEqual({ x: far.player.x, y: far.player.y });
    expect(targetOf(far.wild)).toEqual(pointAlongHeading(far.world.wildSeats[0]!, far.wild, far.world.balance));
  });
});

describe('decideWildTargets: wild prey and grazing (W7, W13)', () => {
  it('hunts a wild cell it can engulf from tick 0, before the players are prey', () => {
    const { world, context, wild } = arena({ wildMass: THREAT_MASS, playerMass: THREAT_MASS, playerAtRadii: 20 });
    const lunch = seatTestWildCell(world, { seatNumber: 1, at: { x: wild.radius * 5, y: 0 }, mass: LUNCH_MASS }).cell;
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: lunch.x, y: lunch.y });
  });

  it('grazes the nearest algae or detritus mote in sight and passes over bacteria', () => {
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS, playerMass: LUNCH_MASS, playerAtRadii: 20 });
    spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.plain, at: { x: 50, y: 0 } });
    const algae = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 0, y: 120 } });
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: algae.x, y: algae.y });
  });

  it('wanders past a mote just out of sight', () => {
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS, playerMass: LUNCH_MASS, playerAtRadii: 20 });
    const sight = wildSightRange(wild.radius, DEFAULT_BALANCE);
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 0, y: sight + JUST_PAST_WU } });
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual(pointAlongHeading(world.wildSeats[0]!, wild, world.balance));
  });
});

describe('decideWildTargets: randomness', () => {
  function streamPositions(context: StepContext): Record<string, number> {
    return Object.fromEntries(
      SERVER_RANDOM_STREAM_LABELS.map((label) => [label, context.streams[label].getState().position]),
    );
  }

  it('a flee draws nothing; a wander draws from the wildCells stream and no other', () => {
    const fleeing = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: 5 });
    const before = streamPositions(fleeing.context);
    decideWildTargets(fleeing.world, fleeing.context);
    expect(streamPositions(fleeing.context)).toEqual(before);

    const wandering = arena({ wildMass: LUNCH_MASS, playerMass: LUNCH_MASS, playerAtRadii: 5 });
    const untouched = streamPositions(wandering.context);
    decideWildTargets(wandering.world, wandering.context);
    const after = streamPositions(wandering.context);
    expect(after[RANDOM_STREAM.wildCells]).toBe(untouched[RANDOM_STREAM.wildCells]! + 1);
    expect({ ...after, [RANDOM_STREAM.wildCells]: untouched[RANDOM_STREAM.wildCells] }).toEqual(untouched);
  });
});

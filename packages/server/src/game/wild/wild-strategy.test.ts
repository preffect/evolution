// docs/ecology/wild-cells.md §3.3.3 and docs/ecology/acceptance.md §8.1 W6, W7, W13, W14: the cadence, and each
// decision branch with a seat that takes it and one that does not (escape, flee, hunt, graze), the wander fallback,
// the sprint rules and how their cost is paid, and the `wildCells` stream as the only randomness.
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  FOOD_KIND,
  SERVER_RANDOM_STREAM_LABELS,
  RANDOM_STREAM,
  playerId,
  radiusForMass,
  secondsToTicks,
  type BalanceConfig,
} from '@evolution/shared';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { TEST_PLAYER, createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { PlayerIdentity } from '../session/players.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { beginEngulf, sealEngulf } from '../simulation/engulf-state.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import type { CellRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { wildSightRange } from './wild-perception.js';
import { decideWildTargets, decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';
import { pointAlongHeading } from './wild-wander.js';

const { wildCells, controls, growth } = DEFAULT_BALANCE;
const INTERVAL_TICKS = secondsToTicks(wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS);
/** Elapsed ticks at which the world stage is `endosymbiosis`, the hunting stage (W6). */
const HUNTING_TICK = 21_600;
const PROTOCELL_TICK = 1;
const THREAT_MASS = 100;
const LUNCH_MASS = 20;
/** How far past a boundary (sight, a sprint range) the "just outside" cases sit, in own radii or in wu. */
const JUST_PAST_RADII = 0.01;
const JUST_PAST_WU = 1;
const SECOND_PLAYER: PlayerIdentity = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
/** Keeps every heading: the wander target is then exactly `pointAlongHeading`. */
const NEVER_TURNS: BalanceConfig = structuredClone(DEFAULT_BALANCE);
NEVER_TURNS.wildCells.WILD_CELL_TURN_CHANCE = 0;

interface Arena {
  readonly world: WorldState;
  readonly context: StepContext;
  readonly wild: CellRecord;
  readonly player: CellRecord;
}

interface ArenaOptions {
  readonly wildMass: number;
  readonly playerMass: number;
  /** The player's centre this many wild radii east of the wild cell (at the origin). */
  readonly playerAtRadii: number;
  readonly tick?: number;
  readonly players?: readonly PlayerIdentity[];
}

/** Seat 0 alone at the origin with the player(s) placed east of it, due to decide on the next call. */
function arena(options: ArenaOptions): Arena {
  const world = createTestWorld({ hasWildSeats: true, players: options.players });
  const seat = world.wildSeats[0]!;
  const wild = findCell(world, seat.cellId!)!;
  const player = world.cells[0]!;
  world.wildSeats = [seat];
  world.cells = [...world.cells.filter((cell) => cell.playerId !== null), wild];
  world.tick = options.tick ?? PROTOCELL_TICK;
  setCellMass(wild, options.wildMass, world.balance);
  wild.x = 0;
  wild.y = 0;
  setCellMass(player, options.playerMass, world.balance);
  player.x = wild.radius * options.playerAtRadii;
  player.y = 0;
  seat.decideInTicks = 1;
  return { world, context: createTestStepContext(world, { balance: NEVER_TURNS }), wild, player };
}

function targetOf(cell: CellRecord) {
  return { x: cell.targetX, y: cell.targetY };
}

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

describe('decideWildTargets: sprint (W14)', () => {
  it('sprints from a threat within WILD_CELL_SPRINT_FLEE_RADII, spending growth first and wounding the rest', () => {
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS * 2, playerMass: THREAT_MASS, playerAtRadii: 3 });
    const seat = world.wildSeats[0]!;
    const growthBefore = 1;
    seat.fullMass = wild.mass;
    seat.grownMass = growthBefore;
    const massBefore = wild.mass;
    decideWildTargets(world, context);
    const spent = massBefore * controls.SPRINT_MASS_COST_FRACTION;
    expect(wild.sprintRemainingTicks).toBe(secondsToTicks(controls.SPRINT_DURATION_SECONDS));
    expect(wild.mass).toBeCloseTo(massBefore - spent, 9);
    // The growth pays what it can, for good; the rest is a wound below the full size, which the settle recovers.
    expect(seat.grownMass).toBe(0);
    expect(seat.fullMass).toBeCloseTo(massBefore - growthBefore, 9);
    expect(seat.fullMass - wild.mass).toBeCloseTo(spent - growthBefore, 9);
  });

  it('pays a sprint wholly from its growth when the growth covers it: no wound', () => {
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS * 2, playerMass: THREAT_MASS, playerAtRadii: 3 });
    const seat = world.wildSeats[0]!;
    const growthBefore = 10;
    seat.fullMass = wild.mass;
    seat.grownMass = growthBefore;
    decideWildTargets(world, context);
    const spent = LUNCH_MASS * 2 * controls.SPRINT_MASS_COST_FRACTION;
    expect(seat.grownMass).toBeCloseTo(growthBefore - spent, 9);
    expect(seat.fullMass).toBeCloseTo(wild.mass, 9);
  });

  it('does not sprint from the same threat just past the sprint range', () => {
    const atRadii = wildCells.WILD_CELL_SPRINT_FLEE_RADII + JUST_PAST_RADII;
    const { world, context, wild } = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: atRadii });
    decideWildTargets(world, context);
    expect(wild.targetX).not.toBeNull();
    expect(wild.sprintRemainingTicks).toBe(0);
  });

  it('sprints on a hunt within WILD_CELL_SPRINT_HUNT_RADII, but never while it is engulfing', () => {
    const hunting = { wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: 2, tick: HUNTING_TICK };
    const free = arena(hunting);
    decideWildTargets(free.world, free.context);
    expect(free.wild.sprintRemainingTicks).toBeGreaterThan(0);
    const engulfing = arena(hunting);
    beginEngulf({ predator: engulfing.wild, prey: engulfing.player });
    decideWildTargets(engulfing.world, engulfing.context);
    expect(targetOf(engulfing.wild)).toEqual({ x: engulfing.player.x, y: engulfing.player.y });
    expect(engulfing.wild.sprintRemainingTicks).toBe(0);
  });

  it('does not sprint at a prey it already covers: the engulf starts this tick, there is no gap to close', () => {
    const covering = arena({ wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: 0.25, tick: HUNTING_TICK });
    decideWildTargets(covering.world, covering.context);
    expect(targetOf(covering.wild)).toEqual({ x: covering.player.x, y: covering.player.y });
    expect(covering.wild.sprintRemainingTicks).toBe(0);
  });

  it('runs from its engulfer and sprints before the seal, and never sprints once carried', () => {
    const escaping = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: 0.5 });
    beginEngulf({ predator: escaping.player, prey: escaping.wild });
    decideWildTargets(escaping.world, escaping.context);
    expect(targetOf(escaping.wild)).toEqual({ x: -controls.STEER_FULL_THROTTLE_RADII * escaping.wild.radius, y: 0 });
    expect(escaping.wild.sprintRemainingTicks).toBeGreaterThan(0);
    const carried = arena({ wildMass: LUNCH_MASS, playerMass: THREAT_MASS, playerAtRadii: 0.5 });
    beginEngulf({ predator: carried.player, prey: carried.wild });
    sealEngulf({ predator: carried.player, prey: carried.wild });
    decideWildTargets(carried.world, carried.context);
    expect(carried.wild.sprintRemainingTicks).toBe(0);
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

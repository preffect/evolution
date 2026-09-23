// docs/ecology/wild-cells.md §3.3.3 and §3.3.1, docs/ecology/acceptance.md §8.1 W14: when a wild cell sprints (flee
// within WILD_CELL_SPRINT_FLEE_RADII, hunt within WILD_CELL_SPRINT_HUNT_RADII, the escape before the seal; never while
// engulfing or carried, nor at a prey it already covers) and how the cost is paid (growth first, the rest a wound).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, secondsToTicks } from '@evolution/shared';
import { HUNTING_TICK, JUST_PAST_RADII, LUNCH_MASS, THREAT_MASS, arena, targetOf } from '../../testing/wild-arena.js';
import { beginEngulf, sealEngulf } from '../simulation/engulf-state.js';
import { decideWildTargets } from './wild-strategy.js';

const { wildCells, controls } = DEFAULT_BALANCE;

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

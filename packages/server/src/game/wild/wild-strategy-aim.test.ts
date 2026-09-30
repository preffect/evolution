// docs/ecology/wild-cells.md §3.3.3, ticket #738: the hunt aim as the step drives it, re-resolved every tick between
// decisions from the prey's current place and the contact (charge, hold, or the centre). The aim's own arithmetic is
// wild-hunt-aim.test.ts'.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, radiusForMass, secondsToTicks } from '@evolution/shared';
import { JUST_PAST_WU, LUNCH_MASS, THREAT_MASS, arena, targetOf } from '../../testing/wild-arena.js';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { huntTargetThisTick } from './wild-hunt-aim.js';
import { decideWildTargets } from './wild-strategy.js';

const { wildCells, growth } = DEFAULT_BALANCE;
const INTERVAL_TICKS = secondsToTicks(wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS);

describe('decideWildTargets: the hunt aim, every tick (ticket #738)', () => {
  const lunchRadius = radiusForMass(LUNCH_MASS, growth);
  /** How far off a hunter's centre a lunch's centre is covered: the engulf-contact reach. */
  const reachOf = (hunterRadius: number) =>
    hunterRadius - lunchRadius * DEFAULT_BALANCE.absorption.ENGULF_COVERAGE_FRACTION;
  /** Seat 0 hunting seat 1's lunch, placed `atX` east of it; the player far off and not prey. */
  function hunting(atX: (hunterRadius: number) => number) {
    const setup = arena({ wildMass: THREAT_MASS, playerMass: THREAT_MASS, playerAtRadii: 20 });
    const lunch = seatTestWildCell(setup.world, {
      seatNumber: 1,
      at: { x: atX(setup.wild.radius), y: 0 },
      mass: LUNCH_MASS,
    }).cell;
    return { ...setup, lunch };
  }
  const touchingNotCovered = (hunterRadius: number) => (reachOf(hunterRadius) + hunterRadius + lunchRadius) / 2;
  /** Seat 1 is placed after seat 0's countdown was set; this keeps it from deciding in the rows below. */
  const holdLunch = (world: ReturnType<typeof arena>['world']) => {
    world.wildSeats[1]!.decideInTicks = INTERVAL_TICKS * 10;
  };
  /** The hold's target for the pair as it stands (its arithmetic is wild-hunt-aim.test.ts'). */
  const holdTarget = ({ wild, lunch, world }: ReturnType<typeof hunting>) =>
    huntTargetThisTick(wild, lunch, world, DEFAULT_BALANCE);
  const chargeTarget = (hunter: { radius: number }, lunch: { x: number }) => ({
    x: lunch.x + wildCells.WILD_CELL_HUNT_CHARGE_RADII * hunter.radius,
    y: 0,
  });

  it('charges a prey it touches but does not cover: WILD_CELL_HUNT_CHARGE_RADII own radii past its centre', () => {
    const { world, context, wild, lunch } = hunting(touchingNotCovered);
    decideWildTargets(world, context);
    expect(world.wildSeats[0]!.huntPreyId).toBe(lunch.id);
    expect(targetOf(wild)).toEqual(chargeTarget(wild, lunch));
  });

  it('holds over a prey its membrane covers, and aims at the centre of one just out of contact', () => {
    const covered = hunting(reachOf);
    decideWildTargets(covered.world, covered.context);
    expect(targetOf(covered.wild)).toEqual(holdTarget(covered));
    const apart = hunting((radius) => radius + lunchRadius + JUST_PAST_WU);
    decideWildTargets(apart.world, apart.context);
    expect(targetOf(apart.wild)).toEqual({ x: apart.lunch.x, y: 0 });
  });

  it('holds over its prey while engulfing it, or anything else, instead of charging', () => {
    const onIt = hunting(touchingNotCovered);
    beginEngulf({ predator: onIt.wild, prey: onIt.lunch });
    decideWildTargets(onIt.world, onIt.context);
    expect(targetOf(onIt.wild)).toEqual(holdTarget(onIt));
    expect(targetOf(onIt.wild)).not.toEqual(chargeTarget(onIt.wild, onIt.lunch));
    const onOther = hunting(touchingNotCovered);
    beginEngulf({ predator: onOther.wild, prey: onOther.player });
    decideWildTargets(onOther.world, onOther.context);
    expect(targetOf(onOther.wild)).toEqual(holdTarget(onOther));
    expect(targetOf(onOther.wild)).not.toEqual(chargeTarget(onOther.wild, onOther.lunch));
  });

  it('stops charging and holds the tick the engulf starts, between decisions', () => {
    const setup = hunting(touchingNotCovered);
    const { world, context, wild, lunch } = setup;
    holdLunch(world);
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual(chargeTarget(wild, lunch));
    beginEngulf({ predator: wild, prey: lunch });
    decideWildTargets(world, context);
    expect(world.wildSeats[0]!.decideInTicks).toBe(INTERVAL_TICKS - 1);
    expect(targetOf(wild)).toEqual(holdTarget(setup));
  });

  it('follows the prey between decisions, and charges once it comes into contact', () => {
    const { world, context, wild, lunch } = hunting((radius) => radius * 5);
    holdLunch(world);
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: lunch.x, y: 0 });
    lunch.y = wild.radius;
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: lunch.x, y: lunch.y });
    lunch.x = touchingNotCovered(wild.radius);
    lunch.y = 0;
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual(chargeTarget(wild, lunch));
  });

  it('keeps its last target when the prey leaves the world, and ends the hunt', () => {
    const { world, context, wild, lunch } = hunting((radius) => radius * 5);
    holdLunch(world);
    decideWildTargets(world, context);
    world.cells = world.cells.filter((cell) => cell.id !== lunch.id);
    world.wildSeats[1]!.cellId = null;
    decideWildTargets(world, context);
    expect(targetOf(wild)).toEqual({ x: lunch.x, y: 0 });
    expect(world.wildSeats[0]!.huntPreyId).toBeNull();
  });
});

// docs/ecology/wild-cells.md §3.3.3, ticket #738: the per-tick hunt aim's contact, charge and aim rules at their
// boundaries (touching exactly, covering exactly), over a hunter at the origin and a lunch due east of it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@evolution/shared';
import { LUNCH_MASS, THREAT_MASS, arena, targetOf } from '../../testing/wild-arena.js';
import { beginEngulf } from '../simulation/engulf-state.js';
import { speedCapOf } from '../simulation/movement.js';
import { aimWildHunt, holdVelocityOf, huntTargetThisTick, isHuntCharging, isInContact } from './wild-hunt-aim.js';

const { absorption, wildCells } = DEFAULT_BALANCE;
const ONE_WU = 1;
/** Faster than the speed cap, so the hold brakes at full throttle. */
const CROSSING_SPEED = 400;
/** Well under the speed cap. */
const DRIFT_SPEED = 30;
const TARGET_DIGITS = 9;

/** Seat 0 (mass 100) at the origin and the player (mass 20) `eastWu(hunter radius, lunch radius)` east of it. */
function pair(eastWu: (hunterRadius: number, lunchRadius: number) => number) {
  const setup = arena({ wildMass: THREAT_MASS, playerMass: LUNCH_MASS, playerAtRadii: 0 });
  setup.player.x = eastWu(setup.wild.radius, setup.player.radius);
  return setup;
}
const touching = (hunter: number, lunch: number) => hunter + lunch;
const covering = (hunter: number, lunch: number) => hunter - lunch * absorption.ENGULF_COVERAGE_FRACTION;

describe('isInContact', () => {
  it('holds with the centres exactly the sum of the radii apart, not one wu further', () => {
    const exactly = pair(touching);
    expect(isInContact(exactly.wild, exactly.player)).toBe(true);
    const apart = pair((hunter, lunch) => touching(hunter, lunch) + ONE_WU);
    expect(isInContact(apart.wild, apart.player)).toBe(false);
  });
});

describe('isHuntCharging', () => {
  it('charges a prey it touches whose centre sits one wu past its membrane, not one it covers', () => {
    const justOutside = pair((hunter, lunch) => covering(hunter, lunch) + ONE_WU);
    expect(isHuntCharging(justOutside.wild, justOutside.player, DEFAULT_BALANCE)).toBe(true);
    const covered = pair(covering);
    expect(isHuntCharging(covered.wild, covered.player, DEFAULT_BALANCE)).toBe(false);
  });

  it('never charges while engulfing, nor out of contact', () => {
    const engulfing = pair(touching);
    beginEngulf({ predator: engulfing.wild, prey: engulfing.player });
    expect(isHuntCharging(engulfing.wild, engulfing.player, DEFAULT_BALANCE)).toBe(false);
    const apart = pair((hunter, lunch) => touching(hunter, lunch) + ONE_WU);
    expect(isHuntCharging(apart.wild, apart.player, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('holdVelocityOf', () => {
  const seconds = DEFAULT_BALANCE.growth.CELL_ACCELERATION_SECONDS;

  it('closes the gap to a still prey over the steer time constant', () => {
    const { wild, player } = pair(covering);
    expect(holdVelocityOf(wild, player, DEFAULT_BALANCE)).toEqual({ x: player.x / seconds, y: 0 });
  });

  it('brakes a hunter crossing the centre of a still prey: exactly its own velocity, reversed', () => {
    const { wild, player } = pair(() => 0);
    wild.velocityX = CROSSING_SPEED;
    expect(holdVelocityOf(wild, player, DEFAULT_BALANCE)).toEqual({ x: -CROSSING_SPEED, y: 0 });
  });

  it("matches a drifting prey's velocity when it sits on its centre at that velocity", () => {
    const { wild, player } = pair(() => 0);
    wild.velocityY = DRIFT_SPEED;
    player.velocityY = DRIFT_SPEED;
    expect(holdVelocityOf(wild, player, DEFAULT_BALANCE)).toEqual({ x: 0, y: DRIFT_SPEED });
  });
});

describe('huntTargetThisTick and aimWildHunt', () => {
  const { controls } = DEFAULT_BALANCE;

  it('aims at the centre out of contact, and WILD_CELL_HUNT_CHARGE_RADII past a prey it charges', () => {
    const apart = pair((hunter, lunch) => touching(hunter, lunch) + ONE_WU);
    expect(huntTargetThisTick(apart.wild, apart.player, apart.world, DEFAULT_BALANCE)).toEqual({
      x: apart.player.x,
      y: 0,
    });
    const charging = pair(touching);
    expect(huntTargetThisTick(charging.wild, charging.player, charging.world, DEFAULT_BALANCE)).toEqual({
      x: charging.player.x + wildCells.WILD_CELL_HUNT_CHARGE_RADII * charging.wild.radius,
      y: 0,
    });
  });

  it('holds with the target the steer ramp turns into the hold velocity: full throttle braking, none at rest', () => {
    const crossing = pair(() => 0);
    crossing.wild.velocityX = CROSSING_SPEED;
    expect(huntTargetThisTick(crossing.wild, crossing.player, crossing.world, DEFAULT_BALANCE)).toEqual({
      x: -controls.STEER_FULL_THROTTLE_RADII * crossing.wild.radius,
      y: 0,
    });
    const resting = pair(() => 0);
    expect(huntTargetThisTick(resting.wild, resting.player, resting.world, DEFAULT_BALANCE)).toEqual({ x: 0, y: 0 });
    const slow = pair(() => 0);
    slow.wild.velocityX = -DRIFT_SPEED;
    slow.player.velocityX = -DRIFT_SPEED;
    const throttle = DRIFT_SPEED / speedCapOf(slow.wild, slow.world, DEFAULT_BALANCE);
    const radii =
      controls.STEER_DEAD_ZONE_RADII + throttle * (controls.STEER_FULL_THROTTLE_RADII - controls.STEER_DEAD_ZONE_RADII);
    const target = huntTargetThisTick(slow.wild, slow.player, slow.world, DEFAULT_BALANCE);
    expect(target.x).toBeCloseTo(-radii * slow.wild.radius, TARGET_DIGITS);
    expect(target.y).toBe(0);
  });

  it('re-aims only a seat with a hunt, at its prey this tick, and ends a hunt whose prey is gone', () => {
    const { world, wild, player } = pair(touching);
    const seat = world.wildSeats[0]!;
    aimWildHunt(seat, wild, world, DEFAULT_BALANCE);
    expect(targetOf(wild)).toEqual({ x: null, y: null });
    seat.huntPreyId = player.id;
    aimWildHunt(seat, wild, world, DEFAULT_BALANCE);
    expect(targetOf(wild)).toEqual({ x: player.x + wildCells.WILD_CELL_HUNT_CHARGE_RADII * wild.radius, y: 0 });
    world.cells = world.cells.filter((cell) => cell.id !== player.id);
    aimWildHunt(seat, wild, world, DEFAULT_BALANCE);
    expect(seat.huntPreyId).toBeNull();
    expect(targetOf(wild)).toEqual({ x: player.x + wildCells.WILD_CELL_HUNT_CHARGE_RADII * wild.radius, y: 0 });
  });
});

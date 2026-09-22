// docs/ecology/wild-cells.md §3.3, the "wander" row: the turn roll, the kept or redrawn heading, the disc and the origin.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, createSeededRandom, type BalanceConfig } from '@evolution/shared';
import { spawnReach } from '../simulation/spawn-placement.js';
import { createWildSeatRecord } from './wild-seats.js';
import {
  drawWildHeading,
  isInsideWanderDisc,
  pointAlongHeading,
  setSeatHeading,
  wanderTargetOf,
} from './wild-wander.js';

const { controls, ecology } = DEFAULT_BALANCE;
const SEED = 7;
const CELL = { x: 500, y: -200, radius: 20 };
const EAST = { x: 1, y: 0 };

function balanceWith(turnChance: number, maxAttempts = ecology.SPAWN_POINT_MAX_ATTEMPTS): BalanceConfig {
  const balance = structuredClone(DEFAULT_BALANCE);
  balance.wildCells.WILD_CELL_TURN_CHANCE = turnChance;
  balance.ecology.SPAWN_POINT_MAX_ATTEMPTS = maxAttempts;
  return balance;
}

function seatHeading(heading = EAST) {
  const seat = createWildSeatRecord(0);
  setSeatHeading(seat, heading);
  return seat;
}

describe('drawWildHeading', () => {
  it('is a unit vector from one draw, the same from the same seed', () => {
    const heading = drawWildHeading(createSeededRandom(SEED));
    expect(Math.hypot(heading.x, heading.y)).toBeCloseTo(1, 10);
    expect(drawWildHeading(createSeededRandom(SEED))).toEqual(heading);
    const random = createSeededRandom(SEED);
    drawWildHeading(random);
    expect(random.getState().position).toBe(1);
  });
});

describe('pointAlongHeading', () => {
  it('aims STEER_FULL_THROTTLE_RADII own radii from the centre along the heading', () => {
    expect(pointAlongHeading(seatHeading(), CELL, DEFAULT_BALANCE)).toEqual({
      x: CELL.x + controls.STEER_FULL_THROTTLE_RADII * CELL.radius,
      y: CELL.y,
    });
  });
});

describe('wanderTargetOf', () => {
  it('keeps the heading when the turn roll fails (chance 0) and spends exactly the roll', () => {
    const seat = seatHeading();
    const random = createSeededRandom(SEED);
    const target = wanderTargetOf(seat, CELL, random, balanceWith(0));
    expect(target).toEqual(pointAlongHeading(seatHeading(), CELL, DEFAULT_BALANCE));
    expect({ x: seat.headingX, y: seat.headingY }).toEqual(EAST);
    expect(random.getState().position).toBe(1);
  });

  it('draws a new heading when the turn roll succeeds (chance 1): the roll and the angle, two draws', () => {
    const seat = seatHeading();
    const random = createSeededRandom(SEED);
    const target = wanderTargetOf(seat, CELL, random, balanceWith(1));
    expect({ x: seat.headingX, y: seat.headingY }).not.toEqual(EAST);
    expect(Math.hypot(seat.headingX, seat.headingY)).toBeCloseTo(1, 10);
    expect(target).toEqual(pointAlongHeading(seat, CELL, DEFAULT_BALANCE));
    expect(random.getState().position).toBe(2);
  });

  it('is the same decision from the same stream state', () => {
    const first = seatHeading();
    const second = seatHeading();
    expect(wanderTargetOf(first, CELL, createSeededRandom(SEED), balanceWith(0.5))).toEqual(
      wanderTargetOf(second, CELL, createSeededRandom(SEED), balanceWith(0.5)),
    );
    expect([first.headingX, first.headingY]).toEqual([second.headingX, second.headingY]);
  });

  it('redraws a heading whose target leaves the placement disc until one stays inside', () => {
    const atTheEdge = { x: spawnReach(DEFAULT_BALANCE), y: 0, radius: 20 };
    const seat = seatHeading(EAST);
    const target = wanderTargetOf(seat, atTheEdge, createSeededRandom(SEED), balanceWith(0));
    expect(isInsideWanderDisc(target, DEFAULT_BALANCE)).toBe(true);
    expect({ x: seat.headingX, y: seat.headingY }).not.toEqual(EAST);
    expect(target).toEqual(pointAlongHeading(seat, atTheEdge, DEFAULT_BALANCE));
  });

  it('aims at the origin once the redraws are spent', () => {
    const atTheEdge = { x: spawnReach(DEFAULT_BALANCE), y: 0, radius: 20 };
    const seat = seatHeading(EAST);
    expect(wanderTargetOf(seat, atTheEdge, createSeededRandom(SEED), balanceWith(0, 0))).toEqual({ x: 0, y: 0 });
    expect({ x: seat.headingX, y: seat.headingY }).toEqual(EAST);
  });
});

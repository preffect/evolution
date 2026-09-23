// docs/ecology/wild-cells.md §3.3.6 (the die-off): the budget, the one heaviest starver, starvation from the growth
// first and then the base size, the burst floor, and the burst itself (scraps, the seat freed to respawn).
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, FOOD_KIND, TICK_INTERVAL_S } from '@evolution/shared';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import {
  burstStarvedCell,
  chooseWildStarver,
  isStarvedOut,
  starveSettled,
  wildCarryingCapacity,
} from './wild-die-off.js';

const { wildCells } = DEFAULT_BALANCE;
/** One tick of starvation: the fraction of the full size a starving settle takes (1/600 at 10 % a second). */
const STARVED_PER_TICK = wildCells.WILD_CELL_STARVATION_FRACTION_PER_SECOND * TICK_INTERVAL_S;
const WORLD_MASS = 20;

/** Seats of the given masses around the dish in an otherwise empty world at tick 0 (world mass 20). */
function dishOf(masses: readonly number[]): WorldState {
  const world = createTestWorld();
  world.cells = [];
  masses.forEach((mass, seatNumber) => {
    seatTestWildCell(world, {
      seatNumber,
      at: { x: 1000 * Math.cos(seatNumber), y: 1000 * Math.sin(seatNumber) },
      mass,
    });
  });
  return world;
}

describe('wildCarryingCapacity', () => {
  it('is 1.5 × 24 × the world mass: 720 at 0:00', () => {
    expect(wildCarryingCapacity(WORLD_MASS, DEFAULT_BALANCE)).toBe(720);
  });
});

describe('chooseWildStarver (W16)', () => {
  it('starves the heaviest seated cell once the total is over the budget, and marks its cell', () => {
    const world = dishOf([400, 360]);
    chooseWildStarver(world, WORLD_MASS, DEFAULT_BALANCE);
    expect(world.wildSeats.map((seat) => seat.isStarving)).toEqual([true, false]);
    expect(world.cells.map((cell) => cell.isStarving)).toEqual([true, false]);
  });

  it('starves no one under the budget, and only one at a time over it', () => {
    const under = dishOf([400, 300]);
    chooseWildStarver(under, WORLD_MASS, DEFAULT_BALANCE);
    expect(under.wildSeats.some((seat) => seat.isStarving)).toBe(false);
    const over = dishOf([400, 360]);
    over.wildSeats[1]!.isStarving = true;
    chooseWildStarver(over, WORLD_MASS, DEFAULT_BALANCE);
    expect(over.wildSeats.map((seat) => seat.isStarving)).toEqual([false, true]);
  });

  it('breaks a tie to the lower seat and counts a vacant seat as nothing', () => {
    const world = dishOf([380, 380, 380]);
    world.wildSeats[0]!.cellId = null;
    chooseWildStarver(world, WORLD_MASS, DEFAULT_BALANCE);
    expect(world.wildSeats.map((seat) => seat.isStarving)).toEqual([false, true, false]);
  });
});

describe('starveSettled', () => {
  it('takes a tick of starvation from the growth first', () => {
    const settled = { mass: 100, grownMass: 20, fullMass: 100 };
    const starved = starveSettled(settled, 4, WORLD_MASS, DEFAULT_BALANCE);
    expect(starved.grownMass).toBeCloseTo(20 - 100 * STARVED_PER_TICK, 9);
    expect(starved.sizeFactor).toBe(4);
    expect(starved.fullMass).toBeCloseTo(100 * (1 - STARVED_PER_TICK), 9);
    expect(starved.mass).toBeCloseTo(starved.fullMass, 9);
  });

  it('then from the base size through the size factor, keeping the wound below the smaller full size (W15)', () => {
    const settled = { mass: 790, grownMass: 0, fullMass: 800 };
    const starved = starveSettled(settled, 40, WORLD_MASS, DEFAULT_BALANCE);
    expect(starved.sizeFactor).toBeCloseTo(40 * (1 - STARVED_PER_TICK), 9);
    expect(starved.grownMass).toBe(0);
    expect(starved.fullMass - starved.mass).toBeCloseTo(10, 9);
  });
});

describe('isStarvedOut and the burst (W15)', () => {
  it('dies once the full size is under the smallest newborn, 0.5 × the world mass', () => {
    expect(isStarvedOut(9.99, WORLD_MASS, DEFAULT_BALANCE)).toBe(true);
    expect(isStarvedOut(10, WORLD_MASS, DEFAULT_BALANCE)).toBe(false);
  });

  it('bursts into ordinary scraps and frees the seat, which stops starving', () => {
    const world = dishOf([100]);
    const seat = world.wildSeats[0]!;
    const cell = world.cells[0]!;
    seat.isStarving = true;
    const context = createTestStepContext(world);
    burstStarvedCell(world, seat, cell, context.streams.spawner);
    expect(world.cells).toEqual([]);
    expect(seat.isStarving).toBe(false);
    expect(world.food.every((mote) => mote.kind === FOOD_KIND.detritus)).toBe(true);
    const { ecology } = DEFAULT_BALANCE;
    expect(world.food.length).toBe(Math.floor((ecology.DETRITUS_MASS_FRACTION * 100) / ecology.DETRITUS_MOTE_MASS));
  });
});

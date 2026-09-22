// The wild strategy through the whole step (docs/architecture/server-simulation.md §3 steps 1 and 3;
// docs/ecology/acceptance.md §8.1 W6, W7): a seat sits still until its first decision tick, a flee target moves the
// cell away through the shared kernel, a hunt target appears on the first decision at the hunting stage and not
// one interval earlier, and a wild cell never sprints.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, RADIANS_PER_FULL_TURN, secondsToTicks } from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { runStep } from '../simulation/step.js';
import type { CellRecord } from '../world/entities.js';
import { findCell } from '../world/lookups.js';
import { createInputRejectionCounters, type WorldState } from '../world/world-state.js';
import { decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';

const { controls } = DEFAULT_BALANCE;
const INTERVAL_TICKS = decisionIntervalTicks(DEFAULT_BALANCE);
const HUNTING_TICK = 21_600;
const DEGREES_PER_FULL_TURN = 360;
const HEADING_TOLERANCE_DEGREES = 5;

function step(world: WorldState, ticks = 1): void {
  for (let count = 0; count < ticks; count += 1) {
    runStep(world, world.balance, createInputRejectionCounters());
  }
}

/** Seat 0 alone with the one player, both relocated; the seat's countdown as a placement at `world.tick` sets it. */
function soloSeat(tick = 0): { world: WorldState; wild: CellRecord; player: CellRecord } {
  const world = createTestWorld({ hasWildSeats: true });
  const seat = world.wildSeats[0]!;
  const wild = findCell(world, seat.cellId!)!;
  const player = world.cells[0]!;
  world.wildSeats = [seat];
  world.cells = [player, wild];
  world.tick = tick;
  seat.massSpreadFactor = 1;
  seat.decideInTicks = ticksUntilDecision(world.tick, seat.seatNumber, INTERVAL_TICKS);
  return { world, wild, player };
}

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly mass: number;
}

function place(cell: CellRecord, placement: Placement, world: WorldState): void {
  cell.x = placement.x;
  cell.y = placement.y;
  setCellMass(cell, placement.mass, world.balance);
}

function headingDegrees(cell: CellRecord): number {
  return (Math.atan2(cell.velocityY, cell.velocityX) / RADIANS_PER_FULL_TURN) * DEGREES_PER_FULL_TURN;
}

describe('the wild strategy through the step', () => {
  it("sits still until seat 0's first decision on tick 30, then steers along the latched target", () => {
    const { world, wild } = soloSeat();
    step(world, INTERVAL_TICKS - 1);
    expect(wild.targetX).toBeNull();
    expect([wild.velocityX, wild.velocityY]).toEqual([0, 0]);
    step(world);
    expect(wild.targetX).not.toBeNull();
    step(world);
    expect(Math.hypot(wild.velocityX, wild.velocityY)).toBeGreaterThan(0);
  });

  it('W7: seat 0 placed 5 radii east of a threat flees east on tick 30 and points east within 5° by tick 60, never sprinting', () => {
    const { world, wild, player } = soloSeat();
    place(player, { x: 0, y: 0, mass: 100 }, world);
    place(wild, { x: 89, y: 0, mass: 20 }, world);
    step(world, INTERVAL_TICKS);
    // Decided at step 1 of tick 30 from where it sat (89, 0) at that tick's pinned radius; step 3 then moved it.
    expect(wild.targetX).toBeCloseTo(89 + controls.STEER_FULL_THROTTLE_RADII * wild.radius, 6);
    expect(wild.targetY).toBeCloseTo(0, 6);
    step(world, secondsToTicks(1) - INTERVAL_TICKS);
    expect(Math.abs(headingDegrees(wild))).toBeLessThanOrEqual(HEADING_TOLERANCE_DEGREES);
    expect(wild.x).toBeGreaterThan(89);
    expect(wild.sprintRemainingTicks).toBe(0);
  });

  it('W6: placed before tick 21 600, seat 0 hunts the lunch 5 radii east on that tick; placed one interval earlier it does not', () => {
    const hunting = soloSeat(HUNTING_TICK - 1);
    place(hunting.player, { x: 390, y: 0, mass: 20 }, hunting.world);
    place(hunting.wild, { x: 0, y: 0, mass: 380 }, hunting.world);
    step(hunting.world);
    expect(hunting.world.tick).toBe(HUNTING_TICK);
    expect([hunting.wild.targetX, hunting.wild.targetY]).toEqual([hunting.player.x, hunting.player.y]);

    const early = soloSeat(HUNTING_TICK - INTERVAL_TICKS - 1);
    place(early.player, { x: 390, y: 0, mass: 20 }, early.world);
    place(early.wild, { x: 0, y: 0, mass: 380 }, early.world);
    step(early.world);
    expect(early.wild.targetX).not.toBeNull();
    expect([early.wild.targetX, early.wild.targetY]).not.toEqual([early.player.x, early.player.y]);
  });
});

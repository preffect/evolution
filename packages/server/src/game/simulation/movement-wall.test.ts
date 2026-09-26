// docs/ecology/absorption.md §6.3 ("nothing rides past the rim") and docs/ecology/mass-and-movement.md §5.3 (#710): a
// cell its neighbour presses into the dish wall stays inside it, because separation stops each push at the wall and
// gives what the wall took to the other cell; the pressed pair settles instead of being traded back and forth
// between the push and the clamp tick to tick, and no deeper than the minimum centre distance.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, playerId } from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { separateOverlappingCells } from './contact.js';
import { moveCells } from './movement.js';

const { DISH_RADIUS } = DEFAULT_BALANCE.world;
/** Float slack on "the rim is inside the dish": the clamp places a centre at `DISH_RADIUS − radius` exactly, up to rounding. */
const RIM_EPSILON_WU = 1e-9;
/** Neither can engulf the other (24 / 20 is under the engulf ratio), so separation pushes them apart. */
const HEAVIER_MASS = 24;
const LIGHTER_MASS = 20;
const { CELL_MIN_CENTRE_DISTANCE_FRACTION, CELL_SEPARATION_FRACTION_PER_TICK } = DEFAULT_BALANCE.growth;
/** The oblique row: the wall cell sits on the rim 37° round from the x axis and the pusher presses it along x. */
const OBLIQUE_WALL_ANGLE_RAD = (37 * Math.PI) / 180;
/** Float slack on the gap the oblique push must open along its centre line (wu). */
const GAP_EPSILON_WU = 1e-9;
/** How deep the pusher starts inside the wall cell, centre to centre (wu). */
const START_CENTRE_DISTANCE_WU = 20;
/** Where both steer: far past the east wall, so both press into it at full throttle every tick. */
const PAST_THE_WALL_X = 2 * DISH_RADIUS;
/** Long enough for the pair to settle against the wall, then the window the tick-to-tick motion is measured over. */
const SETTLE_TICKS = 300;
const MEASURE_TICKS = 60;
/** The most a settled pressed pair's centre may move in one tick (wu): at rest, up to float noise. */
const SETTLED_STEP_BOUND_WU = 1e-6;

interface PressedPair {
  readonly world: WorldState;
  readonly wallCell: CellRecord;
  readonly pusher: CellRecord;
}

/** The wall cell touching the east wall, the pusher inside it on the dish side, both steering into the wall. */
function pressedPair(wallCellMass = HEAVIER_MASS, pusherMass = LIGHTER_MASS, wallAngle = 0): PressedPair {
  const world = createTestWorld({
    players: [
      { playerId: playerId('wall'), playerName: 'Wall', avatarIndex: 0 },
      { playerId: playerId('pusher'), playerName: 'Pusher', avatarIndex: 1 },
    ],
  });
  world.gelPatches = [];
  const [wallCell, pusher] = world.cells as [CellRecord, CellRecord];
  setCellMass(wallCell, wallCellMass, DEFAULT_BALANCE);
  setCellMass(pusher, pusherMass, DEFAULT_BALANCE);
  wallCell.x = (DISH_RADIUS - wallCell.radius) * Math.cos(wallAngle);
  wallCell.y = (DISH_RADIUS - wallCell.radius) * Math.sin(wallAngle);
  pusher.x = wallCell.x - START_CENTRE_DISTANCE_WU;
  pusher.y = wallCell.y;
  for (const cell of [wallCell, pusher]) {
    cell.targetX = PAST_THE_WALL_X;
    cell.targetY = cell.y;
  }
  return { world, wallCell, pusher };
}

const rimOverrunOf = (cell: CellRecord): number => Math.hypot(cell.x, cell.y) + cell.radius - DISH_RADIUS;

describe('a cell pressed into the dish wall by its neighbour (#710)', () => {
  it('ends the tick with its whole body inside the dish, although separation pushed it outward', () => {
    const { world, wallCell, pusher } = pressedPair();
    moveCells(world, createTestStepContext(world));
    expect(rimOverrunOf(wallCell)).toBeLessThanOrEqual(RIM_EPSILON_WU);
    expect(rimOverrunOf(pusher)).toBeLessThanOrEqual(RIM_EPSILON_WU);
  });

  // A clamp pass after separation alone fails both rows: the wall cell's share of every push is lost, so a heavier
  // pusher never settles (0.45 wu a tick) and a lighter one sinks to 7.5 wu, far under the minimum centre distance.
  it.each([
    ['the lighter', HEAVIER_MASS, LIGHTER_MASS],
    ['the heavier', LIGHTER_MASS, HEAVIER_MASS],
  ])(
    'settles with %s cell pushing: no jitter tick to tick, and no deeper than the minimum distance',
    (_pusher, wallCellMass, pusherMass) => {
      const { world, wallCell, pusher } = pressedPair(wallCellMass, pusherMass);
      const context = createTestStepContext(world);
      for (let tick = 0; tick < SETTLE_TICKS; tick += 1) moveCells(world, context);
      let largestStep = 0;
      for (let tick = 0; tick < MEASURE_TICKS; tick += 1) {
        const before = [wallCell, pusher].map((cell) => ({ x: cell.x, y: cell.y }));
        moveCells(world, context);
        [wallCell, pusher].forEach((cell, index) => {
          const start = before[index]!;
          largestStep = Math.max(largestStep, Math.hypot(cell.x - start.x, cell.y - start.y));
        });
        expect(rimOverrunOf(wallCell)).toBeLessThanOrEqual(RIM_EPSILON_WU);
      }
      expect(largestStep).toBeLessThan(SETTLED_STEP_BOUND_WU);
      const minimumDistance = (wallCell.radius + pusher.radius) * CELL_MIN_CENTRE_DISTANCE_FRACTION;
      expect(wallCell.x - pusher.x).toBeGreaterThanOrEqual(minimumDistance);
    },
  );

  // Off the axis the wall's radial correction is only partly along the push, so the other cell takes just its
  // projection: the pair still opens by the whole push along its centre line, and neither rim leaves the dish.
  it('an oblique push against the wall: the pair opens by the whole push along its line, both rims inside', () => {
    const { world, wallCell, pusher } = pressedPair(HEAVIER_MASS, LIGHTER_MASS, OBLIQUE_WALL_ANGLE_RAD);
    const distance = Math.hypot(wallCell.x - pusher.x, wallCell.y - pusher.y);
    const line = { x: (wallCell.x - pusher.x) / distance, y: (wallCell.y - pusher.y) / distance };
    const push = (wallCell.radius + pusher.radius - distance) * CELL_SEPARATION_FRACTION_PER_TICK;
    separateOverlappingCells(world, DEFAULT_BALANCE);
    const gapAlongLine = (wallCell.x - pusher.x) * line.x + (wallCell.y - pusher.y) * line.y;
    expect(Math.abs(gapAlongLine - (distance + push))).toBeLessThanOrEqual(GAP_EPSILON_WU);
    expect(rimOverrunOf(wallCell)).toBeLessThanOrEqual(RIM_EPSILON_WU);
    expect(rimOverrunOf(pusher)).toBeLessThanOrEqual(RIM_EPSILON_WU);
  });
});

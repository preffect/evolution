// docs/ecology/giants.md §3.5.7 and docs/ecology/acceptance.md §8.2 G6: the grazer's forward cone. Forward is the
// velocity's direction, or the seat's heading at exactly zero velocity; the cone's edge is in; the motes ahead are
// taken first and all of them only when none lies ahead; a diet with no cone takes them all.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DEGREES_PER_FULL_TURN,
  GIANT_SPECIES,
  RADIANS_PER_FULL_TURN,
  type Vec2,
} from '@evolution/shared';
import { seatTestGiantCell } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { WILD_CELL_DIET, giantDiet } from '../simulation/cell-diet.js';
import { forwardOf, grazeCandidatesOf, isWithinForwardCone } from './seat-graze.js';
import { setSeatHeading } from './wild-wander.js';

const ORIGIN: Vec2 = { x: 0, y: 0 };
const EAST: Vec2 = { x: 1, y: 0 };
const NORTH: Vec2 = { x: 0, y: 1 };
const HALF_ANGLE = DEFAULT_BALANCE.giants.GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES;
/** G6: mote P 300 wu out at 45° left of ahead, mote Q 200 wu behind. */
const MOTE_P: Vec2 = { x: 212.13, y: 212.13 };
const MOTE_Q: Vec2 = { x: -200, y: 0 };
const GRAZER = giantDiet(GIANT_SPECIES.paramecium, DEFAULT_BALANCE);

function grazerAtOrigin(heading: Vec2 = EAST) {
  const world = createTestWorld();
  const placed = seatTestGiantCell(world, { species: GIANT_SPECIES.paramecium, at: ORIGIN, bornMass: 1100 });
  setSeatHeading(placed.seat, heading);
  return placed;
}

/** A point `distance` wu from the origin at `degrees` left of east. */
function atAngle(degrees: number, distance = 100): Vec2 {
  const radians = (degrees / DEGREES_PER_FULL_TURN) * RADIANS_PER_FULL_TURN;
  return { x: distance * Math.cos(radians), y: distance * Math.sin(radians) };
}

describe('forwardOf', () => {
  it("is the seat's heading at exactly zero velocity, and the velocity's direction at any other", () => {
    const { seat, cell } = grazerAtOrigin(NORTH);
    expect(forwardOf(cell, seat)).toEqual(NORTH);
    cell.velocityX = 3;
    cell.velocityY = -4;
    expect(forwardOf(cell, seat)).toEqual({ x: 0.6, y: -0.8 });
    cell.velocityX = Number.MIN_VALUE;
    cell.velocityY = 0;
    expect(forwardOf(cell, seat)).toEqual(EAST);
  });
});

describe('isWithinForwardCone', () => {
  it('takes bearings up to the half-angle either side of forward and nothing past it', () => {
    expect(isWithinForwardCone(ORIGIN, atAngle(0), EAST, HALF_ANGLE)).toBe(true);
    expect(isWithinForwardCone(ORIGIN, atAngle(59.9), EAST, HALF_ANGLE)).toBe(true);
    expect(isWithinForwardCone(ORIGIN, atAngle(-59.9), EAST, HALF_ANGLE)).toBe(true);
    expect(isWithinForwardCone(ORIGIN, atAngle(60.1), EAST, HALF_ANGLE)).toBe(false);
    expect(isWithinForwardCone(ORIGIN, atAngle(180), EAST, HALF_ANGLE)).toBe(false);
  });
});

describe('grazeCandidatesOf', () => {
  it('G6: keeps only the motes ahead when any lies ahead, though one behind is nearer', () => {
    const { seat, cell } = grazerAtOrigin();
    expect(grazeCandidatesOf([MOTE_Q, MOTE_P], cell, seat, GRAZER)).toEqual([MOTE_P]);
  });

  it('G6 (no P): keeps every mote when none lies ahead', () => {
    const { seat, cell } = grazerAtOrigin();
    expect(grazeCandidatesOf([MOTE_Q], cell, seat, GRAZER)).toEqual([MOTE_Q]);
  });

  it('turns the cone with the velocity once it moves', () => {
    const { seat, cell } = grazerAtOrigin();
    cell.velocityX = -1;
    expect(grazeCandidatesOf([MOTE_Q, MOTE_P], cell, seat, GRAZER)).toEqual([MOTE_Q]);
  });

  it('a diet with no cone keeps every mote', () => {
    const { seat, cell } = grazerAtOrigin();
    expect(grazeCandidatesOf([MOTE_Q, MOTE_P], cell, seat, WILD_CELL_DIET)).toEqual([MOTE_Q, MOTE_P]);
  });
});

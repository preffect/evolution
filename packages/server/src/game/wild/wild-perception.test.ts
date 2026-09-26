// docs/ecology/wild-cells.md §3.3.3 and docs/ecology/acceptance.md §8.1 W11: a wild seat's sight (a same-size
// player's view half-height), what lies in it (every cell, algae and detritus, the boundary included), and the
// perception over it, keyed by the seat's cell id; the hunt's view leaves a prey to a closer rival (ticket #737).
import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, CELL_KIND, DEFAULT_BALANCE, FOOD_KIND, distanceBetween, entityId } from '@evolution/shared';
import { LUNCH_MASS, THREAT_MASS } from '../../testing/wild-arena.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { setCellMass } from '../simulation/cell-mass.js';
import { spawnFoodMote } from '../simulation/spawn-mote.js';
import {
  createWildHuntPerception,
  createWildPerception,
  hasCloserRival,
  wildSightOf,
  wildSightRange,
} from './wild-perception.js';

const { absorption } = DEFAULT_BALANCE;
/** W11: `wildSightRange` of radius 17.89 → 300.0, 77.97 → 626.3, 282.8 → 1192.9 (± 0.1). */
const SIGHT_TOLERANCE = 0.1;

describe('wildSightRange (W11)', () => {
  it('is the sight multiple times the view half-height of a same-size player', () => {
    expect(Math.abs(wildSightRange(17.89, DEFAULT_BALANCE) - 300)).toBeLessThanOrEqual(SIGHT_TOLERANCE);
    expect(Math.abs(wildSightRange(77.97, DEFAULT_BALANCE) - 626.3)).toBeLessThanOrEqual(SIGHT_TOLERANCE);
    expect(Math.abs(wildSightRange(282.8, DEFAULT_BALANCE) - 1192.9)).toBeLessThanOrEqual(SIGHT_TOLERANCE);
  });
});

describe('wildSightOf', () => {
  it('matches a brute-force distance check on a seeded population, the boundary included', () => {
    const world = createTestWorld({ hasWildSeats: true, isFilled: true });
    const viewer = world.cells.find((cell) => cell.kind === CELL_KIND.wild)!;
    const range = wildSightRange(viewer.radius, DEFAULT_BALANCE);
    const onTheEdge = spawnFoodMote(world, {
      kind: FOOD_KIND.algae,
      variant: null,
      at: { x: viewer.x + range, y: viewer.y },
    });
    const sight = wildSightOf(world, viewer, DEFAULT_BALANCE);
    const isInRange = (entity: { x: number; y: number }) => distanceBetween(viewer, entity) <= range;
    expect(sight.cells).toEqual(world.cells.filter(isInRange));
    expect(sight.motes).toEqual(world.food.filter((mote) => mote.kind !== FOOD_KIND.bacterium && isInRange(mote)));
    expect(sight.motes).toContain(onTheEdge);
    expect(sight.cells).toContain(viewer);
  });

  it('leaves bacteria out of what it would graze', () => {
    const world = createTestWorld({ hasWildSeats: true });
    const viewer = world.cells.find((cell) => cell.kind === CELL_KIND.wild)!;
    spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.plain, at: viewer });
    expect(wildSightOf(world, viewer, DEFAULT_BALANCE).motes).toEqual([]);
  });
});

describe('createWildPerception', () => {
  const world = createTestWorld({ hasWildSeats: true });
  const player = world.cells[0]!;
  const wild = world.cells.find((cell) => cell.kind === CELL_KIND.wild)!;
  const sight = { cells: [player, wild], motes: [] };

  it('locates the own cell by its entity id, and nothing by an id that is not in the world', () => {
    const perception = createWildPerception(sight, world.balance);
    expect(perception.ownCellOf(world, wild.id)).toBe(wild);
    expect(perception.ownCellOf(world, player.id)).toBe(player);
    expect(perception.ownCellOf(world, entityId('cell_nowhere'))).toBeUndefined();
  });

  it('sees every cell in sight, and leaves the players out when they are not prey yet', () => {
    expect(createWildPerception(sight, world.balance).cellsOf(world)).toEqual([player, wild]);
    expect(createWildPerception(sight, world.balance, false).cellsOf(world)).toEqual([wild]);
  });

  it('answers the shared engulf predicate over the live absorption balance', () => {
    const perception = createWildPerception(sight, world.balance);
    setCellMass(wild, 20, world.balance);
    setCellMass(player, 20 * absorption.ENGULF_MASS_RATIO, world.balance);
    expect(perception.canEngulf(player, wild)).toBe(true);
    expect(perception.canEngulf(wild, player)).toBe(false);
  });
});

/** The hunter at the origin and its prey this far east (wu); a rival's distance to the prey is read against it. */
const PREY_AT_X = 200;

describe('hasCloserRival and the hunt perception (ticket #737)', () => {
  function rivalry(rivalAtX: number, rivalMass = THREAT_MASS) {
    const world = createTestWorld({ hasWildSeats: true });
    const [hunter, prey, rival] = world.cells.filter((cell) => cell.kind === CELL_KIND.wild);
    const place = (cell: typeof hunter, x: number, mass: number) => {
      setCellMass(cell!, mass, world.balance);
      cell!.x = x;
      cell!.y = 0;
      return cell!;
    };
    return {
      world,
      hunter: place(hunter, 0, THREAT_MASS),
      prey: place(prey, PREY_AT_X, LUNCH_MASS),
      rival: place(rival, rivalAtX, rivalMass),
    };
  }

  it('a rival that can swallow the prey and is strictly closer to it blocks the hunt', () => {
    const { world, hunter, prey, rival } = rivalry(PREY_AT_X + 100);
    const sight = { cells: [hunter, prey, rival], motes: [] };
    expect(hasCloserRival(sight, hunter, prey, world.balance)).toBe(true);
    expect(createWildHuntPerception(sight, world.balance, hunter, true).cellsOf(world)).toEqual([hunter, rival]);
  });

  it('a farther rival, one at the same distance, or one that cannot swallow the prey does not', () => {
    const farther = rivalry(-100);
    const level = rivalry(PREY_AT_X * 2);
    const tooSmall = rivalry(PREY_AT_X + 50, LUNCH_MASS);
    for (const { world, hunter, prey, rival } of [farther, level, tooSmall]) {
      const sight = { cells: [hunter, prey, rival], motes: [] };
      expect(hasCloserRival(sight, hunter, prey, world.balance)).toBe(false);
      expect(createWildHuntPerception(sight, world.balance, hunter, true).cellsOf(world)).toContain(prey);
    }
  });

  it('the prey is never its own rival, even on a balance where a cell could swallow its equal', () => {
    const { world, hunter, prey } = rivalry(-100);
    const equalsEngulf = structuredClone(world.balance);
    equalsEngulf.absorption.ENGULF_MASS_RATIO = 1;
    expect(hasCloserRival({ cells: [hunter, prey], motes: [] }, hunter, prey, equalsEngulf)).toBe(false);
  });

  it('keeps the player cells out before the hunting stage, as createWildPerception does', () => {
    const { world, hunter, prey } = rivalry(-100);
    const player = world.cells[0]!;
    const sight = { cells: [player, hunter, prey], motes: [] };
    expect(createWildHuntPerception(sight, world.balance, hunter, false).cellsOf(world)).toEqual([hunter, prey]);
    expect(createWildHuntPerception(sight, world.balance, hunter, true).cellsOf(world)).toEqual(sight.cells);
  });
});

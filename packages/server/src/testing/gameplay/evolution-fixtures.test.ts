// docs/ecology/acceptance.md §8 conventions on a live world: placement anchors, the placed records, the
// spawner switch-off and the gel clearance.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, FOOD_KIND, playerId } from '@evolution/shared';
import { isPlayerCell } from '../../game/world/entities.js';
import { createTestWorld, TEST_PLAYER } from '../world-builders.js';
import type { FixtureContext } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import {
  applyPlacedCell,
  applyPlacedFixture,
  applyPlacedFragment,
  applyPlacedMote,
  prepareWorldForPlacement,
  resolveAnchor,
} from './evolution-fixtures.js';
import { placeCell, placeFragment, placeMote, placeWildCell } from './fixtures.js';
import {
  BROTH_POINT,
  VENT_POINT,
  ZONE,
  eastOfCellOf,
  gelPatchCentre,
  insideCellOf,
  shallowsPoint,
} from './placement.js';

/** Seed 48 keeps every gel patch far from the broth point (docs/ecology/acceptance.md §8). */
const CLEAR_SEED = 48;
/** Seed 42 puts a gel patch 73 wu from it. */
const BLOCKED_SEED = 42;

const context: FixtureContext = {
  tick: 0,
  playerId: (index) => (index === 0 ? TEST_PLAYER.playerId : playerId('nobody')),
};

function clearWorld() {
  return createTestWorld({ seed: CLEAR_SEED, isFilled: true });
}

describe('prepareWorldForPlacement', () => {
  it('empties the seeded motes and switches both spawners off', () => {
    const world = clearWorld();
    expect(world.food.length).toBeGreaterThan(0);
    prepareWorldForPlacement(world);
    expect(world.food).toEqual([]);
    expect(world.dnaFragments).toEqual([]);
    expect(world.spawners.food.isEnabled).toBe(false);
    expect(world.spawners.dnaFragments.isEnabled).toBe(false);
  });

  it('vacates the wild seats with their cells, so no seeded wanderer reaches a placed cell', () => {
    const world = createTestWorld({ seed: CLEAR_SEED, isFilled: true, hasWildSeats: true });
    expect(world.wildSeats.length).toBeGreaterThan(0);
    prepareWorldForPlacement(world);
    expect(world.wildSeats).toEqual([]);
    expect(world.cells.every(isPlayerCell)).toBe(true);
    expect(world.cells).toHaveLength(1);
  });

  it('refuses a seed whose gel patch reaches the broth point', () => {
    const world = createTestWorld({ seed: BLOCKED_SEED, isFilled: true });
    expect(() => prepareWorldForPlacement(world)).toThrow(ScenarioSetupError);
  });
});

describe('resolveAnchor', () => {
  it('resolves the named points without the world', () => {
    const world = clearWorld();
    expect(resolveAnchor(world, ZONE.broth, context)).toEqual(BROTH_POINT);
    expect(resolveAnchor(world, ZONE.vent, context)).toEqual(VENT_POINT);
    expect(resolveAnchor(world, ZONE.shallows, context)).toEqual(
      shallowsPoint(world.balance.world.DISH_RADIUS, world.balance.ecology.SHALLOWS_WIDTH),
    );
    expect(resolveAnchor(world, { kind: 'point', at: { x: 1, y: 2 } }, context)).toEqual({ x: 1, y: 2 });
  });

  it('resolves a cell centre, a point east of it and a gel patch centre against the world', () => {
    const world = clearWorld();
    const cell = world.cells[0]!;
    expect(resolveAnchor(world, insideCellOf(0), context)).toEqual({ x: cell.x, y: cell.y });
    expect(resolveAnchor(world, eastOfCellOf(0, 10), context)).toEqual({ x: cell.x + 10, y: cell.y });
    expect(resolveAnchor(world, gelPatchCentre(1), context)).toEqual({
      x: world.gelPatches[1]!.x,
      y: world.gelPatches[1]!.y,
    });
  });

  it('fails loudly for a player without a cell and a patch that does not exist', () => {
    const world = clearWorld();
    expect(() => resolveAnchor(world, insideCellOf(1), context)).toThrow(ScenarioSetupError);
    expect(() => resolveAnchor(world, gelPatchCentre(9), context)).toThrow(ScenarioSetupError);
  });
});

describe('applyPlacedCell', () => {
  it('moves the cell to rest at the anchor with the mass, pin, traits and lifetime DNA of the record', () => {
    const world = clearWorld();
    const fixture = placeCell(
      {
        playerIndex: 0,
        mass: 100,
        isPinned: true,
        traits: ['nucleoid', { traitId: 'cell_wall', tier: 2 }],
        dnaCumulative: 140,
        dnaCatchUpGift: 100,
      },
      undefined,
    );
    applyPlacedCell(world, fixture, context);
    const cell = world.cells[0]!;
    const player = world.players[0]!;
    expect({ x: cell.x, y: cell.y, targetX: cell.targetX, targetY: cell.targetY }).toEqual({
      x: BROTH_POINT.x,
      y: BROTH_POINT.y,
      targetX: null,
      targetY: null,
    });
    expect([cell.pinnedX, cell.pinnedY]).toEqual([BROTH_POINT.x, BROTH_POINT.y]);
    expect(cell.mass).toBe(100);
    expect(cell.traits).toEqual([
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'cell_wall', tier: 2 },
    ]);
    expect(cell.stage).toBe(CELL_STAGE.prokaryote);
    expect(cell.modifiers.membraneRatioBonus).toBeGreaterThan(0);
    expect(player).toMatchObject({
      dnaCumulative: 140,
      dnaCatchUpGift: 100,
      level: 3,
      dnaTowardNextLevel: 0,
      offerQueue: [],
    });
    expect(cell.level).toBe(3);
  });

  it('unpins and leaves traits and DNA alone when the record carries none', () => {
    const world = clearWorld();
    applyPlacedCell(
      world,
      placeCell({ playerIndex: 0, mass: 30, isPinned: true, traits: ['nucleoid'] }, undefined),
      context,
    );
    applyPlacedCell(world, placeCell({ playerIndex: 0, mass: 40, at: ZONE.vent }, undefined), context);
    const cell = world.cells[0]!;
    expect([cell.pinnedX, cell.pinnedY]).toEqual([null, null]);
    expect(cell.mass).toBe(40);
    expect(cell.traits).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
    expect(world.players[0]!.dnaCumulative).toBe(0);
    expect(world.players[0]!.dnaCatchUpGift).toBe(0);
  });

  it('strips every trait for an empty trait list: the cell is a protocell again (G13)', () => {
    const world = clearWorld();
    applyPlacedCell(world, placeCell({ playerIndex: 0, mass: 30, traits: ['nucleoid'] }, undefined), context);
    expect(world.cells[0]!.stage).toBe(CELL_STAGE.prokaryote);
    applyPlacedCell(world, placeCell({ playerIndex: 0, mass: 20, at: ZONE.broth, traits: [] }, undefined), context);
    expect(world.cells[0]!.traits).toEqual([]);
    expect(world.players[0]!.ownedTraits).toEqual([]);
    expect(world.cells[0]!.stage).toBe(CELL_STAGE.protocell);
  });

  it('refuses a trait that is not in the catalog and a player that is not in the world', () => {
    const world = clearWorld();
    expect(() =>
      applyPlacedCell(world, placeCell({ playerIndex: 0, mass: 30, traits: ['wings'] }, undefined), context),
    ).toThrow(ScenarioSetupError);
    expect(() =>
      applyPlacedCell(world, placeCell({ playerIndex: 1, mass: 30, at: ZONE.vent }, undefined), context),
    ).toThrow(ScenarioSetupError);
  });
});

describe('placed motes and fragments', () => {
  it('spawns a mote of the kind and variant at the anchor, refusing unknown kinds and a variant-less bacterium', () => {
    const world = clearWorld();
    prepareWorldForPlacement(world);
    applyPlacedMote(
      world,
      placeMote({ moteKind: FOOD_KIND.bacterium, variant: 'aerobic', at: ZONE.vent }, undefined),
      context,
    );
    expect(world.food[0]).toMatchObject({ kind: FOOD_KIND.bacterium, bacteriumVariant: 'aerobic', x: 0, y: 0 });
    expect(() => applyPlacedMote(world, placeMote({ moteKind: 'pizza', at: ZONE.vent }, undefined), context)).toThrow(
      ScenarioSetupError,
    );
    expect(() =>
      applyPlacedMote(world, placeMote({ moteKind: FOOD_KIND.bacterium, at: ZONE.vent }, undefined), context),
    ).toThrow(ScenarioSetupError);
  });

  it('spawns a fragment with its tag, drifting east, refusing an unknown tag', () => {
    const world = clearWorld();
    prepareWorldForPlacement(world);
    applyPlacedFragment(world, placeFragment({ tag: 'sensory', at: ZONE.broth }, undefined), context);
    expect(world.dnaFragments[0]).toMatchObject({ tag: 'sensory', x: BROTH_POINT.x, driftY: 0 });
    expect(world.dnaFragments[0]!.driftX).toBeGreaterThan(0);
    expect(() =>
      applyPlacedFragment(world, placeFragment({ tag: 'spicy', at: ZONE.broth }, undefined), context),
    ).toThrow(ScenarioSetupError);
  });

  it('dispatches every placed kind', () => {
    const world = createTestWorld({ seed: CLEAR_SEED, isFilled: true, hasWildSeats: true });
    prepareWorldForPlacement(world);
    applyPlacedFixture(world, placeCell({ playerIndex: 0, mass: 30 }, undefined), context);
    applyPlacedFixture(world, placeMote({ moteKind: FOOD_KIND.algae, at: ZONE.vent }, undefined), context);
    applyPlacedFixture(world, placeFragment({ tag: 'motile', at: ZONE.vent }, undefined), context);
    applyPlacedFixture(world, placeWildCell({ seat: 0, spreadFactor: 2, at: ZONE.shallows }, undefined), context);
    expect(world.cells[0]!.mass).toBe(30);
    expect(world.food).toHaveLength(1);
    expect(world.dnaFragments).toHaveLength(1);
    const wild = world.cells.find((cell) => cell.id === world.wildSeats[0]!.cellId)!;
    expect(wild.x).toBe(shallowsPoint(world.balance.world.DISH_RADIUS, world.balance.ecology.SHALLOWS_WIDTH).x);
    expect(world.wildSeats[0]!.massSpreadFactor).toBe(2);
  });
});

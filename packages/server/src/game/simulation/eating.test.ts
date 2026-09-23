// docs/ecology/food-and-spawn.md §1 (E4), docs/traits/constants-and-acceptance.md §6 (T6 ribosomes), the step-4 ordering
// rules, and what a wild cell eats (docs/ecology/wild-cells.md §3.3.3: algae and detritus, for mass alone).
import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  ENTITY_KIND,
  FOOD_KIND,
  playerId,
} from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import type { CellRecord } from '../world/entities.js';
import { eat } from './eating.js';
import { spawnDnaFragment, spawnFoodMote } from './spawn-mote.js';

const { ecology, growth } = DEFAULT_BALANCE;
const MOTE_OFFSET = 10;

function placedWorld() {
  const world = createTestWorld();
  const cell = world.cells[0]!;
  cell.x = BROTH_POINT.x;
  cell.y = BROTH_POINT.y;
  const player = world.players[0]!;
  const context = createTestStepContext(world);
  return { world, cell, player, context };
}

const eastOf = (cell: CellRecord, distance: number) => ({ x: cell.x + distance, y: cell.y });

describe('eat', () => {
  it('E4: an algae mote 10 wu east gives one mass and vanishes', () => {
    const { world, cell, player, context } = placedWorld();
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: eastOf(cell, MOTE_OFFSET) });
    eat(world, context);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS + ecology.ALGAE_MASS);
    expect(world.food).toEqual([]);
    expect(player.dnaCumulative).toBe(0);
    expect(player.dnaTagPoints.photic).toBe(1);
  });

  it('E4: a plain bacterium gives 3 mass, 1 DNA and a motile point', () => {
    const { world, cell, player, context } = placedWorld();
    spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: eastOf(cell, MOTE_OFFSET),
    });
    eat(world, context);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS + ecology.BACTERIUM_MASS);
    expect(player.dnaCumulative).toBe(ecology.BACTERIUM_DNA);
    expect(player.dnaTagPoints.motile).toBe(1);
    expect(player.bacteriaEatenByVariant.plain).toBe(1);
  });

  it('E4: an aerobic bacterium credits the metabolic tag and the aerobic counter', () => {
    const { world, cell, player, context } = placedWorld();
    spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.aerobic,
      at: eastOf(cell, MOTE_OFFSET),
    });
    eat(world, context);
    expect(player.dnaTagPoints.metabolic).toBe(1);
    expect(player.bacteriaEatenByVariant.aerobic).toBe(1);
    expect(player.bacteriaEatenByVariant.photosynthetic).toBe(0);
  });

  it('a fragment gives DNA_FRAGMENT_DNA and its tag, no mass', () => {
    const { world, cell, player, context } = placedWorld();
    spawnDnaFragment(world, { at: eastOf(cell, MOTE_OFFSET), tag: DNA_TAG.sensory, driftTurn: 0 });
    eat(world, context);
    expect(player.dnaCumulative).toBe(ecology.DNA_FRAGMENT_DNA);
    expect(player.dnaTagPoints.sensory).toBe(1);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
    expect(world.dnaFragments).toEqual([]);
  });

  it('applies the DNA gain multiplier and the digestion bonus (T6: algae worth 1.1 with ribosomes I)', () => {
    const { world, cell, player, context } = placedWorld();
    player.ownedTraits.push({ traitId: 'ribosomes', tier: 1 }, { traitId: 'nucleoid', tier: 1 });
    refreshCellDerivedState(cell, player, DEFAULT_BALANCE);
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: eastOf(cell, MOTE_OFFSET) });
    spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: eastOf(cell, -MOTE_OFFSET),
    });
    eat(world, context);
    expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS + 1.1 + 3.3, 12);
    expect(player.dnaCumulative).toBeCloseTo(1.05, 12);
  });

  it('eats only motes whose centre lies within the radius, inclusive', () => {
    const { world, cell, context } = placedWorld();
    const outside = eastOf(cell, cell.radius + 0.01);
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: eastOf(cell, cell.radius - 1e-6) });
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: outside });
    eat(world, context);
    expect(world.food).toHaveLength(1);
    expect(world.food[0]!.x).toBe(outside.x);
  });

  it('lets the earlier cell eat a mote both reach, filters in order and emits eat effects', () => {
    const world = createTestWorld({
      players: [
        { playerId: playerId('a'), playerName: 'A', avatarIndex: 0 },
        { playerId: playerId('b'), playerName: 'B', avatarIndex: 1 },
      ],
    });
    const [cellA, cellB] = world.cells as [CellRecord, CellRecord];
    for (const cell of [cellA, cellB]) {
      cell.x = BROTH_POINT.x;
      cell.y = BROTH_POINT.y;
    }
    const far = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: { x: 0, y: 0 } });
    const shared = spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: eastOf(cellA, 1) });
    const context = createTestStepContext(world);
    eat(world, context);
    expect(cellA.mass).toBe(growth.CELL_STARTING_MASS + 1);
    expect(cellB.mass).toBe(growth.CELL_STARTING_MASS);
    expect(world.food).toEqual([far]);
    expect(context.effects).toEqual([
      expect.objectContaining({
        kind: EFFECT_KIND.eat,
        cellId: cellA.id,
        eatenId: shared.id,
        eatenKind: ENTITY_KIND.foodMote,
      }),
    ]);
  });

  it('leaves the arrays untouched when nothing is eaten', () => {
    const { world, context } = placedWorld();
    const food = world.food;
    eat(world, context);
    expect(world.food).toBe(food);
    expect(context.effects).toEqual([]);
  });
});

describe('eat: the amounts on the effect (#383)', () => {
  it('reports the mass and DNA the meal added, the cap overflow counted as DNA', () => {
    const { world, cell, player, context } = placedWorld();
    const massBelowCap = 1;
    cell.mass = growth.CELL_MAX_MASS - massBelowCap;
    spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: eastOf(cell, MOTE_OFFSET),
    });
    eat(world, context);
    const overflowDna = (ecology.BACTERIUM_MASS - massBelowCap) * growth.MASS_OVERFLOW_DNA_PER_MASS;
    expect(world.effects).toMatchObject([{ kind: EFFECT_KIND.eat, massGained: massBelowCap }]);
    const [effect] = world.effects;
    expect(effect?.kind === EFFECT_KIND.eat && effect.dnaGained).toBeCloseTo(ecology.BACTERIUM_DNA + overflowDna, 9);
    expect(player.dnaCumulative).toBeCloseTo(ecology.BACTERIUM_DNA + overflowDna, 9);
  });

  it('reports a fragment as DNA with no mass', () => {
    const { world, cell, context } = placedWorld();
    spawnDnaFragment(world, { tag: DNA_TAG.motile, at: eastOf(cell, MOTE_OFFSET), driftTurn: 0 });
    eat(world, context);
    expect(world.effects).toMatchObject([
      { kind: EFFECT_KIND.eat, eatenKind: ENTITY_KIND.dnaFragment, massGained: 0, dnaGained: ecology.DNA_FRAGMENT_DNA },
    ]);
  });
});

describe('eat: a wild cell', () => {
  function wildWorld() {
    const { world, context } = placedWorld();
    world.cells = [];
    const { cell } = seatTestWildCell(world, { at: BROTH_POINT });
    return { world, context, wild: cell };
  }

  it('eats algae and detritus for their mass alone, with an eat effect that carries no DNA', () => {
    const { world, context, wild } = wildWorld();
    const massBefore = wild.mass;
    spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: eastOf(wild, 1) });
    spawnFoodMote(world, { kind: FOOD_KIND.detritus, variant: null, at: eastOf(wild, 2) });
    eat(world, context);
    expect(world.food).toEqual([]);
    expect(wild.mass).toBeCloseTo(massBefore + ecology.ALGAE_MASS + ecology.DETRITUS_MOTE_MASS, 9);
    expect(world.effects).toMatchObject([
      { kind: EFFECT_KIND.eat, cellId: wild.id, massGained: ecology.ALGAE_MASS, dnaGained: 0 },
      { kind: EFFECT_KIND.eat, cellId: wild.id, massGained: ecology.DETRITUS_MOTE_MASS, dnaGained: 0 },
    ]);
  });

  it('leaves bacteria and fragments inside it for a player', () => {
    const { world, context, wild } = wildWorld();
    const massBefore = wild.mass;
    const bacterium = spawnFoodMote(world, {
      kind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.aerobic,
      at: eastOf(wild, 1),
    });
    const fragment = spawnDnaFragment(world, { tag: DNA_TAG.motile, at: eastOf(wild, 1), driftTurn: 0 });
    eat(world, context);
    expect(world.food).toEqual([bacterium]);
    expect(world.dnaFragments).toEqual([fragment]);
    expect(wild.mass).toBe(massBefore);
    expect(world.effects).toEqual([]);
  });
});

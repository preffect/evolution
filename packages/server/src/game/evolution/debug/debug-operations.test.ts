import { describe, expect, it } from 'vitest';
import {
  ENTITY_KIND,
  FOOD_KIND,
  playerId,
  type BalanceConfig,
  type FoodMoteView,
  type PlayerProgressView,
} from '@evolution/shared';
import { DebugRequestError } from '../../debug/debug-request-error.js';
import { createTestWorld } from '../testing/builders.js';
import { forkServerStreams } from '../world/streams.js';
import {
  DEBUG_PATCH_KIND,
  applyDebugPatch,
  grantDnaForDebug,
  reseedForDebug,
  setBalanceForDebug,
  setPlayerForDebug,
  spawnForDebug,
} from './debug-operations.js';

const ALICE = playerId('p1');
/** Real balance paths, named through constants because a patch is keyed by constant names. */
const DISH_RADIUS_LEAF = 'DISH_RADIUS';
const CELL_MAX_MASS_LEAF = 'CELL_MAX_MASS';
const UNKNOWN_LEAF = 'NOPE';
const NOBODY = playerId('nobody');

describe('spawnForDebug', () => {
  it('spawns an algae mote by default and a bacterium with its variant', () => {
    const world = createTestWorld();
    const algae = spawnForDebug(world, { kind: ENTITY_KIND.foodMote, x: 10, y: 20, params: {} }) as FoodMoteView;
    expect(algae).toMatchObject({ kind: FOOD_KIND.algae, bacteriumVariant: null, x: 10, y: 20 });
    const bacterium = spawnForDebug(world, {
      kind: ENTITY_KIND.foodMote,
      x: 0,
      y: 0,
      params: { kind: FOOD_KIND.bacterium, variant: 'photosynthetic' },
    }) as FoodMoteView;
    expect(bacterium.bacteriumVariant).toBe('photosynthetic');
    expect(world.food).toHaveLength(2);
    expect(world.food[1]!.tag).toBe('photic');
  });

  it('spawns a fragment with its tag and no drift', () => {
    const world = createTestWorld();
    const view = spawnForDebug(world, { kind: ENTITY_KIND.dnaFragment, x: 5, y: 5, params: { tag: 'toxic' } });
    expect(view).toEqual({ id: world.dnaFragments[0]!.id, x: 5, y: 5, tag: 'toxic' });
    expect(world.dnaFragments[0]!.driftX).toBeCloseTo(world.balance.ecology.DNA_FRAGMENT_DRIFT_SPEED, 12);
  });

  it('refuses an unknown entity kind, food kind, missing variant or tag', () => {
    const world = createTestWorld();
    expect(() => spawnForDebug(world, { kind: 'cell', x: 0, y: 0, params: {} })).toThrow(DebugRequestError);
    expect(() => spawnForDebug(world, { kind: ENTITY_KIND.foodMote, x: 0, y: 0, params: { kind: 'cake' } })).toThrow(
      DebugRequestError,
    );
    expect(() =>
      spawnForDebug(world, { kind: ENTITY_KIND.foodMote, x: 0, y: 0, params: { kind: 'bacterium' } }),
    ).toThrow(DebugRequestError);
    expect(() => spawnForDebug(world, { kind: ENTITY_KIND.dnaFragment, x: 0, y: 0, params: {} })).toThrow(
      DebugRequestError,
    );
  });
});

describe('grantDnaForDebug', () => {
  it('adds DNA through the cell multiplier and tag points per listed tag', () => {
    const world = createTestWorld();
    world.players[0]!.ownedTraits = [{ traitId: 'nucleoid', tier: 1 }];
    world.cells[0]!.modifiers = { ...world.cells[0]!.modifiers, dnaGainMultiplier: 1.05 };
    const view = grantDnaForDebug(world, ALICE, { dna: 20, tags: ['motile', 'toxic'] }) as PlayerProgressView;
    expect(view.dnaCumulative).toBeCloseTo(21, 12);
    expect(view.dnaTagPoints.motile).toBe(20);
    expect(view.dnaTagPoints.toxic).toBe(20);
  });

  it('uses multiplier 1 without a cell and refuses unknown players and tags', () => {
    const world = createTestWorld();
    world.cells = [];
    expect((grantDnaForDebug(world, ALICE, { dna: 7 }) as PlayerProgressView).dnaCumulative).toBe(7);
    expect(() => grantDnaForDebug(world, NOBODY, { dna: 1 })).toThrow(DebugRequestError);
    expect(() => grantDnaForDebug(world, ALICE, { dna: 1, tags: ['spicy'] })).toThrow(DebugRequestError);
    expect(world.players[0]!.dnaCumulative).toBe(7);
  });
});

describe('setPlayerForDebug', () => {
  it('sets mass, position (and the latched target), level and tier-I traits, then refolds', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    const view = setPlayerForDebug(world, ALICE, {
      mass: 100,
      level: 4,
      traits: ['nucleoid', 'cilia'],
      position: { x: 1500, y: 0 },
    }) as PlayerProgressView;
    expect(view.level).toBe(4);
    expect(view.dnaTowardNextLevel).toBe(0);
    expect(cell.mass).toBe(100);
    expect(cell.radius).toBeCloseTo(40, 12);
    expect(cell.x).toBe(1500);
    expect(cell.targetX).toBe(1500);
    expect(cell.level).toBe(4);
    expect(cell.traits).toEqual([
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'cilia', tier: 1 },
    ]);
    expect(cell.modifiers.speedMultiplier).toBe(1.1);
    expect(cell.stage).toBe('prokaryote');
  });

  it('patches the player alone when it has no cell', () => {
    const world = createTestWorld();
    world.cells = [];
    const view = setPlayerForDebug(world, ALICE, { level: 2, mass: 50 }) as PlayerProgressView;
    expect(view.level).toBe(2);
  });

  it('refuses an unknown player or trait without writing anything', () => {
    const world = createTestWorld();
    expect(() => setPlayerForDebug(world, NOBODY, { mass: 1 })).toThrow(DebugRequestError);
    expect(() => setPlayerForDebug(world, ALICE, { level: 3, traits: ['jet_siphon'] })).toThrow(DebugRequestError);
    expect(world.players[0]!.level).toBe(1);
  });
});

describe('setBalanceForDebug', () => {
  it('replaces the world balance with a patched copy and refuses a non-number path', () => {
    const world = createTestWorld();
    const before = world.balance;
    const patched = setBalanceForDebug(world, { world: { [DISH_RADIUS_LEAF]: 2500 } }) as BalanceConfig;
    expect(patched.world.DISH_RADIUS).toBe(2500);
    expect(world.balance).toBe(patched);
    expect(before.world.DISH_RADIUS).toBe(3000);
    expect(() => setBalanceForDebug(world, { world: { [UNKNOWN_LEAF]: 1 } })).toThrow(DebugRequestError);
  });
});

describe('reseedForDebug', () => {
  it('sets the seed and rebuilds every stream from it', () => {
    const world = createTestWorld();
    reseedForDebug(world, 9);
    expect(world.seed).toBe(9);
    expect(world.random).toEqual(forkServerStreams(9));
  });
});

describe('applyDebugPatch', () => {
  it('dispatches every patch kind', () => {
    const world = createTestWorld();
    applyDebugPatch(world, {
      kind: DEBUG_PATCH_KIND.spawn,
      request: { kind: ENTITY_KIND.dnaFragment, x: 1, y: 1, params: { tag: 'sensory' } },
    });
    applyDebugPatch(world, { kind: DEBUG_PATCH_KIND.grantDna, playerId: ALICE, grant: { dna: 3 } });
    applyDebugPatch(world, { kind: DEBUG_PATCH_KIND.setPlayer, playerId: ALICE, patch: { mass: 30 } });
    applyDebugPatch(world, { kind: DEBUG_PATCH_KIND.setBalance, patch: { growth: { [CELL_MAX_MASS_LEAF]: 10 } } });
    expect(world.dnaFragments).toHaveLength(1);
    expect(world.players[0]!.dnaCumulative).toBe(3);
    expect(world.cells[0]!.mass).toBe(30);
    expect(world.balance.growth.CELL_MAX_MASS).toBe(10);
  });
});

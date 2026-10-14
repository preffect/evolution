// docs/determinism/ordering-and-state-hash.md §5, docs/determinism/replay-tests-and-traps.md §7: equal worlds hash equal, any hashed field change moves the hash, NaN
// throws, and every non-derived record field is listed.
import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  FOOD_KIND,
  GAME_ERA,
  GAME_ERA_ORDER,
  GIANT_SPECIES,
  MASS_WINDOW_AMOUNT,
  StateHashError,
  createTestGameInput,
  playerId,
} from '@evolution/shared';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import { hashedFieldKeys } from '../../testing/hashed-field-keys.js';
import { TEST_PLAYER, createTestWorld } from '../../testing/world-builders.js';
import type { PlayerIdentity } from '../session/players.js';
import { createGiantSeatRecord } from '../wild/giant-seats.js';
import { createWildSeatRecord } from '../wild/wild-seats.js';
import { recordMetabolism, recordWindowAmount, sealMassWindow } from './mass-flow-ledger.js';
import type { BacteriumMoteRecord, LatchedBacteriumRecord } from './entities.js';
import type { WorldState } from './world-state.js';
import {
  CELL_HASHED_FIELDS,
  DERIVED_FIELDS,
  DNA_FRAGMENT_HASHED_FIELDS,
  FOOD_MOTE_HASHED_FIELDS,
  GEL_PATCH_HASHED_FIELDS,
  LATCHED_BACTERIUM_FIELDS,
  PLAYER_HASHED_FIELDS,
  SPAWNER_HASHED_FIELDS,
  TRAILING_CELL_HASHED_FIELDS,
  WORLD_SCALAR_HASHED_FIELDS,
  computeStateHash,
} from './state-hash.js';
import { TRAILING_WORLD_HASHED_FIELDS } from './era-hashed-section.js';
import { GIANT_SEAT_HASHED_FIELDS, WILD_SEAT_HASHED_FIELDS } from './seat-hashed-fields.js';

const SECOND_PLAYER: PlayerIdentity = { playerId: playerId('p2'), playerName: 'Bea', avatarIndex: 1 };
/** Where on the rim the held bacterium sits; any bearing does. */
const HELD_BEARING_RADIANS = 1;
const FIRST_CELL = 0;
const SECOND_CELL = 1;

function populatedWorld(players: readonly PlayerIdentity[] = [TEST_PLAYER]): WorldState {
  const world = createTestWorld({ players });
  spawnFoodMote(world, { kind: FOOD_KIND.bacterium, variant: 'aerobic', at: { x: 100, y: 0 } });
  spawnDnaFragment(world, { at: { x: 0, y: 100 }, tag: 'photic', driftTurn: 0.25 });
  return world;
}

/**
 * `populatedWorld` with a second player and its mote taken out of the dish, held by the cell at `holderIndex` as a
 * latch holds it (docs/game-design/early-life.md §15.4.1), or by none: worlds that differ only in their held lists.
 */
function worldHoldingTheMote(holderIndex: number | null): WorldState {
  const world = populatedWorld([TEST_PLAYER, SECOND_PLAYER]);
  const mote = world.food.shift() as BacteriumMoteRecord;
  if (holderIndex !== null) {
    world.cells[holderIndex]!.latchedBacteria.push({
      mote,
      bearingRadians: HELD_BEARING_RADIANS,
      caughtAtTick: world.tick,
    });
  }
  return world;
}

/**
 * `computeStateHash(populatedWorld())` recorded on main (4fe77f46) before ticket #907 added the held lists. It must not
 * move while no cell holds a bacterium and the world has no era state: the held lists, then the eras' section, are
 * walked last and only when they leave their defaults (`hashLatchedBacteriaOfCells`, `hashEraSection`, #931), so
 * recordings exported before them keep their `finalHash`, and so does a world carrying the eras' streams undrawn
 * (#932). A deliberate change to the walk or to the test world re-records it, and says so here.
 */
const RECORDED_POPULATED_WORLD_HASH = 'bf921363406e995f';

describe('computeStateHash', () => {
  it('hashes a world in the dish whose cells hold nothing exactly as main did before the held lists and the eras, its era streams undrawn', () => {
    expect(computeStateHash(populatedWorld())).toBe(RECORDED_POPULATED_WORLD_HASH);
  });

  it('hashes two worlds built the same way equal, and 16 hex characters long', () => {
    const hash = computeStateHash(populatedWorld());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(computeStateHash(populatedWorld())).toBe(hash);
  });

  it.each<[string, (world: WorldState) => void]>([
    ['tick', (world) => (world.tick += 1)],
    ['seed', (world) => (world.seed += 1)],
    ['roundStartTick', (world) => (world.roundStartTick += 1)],
    ['a cell position', (world) => (world.cells[0]!.x += 1)],
    ['a cell trait', (world) => world.cells[0]!.traits.push({ traitId: 'cilia', tier: 1 })],
    ['a mote heading', (world) => (world.food[0]!.headingRadians += 1)],
    ['a fragment drift', (world) => (world.dnaFragments[0]!.driftX += 1)],
    ['a tag point', (world) => (world.players[0]!.dnaTagPoints.toxic += 1)],
    ['a variant counter', (world) => (world.players[0]!.bacteriaEatenByVariant.aerobic += 1)],
    ['a pending input', (world) => (world.players[0]!.pendingInput = createTestGameInput())],
    [
      'a reserved input flag',
      (world) => (world.players[0]!.pendingInput = createTestGameInput({ shouldSplit: false })),
    ],
    [
      'a queued offer',
      (world) =>
        world.players[0]!.offerQueue.push({
          offerId: 1,
          level: 2,
          cards: [],
          expiresAtTick: 0,
          shownAtTick: null,
          cardWeights: [],
          catalogIndexes: [],
        }),
    ],
    ['a gel patch', (world) => (world.gelPatches[0]!.radius += 1)],
    ['a spawner accumulator', (world) => (world.spawners.food.accumulator += 0.5)],
    ['a spawner flag', (world) => (world.spawners.dnaFragments.isEnabled = true)],
    ['a random stream', (world) => (world.random.spawner = { ...world.random.spawner, position: 7 })],
    ['the entity counter', (world) => (world.nextEntityNumber += 1)],
    [
      'a giant seat',
      (world) => world.giantSeats.push(createGiantSeatRecord(GIANT_SPECIES.diatom, world.firstGiantSeatNumber)),
    ],
    ['the giants stream', (world) => (world.random.giants = { ...world.random.giants, position: 7 })],
    ['the first giant seat number', (world) => (world.firstGiantSeatNumber += 1)],
  ])('changes when %s changes', (_label, mutate) => {
    const base = computeStateHash(populatedWorld());
    const changed = populatedWorld();
    mutate(changed);
    expect(computeStateHash(changed)).not.toBe(base);
  });

  it('tells every era moved into apart, and from a world that never left the dish (#931)', () => {
    const hashes = GAME_ERA_ORDER.map((era) => {
      const world = populatedWorld();
      world.eraMovedInto = era;
      return computeStateHash(world);
    });
    expect(hashes[0]).toBe(RECORDED_POPULATED_WORLD_HASH);
    expect(new Set(hashes).size).toBe(GAME_ERA_ORDER.length);
  });

  it('tells the two trailing sections apart: held lists, an era, both or neither', () => {
    const hashes = [null, FIRST_CELL].flatMap((holderIndex) =>
      [GAME_ERA.dish, GAME_ERA.pool].map((era) => {
        const world = worldHoldingTheMote(holderIndex);
        world.eraMovedInto = era;
        return computeStateHash(world);
      }),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('changes when a cell holds the mote that nobody holds in an otherwise equal world', () => {
    expect(computeStateHash(worldHoldingTheMote(FIRST_CELL))).not.toBe(computeStateHash(worldHoldingTheMote(null)));
  });

  it('changes with which cell holds the mote, the cells in the same order', () => {
    expect(computeStateHash(worldHoldingTheMote(SECOND_CELL))).not.toBe(
      computeStateHash(worldHoldingTheMote(FIRST_CELL)),
    );
  });

  it.each<[string, (entry: LatchedBacteriumRecord) => void]>([
    ['its bearing', (entry) => (entry.bearingRadians += 1)],
    ['its catch tick', (entry) => (entry.caughtAtTick += 1)],
    ['its kept mass', (entry) => (entry.mote.mass += 1)],
    ['its kept heading', (entry) => (entry.mote.headingRadians += 1)],
  ])('changes when a held bacterium changes %s (early-life.md §15.11)', (_label, mutate) => {
    const base = computeStateHash(worldHoldingTheMote(FIRST_CELL));
    const changed = worldHoldingTheMote(FIRST_CELL);
    mutate(changed.cells[FIRST_CELL]!.latchedBacteria[0]!);
    expect(computeStateHash(changed)).not.toBe(base);
  });

  it('ignores the derived data', () => {
    const base = computeStateHash(populatedWorld());
    const world = populatedWorld();
    world.leaderboard = [];
    world.effects.push({ kind: 'respawn', tick: 0, x: 0, y: 0, cellId: world.cells[0]!.id, playerId: 'p1' as never });
    world.players[0]!.score = 99;
    world.players[0]!.stage = CELL_STAGE.eukaryote;
    world.players[0]!.offer = { offerId: 1, level: 2, cards: [], expiresAtTick: 0 };
    world.cells[0]!.modifiers = { ...world.cells[0]!.modifiers, speedMultiplier: 2 };
    expect(computeStateHash(world)).toBe(base);
  });

  it('throws on a non-finite number', () => {
    const world = populatedWorld();
    world.cells[0]!.mass = Number.NaN;
    expect(() => computeStateHash(world)).toThrow(StateHashError);
  });
});

describe('HASHED_FIELDS pin every non-derived record field', () => {
  const world = populatedWorld();

  it('world scalars', () => {
    const nested = [
      'cells',
      'food',
      'dnaFragments',
      'players',
      'wildSeats',
      'giantSeats',
      'gelPatches',
      'spawners',
      'random',
      'nextEntityNumber',
    ];
    const expected = Object.keys(world)
      .filter((key) => !nested.includes(key) && !(DERIVED_FIELDS.world as readonly string[]).includes(key))
      .filter((key) => !(TRAILING_WORLD_HASHED_FIELDS as readonly string[]).includes(key))
      .sort();
    expect(hashedFieldKeys(WORLD_SCALAR_HASHED_FIELDS)).toEqual(expected);
    expect(Object.keys(world)).toEqual(expect.arrayContaining([...TRAILING_WORLD_HASHED_FIELDS]));
  });

  it('cells: with the cell, or in the trailing section', () => {
    const trailing: readonly string[] = TRAILING_CELL_HASHED_FIELDS;
    const expected = Object.keys(world.cells[0]!).filter(
      (key) => !(DERIVED_FIELDS.cell as readonly string[]).includes(key) && !trailing.includes(key),
    );
    expect(hashedFieldKeys(CELL_HASHED_FIELDS)).toEqual(expected.sort());
    expect(hashedFieldKeys(CELL_HASHED_FIELDS).filter((key) => trailing.includes(key))).toEqual([]);
  });

  it('players', () => {
    const expected = Object.keys(world.players[0]!).filter(
      (key) => !(DERIVED_FIELDS.player as readonly string[]).includes(key),
    );
    expect(hashedFieldKeys(PLAYER_HASHED_FIELDS)).toEqual(expected.sort());
  });

  it('held bacteria: every field of an entry, so a field the latch adds later is hashed or fails here', () => {
    const entry = worldHoldingTheMote(FIRST_CELL).cells[FIRST_CELL]!.latchedBacteria[0]!;
    expect(hashedFieldKeys(LATCHED_BACTERIUM_FIELDS)).toEqual(Object.keys(entry).sort());
  });

  it('motes, fragments, gel patches and spawners', () => {
    expect(hashedFieldKeys(FOOD_MOTE_HASHED_FIELDS)).toEqual(Object.keys(world.food[0]!).sort());
    expect(hashedFieldKeys(DNA_FRAGMENT_HASHED_FIELDS)).toEqual(Object.keys(world.dnaFragments[0]!).sort());
    expect(hashedFieldKeys(GEL_PATCH_HASHED_FIELDS)).toEqual(Object.keys(world.gelPatches[0]!).sort());
    expect(hashedFieldKeys(SPAWNER_HASHED_FIELDS)).toEqual(Object.keys(world.spawners.food).sort());
  });

  it('wild seats: every field, the die-off flag included, so a seat field added later is hashed or fails here', () => {
    expect(hashedFieldKeys(WILD_SEAT_HASHED_FIELDS)).toEqual(Object.keys(createWildSeatRecord(0)).sort());
  });

  it('giant seats: every field, so a seat field added later is hashed or fails here', () => {
    const seat = createGiantSeatRecord(GIANT_SPECIES.amoeba, DEFAULT_BALANCE.wildCells.WILD_CELL_COUNT);
    expect(hashedFieldKeys(GIANT_SEAT_HASHED_FIELDS)).toEqual(Object.keys(seat).sort());
  });
});

describe('the mass-flow ledger (#383)', () => {
  it('never moves the hash: it is transient like the effects', () => {
    const world = populatedWorld();
    const hash = computeStateHash(world);
    const player = world.players[0]!;
    recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.sprintSpent, 1);
    recordWindowAmount(world.massFlow, player.playerId, MASS_WINDOW_AMOUNT.noDraftBonusGained, 1);
    recordMetabolism(world.massFlow, player.playerId, {
      ratesPerSecond: { toxin: -1, swallowed: 0, decay: -0.5, vent: 0, light: 0 },
      decayTraitShare: 0,
      zone: 'open_broth',
    });
    sealMassWindow(world.massFlow);
    expect(computeStateHash(world)).toBe(hash);
  });
});

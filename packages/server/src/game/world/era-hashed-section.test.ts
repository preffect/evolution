// docs/determinism/ordering-and-state-hash.md §5 (the eras' section), docs/determinism/random-streams.md §3 (the eras'
// streams, hashed only once drawn): a world without era state feeds the section nothing, and each piece of era state,
// alone, opens it and moves the hash.
import { describe, expect, it } from 'vitest';
import {
  ERA_RANDOM_STREAM_LABELS,
  GAME_ERA,
  createTestCopepodLane,
  createTestPoolLayout,
  createTestSurge,
  entityId,
  type ServerRandomStreamLabel,
} from '@evolution/shared';
import { hashedFieldKeys } from '../../testing/hashed-field-keys.js';
import { createTestPoolCreatureSeat } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import {
  COPEPOD_LANE_HASHED_FIELDS,
  LIGHT_PATCH_ORBIT_HASHED_FIELDS,
  POOL_FILM_HASHED_FIELDS,
  POOL_LAYOUT_HASHED_FIELDS,
  POOL_STATE_HASHED_FIELDS,
  POOL_THREAD_HASHED_FIELDS,
  SURGE_HASHED_FIELDS,
  TRAILING_WORLD_HASHED_FIELDS,
  hasEraState,
} from './era-hashed-section.js';
import { POOL_CREATURE_SEAT_HASHED_FIELDS } from './seat-hashed-fields.js';
import { computeStateHash } from './state-hash.js';
import { withStream } from './streams.js';
import type { WorldState } from './world-state.js';

type TrailingWorldField = (typeof TRAILING_WORLD_HASHED_FIELDS)[number];

/** How a test gives a world one field of the section, and then changes it to another value. */
interface EraFieldCase {
  readonly give: (world: WorldState) => void;
  readonly vary: (world: WorldState) => void;
}

/**
 * One case per field of the section, keyed by field: a field added to the section without one fails to compile, and
 * its `vary` then proves it is walked, not only that it opens the gate.
 */
const ERA_STATE_BY_FIELD: Readonly<Record<TrailingWorldField, EraFieldCase>> = {
  eraMovedInto: {
    give: (world) => (world.eraMovedInto = GAME_ERA.pool),
    vary: (world) => (world.eraMovedInto = GAME_ERA.colonies),
  },
  poolLayout: {
    give: (world) => (world.poolLayout = createTestPoolLayout()),
    vary: (world) => (world.poolLayout!.films[0]!.x += 1),
  },
  surge: { give: (world) => (world.surge = createTestSurge()), vary: (world) => (world.surge!.startedAtTick += 1) },
  copepodLane: {
    give: (world) => (world.copepodLane = createTestCopepodLane()),
    vary: (world) => (world.copepodLane!.startX += 1),
  },
  poolCreatureSeats: {
    give: (world) => (world.poolCreatureSeats = [createTestPoolCreatureSeat()]),
    vary: (world) => (world.poolCreatureSeats![0]!.headingX += 1),
  },
};

/**
 * `computeStateHash(worldWithEveryEraField())` as recorded: it pins the section's walk, its order included (the order
 * decides every pool-era replay's `finalHash`). A deliberate change to the walk or to the test world re-records it, and
 * says so here. Ticket #932 recorded `cd86432a9b38f62e`; ticket #935 appended the creatures' seats, each a seat with a
 * mind, to the walk (an open section now ends with their list or null's marker), so it re-recorded it. No world outside the pool opens the section,
 * so no pinned dish hash or recorded replay moved.
 */
const RECORDED_EVERY_ERA_FIELD_HASH = 'e071445019643754';

function drawFrom(world: WorldState, label: ServerRandomStreamLabel): void {
  withStream(world, label, (random) => random.nextFloat());
}

/** A world in the pool with the whole of the pool's state, so a change to any one part is inside an open section. */
function worldWithEveryEraField(): WorldState {
  const world = createTestWorld();
  for (const field of Object.values(ERA_STATE_BY_FIELD)) field.give(world);
  return world;
}

describe('hasEraState', () => {
  it('is false for a new world: the eras’ streams are forked but undrawn and the pool’s state is null', () => {
    const world = createTestWorld();
    expect(ERA_RANDOM_STREAM_LABELS.map((label) => world.random[label].position)).toEqual([0, 0, 0]);
    expect(hasEraState(world)).toBe(false);
  });

  it.each(TRAILING_WORLD_HASHED_FIELDS)('is true once the world has %s', (field) => {
    const world = createTestWorld();
    ERA_STATE_BY_FIELD[field].give(world);
    expect(hasEraState(world)).toBe(true);
  });

  it.each(ERA_RANDOM_STREAM_LABELS)('is true once the %s stream is drawn from', (label) => {
    const world = createTestWorld();
    drawFrom(world, label);
    expect(hasEraState(world)).toBe(true);
  });

  it('is false again for a draw from a stream the hash always walks', () => {
    const world = createTestWorld();
    drawFrom(world, 'spawner');
    expect(hasEraState(world)).toBe(false);
  });
});

describe('the eras’ section of computeStateHash', () => {
  it.each(TRAILING_WORLD_HASHED_FIELDS)('opens, and moves the hash, when %s alone leaves its default', (field) => {
    const changed = createTestWorld();
    ERA_STATE_BY_FIELD[field].give(changed);
    expect(computeStateHash(changed)).not.toBe(computeStateHash(createTestWorld()));
  });

  it.each(ERA_RANDOM_STREAM_LABELS)('opens, and moves the hash, on the first draw from %s', (label) => {
    const changed = createTestWorld();
    drawFrom(changed, label);
    expect(computeStateHash(changed)).not.toBe(computeStateHash(createTestWorld()));
  });

  it.each(ERA_RANDOM_STREAM_LABELS)('covers %s once open: one draw more moves the hash', (label) => {
    const once = worldWithEveryEraField();
    drawFrom(once, label);
    const twice = worldWithEveryEraField();
    drawFrom(twice, label);
    drawFrom(twice, label);
    expect(computeStateHash(twice)).not.toBe(computeStateHash(once));
  });

  it.each(TRAILING_WORLD_HASHED_FIELDS)(
    'covers %s once open: changing it inside the section moves the hash',
    (field) => {
      const changed = worldWithEveryEraField();
      ERA_STATE_BY_FIELD[field].vary(changed);
      expect(computeStateHash(changed)).not.toBe(computeStateHash(worldWithEveryEraField()));
    },
  );

  it.each<[string, (world: WorldState) => void]>([
    ['a film', (world) => (world.poolLayout!.films[0]!.y += 1)],
    ['a thread', (world) => (world.poolLayout!.threads[0]!.angleRadians += 1)],
    ['the light patch’s orbit', (world) => (world.poolLayout!.lightPatchOrbit.startAngleRadians += 1)],
    ['the surge’s direction', (world) => (world.surge!.directionY = 1)],
    ['the copepod’s start', (world) => (world.copepodLane!.startedAtTick += 1)],
    ['the surge ending', (world) => (world.surge = null)],
    ['a creature’s species', (world) => (world.poolCreatureSeats![0]!.species = 'didinium')],
    ['the landmark flag', (world) => (world.poolCreatureSeats![0]!.isLandmark = true)],
    ['a seat’s cell', (world) => (world.poolCreatureSeats![0]!.cellId = entityId('c-9'))],
    ['a seat’s respawn countdown', (world) => (world.poolCreatureSeats![0]!.respawnInTicks -= 1)],
    ['a seat’s mind', (world) => (world.poolCreatureSeats![0]!.huntPreyId = entityId('c-3'))],
    ['a second seat', (world) => world.poolCreatureSeats!.push(createTestPoolCreatureSeat())],
    ['the seats emptied, which is not their absence', (world) => (world.poolCreatureSeats = [])],
  ])('covers %s once open', (_label, mutate) => {
    const changed = worldWithEveryEraField();
    mutate(changed);
    expect(computeStateHash(changed)).not.toBe(computeStateHash(worldWithEveryEraField()));
  });

  it('hashes a world with every era field as recorded: the walk and its order are pinned by the hash', () => {
    expect(computeStateHash(worldWithEveryEraField())).toBe(RECORDED_EVERY_ERA_FIELD_HASH);
  });
});

describe('the eras’ hashed fields pin every field of their views', () => {
  const layout = createTestPoolLayout();

  it('the layout, its films, its threads and the light patch’s orbit', () => {
    expect(hashedFieldKeys(POOL_LAYOUT_HASHED_FIELDS)).toEqual(Object.keys(layout).sort());
    expect(hashedFieldKeys(POOL_FILM_HASHED_FIELDS)).toEqual(Object.keys(layout.films[0]!).sort());
    expect(hashedFieldKeys(POOL_THREAD_HASHED_FIELDS)).toEqual(Object.keys(layout.threads[0]!).sort());
    expect(hashedFieldKeys(LIGHT_PATCH_ORBIT_HASHED_FIELDS)).toEqual(Object.keys(layout.lightPatchOrbit).sort());
  });

  it('a pool creature’s seat', () => {
    expect(hashedFieldKeys(POOL_CREATURE_SEAT_HASHED_FIELDS)).toEqual(Object.keys(createTestPoolCreatureSeat()).sort());
  });

  it('the surge and the copepod’s lane', () => {
    expect(hashedFieldKeys(SURGE_HASHED_FIELDS)).toEqual(Object.keys(createTestSurge()).sort());
    expect(hashedFieldKeys(COPEPOD_LANE_HASHED_FIELDS)).toEqual(Object.keys(createTestCopepodLane()).sort());
  });

  it('walks the era moved into, then every field of the pool’s state the gate reads', () => {
    expect(TRAILING_WORLD_HASHED_FIELDS).toEqual([
      'eraMovedInto',
      'poolLayout',
      'surge',
      'copepodLane',
      'poolCreatureSeats',
    ]);
    expect(hashedFieldKeys(POOL_STATE_HASHED_FIELDS)).toEqual(
      TRAILING_WORLD_HASHED_FIELDS.filter((field) => field !== 'eraMovedInto').sort(),
    );
  });
});

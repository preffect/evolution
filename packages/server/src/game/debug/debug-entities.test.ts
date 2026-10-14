// docs/architecture/debug-mcp.md §8 (`debug_get_entities`), docs/game-design/phases.md §14.6: the pool creatures'
// species filter their cells, and the copepod's pass, which has no cell, is listed at its head while one is on.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ENTITY_KIND,
  POOL_CREATURE_SPECIES,
  TICK_HZ,
  copepodHeadAt,
  createTestCopepodLane,
} from '@evolution/shared';
import { seatTestPoolCreature } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import { listDebugEntities } from './debug-entities.js';
import { DebugRequestError } from './debug-request-error.js';

/** A tick a second into a pass, so the copepod's head has left its lane's start. */
const PASS_TICK = 900;

/** A world with its player's cell, a roaming rotifer and a nematode. */
function worldWithCreatures() {
  const world = createTestWorld();
  const seating = { at: { x: 400, y: 0 }, mass: DEFAULT_BALANCE.poolCreatures.ROTIFER_MASS };
  const { cell: rotifer } = seatTestPoolCreature(world, { species: POOL_CREATURE_SPECIES.rotifer, ...seating });
  const { cell: nematode } = seatTestPoolCreature(world, { species: POOL_CREATURE_SPECIES.nematode, ...seating });
  return { world, player: world.cells[0]!, rotifer, nematode };
}

function idsOf(world: WorldState, kind?: string): unknown[] {
  return listDebugEntities(world, { kind }).map((entity) => (entity as { id?: string }).id);
}

describe('listDebugEntities', () => {
  it('filters a creature’s species to its cells, and none for a species the world has no cell of', () => {
    const { world, rotifer, nematode } = worldWithCreatures();
    expect(idsOf(world, POOL_CREATURE_SPECIES.rotifer)).toEqual([rotifer.id]);
    expect(idsOf(world, POOL_CREATURE_SPECIES.nematode)).toEqual([nematode.id]);
    expect(idsOf(world, POOL_CREATURE_SPECIES.didinium)).toEqual([]);
  });

  it('keeps a creature a cell: the cell filter lists it beside the player’s', () => {
    const { world, player, rotifer, nematode } = worldWithCreatures();
    expect(idsOf(world, ENTITY_KIND.cell)).toEqual([player.id, rotifer.id, nematode.id]);
  });

  it('lists the copepod’s pass only while one is on, at its head on the world’s tick', () => {
    const { world } = worldWithCreatures();
    expect(listDebugEntities(world, { kind: POOL_CREATURE_SPECIES.copepod })).toEqual([]);
    expect(listDebugEntities(world, {}).map((entity) => entity.entityKind)).not.toContain(
      POOL_CREATURE_SPECIES.copepod,
    );
    world.tick = PASS_TICK;
    const lane = createTestCopepodLane({ startedAtTick: PASS_TICK - TICK_HZ });
    world.copepodLane = lane;
    const head = copepodHeadAt(lane, PASS_TICK, DEFAULT_BALANCE);
    expect(head).not.toEqual({ x: lane.startX, y: lane.startY });
    const pass = { entityKind: POOL_CREATURE_SPECIES.copepod, ...lane, ...head };
    expect(listDebugEntities(world, { kind: POOL_CREATURE_SPECIES.copepod })).toEqual([pass]);
    expect(listDebugEntities(world, {}).at(-1)).toEqual(pass);
    expect(listDebugEntities(world, { kind: ENTITY_KIND.cell }).map((entity) => entity.entityKind)).not.toContain(
      POOL_CREATURE_SPECIES.copepod,
    );
  });

  it('boxes the pass by its head, not by its lane’s start', () => {
    const { world } = worldWithCreatures();
    world.tick = PASS_TICK;
    const lane = createTestCopepodLane({ startedAtTick: PASS_TICK - TICK_HZ });
    world.copepodLane = lane;
    const head = copepodHeadAt(lane, PASS_TICK, DEFAULT_BALANCE);
    const around = (point: { x: number; y: number }) => ({
      kind: POOL_CREATURE_SPECIES.copepod,
      bbox: { minX: point.x - 1, minY: point.y - 1, maxX: point.x + 1, maxY: point.y + 1 },
    });
    expect(listDebugEntities(world, around(head))).toHaveLength(1);
    expect(listDebugEntities(world, around({ x: lane.startX, y: lane.startY }))).toEqual([]);
  });

  it('refuses a kind that is neither an entity kind nor a pool creature, naming both', () => {
    const { world } = worldWithCreatures();
    expect(() => listDebugEntities(world, { kind: 'giant_amoeba' })).toThrow(DebugRequestError);
    expect(() => listDebugEntities(world, { kind: 'giant_amoeba' })).toThrow(/copepod/);
  });
});

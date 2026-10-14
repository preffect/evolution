// docs/architecture/wire-contract.md §4 "The pool layout", docs/game-design/phases.md §14.4.6: the layout rides every
// snapshot, a delta or a full state, from the pool's warning tick on and none before; the surge and the copepod's pass
// ride while the world has them; each is a copy, written exact.
import { describe, expect, it } from 'vitest';
import {
  GAME_ERA,
  createTestCopepodLane,
  createTestPoolLayout,
  createTestSurge,
  eraWarningStartedAtTick,
} from '@evolution/shared';
import { createTestWorld } from '../../testing/world-builders.js';
import type { WorldState } from '../world/world-state.js';
import { isPoolLayoutOnTheWire, serializeEraMembers } from './era-views.js';
import { serializeBroadcastSnapshot, serializeFullSnapshot } from './serialize.js';

/** A world holding a drawn layout, on `tick` of a round that started on `roundStartTick`. */
function worldWithLayoutOn(tick: number, roundStartTick = 0): WorldState {
  const world = createTestWorld();
  world.poolLayout = createTestPoolLayout();
  world.roundStartTick = roundStartTick;
  world.tick = tick;
  return world;
}

const WARNING_TICK = eraWarningStartedAtTick(GAME_ERA.pool, 0, createTestWorld().balance);
/** PH19 (phases.md §14.2.4): a jump at tick 600 to the pool makes tick 601 its first, so the round started on 601 − 36 000. */
const PH19_MOVE_TICK = 601;
const PH19_ROUND_START_TICK = -35_399;

describe('isPoolLayoutOnTheWire', () => {
  it('is false on the tick before the pool’s warning and true on the warning tick (PH17: 35 400)', () => {
    expect(isPoolLayoutOnTheWire(worldWithLayoutOn(WARNING_TICK - 1))).toBe(false);
    expect(isPoolLayoutOnTheWire(worldWithLayoutOn(WARNING_TICK))).toBe(true);
  });

  it('is true on the first tick after a debug_set_era jump to the pool (PH19: round start −35 399, tick 601)', () => {
    expect(isPoolLayoutOnTheWire(worldWithLayoutOn(PH19_MOVE_TICK, PH19_ROUND_START_TICK))).toBe(true);
    expect(isPoolLayoutOnTheWire(worldWithLayoutOn(PH19_MOVE_TICK))).toBe(false);
  });
});

describe('serializeEraMembers', () => {
  it('sends no layout before the warning, though the world drew it at the round’s start', () => {
    expect(serializeEraMembers(worldWithLayoutOn(WARNING_TICK - 1)).poolLayout).toBeNull();
  });

  it('sends the layout from the warning tick on, a copy that never aliases the world', () => {
    const world = worldWithLayoutOn(WARNING_TICK);
    const { poolLayout } = serializeEraMembers(world);
    expect(poolLayout).toEqual(world.poolLayout);
    poolLayout!.films[0]!.x += 1;
    poolLayout!.threads[0]!.angleRadians += 1;
    poolLayout!.lightPatchOrbit.orbitRadius += 1;
    expect(world.poolLayout).toEqual(createTestPoolLayout());
  });

  it('sends no layout for a world that has none, whatever the tick', () => {
    const world = worldWithLayoutOn(WARNING_TICK);
    world.poolLayout = null;
    expect(serializeEraMembers(world).poolLayout).toBeNull();
  });

  it('sends the surge and the copepod’s pass while the world has them, as copies, and null otherwise', () => {
    const world = createTestWorld();
    expect(serializeEraMembers(world)).toEqual({ poolLayout: null, surge: null, copepodLane: null });
    world.surge = createTestSurge();
    world.copepodLane = createTestCopepodLane();
    const members = serializeEraMembers(world);
    expect(members.surge).toEqual(createTestSurge());
    expect(members.copepodLane).toEqual(createTestCopepodLane());
    expect(members.surge).not.toBe(world.surge);
    expect(members.copepodLane).not.toBe(world.copepodLane);
  });
});

describe('the eras’ members on the snapshots', () => {
  it('ride the broadcast and the full state alike', () => {
    const world = worldWithLayoutOn(WARNING_TICK);
    world.surge = createTestSurge();
    for (const snapshot of [serializeBroadcastSnapshot(world), serializeFullSnapshot(world)]) {
      expect(snapshot.poolLayout).toEqual(createTestPoolLayout());
      expect(snapshot.surge).toEqual(createTestSurge());
      expect(snapshot.copepodLane).toBeNull();
    }
  });

  it('are null on every snapshot of a world that never reaches the pool', () => {
    const world = createTestWorld();
    const snapshot = serializeFullSnapshot(world);
    expect([snapshot.poolLayout, snapshot.surge, snapshot.copepodLane]).toEqual([null, null, null]);
  });
});

import { describe, expect, it } from 'vitest';
import { FOOD_KIND, SNAPSHOT_EVERY_TICKS, playerId, type GameSnapshot } from '@evolution/shared';
import { TEST_PLAYER, createTestWorld } from '../../testing/world-builders.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import type { WorldState } from '../world/world-state.js';
import { FoodDeltaTracker } from './food-delta-tracker.js';
import { serializeDeltaSnapshot } from './serialize.js';
import { EvolutionViewerState, VIEWER_SNAPSHOT_KEYS } from './viewer-state.js';

const OTHER_PLAYER = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
/** Near a cell parked at the dish centre, and past any view of a starting cell there. */
const NEAR = { x: 50, y: 0 };
const FAR = { x: 2800, y: 0 };
const TAG = 'motile';

/** A world with the own cell parked at the centre and one viewer state over it. */
function centredWorld(players = [TEST_PLAYER]) {
  const world = createTestWorld({ players });
  const own = world.cells.find((cell) => cell.playerId === TEST_PLAYER.playerId)!;
  own.x = 0;
  own.y = 0;
  return { world, own, viewerState: new EvolutionViewerState(world) };
}

/** What the room does once per broadcast: the cameras step, then the shared snapshot is built. */
function broadcast(world: WorldState, viewerState: EvolutionViewerState): GameSnapshot {
  world.tick += SNAPSHOT_EVERY_TICKS;
  viewerState.observeBroadcast();
  return serializeDeltaSnapshot(world, new FoodDeltaTracker());
}

function algaeAt(world: WorldState, position: { x: number; y: number }) {
  return spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: position });
}

describe('EvolutionViewerState', () => {
  it('answers every declared member, in the order the room appends them', () => {
    const { world, viewerState } = centredWorld();
    const members = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(viewerState.keys).toEqual(VIEWER_SNAPSHOT_KEYS);
    expect(Object.keys(members)).toEqual([...VIEWER_SNAPSHOT_KEYS]);
  });

  it('sends a game_state the motes and fragments near the viewer and none far away', () => {
    const { world, viewerState } = centredWorld();
    const near = algaeAt(world, NEAR);
    algaeAt(world, FAR);
    const nearFragment = spawnDnaFragment(world, { at: NEAR, tag: TAG, driftTurn: 0 });
    spawnDnaFragment(world, { at: FAR, tag: TAG, driftTurn: 0 });
    const members = viewerState.serializeFull(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(members.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
    expect(members.food.removedIds).toEqual([]);
    expect(members.food.moved).toEqual([]);
    expect(members.dnaFragments.map((fragment) => fragment.id)).toEqual([nearFragment.id]);
  });

  it('spawns a mote entering the area, removes one leaving it and moves one inside it', () => {
    const { world, viewerState } = centredWorld();
    const leaving = algaeAt(world, NEAR);
    const entering = algaeAt(world, FAR);
    const drifting = algaeAt(world, { x: -NEAR.x, y: NEAR.y });
    viewerState.serializeFull(TEST_PLAYER.playerId, broadcast(world, viewerState));
    leaving.x = FAR.x;
    entering.x = NEAR.x;
    drifting.y += NEAR.x;
    const { food } = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(food.spawned.map((mote) => mote.id)).toEqual([entering.id]);
    expect(food.removedIds).toEqual([leaving.id]);
    expect(food.moved.map((mote) => mote.id)).toEqual([drifting.id]);
  });

  it('restarts the delta on every game_state, and after the viewer is forgotten', () => {
    const { world, viewerState } = centredWorld();
    const near = algaeAt(world, NEAR);
    viewerState.serialize(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(viewerState.serialize(TEST_PLAYER.playerId, broadcast(world, viewerState)).food.spawned).toEqual([]);
    const full = viewerState.serializeFull(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(full.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
    viewerState.forget(TEST_PLAYER.playerId);
    const afresh = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world, viewerState));
    expect(afresh.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
  });

  it('sends viewers at different places different motes', () => {
    const { world, own, viewerState } = centredWorld([TEST_PLAYER, OTHER_PLAYER]);
    const other = world.cells.find((cell) => cell.playerId === OTHER_PLAYER.playerId)!;
    other.x = FAR.x;
    other.y = FAR.y;
    const byOwn = algaeAt(world, { x: own.x + NEAR.x, y: own.y });
    const byOther = algaeAt(world, { x: other.x - NEAR.x, y: other.y });
    const snapshot = broadcast(world, viewerState);
    const spawnedFor = (viewer: typeof TEST_PLAYER) =>
      viewerState.serializeFull(viewer.playerId, snapshot).food.spawned.map((mote) => mote.id);
    expect(spawnedFor(TEST_PLAYER)).toEqual([byOwn.id]);
    expect(spawnedFor(OTHER_PLAYER)).toEqual([byOther.id]);
  });

  it('sends each viewer its own progress and input sequence alone', () => {
    const { world, viewerState } = centredWorld([TEST_PLAYER, OTHER_PLAYER]);
    const snapshot = broadcast(world, viewerState);
    expect(Object.keys(snapshot.appliedInputSequenceByPlayer)).toHaveLength(2);
    const members = viewerState.serialize(OTHER_PLAYER.playerId, snapshot);
    expect(members.appliedInputSequenceByPlayer).toEqual({
      [OTHER_PLAYER.playerId]: snapshot.appliedInputSequenceByPlayer[OTHER_PLAYER.playerId],
    });
    expect(members.ownProgress?.playerId).toBe(OTHER_PLAYER.playerId);
    const nobody = viewerState.serialize(playerId('nobody'), snapshot);
    expect(nobody.appliedInputSequenceByPlayer).toEqual({});
    expect(nobody.ownProgress).toBeNull();
  });
});

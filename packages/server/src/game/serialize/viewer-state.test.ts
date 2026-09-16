import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  FOOD_KIND,
  SNAPSHOT_EVERY_TICKS,
  interestMarginFor,
  playerId,
  viewHalfHeightFor,
} from '@evolution/shared';
import { TEST_PLAYER, createTestWorld } from '../../testing/world-builders.js';
import { spawnDnaFragment, spawnFoodMote } from '../simulation/spawn-mote.js';
import type { WorldState } from '../world/world-state.js';
import { serializeBroadcastSnapshot } from './serialize.js';
import { ViewerCameras } from './viewer-cameras.js';
import { VIEWER_SNAPSHOT_KEYS, type BroadcastSnapshot } from './viewer-snapshot-keys.js';
import { EvolutionViewerState } from './viewer-state.js';

const OTHER_PLAYER = { playerId: playerId('p2'), playerName: 'Bob', avatarIndex: 1 };
/** Near a cell parked at the dish centre, and past any view of a starting cell there. */
const NEAR = { x: 50, y: 0 };
const FAR = { x: 2800, y: 0 };
const TAG = 'motile';
/** How far past the default margin a mote waits for a raised speed to reach it (wu). */
const PAST_THE_MARGIN_WU = 20;
const SPEED_RAISE = 3;
/** The other player's applied input sequence, apart from the own player's. */
const OTHER_SEQUENCE = 7;

/** A world with the own cell parked at the centre and one viewer state over it. */
function centredWorld(players = [TEST_PLAYER]) {
  const world = createTestWorld({ players });
  const own = world.cells.find((cell) => cell.playerId === TEST_PLAYER.playerId)!;
  own.x = 0;
  own.y = 0;
  return { world, own, viewerState: new EvolutionViewerState(world) };
}

/** What the room does once per broadcast: the world moves on, then the shared snapshot is built. */
function broadcast(world: WorldState): BroadcastSnapshot {
  world.tick += SNAPSHOT_EVERY_TICKS;
  return serializeBroadcastSnapshot(world);
}

function algaeAt(world: WorldState, position: { x: number; y: number }) {
  return spawnFoodMote(world, { kind: FOOD_KIND.algae, variant: null, at: position });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EvolutionViewerState', () => {
  it('answers every declared member, in the order the room appends them', () => {
    const { world, viewerState } = centredWorld();
    const members = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    expect(viewerState.keys).toEqual(VIEWER_SNAPSHOT_KEYS);
    expect(Object.keys(members)).toEqual([...VIEWER_SNAPSHOT_KEYS]);
  });

  it('sends a game_state the motes and fragments near the viewer and none far away', () => {
    const { world, viewerState } = centredWorld();
    const near = algaeAt(world, NEAR);
    algaeAt(world, FAR);
    const nearFragment = spawnDnaFragment(world, { at: NEAR, tag: TAG, driftTurn: 0 });
    spawnDnaFragment(world, { at: FAR, tag: TAG, driftTurn: 0 });
    const members = viewerState.serializeFull(TEST_PLAYER.playerId);
    expect(members.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
    expect(members.food.removedIds).toEqual([]);
    expect(members.food.moved).toEqual([]);
    expect(members.dnaFragments.map((fragment) => fragment.id)).toEqual([nearFragment.id]);
  });

  it('sends a game_snapshot the fragments near the viewer from the world, which the broadcast does not carry', () => {
    const { world, viewerState } = centredWorld();
    const nearFragment = spawnDnaFragment(world, { at: NEAR, tag: TAG, driftTurn: 0 });
    spawnDnaFragment(world, { at: FAR, tag: TAG, driftTurn: 0 });
    const shared = broadcast(world);
    expect(Object.keys(shared)).not.toContain('dnaFragments');
    const { dnaFragments } = viewerState.serialize(TEST_PLAYER.playerId, shared);
    expect(dnaFragments.map((fragment) => fragment.id)).toEqual([nearFragment.id]);
  });

  it('spawns a mote entering the area, removes one leaving it and moves one inside it', () => {
    const { world, viewerState } = centredWorld();
    const leaving = algaeAt(world, NEAR);
    const entering = algaeAt(world, FAR);
    const drifting = algaeAt(world, { x: -NEAR.x, y: NEAR.y });
    viewerState.serializeFull(TEST_PLAYER.playerId);
    leaving.x = FAR.x;
    entering.x = NEAR.x;
    drifting.y += NEAR.x;
    const { food } = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    expect(food.spawned.map((mote) => mote.id)).toEqual([entering.id]);
    expect(food.removedIds).toEqual([leaving.id]);
    expect(food.moved.map((mote) => mote.id)).toEqual([drifting.id]);
  });

  it('restarts the delta on every game_state, and after the viewer is forgotten', () => {
    const { world, viewerState } = centredWorld();
    const near = algaeAt(world, NEAR);
    viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    expect(viewerState.serialize(TEST_PLAYER.playerId, broadcast(world)).food.spawned).toEqual([]);
    const full = viewerState.serializeFull(TEST_PLAYER.playerId);
    expect(full.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
    viewerState.forget(TEST_PLAYER.playerId);
    const afresh = viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    expect(afresh.food.spawned.map((mote) => mote.id)).toEqual([near.id]);
  });

  it('steps the cameras once per tick, however many snapshots of that tick are serialised', () => {
    const { world, viewerState } = centredWorld([TEST_PLAYER, OTHER_PLAYER]);
    const step = vi.spyOn(ViewerCameras.prototype, 'step');
    const snapshot = broadcast(world);
    viewerState.serialize(TEST_PLAYER.playerId, snapshot);
    viewerState.serialize(OTHER_PLAYER.playerId, snapshot);
    viewerState.serialize(TEST_PLAYER.playerId, serializeBroadcastSnapshot(world));
    expect(step).toHaveBeenCalledTimes(1);
    viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    expect(step).toHaveBeenCalledTimes(2);
  });

  it('reads the world again for a second snapshot of the same tick: a paused room republishing a spawn', () => {
    const { world, viewerState } = centredWorld();
    viewerState.serialize(TEST_PLAYER.playerId, broadcast(world));
    const spawned = algaeAt(world, NEAR);
    const { food } = viewerState.serialize(TEST_PLAYER.playerId, serializeBroadcastSnapshot(world));
    expect(food.spawned.map((mote) => mote.id)).toEqual([spawned.id]);
  });

  it('widens the area with the live balance: a debug patch that raises a speed reaches further', () => {
    const { world, own, viewerState } = centredWorld();
    world.balance = structuredClone(DEFAULT_BALANCE);
    const edge = viewHalfHeightFor(own.radius) + interestMarginFor(world.balance) + PAST_THE_MARGIN_WU;
    const justPast = algaeAt(world, { x: 0, y: edge });
    const spawnedIds = () => viewerState.serializeFull(TEST_PLAYER.playerId).food.spawned.map((mote) => mote.id);
    expect(spawnedIds()).toEqual([]);
    world.balance.growth.CELL_BASE_SPEED *= SPEED_RAISE;
    expect(spawnedIds()).toEqual([justPast.id]);
  });

  it('sends viewers at different places different motes', () => {
    const { world, own, viewerState } = centredWorld([TEST_PLAYER, OTHER_PLAYER]);
    const other = world.cells.find((cell) => cell.playerId === OTHER_PLAYER.playerId)!;
    other.x = FAR.x;
    other.y = FAR.y;
    const byOwn = algaeAt(world, { x: own.x + NEAR.x, y: own.y });
    const byOther = algaeAt(world, { x: other.x - NEAR.x, y: other.y });
    const spawnedFor = (viewer: typeof TEST_PLAYER) =>
      viewerState.serializeFull(viewer.playerId).food.spawned.map((mote) => mote.id);
    expect(spawnedFor(TEST_PLAYER)).toEqual([byOwn.id]);
    expect(spawnedFor(OTHER_PLAYER)).toEqual([byOther.id]);
  });

  it('sends each viewer its own progress and input sequence alone, read from the world', () => {
    const { world, viewerState } = centredWorld([TEST_PLAYER, OTHER_PLAYER]);
    world.players.find((player) => player.playerId === OTHER_PLAYER.playerId)!.appliedInputSequence = OTHER_SEQUENCE;
    const snapshot = broadcast(world);
    const members = viewerState.serialize(OTHER_PLAYER.playerId, snapshot);
    expect(members.appliedInputSequenceByPlayer).toEqual({ [OTHER_PLAYER.playerId]: OTHER_SEQUENCE });
    expect(members.ownProgress?.playerId).toBe(OTHER_PLAYER.playerId);
    const nobody = viewerState.serialize(playerId('nobody'), snapshot);
    expect(nobody.appliedInputSequenceByPlayer).toEqual({});
    expect(nobody.ownProgress).toBeNull();
  });
});

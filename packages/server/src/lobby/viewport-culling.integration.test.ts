// Integration (docs/testing/tiers-and-builders.md §2): viewport culling of snapshots through the real room loop, the
// Evolution module and the per-viewer splice (docs/architecture/wire-contract.md §4.2 lever 1, #171). Each connection
// is sent the food and fragments inside its own camera's area, decoded from the frames the room actually wrote; a
// viewer far from an entity never receives it and receives it again when it comes back; and the culling is
// serialisation only: a room with viewers hashes equal to the same room with none. Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import {
  ENTITY_KIND,
  FOOD_KIND,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  createTestSessionConfig,
  playerId,
  type DnaFragmentView,
  type EntityId,
  type FoodMoteView,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import { createEvolutionModule } from '../game/evolution-module.js';
import {
  createManualRoomTiming,
  createTestConnection,
  createTestRoomInitOptions,
  type SentLog,
} from '../testing/builders.js';
import { GameRoom } from './game-room.js';

const SEED = 42;
const ALICE = playerId('alice');
const BOB = playerId('bob');
const VIEWERS = [ALICE, BOB] as const;
/** Opposite sides of the dish: no starting view reaches from one to the other. */
const ALICE_AT = { x: -2000, y: 0 };
const BOB_AT = { x: 2000, y: 0 };
/** Beside Bob, clear of his cell, and where Alice goes to see it. */
const BESIDE_BOB = { x: BOB_AT.x + 150, y: 150 };
const ALICE_VISITING = { x: BOB_AT.x - 150, y: 0 };
const FRAGMENT_TAG = 'motile';
/** Long enough for a camera to pan across the dish and for its older states to leave the area. */
const SETTLE_BROADCASTS = 20;

interface ReceivedSnapshot {
  readonly snapshot: GameSnapshot;
}

/** A room on the real module under manual timing; with `hasViewers` both players are connected and recorded. */
function startRoom(hasViewers: boolean) {
  const options = createTestRoomInitOptions([...VIEWERS], { config: createTestSessionConfig({ seed: SEED }) });
  const room = new GameRoom(createEvolutionModule(options), options, createManualRoomTiming());
  const handle = room.getDebugHandle()!;
  handle.setPlayer!(ALICE, { position: ALICE_AT });
  handle.setPlayer!(BOB, { position: BOB_AT });
  const sent: SentLog = {};
  if (hasViewers) {
    for (const viewer of VIEWERS) {
      const connection = createTestConnection({ playerId: viewer, sent });
      room.addPlayer(connection);
      connection.socket.send(JSON.stringify(room.gameStateMessageFor(viewer)));
    }
  }
  room.start();
  const stepBroadcasts = (broadcasts: number) => room.step(broadcasts * SNAPSHOT_EVERY_TICKS);
  return { room, handle, sent, stepBroadcasts };
}

function snapshotsSent(sent: SentLog, viewer: PlayerId, fromIndex = 0): GameSnapshot[] {
  return (sent[viewer] ?? [])
    .slice(fromIndex)
    .filter((message) => {
      const { type } = message as { type: string };
      return type === SERVER_MESSAGE_TYPE.gameSnapshot || type === SERVER_MESSAGE_TYPE.gameState;
    })
    .map((message) => (message as ReceivedSnapshot).snapshot);
}

/** The mote ids a client holds after applying every food delta it was sent, as its food store does. */
function motesHeld(snapshots: readonly GameSnapshot[]): Set<string> {
  const held = new Set<string>();
  for (const { food } of snapshots) {
    for (const mote of food.spawned) held.add(mote.id);
    for (const id of food.removedIds) held.delete(id);
  }
  return held;
}

function mentionsMote(snapshot: GameSnapshot, moteId: EntityId): boolean {
  const { spawned, removedIds, moved } = snapshot.food;
  return [...spawned, ...moved].some((mote) => mote.id === moteId) || removedIds.includes(moteId);
}

function hasFragment(snapshot: GameSnapshot, fragmentId: string): boolean {
  return snapshot.dnaFragments.some((fragment) => fragment.id === fragmentId);
}

describe('viewport culling through the room loop (#171)', () => {
  it('sends viewers at different positions different entities while the state hash stays equal', () => {
    const culled = startRoom(true);
    const unviewed = startRoom(false);
    culled.stepBroadcasts(SETTLE_BROADCASTS);
    unviewed.stepBroadcasts(SETTLE_BROADCASTS);

    const aliceMotes = motesHeld(snapshotsSent(culled.sent, ALICE));
    const bobMotes = motesHeld(snapshotsSent(culled.sent, BOB));
    expect(aliceMotes.size).toBeGreaterThan(0);
    expect(bobMotes.size).toBeGreaterThan(0);
    expect([...aliceMotes].filter((id) => bobMotes.has(id))).toEqual([]);

    const aliceLatest = snapshotsSent(culled.sent, ALICE).at(-1)!;
    const bobLatest = snapshotsSent(culled.sent, BOB).at(-1)!;
    const everyMote = culled.handle.listEntities!({ kind: ENTITY_KIND.foodMote }) as FoodMoteView[];
    expect(aliceMotes.size + bobMotes.size).toBeLessThan(everyMote.length);
    expect(aliceLatest.dnaFragments.every((fragment: DnaFragmentView) => fragment.x < 0)).toBe(true);
    expect(bobLatest.dnaFragments.every((fragment: DnaFragmentView) => fragment.x > 0)).toBe(true);
    expect(aliceLatest.appliedInputSequenceByPlayer).toEqual({ [ALICE]: expect.any(Number) });

    expect(culled.handle.computeStateHash!()).toBe(unviewed.handle.computeStateHash!());
    culled.room.stop();
    unviewed.room.stop();
  });

  it('never sends a viewer an entity out of its range, and sends it again each time the viewer comes back', () => {
    const { room, handle, sent, stepBroadcasts } = startRoom(true);
    const mote = handle.spawn!({ kind: ENTITY_KIND.foodMote, ...BESIDE_BOB, params: {} }) as FoodMoteView;
    const fragmentRequest = { kind: ENTITY_KIND.dnaFragment, ...BESIDE_BOB, params: { tag: FRAGMENT_TAG } };
    const fragment = handle.spawn!(fragmentRequest) as DnaFragmentView;
    expect(mote.kind).toBe(FOOD_KIND.algae);
    stepBroadcasts(SETTLE_BROADCASTS);
    expect(snapshotsSent(sent, ALICE).some((snapshot) => mentionsMote(snapshot, mote.id))).toBe(false);
    expect(snapshotsSent(sent, ALICE).some((snapshot) => hasFragment(snapshot, fragment.id))).toBe(false);
    expect(motesHeld(snapshotsSent(sent, BOB)).has(mote.id)).toBe(true);
    expect(hasFragment(snapshotsSent(sent, BOB).at(-1)!, fragment.id)).toBe(true);

    for (const visit of [1, 2]) {
      handle.setPlayer!(ALICE, { position: ALICE_VISITING });
      stepBroadcasts(SETTLE_BROADCASTS);
      const visiting = snapshotsSent(sent, ALICE);
      expect(motesHeld(visiting).has(mote.id), `visit ${visit}: the mote`).toBe(true);
      expect(hasFragment(visiting.at(-1)!, fragment.id), `visit ${visit}: the fragment`).toBe(true);

      const leftAt = (sent[ALICE] ?? []).length;
      handle.setPlayer!(ALICE, { position: ALICE_AT });
      stepBroadcasts(SETTLE_BROADCASTS);
      const away = snapshotsSent(sent, ALICE);
      expect(motesHeld(away).has(mote.id), `visit ${visit}: the mote is dropped away`).toBe(false);
      expect(snapshotsSent(sent, ALICE, leftAt).some((snapshot) => snapshot.food.removedIds.includes(mote.id))).toBe(
        true,
      );
      expect(hasFragment(away.at(-1)!, fragment.id), `visit ${visit}: the fragment is dropped away`).toBe(false);
    }
    room.stop();
  });
});

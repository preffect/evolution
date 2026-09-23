// Unit (docs/testing/tiers-and-builders.md §2): the resync burst of #275. A client that drains slower than the room
// broadcasts is resynced; while that `game_state` still waits in its queue behind older deltas, its acks stay near the
// frozen tick, so the room used to skip it again and arm a second and a third full state. This drives a modelled slow
// client against the real flow control and counts the resyncs sent while an earlier one was still unacknowledged.
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_EVERY_TICKS,
  createTestSessionConfig,
  gameId,
} from '@evolution/shared';
import type { GameSnapshot, PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import { createManualRoomTiming, createSpyGameModule, createTestConnection } from '../testing/builders.js';

/** #274's measured rates: the room broadcast 60.6 messages a second, the struggling client applied 34.8. */
const CLIENT_DRAIN_PER_BROADCAST = 34.8 / 60.6;
const BROADCASTS = 3000;

interface SentMessage {
  readonly type: string;
  readonly snapshot: { readonly tick: number };
}

function tickingRoom() {
  const module = createSpyGameModule();
  let tick = 0;
  module.serializeRoomState = vi.fn(() => {
    tick += 1;
    return { tick } as unknown as GameSnapshot;
  });
  module.serializeFullState = vi.fn(() => ({
    snapshot: { tick } as unknown as GameSnapshot,
    balance: DEFAULT_BALANCE,
  }));
  const sent: Record<string, unknown[]> = {};
  const room = new GameRoom(
    module,
    {
      gameId: gameId('g1'),
      creatorId: 'p1' as PlayerId,
      playerIds: ['p1' as PlayerId],
      gameName: 'Test',
      config: createTestSessionConfig({ maxPlayers: 4 }),
      avatarAssignments: { p1: 0 },
      playerNames: {},
    },
    createManualRoomTiming(),
  );
  room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
  room.start();
  return { room, sent: () => sent['p1'] as SentMessage[] };
}

/**
 * Runs a client that applies `CLIENT_DRAIN_PER_BROADCAST` messages per broadcast, acknowledging as the browser does
 * (every `SNAPSHOT_ACK_EVERY_SNAPSHOTS` deltas, a `game_state` at once), and counts the resyncs and those stacked
 * on an earlier one the client had not acknowledged yet.
 */
function runSlowClient(isRoomRunning: boolean): { resyncs: number; stackedResyncs: number; deltas: number } {
  const { room, sent } = tickingRoom();
  let read = 0;
  let budget = 0;
  let appliedDeltas = 0;
  let unacknowledgedResyncs = 0;
  let stackedResyncs = 0;
  let seen = 0;
  for (let broadcast = 0; broadcast < BROADCASTS; broadcast += 1) {
    room.step(SNAPSHOT_EVERY_TICKS);
    // `step` pauses; a running room settles resyncs on broadcasts, a paused one on acks (#300).
    if (isRoomRunning) room.resume();
    for (const message of sent().slice(seen)) {
      if (message.type !== SERVER_MESSAGE_TYPE.gameState) continue;
      if (unacknowledgedResyncs > 0) stackedResyncs += 1;
      unacknowledgedResyncs += 1;
    }
    seen = sent().length;
    budget += CLIENT_DRAIN_PER_BROADCAST;
    while (budget >= 1 && read < sent().length) {
      budget -= 1;
      const message = sent()[read]!;
      read += 1;
      if (message.type === SERVER_MESSAGE_TYPE.gameState) {
        unacknowledgedResyncs -= 1;
        room.recordSnapshotAck('p1', message.snapshot.tick);
      } else if ((appliedDeltas += 1) % SNAPSHOT_ACK_EVERY_SNAPSHOTS === 0) {
        room.recordSnapshotAck('p1', message.snapshot.tick);
      }
    }
    if (read === sent().length) budget = 0;
  }
  const resyncs = sent().filter((message) => message.type === SERVER_MESSAGE_TYPE.gameState).length;
  return { resyncs, stackedResyncs, deltas: sent().length - resyncs };
}

describe('game-room: one resync per recovery (#275)', () => {
  it.each([
    ['in a running room', true],
    ['in a room advanced by debug steps', false],
  ])('sends a slow client one game_state per recovery %s, never a second on top of the first', (_label, isRunning) => {
    const result = runSlowClient(isRunning);
    expect(result.resyncs).toBeGreaterThan(0);
    expect(result.stackedResyncs).toBe(0);
  });
});

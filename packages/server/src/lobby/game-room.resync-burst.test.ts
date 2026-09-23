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
  TICK_INTERVAL_MS,
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
  const timing = createManualRoomTiming();
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
    timing,
  );
  room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
  room.start();
  return { room, timing, sent: () => sent['p1'] as SentMessage[] };
}

/**
 * A client that applies `CLIENT_DRAIN_PER_BROADCAST` messages per broadcast, acknowledging as the browser does (every
 * `SNAPSHOT_ACK_EVERY_SNAPSHOTS` deltas, a `game_state` at once), and counts the resyncs stacked on an earlier one it
 * had not acknowledged yet.
 */
class SlowClient {
  private read = 0;
  private seen = 0;
  private budget = 0;
  private appliedDeltas = 0;
  private unacknowledgedResyncs = 0;
  stackedResyncs = 0;

  constructor(
    private readonly room: GameRoom,
    private readonly sent: () => SentMessage[],
  ) {}

  /** The resyncs the room sent since the last look, each stacked when an earlier one is still unacknowledged. */
  countArrivals(): void {
    for (const message of this.sent().slice(this.seen)) {
      if (message.type !== SERVER_MESSAGE_TYPE.gameState) continue;
      if (this.unacknowledgedResyncs > 0) this.stackedResyncs += 1;
      this.unacknowledgedResyncs += 1;
    }
    this.seen = this.sent().length;
  }

  /** One broadcast's worth of draining; an idle client carries no budget over. */
  drain(): void {
    this.budget += CLIENT_DRAIN_PER_BROADCAST;
    while (this.budget >= 1 && this.read < this.sent().length) {
      this.budget -= 1;
      this.apply(this.sent()[this.read]!);
      this.read += 1;
    }
    if (this.read === this.sent().length) this.budget = 0;
  }

  private apply(message: SentMessage): void {
    if (message.type === SERVER_MESSAGE_TYPE.gameState) {
      this.unacknowledgedResyncs -= 1;
      this.room.recordSnapshotAck('p1', message.snapshot.tick);
      return;
    }
    this.appliedDeltas += 1;
    if (this.appliedDeltas % SNAPSHOT_ACK_EVERY_SNAPSHOTS === 0)
      this.room.recordSnapshotAck('p1', message.snapshot.tick);
  }
}

function runSlowClient(isRoomRunning: boolean): { resyncs: number; stackedResyncs: number; deltas: number } {
  const { room, timing, sent } = tickingRoom();
  const client = new SlowClient(room, sent);
  for (let broadcast = 0; broadcast < BROADCASTS; broadcast += 1) {
    if (isRoomRunning) {
      // The live loop: one broadcast's ticks through the room's own ticker.
      timing.clock.advanceMilliseconds(SNAPSHOT_EVERY_TICKS * TICK_INTERVAL_MS);
      timing.ticker.fire();
    } else {
      room.step(SNAPSHOT_EVERY_TICKS);
    }
    client.countArrivals();
    client.drain();
  }
  const resyncs = sent().filter((message) => message.type === SERVER_MESSAGE_TYPE.gameState).length;
  return { resyncs, stackedResyncs: client.stackedResyncs, deltas: sent().length - resyncs };
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

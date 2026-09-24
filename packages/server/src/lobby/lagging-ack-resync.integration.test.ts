// Integration (docs/testing/tiers-and-builders.md §2): a slow client against the snapshot flow control of
// docs/architecture/wire-contract.md §4, over real sockets, the lobby and the real game module. The client acknowledges
// exactly as the browser does (`net/snapshot-acknowledger.ts`: a `game_state` at once, a delta every
// `SNAPSHOT_ACK_EVERY_SNAPSHOTS`), and its acks lag: it falls a limit behind, is resynced, and applies that `game_state`
// only after the room has run past the limit again. #655 measured the freeze that followed on a throttled page: the one
// delta that ended the resync hold read as a limit-deep queue, the client owed no ack for a single delta, and the room
// never sent it anything again.
// Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_ACK_EVERY_SNAPSHOTS,
  SNAPSHOT_BACKLOG_LIMIT_TICKS,
  SNAPSHOT_EVERY_TICKS,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import { evolutionModuleFactory } from '../game/evolution-module.js';
import {
  advanceRoomTicks,
  closeLobbySocketHarness,
  connectTestClient,
  startLobbySocketHarness,
  startTestRoom,
  type LobbySocketHarness,
  type TestClient,
} from '../testing/socket-builders.js';
import { untilReceived, untilRoomDecides } from '../testing/wait-for.js';

const CLIENT_ID = 'slow';
/** How long the client lags, each time: two limits of ticks, so the room is past the limit whatever the phase. */
const LAG_TICKS = SNAPSHOT_BACKLOG_LIMIT_TICKS * 2;
/** Broadcasts the recovered client must keep receiving: several ack cadences, so a skip would show. */
const RECOVERED_BROADCASTS = SNAPSHOT_ACK_EVERY_SNAPSHOTS * 4;

function tickOf(message: ServerMessage): number {
  return (message as { snapshot: GameSnapshot }).snapshot.tick;
}

/**
 * The browser's half of the flow control, applied on demand: the test decides when the client gets to the messages it
 * has received, which is how its acks lag.
 */
class BrowserLikeClient {
  private appliedCount = 0;
  private deltasSinceAcknowledgement = 0;
  newestAcknowledgedTick: number | null = null;

  constructor(private readonly client: TestClient) {}

  /** Applies every message received so far, acknowledging as `SnapshotAcknowledger` does. */
  applyArrived(): void {
    for (const message of this.client.received.slice(this.appliedCount)) this.apply(message);
    this.appliedCount = this.client.received.length;
  }

  private apply(message: ServerMessage): void {
    if (message.type === SERVER_MESSAGE_TYPE.gameState) {
      this.acknowledge(tickOf(message));
    } else if (message.type === SERVER_MESSAGE_TYPE.gameSnapshot) {
      this.deltasSinceAcknowledgement += 1;
      if (this.deltasSinceAcknowledgement >= SNAPSHOT_ACK_EVERY_SNAPSHOTS) this.acknowledge(tickOf(message));
    }
  }

  private acknowledge(tick: number): void {
    this.deltasSinceAcknowledgement = 0;
    this.newestAcknowledgedTick = tick;
    this.client.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.snapshotAck, tick }));
  }
}

function newestTickOfType(client: TestClient, type: string): number | undefined {
  const newest = client.received.filter((message) => message.type === type).at(-1);
  return newest === undefined ? undefined : tickOf(newest);
}

describe('a client whose acks lag behind a running room (#655)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness(evolutionModuleFactory);
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  it('keeps receiving deltas after a resync it applied only once the room had run past the limit again', async () => {
    const client = await connectTestClient(harness, CLIENT_ID);
    const { timing, room } = await startTestRoom(harness, client, 'lagging');
    const browser = new BrowserLikeClient(client);
    // It acknowledges the start's game_state, so it is a client the flow control measures (silence is not a backlog).
    browser.applyArrived();
    advanceRoomTicks(timing, SNAPSHOT_EVERY_TICKS);
    await untilRoomDecides(
      () => room.snapshotBacklog.backlogTicksOf(CLIENT_ID) !== null,
      'the room read the first ack',
    );

    // The page stalls: the room runs on, and skips it once more than the limit is in flight.
    advanceRoomTicks(timing, LAG_TICKS);
    expect(room.snapshotBacklog.owedCount()).toBe(1);

    // It drains what it was sent; the next broadcast is its resync.
    const sentBeforeSkip = room.snapshotBacklog.backlogTicksOf(CLIENT_ID)! + browser.newestAcknowledgedTick!;
    await untilReceived(
      client,
      () => newestTickOfType(client, SERVER_MESSAGE_TYPE.gameSnapshot) === sentBeforeSkip,
      `the deltas up to tick ${sentBeforeSkip}, sent before the skip, arrived`,
    );
    browser.applyArrived();
    await untilRoomDecides(
      () => room.snapshotBacklog.backlogTicksOf(CLIENT_ID)! <= SNAPSHOT_BACKLOG_LIMIT_TICKS,
      'the room read the ack that caught up',
    );
    const gameStatesBefore = client.received.filter((message) => message.type === SERVER_MESSAGE_TYPE.gameState).length;
    advanceRoomTicks(timing, SNAPSHOT_EVERY_TICKS);
    await untilReceived(
      client,
      (received) =>
        received.filter((message) => message.type === SERVER_MESSAGE_TYPE.gameState).length > gameStatesBefore,
      'the resync arrived',
    );
    const resyncTick = newestTickOfType(client, SERVER_MESSAGE_TYPE.gameState)!;

    // The resync waits in the slow page's queue while the room runs another two limits, sending it nothing.
    advanceRoomTicks(timing, LAG_TICKS);
    browser.applyArrived();
    await untilRoomDecides(
      () => room.snapshotBacklog.backlogTicksOf(CLIENT_ID) === 0,
      `the room read the ack of the resync at tick ${resyncTick}`,
    );

    // Now the page keeps up: every broadcast must reach it, applied and acknowledged as the browser would.
    for (let broadcast = 0; broadcast < RECOVERED_BROADCASTS; broadcast += 1) {
      advanceRoomTicks(timing, SNAPSHOT_EVERY_TICKS);
      // The room decides synchronously: a client it skipped is owed a resync, and would be sent nothing more.
      expect(room.snapshotBacklog.owedCount()).toBe(0);
      const broadcastTick = room.getTickCount();
      await untilReceived(
        client,
        () => newestTickOfType(client, SERVER_MESSAGE_TYPE.gameSnapshot) === broadcastTick,
        `the delta for tick ${broadcastTick} arrived`,
      );
      browser.applyArrived();
    }
    expect(room.snapshotBacklog.owedCount()).toBe(0);
    expect(room.snapshotBacklog.resyncCount()).toBe(1);
  });
});

// Integration (docs/testing/tiers-and-builders.md §2): `leave_game` over real sockets, through the /ws route and
// the router into the lobby and the room's broadcast loop (#319, docs/architecture/wire-contract.md §4). The player
// who leaves is off the room at once: its socket hears no more of that room, the players left behind hear it go,
// and the same socket can join another room straight away. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, SNAPSHOT_EVERY_TICKS } from '@evolution/shared';
import {
  advanceRoomTicks,
  closeLobbySocketHarness,
  connectTestClient,
  startLobbySocketHarness,
  startTestRoom,
  type LobbySocketHarness,
} from '../testing/socket-builders.js';
import {
  isSeated,
  lobbyShows,
  messageOfType,
  nextMatchingMessage,
  sendAndAwait,
  type MessagePredicate,
  type TestClient,
} from '../testing/socket-messages.js';

function countOfType(client: TestClient, type: string): number {
  return client.received.filter((message) => message.type === type).length;
}

describe('leave_game over the wire (#319)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness();
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  it('takes the leaving socket off the room broadcast and tells the players left behind', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const carol = await connectTestClient(harness, 'carol');
    const { gameId, timing, room } = await startTestRoom(harness, alice, 'left', [carol]);
    const firstSnapshot = nextMatchingMessage(alice, messageOfType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advanceRoomTicks(timing, SNAPSHOT_EVERY_TICKS);
    await firstSnapshot;

    const heardLeaving = nextMatchingMessage(carol, messageOfType(SERVER_MESSAGE_TYPE.playerDisconnected));
    const isGone = lobbyShows((games) => !isSeated(games, gameId, alice.clientId));
    await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId }, isGone);
    expect(await heardLeaving).toEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'alice' });
    expect(room.playerConnections.has('alice')).toBe(false);
    expect(room.allPlayerIds).toEqual(['carol']);

    const snapshotsBeforeLeaving = countOfType(alice, SERVER_MESSAGE_TYPE.gameSnapshot);
    const carolSnapshot = nextMatchingMessage(carol, messageOfType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advanceRoomTicks(timing, SNAPSHOT_EVERY_TICKS);
    await carolSnapshot;
    // A round trip on alice's own socket: a snapshot the room had sent her would arrive before this answer.
    const joinLobby = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'alice', avatarIndex: 0 } as const;
    await sendAndAwait(alice, joinLobby, isGone);
    expect(countOfType(alice, SERVER_MESSAGE_TYPE.gameSnapshot)).toBe(snapshotsBeforeLeaving);
  });

  it('lets the socket that left join another room at once', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const other = await startTestRoom(harness, bob, 'other');
    const left = await startTestRoom(harness, alice, 'left');

    const isClosed = lobbyShows((games) => !games.some((game) => game.gameId === left.gameId));
    await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: left.gameId }, isClosed);
    expect(harness.started.lobby.getActiveRoom(left.gameId)).toBeUndefined();

    const isOtherRoomState: MessagePredicate = (message) =>
      message.type === SERVER_MESSAGE_TYPE.gameState && message.gameId === other.gameId;
    const joined = await sendAndAwait(
      alice,
      { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: other.gameId },
      isOtherRoomState,
    );
    expect(joined).toMatchObject({ playerId: 'alice' });
    expect(other.room.allPlayerIds).toEqual(['bob', 'alice']);

    const snapshot = nextMatchingMessage(alice, messageOfType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advanceRoomTicks(other.timing, SNAPSHOT_EVERY_TICKS);
    await snapshot;
    expect(other.room.playerConnections.get('alice')).toBe(harness.started.connections.get('alice'));
  });
});

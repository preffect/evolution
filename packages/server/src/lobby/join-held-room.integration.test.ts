// Integration (docs/testing/tiers-and-builders.md §2): `join_game` for the room the socket already holds, over real
// sockets through the /ws route and the router into the lobby, on the real game module (#335,
// docs/architecture/wire-contract.md §4). A second tab sharing the `clientId`, or a client retry, re-enters the seat:
// one `game_state` back, and the roster, the world's cells and the leaderboard still hold the player once. Run with
// `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import { evolutionModuleFactory } from '../game/evolution-module.js';
import {
  advanceRoomTicks,
  closeLobbySocketHarness,
  connectTestClient,
  createTestRoom,
  removeTestClient,
  startLobbySocketHarness,
  startTestRoom,
  whenClosed,
  type LobbySocketHarness,
} from '../testing/socket-builders.js';
import { messageOfType, nextMatchingMessage, sendAndAwait, type TestClient } from '../testing/socket-messages.js';

/** How many times `playerId` appears among the snapshot's cells and leaderboard rows. */
function entriesOf(snapshot: GameSnapshot, playerId: string) {
  return {
    cells: snapshot.cells.filter((cell) => cell.playerId === playerId).length,
    leaderboardRows: snapshot.leaderboard.filter((row) => row.playerId === playerId).length,
  };
}

function snapshotOf(message: ServerMessage): GameSnapshot {
  return (message as { snapshot: GameSnapshot }).snapshot;
}

describe('join_game for the room already held, over the wire (#335)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness(evolutionModuleFactory);
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  /** A second tab connects as `client` (the first is closed by the takeover) and replaces it in the harness. */
  async function openSecondTab(client: TestClient): Promise<TestClient> {
    const firstTabClosed = whenClosed(client.socket);
    const secondTab = await connectTestClient(harness, client.clientId);
    await firstTabClosed;
    removeTestClient(harness, client);
    return secondTab;
  }

  /** `joiner` sends `join_game` for `gameId`; resolves with the `game_state` it is answered with. */
  function rejoin(joiner: TestClient, gameId: string): Promise<ServerMessage> {
    const joinGame = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId } as const;
    return sendAndAwait(joiner, joinGame, messageOfType(SERVER_MESSAGE_TYPE.gameState));
  }

  it('a second tab re-enters the seat: one roster entry, one cell, one leaderboard row, no player_joined', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const held = await startTestRoom(harness, alice, 'held', [bob]);
    const secondTab = await openSecondTab(alice);

    const state = await rejoin(secondTab, held.gameId);
    expect(state).toMatchObject({ playerId: 'alice', playerIds: ['alice', 'bob'] });
    expect(entriesOf(snapshotOf(state), 'alice')).toEqual({ cells: 1, leaderboardRows: 1 });
    expect(snapshotOf(state).ownProgress).toMatchObject({ playerId: 'alice' });
    expect(held.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(harness.started.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice', 'bob']);

    const bobSnapshot = nextMatchingMessage(bob, messageOfType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advanceRoomTicks(held.timing, SNAPSHOT_EVERY_TICKS);
    expect(entriesOf(snapshotOf(await bobSnapshot), 'alice')).toEqual({ cells: 1, leaderboardRows: 1 });
    expect(bob.received.some((message) => message.type === SERVER_MESSAGE_TYPE.playerJoined)).toBe(false);
  });

  it('a dropped player who reconnects and joins again keeps the one seat', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const held = await startTestRoom(harness, alice, 'held', [bob]);
    const heardDrop = nextMatchingMessage(bob, messageOfType(SERVER_MESSAGE_TYPE.playerDisconnected));
    alice.socket.close();
    await whenClosed(alice.socket);
    await heardDrop;
    removeTestClient(harness, alice);

    const reconnected = await connectTestClient(harness, 'alice');
    const state = await rejoin(reconnected, held.gameId);
    expect(entriesOf(snapshotOf(state), 'alice')).toEqual({ cells: 1, leaderboardRows: 1 });
    expect(held.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(held.room.disconnectedPlayers.has('alice')).toBe(false);
    expect(bob.received.some((message) => message.type === SERVER_MESSAGE_TYPE.playerJoined)).toBe(false);
  });

  it('a join for the full pending game already held keeps the one seat, with no "Game is full"', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const carol = await connectTestClient(harness, 'carol');
    const dave = await connectTestClient(harness, 'dave');
    // The harness caps a game at four seats, so these guests fill it.
    const gameId = await createTestRoom(harness, alice, 'pending', [bob, carol, dave]);
    bob.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId }));
    // `join_lobby` is answered to the sender alone: once it is, the server has handled the join before it.
    const joinLobby = { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'bob', avatarIndex: 0 } as const;
    await sendAndAwait(bob, joinLobby, messageOfType(SERVER_MESSAGE_TYPE.lobbyUpdate));
    expect(harness.started.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual([
      'alice',
      'bob',
      'carol',
      'dave',
    ]);
    expect(bob.received.some((message) => message.type === SERVER_MESSAGE_TYPE.error)).toBe(false);
  });
});

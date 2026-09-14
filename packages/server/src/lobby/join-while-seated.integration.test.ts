// Integration (docs/testing/tiers-and-builders.md §2): `join_game` from a socket still seated in another room, over
// real sockets through the /ws route and the router into the lobby (#334, docs/architecture/wire-contract.md §4). Two
// tabs share one `clientId`, so a second tab can take the seat over and join elsewhere without a `leave_game`: the old
// seat is left the way `leave_game` leaves it, so the old room holds no ghost and tears down once empty, and the lobby
// list shows each player in one room only. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, SNAPSHOT_EVERY_TICKS, type ServerMessage } from '@evolution/shared';
import {
  advanceRoomTicks,
  closeLobbySocketHarness,
  connectTestClient,
  createTestRoom,
  isSeated,
  lobbyShows,
  messageOfType,
  nextMatchingMessage,
  sendAndAwait,
  startLobbySocketHarness,
  startTestRoom,
  type LobbySocketHarness,
} from '../testing/socket-builders.js';

/** Each listed game's name with the ids seated in it, from a `lobby_update`. */
function seatsListedIn(message: ServerMessage) {
  if (message.type !== SERVER_MESSAGE_TYPE.lobbyUpdate) return [];
  return message.games.map((game) => ({
    gameName: game.gameName,
    playerIds: game.players.map((player) => player.playerId),
  }));
}

describe('join_game while seated in another room, over the wire (#334)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness();
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  it('leaves the old active room first: no ghost seat, the players left behind hear it, the room ticks on', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const carol = await connectTestClient(harness, 'carol');
    const old = await startTestRoom(harness, alice, 'old', [carol]);
    const next = await startTestRoom(harness, bob, 'next');

    const heardLeaving = nextMatchingMessage(carol.socket, messageOfType(SERVER_MESSAGE_TYPE.playerDisconnected));
    const hasMoved = lobbyShows(
      (games) => !isSeated(games, old.gameId, alice.clientId) && isSeated(games, next.gameId, alice.clientId),
    );
    const listed = await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: next.gameId }, hasMoved);
    expect(await heardLeaving).toEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'alice' });
    expect(seatsListedIn(listed)).toEqual([
      { gameName: 'old', playerIds: ['carol'] },
      { gameName: 'next', playerIds: ['bob', 'alice'] },
    ]);
    expect(old.room.allPlayerIds).toEqual(['carol']);
    expect(old.room.playerConnections.has('alice')).toBe(false);
    expect(next.room.playerConnections.get('alice')).toBe(harness.started.connections.get('alice'));

    const carolSnapshot = nextMatchingMessage(carol.socket, messageOfType(SERVER_MESSAGE_TYPE.gameSnapshot));
    advanceRoomTicks(old.timing, SNAPSHOT_EVERY_TICKS);
    await carolSnapshot;
    expect(harness.started.lobby.getActiveRoom(old.gameId)).toBe(old.room);
  });

  it('tears down the old active room its only player left by joining another', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const old = await startTestRoom(harness, alice, 'old');
    const next = await startTestRoom(harness, bob, 'next');
    const stopSpy = vi.spyOn(old.room, 'stop');

    const isClosed = lobbyShows(
      (games) => !games.some((game) => game.gameId === old.gameId) && isSeated(games, next.gameId, alice.clientId),
    );
    const listed = await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: next.gameId }, isClosed);
    expect(seatsListedIn(listed)).toEqual([{ gameName: 'next', playerIds: ['bob', 'alice'] }]);
    expect(stopSpy).toHaveBeenCalled();
    expect(harness.started.lobby.getActiveRoom(old.gameId)).toBeUndefined();
  });

  it('frees the old pending seat when joining another pending game', async () => {
    const alice = await connectTestClient(harness, 'alice');
    const bob = await connectTestClient(harness, 'bob');
    const carol = await connectTestClient(harness, 'carol');
    const oldGameId = await createTestRoom(harness, carol, 'old', [alice]);
    const nextGameId = await createTestRoom(harness, bob, 'next');

    const hasMoved = lobbyShows(
      (games) => !isSeated(games, oldGameId, alice.clientId) && isSeated(games, nextGameId, alice.clientId),
    );
    const listed = await sendAndAwait(alice, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: nextGameId }, hasMoved);
    expect(seatsListedIn(listed)).toEqual([
      { gameName: 'old', playerIds: ['carol'] },
      { gameName: 'next', playerIds: ['bob', 'alice'] },
    ]);
  });
});

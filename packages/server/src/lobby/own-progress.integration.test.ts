// Integration (docs/testing/tiers-and-builders.md §2): two players in a room on the real game module, over real
// sockets through the /ws route and the lobby into the room's broadcast. What only a player reads of its own
// progress (the owned traits, the offer, the DNA, the death state) reaches that player alone: every `game_state`
// and `game_snapshot` carries the receiver's own progress, and every player only as a roster row
// (docs/architecture/wire-contract.md §4.1, #331). Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  SERVER_MESSAGE_TYPE,
  SNAPSHOT_EVERY_TICKS,
  TICK_INTERVAL_MS,
  createTestSessionConfig,
  type GameSnapshot,
  type ServerMessage,
} from '@evolution/shared';
import { evolutionModuleFactory } from '../game/evolution-module.js';
import { createManualRoomTiming, type ManualRoomTiming } from '../testing/builders.js';
import {
  openRecordingTestSocket,
  startTestWebSocketServer,
  whenClosed,
  type TestWebSocketServer,
} from '../testing/socket-builders.js';
import { isSeated, lobbyShows } from '../testing/socket-messages.js';
import { untilReceived } from '../testing/wait-for.js';

const ALICE = 'alice';
const BOB = 'bob';
const BROADCASTS = 2;

function snapshotsOf(received: readonly ServerMessage[], type: string): GameSnapshot[] {
  return received
    .filter((message) => message.type === type)
    .map((message) => (message as { snapshot: GameSnapshot }).snapshot);
}

describe('each player is sent its own progress and the others only by name (#331)', () => {
  let started: TestWebSocketServer;
  let timing: ManualRoomTiming;

  beforeEach(async () => {
    timing = createManualRoomTiming();
    started = await startTestWebSocketServer({ gameFactory: evolutionModuleFactory, createRoomTiming: () => timing });
  });

  afterEach(async () => {
    await started.close();
  });

  async function join(clientId: string) {
    const client = await openRecordingTestSocket(`${started.url}?clientId=${clientId}`);
    client.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: clientId, avatarIndex: 0 }));
    return client;
  }

  it('carries the receiver’s own progress in every game_state and game_snapshot', async () => {
    const alice = await join(ALICE);
    alice.socket.send(
      JSON.stringify({ type: CLIENT_MESSAGE_TYPE.createGame, gameName: 'own', config: createTestSessionConfig() }),
    );
    const isListed = lobbyShows((games) => games.length > 0);
    await untilReceived(alice, (received) => received.some(isListed), 'the game alice created is listed');
    const gameId = started.lobby.listGames()[0]!.gameId;
    const bob = await join(BOB);
    bob.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.joinGame, gameId }));
    const isBobSeated = lobbyShows((games) => isSeated(games, gameId, BOB));
    await untilReceived(bob, (received) => received.some(isBobSeated), 'bob is seated in the game');
    alice.socket.send(JSON.stringify({ type: CLIENT_MESSAGE_TYPE.startGame, gameId }));
    const clients = [
      { clientId: ALICE, ...alice },
      { clientId: BOB, ...bob },
    ];
    // The room exists once both have their `game_state`; only then does the test's clock drive its loop.
    await Promise.all(
      clients.map((client) =>
        untilReceived(
          client,
          (received) => snapshotsOf(received, SERVER_MESSAGE_TYPE.gameState).length > 0,
          `${client.clientId}'s game_state arrived`,
        ),
      ),
    );
    for (let tick = 0; tick < BROADCASTS * SNAPSHOT_EVERY_TICKS; tick += 1) {
      timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
      timing.ticker.fire();
    }
    await Promise.all(
      clients.map((client) =>
        untilReceived(
          client,
          (received) => snapshotsOf(received, SERVER_MESSAGE_TYPE.gameSnapshot).length >= BROADCASTS,
          `${BROADCASTS} snapshots arrived for ${client.clientId}`,
        ),
      ),
    );

    for (const { clientId, received } of clients) {
      const snapshots = [
        ...snapshotsOf(received, SERVER_MESSAGE_TYPE.gameState),
        ...snapshotsOf(received, SERVER_MESSAGE_TYPE.gameSnapshot),
      ];
      expect(snapshots.length).toBeGreaterThan(BROADCASTS);
      for (const snapshot of snapshots) {
        expect(snapshot.ownProgress).toMatchObject({ playerId: clientId, ownedTraits: [], offer: null });
        expect(snapshot.players).toEqual({
          [ALICE]: { playerId: ALICE, playerName: ALICE },
          [BOB]: { playerId: BOB, playerName: BOB },
        });
      }
    }

    for (const { socket } of [alice, bob]) {
      socket.close();
      await whenClosed(socket);
    }
  });
});

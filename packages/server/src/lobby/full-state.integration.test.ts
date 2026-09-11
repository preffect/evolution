// Integration (docs/TESTING.md §2): the `game_state` payload from the echo module through the room
// and the lobby to the connection, on start, on a late join and on a reconnect. docs/ARCHITECTURE.md §4:
// `game_state` carries the module's `serializeFullState()`, the full snapshot plus the balance the
// client must predict with. Run with `./validate.sh integration`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT_MESSAGE_TYPE,
  DEFAULT_BALANCE,
  DISCONNECT_GRACE_MS,
  SERVER_MESSAGE_TYPE,
  createTestSessionConfig,
} from '@evolution/shared';
import { defaultGameModuleFactory } from '../game/game-module.js';
import { createTestLobby } from '../testing/builders.js';

function gameStatesSentTo(sent: Record<string, unknown[]>, playerId: string): unknown[] {
  return (sent[playerId] as { type: string }[]).filter((message) => message.type === SERVER_MESSAGE_TYPE.gameState);
}

/** A lobby on the real echo module where alice created and started a game. */
function lobbyWithActiveEchoGame() {
  const fixture = createTestLobby({ gameFactory: defaultGameModuleFactory });
  const alice = fixture.join('alice', 'Alice');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'G',
    config: createTestSessionConfig({ maxPlayers: 4 }),
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const stop = () => fixture.lobby.getActiveRoom(gameId)?.stop();
  return { ...fixture, alice, gameId, stop };
}

describe('game_state carries the full state and the balance (echo module → room → lobby → wire)', () => {
  afterEach(() => vi.useRealTimers());

  it('a late joiner receives the full snapshot of the roster and DEFAULT_BALANCE', () => {
    const fixture = lobbyWithActiveEchoGame();
    const bob = fixture.join('bob', 'Bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(gameStatesSentTo(fixture.sent, 'bob')).toEqual([
      expect.objectContaining({
        gameId: fixture.gameId,
        playerId: 'bob',
        snapshot: { players: { alice: null, bob: null } },
        balance: DEFAULT_BALANCE,
      }),
    ]);
    fixture.stop();
  });

  it('a reconnect within the grace window receives the full state again, balance included', () => {
    vi.useFakeTimers();
    const fixture = lobbyWithActiveEchoGame();
    fixture.lobby.handleDisconnect(fixture.alice);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1);
    fixture.lobby.handleConnect(fixture.alice, fixture.connections);
    // One game_state at start (docs/ARCHITECTURE.md §4), one for the resync.
    const fullState = expect.objectContaining({
      gameId: fixture.gameId,
      playerId: 'alice',
      snapshot: { players: { alice: null } },
      balance: DEFAULT_BALANCE,
    });
    expect(gameStatesSentTo(fixture.sent, 'alice')).toEqual([fullState, fullState]);
    fixture.stop();
  });
});

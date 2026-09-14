import { describe, expect, it, vi } from 'vitest';
import { createTestSessionConfig } from '@evolution/shared';
import { createTestConnection } from '../testing/builders.js';
import type { GameRoom } from './game-room.js';
import { lobbyPresenceOf, type PendingGame } from './pending-game.js';
import { SeatLifecycle } from './seat-lifecycle.js';

// `SeatLifecycle` driven directly over a plain registry; the lobby-driven lifecycle is seat-lifecycle.test.ts.

describe('seat-lifecycle: deleting a pending game', () => {
  it('frees every seat in that game and no other, then broadcasts once; an unknown game is a no-op', () => {
    const broadcastLobbyUpdate = vi.fn();
    const players = new Map(
      ['alice', 'bob'].map((playerId) => [playerId, lobbyPresenceOf(createTestConnection({ playerId }))]),
    );
    const config = createTestSessionConfig({ maxPlayers: 4 });
    const pending: PendingGame = { gameId: 'g1', gameName: 'G', creatorId: 'alice', config, players };
    const registry = {
      pendingGames: new Map([['g1', pending]]),
      activeRooms: new Map<string, GameRoom>(),
      playerToGame: new Map([
        ['alice', 'g1'],
        ['bob', 'g1'],
        ['carol', 'g2'],
      ]),
    };
    const seats = new SeatLifecycle(registry, broadcastLobbyUpdate);
    seats.deletePendingGame('nope');
    expect(broadcastLobbyUpdate).not.toHaveBeenCalled();
    seats.deletePendingGame('g1');
    expect(registry.pendingGames.size).toBe(0);
    expect([...registry.playerToGame]).toEqual([['carol', 'g2']]);
    expect(broadcastLobbyUpdate).toHaveBeenCalledTimes(1);
  });
});

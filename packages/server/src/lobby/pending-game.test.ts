import { describe, expect, it } from 'vitest';
import { createTestSessionConfig } from '@evolution/shared';
import { createTestConnection } from '../testing/builders.js';
import { lobbyPresenceOf, roomInitOptionsOf, type PendingGame } from './pending-game.js';

describe('pending-game', () => {
  it('lists a connection by its id, name and avatar', () => {
    const connection = createTestConnection({ playerId: 'alice', playerName: 'Alice', avatarIndex: 2 });
    expect(lobbyPresenceOf(connection)).toEqual({ playerId: 'alice', playerName: 'Alice', avatarIndex: 2 });
  });

  it('hands the roster, in seat order, with names and avatars to the room it starts', () => {
    const config = createTestSessionConfig({ maxPlayers: 3 });
    const pending: PendingGame = {
      gameId: 'g1',
      gameName: 'G',
      creatorId: 'bob',
      config,
      players: new Map([
        ['alice', lobbyPresenceOf(createTestConnection({ playerId: 'alice', playerName: 'Alice', avatarIndex: 1 }))],
        ['bob', lobbyPresenceOf(createTestConnection({ playerId: 'bob', playerName: 'Bob', avatarIndex: 4 }))],
      ]),
    };
    expect(roomInitOptionsOf(pending)).toEqual({
      gameId: 'g1',
      creatorId: 'bob',
      playerIds: ['alice', 'bob'],
      gameName: 'G',
      config,
      avatarAssignments: { alice: 1, bob: 4 },
      playerNames: { alice: 'Alice', bob: 'Bob' },
    });
  });
});

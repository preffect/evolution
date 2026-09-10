import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@evolution/shared';
import { defaultGameModuleFactory } from './game-module.js';

const options = {
  creatorId: 'p1' as PlayerId,
  playerIds: ['p1', 'p2'] as PlayerId[],
  gameName: 'echo',
  config: { maxPlayers: 4 },
  avatarAssignments: { p1: 0, p2: 1 },
  playerNames: { p1: 'Alice', p2: 'Bob' },
};

describe('defaultGameModuleFactory (echo)', () => {
  it('echoes every roster member with null until they send input', () => {
    const game = defaultGameModuleFactory(options);
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p2: null } });
  });

  it('echoes the latest input per player', () => {
    const game = defaultGameModuleFactory(options);
    game.submitInput('p1' as PlayerId, { x: 1 });
    game.submitInput('p1' as PlayerId, { x: 2 });
    expect(game.serializeRoomState()).toEqual({ players: { p1: { x: 2 }, p2: null } });
  });

  it('adds late players and forgets removed ones along with their input', () => {
    const game = defaultGameModuleFactory(options);
    game.addPlayer('p3' as PlayerId, 2, 'Cid');
    game.submitInput('p2' as PlayerId, { y: 1 });
    game.removePlayer('p2' as PlayerId);
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p3: null } });
  });

  it('advancing a tick is a no-op for the echo game', () => {
    const game = defaultGameModuleFactory(options);
    const before = game.serializeRoomState();
    game.reduceGameState();
    expect(game.serializeRoomState()).toEqual(before);
  });
});

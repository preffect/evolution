import { describe, expect, it } from 'vitest';
import { createTestGameInput, createTestSessionConfig } from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { DebugRequestError } from './debug/debug-request-error.js';
import { defaultGameModuleFactory } from './game-module.js';

/** A room that seats every bot. */
const seatFreely = () => {};

const options = {
  creatorId: 'p1' as PlayerId,
  playerIds: ['p1', 'p2'] as PlayerId[],
  gameName: 'echo',
  config: createTestSessionConfig({ maxPlayers: 4 }),
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
    game.submitInput('p1' as PlayerId, createTestGameInput({ sequence: 1 }));
    const latest = createTestGameInput({ sequence: 2 });
    game.submitInput('p1' as PlayerId, latest);
    expect(game.serializeRoomState()).toEqual({ players: { p1: latest, p2: null } });
  });

  it('adds late players and forgets removed ones along with their input', () => {
    const game = defaultGameModuleFactory(options);
    game.addPlayer('p3' as PlayerId, 2, 'Cid');
    game.submitInput('p2' as PlayerId, createTestGameInput());
    game.removePlayer('p2' as PlayerId);
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p3: null } });
  });

  it('advancing a tick is a no-op for the echo game without bots', () => {
    const game = defaultGameModuleFactory(options);
    const before = game.serializeRoomState();
    game.reduceGameState();
    expect(game.serializeRoomState()).toEqual(before);
  });
});

describe('the echo module drives its own bots (docs/ARCHITECTURE.md §8)', () => {
  it('offers only the bot pair as debug capabilities', () => {
    const handle = defaultGameModuleFactory(options).getDebugHandle?.();
    expect(handle && Object.keys(handle).sort()).toEqual(['removeBot', 'spawnBot']);
  });

  it('spawnBot adds a player whose input the module produces itself, one per tick from tick 1', () => {
    const game = defaultGameModuleFactory(options);
    const bot = game.getDebugHandle!().spawnBot!({ behavior: 'wander', seed: 42 }, seatFreely);
    expect(bot).toMatchObject({ playerId: 'sim_bot_42_0', playerName: 'Bot 0', behavior: 'wander' });
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p2: null, [bot.playerId]: null } });
    game.reduceGameState();
    game.reduceGameState();
    expect(game.serializeRoomState()).toMatchObject({
      players: { [bot.playerId]: expect.objectContaining({ sequence: 2 }) },
    });
  });

  it('two modules with the same seed drive their bots identically', () => {
    const inputAfterTicks = () => {
      const game = defaultGameModuleFactory(options);
      game.getDebugHandle!().spawnBot!({ behavior: 'wander', seed: 7 }, seatFreely);
      for (let tick = 0; tick < 5; tick += 1) game.reduceGameState();
      return (game.serializeRoomState() as unknown as { players: Record<string, unknown> }).players['sim_bot_7_0'];
    };
    expect(inputAfterTicks()).toEqual(inputAfterTicks());
  });

  it('removeBot forgets the bot and its input and refuses a human', () => {
    const game = defaultGameModuleFactory(options);
    const handle = game.getDebugHandle!();
    const bot = handle.spawnBot!({ behavior: 'wander', seed: 42 }, seatFreely);
    game.reduceGameState();
    expect(handle.removeBot!(bot.playerId)).toEqual(bot);
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p2: null } });
    expect(() => handle.removeBot!('p1' as PlayerId)).toThrow(/not a bot spawned in this game/);
  });

  it('spawnBot claims the seat before holding the player, so a refused seat leaves the module and roster untouched', () => {
    const game = defaultGameModuleFactory(options);
    const handle = game.getDebugHandle!();
    const seated: string[] = [];
    const refuse = (bot: { playerId: string }) => {
      seated.push(bot.playerId);
      throw new DebugRequestError(`"${bot.playerId}" is already a player in this game`);
    };
    expect(() => handle.spawnBot!({ behavior: 'wander', seed: 42 }, refuse)).toThrow(DebugRequestError);
    expect(seated).toEqual(['sim_bot_42_0']);
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p2: null } });
    game.reduceGameState();
    expect(game.serializeRoomState()).toEqual({ players: { p1: null, p2: null } });
    expect(() => handle.removeBot!('sim_bot_42_0' as PlayerId)).toThrow(/not a bot spawned in this game/);
  });
});

import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, DEFAULT_BOT_SEED, SERVER_MESSAGE_TYPE } from '@evolution/shared';
import { defaultGameModuleFactory } from '../../game/game-module.js';
import { createActiveRoomFixture, parseToolJson } from '../../testing/builders.js';
import { registerBotTools } from './bots.js';

/** A started room on the real echo module, which offers the bot pair, with bob watching from a second seat. */
function echoFixture() {
  const fixture = createActiveRoomFixture({ gameFactory: defaultGameModuleFactory });
  const bob = fixture.join('bob');
  fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
  registerBotTools(fixture.mcp, fixture.context);
  const messagesTo = (playerId: string, type: string) =>
    (fixture.sent[playerId] as { type: string }[]).filter((message) => message.type === type);
  return { ...fixture, messagesTo };
}

describe('debug_spawn_bot', () => {
  it('spawns a bot the module drives, enrols it in the roster and announces it to the other players', async () => {
    const fixture = echoFixture();
    const result = await fixture.call('debug_spawn_bot', { gameId: fixture.gameId, behavior: 'wander', seed: 42 });
    expect(parseToolJson(result)).toEqual({
      playerId: 'bot_42_0',
      playerName: 'Bot 0',
      avatarIndex: 0,
      behavior: 'wander',
    });
    expect(fixture.room.allPlayerIds).toContain('bot_42_0');
    expect(fixture.room.playerNames['bot_42_0']).toBe('Bot 0');
    expect(fixture.messagesTo('bob', SERVER_MESSAGE_TYPE.playerJoined)).toContainEqual({
      type: SERVER_MESSAGE_TYPE.playerJoined,
      playerId: 'bot_42_0',
      avatarIndex: 0,
    });
    fixture.room.step(1);
    const botId = (parseToolJson(result) as { playerId: string }).playerId;
    expect(fixture.room.getSnapshot()).toMatchObject({
      players: { [botId]: expect.objectContaining({ sequence: 1 }) },
    });
    fixture.stop();
  });

  it('forks the bot from the default seed when the call names none', async () => {
    const fixture = echoFixture();
    const result = await fixture.call('debug_spawn_bot', {
      gameId: fixture.gameId,
      behavior: 'idle',
      seed: DEFAULT_BOT_SEED,
    });
    expect(parseToolJson(result)).toMatchObject({ playerId: `bot_${DEFAULT_BOT_SEED}_0`, behavior: 'idle' });
    fixture.stop();
  });

  it('hands the hunter its prey', async () => {
    const fixture = echoFixture();
    const result = await fixture.call('debug_spawn_bot', {
      gameId: fixture.gameId,
      behavior: 'hunter',
      seed: 1,
      preyPlayerId: 'alice',
    });
    expect(parseToolJson(result)).toMatchObject({ behavior: 'hunter' });
    fixture.stop();
  });

  it('refuses a strategy outside the catalogue without touching the roster', async () => {
    const fixture = echoFixture();
    const result = await fixture.call('debug_spawn_bot', { gameId: fixture.gameId, behavior: 'flee', seed: 1 });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('idle, wander, grazer, hunter') });
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    fixture.stop();
  });

  it('answers game not found for an unknown room', async () => {
    const fixture = echoFixture();
    expect((await fixture.call('debug_spawn_bot', { gameId: 'nope', behavior: 'idle', seed: 1 })).isError).toBe(true);
    fixture.stop();
  });
});

describe('debug_remove_bot', () => {
  it('removes a spawned bot from the module and the roster and announces it like a disconnect', async () => {
    const fixture = echoFixture();
    await fixture.call('debug_spawn_bot', { gameId: fixture.gameId, behavior: 'wander', seed: 42 });
    const result = await fixture.call('debug_remove_bot', { gameId: fixture.gameId, playerId: 'bot_42_0' });
    expect(parseToolJson(result)).toMatchObject({ playerId: 'bot_42_0', behavior: 'wander' });
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.room.getSnapshot()).toEqual({ players: { alice: null, bob: null } });
    expect(fixture.messagesTo('bob', SERVER_MESSAGE_TYPE.playerDisconnected)).toContainEqual({
      type: SERVER_MESSAGE_TYPE.playerDisconnected,
      playerId: 'bot_42_0',
    });
    fixture.stop();
  });

  it('refuses to remove a human player', async () => {
    const fixture = echoFixture();
    const result = await fixture.call('debug_remove_bot', { gameId: fixture.gameId, playerId: 'bob' });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('not a bot spawned in this game') });
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    fixture.stop();
  });
});

describe('bot tools without a capable module', () => {
  it.each(['debug_spawn_bot', 'debug_remove_bot'])('%s is not supported', async (tool) => {
    const fixture = createActiveRoomFixture();
    registerBotTools(fixture.mcp, fixture.context);
    const result = await fixture.call(tool, { gameId: fixture.gameId, behavior: 'idle', seed: 1, playerId: 'x' });
    expect(result.isError).toBe(true);
    fixture.stop();
  });
});

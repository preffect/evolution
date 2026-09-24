// Integration (docs/testing/tiers-and-builders.md §2): the lobby, the room, the debug bot tools and the real game
// module agree on each player's seat colour, and no two players in a room share one
// (docs/visual-style/principles-and-palette.md §2, ticket #645). Run with `./validate.sh integration`.
import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, PLAYER_PALETTE_COUNT } from '@evolution/shared';
import { evolutionModuleFactory, type EvolutionModule } from '../game/evolution-module.js';
import { registerBotTools } from '../mcp/handlers/bots.js';
import { createActiveRoomFixture, createTwoPlayerGameLobby, parseToolJson } from '../testing/builders.js';

const BOT_SEED = 7;

/** alice's started room on the real module, with the bot tools registered. */
function evolutionRoom() {
  const fixture = createActiveRoomFixture({ gameFactory: evolutionModuleFactory });
  registerBotTools(fixture.mcp, fixture.context);
  const world = (fixture.gameModule as EvolutionModule).world;
  const spawnBot = async () =>
    parseToolJson(
      await fixture.call('debug_spawn_bot', { gameId: fixture.gameId, behavior: 'idle', seed: BOT_SEED }),
    ) as { playerId: string; avatarIndex: number };
  const worldColourOf = (playerId: string) => world.players.find((player) => player.playerId === playerId)?.avatarIndex;
  return { ...fixture, spawnBot, worldColourOf };
}

function expectDistinct(colours: readonly (number | undefined)[]): void {
  expect(colours.every((colour) => colour !== undefined)).toBe(true);
  expect(new Set(colours).size).toBe(colours.length);
}

describe('seat colours are unique per room (#645)', () => {
  it('gives a bot spawned next to a human a colour of its own, in the room and in the world', async () => {
    const fixture = evolutionRoom();
    const bot = await fixture.spawnBot();
    const { avatarAssignments } = fixture.room;
    expectDistinct([avatarAssignments['alice'], avatarAssignments[bot.playerId]]);
    expect(bot.avatarIndex).toBe(avatarAssignments[bot.playerId]);
    expect(fixture.worldColourOf(bot.playerId)).toBe(bot.avatarIndex);
    expect(fixture.worldColourOf('alice')).toBe(avatarAssignments['alice']);
    fixture.stop();
  });

  it('gives a human who joins after a bot a colour neither the host nor the bot holds', async () => {
    const fixture = evolutionRoom();
    const bot = await fixture.spawnBot();
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    const { avatarAssignments } = fixture.room;
    expectDistinct([avatarAssignments['alice'], avatarAssignments[bot.playerId], avatarAssignments['bob']]);
    expect(fixture.worldColourOf('bob')).toBe(avatarAssignments['bob']);
    fixture.stop();
  });

  it('gives two bots in a row different colours', async () => {
    const fixture = evolutionRoom();
    const first = await fixture.spawnBot();
    const second = await fixture.spawnBot();
    expectDistinct([fixture.room.avatarAssignments['alice'], first.avatarIndex, second.avatarIndex]);
    fixture.stop();
  });

  it('spreads the repeats once 1 human + 7 bots hold every colour: later humans never pile onto one', async () => {
    const fixture = evolutionRoom();
    for (let bot = 1; bot < PLAYER_PALETTE_COUNT; bot += 1) await fixture.spawnBot();
    for (const human of ['bob', 'carol']) {
      fixture.handlers.onJoinGame(fixture.join(human), { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    }
    const { allPlayerIds, avatarAssignments } = fixture.room;
    const holdersOf = (colour: number | undefined) =>
      allPlayerIds.filter((playerId) => avatarAssignments[playerId] === colour).length;
    // Every colour is held once, so bob takes the lowest (alice's); carol then takes the next, not a third 0.
    expect(avatarAssignments['carol']).not.toBe(avatarAssignments['bob']);
    expect(Math.max(...allPlayerIds.map((playerId) => holdersOf(avatarAssignments[playerId])))).toBe(2);
    expect(fixture.worldColourOf('carol')).toBe(avatarAssignments['carol']);
    fixture.stop();
  });

  it('gives the humans seated before the start different colours, in seat order', () => {
    const fixture = createTwoPlayerGameLobby();
    expect(fixture.room.avatarAssignments).toEqual({ alice: 0, bob: 1 });
    fixture.room.stop();
  });
});

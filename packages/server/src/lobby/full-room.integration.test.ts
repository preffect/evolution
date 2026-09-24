// Integration (docs/testing/tiers-and-builders.md §2): a started room at `maxPlayers` humans refuses one more over
// real sockets, on the real game module (#365, the #337 ruling, docs/game-design/session.md §5). The lobby row reads
// full and the refused player gets `Game is full` and nothing else. Run with `./validate.sh integration`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, isRoomJoinable } from '@evolution/shared';
import { evolutionModuleFactory } from '../game/evolution-module.js';
import {
  closeLobbySocketHarness,
  connectTestClient,
  messageOfType,
  sendAndAwait,
  startLobbySocketHarness,
  startTestRoom,
  type LobbySocketHarness,
} from '../testing/socket-builders.js';

describe('a full started room over the wire (#365)', () => {
  let harness: LobbySocketHarness;

  beforeEach(async () => {
    harness = await startLobbySocketHarness(evolutionModuleFactory);
  });

  afterEach(async () => {
    await closeLobbySocketHarness(harness);
  });

  it('refuses one human past maxPlayers with Game is full, and seats nobody', async () => {
    const host = await connectTestClient(harness, 'host');
    const guests = [];
    for (const name of ['g1', 'g2', 'g3']) guests.push(await connectTestClient(harness, name));
    const { gameId, room } = await startTestRoom(harness, host, 'Full', guests);
    const row = harness.started.lobby.listGames().find((game) => game.gameId === gameId)!;
    expect(isRoomJoinable({ playerCount: row.players.length, maxPlayers: row.maxPlayers })).toBe(false);

    const late = await connectTestClient(harness, 'late');
    const refusal = await sendAndAwait(
      late,
      { type: CLIENT_MESSAGE_TYPE.joinGame, gameId },
      messageOfType(SERVER_MESSAGE_TYPE.error),
    );
    expect(refusal).toEqual({ type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' });
    expect(late.received.map((message) => message.type)).not.toContain(SERVER_MESSAGE_TYPE.gameState);
    expect(room.allPlayerIds).toEqual(['host', 'g1', 'g2', 'g3']);
  });
});

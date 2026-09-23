// A started room honours `maxPlayers` for late joins (#365, the #337 ruling, docs/game-design/session.md §5): humans
// hold the seats, connected or in disconnect grace; the synthetic players a debug tool adds do not.
import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, SERVER_MESSAGE_TYPE, playerId } from '@evolution/shared';
import { createActiveGameLobby, hostTestGame, sentTypesTo } from '../testing/builders.js';

const TWO_SEATS = 2;
const GAME_FULL = { type: SERVER_MESSAGE_TYPE.error, message: 'Game is full' };

/** A started two-seat room alice hosts and bob has late-joined, so it is full. */
function fullStartedRoom() {
  const fixture = createActiveGameLobby(TWO_SEATS);
  const bob = fixture.join('bob');
  const joinThisRoom = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId };
  fixture.handlers.onJoinGame(bob, joinThisRoom);
  const room = fixture.lobby.getActiveRoom(fixture.gameId)!;
  return { ...fixture, bob, joinThisRoom, room };
}

describe('lobby-manager: a started room is full at maxPlayers humans (#365)', () => {
  it('refuses a third human with Game is full, and seats nobody', () => {
    const fixture = fullStartedRoom();
    const carol = fixture.join('carol');
    fixture.handlers.onJoinGame(carol, fixture.joinThisRoom);
    expect(fixture.sent['carol']).toEqual([GAME_FULL]);
    expect(fixture.room.allPlayerIds).toEqual(['alice', 'bob']);
    expect(fixture.lobby.listGames()[0]?.players).toHaveLength(TWO_SEATS);
    fixture.room.stop();
  });

  it('keeps the refused player seated where they were (#334)', () => {
    const fixture = fullStartedRoom();
    const carol = fixture.join('carol');
    const carolsGame = hostTestGame(fixture, carol, { gameName: 'Carol' });
    fixture.handlers.onJoinGame(carol, fixture.joinThisRoom);
    const carolsRow = fixture.lobby.listGames().find((game) => game.gameId === carolsGame);
    expect(carolsRow?.players.map((player) => player.playerId)).toEqual(['carol']);
    fixture.room.stop();
  });

  it('counts a player in disconnect grace as seated, and lets them back in through a reconnect', () => {
    const fixture = fullStartedRoom();
    fixture.lobby.handleDisconnect(fixture.bob);
    const carol = fixture.join('carol');
    fixture.handlers.onJoinGame(carol, fixture.joinThisRoom);
    expect(fixture.sent['carol']).toEqual([GAME_FULL]);
    const bobAgain = fixture.join('bob');
    fixture.lobby.handleConnect(bobAgain, fixture.connections);
    expect(sentTypesTo(fixture.sent, 'bob')).toContain(SERVER_MESSAGE_TYPE.gameState);
    expect(fixture.sent['bob']).not.toContainEqual(GAME_FULL);
    fixture.room.stop();
  });

  it('lets a player who holds a seat rejoin the full room (the held seat is re-entered before the cap)', () => {
    const fixture = fullStartedRoom();
    const before = fixture.sent['bob']!.length;
    fixture.handlers.onJoinGame(fixture.bob, fixture.joinThisRoom);
    const after = fixture.sent['bob']!.slice(before);
    expect(after).toContainEqual(expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState }));
    expect(after).not.toContainEqual(GAME_FULL);
    fixture.room.stop();
  });

  it('does not count synthetic players: a room full of bots still takes its humans, and lists humans only', () => {
    const fixture = createActiveGameLobby(TWO_SEATS);
    const room = fixture.lobby.getActiveRoom(fixture.gameId)!;
    for (const bot of ['bot-1', 'bot-2', 'bot-3']) {
      room.addSyntheticPlayer({ playerId: playerId(bot), playerName: bot, avatarIndex: 0 });
    }
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice']);
    const bob = fixture.join('bob');
    fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
    expect(fixture.sent['bob']).not.toContainEqual(GAME_FULL);
    expect(fixture.lobby.listGames()[0]?.players.map((player) => player.playerId)).toEqual(['alice', 'bob']);
    room.stop();
  });
});

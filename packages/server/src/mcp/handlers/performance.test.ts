import { describe, expect, it } from 'vitest';
import { CLIENT_MESSAGE_TYPE, createTestClientPerformanceReport, createTestSessionConfig } from '@evolution/shared';
import { registerPerformanceTools } from './performance.js';
import { createTestLobby, createToolCapture, parseToolJson } from '../../testing/builders.js';

function fixtureWithOneActiveRoom() {
  const fixture = createTestLobby();
  const alice = fixture.join('alice');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'A',
    config: createTestSessionConfig({ maxPlayers: 2 }),
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const capture = createToolCapture();
  registerPerformanceTools(capture.mcp, { lobbyManager: fixture.lobby, connections: fixture.connections });
  const room = fixture.lobby.getActiveRoom(gameId)!;
  const stop = () => room.stop();
  return { ...capture, gameId, room, stop };
}

describe('debug_get_performance', () => {
  it('reports process memory in whole mebibytes and the lobby counts', async () => {
    const fixture = fixtureWithOneActiveRoom();
    const report = parseToolJson(await fixture.call('debug_get_performance')) as {
      memoryMb: Record<string, number>;
      activeRooms: number;
      pendingGames: number;
      totalConnections: number;
    };
    expect(Object.values(report.memoryMb).every(Number.isInteger)).toBe(true);
    expect(report).toMatchObject({ activeRooms: 1, pendingGames: 0, totalConnections: 1 });
    fixture.stop();
  });
});

describe('debug_get_room_performance', () => {
  it('reports every active room when no gameId is given', async () => {
    const fixture = fixtureWithOneActiveRoom();
    const rooms = parseToolJson(await fixture.call('debug_get_room_performance')) as { gameId: string }[];
    expect(rooms.map((room) => room.gameId)).toEqual([fixture.gameId]);
    expect(rooms[0]).toMatchObject({ playerCount: 1, sampleCount: 0 });
    fixture.stop();
  });

  it('#256: lists the newest client report per player beside the tick stats and the snapshot flow', async () => {
    const fixture = fixtureWithOneActiveRoom();
    const older = createTestClientPerformanceReport({ frameTimeP95Ms: 30 });
    const newest = createTestClientPerformanceReport({ frameTimeP95Ms: 11, gpuMs: 2.5 });
    fixture.room.recordClientPerformance('alice', older);
    fixture.room.recordClientPerformance('alice', newest);
    const [room] = parseToolJson(
      await fixture.call('debug_get_room_performance', { gameId: fixture.gameId }),
    ) as Record<string, unknown>[];
    expect(room).toMatchObject({ playerCount: 1, clientReports: { alice: newest } });
    expect(room).toHaveProperty('snapshotFlow.players.alice');
    expect(room).toHaveProperty('broadcastBytesPerSec');
    fixture.stop();
  });

  it('lists no client report for a room whose clients have sent none', async () => {
    const fixture = fixtureWithOneActiveRoom();
    const [room] = parseToolJson(await fixture.call('debug_get_room_performance')) as Record<string, unknown>[];
    expect(room).toMatchObject({ clientReports: {} });
    fixture.stop();
  });

  it('reports the one named room', async () => {
    const fixture = fixtureWithOneActiveRoom();
    const rooms = parseToolJson(
      await fixture.call('debug_get_room_performance', { gameId: fixture.gameId }),
    ) as unknown[];
    expect(rooms).toHaveLength(1);
    fixture.stop();
  });

  it('is an error when the named room does not exist', async () => {
    const fixture = fixtureWithOneActiveRoom();
    expect((await fixture.call('debug_get_room_performance', { gameId: 'nope' })).isError).toBe(true);
    fixture.stop();
  });

  it('says so, without an error, when there are no rooms at all', async () => {
    const empty = createTestLobby();
    const capture = createToolCapture();
    registerPerformanceTools(capture.mcp, { lobbyManager: empty.lobby, connections: empty.connections });
    const result = await capture.call('debug_get_room_performance');
    expect(result.isError).toBeUndefined();
    expect(parseToolJson(result)).toBe('No active rooms');
  });
});

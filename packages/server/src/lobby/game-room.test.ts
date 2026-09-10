import { describe, it, expect, vi, afterEach } from 'vitest';
import { TICK_INTERVAL_MS } from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import type { GameModule, RoomInitOptions } from '../game/game-module.js';
import type { Connection } from '../ws/connection.js';

function makeConnection(id: string): Connection {
  return {
    playerId: id,
    playerName: id,
    avatarIndex: 0,
    socket: { readyState: 1, send: () => {}, close: () => {}, on: () => {} } as unknown as Connection['socket'],
  };
}

function roomOptions(playerIds: string[]): RoomInitOptions {
  return {
    creatorId: playerIds[0] as PlayerId,
    playerIds: playerIds as PlayerId[],
    gameName: 'Test',
    config: { maxPlayers: 4 },
    avatarAssignments: Object.fromEntries(playerIds.map((playerId, index) => [playerId, index])),
    playerNames: {},
  };
}

function spyModule(): GameModule & { reduceCalls: () => number } {
  let reduceCalls = 0;
  const players = new Set<string>();
  return {
    submitInput: vi.fn(),
    reduceGameState: vi.fn(() => {
      reduceCalls++;
    }),
    serializeRoomState: vi.fn(() => ({ players: [...players] })),
    addPlayer: vi.fn((playerId: PlayerId) => {
      players.add(playerId);
    }),
    removePlayer: vi.fn((playerId: PlayerId) => {
      players.delete(playerId);
    }),
    free: vi.fn(),
    reduceCalls: () => reduceCalls,
  };
}

describe('game-room', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the tick loop calling reduce + serialize while started', () => {
    vi.useFakeTimers();
    const gameModule = spyModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']));
    room.start();
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 3 + 1);
    room.stop();
    expect(gameModule.reduceCalls()).toBeGreaterThanOrEqual(3);
    expect(gameModule.serializeRoomState).toHaveBeenCalled();
    expect(gameModule.free).toHaveBeenCalled();
  });

  it('stop() halts the loop', () => {
    vi.useFakeTimers();
    const gameModule = spyModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']));
    room.start();
    room.stop();
    const before = gameModule.reduceCalls();
    vi.advanceTimersByTime(1000);
    expect(gameModule.reduceCalls()).toBe(before);
  });

  it('submitInput delegates to the game module', () => {
    const gameModule = spyModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']));
    room.submitInput('p1', { jump: true });
    expect(gameModule.submitInput).toHaveBeenCalledWith('p1', { jump: true });
  });

  it('removePlayer drops the player from the module and roster', () => {
    const gameModule = spyModule();
    const room = new GameRoom(gameModule, roomOptions(['p1', 'p2']));
    room.removePlayer('p2');
    expect(gameModule.removePlayer).toHaveBeenCalledWith('p2');
    expect(room.allPlayerIds).not.toContain('p2');
    expect(room.disconnectedPlayers.has('p2')).toBe(true);
  });

  it('addLatePlayer registers the player and adds them to the module', () => {
    const gameModule = spyModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']));
    const late = makeConnection('p3');
    room.addLatePlayer(late, 'g1');
    expect(gameModule.addPlayer).toHaveBeenCalledWith('p3', 0, 'p3');
    expect(room.allPlayerIds).toContain('p3');
    expect(room.playerConnections.has('p3')).toBe(true);
  });

  it('copies the roster so the caller cannot mutate the room from outside', () => {
    const options = roomOptions(['p1']);
    const room = new GameRoom(spyModule(), options);
    options.playerIds.push('p9' as PlayerId);
    expect(room.allPlayerIds).toEqual(['p1']);
  });
});

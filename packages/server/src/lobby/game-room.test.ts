import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_BALANCE,
  MAX_TICKS_PER_ADVANCE,
  SERVER_MESSAGE_TYPE,
  TICK_INTERVAL_MS,
  createTestGameInput,
  createTestSessionConfig,
  createTestSnapshot,
} from '@evolution/shared';
import type { PlayerId } from '@evolution/shared';
import { GameRoom } from './game-room.js';
import type { FullGameState, RoomInitOptions } from '../game/game-module.js';
import {
  createDebugCapableGameModule,
  createManualRoomTiming,
  createSpyGameModule,
  createTestConnection,
} from '../testing/builders.js';

function roomOptions(playerIds: string[]): RoomInitOptions {
  return {
    creatorId: playerIds[0] as PlayerId,
    playerIds: playerIds as PlayerId[],
    gameName: 'Test',
    config: createTestSessionConfig({ maxPlayers: 4 }),
    avatarAssignments: Object.fromEntries(playerIds.map((playerId, index) => [playerId, index])),
    playerNames: {},
  };
}

/** A started room under manual timing; `advance(n)` moves the clock n intervals and fires the ticker once. */
function startedRoom(playerIds = ['p1']) {
  const gameModule = createSpyGameModule();
  const timing = createManualRoomTiming();
  const room = new GameRoom(gameModule, roomOptions(playerIds), timing);
  room.start();
  const advance = (intervals: number) => {
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * intervals);
    timing.ticker.fire();
  };
  const reduceCalls = () => vi.mocked(gameModule.reduceGameState).mock.calls.length;
  return { gameModule, timing, room, advance, reduceCalls };
}

describe('game-room: the fixed-step loop', () => {
  it('steps exactly the ticks the clock owes on each ticker fire', () => {
    const fixture = startedRoom();
    fixture.advance(3);
    expect(fixture.reduceCalls()).toBe(3);
    expect(fixture.room.getTickCount()).toBe(3);
    fixture.advance(0.5);
    expect(fixture.reduceCalls()).toBe(3);
    fixture.advance(0.5);
    expect(fixture.reduceCalls()).toBe(4);
    expect(fixture.gameModule.serializeRoomState).toHaveBeenCalledTimes(4);
  });

  it('caps catch-up after a stall and reports the dropped ticks', () => {
    const fixture = startedRoom();
    fixture.advance(MAX_TICKS_PER_ADVANCE + 4);
    expect(fixture.reduceCalls()).toBe(MAX_TICKS_PER_ADVANCE);
    expect(fixture.room.performanceTracker.getStats().droppedTicks).toBe(4);
  });

  it('measures tick time with the injected clock', () => {
    const gameModule = createSpyGameModule();
    const timing = createManualRoomTiming();
    vi.mocked(gameModule.reduceGameState).mockImplementation(() => timing.clock.advanceMilliseconds(2));
    const room = new GameRoom(gameModule, roomOptions(['p1']), timing);
    room.start();
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
    expect(room.performanceTracker.getStats().tickPeakMs).toBe(2);
  });

  it('start() discards the time that passed since construction instead of bursting', () => {
    const gameModule = createSpyGameModule();
    const timing = createManualRoomTiming();
    const room = new GameRoom(gameModule, roomOptions(['p1']), timing);
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * (MAX_TICKS_PER_ADVANCE + 4));
    room.start();
    timing.ticker.fire();
    expect(gameModule.reduceGameState).not.toHaveBeenCalled();
    expect(room.performanceTracker.getStats().droppedTicks).toBe(0);
    timing.clock.advanceMilliseconds(TICK_INTERVAL_MS);
    timing.ticker.fire();
    expect(gameModule.reduceGameState).toHaveBeenCalledTimes(1);
  });

  it('start() is idempotent and stop() halts the loop and frees the module', () => {
    const fixture = startedRoom();
    fixture.room.start();
    fixture.room.stop();
    fixture.advance(3);
    expect(fixture.reduceCalls()).toBe(0);
    expect(fixture.timing.ticker.isStarted()).toBe(false);
    expect(fixture.gameModule.free).toHaveBeenCalledTimes(1);
  });
});

describe('game-room: pause, step and resume', () => {
  it('ignores ticker fires while paused', () => {
    const fixture = startedRoom();
    fixture.room.pause();
    fixture.advance(3);
    expect(fixture.room.isPaused()).toBe(true);
    expect(fixture.reduceCalls()).toBe(0);
  });

  it('step() pauses a running room and advances exactly the requested ticks, broadcasting each', () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.start();
    room.step(2);
    expect(room.isPaused()).toBe(true);
    expect(room.getTickCount()).toBe(2);
    expect(sent['p1']!.map((message) => (message as { type: string }).type)).toEqual([
      SERVER_MESSAGE_TYPE.gameSnapshot,
      SERVER_MESSAGE_TYPE.gameSnapshot,
    ]);
  });

  it('resume() discards the time that passed while paused instead of catching up', () => {
    const fixture = startedRoom();
    fixture.room.pause();
    fixture.timing.clock.advanceMilliseconds(TICK_INTERVAL_MS * 3);
    fixture.room.resume();
    expect(fixture.room.isPaused()).toBe(false);
    fixture.timing.ticker.fire();
    expect(fixture.reduceCalls()).toBe(0);
    expect(fixture.room.performanceTracker.getStats().droppedTicks).toBe(0);
    fixture.advance(1);
    expect(fixture.reduceCalls()).toBe(1);
  });
});

describe('game-room: membership and delegation', () => {
  it('submitInput delegates to the game module', () => {
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    const input = createTestGameInput({ shouldSprint: true });
    room.submitInput('p1', input);
    expect(gameModule.submitInput).toHaveBeenCalledWith('p1', input);
  });

  it('removePlayer drops the player from the module and roster', () => {
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1', 'p2']), createManualRoomTiming());
    room.removePlayer('p2');
    expect(gameModule.removePlayer).toHaveBeenCalledWith('p2');
    expect(room.allPlayerIds).not.toContain('p2');
    expect(room.disconnectedPlayers.has('p2')).toBe(true);
  });

  it('addLatePlayer registers the player and adds them to the module', () => {
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    const late = createTestConnection({ playerId: 'p3' });
    room.addLatePlayer(late, 'g1');
    expect(gameModule.addPlayer).toHaveBeenCalledWith('p3', 0, 'p3');
    expect(room.allPlayerIds).toContain('p3');
    expect(room.playerConnections.has('p3')).toBe(true);
  });

  it('addSyntheticPlayer enrols a bot the module already holds and announces it to everyone else', () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.addSyntheticPlayer({ playerId: 'bot_1_0' as PlayerId, playerName: 'Bot 0', avatarIndex: 3 });
    expect(gameModule.addPlayer).not.toHaveBeenCalled();
    expect(room.allPlayerIds).toEqual(['p1', 'bot_1_0']);
    expect(room.playerNames['bot_1_0']).toBe('Bot 0');
    expect(room.avatarAssignments['bot_1_0']).toBe(3);
    expect(room.playerConnections.has('bot_1_0')).toBe(false);
    expect(sent['p1']).toEqual([{ type: SERVER_MESSAGE_TYPE.playerJoined, playerId: 'bot_1_0', avatarIndex: 3 }]);
  });

  it('removeSyntheticPlayer drops the bot from the roster and announces it like a disconnect', () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.addSyntheticPlayer({ playerId: 'bot_1_0' as PlayerId, playerName: 'Bot 0', avatarIndex: 3 });
    room.removeSyntheticPlayer('bot_1_0' as PlayerId);
    expect(gameModule.removePlayer).not.toHaveBeenCalled();
    expect(room.allPlayerIds).toEqual(['p1']);
    expect(room.disconnectedPlayers.has('bot_1_0')).toBe(false);
    expect(sent['p1']).toContainEqual({ type: SERVER_MESSAGE_TYPE.playerDisconnected, playerId: 'bot_1_0' });
  });

  it('broadcastBalanceUpdated sends every connection the balance of the full state', () => {
    const sent: Record<string, unknown[]> = {};
    const room = new GameRoom(createSpyGameModule(), roomOptions(['p1']), createManualRoomTiming());
    room.addPlayer(createTestConnection({ playerId: 'p1', sent }));
    room.broadcastBalanceUpdated();
    expect(sent['p1']).toEqual([{ type: SERVER_MESSAGE_TYPE.balanceUpdated, balance: DEFAULT_BALANCE }]);
  });

  it("getFullState returns the module's serializeFullState verbatim", () => {
    const gameModule = createSpyGameModule();
    const fullState: FullGameState = { snapshot: createTestSnapshot({ tick: 7 }), balance: DEFAULT_BALANCE };
    vi.mocked(gameModule.serializeFullState).mockReturnValue(fullState);
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    expect(room.getFullState()).toBe(fullState);
    expect(gameModule.serializeRoomState).not.toHaveBeenCalled();
  });

  it("addLatePlayer sends the joiner a game_state carrying the module's full snapshot and balance", () => {
    const sent: Record<string, unknown[]> = {};
    const gameModule = createSpyGameModule();
    const fullState: FullGameState = { snapshot: createTestSnapshot({ tick: 7 }), balance: DEFAULT_BALANCE };
    vi.mocked(gameModule.serializeFullState).mockReturnValue(fullState);
    const room = new GameRoom(gameModule, roomOptions(['p1']), createManualRoomTiming());
    room.addLatePlayer(createTestConnection({ playerId: 'p3', sent }), 'g1');
    expect(sent['p3']).toEqual([
      expect.objectContaining({ type: SERVER_MESSAGE_TYPE.gameState, gameId: 'g1', playerId: 'p3', ...fullState }),
    ]);
  });

  it('copies the roster so the caller cannot mutate the room from outside', () => {
    const options = roomOptions(['p1']);
    const room = new GameRoom(createSpyGameModule(), options, createManualRoomTiming());
    options.playerIds.push('p9' as PlayerId);
    expect(room.allPlayerIds).toEqual(['p1']);
  });

  it('exposes the debug handle of a capable module and nothing for a plain one', () => {
    const handle = { computeStateHash: vi.fn() };
    const capable = new GameRoom(createDebugCapableGameModule(handle), roomOptions(['p1']), createManualRoomTiming());
    const plain = new GameRoom(createSpyGameModule(), roomOptions(['p1']), createManualRoomTiming());
    expect(capable.getDebugHandle()).toBe(handle);
    expect(plain.getDebugHandle()).toBeUndefined();
  });
});

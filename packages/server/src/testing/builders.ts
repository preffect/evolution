// Test builders (docs/TESTING.md §4): every server test constructs its fixtures here, so a
// shape change is one edit. Builder defaults are the only tolerated inline test numbers.
import { vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';
import { CLIENT_MESSAGE_TYPE, ManualClock } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import type { GameModule, GameModuleFactory } from '../game/game-module.js';
import type { SimulationDebugHandle } from '../game/debug/simulation-debug-handle.js';
import type { DebugContext } from '../mcp/debug-context.js';
import { LobbyManager } from '../lobby/lobby-manager.js';
import type { RoomTiming, RoomTimingFactory } from '../lobby/room-timing.js';
import { ManualTicker } from '../lobby/ticker.js';

/** Messages a fake socket "sent", decoded, keyed by player id. */
export type SentLog = Record<string, unknown[]>;

export interface TestConnectionOptions {
  playerId: string;
  playerName?: string;
  avatarIndex?: number;
  readyState?: number;
  /** When given, every frame the socket sends is decoded and appended under `playerId`. */
  sent?: SentLog;
}

/** A `Connection` over a fake socket that records what it sends instead of writing to the wire. */
export function createTestConnection(options: TestConnectionOptions): Connection {
  const { playerId, playerName = playerId, avatarIndex = 0, readyState = WebSocket.OPEN, sent } = options;
  const log: unknown[] = [];
  if (sent) sent[playerId] = log;
  return {
    playerId,
    playerName,
    avatarIndex,
    socket: {
      readyState,
      send: (data: string) => log.push(JSON.parse(data)),
      close: () => {},
      on: () => {},
    } as unknown as Connection['socket'],
  };
}

/** A `GameModule` whose every hook is a spy; `players` mirrors add/remove so snapshots are inspectable. */
export function createSpyGameModule(): GameModule & { players: Set<string> } {
  const players = new Set<string>();
  return {
    players,
    submitInput: vi.fn(),
    reduceGameState: vi.fn(),
    serializeRoomState: vi.fn(() => ({ players: [...players] })),
    addPlayer: vi.fn((playerId: string) => {
      players.add(playerId);
    }),
    removePlayer: vi.fn((playerId: string) => {
      players.delete(playerId);
    }),
    free: vi.fn(),
  };
}

export const spyGameModuleFactory: GameModuleFactory = () => createSpyGameModule();

/** A spy module that also offers `handle` to the debug tools (the "supported" path of every game-specific tool). */
export function createDebugCapableGameModule(handle: SimulationDebugHandle): GameModule & { players: Set<string> } {
  return { ...createSpyGameModule(), getDebugHandle: () => handle };
}

/** A room timing under test control: a `ManualClock` and a `ManualTicker` the test advances and fires. */
export interface ManualRoomTiming extends RoomTiming {
  readonly clock: ManualClock;
  readonly ticker: ManualTicker;
}

export function createManualRoomTiming(): ManualRoomTiming {
  return { clock: new ManualClock(), ticker: new ManualTicker() };
}

export interface TestLobbyOptions {
  gameFactory?: GameModuleFactory;
  createRoomTiming?: RoomTimingFactory;
}

/** A lobby with its connection registry and handlers, plus a log of everything sent to each player. */
export function createTestLobby(options: TestLobbyOptions = {}) {
  const { gameFactory = spyGameModuleFactory, createRoomTiming = createManualRoomTiming } = options;
  const connections = new Map<string, Connection>();
  const sent: SentLog = {};
  const lobby = new LobbyManager(gameFactory, createRoomTiming);
  const handlers = lobby.createHandlers(connections);
  const join = (playerId: string, playerName = playerId): Connection => {
    const connection = createTestConnection({ playerId, playerName, sent });
    connections.set(playerId, connection);
    return connection;
  };
  return { lobby, handlers, connections, sent, join };
}

export function createTestDebugContext(overrides: Partial<DebugContext> = {}): DebugContext & { sent: SentLog } {
  const { lobby, connections, sent } = createTestLobby();
  return { lobbyManager: lobby, connections, sent, ...overrides };
}

/** A started room reachable through a debug context: the fixture every game-specific tool test begins from. */
export function createActiveRoomFixture(options: TestLobbyOptions = {}) {
  const fixture = createTestLobby(options);
  const alice = fixture.join('alice');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'A',
    config: { maxPlayers: 2 },
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const context: DebugContext = { lobbyManager: fixture.lobby, connections: fixture.connections };
  const room = fixture.lobby.getActiveRoom(gameId)!;
  const stop = () => room.stop();
  return { ...fixture, ...createToolCapture(), context, gameId, room, stop };
}

type ToolCallback = (input: Record<string, unknown>) => CallToolResult | Promise<CallToolResult>;

/**
 * A fake `McpServer` that records `tool()` registrations so a test can invoke a debug tool by
 * name without a transport. The SDK's overloads are collapsed: the callback is always last.
 */
export function createToolCapture(): {
  mcp: McpServer;
  call: (name: string, input?: Record<string, unknown>) => Promise<CallToolResult>;
} {
  const tools = new Map<string, ToolCallback>();
  const mcp = {
    tool: (name: string, ...rest: unknown[]) => {
      tools.set(name, rest[rest.length - 1] as ToolCallback);
    },
  } as unknown as McpServer;
  return {
    mcp,
    call: async (name, input = {}) => {
      const callback = tools.get(name);
      if (!callback) throw new Error(`tool ${name} was not registered`);
      return callback(input);
    },
  };
}

/** The decoded JSON of a text tool result. */
export function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content;
  if (!first || first.type !== 'text') throw new Error('tool result has no text block');
  return JSON.parse(first.text);
}

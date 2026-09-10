// Test builders (docs/TESTING.md §4): every server test constructs its fixtures here, so a
// shape change is one edit. Builder defaults are the only tolerated inline test numbers.
import { vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { CLIENT_MESSAGE_TYPE, DEFAULT_BALANCE, ManualClock, createTestSessionConfig } from '@evolution/shared';
import type { GameSnapshot } from '@evolution/shared';
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
    // The spy echoes its roster, not a world: the cast is the echo module's own (game-module.ts).
    serializeRoomState: vi.fn(() => ({ players: [...players] }) as unknown as GameSnapshot),
    serializeFullState: vi.fn(() => ({
      snapshot: { players: [...players] } as unknown as GameSnapshot,
      balance: DEFAULT_BALANCE,
    })),
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
    config: createTestSessionConfig({ maxPlayers: 2 }),
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const context: DebugContext = { lobbyManager: fixture.lobby, connections: fixture.connections };
  const room = fixture.lobby.getActiveRoom(gameId)!;
  const stop = () => room.stop();
  return { ...fixture, ...createToolCapture(), context, gameId, room, stop };
}

type ToolCallback = (input: Record<string, unknown>) => CallToolResult | Promise<CallToolResult>;

/** A registered tool: its argument schema (when it declared one) and its callback. */
interface CapturedTool {
  readonly schema?: z.ZodRawShape;
  readonly callback: ToolCallback;
}

/** What the SDK answers when the arguments fail the tool's schema, so a test sees the same refusal a client would. */
function invalidArgumentsResult(name: string, error: z.ZodError): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: `Invalid arguments for tool ${name}: ${error.message}` }] };
}

/**
 * A fake `McpServer` that records `tool()` registrations so a test can invoke a debug tool by
 * name without a transport. Like the SDK, it parses the input against the tool's schema before
 * calling back (defaults filled, transforms applied, a bad argument answered as an error result);
 * the overloads are collapsed: `(name, description, callback)` or `(name, description, schema, callback)`.
 */
export function createToolCapture(): {
  mcp: McpServer;
  call: (name: string, input?: Record<string, unknown>) => Promise<CallToolResult>;
} {
  const tools = new Map<string, CapturedTool>();
  const mcp = {
    tool: (name: string, ...rest: unknown[]) => {
      const callback = rest[rest.length - 1] as ToolCallback;
      const schema = rest.length === 3 ? (rest[1] as z.ZodRawShape) : undefined;
      tools.set(name, { schema, callback });
    },
  } as unknown as McpServer;
  return {
    mcp,
    call: async (name, input = {}) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`tool ${name} was not registered`);
      if (tool.schema === undefined) return tool.callback(input);
      const parsed = z.object(tool.schema).safeParse(input);
      return parsed.success ? tool.callback(parsed.data) : invalidArgumentsResult(name, parsed.error);
    },
  };
}

/** The decoded JSON of a text tool result. */
export function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content;
  if (!first || first.type !== 'text') throw new Error('tool result has no text block');
  return JSON.parse(first.text);
}

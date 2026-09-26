// Test builders (docs/testing/tiers-and-builders.md §4): every server test constructs its fixtures here, so a
// shape change is one edit. Builder defaults are the only tolerated inline test numbers.
import { vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { CLIENT_MESSAGE_TYPE, DEFAULT_BALANCE, ManualClock, createTestSessionConfig, gameId } from '@evolution/shared';
import type { GameSnapshot, PlayerId } from '@evolution/shared';
import type { Connection } from '../ws/connection.js';
import type { GameModuleFactory, RoomGameModule, RoomInitOptions } from '../game/game-module.js';
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
  /** Unsent bytes on the socket: what the room's backpressure reads (#266, docs/architecture/wire-contract.md §4). */
  bufferedAmount?: number;
  /** When given, every frame the socket sends is decoded and appended under `playerId`. */
  sent?: SentLog;
}

/** A `Connection` over a fake socket that records what it sends instead of writing to the wire. */
export function createTestConnection(options: TestConnectionOptions): Connection {
  const {
    playerId,
    playerName = playerId,
    avatarIndex = 0,
    readyState = WebSocket.OPEN,
    bufferedAmount = 0,
    sent,
  } = options;
  const log: unknown[] = [];
  if (sent) sent[playerId] = log;
  return {
    playerId,
    playerName,
    avatarIndex,
    socket: {
      readyState,
      bufferedAmount,
      send: (data: string) => log.push(JSON.parse(data)),
      close: () => {},
      on: () => {},
    } as unknown as Connection['socket'],
  };
}

/** Moves a test connection's unsent bytes, the way a real socket drains or backs up (#266). */
export function setBufferedAmount(connection: Connection, bytes: number): void {
  (connection.socket as unknown as { bufferedAmount: number }).bufferedAmount = bytes;
}

/** What a room is born with (docs/architecture/wire-contract.md §4): the roster in join order, avatars by index, a default config. */
export function createTestRoomInitOptions(
  playerIds: readonly string[],
  overrides: Partial<RoomInitOptions> = {},
): RoomInitOptions {
  return {
    gameId: gameId('g1'),
    creatorId: playerIds[0] as PlayerId,
    playerIds: playerIds as PlayerId[],
    gameName: 'Test',
    config: createTestSessionConfig({ maxPlayers: 4 }),
    avatarAssignments: Object.fromEntries(playerIds.map((playerId, index) => [playerId, index])),
    playerNames: Object.fromEntries(playerIds.map((playerId) => [playerId, playerId])),
    ...overrides,
  };
}

/** A `GameModule` whose every hook is a spy; `players` mirrors add/remove so snapshots are inspectable. */
export function createSpyGameModule(): RoomGameModule & { players: Set<string> } {
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

/** A spy module whose snapshots carry a tick, one per broadcast: what a client acknowledges and flow control reads. */
export function createTickingGameModule(): RoomGameModule & { players: Set<string> } {
  const module = createSpyGameModule();
  let tick = 0;
  module.serializeRoomState = vi.fn(() => {
    tick += 1;
    return { tick } as unknown as GameSnapshot;
  });
  module.serializeFullState = vi.fn(() => ({
    snapshot: { tick } as unknown as GameSnapshot,
    balance: DEFAULT_BALANCE,
  }));
  return module;
}

/** A spy module that also offers `handle` to the debug tools (the "supported" path of every game-specific tool). */
export function createDebugCapableGameModule(handle: SimulationDebugHandle): RoomGameModule & { players: Set<string> } {
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

export type TestLobby = ReturnType<typeof createTestLobby>;

/** The message types a fake socket sent, in order. */
export function sentTypesTo(sent: SentLog, playerId: string): string[] {
  return (sent[playerId] as { type: string }[]).map((message) => message.type);
}

/** `host` creates a game named `gameName` (and starts it when `isStarted`); returns its id. */
export function hostTestGame(
  fixture: TestLobby,
  host: Connection,
  {
    gameName = 'G',
    maxPlayers = 4,
    isStarted = false,
  }: { gameName?: string; maxPlayers?: number; isStarted?: boolean },
): string {
  const config = createTestSessionConfig({ maxPlayers });
  fixture.handlers.onCreateGame(host, { type: CLIENT_MESSAGE_TYPE.createGame, gameName, config });
  const hostedGameId = fixture.lobby.listGames().find((game) => game.gameName === gameName)!.gameId;
  if (isStarted) fixture.handlers.onStartGame(host, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: hostedGameId });
  return hostedGameId;
}

/** A lobby where alice created a pending game. */
export function createPendingGameLobby(maxPlayers = 4) {
  const fixture = createTestLobby();
  const alice = fixture.join('alice', 'Alice');
  fixture.handlers.onJoinLobby(alice, { type: CLIENT_MESSAGE_TYPE.joinLobby, playerName: 'Alice', avatarIndex: 0 });
  const gameId = hostTestGame(fixture, alice, { maxPlayers });
  return { ...fixture, alice, gameId };
}

/** A lobby where alice created and started a game. */
export function createActiveGameLobby(maxPlayers?: number) {
  const fixture = createPendingGameLobby(maxPlayers);
  fixture.handlers.onStartGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: fixture.gameId });
  return fixture;
}

/** A started game alice hosts and bob plays in, with the `leave_game` and `join_game` frames for it. */
export function createTwoPlayerGameLobby() {
  const fixture = createPendingGameLobby();
  const bob = fixture.join('bob');
  fixture.handlers.onJoinGame(bob, { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId });
  fixture.handlers.onStartGame(fixture.alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId: fixture.gameId });
  const leave = { type: CLIENT_MESSAGE_TYPE.leaveGame, gameId: fixture.gameId };
  const rejoin = { type: CLIENT_MESSAGE_TYPE.joinGame, gameId: fixture.gameId };
  return { ...fixture, bob, leave, rejoin, room: fixture.lobby.getActiveRoom(fixture.gameId)! };
}

export function createTestDebugContext(overrides: Partial<DebugContext> = {}): DebugContext & { sent: SentLog } {
  const { lobby, connections, sent } = createTestLobby();
  return { lobbyManager: lobby, connections, sent, ...overrides };
}

/**
 * A started room reachable through a debug context: the fixture every game-specific tool test begins from. It also
 * answers the room's `gameModule`, the only way to read a broadcast now that the room keeps no accessor for one.
 */
export function createActiveRoomFixture(options: TestLobbyOptions = {}) {
  let startedModule: RoomGameModule | undefined;
  const gameFactory: GameModuleFactory = (roomOptions) =>
    (startedModule = (options.gameFactory ?? spyGameModuleFactory)(roomOptions));
  const fixture = createTestLobby({ ...options, gameFactory });
  const alice = fixture.join('alice');
  fixture.handlers.onCreateGame(alice, {
    type: CLIENT_MESSAGE_TYPE.createGame,
    gameName: 'A',
    // Room for the humans the tool tests seat past alice (#365: a started room refuses a join at maxPlayers).
    config: createTestSessionConfig({ maxPlayers: 4 }),
  });
  const gameId = fixture.lobby.listGames()[0]!.gameId;
  fixture.handlers.onStartGame(alice, { type: CLIENT_MESSAGE_TYPE.startGame, gameId });
  const context: DebugContext = { lobbyManager: fixture.lobby, connections: fixture.connections };
  const room = fixture.lobby.getActiveRoom(gameId)!;
  const stop = () => room.stop();
  return { ...fixture, ...createToolCapture(), context, gameId, room, gameModule: startedModule!, stop };
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

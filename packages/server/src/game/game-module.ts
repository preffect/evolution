import { DEFAULT_BALANCE } from '@evolution/shared';
import type { BalanceConfig, GameId, GameInput, GameSessionConfig, GameSnapshot, PlayerId } from '@evolution/shared';
import type { SimulationDebugHandle } from './debug/simulation-debug-handle.js';
import { echoBotBinding } from './bots/bot-binding.js';
import { createInProcessBotRoster, type InProcessBotRoster } from './bots/in-process-bots.js';

/**
 * Per-room game logic. ONE instance per active GameRoom. This is THE place the
 * game plugs in. The default impl below is a working trust-client "echo" game so
 * the template runs end-to-end before any real game is defined.
 *
 * The room always drives a `GameModule` over the wire types; the type parameters exist for the
 * gameplay testing framework, whose adapters run stand-in modules (the echo, a toy world) that
 * speak their own snapshot shape (docs/testing/scenario-runner.md §8). `ViewerKey` names the members `viewerState`
 * declares; the broadcast is typed without them, so the module never builds them for it (#399).
 */
export interface GameModule<
  Input = GameInput,
  Snapshot = GameSnapshot,
  ViewerKey extends keyof Snapshot & string = never,
> {
  /** Store/merge the latest input for a player (called from the message router). */
  submitInput(playerId: PlayerId, payload: Input): void;
  /** Advance the world one tick (called at TICK_HZ by GameRoom). */
  reduceGameState(): void;
  /**
   * Produce the broadcast snapshot for this tick (the delta since the previous broadcast), without the members
   * `viewerState` declares: each viewer's `serialize` builds those from the world.
   */
  serializeRoomState(): ViewerlessSnapshot<Snapshot, ViewerKey>;
  /**
   * What a joining, late-joining or reconnecting client receives in `game_state`
   * (docs/architecture/wire-contract.md §4): the full snapshot plus the balance the module simulates with.
   * Required, unlike the debug capabilities: a delta snapshot or a default balance sent to a
   * joining client is a silent wire-contract bug, so no fallback exists. The echo returns its
   * broadcast snapshot and `DEFAULT_BALANCE`.
   */
  serializeFullState(): FullGameState<Snapshot>;
  /**
   * What each connection is sent for itself alone (docs/architecture/wire-contract.md §4.1): declared snapshot members
   * and one viewer's values for them, appended after a single shared stringify per broadcast and set on each
   * `game_state`. Optional: without it every connection receives the snapshot as is, serialised once.
   */
  readonly viewerState?: ViewerState<Snapshot, ViewerKey>;
  /** A player joined mid-game. */
  addPlayer(playerId: PlayerId, avatarIndex: number, playerName: string): void;
  /** A player left. Drop their entity so it stops appearing in snapshots. */
  removePlayer(playerId: PlayerId): void;
  /** Free any resources on room teardown. */
  free?(): void;
  /**
   * The debug capabilities this module offers the MCP tools (docs/architecture/debug-mcp.md §8). A module
   * without one answers every game-specific tool with "not supported by this game module".
   */
  getDebugHandle?(): SimulationDebugHandle;
}

/** A snapshot without the members its viewers are sent apart: the whole snapshot for a module that declares none. */
export type ViewerlessSnapshot<Snapshot, ViewerKey extends keyof Snapshot & string> = [ViewerKey] extends [never]
  ? Snapshot
  : Omit<Snapshot, ViewerKey>;

/** The members a module over the wire types may declare per viewer: any but the `tick` the room's flow control reads. */
export type RoomViewerKey = Exclude<keyof GameSnapshot, 'tick'>;

/** What the room drives: a module over the wire types, whatever members it declares per viewer (the lobby names none). */
export type RoomGameModule = GameModule<GameInput, GameSnapshot, RoomViewerKey>;

/** What the room's `serializeRoomState` answers, as the room sees it. */
export type RoomBroadcastSnapshot = ViewerlessSnapshot<GameSnapshot, RoomViewerKey>;

/**
 * The snapshot members each connection is sent for itself alone (docs/architecture/wire-contract.md §4): the room
 * stringifies the broadcast once, which carries none of `keys`, then appends every viewer's own values for them in
 * this order (`lobby/viewer-snapshots.ts`). The module declares the members; the lobby names none. This is what the
 * lobby reads; a module implements `ViewerStateSerializer`, whose answers must carry every declared member.
 */
export interface ViewerState<Snapshot, ViewerKey extends keyof Snapshot & string> {
  /** The per-viewer members, in the order the room appends them; the broadcast leaves them out. */
  readonly keys: readonly ViewerKey[];
  /** One viewer's values for `keys` in a `game_snapshot`; `broadcast` is what this broadcast's `serializeRoomState` answered. */
  serialize(
    viewerPlayerId: PlayerId,
    broadcast: ViewerlessSnapshot<Snapshot, ViewerKey>,
  ): Partial<Pick<Snapshot, ViewerKey>>;
  /**
   * One viewer's values for `keys` in a `game_state`; `snapshot` is `serializeFullState`'s. Whatever that viewer's
   * later `serialize` answers are relative to (a per-viewer delta) restarts from this one.
   */
  serializeFull(viewerPlayerId: PlayerId, snapshot: Snapshot): Partial<Pick<Snapshot, ViewerKey>>;
  /**
   * Optional: one member's JSON, written exactly as `JSON.stringify(value)` would, so a module can reuse the strings of
   * items its viewers share (#406). Without it the room stringifies each member itself.
   */
  memberJson?(key: string, value: unknown): string;
}

/**
 * A module's viewer state: `Keys` are the members it declares, and every answer carries each of them. Not declared as
 * extending `ViewerState`, since TypeScript cannot relate `Pick` over a generic key set to `Partial`; every concrete
 * instance is assignable to it, which is where the room takes it.
 */
export interface ViewerStateSerializer<Snapshot, Keys extends keyof Snapshot & string> {
  readonly keys: readonly Keys[];
  serialize(viewerPlayerId: PlayerId, broadcast: ViewerlessSnapshot<Snapshot, Keys>): Pick<Snapshot, Keys>;
  serializeFull(viewerPlayerId: PlayerId, snapshot: Snapshot): Pick<Snapshot, Keys>;
  memberJson?(key: string, value: unknown): string;
}

/** The `game_state` payload: a full snapshot and the live balance the client must predict with. */
export interface FullGameState<Snapshot = GameSnapshot> {
  snapshot: Snapshot;
  balance: BalanceConfig;
}

/** `{ players: { [playerId]: lastInput | null } }`: what the echo module echoes instead of a world. */
export interface EchoSnapshot {
  readonly players: Readonly<Record<string, GameInput | null>>;
}

/** Everything a room is born with: the roster the lobby gathered plus the resolved session config. */
export interface RoomInitOptions {
  /** The room's own id: what its `game_state` messages are addressed with (docs/architecture/wire-contract.md §4). */
  gameId: GameId;
  creatorId: PlayerId;
  playerIds: PlayerId[];
  gameName: string;
  config: GameSessionConfig;
  avatarAssignments: Record<string, number>;
  playerNames: Record<string, string>;
}

/** Factory the LobbyManager uses to create a room's game logic. */
export type GameModuleFactory = (options: RoomInitOptions) => RoomGameModule;

/**
 * DEFAULT PLACEHOLDER (TODO(game)): trust-client echo. Stores the latest input per player and
 * echoes `{ players: { [playerId]: lastInput } }` as the snapshot. Replace in the
 * init step with the real game logic. Its one debug capability is the in-process bot pair
 * (`spawnBot` / `removeBot`, docs/architecture/debug-mcp.md §8): a bot is a player whose input the module
 * produces itself at the start of each tick, from the snapshot of the tick before, stamped with
 * that tick as its sequence (inputs start at tick 1, docs/testing/scenario-runner.md §8.1).
 */
export function createEchoModule(options: RoomInitOptions): GameModule<GameInput, EchoSnapshot> {
  const latestInputByPlayer = new Map<string, GameInput>();
  const players = new Set<string>(options.playerIds);
  const bots = createInProcessBotRoster(echoBotBinding);
  let tick = 0;
  const serializeRoomState = (): EchoSnapshot => {
    const inputs: Record<string, GameInput | null> = {};
    for (const playerId of players) inputs[playerId] = latestInputByPlayer.get(playerId) ?? null;
    return { players: inputs };
  };
  const module: GameModule<GameInput, EchoSnapshot> = {
    submitInput: (playerId, payload) => {
      latestInputByPlayer.set(playerId, payload);
    },
    reduceGameState: () => {
      tick += 1; // TODO(game): #152 advances the world one tick here; the echo has no world to step
      bots.driveTick(serializeRoomState(), tick, module.submitInput);
    },
    serializeRoomState,
    serializeFullState: () => ({ snapshot: serializeRoomState(), balance: DEFAULT_BALANCE }),
    addPlayer: (playerId) => {
      players.add(playerId);
    },
    removePlayer: (playerId) => {
      players.delete(playerId);
      latestInputByPlayer.delete(playerId);
    },
    getDebugHandle: () => echoBotHandle(module, bots),
  };
  return module;
}

/**
 * The echo's one debug capability: the bot pair. The roster owns the pilot, the module the
 * player, and the seat is claimed (`seat`) before either holds anything the room did not accept.
 */
function echoBotHandle(
  module: GameModule<GameInput, EchoSnapshot>,
  bots: InProcessBotRoster<GameInput, unknown>,
): SimulationDebugHandle {
  return {
    spawnBot: (request, seat) => {
      const bot = bots.spawn(request);
      try {
        seat(bot);
      } catch (error) {
        bots.remove(bot.playerId);
        throw error;
      }
      module.addPlayer(bot.playerId, bot.avatarIndex, bot.playerName);
      return bot;
    },
    removeBot: (playerId) => {
      const bot = bots.remove(playerId);
      module.removePlayer(playerId);
      return bot;
    },
  };
}

/**
 * TODO(game): #98 deletes this factory with the echo. The echo has no world, so its snapshot is not
 * a `GameSnapshot` and the room broadcasts it opaquely; the double cast is this placeholder's only
 * home. Do not add a second cast next to it and do not generalise `GameModuleFactory` over the
 * snapshot to make it go away: the real module returns a real `GameSnapshot` and needs neither.
 */
export const defaultGameModuleFactory: GameModuleFactory = (options) =>
  createEchoModule(options) as unknown as RoomGameModule;

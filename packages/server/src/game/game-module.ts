import type { BalanceConfig, PlayerId, GameSnapshot, GameInput, GameSessionConfig } from '@evolution/shared';
import type { SimulationDebugHandle } from './debug/simulation-debug-handle.js';

/**
 * Per-room game logic. ONE instance per active GameRoom. This is THE place the
 * game plugs in. The default impl below is a working trust-client "echo" game so
 * the template runs end-to-end before any real game is defined.
 *
 * The room always drives a `GameModule` over the wire types; the type parameters exist for the
 * gameplay testing framework, whose adapters run stand-in modules (the echo, a toy world) that
 * speak their own snapshot shape (docs/TESTING.md §8).
 */
export interface GameModule<Input = GameInput, Snapshot = GameSnapshot> {
  /** Store/merge the latest input for a player (called from the message router). */
  submitInput(playerId: PlayerId, payload: Input): void;
  /** Advance the world one tick (called at TICK_HZ by GameRoom). */
  reduceGameState(): void;
  /** Produce the broadcast snapshot for this tick (the delta since the previous broadcast). */
  serializeRoomState(): Snapshot;
  /**
   * What a joining, late-joining or reconnecting client receives in `game_state`
   * (docs/ARCHITECTURE.md §4): the full snapshot plus the balance the module simulates with.
   * A module without one (the echo) gets its broadcast snapshot and `DEFAULT_BALANCE`.
   */
  serializeFullState?(): FullGameState<Snapshot>;
  /** A player joined mid-game. */
  addPlayer(playerId: PlayerId, avatarIndex: number, playerName: string): void;
  /** A player left. Drop their entity so it stops appearing in snapshots. */
  removePlayer(playerId: PlayerId): void;
  /** Free any resources on room teardown. */
  free?(): void;
  /**
   * The debug capabilities this module offers the MCP tools (docs/ARCHITECTURE.md §8). A module
   * without one answers every game-specific tool with "not supported by this game module".
   */
  getDebugHandle?(): SimulationDebugHandle;
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
  creatorId: PlayerId;
  playerIds: PlayerId[];
  gameName: string;
  config: GameSessionConfig;
  avatarAssignments: Record<string, number>;
  playerNames: Record<string, string>;
}

/** Factory the LobbyManager uses to create a room's game logic. */
export type GameModuleFactory = (options: RoomInitOptions) => GameModule;

/**
 * DEFAULT PLACEHOLDER (TODO(game)): trust-client echo. Stores the latest input per player and
 * echoes `{ players: { [playerId]: lastInput } }` as the snapshot. Replace in the
 * init step with the real game logic.
 */
export function createEchoModule(options: RoomInitOptions): GameModule<GameInput, EchoSnapshot> {
  const latestInputByPlayer = new Map<string, GameInput>();
  const players = new Set<string>(options.playerIds);
  return {
    submitInput: (playerId, payload) => {
      latestInputByPlayer.set(playerId, payload);
    },
    reduceGameState: () => {
      /* TODO(game): advance world one tick */
    },
    serializeRoomState: () => {
      const inputs: Record<string, GameInput | null> = {};
      for (const playerId of players) inputs[playerId] = latestInputByPlayer.get(playerId) ?? null;
      return { players: inputs };
    },
    addPlayer: (playerId) => {
      players.add(playerId);
    },
    removePlayer: (playerId) => {
      players.delete(playerId);
      latestInputByPlayer.delete(playerId);
    },
  };
}

/** The echo has no world, so its snapshot is not a `GameSnapshot`; the room broadcasts it opaquely. TODO(game): real module. */
export const defaultGameModuleFactory: GameModuleFactory = (options) =>
  createEchoModule(options) as unknown as GameModule;

import type { PlayerId, GameSnapshot, GameInput, GameSessionConfig } from '@evolution/shared';

/**
 * Per-room game logic. ONE instance per active GameRoom. This is THE place the
 * game plugs in. The default impl below is a working trust-client "echo" game so
 * the template runs end-to-end before any real game is defined.
 */
export interface GameModule {
  /** Store/merge the latest input for a player (called from the message router). */
  submitInput(playerId: PlayerId, payload: GameInput): void;
  /** Advance the world one tick (called at TICK_HZ by GameRoom). */
  reduceGameState(): void;
  /** Produce the broadcast snapshot for this tick. */
  serializeRoomState(): GameSnapshot;
  /** A player joined mid-game. */
  addPlayer(playerId: PlayerId, avatarIndex: number, playerName: string): void;
  /** A player left. Drop their entity so it stops appearing in snapshots. */
  removePlayer(playerId: PlayerId): void;
  /** Free any resources on room teardown. */
  free?(): void;
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
export const defaultGameModuleFactory: GameModuleFactory = (options) => {
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
      const inputs: Record<string, GameInput> = {};
      for (const playerId of players) inputs[playerId] = latestInputByPlayer.get(playerId) ?? null;
      return { players: inputs } as unknown as GameSnapshot; // TODO(game): real snapshot
    },
    addPlayer: (playerId) => {
      players.add(playerId);
    },
    removePlayer: (playerId) => {
      players.delete(playerId);
      latestInputByPlayer.delete(playerId);
    },
  };
};

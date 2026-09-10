// Lobby descriptor bounds. The server zod schemas and the client forms both
// import these so the limits are defined exactly once.

export const PLAYER_NAME_MIN_LENGTH = 1;
export const PLAYER_NAME_MAX_LENGTH = 20;
export const GAME_NAME_MIN_LENGTH = 1;
export const GAME_NAME_MAX_LENGTH = 40;
/** A game id is a non-empty opaque string minted by the lobby. */
export const GAME_ID_MIN_LENGTH = 1;
/** Length of the nanoid the lobby mints for a new game. */
export const GAME_ID_LENGTH = 10;
/** Inclusive avatar index range for the generic lobby. TODO(game): adjust if needed. */
export const AVATAR_INDEX_MIN = 0;
export const AVATAR_INDEX_MAX = 5;
/** Default per-room player-count bounds. TODO(game): override via GameSessionConfig. */
export const MIN_PLAYERS_PER_GAME = 1;
export const MAX_PLAYERS_PER_GAME = 8;
/** What the create-game form proposes before the creator changes it. */
export const DEFAULT_PLAYERS_PER_GAME = 4;

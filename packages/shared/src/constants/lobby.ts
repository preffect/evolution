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
/** Per-room player-count bounds (docs/GAME-DESIGN.md §5); solo play is valid. */
export const MIN_PLAYERS_PER_GAME = 1;
export const MAX_PLAYERS_PER_GAME = 8;
/** What the create-game form proposes before the creator changes it. */
export const DEFAULT_PLAYERS_PER_GAME = 4;
/** One player palette per seat, by construction (docs/VISUAL-STYLE.md §2). */
export const PLAYER_PALETTE_COUNT = MAX_PLAYERS_PER_GAME;
/** Inclusive avatar index range: an avatar index is a palette index. */
export const AVATAR_INDEX_MIN = 0;
export const AVATAR_INDEX_MAX = PLAYER_PALETTE_COUNT - 1;
/**
 * The non-colour player tell: `SEAT_MARK_BEADS[avatarIndex]` beads on the cell's outline and on
 * the leaderboard swatch (docs/VISUAL-STYLE.md §2, docs/UI.md §3.1); shared because the renderer
 * and the HUD both read it.
 */
export const SEAT_MARK_BEADS: readonly number[] = Array.from(
  { length: PLAYER_PALETTE_COUNT },
  (_unused, index) => index + 1,
);

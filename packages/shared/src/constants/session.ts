// Round and session rules (docs/GAME-DESIGN.md §5, §12).

/** Default round length (s). */
export const ROUND_DURATION_SECONDS = 600;
/** Bounds accepted at create time (s). */
export const ROUND_DURATION_MIN_SECONDS = 60;
export const ROUND_DURATION_MAX_SECONDS = 1800;
/** Largest accepted seed: unsigned 32-bit, written out. */
export const SEED_MAX = 4294967295;
/** The bloom begins at this fraction of the round. */
export const ROUND_BLOOM_START_FRACTION = 0.8;
/** Results overlay before the automatic rematch (s). */
export const RESULTS_SCREEN_SECONDS = 20;
/** Next round seed = seed + this. */
export const ROUND_SEED_INCREMENT = 1;
/** Spectate the killer this long before respawning (s). */
export const RESPAWN_SPECTATE_SECONDS = 3;
/** Score per player absorbed (docs/GAME-DESIGN.md §5.3). */
export const SCORE_ABSORPTION_BONUS = 25;

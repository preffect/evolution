// Debug surfaces: the MCP tool results and the client's raw-snapshot panel.

/** Indent used when a debug view pretty-prints JSON for a human (or Claude) to read. */
export const DEBUG_JSON_INDENT_SPACES = 2;

/**
 * The longest span one `debug_step_room` call may advance a paused room by, in seconds; the
 * tool converts it with `secondsToTicks` where it bounds its `ticks` argument.
 */
export const DEBUG_STEP_MAX_SECONDS = 10;

/**
 * The seed a bot swarm forks its streams from when neither `debug_spawn_bot` nor the bot client
 * CLI names one (docs/testing/bots-and-design-tables.md §8.3). Bot `index` forks `bot_<index>` from it.
 */
export const DEFAULT_BOT_SEED = 1;

/**
 * The `debug_spawn` kind that seats a giant (docs/architecture/debug-mcp.md §8), beside the entity kinds the tool
 * spawns: here so the server and the client's e2e driver name it from one home.
 */
export const GIANT_SPAWN_KIND = 'giant';

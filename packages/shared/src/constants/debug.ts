// Debug surfaces: the MCP tool results and the client's raw-snapshot panel.

/** Indent used when a debug view pretty-prints JSON for a human (or Claude) to read. */
export const DEBUG_JSON_INDENT_SPACES = 2;

/**
 * The longest span one `debug_step_room` call may advance a paused room by, in seconds; the
 * tool converts it with `secondsToTicks` where it bounds its `ticks` argument.
 */
export const DEBUG_STEP_MAX_SECONDS = 10;

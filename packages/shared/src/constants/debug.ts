// Debug surfaces: the MCP tool results and the client's raw-snapshot panel.

import { TICK_HZ } from './network.js';

/** Indent used when a debug view pretty-prints JSON for a human (or Claude) to read. */
export const DEBUG_JSON_INDENT_SPACES = 2;

/** The longest span one `debug_step_room` call may advance a paused room by, in seconds. */
export const DEBUG_STEP_MAX_SECONDS = 10;
/** The same bound in ticks: the upper limit of the tool's `ticks` argument. */
export const MAX_DEBUG_STEP_TICKS = DEBUG_STEP_MAX_SECONDS * TICK_HZ;

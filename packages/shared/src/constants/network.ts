// Transport and timing constants shared by the server and the client.
// Home for these values per docs/CODE-STANDARDS.md §2.

import { MILLISECONDS_PER_SECOND } from './units.js';

/** Default server port: serves /api + /ws + /debug-mcp (single Fastify instance). */
export const DEFAULT_SERVER_PORT = 4400;
/** Default Angular dev-server port (proxies /api + /ws + /debug-mcp to the server). */
export const DEFAULT_CLIENT_PORT = 4402;

/** Server simulation tick rate (Hz). The GameRoom steps the simulation at this rate. */
export const TICK_HZ = 60;
/** Derived fixed-step interval in milliseconds. */
export const TICK_INTERVAL_MS = MILLISECONDS_PER_SECOND / TICK_HZ;

/** Grace window before a disconnected player is fully removed from a room. */
export const DISCONNECT_GRACE_MS = 30_000;

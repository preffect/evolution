// Unit conversion factors. The conversion helpers (secondsToTicks, ...) live in
// packages/shared/src/time/units.ts (docs/DETERMINISM.md §2).

export const MILLISECONDS_PER_SECOND = 1000;
export const BYTES_PER_KIBIBYTE = 1024;
export const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
export const RADIANS_PER_FULL_TURN = 2 * Math.PI;
/** The quantile every p95 in the server's tick stats and the client's frame report reads. */
export const P95_QUANTILE = 0.95;

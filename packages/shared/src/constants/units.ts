// Unit conversion factors. Conversion helpers (secondsToTicks, ...) live in
// packages/shared/src/time/units.ts once the time module lands (docs/DETERMINISM.md).

export const MILLISECONDS_PER_SECOND = 1000;
export const BYTES_PER_KIBIBYTE = 1024;
export const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;

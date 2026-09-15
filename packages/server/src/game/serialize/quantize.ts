// Wire precision (docs/architecture/wire-contract.md §4, "Wire precision"): the serializer rounds each number a
// snapshot carries to the decimals `netcode.ts` names for its quantity. Only the view is rounded: the world records,
// the state hash and the replay keep full precision.

const DECIMAL_BASE = 10;
/**
 * Decimals whose scale is computed once, not per call: the serializer rounds every number of a snapshot on each
 * broadcast and each in-process bot tick, where a power per call more than doubled its cost (#341's review).
 */
const PRECOMPUTED_DECIMALS = 4;
const SCALE_BY_DECIMALS: readonly number[] = Array.from(
  { length: PRECOMPUTED_DECIMALS + 1 },
  (_slot, decimals) => DECIMAL_BASE ** decimals,
);

/** The wire's rounding: what every client is sent. */
export const WIRE_SNAPSHOT_VALUES = 'wire';
/**
 * Full precision, never the wire: what the scenario tables read, and what the debug inspect tools
 * (`debug_get_entities`, `debug_get_player_progress` and the debug mutations' answers) report.
 */
export const EXACT_SNAPSHOT_VALUES = 'exact';

/**
 * How a projection writes its numbers. A value, not an injected function: every projection then calls the one
 * `snapshotValue`, so the broadcast's call sites stay monomorphic when a debug read asks for exact values between
 * two broadcasts (a second function there cost the wire path 2.7× in #341's review).
 */
export type SnapshotPrecision = typeof WIRE_SNAPSHOT_VALUES | typeof EXACT_SNAPSHOT_VALUES;

/** Rounds `value` to `decimals` places, so its JSON is at most that many digits after the point. */
export function quantizeToDecimals(value: number, decimals: number): number {
  const scale = SCALE_BY_DECIMALS[decimals] ?? DECIMAL_BASE ** decimals;
  return Math.round(value * scale) / scale;
}

/** `value` as a snapshot at `precision` writes it: rounded to `decimals` on the wire, untouched when exact. */
export function snapshotValue(value: number, decimals: number, precision: SnapshotPrecision): number {
  return precision === EXACT_SNAPSHOT_VALUES ? value : quantizeToDecimals(value, decimals);
}

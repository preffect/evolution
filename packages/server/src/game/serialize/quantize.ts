// Wire precision (docs/architecture/wire-contract.md §4.1, §4.2 lever 3): the serializer rounds each number a snapshot
// carries to the decimals `netcode.ts` names for its quantity. Only the view is rounded: the world records, the
// state hash and the replay keep full precision.

import { SNAPSHOT_POSITION_DECIMALS } from '@evolution/shared';

const DECIMAL_BASE = 10;

/** How a snapshot number is written: the wire rounds it to `decimals` places, a scenario reads it exact. */
export type SnapshotQuantizer = (value: number, decimals: number) => number;

/** Rounds `value` to `decimals` places, so its JSON is at most that many digits after the point. */
export const quantizeToDecimals: SnapshotQuantizer = (value, decimals) => {
  const scale = DECIMAL_BASE ** decimals;
  return Math.round(value * scale) / scale;
};

/** Full precision: what the scenario tables read, never the wire. */
export const EXACT_SNAPSHOT_VALUES: SnapshotQuantizer = (value) => value;

/** Rounds a world coordinate to the wire precision. */
export function quantizePosition(value: number): number {
  return quantizeToDecimals(value, SNAPSHOT_POSITION_DECIMALS);
}

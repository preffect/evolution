// The balance a recording replays under (docs/determinism/replay-tests-and-traps.md §6): the recorded numbers, ticket
// #907's stage switch mapped to the trait switch (`recorded-swallow-switch.ts`, the stale leaf dropped before the fill),
// plus every leaf the recording does not carry at its shipping default. A recording exported before a leaf existed (one
// from before ticket #948 has no `absorption.SWALLOW_GATE_TRAITS`, one from before ticket #907 no `earlyLife` either)
// ran under the behaviour those defaults ship, so it replays to its `finalHash` with them, and no rule ever reads a
// missing leaf. The pinned recordings under `fixtures/` go red the day a filled default stops meaning what a recording
// ran under. The early-life flip (ticket #916) is that day for `SWALLOW_GATE_TRAITS`: it moves the shipping value to
// `['cytoskeleton']`, but every recording without the leaf ran under "every cell swallows", so the fill for this leaf
// must stay `[]` after the flip; ticket #916 pins it here (or moves `REPLAY_FORMAT_VERSION` instead).

import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';
import { recordedBalanceUnderTraitSwitch } from './recorded-swallow-switch.js';

type BalanceRecord = { [key: string]: unknown };

function isPlainRecord(value: unknown): value is BalanceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Writes into `target` every key of `defaults` it lacks, walking into the records both carry; nothing present moves. */
function fillMissingLeaves(target: BalanceRecord, defaults: BalanceRecord): void {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const recorded = target[key];
    if (recorded === undefined) {
      target[key] = structuredClone(defaultValue);
    } else if (isPlainRecord(recorded) && isPlainRecord(defaultValue)) {
      fillMissingLeaves(recorded, defaultValue);
    }
  }
}

/**
 * A fresh copy of the recorded balance, its stage switch mapped (or the recording refused by name), with every leaf it
 * lacks taken from `DEFAULT_BALANCE`; the recording is untouched.
 */
export function recordedBalanceWithShippingDefaults(recorded: BalanceConfig): BalanceConfig {
  const balance = structuredClone(recordedBalanceUnderTraitSwitch(recorded));
  fillMissingLeaves(balance as unknown as BalanceRecord, DEFAULT_BALANCE as unknown as BalanceRecord);
  return balance;
}

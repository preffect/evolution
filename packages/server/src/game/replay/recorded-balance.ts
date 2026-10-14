// The balance a recording replays under (docs/determinism/replay-tests-and-traps.md §6): the recorded numbers, plus
// every leaf the recording does not carry at its shipping default. A recording exported before a leaf existed (one
// from before ticket #907 has no `absorption.SWALLOW_FROM_STAGE` and no `earlyLife`) ran under the behaviour those
// defaults ship, so it replays to its `finalHash` with them, and no rule ever reads a missing leaf. The pinned recording
// `fixtures/recorded-before-907.replay.json` goes red the day a filled default stops meaning what the recording ran
// under (the early-life flip, ticket #916, moves `SWALLOW_FROM_STAGE`): that change fills its pre-change value or
// moves `REPLAY_FORMAT_VERSION`.

import { DEFAULT_BALANCE, type BalanceConfig } from '@evolution/shared';

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

/** A fresh copy of the recorded balance with every leaf it lacks taken from `DEFAULT_BALANCE`; the recording is untouched. */
export function recordedBalanceWithShippingDefaults(recorded: BalanceConfig): BalanceConfig {
  const balance = structuredClone(recorded);
  fillMissingLeaves(balance as unknown as BalanceRecord, DEFAULT_BALANCE as unknown as BalanceRecord);
  return balance;
}

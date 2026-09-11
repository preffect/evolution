// The entry rule's formulas (docs/PROGRESSION.md §5): what a cell entering the dish after tick 0
// (late join or respawn) starts with. The server's `entryState` composes these; they are shared so
// a HUD estimate and the server can never disagree about the floor.

import type { BalanceConfig } from '../constants/balance.js';
import type { WorldReference } from './world-clock.js';

/** What the rule reads: the entry fractions and bounds, and the starting mass. */
export interface EntryRuleBalance {
  progression: Pick<BalanceConfig['progression'], 'ENTRY_DNA_FRACTION' | 'ENTRY_MASS_FRACTION' | 'ENTRY_MAX_MASS'>;
  growth: Pick<BalanceConfig['growth'], 'CELL_STARTING_MASS'>;
}

/**
 * `clamp(ENTRY_MASS_FRACTION × max(median mass, worldMass), CELL_STARTING_MASS, ENTRY_MAX_MASS)`;
 * `medianMass` is null when the median term is absent (a respawn, or a join inside the grace).
 */
export function entryMass(medianMass: number | null, reference: WorldReference, balance: EntryRuleBalance): number {
  const scaled = balance.progression.ENTRY_MASS_FRACTION * Math.max(medianMass ?? 0, reference.worldMass);
  return Math.min(Math.max(scaled, balance.growth.CELL_STARTING_MASS), balance.progression.ENTRY_MAX_MASS);
}

/**
 * `max(current, floor(ENTRY_DNA_FRACTION × median dnaCumulative), worldDna)`; the raise over
 * `currentDna` is the caller's score-neutral `dnaCatchUpGift`. `medianDna` null as above.
 */
export function entryDnaFloor(
  currentDna: number,
  medianDna: number | null,
  reference: WorldReference,
  balance: EntryRuleBalance,
): number {
  const medianTerm = medianDna === null ? 0 : Math.floor(balance.progression.ENTRY_DNA_FRACTION * medianDna);
  return Math.max(currentDna, medianTerm, reference.worldDna);
}

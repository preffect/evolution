// The mass-flow facts on the wire (docs/architecture/wire-contract.md §4 "Wire precision", docs/ui/hud.md §3.1.5,
// #383): the ledger's applied rates and sprint spend, and the amounts on the `eat` and `cell_absorbed` effects, at
// their wire precision. A cause that rounds to zero is left out, so the client never reads a `−0` tag.

import {
  EFFECT_KIND,
  MASS_RATE_CAUSES,
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_MASS_RATE_DECIMALS,
  SNAPSHOT_SHARE_DECIMALS,
  type GameEffect,
  type MassFlowView,
  type MassRateCause,
} from '@evolution/shared';
import type { MassFlowRecord } from '../world/mass-flow-ledger.js';
import { snapshotValue, type SnapshotPrecision } from './quantize.js';

function ratesView(record: MassFlowRecord, precision: SnapshotPrecision): Partial<Record<MassRateCause, number>> {
  const rates: Partial<Record<MassRateCause, number>> = {};
  for (const cause of MASS_RATE_CAUSES) {
    const rate = snapshotValue(record.ratesPerSecond[cause], SNAPSHOT_MASS_RATE_DECIMALS, precision);
    if (rate !== 0) {
      rates[cause] = rate;
    }
  }
  return rates;
}

/** One player's flow; `sprintSpent` is the sealed window's, `undefined` when the view carries none. */
export function toMassFlowView(
  record: MassFlowRecord,
  sprintSpent: number | undefined,
  precision: SnapshotPrecision,
): MassFlowView {
  const view: MassFlowView = { ratesPerSecond: ratesView(record, precision), zone: record.zone };
  const decayTraitShare = snapshotValue(record.decayTraitShare, SNAPSHOT_SHARE_DECIMALS, precision);
  if (decayTraitShare !== 0) {
    view.decayTraitShare = decayTraitShare;
  }
  const spent = sprintSpent === undefined ? 0 : snapshotValue(sprintSpent, SNAPSHOT_MASS_DECIMALS, precision);
  if (spent !== 0) {
    view.sprintSpent = spent;
  }
  return view;
}

/** An effect as the wire carries it: the meal amounts rounded, every other effect as it was pushed. */
export function toEffectView(effect: GameEffect, precision: SnapshotPrecision): GameEffect {
  const mass = (value: number) => snapshotValue(value, SNAPSHOT_MASS_DECIMALS, precision);
  if (effect.kind === EFFECT_KIND.eat) {
    return { ...effect, massGained: mass(effect.massGained), dnaGained: mass(effect.dnaGained) };
  }
  if (effect.kind === EFFECT_KIND.cellAbsorbed) {
    const { predatorMassGained, predatorDnaGained } = effect;
    return { ...effect, predatorMassGained: mass(predatorMassGained), predatorDnaGained: mass(predatorDnaGained) };
  }
  return effect;
}

// The mass-flow facts on the wire (docs/architecture/wire-contract.md §4 "Wire precision", docs/ui/hud.md §3.1.5,
// #383, #416): the ledger's applied rates and window amounts (sprint spend, no-draft bonus), and the amounts on the
// `eat` and `cell_absorbed` effects, at their wire precision. A cause or amount that rounds to zero is left out, so the
// client never reads a `−0` tag.

import {
  EFFECT_KIND,
  MASS_RATE_CAUSES,
  MASS_WINDOW_AMOUNTS,
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_MASS_RATE_DECIMALS,
  SNAPSHOT_SHARE_DECIMALS,
  type GameEffect,
  type MassFlowView,
  type MassRateCause,
} from '@evolution/shared';
import type { MassFlowRecord, MassWindowRecord } from '../world/mass-flow-ledger.js';
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

/** One player's flow; `sealedWindow` is the sealed window's amounts, `undefined` when the view carries none. */
export function toMassFlowView(
  record: MassFlowRecord,
  sealedWindow: MassWindowRecord | undefined,
  precision: SnapshotPrecision,
): MassFlowView {
  const view: MassFlowView = { ratesPerSecond: ratesView(record, precision), zone: record.zone };
  const decayTraitShare = snapshotValue(record.decayTraitShare, SNAPSHOT_SHARE_DECIMALS, precision);
  if (decayTraitShare !== 0) {
    view.decayTraitShare = decayTraitShare;
  }
  for (const amount of MASS_WINDOW_AMOUNTS) {
    const mass = snapshotValue(sealedWindow?.[amount] ?? 0, SNAPSHOT_MASS_DECIMALS, precision);
    if (mass !== 0) {
      view[amount] = mass;
    }
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

// The payout of a completed engulf (docs/ECOLOGY.md §6.1, the "Payout" table; §3.3 "Engulf
// outcomes" for the wild substitutions). `runEngulfs` calls this and only this on completion: the
// pair is unhooked, the predator is paid (mass yield with the cap overflow, DNA, tag points, the
// endosymbiont credit and the absorption counter) and the prey dies through `session/death.ts`,
// which drops the detritus, emits `cell_absorbed` and starts the respawn countdown.
//
// A wild cell on either side is not a special case here beyond its own row: a wild predator keeps
// nothing (its mass is the world clock, re-pinned next tick) and a wild prey pays no DNA base, no
// tag share and scores no `absorptions` (docs/ECOLOGY.md §3.3).
//
// The trait steal stays reserved: `ENGULF_TRAIT_STEAL_CHANCE` is 0 in build 1 and the payout table
// names no trait for it to move (docs/ECOLOGY.md §6.1, the "Reserved" row), so no roll is drawn —
// the same "no draw when the chance is 0" rule the spit-out follows (`engulf-spit-out.ts`), which
// keeps the `engulf` stream in step between a dish that engulfs and one that does not. Build 2
// turns it on by rolling `streams.engulf` here, beside the counters, once it says what is stolen.

import { DNA_TAG, DNA_TAGS, type BalanceConfig, type TraitDefinition } from '@evolution/shared';
import { gainDna, gainTagPoints } from '../progression/dna.js';
import { absorbCell } from '../session/death.js';
import { isPlayerCell, type CellRecord, type PlayerCellRecord, type PlayerRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { gainMass } from './cell-mass.js';
import { clearEngulfRecords, type EngulfPairing } from './engulf-state.js';
import { worldReferenceAt } from './round-clock.js';

/** One absorption, of a player or of a wild cell: the counters count meals, never mass. */
const ONE_ABSORPTION = 1;

/**
 * The prey's lifetime DNA the predator takes a share of: a player's own, and for a wild cell the
 * world's `worldDna` — the wild cell is the world clock made flesh (docs/ECOLOGY.md §3.3).
 */
function preyDnaOf(world: WorldState, prey: CellRecord): number {
  return isPlayerCell(prey)
    ? requirePlayer(world, prey.playerId).dnaCumulative
    : worldReferenceAt(world, world.tick).worldDna;
}

/** `ENGULF_DNA_BASE` + the prey's share; a wild prey carries no base (docs/ECOLOGY.md §3.3). */
function engulfDnaFor(world: WorldState, prey: CellRecord, balance: BalanceConfig): number {
  const absorption = balance.absorption;
  const base = isPlayerCell(prey) ? absorption.ENGULF_DNA_BASE : 0;
  return base + preyDnaOf(world, prey) * absorption.ENGULF_DNA_SHARE;
}

/** Half the prey's flavours plus the flat `predatory` bounty (docs/PROGRESSION.md §1). */
function payTagPoints(eater: PlayerRecord, prey: CellRecord, world: WorldState, balance: BalanceConfig): void {
  const absorption = balance.absorption;
  if (isPlayerCell(prey)) {
    const preyPlayer = requirePlayer(world, prey.playerId);
    for (const tag of DNA_TAGS) {
      gainTagPoints(eater, tag, preyPlayer.dnaTagPoints[tag] * absorption.ENGULF_TAG_SHARE);
    }
  }
  gainTagPoints(eater, DNA_TAG.predatory, absorption.ENGULF_PREDATORY_TAG_POINTS);
}

/**
 * Eating a cell that owns an endosymbiont credits the eater's counter for that variant in full —
 * you ate the whole organelle (docs/ECOLOGY.md §1, §3.3). The requirement is the catalog's own
 * `unlockedBy`, so the rule can never disagree with the draft's gate (`progression/draft.ts`).
 */
function creditEndosymbionts(eater: PlayerRecord, prey: CellRecord, balance: BalanceConfig): void {
  const catalog: readonly TraitDefinition[] = balance.traits.TRAIT_CATALOG;
  for (const owned of prey.traits) {
    const unlock = catalog.find((trait) => trait.id === owned.traitId)?.unlockedBy;
    if (unlock !== undefined) {
      const eaten = eater.bacteriaEatenByVariant;
      eaten[unlock.bacteriumVariant] = Math.max(eaten[unlock.bacteriumVariant], unlock.count);
    }
  }
}

/**
 * The predator's half of the table, for a player predator (a wild one keeps nothing). Mass first,
 * so the part above `CELL_MAX_MASS` becomes DNA in the same gain (docs/ECOLOGY.md §5.4); the prey
 * is still in the world, so its mass and traits are read here before `absorbCell` removes it.
 */
function payPredator(world: WorldState, context: StepContext, predator: PlayerCellRecord, prey: CellRecord): void {
  const balance = context.balance;
  const eater = requirePlayer(world, predator.playerId);
  gainMass(predator, eater, prey.mass * balance.absorption.ENGULF_MASS_YIELD, balance);
  gainDna(eater, engulfDnaFor(world, prey, balance), predator.modifiers.dnaGainMultiplier);
  payTagPoints(eater, prey, world, balance);
  creditEndosymbionts(eater, prey, balance);
  if (isPlayerCell(prey)) {
    eater.absorptions += ONE_ABSORPTION;
  } else {
    eater.wildAbsorptions += ONE_ABSORPTION;
  }
}

/**
 * A completed engulf. The records are cleared first so the prey's own death does not read the pair
 * as a running engulf and abort it (docs/ECOLOGY.md §6.3, the chain row: only the prey's engulf of
 * a third cell is aborted, by `dissolveCell`). Nothing writes `lastRelease`: a payout is not a
 * release, and the two must stay distinguishable.
 */
export function payOutEngulf(world: WorldState, context: StepContext, pairing: EngulfPairing): void {
  const { predator, prey } = pairing;
  clearEngulfRecords(pairing);
  if (isPlayerCell(predator)) {
    payPredator(world, context, predator, prey);
  }
  absorbCell(world, context, prey, predator);
}

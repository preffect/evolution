// The payout of a completed engulf (docs/ecology/absorption.md §6.1, the "Payout" table; §3.3 "Engulf
// outcomes" for the wild substitutions). `runEngulfs` calls this and only this on completion: the
// pair is unhooked, the predator is paid (mass yield with the cap overflow, DNA, tag points, the
// endosymbiont credit and the absorption counter) and the prey dies through `session/death.ts`,
// which drops the detritus, emits `cell_absorbed` and starts the respawn countdown.
//
// A wild cell on either side is not a special case here beyond its own row: a wild predator keeps
// the meal's mass and nothing else (the next settle turns it into growth, docs/ecology/wild-cells.md §3.3.4) and a
// wild prey pays no DNA base, no tag share and scores no `absorptions` (docs/ecology/wild-cells.md §3.3). Its death
// emits `cell_absorbed` like a player's, with `playerId: null` (#270), so the predator's viewer sees the dissolve
// either way.
//
// Traits never move (docs/ecology/absorption.md §6.1, the "Traits" row; the steal was retired by #269), so the
// payout draws nothing: the spit-out stays the `engulf` stream's only consumer
// (docs/determinism/random-streams.md §3).

import { DNA_TAG, DNA_TAGS, type BalanceConfig, type CellModifiers, type TraitDefinition } from '@evolution/shared';
import { earnedDnaOf, gainDna, gainTagPoints } from '../progression/dna.js';
import { absorbCell } from '../session/death.js';
import { isPlayerCell, type CellRecord, type PlayerCellRecord, type PlayerRecord } from '../world/entities.js';
import { requirePlayer } from '../world/lookups.js';
import type { StepContext, WorldState } from '../world/world-state.js';
import { gainMass, measureGain, type MeasuredGain } from './cell-mass.js';
import { clearEngulfRecords, type EngulfPairing } from './engulf-state.js';
import { worldReferenceAt } from './round-clock.js';

/** One absorption, of a player or of a wild cell: the counters count meals, never mass. */
const ONE_ABSORPTION = 1;
/** The yield never exceeds the whole prey (docs/traits/model.md §2: `engulfMassYieldBonus`, "cap 1"). */
const WHOLE_PREY_YIELD = 1;

/** `ENGULF_MASS_YIELD` + the predator's Food Vacuole bonus, capped at the whole prey (T6). One home for the cap. */
export function engulfMassYieldOf(
  predator: Pick<CellModifiers, 'engulfMassYieldBonus'>,
  balance: BalanceConfig,
): number {
  return Math.min(WHOLE_PREY_YIELD, balance.absorption.ENGULF_MASS_YIELD + predator.engulfMassYieldBonus);
}

/**
 * The prey DNA the predator takes a share of: a player's earned DNA, never its entry-rule gift (#271,
 * docs/ecology/absorption.md §6.3), and for a wild cell the world's `worldDna` — the wild cell is the
 * world clock made flesh (docs/ecology/wild-cells.md §3.3).
 */
function preyDnaOf(world: WorldState, prey: CellRecord): number {
  return isPlayerCell(prey)
    ? earnedDnaOf(requirePlayer(world, prey.playerId))
    : worldReferenceAt(world, world.tick).worldDna;
}

/** `ENGULF_DNA_BASE` + the prey's share; a wild prey carries no base (docs/ecology/wild-cells.md §3.3). */
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
 * you ate the whole organelle (docs/ecology/food-and-spawn.md §1, docs/ecology/wild-cells.md §3.3). The requirement is the catalog's own
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
 * so the part above `CELL_MAX_MASS` becomes DNA in the same gain (docs/ecology/mass-and-movement.md §5.4); the prey
 * is still in the world, so its mass and traits are read here before `absorbCell` removes it.
 */
function payPredator(
  world: WorldState,
  context: StepContext,
  predator: PlayerCellRecord,
  prey: CellRecord,
): MeasuredGain {
  const balance = context.balance;
  const eater = requirePlayer(world, predator.playerId);
  const gain = measureGain(predator, eater, () => {
    gainMass(predator, eater, prey.mass * engulfMassYieldOf(predator.modifiers, balance), balance);
    gainDna(eater, engulfDnaFor(world, prey, balance), predator.modifiers.dnaGainMultiplier);
  });
  payTagPoints(eater, prey, world, balance);
  creditEndosymbionts(eater, prey, balance);
  if (isPlayerCell(prey)) {
    eater.absorptions += ONE_ABSORPTION;
  } else {
    eater.wildAbsorptions += ONE_ABSORPTION;
  }
  return gain;
}

/** A wild predator keeps `prey.mass × yield`, clamped to the cap: no DNA, tags or counters (it has no player). */
function payWildPredator(predator: CellRecord, prey: CellRecord, balance: BalanceConfig): MeasuredGain {
  const massBefore = predator.mass;
  gainMass(predator, undefined, prey.mass * engulfMassYieldOf(predator.modifiers, balance), balance);
  return { massGained: predator.mass - massBefore, dnaGained: 0 };
}

/**
 * A completed engulf. The records are cleared first so the prey's own death does not read the pair
 * as a running engulf and abort it (docs/ecology/absorption.md §6.3, the chain row: only the prey's engulf of
 * a third cell is aborted, by `dissolveCell`). Nothing writes `lastRelease`: a payout is not a
 * release, and the two must stay distinguishable.
 */
export function payOutEngulf(world: WorldState, context: StepContext, pairing: EngulfPairing): void {
  const { predator, prey } = pairing;
  clearEngulfRecords(pairing);
  const predatorGain = isPlayerCell(predator)
    ? payPredator(world, context, predator, prey)
    : payWildPredator(predator, prey, context.balance);
  absorbCell(world, context, { prey, predator, predatorGain });
}

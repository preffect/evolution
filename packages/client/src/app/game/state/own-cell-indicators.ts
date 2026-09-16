// The `OwnCellIndicators` record (docs/ui/hud.md §3.1.4): everything the player's own cell has to say
// about itself, derived once from the snapshot and read by two consumers — the renderer draws it
// (#187) and the status mirror speaks it (`hud/own-cell-status.component.ts`). One truth, so a
// phase or a counter can never disagree between what is drawn and what a screen reader hears.
//
// Pure and DOM-free. Every rule that could be re-derived downstream is settled here instead:
// `escape.phase` through the shared `engulfPhaseOf`, the escape window's fill, the ladder's stage
// rung, and the picker's ghost-hide. The renderer computes geometry from this record and nothing
// else (docs/rendering/own-cell-indicators.md §10).

import {
  CELL_STAGE,
  CELL_STATE,
  ENGULF_PHASE,
  STAGE_GATE_TRAITS,
  TRAIT_CATALOG,
  clamp,
  engulfPhaseOf,
  hasReachedStage,
  levelUpCost,
  nextStage,
  type BacteriumVariant,
  type BalanceConfig,
  type CellStage,
  type CellView,
  type EngulfPhase,
  type EntityId,
  type OwnedTrait,
  type PlayerProgressView,
  type TraitDefinition,
  type TraitId,
  type ValueOf,
} from '@evolution/shared';
import { LADDER_ORBIT_ANGLES_PAIR_DEG, LADDER_ORBIT_ANGLE_SINGLE_DEG } from '../render/constants';
import { sprintFillFor } from '../hud/format/sprint-fill';
import type { Threat } from '../hud/format/threats-for';

const FULL = 1;
const EMPTY = 0;

/** The pair angles of docs/ui/components-and-constants.md §9, reachable by any variant; `plain` has no counter of its own. */
const ORBIT_ANGLE_BY_VARIANT: Partial<Record<BacteriumVariant, number>> = LADDER_ORBIT_ANGLES_PAIR_DEG;

/** What the next rung draws, by stage (docs/ui/hud.md §3.1.4). */
export const LADDER_SILHOUETTE = { nucleoid: 'nucleoid', envelope: 'envelope', form: 'form' } as const;
export type LadderSilhouette = ValueOf<typeof LADDER_SILHOUETTE>;

export interface LadderCounter {
  /** `mitochondrion` or `chloroplast`: the endosymbiont this tally unlocks. */
  readonly traitId: TraitId;
  readonly variant: BacteriumVariant;
  readonly eaten: number;
  readonly required: number;
  /** From `LADDER_ORBIT_ANGLES_PAIR_DEG`; clockwise from 12 o'clock (docs/ui/hud.md §3.1.2). */
  readonly angleDeg: number;
  /** The picker is previewing this endosymbiont, so its ghost hides and its pips stay. */
  readonly isGhostHidden: boolean;
  /** `eaten >= required`: the ghost takes its unlock ring until the trait is picked. */
  readonly isUnlocked: boolean;
}

/** The next rung's dashed silhouette, at `LADDER_ORBIT_ANGLE_SINGLE_DEG`. */
export interface LadderGhost {
  readonly silhouette: LadderSilhouette;
  readonly angleDeg: number;
}

/**
 * The ladder orbit (docs/ui/hud.md §3.1.2): the next rung's ghost when that rung draws one, and a
 * counter for every endosymbiont the cell could still be offered. The two are independent
 * (decision #285 B): a cell promoted by one endosymbiont keeps the other's tally beside the
 * envelope ghost, and up the ladder, until it owns that one too. Both empty is the top.
 */
export interface Ladder {
  readonly ghost: LadderGhost | null;
  readonly counters: readonly LadderCounter[];
}

export interface OwnCellEscape {
  /** `ownCell.engulfProgress`, 0..1. */
  readonly progress: number;
  readonly phase: EngulfPhase;
  /** The escape window, draining to 0 at the seal; 0 from the seal on (docs/ui/hud.md §3.1.2). */
  readonly fill: number;
  readonly predatorCellId: EntityId;
}

/** The escape label's two readings (docs/ui/hud.md §3.1.2), uppercased by the `label` role when drawn. */
export const ESCAPE_LABEL = { window: 'Sprint to escape', sealed: 'Sealed' } as const;

/**
 * `Sprint to escape` through the window, `Sealed` from the seal on: the one reading the renderer's label over the
 * escape arc and the alert strip (docs/ui/encyclopedia.md §11.1) both show.
 */
export function escapeLabelFor(escape: OwnCellEscape): string {
  return escape.phase === ENGULF_PHASE.absorb ? ESCAPE_LABEL.sealed : ESCAPE_LABEL.window;
}

export interface OwnCellThreat {
  readonly cellId: EntityId;
  /** `AMOEBOID CAN ENGULF YOU`; uppercased by the `label` role, not here. */
  readonly label: string;
}

export interface OwnCellIndicators {
  readonly level: number;
  /** 0..1 toward the next level; 1 at `MAX_LEVEL`. */
  readonly dnaFraction: number;
  readonly isMaxLevel: boolean;
  readonly ladder: Ladder;
  /** 0..1, 1 = ready. */
  readonly sprintFill: number;
  readonly isSprinting: boolean;
  /** Set only while `being_engulfed`. */
  readonly escape: OwnCellEscape | null;
  /** The nearest cell that can engulf us, or `null`; hidden while `escape` is set (§3.1.2). */
  readonly nearestThreat: OwnCellThreat | null;
  /** The exact mass, for the status mirror; the cell's size is the indicator (§3.1.2). */
  readonly mass: number;
  readonly traits: readonly OwnedTrait[];
  readonly bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>;
}

/**
 * The silhouette a rung draws as a ghost; `null` for the `endosymbiosis` rung, whose gate is drawn
 * as its counters instead.
 */
function silhouetteForRung(rung: CellStage): LadderSilhouette | null {
  if (rung === CELL_STAGE.prokaryote) return LADDER_SILHOUETTE.nucleoid;
  if (rung === CELL_STAGE.eukaryote) return LADDER_SILHOUETTE.envelope;
  // `specialised` holds five forms, so the ghost is keyed by the stage, never by one trait (§3.1.2).
  if (rung === CELL_STAGE.specialised) return LADDER_SILHOUETTE.form;
  return null;
}

function isTraitOwned(traits: readonly OwnedTrait[], traitId: TraitId): boolean {
  return traits.some((owned) => owned.traitId === traitId);
}

/**
 * One counter per endosymbiont the `endosymbiosis` gate names, in catalog order, for as long as the
 * draft could still offer it: from the stage the catalog opens it at (the server's draft filters by
 * the same `hasReachedStage`) until it is owned. So an owned endosymbiont drops its counter and the
 * other keeps its angle, whatever stage the first one promoted the cell to (decision #285 B). The
 * variant and the tally it needs come from the catalog's own `unlockedBy`, so the pairing has one home.
 */
function endosymbiosisCounters(
  stage: CellStage,
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): readonly LadderCounter[] {
  const gate = STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis];
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  return catalog
    .filter(
      (trait) => gate.includes(trait.id) && hasReachedStage(stage, trait.stage) && !isTraitOwned(traits, trait.id),
    )
    .flatMap((trait): LadderCounter[] => {
      const unlock = trait.unlockedBy;
      // Every endosymbiont in the gate has an `unlockedBy`; a future one that does not simply has
      // no tally to show, which is a missing counter rather than a wrong one.
      if (unlock === undefined) return [];
      // No angle for this variant means the orbit has nowhere to put it; falling back to the lone
      // ghost's 180 would stack two items on one spot with every constant still reading right.
      // Dropping it is the same treatment as the missing `unlockedBy` above: a missing counter.
      const angleDeg = ORBIT_ANGLE_BY_VARIANT[unlock.bacteriumVariant];
      if (angleDeg === undefined) return [];
      // A counter stays on the orbit until the trait is *picked*, not when it unlocks, so the raw
      // tally keeps climbing while the player is still at the vent. Clamp here rather than in the
      // display string: §3.1.2 draws exactly `required` pips in rows of five, so an unclamped
      // number is one the drawing side has no geometry for, and this record exists so the two
      // consumers cannot disagree. `isUnlocked` still reads the raw count, so topping out at
      // `10/10` does not lose the fact that the requirement is met.
      const rawEaten = bacteriaEatenByVariant[unlock.bacteriumVariant];
      return [
        {
          traitId: trait.id,
          variant: unlock.bacteriumVariant,
          eaten: Math.min(rawEaten, unlock.count),
          required: unlock.count,
          angleDeg,
          isGhostHidden: previewTraitId === trait.id,
          isUnlocked: rawEaten >= unlock.count,
        },
      ];
    });
}

/**
 * The next rung's ghost, or `null` at the top, on the counters' rung, or while the picker previews
 * a card whose trait is that rung's gate (the card shows the real organelle instead).
 */
function rungGhostFor(stage: CellStage, previewTraitId: TraitId | null): LadderGhost | null {
  const rung = nextStage(stage);
  const silhouette = rung === null ? null : silhouetteForRung(rung);
  if (rung === null || silhouette === null) return null;
  const isPreviewingThisRung = previewTraitId !== null && STAGE_GATE_TRAITS[rung].includes(previewTraitId);
  return isPreviewingThisRung ? null : { silhouette, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG };
}

/** The ladder orbit for a stage (docs/ui/hud.md §3.1.2): the rung ghost and the open counters. */
export function ladderFor(
  stage: CellStage,
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): Ladder {
  return {
    ghost: rungGhostFor(stage, previewTraitId),
    counters: endosymbiosisCounters(stage, traits, bacteriaEatenByVariant, previewTraitId),
  };
}

/** The top of the ladder: one predicate, because two copies of it is how they drift (§3 standards). */
export function isAtMaxLevel(progress: PlayerProgressView, balance: BalanceConfig): boolean {
  return progress.level >= balance.progression.MAX_LEVEL;
}

/** 0..1 toward the next level; 1 at `MAX_LEVEL`, where there is no next cost to be a fraction of. */
export function dnaFractionFor(progress: PlayerProgressView, balance: BalanceConfig): number {
  if (isAtMaxLevel(progress, balance)) return FULL;
  const cost = levelUpCost(progress.level, balance.progression);
  return cost <= EMPTY ? FULL : clamp(progress.dnaTowardNextLevel / cost, EMPTY, FULL);
}

/**
 * The escape window while `being_engulfed` (docs/ui/hud.md §3.1.2): full at first contact, drained at
 * the seal, and locked at zero from the seal on, where only a spit-out or the ratio frees the prey.
 */
function escapeFor(ownCell: CellView, balance: BalanceConfig): OwnCellEscape | null {
  if (!ownCell.states.includes(CELL_STATE.beingEngulfed) || ownCell.engulfedByCellId === null) return null;
  const seal = balance.absorption.ENGULF_SEAL_PROGRESS;
  return {
    progress: ownCell.engulfProgress,
    phase: engulfPhaseOf(ownCell.engulfProgress, balance.absorption),
    fill: seal <= EMPTY ? EMPTY : clamp(FULL - ownCell.engulfProgress / seal, EMPTY, FULL),
    predatorCellId: ownCell.engulfedByCellId,
  };
}

/** The nearest threat's label; the threat list is already nearest-first (`threatsFor`). */
function nearestThreatOf(threats: readonly Threat[]): OwnCellThreat | null {
  const nearest = threats[0];
  return nearest === undefined ? null : { cellId: nearest.cellId, label: `${nearest.name} can engulf you` };
}

/** Everything the record is derived from; a record rather than a parameter list, which ran long. */
export interface OwnCellIndicatorsInput {
  readonly ownCell: CellView;
  readonly ownProgress: PlayerProgressView;
  /** The room's live balance, so `debug_set_balance` is felt by the ring and the escape arc. */
  readonly balance: BalanceConfig;
  /** `threatsFor(...)`'s output, nearest first; empty while nothing on screen can eat us. */
  readonly threats: readonly Threat[];
  /** The picker's previewed card (#188), which hides the ghost of the rung it shows. */
  readonly previewTraitId: TraitId | null;
}

/**
 * The whole record. The escape arc takes the threat label's place while `being_engulfed`, so the
 * two are never both set (§3.1.2).
 */
export function ownCellIndicatorsFor(input: OwnCellIndicatorsInput): OwnCellIndicators {
  const { ownCell, ownProgress, balance, threats, previewTraitId } = input;
  const escape = escapeFor(ownCell, balance);
  return {
    level: ownProgress.level,
    dnaFraction: dnaFractionFor(ownProgress, balance),
    isMaxLevel: isAtMaxLevel(ownProgress, balance),
    ladder: ladderFor(ownCell.stage, ownCell.traits, ownProgress.bacteriaEatenByVariant, previewTraitId),
    sprintFill: sprintFillFor(ownCell, balance.controls),
    isSprinting: ownCell.sprintRemainingTicks > EMPTY,
    escape,
    nearestThreat: escape === null ? nearestThreatOf(threats) : null,
    mass: ownCell.mass,
    traits: ownCell.traits,
    bacteriaEatenByVariant: ownProgress.bacteriaEatenByVariant,
  };
}

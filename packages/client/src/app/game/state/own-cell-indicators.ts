// The `OwnCellIndicators` record (docs/UI.md §3.1.4): everything the player's own cell has to say
// about itself, derived once from the snapshot and read by two consumers — the renderer draws it
// (#187) and the status mirror speaks it (`hud/own-cell-status.component.ts`). One truth, so a
// phase or a counter can never disagree between what is drawn and what a screen reader hears.
//
// Pure and DOM-free. Every rule that could be re-derived downstream is settled here instead:
// `escape.phase` through the shared `engulfPhaseOf`, the escape window's fill, the ladder's stage
// rung, and the picker's ghost-hide. The renderer computes geometry from this record and nothing
// else (docs/RENDERING.md §10).

import {
  CELL_STAGE,
  CELL_STATE,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  STAGE_GATE_TRAITS,
  STAGE_ORDER,
  TRAIT_CATALOG,
  clamp,
  engulfPhaseOf,
  levelUpCost,
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

/** The pair angles of docs/UI.md §9, reachable by any variant; `plain` has no counter of its own. */
const ORBIT_ANGLE_BY_VARIANT: Partial<Record<BacteriumVariant, number>> = LADDER_ORBIT_ANGLES_PAIR_DEG;

/** What the next rung draws, by stage (docs/UI.md §3.1.4). */
export const LADDER_SILHOUETTE = { nucleoid: 'nucleoid', envelope: 'envelope', form: 'form' } as const;
export type LadderSilhouette = ValueOf<typeof LADDER_SILHOUETTE>;

/** The three shapes the ladder orbit takes; `none` is the top of the ladder. */
export const LADDER_KIND = { none: 'none', ghost: 'ghost', counters: 'counters' } as const;
export type LadderKind = ValueOf<typeof LADDER_KIND>;

export interface LadderCounter {
  /** `mitochondrion` or `chloroplast`: the endosymbiont this tally unlocks. */
  readonly traitId: TraitId;
  readonly variant: BacteriumVariant;
  readonly eaten: number;
  readonly required: number;
  /** From `LADDER_ORBIT_ANGLES_PAIR_DEG`; clockwise from 12 o'clock (docs/UI.md §3.1.2). */
  readonly angleDeg: number;
  /** The picker is previewing this endosymbiont, so its ghost hides and its pips stay. */
  readonly isGhostHidden: boolean;
  /** `eaten >= required`: the ghost takes its unlock ring until the trait is picked. */
  readonly isUnlocked: boolean;
}

export type Ladder =
  | { readonly kind: typeof LADDER_KIND.none }
  | { readonly kind: typeof LADDER_KIND.ghost; readonly silhouette: LadderSilhouette; readonly angleDeg: number }
  | { readonly kind: typeof LADDER_KIND.counters; readonly counters: readonly LadderCounter[] };

export interface OwnCellEscape {
  /** `ownCell.engulfProgress`, 0..1. */
  readonly progress: number;
  readonly phase: EngulfPhase;
  /** The escape window, draining to 0 at the seal; 0 from the seal on (docs/UI.md §3.1.2). */
  readonly fill: number;
  readonly predatorCellId: EntityId;
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

/** The stage after this one, or `null` at the top of the ladder. */
export function nextStageAfter(stage: CellStage): CellStage | null {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? null : (STAGE_ORDER[index + 1] ?? null);
}

/** The silhouette a stage's gate draws as a ghost; `null` where the gate is a set of counters. */
function silhouetteForNextStage(nextStage: CellStage): LadderSilhouette | null {
  if (nextStage === CELL_STAGE.prokaryote) return LADDER_SILHOUETTE.nucleoid;
  if (nextStage === CELL_STAGE.eukaryote) return LADDER_SILHOUETTE.envelope;
  // `specialised` holds five forms, so the ghost is keyed by the stage, never by one trait (§3.1.2).
  if (nextStage === CELL_STAGE.specialised) return LADDER_SILHOUETTE.form;
  return null;
}

function isTraitOwned(traits: readonly OwnedTrait[], traitId: TraitId): boolean {
  return traits.some((owned) => owned.traitId === traitId);
}

/**
 * One counter per endosymbiont the `endosymbiosis` gate names, in catalog order. The variant and
 * the tally it needs come from the catalog's own `unlockedBy`, so the pairing has one home; an
 * owned endosymbiont drops its counter and the other keeps its angle (docs/UI.md §3.1.2).
 */
function endosymbiosisCounters(
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): readonly LadderCounter[] {
  const gate = STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis];
  const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
  return catalog
    .filter((trait) => gate.includes(trait.id) && !isTraitOwned(traits, trait.id))
    .flatMap((trait): LadderCounter[] => {
      const unlock = trait.unlockedBy;
      // Every endosymbiont in the gate has an `unlockedBy`; a future one that does not simply has
      // no tally to show, which is a missing counter rather than a wrong one.
      if (unlock === undefined) return [];
      const eaten = bacteriaEatenByVariant[unlock.bacteriumVariant];
      const angleDeg = ORBIT_ANGLE_BY_VARIANT[unlock.bacteriumVariant];
      return [
        {
          traitId: trait.id,
          variant: unlock.bacteriumVariant,
          eaten,
          required: unlock.count,
          angleDeg: angleDeg ?? LADDER_ORBIT_ANGLE_SINGLE_DEG,
          isGhostHidden: previewTraitId === trait.id,
          isUnlocked: eaten >= unlock.count,
        },
      ];
    });
}

/**
 * The ladder orbit for a stage (docs/UI.md §3.1.2): a ghost of the next rung, the endosymbiosis
 * counters, or nothing at the top. While the picker previews a card whose trait is the next stage's
 * gate, the ghost hides so the card can show the real organelle.
 */
export function ladderFor(
  stage: CellStage,
  traits: readonly OwnedTrait[],
  bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>,
  previewTraitId: TraitId | null,
): Ladder {
  const nextStage = nextStageAfter(stage);
  if (nextStage === null) return { kind: LADDER_KIND.none };
  if (nextStage === CELL_STAGE.endosymbiosis) {
    const counters = endosymbiosisCounters(traits, bacteriaEatenByVariant, previewTraitId);
    return counters.length === 0 ? { kind: LADDER_KIND.none } : { kind: LADDER_KIND.counters, counters };
  }
  const silhouette = silhouetteForNextStage(nextStage);
  if (silhouette === null) return { kind: LADDER_KIND.none };
  const isPreviewingThisGate = previewTraitId !== null && STAGE_GATE_TRAITS[nextStage].includes(previewTraitId);
  return isPreviewingThisGate
    ? { kind: LADDER_KIND.none }
    : { kind: LADDER_KIND.ghost, silhouette, angleDeg: LADDER_ORBIT_ANGLE_SINGLE_DEG };
}

/** 0..1 toward the next level; 1 at `MAX_LEVEL`, where there is no next cost to be a fraction of. */
export function dnaFractionFor(progress: PlayerProgressView, balance: BalanceConfig): number {
  if (progress.level >= balance.progression.MAX_LEVEL) return FULL;
  const cost = levelUpCost(progress.level, balance.progression);
  return cost <= EMPTY ? FULL : clamp(progress.dnaTowardNextLevel / cost, EMPTY, FULL);
}

/**
 * The escape window while `being_engulfed` (docs/UI.md §3.1.2): full at first contact, drained at
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
    isMaxLevel: ownProgress.level >= balance.progression.MAX_LEVEL,
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

/** `ENDOSYMBIOSIS_BACTERIA_REQUIRED` re-exported so a consumer need not reach past this record. */
export { ENDOSYMBIOSIS_BACTERIA_REQUIRED };

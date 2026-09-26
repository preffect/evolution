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
  CELL_STATE,
  ENGULF_PHASE,
  clamp,
  engulfPhaseOf,
  engulfSealProgress,
  levelUpCost,
  type BacteriumVariant,
  type BalanceConfig,
  type CellView,
  type EngulfPhase,
  type EntityId,
  type OwnProgressView,
  type OwnedTrait,
  type PlayerProgressView,
  type TraitId,
} from '@evolution/shared';
import { sprintFillFor } from '../hud/format/sprint-fill';
import { relationLabelsFor, type RelationLabels } from '../hud/format/relation-labels';
import { relationRingsOf, type Relation, type RelationRing } from '../hud/format/relations-for';
import type { Threat } from '../hud/format/threats-for';
import type { ZoneEntryMemory } from '../hud/format/zone-pill';
import { legibilityCuesFor, type LegibilityCues } from './legibility-cues';
import { ladderFor, type Ladder } from './own-cell-ladder';
import type { MassTrendMemory } from './mass-trend';

const FULL = 1;
const EMPTY = 0;

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

/** The ladder and the threat half (§3.1.2) plus the legibility cues (§3.1.5, `legibility-cues.ts`). */
export interface OwnCellIndicators extends LegibilityCues {
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
  /** The on-screen cells the own cell could eat or should not touch, nearest first (§3.1.5, `relationsFor`). */
  readonly relations: readonly Relation[];
  /** The same rings by cell id: what the cell layer packs, built once per record rather than per frame. */
  readonly relationRings: ReadonlyMap<EntityId, RelationRing>;
  /** The `EDIBLE` and `TOXIC` labels on the nearest ring of each kind (§3.1.5, `relationLabelsFor`). */
  readonly relationLabels: RelationLabels;
  /** The exact mass, for the status mirror; the cell's size is the indicator (§3.1.2). */
  readonly mass: number;
  readonly traits: readonly OwnedTrait[];
  readonly bacteriaEatenByVariant: Readonly<Record<BacteriumVariant, number>>;
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
  const seal = engulfSealProgress(balance.absorption);
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
  readonly ownProgress: OwnProgressView;
  /** The room's live balance, so `debug_set_balance` is felt by the ring and the escape arc. */
  readonly balance: BalanceConfig;
  /** `threatsFor(...)`'s output, nearest first; empty while nothing on screen can eat us. */
  readonly threats: readonly Threat[];
  /** `relationsFor(...)`'s output, nearest first; absent reads no relation rings. */
  readonly relations?: readonly Relation[];
  /** The player has engulfed a cell this session (`hasEngulfedIn`); absent reads not yet. */
  readonly hasEngulfed?: boolean;
  /** The picker's previewed card (#188), which hides the ghost of the rung it shows. */
  readonly previewTraitId: TraitId | null;
  /** The newest snapshot's tick (the zone pill's clock); 0 when absent. */
  readonly tick?: number;
  /** The cue memories `GameStateService` carries (§3.1.5); absent reads a steady chip and no pill. */
  readonly massTrend?: MassTrendMemory | null;
  readonly zoneEntry?: ZoneEntryMemory | null;
}

const NO_TICK = 0;
const NO_RELATIONS: readonly Relation[] = [];

/**
 * The whole record. The escape arc takes the threat label's place while `being_engulfed`, so the
 * two are never both set (§3.1.2).
 */
export function ownCellIndicatorsFor(input: OwnCellIndicatorsInput): OwnCellIndicators {
  const { ownCell, ownProgress, balance, threats, previewTraitId } = input;
  const escape = escapeFor(ownCell, balance);
  const relations = input.relations ?? NO_RELATIONS;
  const cues = legibilityCuesFor({
    ownCell,
    ownProgress,
    balance,
    tick: input.tick ?? NO_TICK,
    massTrend: input.massTrend ?? null,
    zoneEntry: input.zoneEntry ?? null,
    isBeingEngulfed: escape !== null,
  });
  return {
    ...cues,
    level: ownProgress.level,
    dnaFraction: dnaFractionFor(ownProgress, balance),
    isMaxLevel: isAtMaxLevel(ownProgress, balance),
    ladder: ladderFor(ownCell.stage, ownCell.traits, ownProgress.bacteriaEatenByVariant, previewTraitId),
    sprintFill: sprintFillFor(ownCell, balance.controls),
    isSprinting: ownCell.sprintRemainingTicks > EMPTY,
    escape,
    nearestThreat: escape === null ? nearestThreatOf(threats) : null,
    relations,
    relationRings: relationRingsOf(relations),
    relationLabels: relationLabelsFor({ relations, ownCell, hasEngulfed: input.hasEngulfed ?? false }),
    mass: ownCell.mass,
    traits: ownCell.traits,
    bacteriaEatenByVariant: ownProgress.bacteriaEatenByVariant,
  };
}

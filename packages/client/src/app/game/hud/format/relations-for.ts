// Which on-screen cells the own cell could eat, and which are toxic (docs/ui/hud.md §3.1.5, the relation rings row).
// Pure, beside `threatsFor` and over the same `isDiscVisibleInExtent`, so a ring is never promised for a cell that is
// not on screen. Split in two so the per-cell work runs once per snapshot and only the camera test per camera move.
//
// "Could eat" is the **shared** `canEngulf` with the own cell as the predator — the call the server's engulf check
// makes — so Cell Wall and every other ratio modifier move the green ring exactly as they move the engulf. "Toxic" is
// the cell's folded `toxinDrainFractionPerSecond`, never a trait id list. A threat keeps its warning ring and gets no
// relation ring: the costly misread is taking a predator for prey.

import { canEngulf, foldModifiers, type BalanceConfig, type CellView, type EntityId } from '@evolution/shared';
import { isDiscVisibleInExtent, type CameraExtent } from '../../render/camera';
import { RELATIONS_MAX_RINGED } from '../../state/legibility-constants';
import { distanceSquaredBetween } from './threats-for';

const SINGLE_LINE = 1;
const DOUBLE_LINE = 2;
/**
 * The ring a cell carries. The value is also the line count the shader draws (the edible single line, the toxic
 * double line), so the line count and the role share one packed scalar (docs/rendering/own-cell-indicators.md §10).
 */
export const RELATION_RING = { none: 0, edible: SINGLE_LINE, toxic: DOUBLE_LINE } as const;
export type RelationRing = (typeof RELATION_RING)[keyof typeof RELATION_RING];

export interface Relation {
  readonly cellId: EntityId;
  /** Toxic wins the ring whether or not the cell is also edible (§3.1.5: toxic, edible or not, is the double line). */
  readonly ring: Exclude<RelationRing, typeof RELATION_RING.none>;
  readonly isEdible: boolean;
  readonly isToxic: boolean;
  /** It drains its swallower (#154): the folded `spikeDrainFractionPerSecond` is above zero; carried by the label only. */
  readonly isSpiny: boolean;
  /** World-space distance from the own cell, squared: the sort key, never shown. */
  readonly distanceSquared: number;
}

/** A relation with the disc the camera test reads: what a snapshot yields before the camera is asked. */
export interface RelationCandidate extends Relation {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface RelationCandidatesInput {
  readonly cells: readonly CellView[];
  readonly ownCell: CellView;
  readonly balance: BalanceConfig;
}

export interface RelationsInput extends RelationCandidatesInput {
  /** The live camera rectangle; `null` before the renderer has drawn a frame, which answers empty. */
  readonly cameraExtent: CameraExtent | null;
}

const NO_DRAIN = 0;

/** The `toxic` rule of §3.1.5: the cell's folded toxin drain is above zero. The hold-Tab panel asks the same. */
export function isToxicCell(cell: CellView, balance: BalanceConfig): boolean {
  return foldModifiers(cell.traits, balance.traits.TRAIT_TIERS).toxinDrainFractionPerSecond > NO_DRAIN;
}

/**
 * The `edible` rule of §3.1.5: the shared ratio says the own cell can engulf it, no other predator holds it, and the
 * own cell is not already engulfing (the spit-out refractory is server-only and not reflected).
 */
export function isEdibleBy(cell: CellView, ownCell: CellView, balance: BalanceConfig): boolean {
  return (
    ownCell.engulfingCellId === null && cell.engulfedByCellId === null && canEngulf(ownCell, cell, balance.absorption)
  );
}

function candidateOf(cell: CellView, input: RelationCandidatesInput): RelationCandidate | null {
  const { ownCell, balance } = input;
  if (cell.id === ownCell.id || canEngulf(cell, ownCell, balance.absorption)) return null;
  const modifiers = foldModifiers(cell.traits, balance.traits.TRAIT_TIERS);
  const isToxic = modifiers.toxinDrainFractionPerSecond > NO_DRAIN;
  const isEdible = isEdibleBy(cell, ownCell, balance);
  if (!isToxic && !isEdible) return null;
  return {
    cellId: cell.id,
    ring: isToxic ? RELATION_RING.toxic : RELATION_RING.edible,
    isEdible,
    isToxic,
    isSpiny: modifiers.spikeDrainFractionPerSecond > NO_DRAIN,
    distanceSquared: distanceSquaredBetween(cell, ownCell),
    x: cell.x,
    y: cell.y,
    radius: cell.radius,
  };
}

/**
 * Every cell that would carry a ring, nearest first, ties on id so no ring flickers; on screen or not. The expensive
 * half (a trait fold and two ratio checks per cell), so it runs once per snapshot while the camera test runs per move.
 */
export function relationCandidatesFor(input: RelationCandidatesInput): readonly RelationCandidate[] {
  const candidates = input.cells.flatMap((cell) => candidateOf(cell, input) ?? []);
  return candidates.sort(
    (first, second) => first.distanceSquared - second.distanceSquared || (first.cellId < second.cellId ? -1 : 1),
  );
}

/** The nearest `RELATIONS_MAX_RINGED` candidates on screen; none before the camera exists. */
export function relationsOnScreen(
  candidates: readonly RelationCandidate[],
  cameraExtent: CameraExtent | null,
): readonly RelationCandidate[] {
  if (cameraExtent === null) return [];
  const onScreen: RelationCandidate[] = [];
  for (const candidate of candidates) {
    if (onScreen.length >= RELATIONS_MAX_RINGED) break;
    if (isDiscVisibleInExtent(cameraExtent, candidate.x, candidate.y, candidate.radius)) onScreen.push(candidate);
  }
  return onScreen;
}

/** Every ringed on-screen cell, nearest first, at most `RELATIONS_MAX_RINGED`. */
export function relationsFor(input: RelationsInput): readonly Relation[] {
  return relationsOnScreen(relationCandidatesFor(input), input.cameraExtent);
}

/** The rings by cell id: what the cell layer packs (docs/rendering/own-cell-indicators.md §10). */
export function relationRingsOf(relations: readonly Relation[]): ReadonlyMap<EntityId, RelationRing> {
  return new Map(relations.map((relation) => [relation.cellId, relation.ring]));
}

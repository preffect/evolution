// Which on-screen cells the own cell could eat, and which are toxic (docs/ui/hud.md §3.1.5, the relation rings row).
// Pure, beside `threatsFor` and over the same `isDiscVisibleInExtent`, so a ring is never promised for a cell that is
// not on screen.
//
// "Could eat" is the **shared** `canEngulf` with the own cell as the predator — the call the server's engulf check
// makes — so Cell Wall and every other ratio modifier move the green ring exactly as they move the engulf. "Toxic" is
// the cell's folded `toxinDrainFractionPerSecond`, never a trait id list. A threat keeps its warning ring and gets no
// relation ring: the costly misread is taking a predator for prey.

import { canEngulf, foldModifiers, type BalanceConfig, type CellView, type EntityId } from '@evolution/shared';
import { isDiscVisibleInExtent, type CameraExtent } from '../../render/camera';
import { RELATIONS_MAX_RINGED } from '../../state/legibility-constants';
import { distanceSquaredBetween } from './threats-for';

/**
 * The ring a cell carries. The value is also the line count the shader draws (the edible single line, the toxic
 * double line), so the line count and the role share one packed scalar (docs/rendering/own-cell-indicators.md §10).
 */
const SINGLE_LINE = 1;
const DOUBLE_LINE = 2;
export const RELATION_RING = { none: 0, edible: SINGLE_LINE, toxic: DOUBLE_LINE } as const;
export type RelationRing = (typeof RELATION_RING)[keyof typeof RELATION_RING];

export interface Relation {
  readonly cellId: EntityId;
  /** Toxic wins the ring whether or not the cell is also edible (§3.1.5: toxic, edible or not, is the double line). */
  readonly ring: Exclude<RelationRing, typeof RELATION_RING.none>;
  readonly isEdible: boolean;
  readonly isToxic: boolean;
  /** World-space distance from the own cell, squared: the sort key, never shown. */
  readonly distanceSquared: number;
}

export interface RelationsInput {
  readonly cells: readonly CellView[];
  readonly ownCell: CellView;
  /** The live camera rectangle; `null` before the renderer has drawn a frame, which answers empty. */
  readonly cameraExtent: CameraExtent | null;
  readonly balance: BalanceConfig;
}

const NO_TOXIN = 0;

/** The `toxic` rule of §3.1.5: the cell's folded toxin drain is above zero. The hold-Tab panel asks the same. */
export function isToxicCell(cell: CellView, balance: BalanceConfig): boolean {
  return foldModifiers(cell.traits, balance.traits.TRAIT_TIERS).toxinDrainFractionPerSecond > NO_TOXIN;
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

function relationOf(cell: CellView, input: RelationsInput): Relation | null {
  const { ownCell, cameraExtent, balance } = input;
  if (cell.id === ownCell.id || cameraExtent === null) return null;
  if (!isDiscVisibleInExtent(cameraExtent, cell.x, cell.y, cell.radius)) return null;
  if (canEngulf(cell, ownCell, balance.absorption)) return null;
  const isToxic = isToxicCell(cell, balance);
  const isEdible = isEdibleBy(cell, ownCell, balance);
  if (!isToxic && !isEdible) return null;
  return {
    cellId: cell.id,
    ring: isToxic ? RELATION_RING.toxic : RELATION_RING.edible,
    isEdible,
    isToxic,
    distanceSquared: distanceSquaredBetween(cell, ownCell),
  };
}

/** Every ringed on-screen cell, nearest first, at most `RELATIONS_MAX_RINGED`; ties break on id so no ring flickers. */
export function relationsFor(input: RelationsInput): readonly Relation[] {
  const relations = input.cells.flatMap((cell) => relationOf(cell, input) ?? []);
  relations.sort(
    (first, second) => first.distanceSquared - second.distanceSquared || (first.cellId < second.cellId ? -1 : 1),
  );
  return relations.slice(0, RELATIONS_MAX_RINGED);
}

/** The rings by cell id: what the cell layer packs (docs/rendering/own-cell-indicators.md §10). */
export function relationRingsOf(relations: readonly Relation[]): ReadonlyMap<EntityId, RelationRing> {
  return new Map(relations.map((relation) => [relation.cellId, relation.ring]));
}

// Who on screen can eat us (docs/ui/hud.md §3.1.2). Pure, so the rule is tested without a camera.
//
// The predicate is the **shared** `canEngulf` — the same call the server's engulf check and the
// renderer's warning ring make — so the threat label, the ring and the engulf itself can never
// disagree, Cell Wall included. This file only decides which cells to ask about (the ones inside
// the camera extent, never ourselves, never a cell already holding us) and what order to answer in
// (nearest first, so the record's `nearestThreat` is a lookup rather than a second search).
//
// "On screen" is `isDiscVisibleInExtent`, **not** the renderer's `isDiscInExtent`: the draw-cull
// carries a margin of two radii, so a predator whose nearest edge is a full radius outside the
// frame still passes it. That is right for deciding what to draw and wrong here, because §3.1.2
// anchors the label to the predator's warning ring and an off-screen ring is nothing to anchor to.

import { canEngulf, type BalanceConfig, type CellView, type EntityId, type PlayerRosterView } from '@evolution/shared';
import { isDiscVisibleInExtent, type CameraExtent } from '../../render/camera';
import { truncatePlayerName } from './player-name';

/** A cell that can engulf the own cell, with the name the label speaks. */
export interface Threat {
  readonly cellId: EntityId;
  /** The player's name, or the wild cell's stand-in; uppercased by the `label` role, not here. */
  readonly name: string;
  /** World-space distance from the own cell, squared: the sort key, never shown. */
  readonly distanceSquared: number;
}

/** What a wild cell is called when it is the nearest threat (docs/ecology/wild-cells.md §3.3: it has no player). */
export const WILD_CELL_THREAT_NAME = 'Wild cell';

export interface ThreatsInput {
  readonly cells: readonly CellView[];
  readonly ownCell: CellView;
  /** The live camera rectangle; `null` before the renderer has drawn a frame, which answers empty. */
  readonly cameraExtent: CameraExtent | null;
  readonly players: Readonly<Record<string, PlayerRosterView>>;
  readonly balance: BalanceConfig;
}

/**
 * How far one cell is from another, squared — enough to rank by, and it never takes a square root to do it. Shared
 * with the hold-Tab panel, whose toxin row picks the nearest toxic cell (docs/ui/overlays.md §3.7) by the same
 * measure this file's threats are sorted by.
 */
export function distanceSquaredBetween(cell: CellView, other: CellView): number {
  const deltaX = cell.x - other.x;
  const deltaY = cell.y - other.y;
  return deltaX * deltaX + deltaY * deltaY;
}

/**
 * What a cell is called on screen: its player's name, or the wild cell's stand-in. The hold-Tab panel names the
 * cell draining us and the prey we are swallowing (docs/ui/overlays.md §3.7) the same way, so the fallback for a
 * nameless cell has one home, and so does the length a name may run on screen (`truncatePlayerName`).
 */
export function cellDisplayName(cell: CellView, players: Readonly<Record<string, PlayerRosterView>>): string {
  if (cell.playerId === null) return WILD_CELL_THREAT_NAME;
  // Cut like the leaderboard's, the id fallback included: a raw player id has no length cap at all (#454).
  return truncatePlayerName(players[cell.playerId]?.playerName ?? cell.playerId);
}

/**
 * Every on-screen cell that can engulf the own cell, nearest first. Empty before the camera exists:
 * without an extent there is no "on screen" to filter by, and a label for an off-screen predator
 * would point at nothing.
 */
export function threatsFor(input: ThreatsInput): readonly Threat[] {
  const { cells, ownCell, cameraExtent, players, balance } = input;
  if (cameraExtent === null) return [];
  const threats: Threat[] = [];
  for (const cell of cells) {
    if (cell.id === ownCell.id) continue;
    if (!isDiscVisibleInExtent(cameraExtent, cell.x, cell.y, cell.radius)) continue;
    if (!canEngulf(cell, ownCell, balance.absorption)) continue;
    threats.push({
      cellId: cell.id,
      name: cellDisplayName(cell, players),
      distanceSquared: distanceSquaredBetween(cell, ownCell),
    });
  }
  // Ties break on id so the label never flickers between two equidistant predators.
  return threats.sort(
    (first, second) => first.distanceSquared - second.distanceSquared || (first.cellId < second.cellId ? -1 : 1),
  );
}

// Selectors over the Evolution scenario snapshot (docs/testing/scenario-runner.md §8.1): what a table row reads
// of a player index at a tick. Each answers `undefined` when the thing is gone (a cell after
// death), which every matcher fails with "got undefined".

import {
  CELL_KIND,
  FOOD_KIND,
  distanceBetween,
  type CellView,
  type EffectKind,
  type GameEffect,
  type GiantSpecies,
  type MassFlowView,
  type OwnProgressView,
} from '@evolution/shared';
import type { GiantSeatRecord } from '../../game/world/entities.js';
import type { EvolutionScenarioSnapshot, WildSeatView } from './evolution-adapter.js';
import type { ScenarioView } from './expectations.js';

export type EvolutionView = ScenarioView<EvolutionScenarioSnapshot>;

export function cellOf(view: EvolutionView, playerIndex: number): CellView | undefined {
  const playerId = view.playerId(playerIndex);
  return view.snapshot.cells.find((cell) => cell.playerId === playerId);
}

/** Wild seat `seatNumber` (docs/ecology/acceptance.md §8.1: "seat 0"); `undefined` for a seat the world has not. */
export function wildSeatOf(view: EvolutionView, seatNumber: number): WildSeatView | undefined {
  return view.snapshot.wildSeats.find((seat) => seat.seatNumber === seatNumber);
}

/** The seat's cell; `undefined` while the seat is vacant (absorbed, counting down to its respawn). */
export function wildCellOf(view: EvolutionView, seatNumber: number): CellView | undefined {
  return seatedCellOf(view, wildSeatOf(view, seatNumber));
}

/** A seat's cell in the snapshot; `undefined` for no seat or a vacant one. */
function seatedCellOf(view: EvolutionView, seat: { readonly cellId: string | null } | undefined): CellView | undefined {
  const cellId = seat?.cellId;
  return cellId === null || cellId === undefined ? undefined : view.snapshot.cells.find((cell) => cell.id === cellId);
}

/** The species' giant seat (docs/ecology/acceptance.md §8.2); `undefined` for a species the world seats none of. */
export function giantSeatOf(view: EvolutionView, species: GiantSpecies): Readonly<GiantSeatRecord> | undefined {
  return view.snapshot.giantSeats.find((seat) => seat.species === species);
}

/** The species' giant cell; `undefined` while its seat is vacant (absorbed, counting down to its respawn). */
export function giantCellOf(view: EvolutionView, species: GiantSpecies): CellView | undefined {
  return seatedCellOf(view, giantSeatOf(view, species));
}

export function wildCellsOf(view: EvolutionView): CellView[] {
  return view.snapshot.cells.filter((cell) => cell.kind === CELL_KIND.wild);
}

export function progressOf(view: EvolutionView, playerIndex: number): OwnProgressView | undefined {
  return view.snapshot.progressByPlayer[view.playerId(playerIndex)];
}

/** Why the player's cell's mass moved on this tick (#383), at full precision; `undefined` without a flow. */
export function massFlowOf(view: EvolutionView, playerIndex: number): MassFlowView | undefined {
  return progressOf(view, playerIndex)?.massFlow ?? undefined;
}

export function massOf(view: EvolutionView, playerIndex: number): number | undefined {
  return cellOf(view, playerIndex)?.mass;
}

/** The cell's speed in wu/s: the length of its velocity. */
export function speedOf(view: EvolutionView, playerIndex: number): number | undefined {
  const cell = cellOf(view, playerIndex);
  return cell === undefined ? undefined : Math.hypot(cell.velocityX, cell.velocityY);
}

export function foodCount(view: EvolutionView): number {
  return view.snapshot.food.spawned.length;
}

/** The mass now lying in the dish as detritus (docs/ecology/food-and-spawn.md §1): what a death dropped. */
export function detritusMass(view: EvolutionView, moteMass: number): number {
  return view.snapshot.food.spawned.filter((mote) => mote.kind === FOOD_KIND.detritus).length * moteMass;
}

export function fragmentCount(view: EvolutionView): number {
  return view.snapshot.dnaFragments.length;
}

/** This tick's effects of one kind. */
export function effectsOfKind<Kind extends EffectKind>(
  view: EvolutionView,
  kind: Kind,
): Extract<GameEffect, { kind: Kind }>[] {
  return view.snapshot.effects.filter((effect): effect is Extract<GameEffect, { kind: Kind }> => effect.kind === kind);
}

/** The centre distance between two players' cells. */
export function distanceBetweenCells(view: EvolutionView, first: number, second: number): number | undefined {
  const left = cellOf(view, first);
  const right = cellOf(view, second);
  return left === undefined || right === undefined ? undefined : distanceBetween(left, right);
}

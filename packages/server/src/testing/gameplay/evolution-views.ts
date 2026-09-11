// Selectors over the Evolution scenario snapshot (docs/TESTING.md §8.1): what a table row reads
// of a player index at a tick. Each answers `undefined` when the thing is gone (a cell after
// death), which every matcher fails with "got undefined".

import {
  distanceBetween,
  type CellView,
  type EffectKind,
  type GameEffect,
  type PlayerProgressView,
} from '@evolution/shared';
import type { EvolutionScenarioSnapshot } from './evolution-adapter.js';
import type { ScenarioView } from './expectations.js';

export type EvolutionView = ScenarioView<EvolutionScenarioSnapshot>;

export function cellOf(view: EvolutionView, playerIndex: number): CellView | undefined {
  const playerId = view.playerId(playerIndex);
  return view.snapshot.cells.find((cell) => cell.playerId === playerId);
}

export function progressOf(view: EvolutionView, playerIndex: number): PlayerProgressView | undefined {
  return view.snapshot.players[view.playerId(playerIndex)];
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

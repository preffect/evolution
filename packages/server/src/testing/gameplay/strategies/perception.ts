// What a strategy may see of the world beyond its own cell (docs/TESTING.md §8.4). The
// strategies are pure over `ScriptContext` and this seam; the adapter binding decides how a
// snapshot yields cells and motes, and closes the shared `canEngulf` (ECOLOGY §6.1,
// `shared/simulation/engulf-eligibility.ts`) over the live absorption balance so a bot never
// carries its own copy of the ratio rule. The echo module has no world: `NO_WORLD_PERCEPTION`.

import type { PlayerId } from '@evolution/shared';

/** The fields of a cell a strategy reads; a subset of the wire `CellView`, so a view satisfies it as is. */
export interface BotCellView {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly x: number;
  readonly y: number;
  readonly mass: number;
  readonly radius: number;
  /** The folded Cell Wall bonus the shared predicate reads on the prey side. */
  readonly membraneRatioBonus: number;
}

export interface BotMoteView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** The predicate's predator side, as `canEngulf` declares it. */
export type EngulfPredatorView = Pick<BotCellView, 'mass'>;
/** The predicate's prey side, as `canEngulf` declares it. */
export type EngulfPreyView = Pick<BotCellView, 'mass' | 'membraneRatioBonus'>;

export interface BotPerception<Snapshot> {
  cellsOf(snapshot: Snapshot): readonly BotCellView[];
  motesOf(snapshot: Snapshot): readonly BotMoteView[];
  /** `canEngulf(predator, prey, balance.absorption)` with the balance already applied. */
  canEngulf(predator: EngulfPredatorView, prey: EngulfPreyView): boolean;
}

/** A world with nothing in it: what the echo module offers a bot. */
export const NO_WORLD_PERCEPTION: BotPerception<unknown> = {
  cellsOf: () => [],
  motesOf: () => [],
  canEngulf: () => false,
};

export function distanceBetween(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** The item nearest to `origin`, or `undefined` for an empty list; ties keep the earlier item. */
export function nearestTo<Item extends { x: number; y: number }>(
  origin: { x: number; y: number },
  items: readonly Item[],
): Item | undefined {
  let nearest: Item | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const distance = distanceBetween(origin, item);
    if (distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }
  return nearest;
}

// What a strategy may see of the world beyond its own cell (docs/TESTING.md §8.3). The
// strategies are pure over `ScriptContext` and this seam; the world binding decides how a
// snapshot yields cells and motes, and closes the shared `canEngulf` (ECOLOGY §6.1,
// `shared/simulation/engulf-eligibility.ts`) over the live absorption balance so a bot never
// carries its own copy of the ratio rule. The echo module has no world: `NO_WORLD_PERCEPTION`.
// The one place a player identity is assumed is `ownCellOf`; #156's wild cells (non-player
// cells that wander, flee and hunt by era, `playerId: null` on the view) swap that single
// function for an entity-id lookup and add `flee` to the catalogue without touching the
// strategy shape.

import { distanceBetween, type PlayerId } from '@evolution/shared';

/** The fields of a cell a strategy reads; a subset of the wire `CellView`, so a view satisfies it as is. */
export interface BotCellView {
  readonly id: string;
  /** Null for a wild cell (ECOLOGY §3.3): a strategy may hunt or flee it, never own it. */
  readonly playerId: PlayerId | null;
  readonly x: number;
  readonly y: number;
  readonly mass: number;
  readonly radius: number;
  /** The folded Cell Wall bonus the shared predicate reads on the prey side. */
  readonly membraneRatioBonus: number;
}

/** A cell a player owns: what `ownCellOf` returns and what a fixture places for a bot. */
export type PlayerBotCellView = BotCellView & { readonly playerId: PlayerId };

/** Where a player's cell is and how big; what "target N radii east" is measured from. */
export type CellLocation = Pick<BotCellView, 'x' | 'y' | 'radius'>;

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
  /** The actor's own cell in `snapshot`, or `undefined` when it has none: the single self-locator every host derives from. */
  ownCellOf(snapshot: Snapshot, playerId: PlayerId): BotCellView | undefined;
  cellsOf(snapshot: Snapshot): readonly BotCellView[];
  motesOf(snapshot: Snapshot): readonly BotMoteView[];
  /** `canEngulf(predator, prey, balance.absorption)` with the balance already applied. */
  canEngulf(predator: EngulfPredatorView, prey: EngulfPreyView): boolean;
}

/** A world with nothing in it: what the echo module offers a bot. */
export const NO_WORLD_PERCEPTION: BotPerception<unknown> = {
  ownCellOf: () => undefined,
  cellsOf: () => [],
  motesOf: () => [],
  canEngulf: () => false,
};

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

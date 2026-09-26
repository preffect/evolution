// What a strategy may see of the world beyond its own cell (docs/testing/bots-and-design-tables.md §8.3). The
// strategies are pure over `ScriptContext` and this seam; the world binding decides how a
// snapshot yields cells and motes, and closes the shared `canEngulf` (ecology/absorption.md §6.1,
// `shared/simulation/engulf-eligibility.ts`) over the live absorption balance so a bot never
// carries its own copy of the ratio rule. The echo module has no world: `NO_WORLD_PERCEPTION`.
// The one place an identity is assumed is `ownCellOf`, keyed by `ActorId`: a player id for every
// bot (the default), and for a wild seat (a non-player cell that wanders, flees and hunts by era,
// `playerId: null` on the view) its cell's entity id (`game/wild/wild-perception.ts`), so the
// strategy shape is the same on both sides.

import { distanceBetween, type PlayerId } from '@evolution/shared';

/** The fields of a cell a strategy reads; a subset of the wire `CellView`, so a view satisfies it as is. */
export interface BotCellView {
  readonly id: string;
  /** Null for a wild cell (ecology/wild-cells.md §3.3): a strategy may hunt or flee it, never own it. */
  readonly playerId: PlayerId | null;
  readonly x: number;
  readonly y: number;
  readonly mass: number;
  readonly radius: number;
  /** The folded Cell Wall bonus the shared predicate reads on the prey side. */
  readonly membraneRatioBonus: number;
}

/**
 * A cell a player owns: what `ownCellOf` returns for a player actor and what a fixture places for a bot. A wild seat's
 * `ownCellOf` returns its cell with `playerId: null`, so the seam itself stays `BotCellView` (#173).
 */
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

export interface BotPerception<Snapshot, ActorId = PlayerId> {
  /** The actor's own cell in `snapshot`, or `undefined` when it has none: the single self-locator every host derives from. */
  ownCellOf(snapshot: Snapshot, actorId: ActorId): BotCellView | undefined;
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

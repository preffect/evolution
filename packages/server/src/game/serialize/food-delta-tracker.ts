// The food delta (docs/architecture/wire-contract.md §4, §4.1): static motes ride as spawned / removed deltas
// and the ones that moved (bacteria every tick, attracted motes) as position patches. The
// tracker remembers the previous broadcast so the client can apply each delta idempotently
// (upsert spawned, delete-if-present removed, patch moved); a first call reports everything as
// spawned, which is also what a rematch looks like on the wire.

import type { EntityId, FoodDelta, FoodMoteView, MotePositionView } from '@evolution/shared';
import type { FoodMoteRecord } from '../world/entities.js';
import { toFoodMoteView, toMotePositionView } from './serialize.js';

/** A mote and its quantised position, built once per broadcast and shared by every viewer's tracker. */
export interface PositionedMote {
  readonly mote: FoodMoteRecord;
  readonly position: MotePositionView;
}

/** Quantises every mote's position once: what each viewer's delta then reads without allocating its own. */
export function positionMotes(food: readonly FoodMoteRecord[]): PositionedMote[] {
  return food.map((mote) => ({ mote, position: toMotePositionView(mote) }));
}

export class FoodDeltaTracker {
  /** Id → quantised position at the previous broadcast, in that broadcast's array order. */
  private known = new Map<EntityId, MotePositionView>();

  /** The delta over positions already quantised (`positionMotes`); the position objects are only read, never changed. */
  diffPositioned(food: readonly PositionedMote[]): FoodDelta {
    const next = new Map<EntityId, MotePositionView>();
    const spawned: FoodMoteView[] = [];
    const moved: MotePositionView[] = [];
    for (const { mote, position } of food) {
      const previous = this.known.get(mote.id);
      if (previous === undefined) {
        spawned.push(toFoodMoteView(mote));
      } else if (previous.x !== position.x || previous.y !== position.y) {
        moved.push(position);
      }
      next.set(mote.id, position);
    }
    const removedIds: EntityId[] = [];
    for (const id of this.known.keys()) {
      if (!next.has(id)) {
        removedIds.push(id);
      }
    }
    this.known = next;
    return { spawned, removedIds, moved };
  }
}

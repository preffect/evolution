// The food delta (docs/ARCHITECTURE.md §4, §4.1): static motes ride as spawned / removed deltas
// and the ones that moved (bacteria every tick, attracted motes) as position patches. The
// tracker remembers the previous broadcast so the client can apply each delta idempotently
// (upsert spawned, delete-if-present removed, patch moved); a first call reports everything as
// spawned, which is also what a rematch looks like on the wire.

import type { EntityId, FoodDelta, MotePositionView } from '@evolution/shared';
import type { FoodMoteRecord } from '../world/entities.js';
import { toFoodMoteView, toMotePositionView } from './serialize.js';

interface KnownPosition {
  readonly x: number;
  readonly y: number;
}

export class FoodDeltaTracker {
  /** Id → quantised position at the previous broadcast, in that broadcast's array order. */
  private known = new Map<EntityId, KnownPosition>();

  diff(food: readonly FoodMoteRecord[]): FoodDelta {
    const next = new Map<EntityId, KnownPosition>();
    const spawned = [];
    const moved: MotePositionView[] = [];
    for (const mote of food) {
      const position = toMotePositionView(mote);
      const previous = this.known.get(mote.id);
      if (previous === undefined) {
        spawned.push(toFoodMoteView(mote));
      } else if (previous.x !== position.x || previous.y !== position.y) {
        moved.push(position);
      }
      next.set(mote.id, { x: position.x, y: position.y });
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

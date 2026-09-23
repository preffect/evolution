// The JSON of the per-viewer members whose items every viewer shares (ticket #406, docs/architecture/wire-contract.md
// §4.1): a mote's position and a spawned mote's view are held by its `MoteEntry` with their JSON, written once, and a
// fragment's view is built once per broadcast; a viewer's arrays are joined from those strings. The text is exactly
// what `JSON.stringify` writes for the same value (the spec pins it), so the wire does not change.
//
// **Invariant:** a food delta's JSON is joined from its entries' *current* strings, not from the delta object, so a
// viewer's members must be written before the next world read (`MoteMotion.position`, which a later broadcast or a
// `serializeFull` makes). The room does that: it closes each viewer's frame right after that viewer's `serialize`.
// Batching the serialisation, or reading the world between `serialize` and `closeSnapshotFrame`, would break it.

import type { FoodDelta } from '@evolution/shared';
import type { FoodDeltaParts } from './food-delta-tracker.js';
import type { ViewerSnapshotKey } from './viewer-snapshot-keys.js';

/** `{"spawned":[…],"removedIds":[…],"moved":[…]}`: `FoodDelta`'s members in the order the tracker builds them. */
function foodDeltaJson(parts: FoodDeltaParts): string {
  const spawned = parts.spawned.map((entry) => entry.spawnedJsonAt(parts.sequence)).join(',');
  const moved = parts.moved.map((entry) => entry.positionJson).join(',');
  return `{"spawned":[${spawned}],"removedIds":${JSON.stringify(parts.delta.removedIds)},"moved":[${moved}]}`;
}

export class ViewerMemberJson {
  /** Each viewer's food delta, answered by `serialize`, with the entries it was built from. */
  private readonly foodParts = new WeakMap<FoodDelta, FoodDeltaParts>();
  /** Each shared fragment view's JSON, kept as long as the view is: one broadcast. */
  private readonly itemJson = new WeakMap<object, string>();

  /** Remembers the entries behind `parts.delta`, so its JSON is joined rather than stringified. */
  noteFood(parts: FoodDeltaParts): FoodDelta {
    this.foodParts.set(parts.delta, parts);
    return parts.delta;
  }

  /** `JSON.stringify(value)` for the member `key`, reusing the shared items' strings. */
  memberJson(key: ViewerSnapshotKey, value: unknown): string {
    const parts = key === 'food' ? this.foodParts.get(value as FoodDelta) : undefined;
    if (parts !== undefined) return foodDeltaJson(parts);
    if (key === 'dnaFragments' && Array.isArray(value)) return this.arrayJson(value as readonly object[]);
    return JSON.stringify(value);
  }

  private arrayJson(items: readonly object[]): string {
    return `[${items.map((item) => this.cachedJson(item)).join(',')}]`;
  }

  private cachedJson(item: object): string {
    let json = this.itemJson.get(item);
    if (json === undefined) {
      json = JSON.stringify(item);
      this.itemJson.set(item, json);
    }
    return json;
  }
}

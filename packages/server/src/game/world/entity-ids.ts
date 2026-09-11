// Ids come from a per-world monotonic counter with a kind prefix, never from randomness
// (docs/ARCHITECTURE.md §2); every sort ends in `compareEntityIds` (docs/DETERMINISM.md §4).

import { ENTITY_KIND, entityId, type EntityId, type EntityKind } from '@evolution/shared';

const ID_SEPARATOR = '-';

/** `c-17`, `m-2041`, `f-9`. */
export const ENTITY_ID_PREFIX: Readonly<Record<EntityKind, string>> = {
  [ENTITY_KIND.cell]: 'c',
  [ENTITY_KIND.foodMote]: 'm',
  [ENTITY_KIND.dnaFragment]: 'f',
};

export interface EntityCounter {
  nextEntityNumber: number;
}

/** The next id of `kind`; advances the world's counter. */
export function mintEntityId(counter: EntityCounter, kind: EntityKind): EntityId {
  const number = counter.nextEntityNumber;
  counter.nextEntityNumber += 1;
  return entityId(`${ENTITY_ID_PREFIX[kind]}${ID_SEPARATOR}${number}`);
}

function numberOf(id: string): number {
  return Number(id.slice(id.indexOf(ID_SEPARATOR) + 1));
}

/** A total order: by the minted number, then by the full string (two kinds never share a number). */
export function compareEntityIds(left: EntityId, right: EntityId): number {
  const byNumber = numberOf(left) - numberOf(right);
  if (byNumber !== 0) {
    return byNumber;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortByEntityId<Item extends { readonly id: EntityId }>(items: Item[]): Item[] {
  return items.sort((left, right) => compareEntityIds(left.id, right.id));
}

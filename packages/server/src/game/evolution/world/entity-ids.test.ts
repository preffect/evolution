import { describe, expect, it } from 'vitest';
import { ENTITY_KIND, entityId } from '@evolution/shared';
import { compareEntityIds, ENTITY_ID_PREFIX, mintEntityId, sortByEntityId } from './entity-ids.js';

describe('mintEntityId', () => {
  it('prefixes by kind and advances one monotonic counter across kinds', () => {
    const counter = { nextEntityNumber: 1 };
    expect(mintEntityId(counter, ENTITY_KIND.cell)).toBe('c-1');
    expect(mintEntityId(counter, ENTITY_KIND.foodMote)).toBe('m-2');
    expect(mintEntityId(counter, ENTITY_KIND.dnaFragment)).toBe('f-3');
    expect(counter.nextEntityNumber).toBe(4);
  });

  it('declares a prefix for every entity kind', () => {
    expect(Object.keys(ENTITY_ID_PREFIX).sort()).toEqual(Object.values(ENTITY_KIND).sort());
  });
});

describe('compareEntityIds', () => {
  it('orders by the minted number, not by string', () => {
    expect(compareEntityIds(entityId('m-9'), entityId('m-10'))).toBeLessThan(0);
    expect(compareEntityIds(entityId('m-10'), entityId('m-9'))).toBeGreaterThan(0);
    expect(compareEntityIds(entityId('m-9'), entityId('m-9'))).toBe(0);
  });

  it('falls back to the string for equal numbers of different kinds', () => {
    expect(compareEntityIds(entityId('c-5'), entityId('m-5'))).toBeLessThan(0);
    expect(compareEntityIds(entityId('m-5'), entityId('c-5'))).toBeGreaterThan(0);
  });
});

describe('sortByEntityId', () => {
  it('sorts in place and returns the array', () => {
    const items = [{ id: entityId('m-10') }, { id: entityId('m-2') }, { id: entityId('m-1') }];
    expect(sortByEntityId(items).map((item) => item.id)).toEqual(['m-1', 'm-2', 'm-10']);
  });
});

import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, FOOD_KIND, entityId, type FoodMoteView } from '@evolution/shared';
import { FoodStore } from './food-store';

const algae = (id: string, x: number): FoodMoteView => ({
  id: entityId(id),
  kind: FOOD_KIND.algae,
  bacteriumVariant: null,
  x,
  y: 0,
});
const rod = (id: string, x: number): FoodMoteView => ({
  id: entityId(id),
  kind: FOOD_KIND.bacterium,
  bacteriumVariant: BACTERIUM_VARIANT.plain,
  x,
  y: 0,
});

describe('FoodStore', () => {
  it('upserts spawned motes and deletes removed ids if present', () => {
    const store = new FoodStore();
    store.applyDelta({ spawned: [algae('a', 1), algae('b', 2)], removedIds: [], moved: [] }, 3);
    store.applyDelta({ spawned: [algae('a', 5)], removedIds: [entityId('b'), entityId('missing')], moved: [] }, 6);
    expect(store.size).toBe(1);
    expect(store.motesAt(6)).toEqual([algae('a', 5)]);
  });

  it('lerps a moved bacterium between its last two reports and holds a static mote', () => {
    const store = new FoodStore();
    store.applyDelta({ spawned: [rod('m', 0), algae('a', 7)], removedIds: [], moved: [] }, 3);
    store.applyDelta({ spawned: [], removedIds: [], moved: [{ id: entityId('m'), x: 10, y: 0 }] }, 6);
    store.applyDelta({ spawned: [], removedIds: [], moved: [{ id: entityId('m'), x: 20, y: 10 }] }, 9);
    const motes = store.motesAt(7.5);
    expect(motes.find((mote) => mote.id === 'm')).toMatchObject({ x: 15, y: 5 });
    expect(motes.find((mote) => mote.id === 'a')).toMatchObject({ x: 7 });
    expect(store.motesAt(100).find((mote) => mote.id === 'm')).toMatchObject({ x: 20, y: 10 });
  });

  it('ignores a move for an unknown mote and forgets everything on reset', () => {
    const store = new FoodStore();
    store.applyDelta({ spawned: [], removedIds: [], moved: [{ id: entityId('ghost'), x: 1, y: 1 }] }, 3);
    expect(store.size).toBe(0);
    store.applyDelta({ spawned: [algae('a', 1)], removedIds: [], moved: [] }, 3);
    store.reset();
    expect(store.motesAt(3)).toEqual([]);
  });
});

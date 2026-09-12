import { describe, expect, it, vi } from 'vitest';
import { ViewRegistry } from './view-registry';

interface Item {
  readonly id: string;
  readonly value: number;
}

function createRegistry() {
  const destroy = vi.fn();
  const registry = new ViewRegistry<Item, { id: string }>({ create: (item) => ({ id: item.id }), destroy });
  return { registry, destroy };
}

describe('ViewRegistry', () => {
  it('creates a view per new id and pairs every item with its view in order', () => {
    const { registry } = createRegistry();
    const sync = registry.sync([
      { id: 'b', value: 1 },
      { id: 'a', value: 2 },
    ]);
    expect(sync.created.map((view) => view.id)).toEqual(['b', 'a']);
    expect(sync.pairs.map(([item, view]) => [item.value, view.id])).toEqual([
      [1, 'b'],
      [2, 'a'],
    ]);
    expect(registry.size).toBe(2);
  });

  it('keeps the same view for a surviving id and destroys the view of a vanished id', () => {
    const { registry, destroy } = createRegistry();
    const first = registry.sync([{ id: 'a', value: 1 }]);
    const second = registry.sync([{ id: 'c', value: 3 }]);
    expect(second.removed).toEqual(first.created);
    expect(destroy).toHaveBeenCalledWith(first.created[0]);
    const third = registry.sync([{ id: 'c', value: 4 }]);
    expect(third.kept[0]).toBe(second.created[0]);
    expect(third.created).toEqual([]);
    expect(registry.get('c')).toBe(second.created[0]);
  });

  it('forEachSynced visits every item with its view and index, creating and destroying like sync', () => {
    const { registry, destroy } = createRegistry();
    const visited: [number, string, number][] = [];
    registry.forEachSynced([{ id: 'a', value: 1 }], (item, view, index) => visited.push([item.value, view.id, index]));
    const first = registry.get('a');
    registry.forEachSynced(
      [
        { id: 'b', value: 2 },
        { id: 'a', value: 3 },
      ],
      (item, view, index) => visited.push([item.value, view.id, index]),
    );
    expect(visited).toEqual([
      [1, 'a', 0],
      [2, 'b', 0],
      [3, 'a', 1],
    ]);
    expect(registry.get('a')).toBe(first);
    registry.forEachSynced([], () => undefined);
    expect(destroy).toHaveBeenCalledTimes(2);
    expect(registry.size).toBe(0);
  });

  it('destroys everything on clear', () => {
    const { registry, destroy } = createRegistry();
    registry.sync([{ id: 'a', value: 1 }]);
    registry.clear();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);
    expect([...registry.values()]).toEqual([]);
  });
});
